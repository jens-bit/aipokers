# Desktop continuation and deployment repair

12 September 2026. Local candidate following `de849af`. The unrelated dirty root checkout remains untouched; integration uses the clean main worktree at `C:\Projects\ai-poker\artifacts\worktrees\astra-show`.

## Changes

- The second Actions failure was another expensive desktop test, not a rejected push. Roster/Profile/casino-return searches use their actual containers. Thread switching takes the existing persistent roster route; separate Standup coverage remains. No assertion or five-second timeout was relaxed. CI_BIRTH_HANDOFF.md records both failures and measured improvements.
- Desktop practice waits until the active birth card is acknowledged. The final birth-card control says Go home; creation and actual deployment retain their behavior and distinct checks. The older test requiring identical wording before and after creation was intentionally updated to the clearer destination, retaining the one-primary-action and single-creation guarantees.
- At 390×590, the expanded practice offer pushed the felt center into a pending request. Short phones now show Learn and Not now in a compact row with their 44px touch targets. The explanation is available inside practice. Room scaling, live poker timing and needs/economy rules are unchanged.

## Design for review

The new interactive Home study is a proposal, not a production theme or inventory implementation. It compares Warm Day, Amber Dusk and Teal Night using the existing character art, a wider room, visible fixture labels and a consistent detail panel. Sample interactions cover arrival, fridge stock 3→2, a readable sample paper, proposed belongings and explicit Watch versus human play. Owner cards and a plain pair-of-aces label are visible; opponent cards are not. Returning Home does not silently move an away agent; an explicit sample recall ends his session.

Root inspected the rendered Day arrival, Night paper, phone layout and player-role views. Local interaction/geometry checks covered 1024, 736, 390 and 320 pixels. A final 320px fixture-label correction and owner-card spacing passed their affected checks. Sample stock, articles and replies are labelled; the study makes no API calls. The durable inline fragment lives in this task's visualization directory as `railbird-next-home.html`.

Recommend Warm Day by default with optional Teal Night, then one complete care conversation using existing inventory before adding more mechanics. See DESKTOP_NEXT_DIRECTION.md. Human comprehension, enthusiasm and actual return remain unverified. The earlier all-in record-order issue and live pacing limitations remain in FIRST_SESSION_HANDOFF.md.

## Verification

Three targeted onboarding regressions failed before the repair and passed afterward; 53 affected unit tests passed. The exact BUG-55 table-center mouse click failed at 590px with hit-test evidence, then passed at both 590 and 844px after the compact offer. Added assertions keep both practice choices fully visible and at least 44px tall and confirm Learn starts the named agent's lesson.

The initial affected build passed smoke 8, Home2 20, desktop 54 and two actual desktop/phone creation→practice→return journeys. The final rebuilt product passed smoke 8/8 (56.6s), Home2 20/20 (16.1s), the exact tracked BUG-55 pair against Vite preview 2/2 (5.5s), and actual birth journeys 2/2 again. Root inspected the final 590px built screenshot: practice choices, felt and the single pending request remain accessible. The 54 desktop checks stand for the unchanged desktop runtime; the subsequent CSS is explicitly phone-only. Final bundle: `index-C-3P_zyG.js`, `DesktopHome-CPB1JXCo.js`, `index-7WKrakBE.css`. Logs and captures: `artifacts/first-session/birth-release-*`.

Final server gate: 140 passed and two expected live/data skips (23.7s). Gameplay: seven passed (88.3s). All fixtures use isolated local data and keyless providers; no VPS, env-file or key changes. Owned browser servers are stopped and tracked generated screenshots are restored.

Final full client: 221 files, 2724 passed and two existing todo in 240.56 seconds, using the default one-to-two-worker configuration. The repaired birth case took 1559 ms and roster-switching case 2610 ms; the longest test in the full timing report took 4126 ms, below the unchanged 5000 ms deadline. `artifacts/desktop-next/client-final.json` records every duration; `client-final.log`, `server-final.log` and `e2e-final.log` record the gates. An independent review found no actionable issue in the product changes or test repairs.

Origin was fetched after validation and remained at `de849af`. The candidate is integrated by fast-forward into the clean main worktree, with no product changes during integration. Evidence is under `artifacts/desktop-next/` and `artifacts/first-session/` in the first-session worktree. Nothing was pushed or deployed by the assistant. A successful subsequent Actions deployment remains the production check.

Jens's PowerShell command, from the clean main worktree:

```powershell
Set-Location 'C:\Projects\ai-poker\artifacts\worktrees\astra-show'
git push origin main
```
