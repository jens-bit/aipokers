# Bug Report — Agentic Poker
Last updated: 2026-08-29 late night (post Tree 3.5 + FLR-9/10 deploy)


---

## OPEN

### BUG-18 — Flagged hand review never shows the opponent's showdown cards
**Severity:** Medium (the review is unreadable without them)
**Where:** client/src/components/floor/FlaggedHandsSheet.jsx — `HandReview`
**What:** The server records `opponentShowdownCards` on every flagged entry (`buildFlaggedEntry` in src/server/flaggedHands.js, populated from the showdown in table.js) and GET /api/agents/:id/flagged returns it unscoped, because cards turned over at showdown are public. The sheet renders the hero's `holeCards` and the board and drops the field on the floor. A BAD BEAT review therefore shows the equity collapsing with no sight of the hand that caused it.
**Found by:** TEST-1. Regression test exists and is deliberately red: `it.todo('BUG-18: shows the opponent's showdown cards …')` in client/src/components/floor/FlaggedHandsSheet.test.jsx. Un-todo it when the fix lands.
**Fix:** Render an opponent-showdown row in `HandReview` next to `HoleCardsRow` (seat name + the two cards), shown only when `opponentShowdownCards` is non-empty.

### BUG-16 — Presence lies: agent shown seated/"playing" while his table is frozen
**Severity:** High (product identity)
**Where:** server table lifecycle + floor presence; observed 2026-08-29 on prod
**What:** Hands only advance while a client has the table open. An agent assigned to a table shows presence=playing (floor seats him with cards) but nothing is happening; opening WATCH shows "Waiting…" and then a hand starts because the viewer's arrival wakes the game. The pet only lives while stared at.
**Fix:** Tree 4 server-side play loop — agents play autonomously on the server; watching becomes passive. Presence=playing only when hands actually advance.

### BUG-17 — WATCH entry appears to start a NEW game rather than joining the running one
**Severity:** Medium (symptom of BUG-16)
**What:** Same root cause as BUG-16; fold into Tree 4. Verify on entry mid-hand: viewer should join the hand in progress, not trigger a fresh deal.


### BUG-10 — In-game header drops platform branding — RESOLVED (verified visually 2026-08-29: spade + branding present in watch header; fix commit c7be663 from May)
**Severity:** Medium (visual)
**Where:** client/src/components/Header.jsx — in-game variant (rich game-view header)
**What:** During play (vs-AI / vs-Human / Watch), only the rich in-game header shows (back arrow + avatar + name + status + settings gear). The "AGENTIC POKER" wordmark + spade logo + agents pill at the top of the app disappears. User notes this loses the platform identity during the most-shared moments.
**Fix:** Either add a thin top strip with logo + AGENTIC POKER above the rich header, or fold the spade logo into the rich header on the far left next to/replacing the back arrow.

### BUG-11 — CreateAgent suggestion chips too tightly stacked under greeting
**Severity:** Low (UX polish)
**Where:** client/src/components/CreateAgent.jsx + client/src/styles/create-agent.css
**What:** Sub-task 5 of feature/play-cleanup (commit 4c4dbdf) moved the suggestion chips immediately below the greeting message to eliminate dead whitespace. Over-corrected — they now sit pinned to the top, which feels glued. User wants them to sit naturally in the middle of the chat flow with the greeting above and input below.
**Fix:** Restructure the message-list flex so the chips sit centered within available vertical space, not anchored under the greeting. Greeting at top, chips centered, input at bottom.

### BUG-12 — DECISION broadcast leaks AI reasoning + equity to live opponents — RESOLVED (routing fixed; spectator scoping completed by BUG-15 fix in AGE-33)
**Severity:** High (game integrity)
**Where:** src/server/table.js `_maybeRunAiTurn` — `this._broadcast({ type: ServerMsg.DECISION, ... })`
**What:** The DECISION message (action, reasoning, and — since AGE-16 — equity and potOdds) is broadcast to every connection at the table, including a human playing AGAINST the AI. Reasoning can describe hand strength, and equity ~85% preflop effectively reveals AA/KK. Observed 2026-08-29 in vs-AI play: you see House's thoughts.
**Fix:** Route DECISION only to spectators whose agent it is (and into the stored hand review); never to opposing seats mid-hand. Fold into Tree 4 (UI surfacing) or fix standalone earlier.

