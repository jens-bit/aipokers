# Home appearance and room direction

12 September 2026. Continuation after the arrival candidate at 1607de6, whose Actions deployment completed successfully in run 34706649580. Work stays in the isolated `codex/desktop-next-experience` worktree; the unrelated root checkout is untouched. Jens pushes from the clean `astra-show` main worktree.

## Implemented first slice

- App owns one appearance preference. Auto uses device-local hours: Day 06–17, Dusk 17–20, Night 20–06. Manual choices persist locally. The clock is checked every 30 seconds and after focus/visibility changes; another tab's choice also synchronizes. Storage failure still permits an in-session choice. No location access, model call, background request or agent rule is involved.
- Home on phone and desktop receives the same palette. The floor, wooden kitchen table, window, sage couch, fridge, doorway and surrounding Home chrome are brighter. TV and fridge have visible labels. Conversations retain dark, readable surfaces. Live tables and replay retain their existing presentation.
- The appearance control lives in the Home header on both shells. Changing it does not key/remount the room, replace agent identity, discard chat drafts or alter poker state.
- The fridge discloses beer's temporary discipline/bluff tradeoff in the next casino session and snacks' gentler cooling. Buying, consumption, prices, stock and wants are unchanged.

This is the first visual implementation, not the completed room redesign. Physical fixture/agent coordinates and existing room navigation remain intact. The window's wall paint extends behind it; no placement hit boxes move. Persistent belongings, articles and a replacement ghost design are not implemented.

## Approved direction and proposal

`DESKTOP_NEXT_DIRECTION.md` and `FIRST_SESSION_MISSION.md` record Jens's approval: local-time atmosphere, desktop and mobile, casino door on a wall, repositioned fridge, recognizable TV, wooden kitchen table, and belongings including clothes/notebook/newspaper. No persistent fridge or newspaper navigation tab or newspaper column.

The revised interactive study is `railbird-home-cycle.html` in this task's visualization directory; the approved first study is preserved as `railbird-next-home.html`. It uses sample state and existing character art, makes no API calls, and clearly marks illustrative stock, replies, notes and headlines. Mobile opens contextual details and returns to the room; desktop keeps details alongside it. Kitchen Watch and human play remain at home; casino Watch makes Milo away, and returning the viewing screen Home does not recall him. Explicit recall is available from his details. Own sample cards are visible; opponent cards remain private.

## Verification

- Full client: 222 files, 2737 passed, two existing todo; 236.31 seconds. Every test remained inside the unchanged five-second deadline; longest 4099.9 ms. New appearance tests cover clock boundaries, persistence, sleep/focus, tab synchronization, blocked storage and preserving existing room state. Independent review caught and corrected Auto's menu label to describe the actual local-clock period even during a manual override.
- Full server: 140 passed, two expected live/data skips; 18.9 seconds. Gameplay: seven passed; 92.9 seconds.
- Built browser: 22 passed, including all three themes at 320/390/1440, unchanged body identity and unsent drafts, persisted choice after reload, fridge access, phone table-access regressions and desktop away/profile/refusal journeys.
- Real built server: smoke 8/8, Home2 20/20 and actual creation → Home → practice → private chat on phone/desktop 2/2. Browser settings match CI's isolated data, keyless decisions, request allowance and accelerated hand pauses. Root inspected Day desktop/phone captures and the revised proposal at desktop/phone sizes.
- Final built entry: `index-Bo4aqXz2.js`; desktop chunk `DesktopHome-CIHyPY5K.js`; stylesheet `index-nYJ8l8Wy.css`.
- Revised proposal: 40 captured states across 1024, 736, 390 and 320 pixels, with no horizontal overflow, fixture/name-label overlap or JavaScript error. Root inspected the phone room and kitchen human hand, daytime desktop room and dusk return. A clipped tablet arrival portrait was repaired and all affected states rechecked. Sample fridge decrement, reading, kitchen play, away-state preservation and explicit recall were exercised.

Evidence lives under `artifacts/desktop-next/appearance-*` and `cycle-*`. Initial local runner failures came from applying browser-only SHARE_INLINE=0 to a mocked unit test, selecting the client Playwright runtime for root specs, and omitting CI's browser request allowance. The runner was corrected; production code, assertions and timeouts were not changed in response. Those diagnostic logs are retained alongside the successful gates.

## Next work and decisions

Keep endurance and heat, but distinguish trait from condition. Profile stamina is an endurance attribute; Home's bar illustrates fatigue stages, not measured remaining energy. Proposed Home labels are Rested / Tiring / Worn plus the existing mood word. Heat is emotional pressure with real poker consequences. No fatigue threshold, recovery rate or autonomous consumption behavior changed in this slice.

Next: finish one authoritative care conversation (need → accepted/refused action → stock/movement → one truthful acknowledgment), then connect meaningful belongings and factual public newspaper events. Existing TV live/review behavior is a useful room activity. Larger inventories, autonomous consumption, sleep tuning and a substantial character redesign still need concrete product choices. Slower live pacing still depends on aligning visible actions, explanations and results; this appearance work does not repair the previously documented all-in result ordering issue.

Human unaided comprehension and actual return are still unverified. Use the existing five-person playtest; automated route checks do not establish enthusiasm or retention.
