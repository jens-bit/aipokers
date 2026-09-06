# SQLite Design Note — SQLITE-1

Owner: platform (PR B in `read-me-claude/PLATFORM_BRIEF.md`).
Status: design, agreed before code. Read this before reviewing SQLITE-1b/1c.

## Why

`data/agents.json` is rewritten wholesale on every save — `saveStore()` serialises
every owner, every agent, every ledger entry and every flagged hand on each hand
result. `data/hands-<userId>.json`, `data/opponents.json` and
`data/notifications.json` do the same. That is a full-file rewrite per hand, a
torn-write window on every one of them, and no way to query anything without
loading the whole store into memory.

SQLite fixes all three: one file on the VPS, real write transactions, and
indexed reads. No server to run, no ORM, no schema-migration framework.

## Dependency

One new dependency: **better-sqlite3**.

- Its API is *synchronous*, which is the whole point: every persistence path in
  this codebase is synchronous today (`fs.writeFileSync` inside `saveStore`,
  `appendHand`, `recordHand`). A synchronous driver is a drop-in at those seams.
  An async driver (`node:sqlite` callbacks, `sqlite3`) would force `await` up
  through `recordHandResult` → `finishAgentSession` → `table.js`, which is a
  protocol-level change to code another branch is editing.
- Single file on disk fits the VPS: no daemon, no port, no credentials, and the
  existing `data/` backup story still works (`cp data/app.db /root/...`).

Risk to know about: better-sqlite3 is a native module. `npm ci` pulls a prebuilt
binary for Node 20 (CI) and Node 22/24 (laptops, VPS). If a prebuild is ever
missing, the install falls back to `node-gyp` and the machine needs build tools.
Checked against our two targets before merging.

## Tables

Schema lives in `src/server/store.js` and is applied with `CREATE TABLE IF NOT
EXISTS` on open. `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL` —
WAL so a reader never blocks the writer, NORMAL because losing the last few
milliseconds of play-money state on a power cut is acceptable and `FULL` costs
an fsync per commit.

### `profiles`
The per-owner wrapper the current store keys by `userId`.

| column | type | note |
|---|---|---|
| `owner_id` | TEXT PRIMARY KEY | `userId`, or `'anon'` |
| `chat` | TEXT | the creation-chat array, JSON |
| `updated_at` | INTEGER | ms epoch |

### `agents`
One row per agent. The record stays JSON — the agent object is a deep,
fast-moving shape (mood, attributes, ledger, recentHands, sessionFlagged) that
three branches are actively changing, and normalising it would turn every
product change into a schema migration. Columns are lifted out **only where a
query actually reads them**:

| column | type | why it is a column |
|---|---|---|
| `owner_id` | TEXT | PK part; every read is "this owner's agents" |
| `id` | TEXT | PK part; `agents.find(a => a.id === agentId)` |
| `name` | TEXT | listing order / display |
| `status` | TEXT | `reconcileActiveSessions()` scans for `'playing'` |
| `active_table_id` | TEXT | same scan, and the stale-table check |
| `created_at` | INTEGER | stable list order (JSON array order today) |
| `updated_at` | INTEGER | ms epoch |
| `data` | TEXT | the full agent record, JSON |

PRIMARY KEY `(owner_id, id)`. Index on `status` for the reconcile scan.

`data` is the source of truth for the lifted fields; they are written from it on
every save, never read back into it. One writer, no drift.

### `hands`
Replaces `data/hands-<userId>.json`. Newest-first, capped at 50 per owner
(`MAX_HANDS`, unchanged).

| column | type |
|---|---|
| `seq` | INTEGER PRIMARY KEY AUTOINCREMENT |
| `owner_id` | TEXT |
| `created_at` | INTEGER |
| `data` | TEXT (JSON) |

Index `(owner_id, seq DESC)`. `readHands` orders by `seq DESC`, which reproduces
the old `hands.unshift()` ordering exactly. The cap is enforced on insert with a
`DELETE ... WHERE seq NOT IN (SELECT seq ... LIMIT 50)` in the same transaction,
replacing the old `slice(0, MAX_HANDS)`.

### `opponent_stats`
Replaces `data/opponents.json`. The ring buffer stays JSON — it is read whole
(`getRead` folds all 50 entries) and never queried by field.

| column | type |
|---|---|
| `player_id` | TEXT PRIMARY KEY |
| `display_name` | TEXT |
| `hands` | TEXT (JSON ring, ≤ 50) |
| `updated_at` | INTEGER |

