// src/server/store.js — SQLITE-1
//
// The single owner of the SQLite connection, the schema, and the one-time
// import out of the old JSON files. Everything that used to call
// fs.writeFileSync on a file under data/ now calls an accessor here.
//
// Design note: docs/SQLITE_DESIGN.md. Two rules from it that this file is
// responsible for keeping true:
//
//   1. The database path resolves from process.cwd(), exactly as every JSON
//      path in src/server did. src/test/helpers/runScript.js spawns each suite
//      in a scratch cwd and that is the only thing keeping test runs out of the
//      developer's real data/ — resolving from __dirname instead would punch
//      straight through it.
//   2. The connection opens lazily, on first use. A module that imports the
//      store but never persists must not create a database, and every spawned
//      test process should not pay for a native handle it never uses.

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA_VERSION = '1';

// ── Connection ───────────────────────────────────────────────────────────────

let db = null;
let openedAt = null;   // the cwd this handle was resolved against

function dataDir() { return path.join(process.cwd(), 'data'); }
function dbPath()  { return path.join(dataDir(), 'app.db'); }

// Opens on first use. If the cwd changed since the handle was opened (only
// happens in-process in tests), the old handle is dropped and a new one is
// opened against the new location.
function conn() {
  const wanted = dbPath();
  if (db && openedAt === wanted) return db;
  if (db) { try { db.close(); } catch { /* already gone */ } db = null; }

  fs.mkdirSync(dataDir(), { recursive: true });
  db = new Database(wanted);
  openedAt = wanted;

  // WAL so a reader never blocks the writer. NORMAL because losing the last
  // few ms of play-money state on a power cut is acceptable and FULL costs an
  // fsync per commit.
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  applySchema(db);
  migrateFromJson(db);
  return db;
}

function applySchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS profiles (
      owner_id   TEXT PRIMARY KEY,
      chat       TEXT    NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agents (
      owner_id        TEXT    NOT NULL,
      id              TEXT    NOT NULL,
      name            TEXT,
      status          TEXT,
      active_table_id TEXT,
      created_at      INTEGER NOT NULL DEFAULT 0,
      updated_at      INTEGER NOT NULL DEFAULT 0,
      data            TEXT    NOT NULL,
      PRIMARY KEY (owner_id, id)
    );
    CREATE INDEX IF NOT EXISTS agents_status ON agents (status);

    CREATE TABLE IF NOT EXISTS hands (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id   TEXT    NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      data       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hands_owner ON hands (owner_id, seq DESC);

    CREATE TABLE IF NOT EXISTS opponent_stats (
      player_id    TEXT PRIMARY KEY,
      display_name TEXT,
      hands        TEXT    NOT NULL DEFAULT '[]',
      updated_at   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_state (
      owner_id   TEXT PRIMARY KEY,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);
  d.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)')
    .run('schema_version', SCHEMA_VERSION);
}

function metaGet(d, key) {
  return d.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
}
function metaSet(d, key, value) {
  d.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

const jsonParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };

// ── One-time migration out of the JSON files ─────────────────────────────────
//
// Idempotent twice over: the meta stamp short-circuits the import, and the
// source file is renamed to <name>.migrated once it has been read, so there is
// nothing left to import on a second boot. Files are NEVER deleted — the
// .migrated copy is the rollback parachute.
//
// Each file imports inside its own transaction: if it throws, nothing is
// written and nothing is renamed, so the JSON is still the source of truth.

function migrateFromJson(d) {
  migrateAgents(d);
  migrateHands(d);
  migrateOpponents(d);
  migrateNotifications(d);
}

function retire(file) {
  try { fs.renameSync(file, `${file}.migrated`); }
  catch (err) { console.error(`[store] could not rename ${path.basename(file)}: ${err.message}`); }
}

function migrateAgents(d) {
  if (metaGet(d, 'migrated_agents_at')) return;
  const file = path.join(dataDir(), 'agents.json');
  if (!fs.existsSync(file)) return;

  const raw = jsonParse(fs.readFileSync(file, 'utf8'), null);
  if (!raw || typeof raw !== 'object') {
    console.error('[store] data/agents.json is not readable JSON — leaving it in place, starting empty');
    return;
  }

  let owners = 0, agents = 0;
  d.transaction(() => {
    for (const [ownerId, profile] of Object.entries(raw)) {
      if (!profile || typeof profile !== 'object') continue;
      putProfileRow(d, ownerId, profile.chat ?? []);
      owners++;
      const list = Array.isArray(profile.agents) ? profile.agents : [];
      for (let i = 0; i < list.length; i++) {
        putAgentRow(d, ownerId, list[i], i);
        agents++;
      }
    }
    metaSet(d, 'migrated_agents_at', Date.now());
  })();

  retire(file);
  console.log(`[store] migrated data/agents.json — ${owners} owner(s), ${agents} agent(s) → data/app.db`);
}

function migrateHands(d) {
  if (metaGet(d, 'migrated_hands_at')) return;
  let files = [];
  try {
    files = fs.readdirSync(dataDir()).filter((n) => /^hands-.+\.json$/.test(n));
  } catch { return; }

  let total = 0;
  d.transaction(() => {
    for (const name of files) {
      const ownerId = name.slice('hands-'.length, -'.json'.length);
      const list = jsonParse(fs.readFileSync(path.join(dataDir(), name), 'utf8'), []);
      if (!Array.isArray(list)) continue;
      // Stored newest-first; insert oldest-first so ascending seq matches.
      for (let i = list.length - 1; i >= 0; i--) {
        insertHandRow(d, ownerId, list[i]);
        total++;
      }
    }
    metaSet(d, 'migrated_hands_at', Date.now());
  })();

  for (const name of files) retire(path.join(dataDir(), name));
  if (files.length) console.log(`[store] migrated ${files.length} hands-*.json file(s) — ${total} hand(s) → data/app.db`);
}

function migrateOpponents(d) {
  if (metaGet(d, 'migrated_opponents_at')) return;
  const file = path.join(dataDir(), 'opponents.json');
  if (!fs.existsSync(file)) return;
  const raw = jsonParse(fs.readFileSync(file, 'utf8'), null);
  if (!raw || typeof raw !== 'object') return;

  let n = 0;
  d.transaction(() => {
    for (const [playerId, entry] of Object.entries(raw)) {
      if (!entry || typeof entry !== 'object') continue;
      putOpponentRow(d, playerId, entry);
      n++;
    }
    metaSet(d, 'migrated_opponents_at', Date.now());
  })();

  retire(file);
  console.log(`[store] migrated data/opponents.json — ${n} opponent(s) → data/app.db`);
}

function migrateNotifications(d) {
  if (metaGet(d, 'migrated_notifications_at')) return;
  const file = path.join(dataDir(), 'notifications.json');
  if (!fs.existsSync(file)) return;
  const raw = jsonParse(fs.readFileSync(file, 'utf8'), null);
  if (!raw || typeof raw !== 'object') return;

  let n = 0;
  d.transaction(() => {
    for (const [ownerId, state] of Object.entries(raw)) {
      if (!state || typeof state !== 'object') continue;
      putNotificationRow(d, ownerId, state);
      n++;
    }
    metaSet(d, 'migrated_notifications_at', Date.now());
  })();

  retire(file);
  console.log(`[store] migrated data/notifications.json — ${n} owner(s) → data/app.db`);
}

// ── Row writers (shared by the migration and the live accessors) ─────────────

function putProfileRow(d, ownerId, chat) {
  d.prepare(`
    INSERT INTO profiles (owner_id, chat, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET chat = excluded.chat, updated_at = excluded.updated_at
  `).run(String(ownerId), JSON.stringify(chat ?? []), Date.now());
}

// The lifted columns are written from `data` and never read back into it —
// one writer, no drift. createdAt keeps the JSON array order stable across the
// migration for records that predate any timestamp field.
function putAgentRow(d, ownerId, agent, ordinal = 0) {
  const createdAt = Number.isFinite(agent?.createdAt) ? agent.createdAt : ordinal;
  d.prepare(`
    INSERT INTO agents (owner_id, id, name, status, active_table_id, created_at, updated_at, data)
    VALUES (@owner_id, @id, @name, @status, @active_table_id, @created_at, @updated_at, @data)
    ON CONFLICT(owner_id, id) DO UPDATE SET
      name            = excluded.name,
      status          = excluded.status,
      active_table_id = excluded.active_table_id,
      created_at      = excluded.created_at,
      updated_at      = excluded.updated_at,
      data            = excluded.data
  `).run({
    owner_id: String(ownerId),
    id: String(agent?.id ?? ''),
    name: agent?.name ?? null,
    status: agent?.status ?? null,
    active_table_id: agent?.activeTableId ?? null,
    created_at: createdAt,
    updated_at: Date.now(),
    data: JSON.stringify(agent ?? {}),
  });
}

function insertHandRow(d, ownerId, hand) {
  d.prepare('INSERT INTO hands (owner_id, created_at, data) VALUES (?, ?, ?)')
    .run(String(ownerId), Number.isFinite(hand?.timestamp) ? hand.timestamp : Date.now(), JSON.stringify(hand ?? {}));
}

function putOpponentRow(d, playerId, entry) {
  d.prepare(`
    INSERT INTO opponent_stats (player_id, display_name, hands, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      display_name = excluded.display_name, hands = excluded.hands, updated_at = excluded.updated_at
  `).run(String(playerId), entry?.displayName ?? String(playerId), JSON.stringify(entry?.hands ?? []), Date.now());
}

function putNotificationRow(d, ownerId, state) {
  d.prepare(`
    INSERT INTO notification_state (owner_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(String(ownerId), JSON.stringify(state ?? {}), Date.now());
}

// ── Agents + profiles ────────────────────────────────────────────────────────

// The whole agent store in the shape agentProfiles.js has always held in
// memory: { [userId]: { userId, agents: [...], chat: [...] } }.
export function loadAgentStore() {
  const d = conn();
  const out = {};
  for (const row of d.prepare('SELECT owner_id, chat FROM profiles').all()) {
    out[row.owner_id] = { userId: row.owner_id, agents: [], chat: jsonParse(row.chat, []) };
  }
  const agents = d.prepare('SELECT owner_id, data FROM agents ORDER BY owner_id, created_at, id').all();
  for (const row of agents) {
    // An agent row without a profile row can only come from a partial import;
    // keep the agent rather than dropping it on the floor.
    if (!out[row.owner_id]) out[row.owner_id] = { userId: row.owner_id, agents: [], chat: [] };
    out[row.owner_id].agents.push(jsonParse(row.data, {}));
  }
  return out;
}

// Persists one owner's profile: the chat log plus every agent, and deletes
// agent rows that are no longer in the array (a retire/delete). One
// transaction, which is the write-atomicity the JSON rewrite never had.
export function saveProfile(ownerId, profile) {
  const d = conn();
  const owner = String(ownerId);
  const list = Array.isArray(profile?.agents) ? profile.agents : [];

  d.transaction(() => {
    putProfileRow(d, owner, profile?.chat ?? []);
    for (let i = 0; i < list.length; i++) putAgentRow(d, owner, list[i], i);

    const keep = new Set(list.map((a) => String(a?.id ?? '')));
    for (const row of d.prepare('SELECT id FROM agents WHERE owner_id = ?').all(owner)) {
      if (!keep.has(row.id)) d.prepare('DELETE FROM agents WHERE owner_id = ? AND id = ?').run(owner, row.id);
    }
  })();

  return list.length;
}

// ── Hand history ─────────────────────────────────────────────────────────────

// Appends one hand and trims the owner back to `cap`, in one transaction.
// Replaces the old read-modify-write of the whole hands-<owner>.json file.
export function appendHandRow(ownerId, hand, cap) {
  const d = conn();
  const owner = String(ownerId);
  d.transaction(() => {
    insertHandRow(d, owner, hand);
    d.prepare(`
      DELETE FROM hands
       WHERE owner_id = ?
         AND seq NOT IN (SELECT seq FROM hands WHERE owner_id = ? ORDER BY seq DESC LIMIT ?)
    `).run(owner, owner, cap);
  })();
}

// Newest-first, which is what hands.unshift() produced.
export function readHandRows(ownerId, limit) {
  const rows = conn()
    .prepare('SELECT data FROM hands WHERE owner_id = ? ORDER BY seq DESC LIMIT ?')
    .all(String(ownerId), limit);
  return rows.map((r) => jsonParse(r.data, null)).filter((h) => h !== null);
}

// Every owner that has hands. Hand owners are a different key space from agent
// owners — appendHand() is called with the seat's playerId, which is not always
// an agent owner id — so the export walks this rather than the profiles table.
export function listHandOwners() {
  return conn().prepare('SELECT DISTINCT owner_id FROM hands ORDER BY owner_id').all().map((r) => r.owner_id);
}

// ── Opponent stats ───────────────────────────────────────────────────────────

export function loadOpponentStats() {
  const out = {};
  for (const row of conn().prepare('SELECT player_id, display_name, hands FROM opponent_stats').all()) {
    out[row.player_id] = {
      playerId: row.player_id,
      displayName: row.display_name ?? row.player_id,
      hands: jsonParse(row.hands, []),
    };
  }
  return out;
}

// Mirrors the whole in-memory ring store, matching the old whole-file write.
// Rows absent from `stats` are deleted so reset() + save cannot leave orphans.
export function saveOpponentStats(stats) {
  const d = conn();
  d.transaction(() => {
    const keep = new Set();
    for (const [playerId, entry] of Object.entries(stats ?? {})) {
      putOpponentRow(d, playerId, entry);
      keep.add(String(playerId));
    }
    for (const row of d.prepare('SELECT player_id FROM opponent_stats').all()) {
      if (!keep.has(row.player_id)) d.prepare('DELETE FROM opponent_stats WHERE player_id = ?').run(row.player_id);
    }
  })();
}

// ── Notification state ───────────────────────────────────────────────────────

export function loadNotificationState() {
  const out = {};
  for (const row of conn().prepare('SELECT owner_id, data FROM notification_state').all()) {
    out[row.owner_id] = jsonParse(row.data, {});
  }
  return out;
}

export function saveNotificationState(state) {
  const d = conn();
  d.transaction(() => {
    const keep = new Set();
    for (const [ownerId, entry] of Object.entries(state ?? {})) {
      putNotificationRow(d, ownerId, entry);
      keep.add(String(ownerId));
    }
    for (const row of d.prepare('SELECT owner_id FROM notification_state').all()) {
      if (!keep.has(row.owner_id)) d.prepare('DELETE FROM notification_state WHERE owner_id = ?').run(row.owner_id);
    }
  })();
}

// ── Test / tooling hooks ─────────────────────────────────────────────────────

// Drops the handle so the next call re-resolves against the current cwd. This
// is what lets store.test.js exercise the migration and the idempotent second
// boot in-process instead of spawning.
export function _closeForTests() {
  if (!db) return;
  try { db.close(); } catch { /* already gone */ }
  db = null;
  openedAt = null;
}

// Opens (and therefore migrates) eagerly. index.js calls this at boot so the
// migration log lands at startup rather than on the first hand, and so a failed
// import stops the server instead of surfacing mid-session.
export function openStore() {
  conn();
  return dbPath();
}

export { dbPath as _dbPath };
