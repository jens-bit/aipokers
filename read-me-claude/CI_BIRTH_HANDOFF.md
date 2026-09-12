# Deployment gate repairs — 12 September 2026

The push of `f599a7c` succeeded. GitHub Actions run `34704401562` failed in Client tests: BUG-107 in DesktopHome.test.jsx exceeded its existing 5000 ms budget. Server and gameplay checks passed; browser smoke and deployment were skipped. This run did not update production.

The test searched the entire decorated Home with accessible-role queries while waiting for the birth card, then searched it again for the absent Profile control. Locally, the unchanged test measured 5121 ms in its 17-test file. Waiting for the birth-card title and querying its actual panel reduced that case to 1243 ms in the same file. It still clicks the visible Deal him in button and checks the exact newborn callback and closed profile. It additionally checks the prior agent panel, newborn identity and a single callback. No timeout or assertion was relaxed.

Vitest now runs one to two workers by default, so ordinary `npm test` and Actions use the bounded workload already used to validate the first-session candidate. This changes test execution only. No game timing, UI, dependencies, keys or deployment settings changed.

`npm run test:all` passed on this repair: server 137 passed with five declared skips (one paid-model suite, one local-data verifier and three requiring a built client); client 220 files / 2722 passed / two existing todo in 269.04 seconds; gameplay seven passed in 97.16 seconds. BUG-107 took 1242 ms within the full client suite. The raw log is `artifacts/ci-birth/test-all.log`. The runtime source remains the same as the built browser candidate documented in FIRST_SESSION_HANDOFF.md; its existing smoke, Home2 and desktop evidence applies unchanged.

Origin was fetched before integration and remained at `f599a7c`. The clean main worktree is `C:\Projects\ai-poker\artifacts\worktrees\astra-show`; the unrelated dirty root checkout is untouched. Jens pushes from that clean main worktree. A subsequent green GitHub Actions run is still required to confirm deployment; this local repair was not pushed or deployed by the assistant.

## Second run and broader repair

Jens pushed `de849af`; run `34705416246` passed the birth regression but timed out in `desktopWidth.test.jsx`'s roster thread-switching case. Again, the push succeeded and deployment was skipped. The first repair was too narrow: its passing local full-suite log also recorded that other case at 5299 ms, leaving no useful margin for CI.

The next repair scopes that suite's repeated role/name queries to the permanent roster and Profile to the actual rail. DesktopHome thread helpers now take the existing direct roster route rather than mounting Standup before every switch; Standup retains its separate navigation assertions. Remaining Profile queries use their real rail. The two desktop casino-return cases query their table/floor containers. Roles, names, transitions, callback assertions, privacy checks and the 5000 ms limit remain. A proposed away-profile query change showed no meaningful timing improvement and was left out.

Measurements: roster switching was 4063 ms in an isolated baseline and 5299 ms in the earlier full gate; its first repaired two-file run took 2520 ms. Adjacent upstairs/backroom returns improved from 2829/2379 ms to 1338/939 ms. The combined release also includes the verified birth/practice repair and the compact short-phone offer so the browser gate can pass after the client tests. Final combined validation is recorded in DESKTOP_NEXT_HANDOFF.md.
