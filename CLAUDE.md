# CLAUDE.md — Agentic Poker

Read this first in every session. It is the map; the deeper docs are the territory.

## What this is
Telegram Mini App for No-Limit Texas Hold'em where users create AI agents (Claude-powered) via chat and deploy them to play. **Identity: a GAME first** — "a Tamagotchi that plays poker": agents are companions with personalities, moods, and their own poker skill. Play money. Real money is a maybe-later, not the foundation.

## Read next, in order
Telegram resize follow-up (20 September):
`read-me-claude/PLAYTEST_TELEGRAM_VIEWPORT_2026-09-20.md`.
BUG-287 is a separately reproduced offscreen Safe footer when browser height
shrinks before the SDK height event. Work uses `codex/telegram-viewport-recovery`.

Release gate follow-up (20 September): `read-me-claude/RELEASE_SAFE_PROXY_2026-09-20.md`.
PR #11 repaired the native browser-proxy teardown failure. Main `554e2f5`
deployed on 20 September at 14:46 UTC after the full gate; public asset hashes,
health/auth and fresh phone/desktop checks passed. PR #10's fixes are live.

Latest follow-up (20 September): `read-me-claude/PLAYTEST_ALLIN_SAFE_2026-09-20.md`.
PR #10 supplies literal every-hand all-in execution and the confirmed desktop
Safe funding collapse (deployed through PR #11);
the supplied phone collapse remains unconfirmed on a freshly loaded build.

Latest founder corrections (20 September): `read-me-claude/PLAYTEST_2026-09-20.md`.
PR #9 passed its local and GitHub gates, merged as `b20d21d`, and deployed on
20 September. Public health and fresh browser checks confirmed the release.
Birth colours are permanent; Wardrobe is removable starter items. Pocket
collection never retrieves bought-in chips. Food is eaten visibly while Home
is watched, with no offline stock drain.

Current character-menu entry point (20 September):
`read-me-claude/CHARACTER_MENU_RELEASE.md`. Jens asked to implement the preview
and push pending work; PR8's recovery was already live. Character-menu work uses
`codex/character-menu` and the normal PR, full-gate and deployment workflow.

Current recovery entry point (19 September):
`read-me-claude/RAILBIRD_DOCUMENT_RECOVERY.md`, then its linked recovery reports.
For this recovery Jens explicitly chose design ownership and a review branch;
historical main/port-only handoffs do not override that choice.

1. `CORE_GAME_PLAN.md` — current state, the active build plan (skill engine, personality layer, mood economy), tree-by-tree with megaprompts. **This is where we are.**
2. Highest-version `agentic-poker-master-spec-*.docx` — full product vision (v15 as of 2026-09-10). Read `read-me-claude/DESIGN_GAP.md` and `read-me-claude/ASTRA_REPAIR.md` for current founder overrides and verified repair status.
3. `read-me-claude/HOW_WE_WORK.md` — workflow: worktrees, terminal discipline, merge rules, deploy.
4. `BUGS.md` — known bugs. Verify against code; entries go stale.

## Commands
- Run locally: `npm start` (builds client + serves on :8765). Dev client hot-reload: `npm run dev` in client/.
- Tests: `npm test` (server) + `npm run test:client` MUST pass before any commit. `npm run test:all` runs server, client AND e2e. `npm run test:e2e` (~100s) MUST pass before any merge to main. See **Testing law** below.
- Smoke: `npm run smoke` (one hand, no browser). `npm run smoke:browser` is CI-2's browser smoke — start the app first (`npm start`), then it walks HOME/CASINO/YOU/WATCH at 390×844 and 1440×900 in chromium and drops a screenshot per screen in `smoke-shots/`.
- Deploy: a push to main runs the gates and VPS workflow in `.github/workflows/deploy.yml`. The workflow uses `pm2 restart all` without `--update-env`, since noninteractive SSH lacks the runtime environment. Current persistence is SQLite `data/app.db` with WAL; the old JSON checkout/copy recipe is obsolete. Jens authorized the recovery's production release on 19 September through [PR #8](https://github.com/jens-bit/aipokers/pull/8); check its main-push workflow for deployment status.

## Architecture map
- `src/engine/` — pure NLHE engine (game.js is correct and tested: side pots, min-raise, HU blind reversal). Change with extreme care.
- `src/server/table.js` — table orchestration, AI turn loop, chat triggers.
- `src/server/wsServer.js` — WebSocket protocol (JOIN/WATCH/ACTION/CHAT). Protocol is public (llms.txt) — keep it stable.
- `src/server/agentProfiles.js` — agent CRUD, creation chat, stats, memory. Auth in `auth.js` (Telegram initData), rate limiting in `rateLimit.js`.
- `src/agent/handler.js` — the LLM decision call (claude-haiku, prompt caching) + trash-talk generation.
- `client/src/` — React/Vite Mini App. `design-refs/` at root = design source of truth (Codex built the May-era refs; Claude Design owns the mood/mobile wave from Aug 2026 — one design source per wave, all output lands in design-refs/): **PORT from it, never redesign, never modify it.**
- `data/` — SQLite persistence (`app.db`, WAL). On the VPS this is LIVE USER DATA. Legacy JSON imports remain supported; do not treat the former JSON files as the current database.

## Team + ownership (update as it changes)
- **Jens** (founder, non-dev, orchestrates Claude Code terminals + Cowork): product core — skill engine trees (equity, policy compiler, opponent model), personality/mood layer, UI ports, spec.
- **Fredrik** (engineer, joined Aug 2026): platform — data-out-of-git + SQLite migration, deploy automation, then server-authoritative correctness (server-side action timer, reconnect/sit-out, seat lifecycle). Also reviews PRs.
- Merges go through GitHub PRs to main. Nobody force-pushes main. One branch per tree; worktree discipline per HOW_WE_WORK.

## Testing law
Non-negotiable. A test suite only protects you if it is trusted, and it is only trusted if nobody is allowed to weaken it.

1. **Before every commit: `npm test` and `npm run test:client`.** (`npm run test:all` additionally runs e2e.)
2. **Before every merge to main: `npm run test:e2e`.** ~100s, up from ~40s at COST-1: the decision router means the keyless suites now PLAY the hands out through the compiled policy instead of check/folding every spot, so the same scripts cover about three times the poker. The five suites that boot the stack and play hands to completion. CI runs all three commands on every push and PR (`.github/workflows/deploy.yml`) and the deploy job does not start until they are green — but do not make CI find it for you.
3. **Every bug fix ships with a test named after its BUG id.** Write it first, watch it fail, then fix. `it('BUG-17: WATCH makes no POST', …)`. A fix with no failing-then-passing test is not a fix, it is a hope.
4. **Every new module ships with a test file next to it.** `src/server/foo.js` → `src/server/foo.test.js`. `client/src/components/Foo.jsx` → `client/src/components/Foo.test.jsx`.
5. **Never delete or weaken a test to make it pass.** If a test is red, either the product is wrong (fix the product) or the test encodes a rule we no longer want (say so explicitly in the commit message, with the reasoning). Loosening an assertion to get to green is the one thing that is never allowed.
6. **A test that exposes a real bug stays.** Mark it `it.todo(...)` with the BUG id in the name, file the bug in BUGS.md, and un-todo it when the fix lands. Do not delete it and do not fix the product mid-task to make it green.

How it is wired:
- Discovery, not lists. `src/test/legacy.test.js` spawns every `src/**/*.test.js`; `src/test/verifyScripts.test.js` and `src/test/e2e.test.js` split every `scripts/verify-*.js` between the fast and slow commands. Adding a test file is enough to have it run — nothing to register. A new verify script lands in the fast group by default; move it by naming it in `src/test/helpers/verifyGroups.js`, with a reason.
- Each spawned suite runs in a scratch cwd, so nothing writes to `data/`.
- **CI-2: the browser smoke is its own CI job and deploy waits on it too.** `scripts/smoke.spec.js` boots the built client behind the real server (scratch cwd, no keys) and loads it in chromium at both widths, failing on any console error. It is the only thing in the repo that ever loads `client/dist` — everything else asserts against jsdom or the server — so a screen that only breaks once Vite has minified it has nowhere left to hide. Screenshots upload as the `smoke-screenshots` artifact; they are not a pixel baseline, they are there to be looked at when a run goes red.
- **No live model calls in any automated suite.** The runner strips `ANTHROPIC_API_KEY` from every child's environment and each e2e script re-checks it at startup. With a key the agents play real hands, hands differ every run, and `verify-multi-seat.js` failed intermittently depending on whose shell had the key exported (TEST-2). A flaky test is worse than no test: it teaches people to re-run instead of to look.
- Server style: node:test + `node:assert/strict`. Client style: Vitest + Testing Library, files named `*.test.jsx`, assertions on what the user sees.
- `npm run test:live` is the only thing that talks to a real model, and nothing runs it automatically. `npm run test:data` checks the local `data/agents.json` ledger and is likewise not in CI.

## Hard rules
- design-refs/ is read-only. Port, don't reinvent.
- Engine invariants: all tests in game.test.js pass, chip conservation holds, no protocol-breaking changes to WS messages.
- No new npm dependencies without a stated reason in the PR/commit.
- Never commit secrets. Env lives in .bashrc on the VPS: `TELEGRAM_BOT_TOKEN` (secret — also the switch that turns `isOwner()` from "always true" into a real check), `ANTHROPIC_API_KEY` (secret), `TELEGRAM_BOT_USERNAME` (public, served by GET /api/auth/config so the web Login Widget can render; empty means web login is off on that deployment), `LOGIN_MAX_AGE_S` (optional, how long a web login stays valid — default 30 days), `PUBLIC_BASE_URL` (SHARE-2, where Telegram fetches a share card's PNG from — default `https://agenticpoker.app`; wrong here means every shared card is a broken image), `SHARE_INLINE` (SHARE-2, set to `0` to stop the bot long-polling for inline queries), `TICKER_ENABLED` + `TICKER_CHANNEL_ID` (EVENTS-3, the public Telegram channel the event bus feeds — off unless both are set; the channel id is the chat the bot posts into, `@name` or a numeric `-100…`), `ADMIN_KEY` (secret — METER-1 and ADMIN-1, the only credential for `GET /api/admin/meter` and for the owner's dashboard at `GET /admin` plus its three JSON routes; unset means all of them 404. The meter takes it as `?key=`; the dashboard takes it only in an `x-admin-key` header — a key in a URL lands in every access log there is). COST-1 adds two optional dials, neither set on the VPS: `DECISION_ROUTER` (set to `off` to send every AI decision to the model again — the pre-COST-1 behaviour, and the way back from a bad routing call without a deploy; it does NOT switch the kitchen table's no-model rule off with it) and `UNWATCHED_HAND_PAUSE_MS` (default 25000 — how slowly a casino table nobody is watching deals; an explicit `HAND_PAUSE_MS` always wins, which is what keeps the e2e scripts fast). COST-2 adds `UNWATCHED_POLICY` (default on; set to `0` to stop routing a table nobody has watched for 60s straight to the compiled policy — the two exceptions, a stack in the middle and a big pot, still reach the model either way; see router.js). GUEST-1 adds `GUEST_ENABLED` (set to `1` to open the no-account door — off by default and not set on the VPS; unset, the guest routes 404, no cookie is read and the app is exactly what it was, which is the way back without a deploy). See the Env section in HOW_WE_WORK for what to check before flipping it. MONEY-2 adds two more optional dials, neither set on the VPS: `RAKE_PERCENT` (default 1 — the percentage of each pot the house takes at CASINO tables, never at a home game; `0` switches the rake off entirely and is the way back without a deploy) and `RAKE_CAP_BB` (default 3 — the ceiling on that cut, in big blinds, so it scales with the room: 60 chips on the floor, 300 in the back room). Both are read per call, so a restart is all it takes. `scripts/simulate-economy.js --sweep` is what chose the pair and read-me-claude/MONEY_AUDIT.md section 18 is the measurement — do not move either number without re-running it.
- SHARE-2 needs inline mode switched on for the bot in BotFather (`/setinline`) before route 3 can be reached at all, and only one process may poll `getUpdates` per bot token — a second one takes the updates from the first.
- Windows contributors: never use PowerShell `>` redirect into source files (UTF-16 corruption); git autocrlf=input; watch for CRLF "everything modified" ghosts.
- LLM-spending endpoints (/api/agents/chat, /build) stay behind auth. Anything that triggers a model call must be rate-limited.
