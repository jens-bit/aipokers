# Astra — THE SHOW, 12 September 2026

Run began 12:28 UTC (14:28 Malta). Stop after SHOW-4 or 18:28 UTC, whichever comes first. No fifth job. Jens pushes; no push, VPS access, env-file changes, key operations or model calls in this run.

## Workspace handoff

The shared project folder was on another builder's `fix/guest-cap` with ten pending paths. Those files and that branch were left intact. This run uses `C:/Projects/ai-poker/artifacts/worktrees/astra-show`: main was clean at `348307d`; `git pull --ff-only` said already up to date. Integration and local main live here until the shared branch is handed over. Never switch the shared folder underneath its pending work.

No earlier ASTRA_NIGHT.md existed. HOW_WE_WORK v4 read. Goal-specific gate/pair limits override older broad inventory instructions. Pair count: 0/3.

## SHOW-1 — verified locally

The login's empty-seat illustration and the welcome's static hero are replaced by a labelled local heads-up demo. It opens on the flop, moves bets/chips, reveals showdown, pays the winner and deals another hand. Two scripted hands alternate winners. Existing card/character/chip atoms; no requests or model calls from the demo. Pause control and reduced-motion styles. Guest draft and Telegram login behavior retained.

Focused tests: 30 passed. New demo test first failed because the module was absent, then passed. Two older illustration assertions deliberately follow the requested live demo; login/auth and real-room assertions remain. Four built-browser checks passed: 390×844, 390×590, 1440×900 welcome, and phone login. Root inspected the screenshots and fixed hand/caption overlap. This is the founder-requested change from the static marketing reference, not a claim that the old static frame matches.

`npm run test:all` ran once. Server stage passed. Client stage: 202 files passed, one App round-trip test timed out (2569 passed, one failed, two todo). That unchanged test passed alone in 4.05 s; the affected full client stage passed with two workers: 203 files, 2570 tests, two existing todo (237.22 s), without changing assertions. The unreached gameplay stage was run separately: 7 passed. No Node native abort occurred. Build passed; Watch remains eager.

Resume from: SHOW-1 gates are complete; record its local merge, then SHOW-2 floor animation and public state. SHOW-2 server support is isolated in codex/show-2-server. SHOW-3 premise check: HAND-1/heroHand is absent on current main; reuse existing server evaluator and English hand naming, never add a second evaluator. SHOW-4 remains queued.

SHOW-1 source commit: e5ec57d. Local main merge: d407ede. All three test stages and four built-browser checks complete; no push. Resume from: SHOW-2.

## SHOW-2 — verified locally

Branch codex/show-2 starts from local main789b018. Reviewed server support checkpoint d7c8b342a03c10a1aee7c6d76526c54faacea0d4 applied without committing separately. The real floor now draws public community cards, dealt backs, actual accepted chip pushes and four-second public chat bubbles. Names/cards/reasoning from owner whispers never enter the new floor record. Bubble text is at most two lines, including a280-character single word; pointer-transparent, no blocked table tap. Action keys preserve existing cards and avoid replaying the same push on unrelated snapshots.

Existing ticker backfill now asks for the last20 events on first open; reconnect keeps its cursor. An empty server ring remains honestly empty. Watched automatic result pauses cap at3seconds, including an old explicit8second setting, after staged runout; unwatched cost throttling and deliberate manual dealing stay intact.

Focused support gates:84 server and14 normalization assertions. UI/event gates52 assertions. The two UI regressions were red first. Built phone floor test passes: real wire fixture updates, first-card identity, chips, bubble expiry, long-message bounds, event limit, click through to Watch. Root inspected artifacts/show/floor-phone.png. No floor design pair; pair count still0/3.

`npm run test:all` ran once. It found two old tests explicitly expecting8seconds when a spectator arrives (table.route.test.js and verify-cost-router.js). Their exact expectation is deliberately3seconds now, because SHOW-2 changes that product rule; no assertion weakened. The remaining server suites passed. The two affected scripts passed via isolated runScript (24 route checks and39 verifier checks). The unreached client stage passed:205 files,2574 tests,two existing todo. Gameplay passed all7 checks (78.44 s). The final built-phone check including long-message bounds passed again. Logs artifacts/show/show-2-*.log. No native abort. Resume from: record the SHOW-2 local merge, then SHOW-3 commentary.

SHOW-2 source commit: d8ce90e. Local main merge: 7db96ae. Completed server gate with the two requested tempo assertions corrected, 2574 client passes/two todo,7 gameplay passes,final built phone floor check. Resume from: SHOW-3.

## SHOW-3 — integrated, final gate running

Branch codex/show-3 from main8569ecf; reviewed server checkpoint16bb37b applied without a separate integration commit. ActionNarrator is under the felt on phone, desktop and public Watch. Pre-action labels use the existing server cardPhrase/evaluate/plainHandName; public cameras and other owners receive null. Labels are bound to accepted action, hand and player identity and cleared for a new deal/replacement. A staged all-in cannot announce its result before the last visible card. Watch stays eager.

