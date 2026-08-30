# Core Game Plan — Making Agent Skill Real

Created: 2026-08-29 (Cowork session, post-audit)
Status: ACTIVE — this is the next build phase, ahead of any new UI work and ahead of all Phase 3 work.

---

## Decisions locked in this session

1. **Play money first.** No real-money TON play until the product works and real legal counsel has been consulted. This supersedes the BUGS.md note that said "do not treat TON real-money as out of scope" — it is out of scope for now.
2. **UI-first stays.** Humans are the current audience; the app must look good. But the next sprint is backend, because the UI's centerpiece (agents whose strategies matter, Watch-mode EV, coherent hand reviews) has nothing to show until the core engine exists.
3. **Phase 3 (wallet auth, agent registries) is parked.** Keep the WS/REST protocol clean so nothing has to be rebuilt later, but build none of it now.
4. **API lockdown happens before any promotion.** Unauthenticated endpoints currently trigger paid Anthropic calls and allow anyone to delete/spoof agent data, while llms.txt actively invites crawlers. This is a small, separate work tree (Tree 0 below).

## The problem being solved

Today an agent decision is one Haiku call: hole cards + board + stacks + a 2–3 sentence personality, no math, no opponent data. At that depth, "Loose Cannon" and "Rock Solid" differ in flavor text and little else — hand variance swamps strategy skill. The product claim is "build the better player"; the current reality is "write a different vibe."

The fix is architectural, not model-size: **the server becomes the poker brain (math, ranges, dice, opponent data — all deterministic, all free), and the LLM becomes the personality that steers it.** Strategy profiles compile into numbers that mechanically change behavior; the LLM chooses within and around that scaffold and narrates why.

Success is defined by measurement, not feel: distinct archetypes must produce statistically separable win rates in simulation (see Tree 1, arena harness). Until that passes, nothing is shown to outside users.

---

## Architecture: five components

### A. Equity engine (deterministic, server-side, free)
`src/engine/equity.js` — Monte Carlo equity estimator using the existing pokersolver dependency.

- `estimateEquity({ holeCards, community, nOpponents, iterations })` → `{ equity, iterations }`. Deal random opponent holes + runout completions from the remaining deck, count wins/ties.
- Also compute at decision time: **pot odds** (`toCall / (pot + toCall)`), **required equity**, **SPR** (effective stack / pot).
- Injected into the decision prompt as plain lines, e.g.:
  `EQUITY: ~62% vs random hand | POT ODDS: need 28% to call | SPR: 4.2`
- Target: ~1,000–2,000 iterations per decision, well under the existing 800–2500ms artificial thinking delay. Costs zero API tokens.
- Effect: raises the floor for **every** agent — Haiku stops making innumerate calls — and gives strategy text something concrete to lever ("only continue with equity edge" is now executable).

### B. Policy compiler — strategy as numbers, not literature
`src/agent/policy.js` — compiles the agent's structured profile (the sliders the spec already defines: Aggression, Tightness, Bluff Frequency, Patience, Adaptability) into mechanical directives per decision.

- **Preflop ranges:** tightness maps to "play the top X% of hands in this position" (X from ~15% for a nit to ~60% for a maniac). Server checks the actual hole cards against the range and tells the model: `RANGE: this hand is INSIDE your opening range` (or outside). The model may deviate, but must say why.
- **Server-rolled dice for mixed strategies.** An LLM cannot randomize — ask it to "bluff 30% of the time" and it either always or never does. The server rolls the dice from the profile and injects the outcome: `BLUFF DIE: YES — if a credible bluff line exists this hand, take it.` This is the single change that makes a Bluff Frequency slider produce an actual frequency.
- **Bet sizing preferences** from aggression (e.g. preferred c-bet and value-bet sizings as pot fractions), injected as guidance.
- Existing free-text strategy stays as the personality/voice layer on top.
- Migration: agents created via chat get profile numbers generated at build time (extend `SYSTEM_GEN` in agentProfiles.js to also emit slider values); existing agents get defaults inferred from their style/risk fields.

### C. Opponent model (deterministic counters, no LLM)
`src/server/opponentStats.js` — rolling per-opponent stats keyed by playerId/displayName:

- VPIP, PFR, aggression factor, fold-to-cbet, went-to-showdown %, over the last N hands (start with N=50, persisted in data/).
- Injected as a compact block: `OPPONENT READ (Anna, 43 hands): VPIP 68% (very loose), PFR 12% (passive), folds to river bets 71%.`
- This is what makes "exploit weak players" a real strategy instead of an aspiration. Cheap integer bookkeeping in the existing action path in table.js.

