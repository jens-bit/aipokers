# Railbird — progress and handoff, 9 September 2026

Twenty-two implementation batches are prepared. The full design/spec goal remains active: this is a verified development milestone, not a claim that the product is ready for final friends-shareable sign-off. No deployment or Claude/Opus review is claimed.

## What is now implemented

- Home/casino phone layout uses one contextual header and the available width. The kitchen table, room routines, play/rest cadence, fridge and TV remain functional. Pending wants have one answer surface and the felt is clickable.
- Board 42's companion, conversation, compact profile, roster, absence and TV states use actual stored data and authenticated actions. Desktop has the wider room, compact profile and latest contextual header.
- First-agent entry uses the actual recruiter and four stages, without a collar. Hood/glow identity persists and the forming preview sits over the desktop room's table.
- Watch's phone presentation is preserved, with large-win/bust visual effects. Desktop recordings open from casino rows, end honestly and return to their originating board. Missing recorded stack/body data is not invented; the equity number and rope agree.
- Board 41's chosen loading frame and favicon/install/touch/avatar exports are prepared from the shared mark. Avatar export does not mean a Telegram account was changed.
- The long welcome page shares the actual guest entry and room, followed by the nine L2 explanatory sections. Current product captures replace the previous hand-drawn illustrations. Guest-off deployments show the existing sign-in path. Four section comparisons are in client/e2e/shots/design-batch22-*.png.

## Verification

The latest full gate passed 105 server checks (two intentional live skips), 2,199 client checks (two existing todos) and all seven end-to-end verifiers. A final client run after the scrolling refinement also passed 2,199. The desktop/draft/landing/welcome browser group passed 43 checks; final welcome passed eight including ordinary/reduced-motion scrolling, and final guest/Home checks passed seven.

The production build passed. On a fresh scratch server, all four existing smoke checks and all 20 Home2 checks passed. The new permanent built-welcome smoke also passed: /welcome and /welcome/ serve no-store with the current hashed bundle, responsive product images load, and neither width raises a page error. Main integration is subject to its own final gate; the chat confirms the prepared revision. Nothing has been pushed by Astra.

BUG-94 retains an unexplained earlier Windows child-process exit. BUG-102 records the local invite-test timeout: its inaccurate new-guest fixture and broad query were corrected, and subsequent full runs passed, but resource contention is not proven as the cause. No assertion was skipped or weakened. The overnight execution interruption around 04:56–08:53 remains documented; those hours are not represented as productive work. The scheduled heartbeat was paused at its 09:00 cutoff; the active goal continued afterwards.

## Remaining work

1. Desktop kitchen-table Watch/Sit actions and the human seating stage are missing (BUG-99). The welcome page currently uses the working phone seating example at either width.
2. The desktop casino floor uses too little of its stage (BUG-103). Its late ROOM_TABLES measurement and the approved wider geometry need a focused port and browser proof.
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