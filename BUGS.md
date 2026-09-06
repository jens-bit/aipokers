# Bug Report — Agentic Poker
Last updated: 2026-09-06 (TEST) — 7 open, 30 resolved


---

## OPEN

### BUG-37 — The felt formats a stack with `toLocaleString`, not the wallet's own formatter
**Severity:** Low (two spellings of the same number, in the same screen)
**Where:** `client/src/components/desktop/DeskTableStage.jsx:170` and `:236`, `client/src/components/desktop/GameTile.jsx:59` and `:81`, `client/src/components/floor/atoms.jsx:123`, `client/src/components/PlayerSeat.jsx:90`
**What:** `client/src/lib/wallet.js` exports `money()` and every money surface goes through it — that is why a pocket and a ledger agree on how a number looks. The felt does not: it calls `(stack ?? 0).toLocaleString()` directly in six places, so a stack is spelled by the browser's locale while the wallet beside it is spelled by ours.
**Found by:** the WATCH report, on the hero stack.
**Fix:** route them through `money()`. Check first whether the felt wants the currency mark at all — if it deliberately does not, the answer is an option on `money()` rather than six call sites that opted out of it.

---

### BUG-36 — `table.seats.test.js` intermittently fails on "blinds moved some chips"
**Severity:** Medium (BUG-34's family — a fast-suite failure that a re-run makes go away)
**Where:** `src/server/table.seats.test.js`
**What:** Fails inside a full `npm run test:all`, passes on its own and on a re-run. Seen once in this session's integration runs; the suite passed 14/14 immediately afterwards, and three consecutive `npm test` runs were clean.
**Found by:** the WATCH report, and independently by the integrator during the COST-1 merge.
**Fix:** unknown. `scripts/stress-suites.js` (BUG-34) is the tool — run this suite under it rather than guessing. Note BUG-34 ruled out the obvious shared-resource causes, so a timing assumption inside the test is the likelier answer.

---

### BUG-34 — `test:all` dies intermittently on Windows
**Severity:** Medium (a flaky suite teaches people to re-run instead of to look — the testing law's own words)
**Where:** the test harness, not the product. `src/server/tapeRoom.test.js`, `scripts/verify-pace.js`, and something not yet found.
**Reported:** roughly one full `npm run test:all` in five came back red on Windows, two ways: a spawned suite exiting **3221226505** (`STATUS_STACK_BUFFER_OVERRUN` — a native abort, not an assertion), or `scripts/verify-pace.js` failing `every snapshot of a live hand carries it — 1 without`. Reproduced on unmodified main.

**Tooling:** `node scripts/stress-suites.js [rounds] [concurrency]` runs everything `npm test` spawns — every `src/**/*.test.js` and the fast `scripts/verify-*.js` group — through the same `runScript` helper, in a loop, recording every non-zero exit with the child's own output. One run in five is too slow a signal to debug against; this turns it into minutes.

#### Found and fixed: `verify-pace.js` "1 without"
Not a race in the server. `_heroEquityFor` returns null for a **folded** seat on purpose — a man who folded has no equity in the pot — and the check filtered snapshots only on `street !== 'waiting'`, which includes `complete`. So it asserted a rule the product has never held: the snapshot after the hero folds legitimately carries no number.

Whether it fired was pure timing. With no model behind him the hero check/folds, and his 800ms think delay normally put that fold after the script's 700ms sample window; under the e2e group's `concurrency: 2` the sleep overran and the post-fold snapshot landed inside the sample. Nothing about the server differed between a green run and a red one. Reproduced deterministically with `THINK_MIN_MS=50 THINK_SPREAD_MS=50`, which puts the fold inside the window every time.

Fixed by asserting what the rule actually is — *every snapshot of a hand he is still in* carries equity — plus the complementary half, that a seat which folded reports `null` rather than a stale number, so excluding those snapshots does not quietly stop asserting anything about them. (A second bug fell out: `heroSeat` had to come from `watching.msg.spectatorSeat`; `waitFor` resolves the log entry, not the message.)

#### Found and fixed: `tapeRoom.test.js` — a 60ms window the suite's own round trip outruns
Found by the stress harness: 1 failure in 590 spawned runs at concurrency 4, then reproduced at 1 in 64 running that suite alone 8-wide.

`HOME_STUDY_MS` was set to **60ms** for the test, and sixty milliseconds is shorter than this suite's own HTTP round trip on a loaded machine. "A second request is refused rather than stacking another ninety seconds" only holds while the first study is still running; on a busy box the window closed between the two POSTs and the second request was **accepted**. The assertion lost a race it was never about.

The damage was the cascade. That test aborts at the failed assertion, leaving a **live** study on the record, and the next two tests then came back `409 He is already watching one` — from assertions about a missing `handId` and about filing a second line, neither of which has anything to do with a study being in progress. Three red tests, one cause, and nothing in the output connecting them, because the route has three different 409s and the status alone does not say which.

Fixed three ways: the window is 2s, which cannot lose to a localhost round trip; a `beforeEach` empties the tape room so no test can inherit another's live study; and every 409 assertion now prints the body, so a refusal can be told from another refusal. The second-line test no longer sleeps the window out at all — it ends the study through `finishStudy`, the documented early-finish path, because what it is about is the line and not the clock. 240 runs 8-wide green after (it failed at 64 before).

#### NOT reproduced: the 3221226505 native abort
Still open. It did not appear once in:
- **1,768 spawned suite runs** through `scripts/stress-suites.js` — 588 at concurrency 4, 294 at concurrency 8, 590 + 296 covering the verify group too
- **14** `npm test` runs, **12** `npm run test:e2e` runs, **12** `npm run test:client` runs

What that rules out, or at least makes unlikely:
- **Parallel access to one SQLite file.** There is none to have. `runScript` gives every spawned suite its own `mkdtemp` cwd, and `store.js` resolves `data/app.db` from `process.cwd()`, so no two suites can open the same database. The suites that `chdir` isolate themselves a second time on top of that.
- **`legacy.test.js` `concurrency: 4` against native teardown.** 588 runs at 4 and 294 at 8 produced no native exit at all.
- **Port collisions between parallel servers.** Every e2e script listens on port 0.
- **A vitest worker dying** (`test:all` runs the client suite too): 12 clean runs, 105 files each.

Next time it happens, run `node scripts/stress-suites.js 40 8` and keep the child output it prints — the exit code plus the last 40 lines of the suite that died is the thing this entry is missing.

### BUG-20 — Dead 14px input rule waiting to be reused
**Severity:** Low (latent — nothing renders it today)
**Where:** client/src/styles/layout.css — `.dr-form-field input { font-size: 14px }`
**What:** The rule is live in the shipped bundle and is not behind a media query, but no JSX in client/src applies the `dr-form-field` class — it is left over from a form that was removed. So nothing can focus a 14px field right now. The moment anyone reuses the class they inherit a BUG-02 iOS auto-zoom.
**Found by:** TEST-3 stylesheet audit. `it.todo('BUG-20: …')` in client/src/test/bug02.test.jsx, with the selector held in a named KNOWN_DEAD set rather than filtered silently.
**Fix:** Delete the rule, or raise it to 16px if the class is coming back. Then un-todo the test and drop the KNOWN_DEAD entry.

---

### BUG-29 — Landing page scrolls sideways at ≤768
**Severity:** Medium (first screen a stranger sees)
**Where:** the marketing landing / hero scene (`client/` welcome page, `.hero-*` rules)
**What:** Reported from the 0.10.0 pass: horizontal overflow on the landing page at viewport widths of 768 and below — the document scrolls sideways.
**Not caused by LAND-3, and not fixed by it.** LAND-3 (`5321886`, the design-40 sheen and card-fan port) verified `document.scrollWidth` byte-identical before and after at 1440 / 1280 / 768 / 390 / 375, so whatever overflows was already overflowing and the hero port neither introduced nor removed it. The mobile mascot centring fix in that commit (`.hero-copy` width 100% at ≤430) is adjacent but is a different symptom.
**Fix:** find the element wider than its column at 768 — measure with Playwright rather than by reading CSS, since LAND-3's scrollWidth check is the harness that already exists — then cap it and add the width to that check so the page cannot regress silently.

---

### BUG-30 — Haptics: soft-vs-light and reveal-vs-pot are unresolved design calls
**Severity:** Low (feel, not function)
**Where:** `client/src/lib/haptics.js`, `client/src/screens/WatchScreen.jsx` — the `heroCardWarms`, `showdownReveal` and pot rows
**What:** Two decisions CLEAN-1 made in order to ship, both flagged at the time rather than settled:
1. **soft vs light.** design-refs HAPTIC4 gives the card warm and the showdown reveal as `soft`; the brief for the CLEAN-1 pass asked for light / light / medium, which is what shipped. The two sources disagree and the code follows the brief.
2. **reveal vs pot.** The showdown reveal and the pot settling arrive in the same commit, and the 120ms floor only lets one through. The pot wins, because "losing is quiet" is the older law, and the reveal takes HAPTIC4's own 140ms interval behind it — the one number in that table set above the floor. Whether the reveal should instead be the one that lands is not settled.
**Fix:** a design call from the mood/haptics wave, not a code fix. Whichever way it goes, `haptics.test.jsx`'s ordered call list is where it gets pinned.

---

### BUG-31 — The prediction beat has no home in watch v4
**Severity:** Low (shipped dark; nothing renders it for a normal user)
**Where:** `client/src/components/system/PredictBeat.jsx`, `client/src/lib/predict.js` (flag `ap_predict`), rendered from `WatchScreen`
**What:** W3-4 shipped the prediction beat inside the READ tab, behind a localStorage flag and off by default, deliberately, "because this is the one part of the wave that could turn a manager game into a clicker". W4-2 then deleted the READ tab — a read is about one person, so it became a sheet on a seat tap. The beat was re-homed into the panel rather than lost, but watch v4 gives it no place of its own and the design refs do not assign it one. It is live code behind a flag with no designed home.
**Fix:** a product decision, not a bug fix — give it a home in v4/v5 (its own slot, or a gesture), or delete the module and the flag. Leaving flagged-off code with no owner is how BUG-20 happened.

---

## RESOLVED — kept here for traceability

### BUG-35 — `verify-watch-v2.js` "HIS reasoning" fails roughly one run in three — RESOLVED 2026-09-06 (TEST)
Not a race in the product: a race in the suite. The five WATCH-9 push checks read `of(ServerMsg.THREAD_LINE)` — a snapshot of the socket buffer taken at whatever instant execution reached that line. Under load the hero's session had played about five hands by then and the HIM line, which is written per DECISION rather than per hand, had not landed yet. The wire worked; the sample was early.

Fixed by waiting rather than sampling, with the file's own `waitFor`, the way the WATCHING check at the top of the same section already did. A HIM line is the right thing to hold for because it is the last of the four kinds to appear — the room talks before he has decided anything — so once it is in, all five checks read a settled buffer. No assertion was weakened; the same five still run, on a buffer that is allowed to fill.

No model needed: every decision carrying reasoning writes a HIM line (`table.js`, `_threadTo` on `ThreadKind.HIM`), and the no-key path returns "no API key configured — defaulting to a safe action" as its reasoning, so the deterministic fallback already exercises this wire. Nothing in the fallback had to change.

**Proof:** 10 consecutive runs green with a full `npm run test:e2e` running concurrently, every one reaching ALL CHECKS PASSED. In a first attempt under two concurrent suites the assertion never failed either — the three reds there were the machine killing processes outright (truncated logs, no assertion output, and the two load generators died at discovery as well), which is BUG-34's territory, not this one.

---

### BUG-38 — `verify-home-routes.js` points at a script that does not exist — RESOLVED 2026-09-06 (CI)
Fixed while chasing the CI red it sat next to. Three scripts said ``run `npm run build` first`` and there is no root `build` script; all three now say `build:client`. The CI failure itself was the other half of the same file: verify-home-routes.js EXITS 1 on a missing dist where verify-cache-headers and verify-deeplink-routes skip, so it was red on CI (which runs `npm test` before any client build) and green on any laptop with a dist lying around. It is now in NEEDS_CLIENT_DIST with the other two.

---

### BUG-33 — The client's ServerMsg had no PACE or READ key, so neither frame was ever handled — RESOLVED 2026-09-06
**Where:** `client/src/lib/protocol.js`, `client/src/hooks/useTable.js`
**What:** `client/src/lib/protocol.js` mirrors `src/server/protocol.js` and had been missing two of its entries for as long as it has existed. `ServerMsg.PACE` and `ServerMsg.READ` were both `undefined`, which made `case ServerMsg.PACE:` in useTable a case on `undefined` — a branch nothing arriving from the server could ever reach. The server has staged the all-in runout card by card since PACE-1 and pushed a READ the moment an opponent read forms; no client had ever handled either.

The visible symptom was subtle rather than broken, which is why it survived: `pace`, `potBb` and `reads` all ride the STATE snapshot too, so the felt was never blank. It just ran its OWN clock for the showdown runout (`WatchScreen`'s `flipped` interval, the fallback for "the server is not driving"), so PACE-1's whole point — every watcher turns the same card at the same moment — was never true, and the read panel only ever updated on the next snapshot rather than on the beat the read formed.

**Why the tests were green:** `useTable.test.jsx` emitted `{ type: ServerMsg.PACE }` and useTable matched `case ServerMsg.PACE:`. Both sides were `undefined`, so the six W3-6 tests passed against a message the real server has never been able to deliver — a suite that emits the client's own constant tests the client against itself. `protocol.test.jsx` pinned ServerMsg with `toEqual`, so it asserted the two keys' *absence*.

**Fix:** the suites were re-pinned first and watched go red (6 failures). `useTable.test.jsx` now emits a local `WIRE` table of the literal strings `src/server/protocol.js` sends, never `ServerMsg.<KEY>`, and one test walks that table asserting `ServerMsg[key] === wire` — the guard that would have caught this. `protocol.test.jsx` gained both keys. `PACE: 'pace'` and `READ: 'read'` were added to the client mirror; the PACE handler came alive unchanged, and a READ handler was written to match it (merged onto `game.reads`, which is what `WatchScreen.pickOpponent` reads, and exposed as `reads`; kept across hands, unlike `paceFrame`, because a read is accumulated knowledge and not a per-hand frame; a malformed push is ignored rather than allowed to blank the panel).
**Test:** 11 tests in `client/src/hooks/useTable.test.jsx` (6 re-pinned, 5 new) plus `protocol.test.jsx`. End to end, `scripts/verify-pace.js` now asserts the literals on the wire itself — "the staged runout is typed `pace` on the wire", "the read arrives as its own push, not only on a snapshot", "it is typed `read` on the wire" — so the mirror and the server cannot drift apart again without a red run.

---

### BUG-32 — The newborn does not walk into the room — RESOLVED 2026-09-06 (BIRTH-5)
Fixed the other way round from the one the entry proposed, and deliberately. The suggestion was to pass the newborn id down from App the way FLOOR-2 did (`newbornId={newlyBornAgent?.id}`); what shipped is a marker on HOME_STATE — `newborn`, computed on the SERVER's clock inside a 60s window (src/server/home.js), with `bornAt` alongside it for a client on an older server. A prop from the shell only works in the session that saw the birth, from the surface that saw it; the marker survives a reload, works on the desk as well as the phone, and cannot go out of step with the roster the room is drawn from. `useBirthWalk` in HomeScreen pins him at DOOR_SPOT for one beat as `door:born` — a place of its own, never confused with the `door:away` of an agent out at the casino — and releases him, so the existing `useWalks` crosses him to his chair with no second animation and no special case. `it('BUG-32 WIRE-1: and tells the room which agent was just born')` in client/src/App.test.jsx is un-todo'd and asserts the RULE (the room is told) rather than the mechanism.

### BUG-21 — Replay stopped after the opening beat — RESOLVED 2026-09-05
**Where:** `client/src/components/replay/ReplayTheatre.jsx`
Found in the mobile playtest, fixed in FIX-4 (`0d58ca8`). `.replay-theatre__stage` has no height of its own — its only child is the felt, and the felt's height IS 306/639 of whatever the ResizeObserver watching that stage reports. Every notification therefore handed back 48% of the last one, so the felt collapsed to nothing within half a second and took the board and the reveal with it. The theatre's own box is the viewport's, so that is what is measured now, with the header subtracted. Two hardenings alongside: the reel's interval no longer depends on `timeline.total` (read off an object every caller rebuilds each render), and the scrubber's controlled range input is handed a value already on its own step grid, so the DOM and React cannot disagree about where the reel is and the control cannot echo a seek back and pause it.
**Test:** FIX-4 cases in `ReplayTheatre.test.jsx` — a six-beat replay plays to the end under a browser-shaped ResizeObserver, and the felt keeps its height. Watched failing on the pre-fix tree.

### BUG-22 — Watch header rendered 45px against a 40px budget — RESOLVED 2026-09-05
**Where:** `client/src/screens/WatchScreen.jsx` / `.watch-screen__back`
FIX-4 (`0d58ca8`). `base.css` floors every `<button>` at `--tap` (44px), and a flex item's automatic minimum size is content-based, so that floor beat the row's declared height and the extra 5px came off the felt. `.watch-screen__chat` had been released from the floor when FIX-3c wrote it; `.watch-screen__back` never was.
**Test:** `headerDensity.test.jsx`, which recomputes each row's box model from the styles React applied. Watched failing pre-fix.

### BUG-23 — With the sheet dragged down, CHAT selected a tab nobody could see — RESOLVED 2026-09-05
**Where:** `client/src/screens/WatchScreen.jsx`
FIX-4 (`0d58ca8`). With the sheet at the HIDDEN detent the header's CHAT button picked the TABLE tab and stopped, so the gesture did nothing visible. Where there is no thread to open it now does the whole gesture — pick the tab *and* bring the sheet back up. Composed with WATCH-5's `openChat(ctx)` in MERGE-2 (`bbf3391`): FIX-4's position and body, WATCH-5's context argument, `sheetApiRef` dropped because it only existed to bridge a hoisting problem the ordering solved.
**Test:** `watchChatLayout.test.jsx` — with no thread to open, the sheet comes back up on the TABLE tab; the ceremony tap opens the thread with the hand attached; the header button opens it with null and never a click event.

### BUG-24 — Speech bubble painted over the zoom's back control — RESOLVED 2026-09-05
**Where:** the floor zoom sheet
FIX-4 (`0d58ca8`). The bubble sits at z-index 5 from y=30 and the back control occupies y=10..44, so the bubble covered it. The control is raised above it; nothing moves, and only the bubble's rounded corner passes behind, since its text starts below y=44.
**Test:** new `FloorZoom.test.jsx`. Watched failing pre-fix.

### BUG-25 — Watch felt filled a wide window edge to edge — RESOLVED 2026-09-05
**Where:** the watch felt / seat ring
FIX-4 (`0d58ca8`). On a wide window the felt stretched the full width, which threw the seat ghosts into the far corners of a table nobody was sitting at. The felt is bounded to the ref's 720px and centred above 760px; the seat ring was always absolute inside the felt, so it follows for free.
**Test:** `desktopWidth.test.jsx`. Watched failing pre-fix.

### BUG-26 — Min-raise loop, again: +10 into a 400-chip pot until the stacks were in — RESOLVED 2026-09-05
**Severity:** Medium (gameplay quality; also inflates LLM cost and arena runtimes)
**Where:** `src/server/table.js` (`_raiseOffer`, `_buildAiGameState`, `_disciplineAction`), constants in `src/server/pace.js`
**Predecessor:** BUG-13, closed 2026-08-29 on the strength of Tree 2's sizing directives and the `RAISES THIS STREET: n` briefing line. Those were a *request* to the model, and the loop came back in tonight's playtest. Recorded as a fresh entry rather than reopening BUG-13, because the diagnosis changed: **a model offered "raise 10–1000" keeps taking the 10, so the table stops offering it.**
**Fix (RAISE-1, `f77d4f9`):**
(a) a raise is at least `max(min legal raise, currentBet + ⅓ pot)` and never above the jam — an agent who cannot afford the floor may still shove, because all-in is the one raise that is always big enough. Undersized raises are rounded up and logged `[agent] undersized raise → X`.
(b) at four aggressive actions the street is CAPPED and the only raise left is the jam: call, fold or all-in, exactly as a capped street works in a cardroom. That is what guarantees the round terminates.
One seam does both jobs — the offer is built once, put in the briefing, and enforced on the way back in; a floor that lived only in the prompt would be a suggestion, one that lived only in the enforcement would keep showing the agent a size the table intends to overwrite. The floor is a fraction of the POT, so it does not bite heads-up preflop where the engine's own minimum is already larger — which was never the case the playtest complained about.
**Dials:** `RAISE_MIN_POT_FRACTION` (default 1/3), `RAISE_CAP_PER_STREET` (default 4), both env-dialable in `src/server/pace.js`.
**Test:** `pace.test.js` (10 cases on the two dials) and `table.raise.test.js` (11 cases through a real Table, including a street of nothing but minimum raises now terminating).

### BUG-27 — The thread opened with a win/loss tally instead of his voice — RESOLVED 2026-09-05
**Where:** `client/src/hooks/useAgentThread.js` (`legacyOpener`), `src/server/agentProfiles.js`
The CHATS thread opened with "Hey — I just finished 20 hands. Won 12, lost 8. Want to review any hands or adjust my strategy?" — a form letter, identical whether he had run over the table or been coolered three times. MOOD-2c had already written the real opener (`formatOpener()` picks by heat band and names the one hand he cannot let go of, ≤15 words, no counts), and WIRE-1 had routed all three surfaces through one `openerFor()`; the tally survived as the fallback. RAISE-2 (`f77d4f9`) removed it from the codebase: `presentAgent` always computes an opener, `formatOpener` gained a nature-voiced greeting for the case with no session to recap, and the client fallback is now his own birth line then a short last-ditch sentence. There is no model call anywhere in this path — templates the whole way down, so there is nothing to fail into.
**Test rule change, per the testing law:** `wire1.test.jsx` asserted the tally as "the fallback for a record written before MOOD-2c". That rule is retired — the tally is never correct now — so those cases were INVERTED rather than relaxed: `openerFor` must not produce it for any input. Five other suites used `/Ready to play/` purely as a "thread has loaded" anchor and now anchor on the new opening line; no assertion in them was weakened.

### BUG-28 — `opener` was null on every session-end path but one — RESOLVED 2026-09-05
**Where:** `src/server/agentProfiles.js` — `finishAgentSession` vs `POST /api/agents/:id/finish`
The reason BUG-27 kept surfacing. `opener` was written on only ONE of the two session-end paths (`finishAgentSession`, not the route's own inline teardown), and there only inside `if (recap string)`. So every other way a thread opens — an agent still at a table, one who has never finished a session, any owner-initiated finish — served `opener: null` and the client filled the hole with the tally. Both paths persist an opener now, and `presentAgent` computes one regardless (`openerForAgent`). This is the same two-session-end-paths wart BIO-2b/2c/2d hit from the other side (roles were derived on one path only); the duplication predates both trees and is worth collapsing.
**Test:** `opener.test.js`, 8 cases, three of which were verified failing before the fix.



### BUG-10 — In-game header drops platform branding — RESOLVED (verified visually 2026-08-29: spade + branding present in watch header; fix commit c7be663 from May)
**Severity:** Medium (visual)
**Where:** client/src/components/Header.jsx — in-game variant (rich game-view header)
**What:** During play (vs-AI / vs-Human / Watch), only the rich in-game header shows (back arrow + avatar + name + status + settings gear). The "AGENTIC POKER" wordmark + spade logo + agents pill at the top of the app disappears. User notes this loses the platform identity during the most-shared moments.
**Fix:** Either add a thin top strip with logo + AGENTIC POKER above the rich header, or fold the spade logo into the rich header on the far left next to/replacing the back arrow.

### BUG-12 — DECISION broadcast leaks AI reasoning + equity to live opponents — RESOLVED (routing fixed; spectator scoping completed by BUG-15 fix in AGE-33)
**Severity:** High (game integrity)
**Where:** src/server/table.js `_maybeRunAiTurn` — `this._broadcast({ type: ServerMsg.DECISION, ... })`
**What:** The DECISION message (action, reasoning, and — since AGE-16 — equity and potOdds) is broadcast to every connection at the table, including a human playing AGAINST the AI. Reasoning can describe hand strength, and equity ~85% preflop effectively reveals AA/KK. Observed 2026-08-29 in vs-AI play: you see House's thoughts.
**Fix:** Route DECISION only to spectators whose agent it is (and into the stored hand review); never to opposing seats mid-hand. Fold into Tree 4 (UI surfacing) or fix standalone earlier.

### BUG-13 — Min-raise wars: 20–30 raise ping-pong before all-in — RESOLVED (Tree 2 sizing directives; confirmed gone in AGE-28 arena + prod playtest) — **RECURRED, see BUG-26**
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

### BUG-16 — Presence lies: agent shown seated/"playing" while his table is frozen — RESOLVED (Tree 4)
**Was:** Hands only advanced while a client had the table open. An agent showed presence=playing while nothing happened; opening WATCH woke the game. The pet only lived while stared at.
**Fixed by:** the server-side session loop (Tree 4) plus the AGE-37 presence law in `presentAgent` — presence is derived from a live table via `liveGameView`, never from the stored `status` flag.
**Evidence:** scripts/verify-server-life.js, green in `npm run test:e2e`, asserts in order: "3+ hands completed with no client connected"; "presence is playing while the loop runs"; "liveGame reports hands this session"; "table survives the watcher leaving"; "hands continue after disconnect"; "presence still playing after disconnect"; and on sit-out "presence flipped to resting" with "liveGame gone once resting". Client side, CasinoFloor.test.jsx pins that an agent with presence resting and no liveGame draws nothing live.

### BUG-17 — WATCH entry appears to start a NEW game rather than joining the running one — RESOLVED (Tree 4)
**Was:** Same root cause as BUG-16 — the viewer's arrival is what dealt the hand.
**Evidence:** scripts/verify-server-life.js connects a WebSocket mid-hand and asserts "caught the table mid-hand", "a STATE snapshot arrives on WATCH", "snapshot carries the hand in progress" (handNumber not reset), and "no extra seat was created by watching". Client side, CasinoFloor.test.jsx asserts WATCH on a live agent calls onWatch and issues no POST at all — the deploy path is the only one that queues a table.

### BUG-18 — Flagged hand review never showed the opponent's showdown cards — RESOLVED 2026-09-05
Found by TEST-1, fixed in commit bb5ea0b. The server records `opponentShowdownCards` on every flagged entry and the API returns it unscoped (showdown cards are public); the sheet dropped it. New `OpponentShowdownRow` in HandReview renders the cards and the seat that showed, and nothing at all when the pot was won without a showdown. Test un-todo'd and green.

### BUG-19 — /flagged fetch sent no credential, so the owner's own hole cards came back empty — RESOLVED 2026-09-05
Found while fixing BUG-18, fixed in the same commit. `holeCards` on GET /api/agents/:id/flagged are owner-gated by `isOwner()`, which reads `x-telegram-init-data`; FlaggedHandsSheet sent no headers, so in production the review rendered card backs where the agent's own hand belongs. Invisible on localhost, where no TELEGRAM_BOT_TOKEN is set and `isOwner()` defaults to true. (FLOOR-3 had added the header to the GET /api/agents calls; this endpoint was missed.)

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

