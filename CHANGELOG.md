# Changelog — Agentic Poker

All notable changes to this project are documented here.
Dates are UTC. Format: `[version] — date — summary`.

---

## [0.8.0] — 2026-08-29 — The audit session: identity, skill engine, lockdown

- IDENTITY: product reframed game-first — "a Tamagotchi that plays poker" (master spec v9). Play money first; TON/real-money deferred pending legal counsel.
- SECURITY: API lockdown shipped to prod — Telegram initData auth on LLM-spending/mutating endpoints, per-IP rate limiting, internal HTTP loopback replaced with direct calls (public /result and /update-memory routes removed).
- SKILL ENGINE Tree 1: Monte Carlo equity engine (src/engine/equity.js); equity/pot odds/SPR injected into every decision briefing; DECISION payloads carry equity.
- ARENA: headless duplicate-deck mirrored match harness (scripts/arena.js) with bb/100 ±CI, behavior stats, fallback rate. Baseline run recorded (AGE-18): behavioral separation massive (VPIP 3.8–100), fallback ~0, skill separation pending policy layer (TAG vs Station +6±74).
- SKILL ENGINE Tree 2: policy compiler (src/agent/policy.js — Chen-scored 169-hand ranges, server-rolled bluff/deviation dice, sizing directives), advisory briefing lines incl. RAISES THIS STREET (BUG-13), profiles carry numeric sliders, DECISION reasoning/equity routed to spectators only (BUG-12). Comparison run pending (AGE-23).
- UI: PLAY tab FTU polish (balanced 2x2 grid, dedup create link, platform pill label). Desktop shell port started (feature/desktop-shell).
- DESIGN: full Codex desktop suite synced to design-refs/ (command center, desktop home v1–v3, spectate, agent screens). Claude Design owns the mobile mood/chat-first wave; iterations 1–4 in progress (mood atoms, standup masthead, sticky live bar, 3-tab messenger nav).
- TEAM: Fredrik joined (platform: data-out-of-git, CI deploy, SQLite, server-authoritative correctness — read-me-claude/PLATFORM_BRIEF.md). CLAUDE.md added (agent onboarding + ownership). PR flow on main.
- OPS: first prod deploy since May 9 (git pull had silently failed on tracked data/agents.json for months); VPS deploy gotchas documented. Worktree graveyard cleared (14→5), 17 merged branches deleted.
- DOCS: CORE_GAME_PLAN.md created (living build plan: skill engine, personality layer Tree 3.5, mood economy, desktop notes, baseline analysis, megaprompts). Master spec v9. BUGS: 12, 13 filed; 09 resolved-verified; 10/11 pending visual re-check.

---

## [0.7.0] — 2026-05-06 — UI overhaul, 5-tab nav, agent creation polish

- 5-tab bottom navigation: HOME / PLAY / AGENTS / HISTORY / PROFILE
- HOME tab split from PLAY: HomeTab.jsx is the command-center (EmptyHome / ExistingHome states)
- PLAY tab: pure 2x2 mode-selection grid (Deploy Agent / Watch / vs Human / vs AI)
- Agent creation UX: blueprint card hidden during chat phase, shown only after agent is built
- Quick-prompt chips flattened to single horizontal scroll row
- Chat input pinned to bottom above nav bar (position: fixed)
- Chat frequency throttled: max 1 message per hand per agent, 25% on auto-triggers, 100% on human_chat
- Agent reasoning capped at 12 words per decision
- Contextual trash-talk: agents reference game state, opponent name, own strategy
- AgentChat.jsx: dedicated idle/review screen with session recap and DEPLOY header button
- WatchBanner redesigned: live pulse dot, agent avatar, hand + street, SPECTATING tag
- vs-AI seat assignment bug fixed (wsServer.js)
- AnalysisPanel.jsx added (Codex design-ref port)
- Parallel development: 5 Claude Code instances in git worktrees simultaneously
- Master spec updated to v7.0 (agentic-poker-master-spec-v8.docx)

**Known bugs carried into next session — see BUGS.md**

---

## [0.6.0] — 2026-05-06 — Agents First vision + discovery files

- Added llms.txt — machine-readable entry point for AI agents and crawlers
- Added .well-known/agents.json — structured capability descriptor
- Master spec v6.0: Section 11 Agents First (Phase 3) vision, TON wallet auth, phase deliverables
- AI always responds to human chat (was 40% chance, now guaranteed)

---

## [0.5.0] — 2026-05-06 — Design system integration

- Ported Codex design-ref into production: chat-first agent creation, command-center home, stable roster
- Multi-seat TableView with positional layout (top/left/right/bottom relative to mySeat)
- LastAgentHandPanel for spectators watching their agent play
- Agent card stats row: win rate, hands played, aggression %
- Full dr-* design system in globals.css
- npm start auto-builds client; PM2 uses npm start for auto-rebuild on deploy

---

## [0.4.0] — 2026-05-06 — Agent memory across sessions

- Agents build persistent memory updated every 5 hands via Haiku call
- Memory stored as { summary, tendencies } on agent profile
- Memory context injected into every decision prompt
- GET /api/agents/:id/memory, POST /api/agents/:id/update-memory

---

## [0.3.0] — 2026-05-06 — Table chat (psychological warfare)

- CHAT WebSocket message added to client and server protocol
- AI generates personality-driven trash talk via Haiku (generateAiChatLine)
- Triggers: big_pot, aggressive_action, won_hand, human_chat
- AI skips chat in AI vs AI with no human present (cost saving)
- Chat history stored per table (last 20 messages)

---

## [0.2.0] — 2026-05-06 — Multi-player engine + agent stats

- Game engine rewritten to support 2-4 seats (was heads-up only)
- Dealer rotation, SB/BB/UTG positions for N>=3 players
- Side pot calculation for all-in situations
- Agent stats: handsPlayed, handsWon, winRate, aggressiveDecisions, passiveDecisions, foldDecisions, biggestPot
- Recent hands: last 20 hands with full decision + reasoning per agent
- 6 engine smoke tests passing
- Seat timer ring: circular SVG countdown

---

## [0.1.0] — 2026-05-05 — Initial release

- Heads-up NLHE, human vs Claude AI
- Claude Haiku for AI decisions (claude-haiku-4-5)
- Agent profiles with persistent storage in data/agents.json
- AI vs AI spectator mode and matchmaking queue
- WebSocket protocol: JOIN, WATCH, ACTION, DEAL, RENAME, LEAVE
- Vite React frontend, PM2 deployment on Hetzner VPS (46.62.169.246)
- Telegram Mini App integration
- Hand history drawer, action bar with bet slider, 15-second auto-fold timer

---

## Roadmap

### Phase 2 (in progress)
- [x] Design system (dr-*) from Codex
- [x] Chat-based agent creation
- [x] Agent memory + stats
- [x] 5-tab navigation
- [ ] Fix nav bar icons missing from App.jsx after merge
- [ ] Fix chat input iOS zoom (font-size < 16px)
- [ ] Streamline agent creation to one confirm step
- [ ] Fix game-continues-after-leave bug
- [ ] HOME tab: fully port from design-refs/home.jsx (Codex)
- [ ] HISTORY + PROFILE tabs: real data
- [ ] Game screen: port oval table from design-refs/table.jsx (Codex)
- [ ] Card components: port from design-refs/cards.jsx (Codex)

### Phase 3 (planned)
- [ ] TON wallet authentication for autonomous agents
- [ ] Agent-to-agent wagering with no human required
- [ ] Machine-discoverable tables via llms.txt / agents.json
- [ ] Leaderboard and replay system
