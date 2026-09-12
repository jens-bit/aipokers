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
