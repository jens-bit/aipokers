# Platform Brief — Fredrik
Updated: 2026-08-29 late night. Owner: Fredrik. Domain: platform + server correctness.
Read first: CLAUDE.md → CORE_GAME_PLAN.md (EOD status section at the bottom is the
current truth) → HOW_WE_WORK.md → BUGS.md. All work lands via PR to main.
Heads up: push-to-main AUTO-DEPLOYS to the VPS now (GitHub Action, health-checked).

## Where we are (so you can skip the archaeology)
The skill engine (Trees 0–3), the personality layer (Tree 3.5: moods, pep talks,
recaps, SIT_OUT), and the casino-floor mobile HOME are all merged and live on prod.
Old PR 1 (data/ out of git) and PR 2 (deploy automation + health checks) from the
previous version of this brief are DONE — shipped 2026-08-29 as chore/platform-1 and
.github/workflows/deploy.yml. Jens's next tree (Tree 4) makes agents play server-side
without a viewer and streams live floor state; it touches src/server/table.js and the
WS protocol, so coordinate before working in those files.

## PR A — Telegram Login Widget for the web app (new, high value)
Problem: auth is Telegram-mini-app initData HMAC only, so desktop browsers can't sign
in at all (the client now fails politely, FLR-10, but can't play). Add the Telegram
Login Widget flow: "Log in with Telegram" on the web build → Telegram returns a signed
payload → server verifies (same bot-token HMAC family as auth.js does for initData;
widget uses SHA256(bot_token) as key — see Telegram docs) → issue our session. Keep
auth.js's existing initData path untouched; this is an additional door, same identity.
Client: show the widget when not inside Telegram. This unblocks desktop play and the
upcoming desktop Command Center UI.

## PR B — Data layer: JSON → SQLite (design first, then build)
Unchanged from before: agents.json / hands-*.json rewritten wholesale on every save.
Move persistence to SQLite (single file, fits the VPS). Keep exported function
signatures in agentProfiles.js / handHistory.js stable. Post a short design note in
the PR before building. Tree 4 will be writing through agentProfiles.js — coordinate
timing with Jens.

## PR C — npm audit sweep (small)
Client `npm install` reports vulnerabilities (ws → express → vite 6 → nanoid chain).
Assess, patch/pin, keep the build green.

## Hygiene (with Jens, interactive SSH session — not PRs)
1. Regenerate the VPS deploy key; update the VPS_SSH_KEY GitHub secret; prune old
   entries from authorized_keys on the VPS.
2. Rotate the Anthropic API key (it was pasted into chats/terminals during setup):
   console.anthropic.com → new key → update VPS ~/.bashrc export → in an INTERACTIVE
   shell: pm2 restart all --update-env. (Never use --update-env from the deploy
   action / non-interactive SSH — it wipes the env; the workflow comment explains.)
3. The Telegram bot token was also pasted in chat — rotate via BotFather when
   convenient; update VPS env the same way.

## Server-authoritative correctness backlog (post-Tree-4, coordinate)
1. Server-side action timer (15s enforced only by the client today; a stalled client
   stalls the table). Server owns the clock, auto-folds, broadcasts.
2. Reconnect: a disconnect frees the seat and kills the hand.
3. Seat lifecycle: joining an existing table mid-session never enters the game.
4. BUG-16/17 (BUGS.md) are Tree 4's headline — read them to understand why watching
   currently drives the game loop; your timer work should assume the server loop exists.
