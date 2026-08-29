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
