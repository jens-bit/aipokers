# Railbird — progress and handoff, 9 September 2026

Twenty-eight implementation batches are prepared. The full design/spec goal remains active: this is a verified development milestone, not a claim that the product is ready for final friends-shareable sign-off. No deployment or Claude/Opus review is claimed.

## What is now implemented

- Home/casino phone layout uses one contextual header and the available width. The kitchen table, room routines, play/rest cadence, fridge and TV remain functional. Pending wants have one answer surface and the felt is clickable.
- Board 42's companion, conversation, compact profile, roster, absence and TV states use actual stored data and authenticated actions. Desktop has the wider room, compact profile and latest contextual header.
- First-agent entry uses the actual recruiter and four stages, without a collar. Hood/glow identity persists and the forming preview sits over the desktop room's table.
- Watch's phone presentation is preserved, with large-win/bust visual effects. Desktop recordings open from casino rows, end honestly and return to their originating board. Missing recorded stack/body data is not invented; the equity number and rope agree.
- The casino floor scales to its real space, including late live tables and short desktop windows. The welcome example now includes the full phone composer. The desktop Floor and Board now share one contextual header.
- Board 41's chosen loading frame and favicon/install/touch/avatar exports are prepared from the shared mark. Avatar export does not mean a Telegram account was changed.
- The long welcome page shares the actual guest entry and room, followed by the nine L2 explanatory sections. Current product captures replace the previous hand-drawn illustrations. Guest-off deployments show the existing sign-in path. Four section comparisons are in client/e2e/shots/design-batch22-*.png.

## Verification

Batch26 passes 105 server / 2,209 client / seven end-to-end verifiers, all 36 desktop browser cases, seven fresh built-server smoke checks (58.2s), and 20 Home2 checks (18.3s). Both DkWatch comparisons were inspected: the newly working casino routes still use the older desktop Watch visuals. Its final main integration follows before a push report.

Batch25 passed the full gate: 105 server checks (two intentional live skips), 2,206 client checks (two existing todos), and seven end-to-end verifiers. All 33 desktop browser cases passed across two non-overlapping groups, along with phone BUG-55 at both heights and seven welcome checks. The final build passed; a fresh scratch server passed all six smoke checks (30.8s) and all 20 Home2 checks (18.2s). The new smoke proves actual desktop Watch/Join/Fold/Leave. Both seating reference pairs were inspected. Main integration follows before a push report.

The latest full gate passed 105 server checks (two intentional live skips), 2,202 client checks (two existing todos) and all seven end-to-end verifiers. A final client run after the scrolling refinement also passed 2,199. Batch22's desktop/draft/landing/welcome group passed 43 checks; final welcome passed eight including ordinary/reduced-motion scrolling, and final guest/Home checks passed seven. Batch23's final set passed all 27 desktop cases and two responsive welcome captures; the phone four-agent table remained clickable at both heights.

The production build passed. On a fresh scratch server, all four existing smoke checks and all 20 Home2 checks passed. The new permanent built-welcome smoke also passed: /welcome and /welcome/ serve no-store with the current hashed bundle, responsive product images load, and neither width raises a page error. Batch22 main integration passed; batch23 adds 27 desktop browser checks, two final welcome captures, all five smoke checks together and all 20 Home2 checks. Batch24 adds the single contextual header, with 83 targeted checks, 27 desktop browser cases, two welcome captures, five fresh built smoke checks and 20 Home2 checks passing. Batch24 main integration also passed. Nothing has been pushed by Astra.

BUG-94 retains an unexplained earlier Windows child-process exit. BUG-102 records the local invite-test timeout: its inaccurate new-guest fixture and broad query were corrected, and subsequent full runs passed, but resource contention is not proven as the cause. No assertion was skipped or weakened. The overnight execution interruption around 04:56–08:53 remains documented; those hours are not represented as productive work. The scheduled heartbeat was paused at its 09:00 cutoff; the active goal continued afterwards.

Batch28 adds the shared 900×648 desktop Watch canvas, contextual header and compact conversation. Paired owned/public views were inspected; the later roster, real hand data, 16px input and condition labels are documented differences. Full test:all passed 105 server / 2214 client / 7 e2e. The complete browser run passed 39 of 40 before one immediate post-resize measurement; the test now waits for the ResizeObserver layout and preserves the same bounds, and its five-case focused group passed. All seven fresh built-server smoke cases and all 20 Home checks passed. Both four-agent phone hit-target cases remain green. Main integration follows the commit.

## Remaining work

1. Desktop kitchen-table Watch/Sit is now fixed (BUG-99) and the welcome page uses its working desktop example. Generic casino Watch and post-deploy routing are now fixed and verified (BUG-105). Dropped queue blinds (BUG-106) and the newborn observer crash (BUG-107) are fixed with red-first checks. The newer desktop Watch canvas/header/conversation is now ported and paired (BUG-108), with working Home return and public camera naming. Continue the full frame/state and immutable-identity audit.
2. Desktop floor sizing and its repeated heading are fixed and paired (BUG-103/104). Phone Board ordering/panel styling still differs from the authored example; the full frame inventory needs to distinguish current designs from superseded ones.
3. Finish the current reference-state inventory and identity presentation audit. Separate current requirements from explicitly parked rare-birth rolls and future design waves. Do not invent a collar or an item economy.
4. Remaining board-41 applications, unspecified celebration audio, external avatar/account settings and undesigned visit/referral/share/fast-forward states need explicit dispositions.
5. Complete production rollout verification and playtest after deployment. A public config check returned guest=false and botUsername=agenticpoker_bot; these were not changed. Guest entry is not enabled merely because the code exists.

## Deployment workflow

Jens pushes after the final integration gate. A push starts deployment; it does not prove the new build is live. Check the successful run's commit and then reopen the app to exercise Home table, casino, companion, welcome and first draft.

```powershell
Set-Location C:\Projects\ai-poker
git push origin main
```

The working gameplay foundation is clear. The earlier process gap was treating code/tests as proof of design parity. The paired renders expose the remaining differences instead of hiding them behind passing checks.