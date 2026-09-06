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
import { seedOwner } from './wallet.js';

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

    -- NOTIFY-1: the send ledger. (owner_id, type, ts) is the whole budget
    -- input — three per owner per day, thirty minutes apart, and the rotation
    -- index for a type is just how many of that type have gone before — so
    -- nothing about a decision is stored, only what was actually done.
    --
    -- "state" is the one column beyond that triple: a message that arrives in
    -- quiet hours (or inside the 30-minute gap) is HELD, not cancelled, so the
    -- row has to survive a restart with the text it will eventually send.
    -- 'sent' rows are the ledger; 'held' rows are the queue.
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id   TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      ts         INTEGER NOT NULL,
      state      TEXT    NOT NULL DEFAULT 'sent',
      deliver_at INTEGER,
      payload    TEXT
    );
    CREATE INDEX IF NOT EXISTS notifications_owner ON notifications (owner_id, ts DESC);
    CREATE INDEX IF NOT EXISTS notifications_held  ON notifications (state, deliver_at);

    -- WALLET-1: the owner's money, separate from the roll each agent carries.
    CREATE TABLE IF NOT EXISTS wallets (
      owner_id   TEXT PRIMARY KEY,
      balance    INTEGER NOT NULL DEFAULT 0,
      ledger     TEXT    NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- SERVER-3: the table thread. Every line the watch screen's history sheet
    -- shows, per SESSION rather than per table: it is what HIS session sounded
    -- like, so a reconnect (or a look back an hour later) gets the record back
    -- instead of whatever the socket happened to be awake for.
    --
    -- "who" is the label the sheet prints -- TABLE / HIM / YOU / an opponent's
    -- display name -- and "kind" is the four-way it renders from, so a
    -- renamed opponent cannot turn into a fifth style. "ts" is the SERVER's
    -- clock: a client that reconnects on a different device must not have to
    -- reconcile two orderings of the same conversation.
    CREATE TABLE IF NOT EXISTS session_thread (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL,
      agent_id   TEXT    NOT NULL,
      owner_id   TEXT    NOT NULL,
      table_id   TEXT,
      ts         INTEGER NOT NULL,
      kind       TEXT    NOT NULL,
      who        TEXT    NOT NULL,
      text       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_thread_session ON session_thread (session_id, id);
    CREATE INDEX IF NOT EXISTS session_thread_agent   ON session_thread (agent_id, id DESC);

    -- METER-1: what the models cost, rolled up as it happens.
    --
    -- One row per (day, owner, kind, model) rather than one per call. A busy
    -- floor makes tens of thousands of decisions a day and the question this
    -- table exists to answer — "what did today cost, and whose was it" — has
    -- the same answer either way, so the log would be a bigger table than the
    -- hand history, bought with nothing. The four columns in the key are the four
    -- axes anybody actually slices on: when, who, what for, and on which
    -- model (which is the MODEL-1 tiers question, answered from production
    -- rather than from the arena).
    --
    -- "unpriced" is carried rather than swallowed, exactly as pricing.js
    -- carries it: a total that silently omits an unpriced model is a total
    -- that understates the bill.
    CREATE TABLE IF NOT EXISTS model_calls (
      day                 TEXT    NOT NULL,
      owner_id            TEXT    NOT NULL,
      kind                TEXT    NOT NULL,
      model               TEXT    NOT NULL,
      calls               INTEGER NOT NULL DEFAULT 0,
      input_tokens        INTEGER NOT NULL DEFAULT 0,
      output_tokens       INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      usd                 REAL    NOT NULL DEFAULT 0,
      unpriced            INTEGER NOT NULL DEFAULT 0,
      updated_at          INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, owner_id, kind, model)
    );
    CREATE INDEX IF NOT EXISTS model_calls_day ON model_calls (day);

    -- COST-1: where the decisions WENT. One row per (day, owner, route,
    -- reason), summed the same add-and-forget way model_calls is.
    --
    -- It is a second table rather than a 'policy' entry in the model column of the
    -- first one, because a decision the router answered for nothing is not a
    -- model call and must never be able to land in a bill. The two are read
    -- side by side (ownerMeter) and that is where they belong together: the
    -- dollars, and the reason there were not more of them.
    CREATE TABLE IF NOT EXISTS decision_routes (
      day        TEXT    NOT NULL,
      owner_id   TEXT    NOT NULL,
      route      TEXT    NOT NULL,
      reason     TEXT    NOT NULL,
      decisions  INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, owner_id, route, reason)
    );
    CREATE INDEX IF NOT EXISTS decision_routes_day ON decision_routes (day);

    -- GUEST-1: the third way in. A guest is an owner like any other — the same
    -- owner_id runs through profiles, agents, wallets and every thread row —
    -- and this table is only the CREDENTIAL and the meter beside it.
    --
    -- The token is the primary key because it is what the cookie carries and
    -- what every request resolves through; owner_id is unique because a guest
    -- owner has exactly one token and a second one would be a second door into
    -- the same flat.
    --
    -- The ip column is kept for one purpose only: the 5-a-day creation cap. It is the
    -- creating address, never updated afterwards, and nothing reads it except
    -- that count.
    --
    -- claimed_by is the Telegram owner this guest became, or NULL. A claimed
    -- row is KEPT rather than deleted: it is what makes a second claim on the
    -- same token a no-op instead of minting a fresh empty guest, and it is the
    -- only record that the two ids were ever the same person.
    --
    -- session_day / session_count are the one-casino-session-a-day meter.
    -- A day stamp plus a counter rather than a row per session, because the
    -- only question ever asked of it is "how many today".
    CREATE TABLE IF NOT EXISTS guests (
      token         TEXT PRIMARY KEY,
      owner_id      TEXT NOT NULL UNIQUE,
      created_at    INTEGER NOT NULL DEFAULT 0,
      last_seen_at  INTEGER NOT NULL DEFAULT 0,
      ip            TEXT,
      claimed_by    TEXT,
      session_day   TEXT,
      session_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS guests_owner   ON guests (owner_id);
    CREATE INDEX IF NOT EXISTS guests_ip      ON guests (ip, created_at);
    CREATE INDEX IF NOT EXISTS guests_stale   ON guests (claimed_by, last_seen_at);
  `);

  // WALLET-1: pockets live inside the agent record, but the wallet screen asks
  // for one aggregate over them ("in pockets"), so that one field is lifted to
  // a column and answered with SUM() instead of walking every agent record.
  // ALTER rather than a column in CREATE TABLE: databases from SQLITE-1 exist.
  addColumnIfMissing(d, 'agents', 'pocket_balance', "INTEGER NOT NULL DEFAULT 0");

  // THREAD-2: who said it and who it was said to. Agent ids, 'owner', or
  // 'all' (the room) — the client renders "BALANCE -> GRANITE" from the pair,
  // and a line with neither is a line nobody can attribute. Nullable, because
  // every line written before this has neither and a table line ("Granite
  // raised to 240") is said by the room to nobody in particular.
  addColumnIfMissing(d, 'session_thread', 'from_id', 'TEXT');
  addColumnIfMissing(d, 'session_thread', 'to_id', 'TEXT');
  // THREAD-2: the nightly exchange is ONE entry, not a run of loose lines, so
  // the lines it is made of ride with it as JSON. Null on every other kind.
  addColumnIfMissing(d, 'session_thread', 'lines', 'TEXT');
  // WATCH-9: the room's voice has one line in it that is not neutral — where a
  // low attribute cost him the hand — and the sheet draws that one in gold. It
  // was a client-side flag on a live row and nothing else, so the moment the
  // thread was refetched (a reconnect, or opening the sheet an hour later) the
  // line came back in the room's ordinary grey. A stored line has to be able to
  // say what it is; this is the column that lets it.
  addColumnIfMissing(d, 'session_thread', 'cost', 'INTEGER');

  // SLOTS-1: what this owner's agents have won, ever — the sum of positive
  // session nets, and the only currency an agent slot can be unlocked with.
  // A column rather than a ledger fold for the same reason pocket.realised is
  // a counter: the ledger is capped at 100 entries, and a lifetime total that
  // quietly forgets its own first year is not a lifetime total. ALTER rather
  // than a CREATE TABLE column: wallets from WALLET-1 exist.
  addColumnIfMissing(d, 'wallets', 'earned', 'INTEGER NOT NULL DEFAULT 0');
  // FRIDGE-1: what is in this owner's fridge, as { beer, snack } counts. One
  // small JSON column rather than a column per shelf, because the shelves are
  // a product decision and adding a third one should not be a migration.
  addColumnIfMissing(d, 'wallets', 'fridge', "TEXT NOT NULL DEFAULT '{}'");

  // NOTIFY-2: the caps folded in from the legacy notifier are per agent and
  // per period ("one broke alert a day", "one milestone ever"), which the
  // (owner, type, ts) triple cannot express. One nullable column carries the
  // caller's own cap key instead of six bespoke state fields.
  // HOME-STATE-1: a thread line now knows where it was said. Everything that
  // predates the home is 'table', which is what the DEFAULT encodes — a
  // migration that has to touch no rows. The one other value today is 'home':
  // the nightly exchange between two agents who spent the evening in, which is
  // a real conversation with no table under it.
  addColumnIfMissing(d, 'session_thread', 'source', "TEXT NOT NULL DEFAULT 'table'");

  // SERVER-4: how far back the owner's UNREAD room thread goes — the ts of the
  // oldest line in his flat he has not looked at, or 0 for "nothing waiting".
  // A column on `profiles` rather than a field inside the chat JSON because it
  // is written by a thread line landing and cleared by a route, neither of
  // which has any business rewriting the creation chat to do it. Zero, not
  // null, so the migration touches no rows: an owner who has never had the
  // feature has nothing unread, which is exactly true.
  addColumnIfMissing(d, 'profiles', 'home_thread_unread_since', 'INTEGER NOT NULL DEFAULT 0');

  addColumnIfMissing(d, 'notifications', 'dedupe_key', 'TEXT');
  d.exec('CREATE INDEX IF NOT EXISTS notifications_key ON notifications (owner_id, dedupe_key)');

  d.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)')
    .run('schema_version', SCHEMA_VERSION);
}

function addColumnIfMissing(d, table, column, decl) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
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
  seedWallets(d);
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

function putProfileRow(d, ownerId, chat, homeThreadUnreadSince = 0) {
  const unread = Number.isFinite(homeThreadUnreadSince) ? Math.max(0, Math.floor(homeThreadUnreadSince)) : 0;
  d.prepare(`
    INSERT INTO profiles (owner_id, chat, home_thread_unread_since, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      chat = excluded.chat,
      home_thread_unread_since = excluded.home_thread_unread_since,
      updated_at = excluded.updated_at
  `).run(String(ownerId), JSON.stringify(chat ?? []), unread, Date.now());
}

// The lifted columns are written from `data` and never read back into it —
// one writer, no drift. createdAt keeps the JSON array order stable across the
// migration for records that predate any timestamp field.
function putAgentRow(d, ownerId, agent, ordinal = 0) {
  const createdAt = Number.isFinite(agent?.createdAt) ? agent.createdAt : ordinal;
  d.prepare(`
    INSERT INTO agents (owner_id, id, name, status, active_table_id, created_at, updated_at, pocket_balance, data)
    VALUES (@owner_id, @id, @name, @status, @active_table_id, @created_at, @updated_at, @pocket_balance, @data)
    ON CONFLICT(owner_id, id) DO UPDATE SET
      name            = excluded.name,
      status          = excluded.status,
      active_table_id = excluded.active_table_id,
      created_at      = excluded.created_at,
      updated_at      = excluded.updated_at,
      pocket_balance  = excluded.pocket_balance,
      data            = excluded.data
  `).run({
    owner_id: String(ownerId),
    id: String(agent?.id ?? ''),
    name: agent?.name ?? null,
    status: agent?.status ?? null,
    active_table_id: agent?.activeTableId ?? null,
    created_at: createdAt,
    updated_at: Date.now(),
    pocket_balance: Number.isFinite(agent?.pocket?.balance) ? agent.pocket.balance : 0,
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
  for (const row of d.prepare('SELECT owner_id, chat, home_thread_unread_since FROM profiles').all()) {
    out[row.owner_id] = {
      userId: row.owner_id,
      agents: [],
      chat: jsonParse(row.chat, []),
      // SERVER-4: 0 on the wire means nothing waiting; in memory that is null,
      // so nobody downstream has to know which of the two sentinels they hold.
      homeThreadUnreadSince: row.home_thread_unread_since || null,
    };
  }
  const agents = d.prepare('SELECT owner_id, data FROM agents ORDER BY owner_id, created_at, id').all();
  for (const row of agents) {
    // An agent row without a profile row can only come from a partial import;
    // keep the agent rather than dropping it on the floor.
    if (!out[row.owner_id]) out[row.owner_id] = { userId: row.owner_id, agents: [], chat: [], homeThreadUnreadSince: null };
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
    putProfileRow(d, owner, profile?.chat ?? [], profile?.homeThreadUnreadSince ?? 0);
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
//
// NOTIFY-2: nothing writes this table any more. The legacy NOTIFY_ENABLED
// notifier that owned it was folded into src/server/notify.js, whose state is
// the `notifications` ledger below. It is kept because SQLITE-1 migrated
// data/notifications.json into it and scripts/export-json.js still writes that
// history back out — it is the rollback parachute, not live state.

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

// ── Notification ledger (NOTIFY-1) ───────────────────────────────────────────
//
// Two shapes over one table. A 'sent' row is history and is never updated; a
// 'held' row is a message waiting for the window to open and is deleted the
// moment it either goes out (as a fresh 'sent' row) or loses on budget.

export function recordNotificationSent(ownerId, type, ts, key = null) {
  conn().prepare("INSERT INTO notifications (owner_id, type, ts, state, dedupe_key) VALUES (?, ?, ?, 'sent', ?)")
    .run(String(ownerId), String(type), Math.floor(ts), key == null ? null : String(key));
}

// NOTIFY-2: has this owner already been sent — or is he already queued — a
// message under this cap key? Held rows count, so an event that qualifies
// twice inside one quiet window queues once. A held row that later loses on
// budget is deleted, which correctly frees the key again: it never arrived.
export function hasNotificationKey(ownerId, key) {
  if (!key) return false;
  const row = conn().prepare(
    'SELECT 1 AS hit FROM notifications WHERE owner_id = ? AND dedupe_key = ? LIMIT 1',
  ).get(String(ownerId), String(key));
  return !!row;
}

// Every send for this owner at or after `sinceTs`, oldest first. The daily
// count and the gap-since-last-send are both read off this one query.
export function listNotificationsSince(ownerId, sinceTs) {
  return conn().prepare(
    "SELECT type, ts FROM notifications WHERE owner_id = ? AND state = 'sent' AND ts >= ? ORDER BY ts",
  ).all(String(ownerId), Math.floor(sinceTs));
}

// How many of `type` this owner has ever been sent — the rotation index, so
// "never the same alternate twice running" needs no state of its own.
export function countNotificationsOfType(ownerId, type) {
  const row = conn().prepare(
    "SELECT COUNT(*) AS n FROM notifications WHERE owner_id = ? AND type = ? AND state = 'sent'",
  ).get(String(ownerId), String(type));
  return row?.n ?? 0;
}

export function putNotificationHold(ownerId, type, deliverAt, payload, key = null) {
  const info = conn().prepare(
    "INSERT INTO notifications (owner_id, type, ts, state, deliver_at, payload, dedupe_key) VALUES (?, ?, ?, 'held', ?, ?, ?)",
  ).run(String(ownerId), String(type), Date.now(), Math.floor(deliverAt),
        JSON.stringify(payload ?? {}), key == null ? null : String(key));
  return Number(info.lastInsertRowid);
}

// Held rows for one owner (or every owner when ownerId is null — what the
// restart flush walks), soonest first.
export function listNotificationHolds(ownerId = null) {
  const rows = ownerId === null
    ? conn().prepare("SELECT id, owner_id, type, ts, deliver_at, payload, dedupe_key FROM notifications WHERE state = 'held' ORDER BY deliver_at").all()
    : conn().prepare("SELECT id, owner_id, type, ts, deliver_at, payload, dedupe_key FROM notifications WHERE state = 'held' AND owner_id = ? ORDER BY deliver_at").all(String(ownerId));
  return rows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    type: r.type,
    queuedAt: r.ts,
    deliverAt: r.deliver_at,
    payload: jsonParse(r.payload, {}),
    key: r.dedupe_key ?? null,
  }));
}

export function setNotificationHoldDeliverAt(id, deliverAt) {
  conn().prepare("UPDATE notifications SET deliver_at = ? WHERE id = ? AND state = 'held'")
    .run(Math.floor(deliverAt), id);
}

export function deleteNotificationHold(id) {
  conn().prepare("DELETE FROM notifications WHERE id = ? AND state = 'held'").run(id);
}

// ── Wallets (WALLET-1) ───────────────────────────────────────────────────────

export function loadWallet(ownerId) {
  const row = conn().prepare('SELECT owner_id, balance, earned, fridge, ledger FROM wallets WHERE owner_id = ?').get(String(ownerId));
  if (!row) return null;
  // SLOTS-1: `earned` is a lifetime total and a wallet written before the
  // column existed reads as zero — which understates a long-lived owner and is
  // the only safe direction to be wrong in, since it can never take a slot
  // away that somebody is already using.
  // FRIDGE-1: the fridge hangs off the wallet because it is the OWNER's, one
  // per household. A wallet written before the column existed reads as an
  // empty fridge, which is exactly what an owner who has never stocked one
  // has.
  return {
    ownerId: row.owner_id,
    balance: row.balance ?? 0,
    earned: row.earned ?? 0,
    fridge: jsonParse(row.fridge, { beer: 0, snack: 0 }),
    ledger: jsonParse(row.ledger, []),
  };
}

export function saveWallet(ownerId, wallet) {
  putWalletRow(conn(), ownerId, wallet);
}

function putWalletRow(d, ownerId, wallet) {
  d.prepare(`
    INSERT INTO wallets (owner_id, balance, earned, fridge, ledger, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      balance = excluded.balance, earned = excluded.earned, fridge = excluded.fridge,
      ledger = excluded.ledger, updated_at = excluded.updated_at
  `).run(
    String(ownerId),
    Math.max(0, Math.floor(wallet?.balance ?? 0)),
    Math.max(0, Math.floor(wallet?.earned ?? 0)),
    JSON.stringify(wallet?.fridge ?? { beer: 0, snack: 0 }),
    JSON.stringify(wallet?.ledger ?? []),
    Date.now(),
  );
}

// Total chips sitting in this owner's pockets — the wallet screen's "in
// pockets" tile. This is the query the lifted pocket_balance column exists for.
export function stakedTotal(ownerId) {
  const row = conn().prepare('SELECT COALESCE(SUM(pocket_balance), 0) AS total FROM agents WHERE owner_id = ?').get(String(ownerId));
  return row?.total ?? 0;
}

// Every owner that has a wallet or an agent — used by the offline conservation
// check, which has to see owners whose agents are all retired.
export function listOwners() {
  return conn().prepare(`
    SELECT owner_id FROM profiles
    UNION SELECT owner_id FROM wallets
    ORDER BY owner_id
  `).all().map((r) => r.owner_id);
}

// SEED-1: one-time seed of every owner's wallet from the per-agent bankrolls
// that existed before this feature. The rule and its justification are in
// docs/WALLET_DESIGN.md; seedOwner() in wallet.js is the rule itself, kept
// there so it can be tested without a database.
//
// Idempotent via the meta stamp, and again via seedOwner skipping any agent
// that already has a pocket. Runs in one transaction: a partial seed would
// break chip conservation, which is the one thing this must never do.
function seedWallets(d) {
  if (metaGet(d, 'migrated_wallets_at')) return;

  const owners = d.prepare('SELECT owner_id FROM profiles').all().map((r) => r.owner_id);
  let seededAgents = 0;
  let swept = 0;

  d.transaction(() => {
    for (const ownerId of owners) {
      const rows = d.prepare('SELECT id, data FROM agents WHERE owner_id = ? ORDER BY created_at, id').all(ownerId);
      const agents = rows.map((r) => jsonParse(r.data, {}));
      const result = seedOwner({ userId: ownerId, agents });
      if (result.seeded === 0 && result.swept === 0) continue;

      for (let i = 0; i < agents.length; i++) putAgentRow(d, ownerId, agents[i], i);

      const existing = d.prepare('SELECT balance, ledger FROM wallets WHERE owner_id = ?').get(ownerId);
      if (existing) {
        // A wallet already here means a partly-seeded owner; add rather than
        // replace so nothing already credited is lost.
        result.wallet.balance += existing.balance ?? 0;
        result.wallet.ledger = [...jsonParse(existing.ledger, []), ...result.wallet.ledger];
      }
      putWalletRow(d, ownerId, result.wallet);

      seededAgents += result.seeded;
      swept += result.swept;
    }
    metaSet(d, 'migrated_wallets_at', Date.now());
  })();

  if (seededAgents > 0) {
    console.log(`[store] seeded wallets — ${seededAgents} pocket(s) from existing bankrolls, ${swept} chip(s) swept to owner wallets`);
  }
}

// ── The table thread (SERVER-3) ──────────────────────────────────────────────
//
// Append-only per session, bounded per session. The cap is a session's worth
// of conversation, not a day's: a 100-hand session that produced 2000 lines
// has a client problem, not a storage problem, and a ring keeps the worst case
// a fixed size the way the event ring and every ledger in this codebase do.
export const THREAD_CAP_PER_SESSION = 500;

/**
 * Append one line and trim that session back to the cap, in one transaction.
 * Returns the row id, which is monotonic per database and therefore also the
 * order the sheet renders in.
 */
export function appendThreadLine({ sessionId, agentId, ownerId, tableId = null, ts, kind, who, text, source = 'table', from = null, to = null, lines = null, cost = false }) {
  const d = conn();
  const sid = String(sessionId);
  let id = null;
  d.transaction(() => {
    const info = d.prepare(`
      INSERT INTO session_thread (session_id, agent_id, owner_id, table_id, ts, kind, who, text, source, from_id, to_id, lines, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sid, String(agentId), String(ownerId), tableId ?? null,
           Number.isFinite(ts) ? Math.floor(ts) : Date.now(),
           String(kind), String(who), String(text), String(source ?? 'table'),
           from == null ? null : String(from),
           to == null ? null : String(to),
           Array.isArray(lines) ? JSON.stringify(lines) : null,
           cost ? 1 : 0);
    id = info.lastInsertRowid;
    d.prepare(`
      DELETE FROM session_thread
       WHERE session_id = ?
         AND id NOT IN (SELECT id FROM session_thread WHERE session_id = ? ORDER BY id DESC LIMIT ?)
    `).run(sid, sid, THREAD_CAP_PER_SESSION);
  })();
  return id;
}

