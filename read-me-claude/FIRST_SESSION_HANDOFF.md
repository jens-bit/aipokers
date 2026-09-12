# First-session playtest candidate

12 September 2026. [Approved mission](FIRST_SESSION_MISSION.md) · [Five-person playtest](FIRST_SESSION_PLAYTEST.md).

Current local status and the latest Watch/palette continuation are recorded in [Warm game and public Watch](WARM_GAME_HANDOFF.md). Jens's replacement of the separate practice flow is recorded in [In-game introduction](FIRST_RUN_GUIDE_HANDOFF.md). The candidate and integration history below describe earlier revisions; their separate-practice requirements are retired.

## Local status

Built on the other Astra's completed Home-first/SHOW main `67880fc`, in `artifacts/worktrees/first-session` on `codex/first-session`. The clean local main worktree at `artifacts/worktrees/astra-show` now contains onboarding/chat `5ac7558` and casino/room fixes `23424db`. The unrelated dirty root on `fix/guest-cap` is untouched. The candidate is verified locally. Nothing was pushed or deployed by this task.

## What changed

- **Meet and learn.** A completed draft publishes its resident immediately. Home accepts newcomers after empty snapshots and guards newer changes against stale REST. Desktop no longer presents two birth cards. Home offers optional practice with the saved agent appearance, actual-control pointers, manual progression, leave/resume and replay.
- **An honest practice hand.** Eight legal snapshots come from the real engine and reuse the existing felt. Hidden cards stay hidden until showdown; the lesson distinguishes the 28-chip pot from 14 chips of profit. It changes no wallet, career, live table or agent memory, and makes no model calls. Labelled guided questions lead to actual chat, replay, Home or deliberate casino entry.
- **Recoverable conversation.** Failed or malformed replies retain the draft and show application errors. Duplicate submits and stale conversation completions are guarded. Narrow movement requests explain real controls without claiming to move the agent. Wrapped stage directions are removed conservatively. Desktop Watch has Chat and Hand log; explicit nullable event categories hide routine actions/decisions while preserving results, costs, speech and unclassified history.
- **A ready opponent.** First casino WATCH seats one House and starts the server loop without depending on a viewer staying connected. A busted House is replaced after the shown result, keeping the owned session, winnings, hand numbering and existing hand cap. Other owners can join free chairs.
- **Truthful admission.** Failed fresh deployments return a retryable error and restore unspent pocket/wallet/drink state, without consuming a guest session or inventing a result. Explicit room choices keep separate pending matches, and leaving Watch returns to the actual deployed room.
- **Whereabouts agree.** The first matching owned table snapshot refreshes the desktop roster, fixing the pre-deal Home label. Older in-flight roster requests cannot undo the confirmed arrival, and subsequent hands do not add refreshes.

## Decisions and remaining limits

Home-first, kitchen table, four-stage draft, human play, artwork and Watch composition remain. Brighter guidance surfaces, arrows and manual lesson navigation are scoped departures from the old port-only rule; original references are untouched.

Guests still need sign-in for private chat. The lesson says this before the request and supports dismissing the sign-in offer. Jens's optional question about a small guest allowance remains open; access and ongoing model budgets were not changed.

**Normal live timing is unchanged.** A desktop delay was removed when review found raw thread results could overtake a delayed felt. Practice provides time to read; slower live desktop playback requires synchronizing its record too. Human action controls remain immediate.

An older all-in record-order issue remains: `_handCompleted` writes `_threadResult` before `_paceHold`, so a stored/pushed winner can precede the staged runout. This exists in the baseline and is not claimed fixed. The separate desktop whereabouts polling gap found in the final browser review is repaired in this candidate.

At 390×590 the felt is compact, longer instructions scroll, and navigation remains reachable. The initial Home offer can put the agent's usual position below the fold. Human readability and comprehension need the playtest.

## Actual validation

