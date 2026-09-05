# Data Migration — Untracking Live Data (PLT-1)

## Background

`data/agents.json` was tracked in git while the server wrote it constantly.
Every `git pull` on the VPS failed on local modifications, silently blocking
deploys for months. This commit untracks the file: `.gitignore` now ignores
all of `data/` except `data/arena/` (arena run records are results, not user
data, and must stay versioned).

## WARNING: READ BEFORE PULLING THIS COMMIT ON THE VPS

**WARNING: WHEN THE VPS PULLS THE COMMIT THAT UNTRACKS `agents.json`, GIT
WILL DELETE THE WORKING COPY OF `data/agents.json`.**

This is expected git behaviour when a file is removed from the index — git
removes it from the working tree on the next pull if the local file matches
the last tracked revision. If it has been modified (it will have been — the
server writes it constantly), git may leave it in place, but do not rely on
this. Always run the backup step below.

## One-Time VPS Migration Steps

Run these commands in order on the VPS **before** the pull that ships PLT-1:

```bash
# 1. Back up live data BEFORE pulling
cp data/agents.json /root/agents-prod-backup.json

# 2. Pull the commit that untracks the file
git pull

# 3. Restore live data (git may have deleted it)
cp /root/agents-prod-backup.json data/agents.json

# 4. Restart the server
pm2 restart all --update-env
```

After this one deploy, `data/agents.json` is untracked forever. The backup
dance is never needed again — `git pull` will no longer touch the file.

## What Stays Tracked

- `data/arena/` — arena run records (results, not user data). Tracked intentionally.

## What Is Now Ignored

- `data/agents.json` — live prod user data.
- Any `data/hands-*.json` files — hand history, also live data.
- All other files under `data/` that are not under `data/arena/`.

---

# JSON → SQLite (SQLITE-1)

Design: `docs/SQLITE_DESIGN.md`. From this deploy on, persistence lives in
`data/app.db` instead of `data/agents.json`, `data/hands-*.json`,
`data/opponents.json` and `data/notifications.json`.

## What happens on the first boot after the pull

The server opens `data/app.db`, creates the schema, imports whichever of those
JSON files it finds, and **renames** each one to `<name>.migrated`. Files are
never deleted. It logs one line per file:

```
[store] migrated data/agents.json — 8 owner(s), 3 agent(s) → data/app.db
[store] migrated 5 hands-*.json file(s) — 52 hand(s) → data/app.db
```

The import is idempotent: a `meta` stamp inside the database plus the rename
mean a second boot imports nothing. If a file cannot be read, its transaction
rolls back, the file is left in place, and the server does not pretend it
imported it.

## One-Time VPS Migration Steps

Run these in order on the VPS. Steps 1–2 are the safety net; do not skip them
even though `git pull` no longer touches `data/`.

```bash
# 1. Back up live data BEFORE pulling
cd /opt/aipokers
cp data/agents.json /root/agents-prod-backup-$(date +%F).json
cp -r data /root/data-prod-backup-$(date +%F)

# 2. Record the agent count you expect to see afterwards
node -e "const s=require('./data/agents.json');console.log('agents:',Object.values(s).reduce((n,p)=>n+(p.agents||[]).length,0))"

# 3. Pull and install (better-sqlite3 is a new dependency)
git pull
npm ci --omit=dev

# 4. Restart. The migration runs on boot — watch it happen.
pm2 restart all
pm2 logs --lines 40 | grep '\[store\]'

# 5. Confirm the database appeared and the JSON was retired, not deleted
ls -la data/app.db data/agents.json.migrated

# 6. Confirm the agent count matches what step 2 printed
npm run test:data          # ledger check, now reading data/app.db
curl -s localhost:8765/api/stats

# 7. Confirm the app still serves
curl -s -o /dev/null -w '%{http_code}\n' localhost:8765/api/stats     # expect 200
```

`totalAgents` from `/api/stats` in step 6 must equal the number step 2 printed.
If it does not, stop and roll back — do not let users write into a store that
lost records.

## Rollback

Two parachutes, in order of preference.

**A — export the current state back to JSON** (keeps everything that happened
since the cutover):

```bash
cd /opt/aipokers
npm run export:json        # data/app.db → data/agents.json, hands-*.json, …
git revert <the SQLITE-1 merge commit>
pm2 restart all
```

**B — the retired files** (loses anything written after the cutover, so only
if A fails):

```bash
cd /opt/aipokers
mv data/agents.json.migrated data/agents.json
for f in data/hands-*.json.migrated; do mv "$f" "${f%.migrated}"; done
git revert <the SQLITE-1 merge commit>
pm2 restart all
```

Either way, move `data/app.db` aside rather than deleting it — it is the only
copy of anything written after the cutover.

## Backups from now on

`data/app.db` replaces `data/agents.json` as the file that matters. WAL mode
means `app.db-wal` and `app.db-shm` sit next to it; copy all three, or stop the
server first:

```bash
cp data/app.db data/app.db-wal data/app.db-shm /root/backup/
```

## What Is Now Ignored

`.gitignore` already ignores everything under `data/` except `data/arena/`, so
`app.db`, `app.db-wal`, `app.db-shm` and the `*.migrated` files need no new
entries — verified, not assumed.