/**
 * One session's thread, oldest first — the order it was said in, which is the
 * order the sheet scrolls.
 */
export function readThreadLines(sessionId, { limit = THREAD_CAP_PER_SESSION } = {}) {
  return conn().prepare(`
    SELECT id, session_id, agent_id, owner_id, table_id, ts, kind, who, text, source, from_id, to_id, lines, cost
      FROM session_thread
     WHERE session_id = ?
     ORDER BY id ASC
     LIMIT ?
  `).all(String(sessionId), limit).map(threadRow);
}

/**
 * The most recent session id this agent has any thread for, or null. What
 * `GET /api/agents/:id/thread` answers when no session is named — a client
 * that has just reconnected knows the agent, not the session it was in.
 */
export function latestThreadSession(agentId) {
  // THREAD-2: TABLE lines only. This is the fallback for a watcher that knows
  // the agent but not the id of the stay it was watching, and it has to answer
  // with a STAY — an evening in the flat is not one. The home thread has its
  // own door (GET /api/home/thread), so nothing needs to find it through here.
  const row = conn().prepare(`
    SELECT session_id FROM session_thread
     WHERE agent_id = ? AND source = 'table'
     ORDER BY id DESC LIMIT 1
  `).get(String(agentId));
  return row?.session_id ?? null;
}

