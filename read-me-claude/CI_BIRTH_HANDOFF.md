# Deployment gate repair — 12 September 2026

The push of `f599a7c` succeeded. GitHub Actions run `34704401562` failed in Client tests: BUG-107 in DesktopHome.test.jsx exceeded its existing 5000 ms budget. Server and gameplay checks passed; browser smoke and deployment were skipped. This run did not update production.

The test searched the entire decorated Home with accessible-role queries while waiting for the birth card, then searched it again for the absent Profile control. Locally, the unchanged test measured 5121 ms in its 17-test file. Waiting for the birth-card title and querying its actual panel reduced that case to 1243 ms in the same file. It still clicks the visible Deal him in button and checks the exact newborn callback and closed profile. It additionally checks the prior agent panel, newborn identity and a single callback. No timeout or assertion was relaxed.

Vitest now runs one to two workers by default, so ordinary `npm test` and Actions use the bounded workload already used to validate the first-session candidate. This changes test execution only. No game timing, UI, dependencies, keys or deployment settings changed.

`npm run test:all` passed on this repair: server 137 passed with five declared skips (one paid-model suite, one local-data verifier and three requiring a built client); client 220 files / 2722 passed / two existing todo in 269.04 seconds; gameplay seven passed in 97.16 seconds. BUG-107 took 1242 ms within the full client suite. The raw log is `artifacts/ci-birth/test-all.log`. The runtime source remains the same as the built browser candidate documented in FIRST_SESSION_HANDOFF.md; its existing smoke, Home2 and desktop evidence applies unchanged.

Origin was fetched before integration and remained at `f599a7c`. The clean main worktree is `C:\Projects\ai-poker\artifacts\worktrees\astra-show`; the unrelated dirty root checkout is untouched. Jens pushes from that clean main worktree. A subsequent green GitHub Actions run is still required to confirm deployment; this local repair was not pushed or deployed by the assistant.
