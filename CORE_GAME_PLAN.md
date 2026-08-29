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