Four built-browser checks passed (owner/public at390x590 and1440x900). Root inspected the short-phone owner and desktop public screenshots; caption clears the felt and Whisper. Focused client156 passed; server nine new regressions red then green and71 adjacent passes. The new caption regression found and fixes two older handResult naming errors: board-only evaluation overwrote an unrevealed canonical server hand, and a label already beginning with an article got a second one. No evaluator or model added. Pair count remains0/3.

Resume from: SHOW-3 test:all is running once, logged to artifacts/show/show-3-test-all.log. Record final gates and local merge, then SHOW-4 only.

SHOW-3 final gate: test:all passed on its single run. Server132 passes/two skips (134 total), client206 files/2579 tests/two todo, gameplay7 passed (91.44s). Four built-browser checks and focused gates above are green. No native abort. Resume from: record SHOW-3 merge, then SHOW-4 celebration; only two reference captures requested, no pairs yet.

SHOW-3 source commit:6e6d998. Local main merge:6383c4c. All three full stages and four touched-screen browser cases passed. Resume from: SHOW-4, final job.

## Revised run — Home first

Goal file de1066ef-0206-482a-a12e-84c16c2b2e60/goal-objective.md read and accepted at13:26UTC. Original start12:28UTC and deadline18:28UTC retained; clock is not reset. Four revised jobs: HOME-1 composition, HOME-2 truthful room behaviour, HOME-3 existing journeys, then preserved SHOW-4. Pair budget0/3, prioritising one Home pair and two celebration pairs. SHOW-4 WIP checkpoint7a67267 is saved oncodex/show-4 and not merged; reviewed audio275419a is inside that checkpoint. Main9f781ed pulled --ff-only, already up to date. Other builder's dirtyfix/guest-cap checkout untouched.

Resume from: HOME-1 oncodex/home-1. Capture current Home states before editing and inspect against current named reference. HOME-2 and HOME-3 independent read-only audits underway.

### HOME-1 candidate

Current built Home inspected in six states/viewports before edits. Concrete differences: fixed612pxbackdrop inside720pxstage left a seam, current reference uses full height with612minimum; quiet roster stayedfilled/gold; every seated agent was50pxinstead of near50/others44; phonecards were larger than currentwave57source. Ported full-height background without moving authored furniture; shortphones retain readable widths and roomscroll. Roster usesquietoutline/unreadgold, standing sleep42andseated50/44. Reviewed cardcheckpointc28ac6b retainspublic-only roomcards/desktop20x28. Three builtregressionsfailedbeforecorrection; six builtchecks thenpassed. One extra shortscroll/roster-colorcheck pending finalbrowserpass.

F10comparisonreference captured alonebyagent; pairnotyetcreated. F10itselfdoesnotdrawthetableellipse; retainedbyfounderoverride. F05replaytriggerandC7bcouch/TVremainreferencegaps; nofakeactivityorfixturemovement. FridgefetchstateisunderHOME-2audit. Resume from: completeHOME-1namedpairandfullgate, thenmergebeforeHOME-2.

HOME-1 final: single test:all passed (132server/two skips;207client files/2585passes/two todo;7gameplay,112.59s). The named F10 pair then exposed missing decorative spade marks and missing empty hooks with all four home; ported only Home marked backs and3minusaway phonehooks, preserving Watch and desktop board geometry. New card test retains private-card exclusion and verifies the decorative mark;100 affected Home/Card/Wall tests passed. Finalbuilt7Homecasespassed including shortTVscroll, rosterquiet/newscolor, emptyroom, desktop andnativeF10room. Rootinspected artifacts/show/home-1-F10-pair.png (1/3pairs). Current fixture differs in actualwallet/TVcontents/identity/resources; founder-retainedtableellipse and missingfridgefetchstate are labelled. FullheightreferencekeepsTVfixed; no furniture rearrangement.

Candidateb78856b plusfinalport/documentationcommit follow. Resume from: mergeHOME-1locally, thenHOME-2. UI supportf57af25 andserver support are isolated; HOME-3Profilef755567 is queued. SHOW-4WIP7a67267 remainsunmerged.

HOME-1 source checkpoints:b78856b and244db7f. Localmainmerge:f840004. Gatesabovecomplete; nothingpushed. Resume from: HOME-2 (truthfulroombehaviour). Deadline18:28UTC unchanged;1/3pairsused.


### HOME-2 — unfinished integration checkpoint

The revised goal file f342c9a1-8428-483c-9dad-119c6ce909cc was read. It retains Home first and adds an explicit limit of one full browser suite and one test:all per job; focused checks remain scoped to specific fixes. Original deadline 18:28 UTC retained.

Reviewed and applied support f57af25 (recap display memory, per-speaker TV clearance, distinct idle phases) and be52a0b (eight existing greeting voices and accepted owner-Home-only item events). Support gates: 138 client and 100 server checks passed in their isolated worktrees, including new regressions red then green. Root's built Home checks show eight residents/visitors occupying separate resting positions on phone and desktop, and stable independent idle phases. The recap remount check initially sent its push before the replacement socket opened; it now waits for the actual floor subscription and passes, including a genuinely new recap. No product workaround was made for that fixture error.