### D. Memory upgrade
Replace the every-5-hands Haiku blurb as the *primary* memory with computed stats (the agent's own VPIP/AF/showdown results and biggest leaks detected from counters). Keep the LLM narrative summary, but generate it less often (every ~20 hands) and feed it the computed stats so it's grounded. Memory injection format stays the same (`getAgentMemoryContext`), so nothing downstream changes.

### E. Arena harness — the measuring stick (BUILD THIS FIRST)
`scripts/arena.js` — headless agent-vs-agent match runner. No WebSockets, no UI, no thinking delays, no chat generation. Drives the Game engine directly with two (or more) strategy profiles.

- **Duplicate-deck mirrored matches:** each pairing is played twice with the same shuffled deck and seats swapped. This cancels card luck and slashes the hands needed for significance — the standard variance-reduction trick from computer poker.
- Outputs per matchup: bb/100 with a confidence interval, plus VPIP/PFR/AF per agent so behavioral differentiation is visible even before win-rate differentiation is significant.
- Config: number of duplicate pairs, model, profiles from a JSON file. Results appended to `data/arena/`.
- Cost: Haiku at ~$0.001–0.003/hand → a 2,000-hand round-robin run costs a few dollars. Cheap enough to run after every prompt/policy change as a regression test.

**Acceptance criteria for this whole phase** (run in the arena, 4 archetypes round-robin — Nit, Maniac/Loose Cannon, TAG, Calling Station — ≥1,000 duplicate pairs per matchup):

1. Behavioral separation: measured VPIP spread ≥ 25 points between tightest and loosest archetype; bluff-die compliance visible in aggression stats.
2. Skill separation: TAG beats Calling Station and Maniac with a confidence interval excluding zero. Sensible ordering overall.
3. No engine errors, no fallback-action storms (fallback rate < 2% of decisions).

If (2) fails after A–C are in, iterate on the prompt/scaffold — do NOT start showing the product around. This claim is the product.

---

## Where this feeds the UI (the part that stays pretty)

- **Watch mode EV**: the spec has always promised "current decision + EV" on the watch screen. The equity engine finally makes that number real — pipe `equity`/`potOdds` into the DECISION broadcast so AnalysisPanel can display it.
- **Agent chat gets substance**: "I called because I had 34% equity and only needed 28%" beats a 12-word vibe. Decision records already store reasoning; add the computed numbers to `currentHandDecisions` entries.
- **Replay classification**: BIG BLUFF / COOLER / BEST WIN become detectable from stored equity data (a river bet with 8% equity that wins = BIG BLUFF), unblocking the replay-cards viral mechanic later.

---

## Build order (work trees, per HOW_WE_WORK conventions)

### Tree 0 — API lockdown (Terminal Q, quick, do first)
1. **Kill the loopback hole**: table.js currently reports hand results and memory updates by HTTP POST to its own public API — the same endpoints anyone on the internet can call. Refactor to direct function calls (export `recordHandResult` / `updateAgentMemory` from agentProfiles.js and import them in table.js — same process, no HTTP). Then the public `/result`, `/update-memory` routes can be removed entirely.
2. **Gate the LLM-spending endpoints**: `/api/agents/chat` and `/api/agents/build` require a session credential. For the Telegram Mini App, validate Telegram `initData` (HMAC check with the bot token — standard, ~30 lines). For browser/dev use, a simple signed token or shared secret via env var is fine at this stage.
3. **Rate limit** everything under `/api` (`express-rate-limit`, generous limits — this is a tripwire, not a wall).
4. Deploy. This tree ships alone, before anything else.

### Tree 1 — Arena + equity (Terminal B, backend)
Megaprompt below. Ships the measuring stick and the equity floor, runs the baseline so there's a "before" number.

### Tree 2 — Policy compiler + dice (Terminal B, after Tree 1 merges)
Profile → numbers, range check, server dice, prompt injection, agent-creation flow extended to emit slider values.

### Tree 3 — Opponent counters + memory upgrade (Terminal B)
opponentStats.js, injection block, grounded memory.

### Tree 4 — UI surfacing (Terminal F, only after 1–3 measure well)
EV in watch mode, numbers in agent chat and hand review. This is where it becomes demoable.

---

## Megaprompt — Tree 1 (paste into Terminal B)

```
TASK GROUP — Arena harness + equity engine. 4 sub-tasks. Each gets its own commit.

READ FIRST, in full:
1. src/engine/game.js
2. src/engine/hand.js
3. src/engine/deck.js
4. src/agent/handler.js
5. src/server/table.js (focus: _buildAiGameState, _maybeRunAiTurn)
6. scripts/smoke-hand.js
7. read-me-claude/HOW_WE_WORK.md

SUB-TASK 1 — Equity engine
Create src/engine/equity.js. Export estimateEquity({ holeCards, community, nOpponents = 1, iterations = 1500 }).
Monte Carlo: build the remaining deck (52 minus known cards), for each iteration deal random
opponent hole cards and complete the board, evaluate with pokersolver (reuse pickWinners/evaluate
from hand.js), count wins + ties/2. Return { equity (0..1), iterations }.
Add src/engine/equity.test.js with sanity assertions (AA preflop vs 1 opponent ≈ 0.85 ± 0.03;
board-locked nuts ≈ 1.0). Node-only, no new dependencies.
Commit: `feat: Monte Carlo equity engine (AGE-15)`

SUB-TASK 2 — Inject math into the decision prompt
In table.js _buildAiGameState: compute equity via estimateEquity, potOdds = toCall / (pot + toCall)
when facing a bet, and spr = myStack / pot. Add them to the returned gameState.
In handler.js buildUserPrompt: add lines
  EQUITY: ~{pct}% vs random hand
  POT ODDS: need {pct}% to call   (only when facing a bet)
  SPR: {x.x}
Also include equity/potOdds in the DECISION broadcast payload and in currentHandDecisions entries.
Commit: `feat: equity + pot odds injected into agent decisions (AGE-16)`

SUB-TASK 3 — Arena harness
Create scripts/arena.js. Headless runner: instantiates Game directly (no WebSocket, no Table),
drives both seats via getAgentAction with configurable strategy strings, zero thinking delay,
no chat. Duplicate-deck mirrored play: for each pair index, generate one shuffled deck, play
hand once, then replay the SAME deck with seat strategies swapped (Dealer accepts an injected
deck — add an optional constructor arg to Game/startHand to pass a fixed deck).
CLI: node scripts/arena.js --pairs 100 --profiles scripts/arena-profiles.json
Output: per-agent bb/100 with 95% CI (computed over pair-sums, since mirrored pairs are the
independent unit), VPIP, PFR, aggression factor, fold rate, fallback-action rate.
Append a JSON result record to data/arena/run-{timestamp}.json.
Create scripts/arena-profiles.json with 4 archetypes: Nit, Loose Cannon, TAG, Calling Station.
Commit: `feat: arena harness with duplicate-deck mirrored matches (AGE-17)`

SUB-TASK 4 — Baseline run
Run the arena: 50 pairs per matchup, all 6 pairings of the 4 archetypes (small, cheap baseline).
Requires ANTHROPIC_API_KEY in env — if absent, stop and report instead of burning the fallback path.
Save results, summarize the numbers in the final report.
Commit: `chore: baseline arena results pre-policy-engine (AGE-18)`

CONSTRAINTS:
- Do NOT touch client/, any CSS, or wsServer.js.
- Do NOT change the WebSocket protocol.
- No new npm dependencies.

WHEN ALL DONE:
- node src/engine/game.test.js must still pass, plus the new equity test.
- Do NOT push.

REPORT BACK with: one line per sub-task — what changed, commit SHA — plus the baseline bb/100 table.
```

---

## What is deliberately NOT in this phase

- Real-money anything, TON contracts, wallet auth — parked (play money first; legal advice before any change).
- New screens, redesigns, UI polish — Tree 4 surfaces the new data in existing screens only.
- Server-authoritative action timers, mid-hand reconnect, seat/rebuy handling — real bugs, second-order right now; schedule after this phase proves the core.
- Model upgrades — measure Haiku with the scaffold first; the arena will show whether a Sonnet tier is worth it per table.

## After this phase

Arena numbers pass acceptance → Tree 4 (surface it) → put it in front of ~50 real people and watch whether anyone returns to talk to their agent. Retention of the agent-chat loop is the next unknown, and no amount of simulation answers it.

---

## Personality layer (Tree 3.5) — added 2026-08-29 after design discussion

Problem this solves: with the scaffold in place, agents risk becoming personality-flavored calculators — same briefing, same obedience, different catchphrases. Personality must be **agency and continuity**, not tone. Character = disposition + memory + stakes; the strategy text supplies only the first. This tree supplies the other two as server-side state.

### F. Tilt / emotional state machine
- Per-agent, per-session state variables tracked server-side in table.js: recent bad beats (lost showdown as equity favorite — detectable once equity is stored per decision), got shown a bluff, losing/winning streak, just won a big pot.
- Condensed into a STATE line injected into the decision briefing, e.g. `STATE: steaming — lost two big pots as favorite; Anna showed you a bluff.`
- The spec's existing **Tilt Control** slider governs how strongly the state line is worded / whether it appears at all. Low tilt control = personality decides what steaming looks like (maniac punts, nit shuts down). High = state line suppressed.
- This makes "can you tilt the AI?" (spec §5.7 meta-game) mechanically real: chat and bad beats feed state; state feeds decisions.

### G. Plans and grudges (note-to-self)
- Extend the decision JSON contract with an optional `"note"` field: one line the agent writes to itself after a hand ("Anna check-raises every flop — call once, raise turn next time").
- Latest note injected next decision as `YOUR CURRENT PLAN: ...`. Cleared/replaced as the agent updates it.
- Cheapest source of visible agency: spectators in watch mode see traps set and sprung across hands. Also feeds replay narratives.

### H. Discipline budget (advisory briefing)
- The briefing (range verdict, equity, dice) is explicitly ADVISORY. The profile's discipline/adaptability value sets how freely the agent may override it, enforced by wording + a server-rolled "deviation allowance" so freedom is a frequency, not a vibe.
- Personality = the agent's relationship to its own strategy.

### I. Chat susceptibility
- Profile value controlling how table chat is framed in the briefing: from "table talk is noise — ignore it" to "you take things personally." Skilled humans can talk a susceptible agent into mistakes and get nothing off a stone-cold one.

### Tuning warning — the most important dial in the product
Over-scaffolding homogenizes: if the briefing is too directive, all archetypes converge on obeying it. The arena's behavioral-spread metrics (VPIP/PFR/AF spread across archetypes, tilt responsiveness) are the regression check for personality collapse. If spread shrinks after a scaffold change, loosen the briefing language before touching anything else.

Build order note: F and G first (small, high yield — F needs equity stored per decision, so after Tree 1). H and I ride along with Tree 2's policy compiler wording. Arena (Tree 1) gains a "spread report" section so personality collapse is measurable, not felt.

---

## The game reframe — agent as companion (added 2026-08-29, later same session)

**Identity decision (Jens): this is a GAME first.** A Tamagotchi that plays poker — an agent you check on, that has moods, wants things, and proposes its own changes. Not a hardcore prompt-engineering competition (that stays as the hardcore layer, not the identity). Real money is a possible later addition on top, not the foundation. **This should be folded into master spec v9 as a §1 Product rewrite next spec update.**

Why this reframe is load-bearing, not decoration:
- Retention: "your agent is sad and wants to talk" is proven virtual-pet retention machinery; it beats stat-review as a reason to open the app.
- De-risks the core: the product no longer requires large skill separation to be fun — it requires a believable character whose poker is real enough to generate stories. Believable character is what LLMs are best at today.
- Revenue: game economy (cosmetics, agent slots; items later) is regulatorily clean, unlike rake.
- Sharing: character stories ("my agent went on a revenge arc and asked to bluff more") out-share win-rate stats with normal users; the bb/100 badge stays for the competitive layer.

### Additions to existing trees (no new tree needed)
- **Tree 3.5 addition — persistent mood:** the tilt/state variable persists on the agent record in agents.json across sessions (mood: e.g. confident / neutral / frustrated / sulking + a one-line cause). Derived from existing stats + session results. Cheap: one field plus arithmetic.
- **Tree 3.5 addition — the self-change proposal (highest-value single feature):** the agent's owner-chat opening message becomes mood- and want-driven, generated from mood + computed leak stats: "Rough night — I keep getting bullied off flops. I want to tighten up preflop — can I?" with ACCEPT / DISCUSS chips; ACCEPT patches its own strategy via the existing PATCH /api/agents/:id. Owner approves; agent proposes. Uses only existing plumbing + prompt changes.
- **Tree 4 becomes mood surfacing:** mood icon/badge on roster + home agent cards (ghost avatars already in the brand system), mood line in AgentChat header, mood-driven recap. This is the Tamagotchi face.

### Guardrails
- **No guilt machinery.** Moods are about poker, never about the owner neglecting the agent. Sad ≠ needy. No decay-for-absence mechanics.
- **Feelings loud, consequences opt-in.** Mood colors expression and generates proposals; its effect on actual play stays governed by the user's Tilt Control setting. An agent that silently plays worse "because it's sad" reads as a bug.
- **Items parked** (like TON): cosmetic/narrative items safe later; gameplay-affecting items are pay-to-win and poison arena fairness. Not now.

---

## Mood economy — design notes (added 2026-08-29, later same session; POST-Tree-3.5, build nothing here yet)

**Change to Tree 3.5 (supersedes the Tilt Control slider):** there is NO user-facing tilt-control setting. Tilt is a real, unavoidable mechanic managed through play. Tilt-resistance is a TRAIT of the agent's personality (stoic grinder barely tilts, Loose Cannon tilts hard) — temperament is part of the character the user built, set at creation by the policy compiler, not a slider.

**The mood design law (replaces the slider as the safety mechanism).** Every mood effect must be:
1. **Visible** — mood icon on the card, agent says it's steaming, tilted decisions labeled in hand review.
2. **Bounded** — tilt shifts aggression/discipline dice and loosens ranges; it never lobotomizes. Hard floor on play quality.
3. **Counterable through play** — pep talk, item, time, or a won pot brings it back.
Any negative state failing one of these reads as a bug, not a character.

### Mechanics captured (in rough build order, all after 3.5 ships)
- **Pep talk:** owner chat can talk a tilting agent down — bounded effect + cooldown (otherwise optimal play is spamming "calm down"). Nearly free: chat endpoint + state write. Creates a mid-session reason to open the app.
- **Items rule — items touch STATE, never SKILL.** Snack soothes tilt, coffee restores focus on long runs; no item ever buys better cards, math, or model. Caveat: tilt-removal indirectly buys win rate → **ranked/arena play is item-free or item-normalized; casual tables allow items.** Decide this explicitly when items ship.
- **First item:** ONE consumable (snack → reduces tilt), one button, shipped alone; watch player behavior before designing any stat sheet.
- **Table-wide modifiers (the beer):** buy the table a round → whole-table state line + loosened discipline dice for a few hands. Social, chaotic, manufactures replay-card moments. Mechanically trivial.
- **Backpack / provisioning:** load consumables before an unattended overnight run (expedition-prep loop). Fits deploy-and-walk-away.
- **Energy systems: RESIST.** Energy must never gate whether an agent can play — played hands are the content, the arena sample, and the fun. If energy ever exists it gates bonuses (XP, drops) only.
- **Tokenization: parked, door kept open.** No tokens/NFTs now (re-imports the regulatory + speculation problems parked with TON; play-to-earn economies that arrive before fun attract extractors). Requirement TODAY that costs nothing: inventory is server-authoritative with unique item IDs, so tokenizing later is a bolt-on decision, not a rearchitecture.

---

## Megaprompt — Tree 0 (API lockdown; paste into backend terminal on branch fix/api-lockdown)

```
TASK GROUP — API lockdown. 3 sub-tasks. Each gets its own commit.

READ FIRST, in full:
1. CORE_GAME_PLAN.md (root) — section "Tree 0 — API lockdown"
2. src/index.js
3. src/server/agentProfiles.js
4. src/server/table.js (focus: _reportHandResults, _triggerMemoryUpdate, _refreshAgentMemory)
5. client/src/lib/telegram.js
6. read-me-claude/HOW_WE_WORK.md

SUB-TASK 1 — Kill the HTTP loopback
table.js currently reports hand results and triggers memory updates by fetch()ing
its own public HTTP API on localhost. Refactor: export the underlying logic from
agentProfiles.js as directly callable functions (e.g. recordHandResult(agentId,
userId, body), runMemoryUpdate(agentId, userId, recentHands), getMemoryContext(
agentId, userId)) and call them directly from table.js — same process, no HTTP.
Then REMOVE the public POST /api/agents/:id/result and POST /api/agents/:id/update-memory
routes entirely. Keep GET /api/agents/:id/memory (read-only, harmless).
Verify npm run smoke and node src/engine/game.test.js still pass.
Commit: `refactor: direct function calls replace HTTP loopback; remove public result/update-memory routes (SEC-1)`

SUB-TASK 2 — Gate the LLM-spending endpoints
POST /api/agents/chat and POST /api/agents/build trigger paid Anthropic calls and
must no longer be open. Create src/server/auth.js with middleware:
- If env TELEGRAM_BOT_TOKEN is set: require a valid Telegram Mini App initData
  string (sent by the client as header `x-telegram-init-data`) and verify its
  HMAC per Telegram's documented algorithm (HMAC-SHA256, secret = HMAC of bot
  token with key "WebAppData"). Reject invalid/missing with 401.
- Else if env DEV_API_SECRET is set: require header `x-api-secret` to match.
- Else (neither set — local dev): allow, but log a loud startup warning that the
  API is UNPROTECTED.
Apply the middleware to /api/agents/chat and /api/agents/build (and PATCH/DELETE
/api/agents/:id). Client side: add a small helper in client/src/lib/telegram.js
that returns window.Telegram?.WebApp?.initData ?? '', and attach it as the
x-telegram-init-data header on the fetch calls to chat/build/patch/delete
(CreateAgent.jsx, AgentChat.jsx, AgentsTab.jsx — wherever those fetches live).
No visual changes to any component.
Commit: `feat: Telegram initData auth on LLM-spending and mutating endpoints (SEC-2)`

SUB-TASK 3 — Rate limiting
Add a tiny in-memory rate limiter (no new npm dependency — a ~30 line middleware
keyed by IP, sliding window) applied to all /api routes: generous defaults
(60 req/min per IP; 10 req/min for /api/agents/chat and /api/agents/build).
Return 429 with a JSON error. Limits configurable via env.
Commit: `feat: per-IP rate limiting on API routes (SEC-3)`

CONSTRAINTS:
- Do NOT touch src/engine/*, wsServer.js protocol behavior, or any CSS.
- Do NOT change the WebSocket JOIN/WATCH flow — play stays open (play money).
- No new npm dependencies.

WHEN ALL DONE:
- npm run build:client must pass, npm run smoke must pass.
- Do NOT push.

REPORT BACK with: one line per sub-task — what changed, commit SHA.
```

Deploy note for Tree 0: VPS needs `TELEGRAM_BOT_TOKEN` set (BotFather token for
@agenticpoker_bot) in /root/.bashrc, loaded via `pm2 restart all --update-env`.
Without it the server runs in the unprotected dev mode and logs a warning.

---

## Desktop Command Center (Codex design synced 2026-08-29 — design-refs/desktop-command.jsx et al.)

**The design's thesis: "The chat IS the command center."** Every product event — live games, daily standup, flagged hands, promotions — is a rich message in a SYSTEM conversation feed. This is the UI language for the personality layer's outputs (standup = mood-driven recap; composer strategy-patch = the self-change loop; suggested chips = proposals). Full desktop suite now in design-refs/: desktop-command, desktop-home v1–v3, desktop-empty/filled, desktop-spectate, plus agent-chat/agent-live/agent-preview/create-agent/profile/replays and compiled HTML previews.

### Features the design assumes that are NOT yet specced/built
1. **Persistent bankroll (load-bearing):** top bar shows BANKROLL + P&L 24H. Today chips are conjured per table. A play-money ledger (persistent balance, buy-ins deducted, winnings credited) is what makes results accumulate into meaning. Owner: Fredrik, after SQLite (natural schema addition). Prereq for standup P&L, leaderboards, and any economy.
2. **Progression:** agent tiers + XP ("Bluff Master promoted to TIER 2, +150 XP" at 1,000 hands positive ROI; user tiers). Cheap milestone counters over existing stats; pure game-identity. Design the milestone table when mood economy work starts.
3. **Flagged-hand EV classifier:** "Folded TT to 3-bet, −$80 EV". Buildable post-Tree-1 (per-decision equity now stored). Small: flag hands where chosen action's EV loss vs. alternative exceeds threshold. Feeds standup + replay cards.

### Port sequencing
- NOT before Tree 2 lands (frontend effort competes with the skill engine).
- First slice when it starts: shell (top bar, conversations rail, feed, composer) as the ≥1100px layout of the EXISTING client + GameTile fed from existing broadcasts (state, reasoning, equity all available today) + flagged-hands-lite.
- With Trees 3–3.5: standup with mood voice, self-change proposals, suggested chips.
- Group session = same feed, multiple agent authors (team standup, agents riffing). No new architecture; prototype after 3.5.

### Divergent design files — reconcile before next frontend tree touches them
Zip/design-refs versions of home.jsx, cards.jsx, analysis.jsx differ from previously committed copies (neither side uniformly newer). Diff before porting so Codex's latest isn't lost. Original full export kept by Jens (Agentic Poker.zip upload, 2026-08-29).

---

## Baseline results (run-2026-08-29T14-36-34-647Z, 50 pairs/matchup, pre-policy)

| Agent | bb/100 | ±CI95 | VPIP | PFR | AF | Fold% | Fallback% |
|---|---|---|---|---|---|---|---|
| Nit | +12.5 | 131 | 3.8 | 3.4 | 3.1 | 83.4 | 0 |
| Loose Cannon | −212.7 | 340 | 100 | 100 | 25.7 | 0.2 | 0 |
| TAG | +173.0 | 256 | 23 | 22.2 | 5.8 | 36.3 | 0.2 |
| Calling Station | +27.2 | 228 | 99.5 | 4.2 | 0.15 | 5.5 | 0 |

Reads:
- **Behavioral separation: PASSED, violently** (VPIP 3.8→100). Equity briefing alone makes Haiku follow personality text faithfully — but as caricatures (Nit is a statue, Cannon never folds). Policy compiler must CALIBRATE, not create, differentiation.
- **Health: PASSED** — fallback rate ~0 (was chronic "illegal raise → safe" spam on prod before equity lines).
- **Skill separation: NOT YET.** Ordering sensible (TAG top, Cannon bottom) but CIs include zero at 50 pairs. Only significant cell: Station beats Nit −66.5±26.4 (correct: 83% folding bleeds blinds). TAG vs Station +6±74 = coin flip — TAG fails to extract vs a player who can't fold; check-downs dominate. This is exactly Tree 2's target: thin relentless value vs stations, calibrated ranges, sizing directives.
- Acceptance run later needs 200+ pairs (variance from jam-heavy matchups: ±700 CIs).
- cached:0 on all calls — prompts below Haiku's cacheable minimum; irrelevant at this size.
- Cost: ~2,200 decisions / 42 min / ~$1.

Tree 2 megaprompt (AGE-19..23, includes BUG-12 + BUG-13 fixes) issued 2026-08-29 in session; if lost, re-derive from this section + Tree 2 spec above.

---

## Megaprompt — Tree 3 (opponent model + grounded memory; paste into backend terminal AFTER Tree 2 merges, on branch feature/opponent-model)

```
TASK GROUP — Opponent model + grounded memory. 5 sub-tasks. Each gets its own commit.

READ FIRST, in full:
1. CORE_GAME_PLAN.md — Tree 3 section + baseline results + Tree 2 outcomes
2. src/server/table.js
3. src/agent/policy.js and src/agent/handler.js
4. src/server/agentProfiles.js (memory section: runMemoryUpdate, getAgentMemoryContext, formatHandForPrompt)
5. read-me-claude/HOW_WE_WORK.md

SUB-TASK 1 — Opponent counters
Create src/server/opponentStats.js: rolling per-opponent stats keyed by playerId
(and displayName as alias): hands observed, VPIP, PFR, aggression factor,
fold-to-raise rate, went-to-showdown rate — over the last 50 hands (ring buffer).
Update from the table's action flow (hook where actions are applied; count once
per hand per stat definition, not per action where inappropriate — VPIP/PFR are
per-hand flags). Persist to data/opponents.json (throttled writes, best-effort).
Unit test with a scripted action sequence.
Commit: `feat: rolling per-opponent stat counters (AGE-24)`

SUB-TASK 2 — OPPONENT READ in the briefing
Inject into _buildAiGameState/buildUserPrompt when an opponent has ≥10 observed
hands: `OPPONENT READ (<name>, N hands): VPIP x% (label), PFR x%, folds to
raises x%, goes to showdown x%.` Label buckets: very tight/tight/normal/loose/
very loose. Keep ADVISORY framing. No read line under 10 hands.
Commit: `feat: opponent read injected into decision briefing (AGE-25)`

SUB-TASK 3 — Grounded memory
Rework the memory system: primary memory = computed self-stats + top leak lines
derived from stored decisions (e.g. "folded as equity favorite N times",
"bluff die taken but abandoned river X times") — deterministic, no LLM.
Narrative summary via Haiku drops to every 20 hands, is fed the computed stats,
and FIX the truncation bug: raise max_tokens for the memory call and make the
parser tolerant (extract JSON with a bracket-matching scan; on failure keep the
previous memory instead of erroring). getAgentMemoryContext output format stays
compatible.
Commit: `feat: grounded memory — computed stats primary, tolerant narrative (AGE-26)`

SUB-TASK 4 — Arena adaptation support
scripts/arena.js: accumulate opponent stats across a matchup (agents build reads
on each other as pairs progress) using the same opponentStats module, so late
pairs test adaptation. Add a --no-reads flag to disable for A/B. Report reads-on
vs reads-off is NOT required in this tree — just wire it cleanly.
Commit: `feat: arena accumulates opponent reads across pairs (AGE-27)`

SUB-TASK 5 — Arena comparison run
Requires ANTHROPIC_API_KEY — if absent, stop and report. Run 50 pairs, all
pairings. Compare vs the AGE-23 run: does TAG's edge vs Calling Station grow
further with reads? Do archetypes stay behaviorally separated? Fallback <2%?
Commit: `chore: post-opponent-model arena results (AGE-28)`

CONSTRAINTS:
- Backend only (src/, scripts/). No client changes, no new dependencies,
  no WS protocol changes. All existing tests plus new ones must pass.
- Do NOT push.

REPORT BACK: one line per sub-task with SHA + the comparison table.
```

---

## Post-policy arena results (run-2026-08-29T15-48-21-796Z, 50 pairs/matchup) — POLICY ENGINE VALIDATED

| Agent | bb/100 (base → post) | VPIP | AF | Fallback |
|---|---|---|---|---|
| TAG | +173 → **+295.8 ±235 (CI excludes zero)** | 23 → 22.8 | 5.8 → 8.4 | 0 |
| Calling Station | +27 → +149.2 | 99.5 → 100 | 0.15 → 0.2 | 0 |
| Nit | +12.5 → −28.1 | 3.8 → 9.1 | 3.1 → 2.3 | 0 |
| Loose Cannon | −212.7 → −416.9 | 100 → 100 | 25.7 → **171.7** | 0 |

- **TAG vs Station: +6 → +222.9 bb/100** — thin-value exploitation working (TAG AF 6.9→28.3 in that matchup). TAG aggregate significant. TAG beats all three archetypes; ordering textbook.
- Two significant matchups (TAG>Cannon −660±626; Station>Cannon). Behavioral spread intact (VPIP 9–100). Fallbacks 0.0%.
- OPEN TUNING (fold into Tree 3 as riders): (1) low-end tightness mapping — Nit reached 9.1 VPIP (target 12–15); root cause is archetype STRATEGY TEXT overriding the range briefing ("AA KK QQ JJ AK only" read as authoritative) → soften archetype texts / lower Nit discipline; Nit now loses (−28) because it plays a wider range it wasn't taught to play — same prompt-side fix. (2) Maniac AF 171.7 — never calls, only raises; add an aggression sanity bound or accept as caricature. (3) Acceptance run at 200+ pairs before the 50-humans gate.
- Merged to main 2026-08-29 evening along with chore/platform-1 (data untracked, CI deploy, audit notes) and feature/desktop-shell (DSK-1..8). deploy.yml corrected post-merge: `pm2 restart all` WITHOUT --update-env (non-interactive SSH never sources .bashrc → --update-env would wipe API keys from the process env).

---

## Design pivot: the Casino Floor (2026-08-29, late evening — Jens's call, exploration in Claude Design)

Mobile HOME becomes a diegetic casino floor: one stylized room where the agents visibly exist — playing = seated at a felt, idle = at the bar, sulking/tilted = alone in the lounge corner. Mood is body language (posture, eye glow, aura); ghosts FLOAT (no walk cycles — the hooded-ghost avatar choice makes this cheap). Tap an agent → camera zoom → it speaks its latest moment in its voice (mood-colored speech bubble) → CHAT (thread) / WATCH (full table). Replaces the feed concept (too spammy at low agent counts) AND deletes the TEAM tab. Mobile tabs: CASINO / CHATS / YOU. Chats list doubles as the efficient roster; profile stays behind the thread header (Telegram info-page pattern). MECHANICS ARE DEVICE-INVARIANT (Jens): same metaphor and interactions everywhere — once the floor settles on mobile, it becomes desktop's home view too (bigger room, more detail), with the console elements (tiles, composer, stats) as side panels around it. The current desktop shell is an interim console, not a separate paradigm. Scope guardrails: one room, three zones, CSS drift only, no pathfinding/minigames/day-night. Rationale: eight iterations of "boring/not engaging" traced to the same root — the creatures were never visible existing; this is the Tamagotchi-game feeling made literal.

---

## Playtest notes (2026-08-29 evening, post-0.8.0 local test with live agents)
- Policy engine visibly working in prod-grade play: sized opens, junk folded with stated reasoning, no min-raise wars.
- **Watchability gap: tight-vs-tight fold-fests.** 7 straight uncontested preflop hands (Rock Solid vs TAG-shaped House). Fix: complementary House matchmaking — deploy-time lookup picks the House archetype that creates action vs the agent's profile (Station vs tight agents, TAG vs loose). Small backend change (scheduleHouseFallback/maybeAutoSeatAI); queue for Tree 3.5 or a quick fix after Tree 3 merges.
- **Equity "—" in mobile watch view**: DECISION payload carries equity to spectators but AnalysisPanel/seat slot doesn't render it. Next frontend tree.
- BUG-10 verified resolved (spade present in watch header). BUG-11 still pending visual check in the mobile create flow.

---

## Megaprompt — Tree 3.5 (personality layer: mood engine + floor API; paste AFTER Tree 3 merges, on branch feature/personality-layer)

Six sub-tasks, AGE-29..34: (1) mood state machine (confident/neutral/frustrated/tilted/sulking; events from existing data: wonBigPot, lostAsEquityFavorite, lostBigPot, cardDead, streaks; tiltResistance TRAIT from profile — no slider; decay toward neutral; persisted {state,cause,updatedAt}); (2) STATE line in briefing (bounded effect per Mood Design Law) + pep-talk soothing one step, 10-hand cooldown, mechanical detection; (3) agent.lastMoment (template voice, no LLM), agent.unseenRecap + POST /:id/seen, GET /api/agents extended with mood/lastMoment/unseenRecap/presence — the casino floor's single data call; (4) self-change proposals from Tree-3 leak stats, accept/reject endpoints applying strategy patch; (5) SIT_OUT WS message (BUG-14: finish hand → graceful close → idle+recap) + complementary House matchmaking (tight agent gets Station-House, loose gets TAG-House — playtest fold-fest fix); (6) end-to-end verification, no arena needed. Constraints: backend only, bounded mood effects enforced in code, no client changes. RIDER (added later same night): BUG-15 — _broadcastDecision must send full reasoning/equity payloads to a spectator ONLY for their own spectatorSeat; bare {seat, action} for all other seats (opponent thoughts currently leak to spectators). Full prompt text issued in session 2026-08-29 (late); reconstruct from this summary + Personality Layer section if lost.

---

## Post-opponent-model arena (run-2026-08-29T17-33-01-129Z, AGE-28)

| Agent | bb/100 (AGE-23 → 28) | VPIP | AF | Fold% |
|---|---|---|---|---|
| TAG | +295.8 → +56.7 ±83 | 22.8 → 19.3 | 8.4 → 12.6 | 43.9 → 57 |
| Loose Cannon | −416.9 → **+51.4** | 100 → **53.8** | 171.7 → **4.5** | 1.3 → 21.5 |
| Nit | −28.1 → −19.5 | 9.1 → 16.7 | — | 78 → 68 |
| Calling Station | +149.2 → **−88.6** | 100 → 96.5 | 0.15 | 6 |

Reads: **Calibration riders nailed** (Cannon hit the 55-65 VPIP target; maniac AF pathology gone; Nit near target). Ecosystem became REALISTIC poker: the Cannon is now a legit LAG (+51, beats Station +221), Station is correctly the biggest loser, TAG ≈ LAG on top. **Target miss: TAG vs Station fell +223 → +57 (was expected to grow with reads)** — hypothesis: the "goes to showdown" read made TAG cautious (fold rate → 57%) instead of widening thin value. TODO (small, later): A/B with `--no-reads` (flag exists) to isolate whether reads help or hurt TAG; consider a briefing line teaching the correct exploit ("vs a player who never folds: value bet wider, never bluff"). Fallbacks 0, spread ~80pts, run faster (2007s — less raise-warring). Tree 3 merged to main 2026-08-29 night; Tree 3.5 (personality layer) started immediately after.

---

## EOD status 2026-08-29 — everything shipped today, and the decisions that closed the night

SHIPPED TO PROD (all merged to main, auto-deploy green):
- Skill engine complete: Tree 0 (API lockdown), Tree 1 (equity+arena), Tree 2 (policy compiler), Tree 3 (opponent model + grounded memory). Three arena runs validated it (see tables above).
- Casino floor as mobile HOME (FLR-1..8): SVG room, three zones, mood postures, tap-zoom, pot tickers.
- Personality layer / Tree 3.5 (AGE-29..34): mood engine, pep talks, moments/recap, self-change proposals, SIT_OUT + complementary House, spectator reasoning scoped (BUG-15). Prod ghosts have moods.
- FLR-9: playing ghost seated at the near rail with card-back fan. FLR-10: create-agent chat fails politely outside Telegram (was: silently ate your message); 720–1099px browsers get a centered phone frame.

DESIGN DECISIONS (Claude Design, tonight — canon):
- **Fish-tank law (REVERSES the earlier "no cards on floor" law):** a felt where the USER'S OWN agent plays renders as a living mini-diorama — board cards, agent's hole cards FACE UP, pot ticker. Other users' agents always show card backs. Cards scale with felt; too-small felts degrade to glow+pot. Rationale: the product is watching your pet play; a felt with face-down cards is a dead aquarium.
- The Spotify-style now-playing bar was designed and KILLED same night (clunky; the diorama makes it redundant).
- Zoom on a playing agent gains a LiveBar strip (hole cards, board, pot, equity, action+timer; thinking/acted/between-hands states). Zoom on a resting agent shows Profile button (artboard was missing).
- Design system Phase 2 extracted (zip 15/16): five sheets — tokens, mood logic, ghost anatomy, component inventory, state matrix. Component names in the inventory are the production names.

PLAYTEST FINDINGS (tonight, prod):
- **The big one: agents only "live" while watched.** Hands advance only while a client has the table open. Floor honestly shows the agent seated (he IS at a table) but the game is frozen until WATCH wakes it — "Waiting…" then a fresh hand on entry. Breaks the Tamagotchi promise. Fix = Tree 4 headline.
- Desktop browser can't authenticate (Telegram-only HMAC) — chat/agents unavailable outside Telegram. By design, now fails politely (FLR-10). Desktop play TODAY: Telegram Desktop app runs mini apps. LATER: Telegram Login Widget on web (Fredrik's queue).

