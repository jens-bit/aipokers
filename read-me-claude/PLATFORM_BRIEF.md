# Platform Brief — Fredrik

Owner: Fredrik. Domain: platform + server correctness (see CLAUDE.md team section).
Read first: CLAUDE.md → CORE_GAME_PLAN.md → HOW_WE_WORK.md → BUGS.md.
All work lands via PR to main. Coordinate before touching files outside this brief —
src/agent/*, src/engine/*, src/server/table.js and handler-adjacent code are owned by
in-flight skill-engine trees (Trees 1–3) right now.

## PR 1 — Get live data out of git (small, do first)
Problem: data/agents.json is live prod user data AND tracked in git. The server writes
it constantly, so every VPS `git pull` fails on local modifications — this silently
blocked deploys for 3+ months (prod ran May 9 code until 2026-08-29).
- .gitignore the data/ directory (keep data/arena/ results tracked OR move arena output
  to a tracked results/ dir — your call, state it in the PR).
- `git rm --cached` the tracked data files so history keeps them but the working tree
  stops tracking.
- Write the one-time VPS migration steps into the PR description (prod data must
  survive: it lives at /opt/aipokers/data/, back it up before the deploy that ships this).

## PR 2 — Deploy automation
Problem: deploy is manual SSH and failed silently for months.
- Simplest thing that works: GitHub Action on push-to-main that SSHes to the VPS
  (46.62.169.246, path /opt/aipokers — with the 's'), pulls, restarts pm2, and FAILS
  LOUDLY if the pull or restart errors. Secrets via GitHub Actions secrets.
- Bonus: post-deploy health check — curl the /api/stats endpoint and the auth check
  (POST /api/agents/chat with empty body must return 401, not 400).

## PR 3 — Data layer: JSON → SQLite (design first, then build)
agents.json is rewritten wholesale on every save; hands-*.json likewise. Before real
users, move persistence to SQLite (single file, no server dependency — fits the VPS).
Keep the exported function signatures in agentProfiles.js/handHistory.js stable so the
skill-engine trees don't conflict. Post a short design note in the PR before building.
NOTE: agentProfiles.js is touched by in-flight Tree 2/3 — coordinate timing with Jens
before starting this one; PRs 1–2 have zero overlap and can start immediately.

## After Trees 1–3 merge — server-authoritative correctness backlog
1. Server-side action timer (15s currently enforced ONLY by the client — a stalled
   client stalls the table forever). Server owns the clock, auto-folds, broadcasts.
2. Reconnect / sit-out: today a disconnect frees the seat and kills the hand.
3. Seat lifecycle: joining an existing table mid-session does not enter the game
   (Game is built once and never reconciled with new pending seats).
4. BUG-12 (see BUGS.md): DECISION broadcast leaks AI reasoning + equity to opponents —
   route to owner/spectators only. Touches table.js, so post-merge only.