The module keeps its in-memory `store` and its 2s save throttle exactly as they
are; only the write target changes. `setPersistEnabled(false)` (what the arena
uses so runs don't pollute prod state) keeps working unchanged — it short-circuits
before the store is touched, so an arena run never opens the database at all.

### `notification_state`
Replaces `data/notifications.json`.

| column | type |
|---|---|
| `owner_id` | TEXT PRIMARY KEY |
| `data` | TEXT (JSON) |
| `updated_at` | INTEGER |

### `meta`
`(key TEXT PRIMARY KEY, value TEXT)`. Holds `schema_version` and the migration
stamps (`migrated_agents_at`, …). This is what makes the import idempotent.

### Deliberately NOT a table: `flagged`

The brief lists a `flagged` table. I am **not** building one in SQLITE-1, and
this is the one place this note diverges from the brief — flagging it here
rather than in a commit message so it can be overruled cheaply.

Two reasons:

1. `agent.sessionFlagged` is session-scoped, capped at 10, and is only ever read
   *through* its agent (`presentAgent`, `floorSnapshot`, the hand-review sheet).
   Nothing queries flagged hands across agents or across owners. A separate
   table buys no query we make and adds a recompose step to every agent load.
2. `feature/attributes-3` is editing `agentProfiles.js` right now, and this task
   confines me to the load/save seams. Splitting `sessionFlagged` out means
   touching `addFlaggedHand`, `presentAgent` and `floorSnapshot` — exactly the
   non-seam code I have been told to leave alone.

It stays inside the agent `data` JSON. If we later want cross-agent flagged-hand
queries (a "best hands on the platform" feed would want them), the table shape is
`(seq, owner_id, agent_id, flag_type, hand_number, pot, created_at, data)` and the
migration is a one-pass decompose out of `agents.data` — cheap to do later,
because the JSON already holds everything the table would need.

## Migration

First boot only, inside a single transaction, in `src/server/store.js`:

1. Open/create `data/app.db` and apply the schema.
2. If `meta.migrated_agents_at` is **unset** and `data/agents.json` **exists**:
   import every owner → `profiles`, every agent → `agents`.
3. Same check for `data/hands-*.json` → `hands`, `data/opponents.json` →
   `opponent_stats`, `data/notifications.json` → `notification_state`.
4. Stamp `meta` and **rename** each imported file to `<name>.migrated`.
   **Never delete.** `data/agents.json` → `data/agents.json.migrated`.
5. Log one line per imported file with the row count.

Idempotence is belt *and* braces: the `meta` stamp short-circuits step 2, and
the rename means the source file is no longer there to import a second time. A
second boot logs nothing and imports nothing. A boot with no JSON at all (fresh
VPS, CI, a scratch test cwd) creates an empty database and moves on.

If the import throws, the transaction rolls back and the rename never happens —
the JSON is still the source of truth and the server refuses to start rather
than running on a half-imported store.

## Rollback

`npm run export:json` (`scripts/export-json.js`) walks the database and writes
`data/agents.json`, `data/hands-<owner>.json`, `data/opponents.json` and
`data/notifications.json` in exactly the shapes the pre-SQLite code read. It
never touches the database.

Rolling back on the VPS is then:

```bash
cd /opt/aipokers
node scripts/export-json.js     # current state → JSON
git revert <sqlite merge>       # or: git checkout <last good sha>
pm2 restart all
```

The `.migrated` files are the second parachute: they are the exact bytes the
server was reading before the cutover, still on disk, untouched.

## Test cwd isolation

`src/test/helpers/runScript.js` spawns every suite in a fresh scratch cwd, and
that is what stops the E2E suites writing into the developer's real `data/`.
Every persistence path in `src/server` resolves from `process.cwd()` today, so
the store must do the same or it would punch straight through that isolation and
write test agents into the repo's database.

Two rules:

1. `dbPath()` resolves `path.join(process.cwd(), 'data', 'app.db')` — same as
   `agentProfiles.js` does for `agents.json` today.
2. The connection is opened **lazily, on first use**, not at module load, and
   the resolved cwd is remembered with it. Module load is not the right moment:
   a suite that imports the store but never persists should not create a
   database, and opening a native handle in every spawned process that merely
   imports `table.js` is pure cost.

A spawned suite therefore gets a fresh empty `app.db` under its own scratch dir,
finds no `agents.json` next to it, runs no migration, and starts from clean state
— which is exactly what those suites assume today.

`store.js` also exports `_closeForTests()` / `_resetForTests()` so a test can
drop the handle and re-open against a different cwd within one process. That is
how `store.test.js` exercises the migration and the idempotent second boot
without spawning.

## Files

- `src/server/store.js` — connection, schema, migration, typed accessors. New.
- `src/server/store.test.js` — round-trip, migration from a fixture, idempotent
  second boot, cwd isolation. New.
- `src/server/agentProfiles.js` — `saveStore` / initial load only. Seams only:
  `feature/attributes-3` owns the rest of this file right now.
- `src/server/handHistory.js` — both functions, same signatures.
- `src/server/opponentStats.js` — load + `scheduleSave` write target only.
- `src/server/notifications/telegram.js` — load + `saveNotifState` only.
  (NOTIFY-2 has since folded this module into `src/server/notify.js`; the
  `notification_state` table it owned is no longer written, and is kept only
  for the `export-json.js` rollback path.)
- `scripts/export-json.js` — rollback path. New.
- `scripts/verify-chips.js` — reads the store instead of `agents.json`.
- `.gitignore` — `data/*` already covers `app.db`, `-wal` and `-shm`; asserted,
  not re-added.

## Signatures

Every exported function in `agentProfiles.js`, `handHistory.js`,
`flaggedHands.js`, `opponentStats.js` and `notifications/telegram.js` keeps its
current name, arity and return shape. The diff to those files is the read/write
seams and nothing else. If that turns out to be impossible anywhere, it goes in
the PR report rather than being quietly changed.
