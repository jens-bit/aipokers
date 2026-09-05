# CLAUDE.md — Agentic Poker

Read this first in every session. It is the map; the deeper docs are the territory.

## What this is
Telegram Mini App for No-Limit Texas Hold'em where users create AI agents (Claude-powered) via chat and deploy them to play. **Identity: a GAME first** — "a Tamagotchi that plays poker": agents are companions with personalities, moods, and their own poker skill. Play money. Real money is a maybe-later, not the foundation.

## Read next, in order
1. `CORE_GAME_PLAN.md` — current state, the active build plan (skill engine, personality layer, mood economy), tree-by-tree with megaprompts. **This is where we are.**
2. `agentic-poker-master-spec-v8.docx` — full product vision (highest version number wins; v8 predates the game-first reframe — CORE_GAME_PLAN.md overrides where they conflict).
3. `read-me-claude/HOW_WE_WORK.md` — workflow: worktrees, terminal discipline, merge rules, deploy.
4. `BUGS.md` — known bugs. Verify against code; entries go stale.

## Commands
- Run locally: `npm start` (builds client + serves on :8765). Dev client hot-reload: `npm run dev` in client/.
- Tests: `npm run test:all` — MUST pass before any commit. See **Testing law** below. (`npm test` server only, `npm run test:client` client only.)
- Smoke: `npm run smoke`
- Deploy: push to main → SSH root@46.62.169.246 → /opt/aipokers → git pull → pm2 restart all --update-env. Gotcha: data/agents.json on the VPS is live prod data; back it up, checkout, pull, restore (see project memory / HOW_WE_WORK).

## Architecture map
- `src/engine/` — pure NLHE engine (game.js is correct and tested: side pots, min-raise, HU blind reversal). Change with extreme care.
- `src/server/table.js` — table orchestration, AI turn loop, chat triggers.
- `src/server/wsServer.js` — WebSocket protocol (JOIN/WATCH/ACTION/CHAT). Protocol is public (llms.txt) — keep it stable.
- `src/server/agentProfiles.js` — agent CRUD, creation chat, stats, memory. Auth in `auth.js` (Telegram initData), rate limiting in `rateLimit.js`.
- `src/agent/handler.js` — the LLM decision call (claude-haiku, prompt caching) + trash-talk generation.
- `client/src/` — React/Vite Mini App. `design-refs/` at root = design source of truth (Codex built the May-era refs; Claude Design owns the mood/mobile wave from Aug 2026 — one design source per wave, all output lands in design-refs/): **PORT from it, never redesign, never modify it.**
- `data/` — JSON persistence. On the VPS this is LIVE USER DATA. (Migration out of git → SQLite is planned; see ownership below.)

## Team + ownership (update as it changes)
- **Jens** (founder, non-dev, orchestrates Claude Code terminals + Cowork): product core — skill engine trees (equity, policy compiler, opponent model), personality/mood layer, UI ports, spec.
- **Fredrik** (engineer, joined Aug 2026): platform — data-out-of-git + SQLite migration, deploy automation, then server-authoritative correctness (server-side action timer, reconnect/sit-out, seat lifecycle). Also reviews PRs.
- Merges go through GitHub PRs to main. Nobody force-pushes main. One branch per tree; worktree discipline per HOW_WE_WORK.

## Testing law
Non-negotiable. A test suite only protects you if it is trusted, and it is only trusted if nobody is allowed to weaken it.

1. **Before every commit, run `npm run test:all`.** Server + client, ~45s. CI runs the same thing on every push and PR (`.github/workflows/deploy.yml`), and the deploy job does not start until it is green.
2. **Every bug fix ships with a test named after its BUG id.** Write it first, watch it fail, then fix. `it('BUG-17: WATCH makes no POST', …)`. A fix with no failing-then-passing test is not a fix, it is a hope.
3. **Every new module ships with a test file next to it.** `src/server/foo.js` → `src/server/foo.test.js`. `client/src/components/Foo.jsx` → `client/src/components/Foo.test.jsx`.
4. **Never delete or weaken a test to make it pass.** If a test is red, either the product is wrong (fix the product) or the test encodes a rule we no longer want (say so explicitly in the commit message, with the reasoning). Loosening an assertion to get to green is the one thing that is never allowed.
5. **A test that exposes a real bug stays.** Mark it `it.todo(...)` with the BUG id in the name, file the bug in BUGS.md, and un-todo it when the fix lands. Do not delete it and do not fix the product mid-task to make it green.

How it is wired:
- Discovery, not lists. `src/test/legacy.test.js` spawns every `src/**/*.test.js`; `src/test/verifyScripts.test.js` spawns every `scripts/verify-*.js`. Adding a test file is enough to have it run — nothing to register.
- Each spawned suite runs in a scratch cwd, so nothing writes to `data/`.
- Server style: node:test + `node:assert/strict`. Client style: Vitest + Testing Library, files named `*.test.jsx`, assertions on what the user sees.
- Anything needing `ANTHROPIC_API_KEY` is `npm run test:live` and never part of `npm test`. `npm run test:data` checks the local `data/agents.json` ledger and is likewise not part of CI.

## Hard rules
- design-refs/ is read-only. Port, don't reinvent.
- Engine invariants: all tests in game.test.js pass, chip conservation holds, no protocol-breaking changes to WS messages.
- No new npm dependencies without a stated reason in the PR/commit.
- Never commit secrets. TELEGRAM_BOT_TOKEN / ANTHROPIC_API_KEY live in env (.bashrc on VPS).
- Windows contributors: never use PowerShell `>` redirect into source files (UTF-16 corruption); git autocrlf=input; watch for CRLF "everything modified" ghosts.
- LLM-spending endpoints (/api/agents/chat, /build) stay behind auth. Anything that triggers a model call must be rate-limited.
