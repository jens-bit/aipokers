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