function threadRow(r) {
  const line = {
    id: r.id,
    sessionId: r.session_id,
    agentId: r.agent_id,
    ownerId: r.owner_id,
    tableId: r.table_id ?? null,
    ts: r.ts,
    kind: r.kind,
    who: r.who,
    text: r.text,
    source: r.source ?? 'table',
    // THREAD-2: null on every line written before the columns existed, and on
    // the room's own lines, which are said by nobody to nobody.
    from: r.from_id ?? null,
    to: r.to_id ?? null,
  };
  // THREAD-2: only an `overheard` entry carries lines, and it always does.
  const lines = r.lines ? jsonParse(r.lines, null) : null;
  if (Array.isArray(lines)) line.lines = lines;
  // WATCH-9: present only when it is true. Every other line in the thread is an
  // ordinary one and a `cost: false` on all of them would be noise on the wire
  // and a lie about how many kinds of line there are — there is one register
  // that is gold, and a line either is it or says nothing.
  if (r.cost) line.cost = true;
  return line;
}

/**
 * THREAD-2: write the day's overheard exchange as ONE entry.
 *
 * The nightly conversation between two agents at home used to be stored as a
 * run of loose `him` lines, which meant the client could not tell an exchange
 * from two agents happening to talk, and a re-run (a restart inside the same
 * day) appended a second copy of it. It is one thing that happened, so it is
 * one row: the lines ride with it as JSON, and writing another for the same
 * session REPLACES it rather than adding to it, which is what makes "one per
 * owner per day" true of the storage and not only of the caller.
 */
