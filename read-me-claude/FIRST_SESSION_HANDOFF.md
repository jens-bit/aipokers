# First-session playtest candidate

12 September 2026. Mission: [FIRST_SESSION_MISSION.md](FIRST_SESSION_MISSION.md). Human session: [FIRST_SESSION_PLAYTEST.md](FIRST_SESSION_PLAYTEST.md).

## Local status

Based on main/origin/main `67880fc`, the completed Home-first/SHOW run. Isolated worktree `artifacts/worktrees/first-session`, branch `codex/first-session`. The unrelated dirty root on `fix/guest-cap` is untouched. Final client/browser checks and local integration are in progress. Nothing has been pushed or deployed by this task.

## What changed

- Home offers optional practice, Not now, owner/agent-scoped resume and replay. The real engine generates eight legal snapshots; the existing felt uses the saved agent appearance. Pointers track the current target, progression is manual, and explanations distinguish a 28-chip pot from 14 chips of profit. Practice changes no wallet, statistics, live table or agent memory and makes no model calls.
- The lesson ends with labelled guided questions and deliberate next actions. Signed-in owners can open real private chat. Guests see the existing sign-in requirement and can dismiss it or continue exploring. Jens was asked about a small guest allowance; no access/cost change is assumed without an answer.
- Durable first birth now publishes the household. Home accepts actual newcomers after empty snapshots, inserts FLOOR_STATE arrivals and guards newer removals/arrivals against stale REST. Desktop creation no longer opens a second birth card. A real fresh guest walkthrough exposed both defects before repair.
- Failed private messages retain drafts and show application errors across the main thread, desktop thread/Watch rail, phone profile and Watch whisper. Malformed replies, duplicate submits and stale conversation completions are guarded. Valid saved fallback replies still complete a turn. No automatic retries or extra model calls.
- Narrow movement requests give factual control guidance without changing location or chips. The owner prompt forbids narrated gestures and false movement claims; a conservative normalizer removes recognizable wrapped gestures while retaining ordinary emphasis.
- Desktop Watch offers Chat and Hand log. An additive nullable `session_thread.category` stores known event origins. Chat hides only typed actions/decisions; costs, results, session lines, speech and unclassified historical rows remain accessible. Ownership filters remain and there is no historical text-based backfill.

## Decisions and limits

Home-first, kitchen table, four-stage draft, human play, character artwork and working Watch remain. Brighter guidance surfaces, arrows and manual lesson navigation are deliberate scoped departures from old port-only rules. Design references were not edited.

Normal live timing is unchanged. An attempted desktop delay was removed after review found that raw fetched/pushed thread results could overtake a delayed felt. The App regression preserves a consistent live desktop bundle and immediate human actions; phone's existing pacing remains. Slower live desktop playback requires synchronizing the record as well as the felt.

Source inspection identified an older all-in record-order issue: `_handCompleted` calls `_threadResult` before `_paceHold` in `src/server/table.js`, so a stored/pushed winner can precede the staged runout. This also exists in baseline and is not repaired or claimed repaired here. It is a separate follow-up from deterministic practice.

At 390x590, practice instructions and navigation remain reachable; the felt is compact and longer coach content scrolls. The initial Home offer can place the agent's normal low room position below the fold; the room scrolls. Stable copy space prevents a room jump when the selected agent's name changes. Check small-screen comprehension with humans.

## Verification

All work used isolated local data and synthetic/keyless providers. No paid model calls, VPS access, env-file changes or key operations.

