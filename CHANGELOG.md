# Changelog — Agentic Poker

All notable changes to this project are documented here.
Dates are UTC. Format: `[version] — date — summary`.

---

## [0.9.0] — 2026-09-05 — The agent lives: server-side life, a casino floor, a character

- SERVER LIFE (Tree 4): agents play on the server whether or not anyone is watching. Autonomous session loop with hand cap, bust and stall watchdog; deploy starts a session with no WebSocket open; watching became passive. `presence` is now derived from a live table rather than a stored flag (AGE-37), which is what closed BUG-16 and BUG-17. Floor channel pushes throttled FLOOR_STATE/FLOOR_GAME deltas over the socket. SIT_OUT finishes the hand, closes the table and writes a recap (AGE-33). Proven end to end by scripts/verify-server-life.js.
- MULTI-SEAT (Tree 6): tables seat 2–6. Engine cases for 3–6 handed, between-hands seat reconciliation, mid-hand joins dealt into the next hand, side pots layered multiway, matchmaking that prefers joining an open table and prefers a same-owner felt (MST-1..5, MATCH-2). scripts/verify-multi-seat.js.
- HOUSE CAST: six named regulars (Doyle_v3, Phil_AI, Granite, MsAllIn, TiltedTed, TheProfessor) with stable ids, wired into matchmaking (HC-1..3).
- PERSONALITY LAYER (Tree 3.5): mood state machine with trait-scaled transitions, mood in the decision briefing, pep-talk soothing with cooldown, agent moments, session recaps and unseen-recap flags, agents proposing their own strategy changes (AGE-29..32, PROP-1).
- OPPONENT MODEL: rolling per-opponent stat counters, opponent read injected into the briefing, grounded memory with computed stats primary (AGE-24..27).
- TABLE TALK: template talk data, needle injection, stoic immunity, rate limits (TLK-1/2).
- CASINO FLOOR: the mobile home is a room. Floor atoms (ghosts, chips, tickers), data-driven density, floor zoom, dioramas with board and face-up hero cards, relight token pass (FLR-1..5, FISHTANK-1, FLOOR-2/3, LIGHT-1).
- NAV: 5-tab nav replaced by CASINO / CHATS / YOU (NAV-1a..d). CHATS roster + thread, YOU screen, birth/create flow.
- BIRTH FLOW: BirthScreen is the one creation path; every entry point opens it (BIR-1/2).
- WATCH: draggable three-detent sheet, multiway seat ring for 1–5 opponents, showdown held on screen until the next deal, equity rendered as a percentage not a raw fraction, an undriven AI-only table now gets adopted (WV2-1..6). Between-hands calm state and felt density pass (WCM-1/2).
- HAND REVIEW: flagged-hand classifier, storage and API; flagged hands sheet with standup entry; hole cards stored on hand records (FLAG-1, REVIEW-1/2, HANDS-1).
- BANKROLL: persistent bankroll with creation grant, deploy gate, buy-in/cash-out ledger, reload action, chip verify script (BNK-1..3).
- NOTIFICATIONS: Telegram notification budget — ladder, holds, caps, rotation, quiet hours.
- AGENT PROFILE: profile screen with sessionLog and careerStats (PROFILE-1a/b).
- DESKTOP PORT (DSK2): desktop home with floor stage, standup rail and game tile stack; zoom and thread in the rail; watch at the desk with table stage and analysis rail; quiet night, first run and flagged rail (DSK2-1..5).
- CHARACTER SYSTEM (ATTR-1/ATTR-2): attribute engine with six hooks, piecewise lerp so 50 is today's agent, birth generator, arena `--attributes` switch; character-system primitives and data contract, player card v2, nature reveal, growth in the thread, roster and hand review (ATTR-1a..d, ATTR-2a..d).
- WEB LOGIN (AUTH-1): dual-scheme credential verification — Telegram Mini App initData and the Telegram Login Widget; session store in telegram.js, LoginGate, welcome-page login link and web logout (AUTH-1a..c).
- TEST FRAMEWORK (TEST-1/TEST-2): `npm test` discovers every src/**/*.test.js and every scripts/verify-*.js instead of listing six files by hand; Vitest + Testing Library for the client with fixtures built from the real API shapes; CI gate on every push and PR before deploy. Split into a fast pre-commit suite (1.3s) and `npm run test:e2e` (~35s); ANTHROPIC_API_KEY stripped from every spawned suite so no test depends on a live model. Testing law written into CLAUDE.md.
- CACHE: index.html no-store, hashed assets immutable forever (CACHE-2).
- MOBILE: Telegram viewport height tracked so the keyboard no longer eats the chat (KEY-1); Telegram vertical swipe disabled so the sheet owns its gesture (SWIPE-1); landing viewport discipline (LAND-4).
- CHAT: hard brevity law — 1–2 sentences, no option menus, no repetition (CHAT-1).
- BUGS: 16, 17 resolved (server-side life). 18 (flagged review dropped the opponent's showdown cards) and 19 (flagged fetch sent no credential header) found and fixed. 20 filed (dead 14px input rule). 11 dropped — CreateAgent.jsx no longer exists.
- DEPLOY: lockfile churn on the VPS discarded before pull, which had been blocking the pull outright.

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