export function putOverheardEntry({ sessionId, agentId, ownerId, ts, who, text, lines, source = 'home' }) {
  const d = conn();
  const sid = String(sessionId);
  let id = null;
  d.transaction(() => {
    d.prepare("DELETE FROM session_thread WHERE session_id = ? AND kind = 'overheard'").run(sid);
    const info = d.prepare(`
      INSERT INTO session_thread (session_id, agent_id, owner_id, table_id, ts, kind, who, text, source, from_id, to_id, lines)
      VALUES (?, ?, ?, NULL, ?, 'overheard', ?, ?, ?, NULL, NULL, ?)
    `).run(sid, String(agentId), String(ownerId),
           Number.isFinite(ts) ? Math.floor(ts) : Date.now(),
           String(who), String(text), String(source),
           JSON.stringify(Array.isArray(lines) ? lines : []));
    id = info.lastInsertRowid;
  })();
  return id;
}

// ── The model meter (METER-1) ────────────────────────────────────────────────
//
// Add-and-forget: one UPSERT per call that sums into the day's row. There is
// no read-modify-write here on purpose — two hands finishing in the same
// millisecond both land, and neither has to hold anything.

export function addModelCall({
  day, ownerId, kind, model,
  calls = 1, inputTokens = 0, outputTokens = 0, cachedInputTokens = 0, usd = 0, unpriced = 0,
} = {}) {
  conn().prepare(`
    INSERT INTO model_calls
      (day, owner_id, kind, model, calls, input_tokens, output_tokens, cached_input_tokens, usd, unpriced, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, owner_id, kind, model) DO UPDATE SET
      calls               = calls               + excluded.calls,
      input_tokens        = input_tokens        + excluded.input_tokens,
      output_tokens       = output_tokens       + excluded.output_tokens,
      cached_input_tokens = cached_input_tokens + excluded.cached_input_tokens,
      usd                 = usd                 + excluded.usd,
      unpriced            = unpriced            + excluded.unpriced,
      updated_at          = excluded.updated_at
  `).run(
    String(day), String(ownerId), String(kind), String(model),
    Math.max(0, Math.floor(calls)),
    Math.max(0, Math.floor(inputTokens)),
    Math.max(0, Math.floor(outputTokens)),
    Math.max(0, Math.floor(cachedInputTokens)),
    Number.isFinite(Number(usd)) ? Number(usd) : 0,
    Math.max(0, Math.floor(unpriced)),
    Date.now(),
  );
}