All runs used isolated local data and keyless/synthetic providers. No paid model tests, VPS access, env-file changes or key operations.

- Red-first engine, arrival and conversation regressions passed. House lifecycle: 10/10 plus existing loneliness, timing, reveal, seat and session checks. Admission: 11/11; focused wallet/ownership/guest/matchmaking gate: 194 passed.
- Full final server/queue source: `npm test` passed 140 harness cases, with two intentional live/data skips (23.1s). Gameplay `npm run test:e2e`: seven passed (93.7s). New queue cases passed 7/7; room-return client cases 8/8 plus 111 adjacent passes.
- Final full client: 220 files, 2722 passed, two existing todo, 251.9s with `npm test -- --maxWorkers=2 --minWorkers=1`. An earlier unbounded run under browser load hit 17 timeouts and a TV readiness race. Its helper now waits for the actual enabled control; no assertion or timeout was relaxed.
- Existing desktop coverage: 54/54 across initial and repaired affected runs; final eight affected casino/Watch/Home cases passed again (22.2s). Two initial retirement geometry cases exposed unstable practice-copy height; stable height and waiting for the actual room preserved the exact assertions. Tracked screenshots were restored.
- Practice: six built cases across 390×590, 390×844 and 1440×900, covering progression, privacy, pointers, results, resume/replay, guest sign-in and casino/Home returns. Three affected desktop Watch smoke cases passed.
- Four real first-session journeys passed without API/WS mocks: development-owner and guest on phone/desktop, normal draft, immediate Home arrival, practice and actual conversation-route behavior. Guest403 retains the draft without fabricated history. Guided explanations are not counted as private chat. Production sign-in and live-model quality remain unverified.
- Normal-speed manual observation: actual casino play, closing Watch, and Home showing the agent still away with a live TV entry. Accelerated runs do not certify pacing.
- High-stakes: original API/WS reproduction failed at all three tiers; built backroom showed SHUFFLING. After the House and room fixes, all four built cases passed (41.9s): each tier starts with a House, survives leave/return, admits another owner into a later three-handed deal, and simultaneous room choices stay distinct. Root inspected the actual upper-room and multiplayer felt captures.
- Final room build also passed smoke 8/8 (48.2s) and Home2 20/20 (16.3s). A preceding smoke attempt never launched Chromium because of sandbox EPERM; rerunning with browser-launch permission completed normally. No product assertion failed in that attempt.
- Final whereabouts fix: five new red-first regressions and 29 adjacent checks passed. Final build: 229 modules, entry `index-yJ4PcmBp.js` (576.84 kB /181.66 kB gzip), desktop `DesktopHome-h8LmEgXA.js`. Existing 500 kB build warning remains; Watch stays eager and no dependency was added.
- The final built backroom case passed again (14.2s) with a 1.5-second assertion for the roster's At the casino update. Root inspected the House and three-handed captures: roster, 50/100 stakes and actual game agree.

Evidence lives under ignored `artifacts/first-session/`. Key logs are `client-final-room.log`, `server-final-room.log`, `e2e-final-room.log`, `highstakes-browser-final.log`, `smoke-final-room-verified.log`, `home2-final-room.log` and `desk-final-room.log`. Final whereabouts captures are in `highstakes-browser-presence`. All owned temporary servers and browser tabs are stopped; no full design inventory was regenerated.

## Handoff and resume point

Origin was fetched before integration and remained at `67880fc`. Local main was fast-forwarded; there were no conflicts or source changes during integration. This final handoff adds documentation only. Jens can push from the clean main worktree:

```powershell
Set-Location 'C:\Projects\ai-poker\artifacts\worktrees\astra-show'
git push origin main
```

Then deploy and run the linked five-person playtest. Aim for four unaided journeys in roughly ten minutes, with correct explanations of roles, whereabouts, result and next action. Record guest sign-in friction, voluntary continuation and actual later return separately. Human understanding, retention and broad release readiness are not established by local tests.