Root inspected both room captures. At most one occupant takes the TV destination even in the deliberately stale eight-student fixture. The fridge walk is still being implemented from successful accepted item events; this checkpoint is not a verified job and is not merged. HOME-3 journey work is isolated and queued. SHOW-4 WIP remains saved. No full HOME-2 gate has run yet.

Resume from: complete the real-event fridge choreography, verify its affected phone/desktop path, then run the single HOME-2 full gate and merge only if green. Pair count 1/3; no new pair created.


HOME-2 candidate: reviewed fridge checkpoint 3a9794a applied. The first typed owner homeItem snapshot is a baseline; only subsequent accepted beer/snack events walk. Server timestamps are compared to server timestamps, so skewed phone clocks work. One trip uses the existing 1.6-second room crossing for out, hold and return; the reference supplies poses and props, not these durations. Neighbours and actual game chairs remain reserved, blocked trips expire after 15 seconds, and carrying/leaving/joining a hand cancels the trip. No new inventory or model path.

Fridge support passed 190 focused tests across nine files, including ten named regressions red first, real Home socket wiring and long-press cancellation. Root's two built checks passed: accepted snack on phone and beer on desktop, a deliberately two-minute-ahead server clock, unchanged neighbours/chairs, exact return position, and no replay on a repeated snapshot. Root inspected both captures and refreshed the SAME named F10 pair; still 1/3 unique pairs. The missing fridge pose is now present; differences in actual wallet, identity, bars and TV history remain labelled. Home table retained by founder instruction.

Resume from: run the single HOME-2 test:all on this candidate, record gates and merge locally if green. HOME-3 source f755567 +44d757a is reviewed and queued. SHOW-4 fixes are isolated. Nothing pushed or deployed.


HOME-2 final gate on candidate139919e: test:all passed on its single run. Server134 passed/two skips (136 total), client210 files/2615 passed/two existing todo, gameplay7 passed (87.60s). No native abort. Six affected built cases passed as recorded above. No full browser inventory was run. Root inspected the same F10 pair and phone/desktop room/fridge captures. Reviewed support checkpoints f57af25, be52a0b and3a9794a; integration checkpoints1d70df5 and139919e. Updated DESIGN_GAP.md explicitly keeps Home as the app default and floor-first only inside Casino.

Resume from: record HOME-2 local merge, then HOME-3 using reviewed f755567,44d757a and scoped built journey checks c8dbf08,f58c236. SHOW-4 remains preserved and queued. Deadline18:28UTC; pair count1/3. Nothing pushed.

HOME-2 local main merge: ed23d9a. Final gates recorded above. Resume from: HOME-3.


### HOME-3 — candidate, scoped browser checks passed

Branch codex/home-3 from main6aa8c28. Reviewed checkpoints f755567 and44d757a hydrate owner-scoped full Profile detail, preserve unsent Chat drafts by owner/agent, keep the original Chat return through Profile/Watch, and retain Casino room/view through Watch. Session exits now say Back home; Watch stays eager and its game composition is unchanged. A full profile request replaces the earlier attrLog-only read, preserves cached readings while pending/failed, and rejects late/wrong-agent responses.

Support gates:108 profile/App checks, then192 affected journey and adjacent checks, with the named failures observed before repair. Test-only c8dbf08 andf58c236 add six built journeys. All six passed on the first built run: short-phone roster/Chat/Profile/stats/drafts, delayed roster detail hydration, public home Watch and actual YOU cards/check action/return, twice-returned Upstairs plus nested Profile CHAT, desktop Upstairs Watch/return/Home, and returning guest Home with no guest mint. Expected credentialed reads and actual watch/join/action wire messages are asserted; no model or live server calls.

Root inspected populated Profile, the short-phone YOU hand, returned Upstairs, and desktop Watch captures. Pair count remains1/3; journeys require no new reference pair. No full HOME-3 gate has run yet.

Resume from: run single HOME-3 test:all, record gates and merge locally if green. Then fourth/final job only: saved SHOW-4WIP7a67267 plus reviewed364dcbe and673368a. The fourth job still needs root browser checks, two named pairs and its full gate. Deadline18:28UTC unchanged. Nothing pushed or deployed.


HOME-3 final gate on f0dc718: single test:all passed. Server134 passed/two skips, client2634 passed/two existing todo, gameplay7 passed (89.51s). All six affected built journeys passed on their first run; no new comparison pair or native abort. Root inspected the phone Profile, human hand, Upstairs return and desktop Watch. Source/support hashes and actual paths are above.

Resume from: record HOME-3 local merge, then finish the fourth job only: SHOW-4. Existing candidate and reviewed followups remain on their isolated branches. No fifth job; original18:28UTC deadline retained. Nothing pushed.