### BUG-13 — Min-raise wars: 20–30 raise ping-pong before all-in — RESOLVED (Tree 2 sizing directives; confirmed gone in AGE-28 arena + prod playtest)
**Severity:** Medium (gameplay quality; also inflates LLM cost + arena runtimes)
**Where:** Agent decision behavior (src/agent/handler.js prompt) — engine is rule-correct; the models each min-raise, reopening action indefinitely.
**What:** AI vs AI / vs House escalate via repeated minimum raises, taking 20–30 turns to reach all-in. Classic LLM poker pathology. Observed 2026-08-29.
**Fix:** Tree 2 policy compiler adds sizing directives (commit big or don't reraise; no min-raise chains) + add a `RAISES THIS STREET: n` line to the decision briefing so the model can see the loop. Optionally a soft cap on raises per street as backstop.

### BUG-14 — No way to stop a deployed agent — RESOLVED (AGE-33: SIT_OUT WS message, finish hand → TABLE_CLOSED "sat out by owner" → idle+recap)
**Severity:** High (UX / control)
**Where:** watch view + agent thread; server table lifecycle
**What:** Once deployed (e.g. vs House), an agent plays until someone busts — no STOP/sit-out control exists. Observed 2026-08-29 on localhost.
**Fix:** Add a STOP button (watch view + thread/rail). Behavior: finish the current hand, then close the table gracefully (TABLE_CLOSED "sat out by owner"), call /api/agents/:id/finish so the agent goes idle. Server largely supports this via spectator-leave/onEmpty; needs an explicit SIT_OUT WS message so it is deliberate, not a side effect of closing the tab. Fold into Tree 3.5 or a small standalone fix.

### BUG-15 — Spectators see ALL seats’ reasoning, including the opponent’s — RESOLVED (AGE-33: full payload only when deciding seat === spectatorSeat)
**Severity:** Medium now (immersion), High later (cheating in PvP spectating)
**Where:** src/server/table.js `_broadcastDecision` (BUG-12 fix routed by connection type only)
**What:** Spectators receive full DECISION payloads (reasoning/equity) for every seat — watching your agent vs House shows the HOUSE’s thinking too. Observed 2026-08-29 evening on localhost.
**Fix:** In _broadcastDecision, spectators get the full payload only when the deciding seat === their spectatorSeat (their own agent); bare {seat, action} otherwise. Rider on Tree 3.5.

---

## RESOLVED — kept here for traceability

### BUG-09 — vs-You: agent does not seat as opponent — RESOLVED
Fixed in commit 87d14d2. Root cause: `wsServer.js` JOIN handler gated `maybeAutoSeatAI` behind `process.env.AI_ENABLED === 'true'`. When this env var was not set on the VPS, the user's agent fell through to `scheduleHouseFallback()` instead of taking the opponent seat. Fix: removed the `AI_ENABLED` gate; `wantAI === true` is sufficient — `getAgentAction` already handles the no-API-key case gracefully. Needs `git pull && pm2 restart all` on VPS to take effect.

### BUG-01 — Nav bar icons missing — RESOLVED
Discovered already fixed when checking the live code. HomeIcon, PlayIcon, AgentsIcon, HistoryIcon, ProfileIcon are all defined in App.jsx (~lines 611-656).

### BUG-02 — Chat input causes iOS zoom — RESOLVED
Fixed in commit 012882f (feature/cleanup, polish tree). All input/textarea elements bumped to font-size 16px across chat.css, agent-chat.css, analysis.css.

### BUG-03 — Agent creation double-confirm — RESOLVED
Fixed in commit 3570f69 (fix/watch-opponent). Draft Ready intermediate step removed; flow goes directly from chat completion to Agent Created card.

### BUG-04 — Game continues vs dead AI after player leaves — RESOLVED
Fixed in commit ebc40ae (fix/watch-opponent). Table.js gained hasHumanPlayer() helper; removeConnection now broadcasts TABLE_CLOSED and clears game state when the last seated human leaves a vs-AI game.

### BUG-05 — WatchBanner text has no spacing — RESOLVED + COMPONENT REMOVED
Initially fixed via gap:8px in commit 709540a (fix/analysis-panel). The WatchBanner component itself was later removed entirely in commit bcd9354 (feature/post-merge-frontend) because it duplicated information now shown in the rich game-view header.

### BUG-06 — Table layout breaks during human player's turn — RESOLVED
Found to be a symptom of BUG-A (AnalysisPanel ungated). Fixed in commit ec84840 (fix/analysis-panel) by gating AnalysisPanel + the .app__main--analysis className on config?.isSpectator. Once the panel only renders in spectator mode, the layout no longer shifts on the hero's turn.

### BUG-07 — Both seats show same agent name — RESOLVED
Fixed in commit 9c27bb7 (fix/agent-name-propagation). AgentsTab now passes agentName via the onVsYou payload; App.jsx correctly forwards agentDisplayName to the server.

### BUG-08 — HistoryPlaceholder and ProfilePlaceholder undefined — RESOLVED
Discovered already fixed when checking the live code. Both placeholder components are defined in App.jsx (~lines 580-609).

---

## Notes for next session
- AGENT auth: check that ANTHROPIC_API_KEY is set to the actual key (not the placeholder string `sk-ant-PUT-YOUR-KEY-HERE`) before running locally. The local server falls back to fold-every-hand on 401, which manifests as agents that "play but never raise".
- All design work (icons, oval table, cards, home screen) should be PORTED from design-refs/ folder, not redesigned from scratch. Codex already built the designs.
- For merge conflicts, prefer Cowork chat resolving them via the Edit tool directly on the conflict markers rather than running Python `re.sub` scripts — those scripts have repeatedly truncated rules at conflict boundaries, leaving unclosed CSS blocks that break the build.
- Branch cycling within a worktree: use `git fetch origin && git checkout -B feature/next main`. The naive `git checkout main && git pull && git checkout -b feature/next` fails because git only allows one worktree per branch, and main is already checked out in C:\Projects\ai-poker.
- Real-money TON play is on the product roadmap. Board has accepted the legal risk at sub-1K-user scale. A CLO agent (hired via Paperclip) tracks regulatory exposure and flags inflection points where real legal counsel is needed. Do not treat TON real-money as out of scope.