/**
 * The rolled-up rows, oldest day first. `sinceDay` is an inclusive 'YYYY-MM-DD'
 * bound (string comparison is date order for ISO days, which is the whole
 * reason the key is a string); `ownerId` narrows it to one owner's bill.
 */
export function readModelCalls({ sinceDay = null, ownerId = null } = {}) {
  const where = [];
  const args = [];
  if (sinceDay) { where.push('day >= ?'); args.push(String(sinceDay)); }
  if (ownerId !== null) { where.push('owner_id = ?'); args.push(String(ownerId)); }
  const rows = conn().prepare(`
    SELECT day, owner_id, kind, model, calls, input_tokens, output_tokens,
           cached_input_tokens, usd, unpriced
    FROM model_calls
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY day, owner_id, kind, model
  `).all(...args);
  return rows.map((r) => ({
    day: r.day,
    ownerId: r.owner_id,
    kind: r.kind,
    model: r.model,
    calls: r.calls ?? 0,
    inputTokens: r.input_tokens ?? 0,
    outputTokens: r.output_tokens ?? 0,
    cachedInputTokens: r.cached_input_tokens ?? 0,
    usd: r.usd ?? 0,
    unpriced: r.unpriced ?? 0,
  }));
}

// ── The decision router (COST-1) ─────────────────────────────────────────────
//
// Same add-and-forget shape as the meter above, and for the same reason: this
// is written from inside a hand, once per decision, and nothing about it may
// hold a lock or read before it writes.