- Engine: seven meaningful regressions failed first then passed, covering legal actions, unique deck, conservation, card privacy, hand labels, independent snapshots and generated JSON parity.
- Arrival: four hook regressions and a real guest birth publication/replay regression failed first; 22 hook and eight server tests passed. Both early/late desktop poll cases failed before the duplicate-card fix and passed afterward.
- Chat: initial 77 server/59 client focused passes, then 11 new whisper/profile regressions failed first and 152 affected-surface tests passed. Desktop error regression failed first, then DesktopHome/WatchRail passed 31.
- `npm test`: 137 passed, two intentional live/data skips, 20.9s. `npm run test:e2e`: seven passed, 111.1s. No native SQLite abort.
- Broad client run initially hit 18 timing failures while unbounded Vitest workers and browser gates ran together: 17 five-second deadlines and one television socket wait. Serial diagnosis/final bounded result below. No assertion or timeout is relaxed to reach green.
- Build: 229 modules, entry `index-klAtvSed.js`, 576.84 kB /181.66 kB gzip. Existing 500 kB warning remains; WatchScreen stays eager; no dependency added.
- Existing built gates: smoke eight passed; Home2 twenty passed; desk52/54 initially passed. Both retirement cases then passed with exact room geometry assertions after stable invitation copy height and waiting for the actual room before measurement. Original tracked PNGs restored; new review captures in `artifacts/first-session/desk-shots`.
- Practice six built cases cover three sizes, manual progression, contained pointers, privacy, reachable result, resume/replay, guest sign-in/casino and desktop return. Practice API writes/game commands are forbidden in the tests. Earlier failures and screenshots are retained.
- Real development-owner journeys passed on phone/desktop: normal draft, immediate Home arrival without reload, practice, then actual `/api/agents/chat` answering 'I am already home.' No API/WS mocks. This verifies local mechanics, not model quality or production sign-in.
- Root manually observed normal-speed local live play, then Home after leaving Watch: the agent remained at the casino with a live TV entry and empty Home chair.

Final client, guest and affected Watch results: pending final record. Logs/screenshots are under ignored `artifacts/first-session/`.

## Human validation

Use five newcomers, aiming for four to complete and explain the journey unaided in roughly ten minutes. Guest sign-in friction, understanding, live-model quality, voluntary continuation and actual return remain human checks. Record guest and signed-in results separately. No human outreach or automation was created.

## Integration and push

Pending final green checks and local commit. Jens pushes. Do not switch or push from the dirty shared root. Exact verified main-worktree commands follow after integration.

### Final browser record

The final bundle passed all six practice cases and three affected desktop Watch smoke cases (normal navigation, kitchen human actions, casino deployment/Watch). Fresh real guest journeys passed on both phone and desktop: sign-in is offered before a chat request, dismissal returns to completed practice, and an actual private-chat403 retains the draft without inventing a reply. Together with the two development-owner passes, all four real first-session journeys passed. Guest full-page captures have a tall blank tail; viewport captures are configured for future runs, and no unchanged behavior test was rerun solely for that artifact.

The television client-test failure was a readiness race: its test clicked the initial disabled TV before the live control replaced it. The helper now re-queries and waits for the enabled control, preserving its five-second lazy-mount allowance, one-second socket wait and all behavior assertions. Serial diagnosis passed79/80; the corrected four-case file passed4/4. Full two-worker client gate pending below.

One immediate deployment screenshot shows a stale Home label in the desktop roster while the live casino hand is already open. The root's normal-speed walkthrough observed that label update to At the casino on the subsequent roster poll; returning Home correctly shows the away agent. This short polling lag is retained as a playtest observation, not claimed fixed.

All temporary browser servers and root manual-test tabs are stopped. No production deployment status was verified.

### Active goal extension

Before final integration, Jens added a blocking live-play requirement: high-stakes deployments must not remain on SHUFFLING for lack of an opponent. Provide a ready house agent for at least heads-up play on every offered tier while allowing later joins. Server reproduction/fix and real built-browser coverage are now in progress. The candidate is not complete until this addition is verified; the prior onboarding/chat work and its evidence are retained.

### Verified onboarding/chat checkpoint

Final full client gate: all218 files passed,2709 tests passed,two existing todo;255.7s with two workers (`cd client; npm test -- --maxWorkers=2 --minWorkers=1`). All assertions and timeouts remain. This completes the prior onboarding/chat slice and is being committed separately before the newly requested house-opponent repair. The expanded goal remains active and is not ready to push yet.