## Tree 4 scope (megaprompt tomorrow — server-side life + live floor)
1. **Server-side play loop:** agents at tables play hands autonomously on the server, viewer or none. Watching becomes passive observation, not the engine. Mood/moments/recap machinery (3.5) already receives the results.
2. **Floor channel:** lightweight WS (or poll upgrade) streaming floor state — presence, mood, per-felt board/hole cards/pot — feeding the fish-tank diorama and the zoom LiveBar in real time.
3. Riders: presence truth (seated only when hands actually advancing), verify table-close retires agents in all paths, equity "—" in mobile watch AnalysisPanel.
Then Tree 4b (threads/sticky live bar/chats voice) after the design system port; --no-reads A/B and 200-pair acceptance run still queued.

## Design phase COMPLETE (zip 19, 2026-08-29 ~23:00) — design-refs/ synced
Desktop parity wave landed: home (one live + zoom echo), quiet/FTU, WATCH (+ sit-out in the same between-hands position as mobile), thread with proposal ACCEPT/DISCUSS and docked LiveBar, ThreadRosterRail. Command Center furniture audit on the board: PORTED bankroll header→DeskTopBar, tiles→PGameTile (=LiveBar expanded), composer→PComposer (slash rail demoted to "/" focus state), StandupCard (desktop-only by decision); SUPERSEDED EV chips→MoodBand+flagged card, icon rails→roster, slash palette→proposal pattern; PARKED XP/tiers (needs pre-launch decision — recommendation: keep parked through the 50-humans test; the agents' own progression (versions, bankrolls, standup) is the progression) and achievement toasts. Both design-board contradictions resolved. design-refs/ now carries the full mood suite incl. mood-watch, mood-desktop3, mood-system(2), design-system doc — THE port source for Tree 4b. Design iteration stops here; changes only from playtest findings.

## Post-freeze additions (zips 20–22, synced to design-refs/) — design NOW fully frozen
- Birth flow (mood-birth.jsx / mood-birth2.jsx): create-agent redrawn as the birth scene — chat-first draft with FormingGhost gaining definition, one-row profile strip, NO "agent created" card (the ghost materializes at the bar on the floor; desktop: dashed roster row solidifies, StandupCard logs "joined the room"). Edit variant uses the proposal-diff pattern. Draft assistant speaks in the SYSTEM voice; the ghost's first words happen on the floor.
- Notification kit (mood-notify.jsx + Notifications.html): the Telegram bot's re-engagement messages as an implementation reference for Tree 4/4b — five types (session recap [button], proposal, mood alert, quiet win, milestone), each with trigger, frequency cap, and 2–3 alternate lines in agent voice. Laws: every message in the agent's world (never "we miss you", no owner-guilt), causes always named, budget ≤2 pings/day with a priority ladder (recap wins ties), quiet hours (a 02:14 recap HOLDS until 08:00 and says so), mood alert capped once/day PER OWNER, one pending proposal at a time.

## Tree 6 (queued): MULTI-SEAT TABLES — noted 2026-08-30 (Jens)
Engine already does multi-way (side pots audited; 6-max ranges in policy). Missing is the table layer: seats capped at 2, no join-in-progress (game built once, never reconciled — Fredrik backlog #3), no matchmaking, client draws 2 seats. Scope when it runs: 3–6 agents per felt, join/leave mid-session, archetype-complementary table filling (fold-fest fix generalized), N-seat client table + floor felts seating multiple ghosts. Design already 6-max ("NLH 6-MAX" mocks, SeatChips) — no design work needed. Order: after Tree 4 (server life) + Tree 5 (notifications); coordinate with Fredrik's seat-lifecycle/timer/reconnect backlog — same files.

## Reads A/B verdict (run-2026-08-30T10-25-41-835Z, 50 pairs, TAG vs Calling Station, --no-reads)
TAG +166.2 bb/100 ±200 with reads OFF vs +57 with reads ON (AGE-28) vs +223 pre-reads. CI overlaps zero at 50 pairs, but the behavioral evidence is decisive: reads-on TAG fold rate 57% vs reads-off 30.7% — the "goes to showdown" read makes TAG FOLD MORE against a player who never folds, the exact inverse of the correct exploit. FIX (AGE-40 rider, after Tree 4 merges — touches briefing builder): when an opponent read shows high VPIP/WTSD + low fold-to-cbet, the briefing must say "value bet thinner and bigger, never bluff, and do NOT tighten up — he pays off"; never let a showdown-tendency read imply caution. Confirm at the 200-pair acceptance run.

## Process gotcha (from PORT wave): Claude Code Edit calls corrupted JSX with Unicode smart quotes ("...") in attribute strings; fix is rewriting the file with Write. Watch for it in future frontend edits.

## Tree 4 keyed E2E (2026-08-30): 51/51 under real Haiku; stall watchdog added (3b78cef)
Real-latency findings: multi-street play confirmed (31 calls/12 hands); hand duration median ~6.5s, outliers ~30s → 100-hand session ≈ 25–40 min; 0 API errors/fallbacks; cap+recap fired cleanly. Builder found+fixed a real wedge: engine rejecting both model action AND safe fallback left a frozen 'playing' table forever (the old 60s reaper was disabled for autonomous tables) → SESSION_STALL_MS watchdog (120s default, scales with HAND_PAUSE_MS), E2E now wedges a real table and asserts reaping. COST FLAG: prompt cache cold on every call (system prompt below Haiku cacheable minimum) — now matters more since unattended tables burn continuously; candidate fix (pad/restructure briefing static prefix above cache minimum) queued for a perf pass. smoke-agent-profile needs a key (pre-existing, unrelated).

---

## AGE-40 A/B: the backwards read, fixed (2026-08-30, TAG vs Calling Station)

The Tree-3 TODO ("A/B with --no-reads to isolate whether reads help or hurt
TAG") is closed. Reads were HURTING, and the cause was the briefing text, not
the stats.

The old OPPONENT READ line was a bare stat dump. Every number in it was true
and the whole line read as menace to the model: "goes to showdown 71%" means
he keeps showing up with hands, so be careful; "folds to raises 6%" means
raising is futile, so stop raising. Against a player who never folds both
conclusions are backwards. src/agent/reads.js now classifies the opponent and
states the counter-strategy outright (EXPLOIT line), and every stat is phrased
so its implication points at action rather than caution.

All runs: 150 pairs (300 hands), TAG vs Calling Station, live claude-haiku-4-5.

| Condition | bb/100 | CI95 | VPIP | AF | fold% | decisions | checks | calls | folds |
|---|---|---|---|---|---|---|---|---|---|
| reads OFF (control) | **+170.9** | ±136 | 21 | 7.0 | 20.2 | 787 | 331 | 37 | 159 |
| reads ON — old briefing (from the 50-pair A/B) | +57 | — | — | — | 57 | — | — | — | — |
| reads ON — v2 bounded | +61.6 | ±149 | 24 | 21.2 | 43.2 | 509 | 45 | 11 | 220 |
| reads ON — **v3 shipped** | **+126.1** | ±199 | 32.2 | 6.8 | **19.4** | 742 | 231 | 47 | 144 |

Reads:
- **The inversion is fixed.** Fold rate 57% → 19.4%, against a reads-off
  control of 20.2%. AF 6.8 vs 7.0, decisions 742 vs 787 — with reads on, TAG
  now plays hands to the same depth it does with reads off, which is where the
  money against a station comes from.
- **bb/100 is now statistically indistinguishable from the control**
  (+126 ±199 vs +171 ±136 — heavily overlapping). What can be claimed is that
  reads no longer COST ~110 bb/100. What cannot yet be claimed is that they
  help. That needs the 200+ pair acceptance run already on the queue; at 300
  hands per arm the CIs are far too wide for a 45-point difference.
- **Do not trust 50-pair arena results for this matchup.** The same v2 code
  measured -11 at 50 pairs on one run and +176.65 on another; the 150-pair
  number for it was +61.6. The behavioural columns (VPIP/AF/fold%/decisions,
  n≈500-800 decisions) are far more reliable than bb/100 and are what
  diagnosed every iteration here.
- **Residual: VPIP 32.2 vs 21 on the control.** The "RANGE line still governs
  preflop" clause reduced the range widening but has not eliminated it — the
  EXPLOIT directive still outranks the RANGE line preflop in the model's
  reading. Next lever if this matchup is revisited.
- Writing exploit directives is a tuning problem with real failure modes on
  BOTH sides. Each over-correction produced a distinct pathology: v1's
  unbounded "bigger, don't tighten, every street" gave VPIP 39 / AF 77.5 and
  155 bets-raises against 2 calls; v2 fixed the range but collapsed checking
  (331 → 45) so the model folded what it should have checked down. The lesson
  is that an instruction must say where it does NOT apply, or the model
  applies it everywhere.

## CACHE-1 verdict (2026-08-30): prompt caching NOT viable on Haiku 4.5 — closed
cache_control was already correctly set; the blocker is Haiku 4.5's 4096-token minimum cacheable prefix (highest of any current model; Opus 5 is 512, Sonnet 5 is 1024). Our static prefix is 235 tokens — 17x below the floor — and padding to 4096 costs more than it saves. Verdict: accept cold cache on Haiku; revisit only if (a) the static prefix organically grows past ~4k (e.g. richer strategy/memory text), or (b) decisions move to a model with a lower floor. Branch feature/prompt-cache holds the measurement; not merged.