export function addDecisionRoute({ day, ownerId, route, reason, decisions = 1 } = {}) {
  conn().prepare(`
    INSERT INTO decision_routes (day, owner_id, route, reason, decisions, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, owner_id, route, reason) DO UPDATE SET
      decisions  = decisions + excluded.decisions,
      updated_at = excluded.updated_at
  `).run(
    String(day), String(ownerId), String(route), String(reason),
    Math.max(0, Math.floor(decisions)),
    Date.now(),
  );
}

/** The rolled-up route rows, oldest day first. Same bounds as readModelCalls. */
export function readDecisionRoutes({ sinceDay = null, ownerId = null } = {}) {
  const where = [];
  const args = [];
  if (sinceDay) { where.push('day >= ?'); args.push(String(sinceDay)); }
  if (ownerId !== null) { where.push('owner_id = ?'); args.push(String(ownerId)); }
  const rows = conn().prepare(`
    SELECT day, owner_id, route, reason, decisions
    FROM decision_routes
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY day, owner_id, route, reason
  `).all(...args);
  return rows.map((r) => ({
    day: r.day,
    ownerId: r.owner_id,
    route: r.route,
    reason: r.reason,
    decisions: r.decisions ?? 0,
  }));
}

// ── GUEST-1 · the guest credential ───────────────────────────────────────────
//
// Six accessors, and none of them knows what a guest is ALLOWED to do — that
// is guest.js's job. This layer answers only "does this token exist", "whose
// is it", "how many has this address made today" and "how many sessions has he
// had today". A limit written twice is a limit that will one day disagree with
// itself, so the rules live in exactly one file and the rows live here.

