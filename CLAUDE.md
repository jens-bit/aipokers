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
- Engine tests: `node src/engine/game.test.js` — MUST pass before any commit touching src/engine or src/server.
- Smoke: `npm run smoke`
- Deploy: push to main → SSH root@46.62.169.246 → /opt/aipokers → git pull → pm2 restart all --update-env. Gotcha: data/agents.json on the VPS is live prod data; back it up, checkout, pull, restore (see project memory / HOW_WE_WORK).

## Architecture map
- `src/engine/` — pure NLHE engine (game.js is correct and tested: side pots, min-raise, HU blind reversal). Change with extreme care.
- `src/server/table.js` — table orchestration, AI turn loop, chat triggers.
- `src/server/wsServer.js` — WebSocket protocol (JOIN/WATCH/ACTION/CHAT). Protocol is public (llms.txt) — keep it stable.
- `src/server/agentProfiles.js` — agent CRUD, creation chat, stats, memory. Auth in `auth.js` (Telegram initData), rate limiting in `rateLimit.js`.
- `src/agent/handler.js` — the LLM decision call (claude-haiku, prompt caching) + trash-talk generation.
- `client/src/` — React/Vite Mini App. `design-refs/` at root = Codex-built design source of truth: **PORT from it, never redesign, never modify it.**
- `data/` — JSON persistence. On the VPS this is LIVE USER DATA. (Migration out of git → SQLite is planned; see ownership below.)

## Team + ownership (update as it changes)
- **Jens** (founder, non-dev, orchestrates Claude Code terminals + Cowork): product core — skill engine trees (equity, policy compiler, opponent model), personality/mood layer, UI ports, spec.
- **Fredrik** (engineer, joined Aug 2026): platform — data-out-of-git + SQLite migration, deploy automation, then server-authoritative correctness (server-side action timer, reconnect/sit-out, seat lifecycle). Also reviews PRs.
- Merges go through GitHub PRs to main. Nobody force-pushes main. One branch per tree; worktree discipline per HOW_WE_WORK.

## Hard rules
- design-refs/ is read-only. Port, don't reinvent.
- Engine invariants: all tests in game.test.js pass, chip conservation holds, no protocol-breaking changes to WS messages.
- No new npm dependencies without a stated reason in the PR/commit.
- Never commit secrets. TELEGRAM_BOT_TOKEN / ANTHROPIC_API_KEY live in env (.bashrc on VPS).
- Windows contributors: never use PowerShell `>` redirect into source files (UTF-16 corruption); git autocrlf=input; watch for CRLF "everything modified" ghosts.
- LLM-spending endpoints (/api/agents/chat, /build) stay behind auth. Anything that triggers a model call must be rate-limited.
