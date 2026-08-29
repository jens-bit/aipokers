# Bug Report — Agentic Poker
Last updated: 2026-05-09 after the post-AJ-review reconciliation

---

## OPEN


### BUG-10 — In-game header drops platform branding
**Severity:** Medium (visual)
**Where:** client/src/components/Header.jsx — in-game variant (rich game-view header)
**What:** During play (vs-AI / vs-Human / Watch), only the rich in-game header shows (back arrow + avatar + name + status + settings gear). The "AGENTIC POKER" wordmark + spade logo + agents pill at the top of the app disappears. User notes this loses the platform identity during the most-shared moments.
**Fix:** Either add a thin top strip with logo + AGENTIC POKER above the rich header, or fold the spade logo into the rich header on the far left next to/replacing the back arrow.

### BUG-11 — CreateAgent suggestion chips too tightly stacked under greeting
**Severity:** Low (UX polish)
**Where:** client/src/components/CreateAgent.jsx + client/src/styles/create-agent.css
**What:** Sub-task 5 of feature/play-cleanup (commit 4c4dbdf) moved the suggestion chips immediately below the greeting message to eliminate dead whitespace. Over-corrected — they now sit pinned to the top, which feels glued. User wants them to sit naturally in the middle of the chat flow with the greeting above and input below.
**Fix:** Restructure the message-list flex so the chips sit centered within available vertical space, not anchored under the greeting. Greeting at top, chips centered, input at bottom.

### BUG-12 — DECISION broadcast leaks AI reasoning + equity to live opponents
**Severity:** High (game integrity)
**Where:** src/server/table.js `_maybeRunAiTurn` — `this._broadcast({ type: ServerMsg.DECISION, ... })`
**What:** The DECISION message (action, reasoning, and — since AGE-16 — equity and potOdds) is broadcast to every connection at the table, including a human playing AGAINST the AI. Reasoning can describe hand strength, and equity ~85% preflop effectively reveals AA/KK. Observed 2026-08-29 in vs-AI play: you see House's thoughts.
**Fix:** Route DECISION only to spectators whose agent it is (and into the stored hand review); never to opposing seats mid-hand. Fold into Tree 4 (UI surfacing) or fix standalone earlier.

### BUG-13 — Min-raise wars: 20–30 raise ping-pong before all-in
**Severity:** Medium (gameplay quality; also inflates LLM cost + arena runtimes)
**Where:** Agent decision behavior (src/agent/handler.js prompt) — engine is rule-correct; the models each min-raise, reopening action indefinitely.
**What:** AI vs AI / vs House escalate via repeated minimum raises, taking 20–30 turns to reach all-in. Classic LLM poker pathology. Observed 2026-08-29.
**Fix:** Tree 2 policy compiler adds sizing directives (commit big or don't reraise; no min-raise chains) + add a `RAISES THIS STREET: n` line to the decision briefing so the model can see the loop. Optionally a soft cap on raises per street as backstop.

### BUG-14 — No way to stop a deployed agent
**Severity:** High (UX / control)
**Where:** watch view + agent thread; server table lifecycle
**What:** Once deployed (e.g. vs House), an agent plays until someone busts — no STOP/sit-out control exists. Observed 2026-08-29 on localhost.
**Fix:** Add a STOP button (watch view + thread/rail). Behavior: finish the current hand, then close the table gracefully (TABLE_CLOSED "sat out by owner"), call /api/agents/:id/finish so the agent goes idle. Server largely supports this via spectator-leave/onEmpty; needs an explicit SIT_OUT WS message so it is deliberate, not a side effect of closing the tab. Fold into Tree 3.5 or a small standalone fix.

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