export function insertGuest({ token, ownerId, ip = null, now = Date.now() }) {
  conn().prepare(`
    INSERT INTO guests (token, owner_id, created_at, last_seen_at, ip, session_count)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(String(token), String(ownerId), now, now, ip === null ? null : String(ip));
  return loadGuestByToken(token);
}

const guestRow = (row) => (row ? {
  token: row.token,
  ownerId: row.owner_id,
  createdAt: row.created_at ?? 0,
  lastSeenAt: row.last_seen_at ?? 0,
  ip: row.ip ?? null,
  claimedBy: row.claimed_by ?? null,
  sessionDay: row.session_day ?? null,
  sessionCount: row.session_count ?? 0,
} : null);

export function loadGuestByToken(token) {
  if (!token) return null;
  return guestRow(conn().prepare('SELECT * FROM guests WHERE token = ?').get(String(token)));
}

export function loadGuestByOwner(ownerId) {
  if (!ownerId) return null;
  return guestRow(conn().prepare('SELECT * FROM guests WHERE owner_id = ?').get(String(ownerId)));
}

/** Guests created from this address since `sinceTs`. The 5-a-day cap's only input. */
export function countGuestsFromIp(ip, sinceTs) {
  if (!ip) return 0;
  const row = conn().prepare('SELECT COUNT(*) AS n FROM guests WHERE ip = ? AND created_at >= ?')
    .get(String(ip), Math.floor(sinceTs));
  return row?.n ?? 0;
}

/** He was here. Cheap enough to call on every resolved request. */
export function touchGuest(token, now = Date.now()) {
  conn().prepare('UPDATE guests SET last_seen_at = ? WHERE token = ?').run(now, String(token));
}

/** The one-session-a-day meter. Returns the count AFTER this session is noted. */
export function noteGuestSession(ownerId, day, now = Date.now()) {
  conn().prepare(`
    UPDATE guests
       SET session_day   = ?,
           session_count = CASE WHEN session_day = ? THEN session_count + 1 ELSE 1 END,
           last_seen_at  = ?
     WHERE owner_id = ?
  `).run(String(day), String(day), now, String(ownerId));
  return loadGuestByOwner(ownerId)?.sessionCount ?? 0;
}

/** Mark the token spent. The row survives so a second claim is a no-op. */
export function markGuestClaimed(token, claimedBy, now = Date.now()) {
  conn().prepare('UPDATE guests SET claimed_by = ?, last_seen_at = ? WHERE token = ?')
    .run(String(claimedBy), now, String(token));
  return loadGuestByToken(token);
}

/** Unclaimed guests last seen before `beforeTs` — the nightly retirement's input. */
export function listStaleGuests(beforeTs) {
  return conn().prepare(`
    SELECT * FROM guests
     WHERE claimed_by IS NULL AND last_seen_at < ?
     ORDER BY last_seen_at
  `).all(Math.floor(beforeTs)).map(guestRow);
}

// ── GUEST-1 · moving an owner's whole life onto another id ───────────────────
//
// The claim. Every table that carries an owner_id is re-pointed in ONE
// transaction, so a claim either happened or it did not — a half-moved owner
// is an agent whose thread belongs to somebody else.
//
// The list below is deliberately the same list `deleteOwner` walks. If a table
// grows an owner_id column and only one of these two learns about it, the
// symptom is a claim that silently loses somebody's hand history; keeping them
// adjacent is the cheapest way to make that hard to miss.
//
// Agents are the one table with a composite key (owner_id, id), so an id
// already on the target would collide. It cannot happen in practice — agent
// ids are minted from randomness — but a claim that throws half way through is
// a worse answer than one that skips, so a colliding id is left where it is
// and named in the result.
//
// THE WALLET IS NOT SUMMED ONTO A TARGET THAT HAS NONE. A brand-new Telegram
// owner has no wallet row until something seeds him one, and taking the
// guest's verbatim is what makes "the money he won as a guest is his" true.
// A target that ALREADY has a wallet gets the guest's balance and lifetime
// earnings added onto his own, which is the only reading that neither
// duplicates a seed nor throws somebody's evening away.
export function moveOwner(fromId, toId) {
  const from = String(fromId);
  const to = String(toId);
  if (!from || !to || from === to) return { moved: false, agents: 0, collided: [], wallet: 'none' };

  const d = conn();
  const out = { moved: false, agents: 0, collided: [], wallet: 'none' };

  d.transaction(() => {
    // Agents first, so a collision is known before anything else has moved.
    const taken = new Set(d.prepare('SELECT id FROM agents WHERE owner_id = ?').all(to).map((r) => r.id));
    for (const row of d.prepare('SELECT id FROM agents WHERE owner_id = ?').all(from)) {
      if (taken.has(row.id)) { out.collided.push(row.id); continue; }
      d.prepare('UPDATE agents SET owner_id = ? WHERE owner_id = ? AND id = ?').run(to, from, row.id);
      out.agents++;
    }

    const guestWallet = d.prepare('SELECT * FROM wallets WHERE owner_id = ?').get(from);
    if (guestWallet) {
      const targetWallet = d.prepare('SELECT * FROM wallets WHERE owner_id = ?').get(to);
      if (!targetWallet) {
        d.prepare('UPDATE wallets SET owner_id = ? WHERE owner_id = ?').run(to, from);
        out.wallet = 'moved';
      } else {
        const fridge = { ...jsonParse(targetWallet.fridge, {}) };
        for (const [k, v] of Object.entries(jsonParse(guestWallet.fridge, {}))) {
          fridge[k] = (Number(fridge[k]) || 0) + (Number(v) || 0);
        }
        d.prepare('UPDATE wallets SET balance = ?, earned = ?, fridge = ?, updated_at = ? WHERE owner_id = ?').run(
          (targetWallet.balance ?? 0) + (guestWallet.balance ?? 0),
          (targetWallet.earned ?? 0) + (guestWallet.earned ?? 0),
          JSON.stringify(fridge),
          Date.now(),
          to,
        );
        d.prepare('DELETE FROM wallets WHERE owner_id = ?').run(from);
        out.wallet = 'merged';
      }
    }

    // A straight re-point: nothing here has a key that can clash.
    for (const table of ['session_thread', 'notifications', 'hands']) {
      d.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`).run(to, from);
    }
    // These two are keyed on owner_id alone. An existing target keeps his own
    // row and the guest's is dropped: the agents are what a claim is about, and
    // the draft transcript that produced them is already inside the agent
    // record.
    for (const table of ['notification_state', 'profiles']) {
      const exists = d.prepare(`SELECT 1 FROM ${table} WHERE owner_id = ?`).get(to);
      if (exists) d.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).run(from);
      else d.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`).run(to, from);
    }
    // The two meters have composite keys that include owner_id, so a row for
    // the same (day, kind, model) on both sides would collide. A guest's spend
    // is small and the honest thing is to keep it, so a clash is summed and
    // everything else re-pointed.
    mergeMeter(d, 'model_calls', ['day', 'kind', 'model'],
      ['calls', 'input_tokens', 'output_tokens', 'cached_input_tokens', 'usd', 'unpriced'], from, to);
    mergeMeter(d, 'decision_routes', ['day', 'route', 'reason'], ['decisions'], from, to);

    out.moved = true;
  })();

  return out;
}

// Sum-or-move for a table whose primary key includes owner_id.
function mergeMeter(d, table, keyCols, sumCols, from, to) {
  const where = keyCols.map((c) => `${c} = ?`).join(' AND ');
  for (const row of d.prepare(`SELECT * FROM ${table} WHERE owner_id = ?`).all(from)) {
    const keys = keyCols.map((c) => row[c]);
    const clash = d.prepare(`SELECT 1 FROM ${table} WHERE owner_id = ? AND ${where}`).get(to, ...keys);
    if (!clash) {
      d.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ? AND ${where}`).run(to, from, ...keys);
      continue;
    }
    const sets = sumCols.map((c) => `${c} = ${c} + ?`).join(', ');
    d.prepare(`UPDATE ${table} SET ${sets}, updated_at = ? WHERE owner_id = ? AND ${where}`)
      .run(...sumCols.map((c) => row[c] ?? 0), Date.now(), to, ...keys);
    d.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND ${where}`).run(from, ...keys);
  }
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

// Removes every trace of ONE owner, by exact id. Used by the e2e verify
// scripts to reset their own fixtures at startup.
//
// Under `npm run test:e2e` this is redundant — runScript gives each script a
// scratch cwd, so it opens an empty database and throws it away afterwards.
// It matters for a script run BY HAND from the repo root, which resolves
// data/app.db like the real server does and therefore leaves its agents behind.
// Four of those runs and the fifth build comes back agentCap or slotLocked, and
// the suite fails on the leftovers of the last run rather than on its subject.
//
// Exact id, never a prefix or a pattern: a wildcard delete living in the store
// is one typo away from being pointed at real owners, and the caller always
// knows the ids it made up. `verify-chips.js` is the reason data/ is not
// disposable — that is somebody's actual bankroll ledger on a laptop.
export function deleteOwner(ownerId) {
  const id = String(ownerId);
  const d = conn();
  const purge = d.transaction(() => {
    d.prepare('DELETE FROM session_thread     WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM notifications      WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM notification_state WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM hands              WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM wallets            WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM agents             WHERE owner_id = ?').run(id);
    d.prepare('DELETE FROM profiles           WHERE owner_id = ?').run(id);
  });
  purge();
  return id;
}

// Opens (and therefore migrates) eagerly. index.js calls this at boot so the
// migration log lands at startup rather than on the first hand, and so a failed
// import stops the server instead of surfacing mid-session.
export function openStore() {
  conn();
  return dbPath();
}

export { dbPath as _dbPath };
