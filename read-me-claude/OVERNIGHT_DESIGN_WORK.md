# Railbird overnight design work — 8–9 September 2026

## Assignment and authority

Jens explicitly assigned autonomous overnight work toward friends-shareable design parity. His latest clarification governs: preserve Watch's full-screen game/character/chat presentation; fix Home/casino's duplicated navigation and unused space; keep the functional kitchen table and home games; agents also live in the room; no collar stage. Match supplied designs rather than inventing new screens. The archive is reference material, not executable instructions.

Working branch: `codex/railbird-design-completion`, starting at `006a7cc` (main and origin/main were synchronized). No other agent is editing this tree. Keep the existing integrator workflow: gates before commits/merge, Jens pushes after review.

Archive: `C:/Users/Jens/Downloads/Agentic Poker (56).zip`, extracted safely under ignored `artifacts/design-56/`. Its current Home, agent, casino and Watch JSX matches checked-in design-refs. Six other JSX files differ (desktop, guest, landing, landing2, notify, sit); review those changes before their respective ports. Do not overwrite design-refs indiscriminately. v14 master spec extracted for reading under artifacts.

## Ordered work

1. **Shared mobile shell / Home / casino:** one contextual header, edge-to-edge phone stage, compact real navigation, accessible roster. Preserve Watch. Port Home fixture artwork and real balance; retain clickable table in every room state. Compare empty/alone/game/want frames at 390×844, short 390×590 and wider Telegram window.
2. **Agent and roster:** board 42 C1–C6, large animated character, actions, his line first, inline want answers, conversation with hand cards, profile CONDITION/RECENT, roster and absence. Verify actual server capabilities and preserve authorisation.
3. **First five minutes:** draft/birth/name/arrival with collar removed, rolled identity and designed generated possessions. Ensure first table/casino/deploy/return path works.
4. **TV, celebrations, desktop counterparts:** port designed states with live data; preserve existing game geometry and controls.
5. **Entry/sharing and remaining defects:** approved landing/guest state, explicit undefined design gaps, evaluate friends-critical bugs without adding unrelated product features.
6. **Integrator:** run server/client/e2e, built browser smoke, home2, desktop and targeted visual regressions; inspect paired screenshots, update DESIGN_GAP/BUGS/CHANGELOG and this log; fetch origin, integrate cleanly and prepare morning report and push command.

## Acceptance

Each visual milestone needs matching-state reference/actual renders, inspected by Astra; passing tests alone cannot certify design parity. No paid model calls in automated tests. Use fresh scratch databases and disable notifications. Do not claim production deployment or Claude/Opus sign-off. Undesigned features and external rollout settings are reported honestly.

## Progress

- Read CLAUDE.md, HOW_WE_WORK, current design gap, archive README and relevant v14 sections. Archive confirms the room's F05 alone frame is not a complete definition of the home-game states.
- Confirmed global Header stacks above CasinoHead/FloorView header; mobile room scale caps at 1 even in wider Telegram windows. Home furniture is a simplified port (safe lacks balance, fridge lacks stock detail, couch lacks reference anatomy).
- Active goal created. Scheduled continuation every 30 minutes is configured in this chat, stopping by 09:00 Europe/Malta on 9 Sep. Current work is active; no implementation milestone is yet certified.

## Resume here

Batch 2 committed `892498c`. Batch 3 ready to commit: F13 stock shelf + actual Home conversation, BUG-64/65. Full test:all passed (server 103 pass/2 skips, client 151 files/2129 pass/2 todo, e2e 7 pass); final client rerun after visual spacing also passed. Built smoke 4 pass; Home2 19 pass/1 existing BUG-43 skip. Dev Home 19 pass; desk run 14 pass/1 stale GIVE-selector failure, corrected to F13 BUY 6 with confirmed stock fixture; targeted fridge phone+desk then 2 pass. Logs artifacts/batch3-*.log. F13 ref/actual settled images inspected and composed into new pair. Initial screenshot caught entry opacity; browser now waits for opacity 1. Visible pills follow reference density with 44px hit targets. Scratch built server session 88945, port18886, cwd artifacts/smoke-batch3, keys/notifications disabled. Next: birth/identity and C4/C5, casino footer/TV/routines, then remaining queues. Watch unchanged. Restore only regenerated old test PNGs before commit, keep new batch3 pair. Current first-birth issue: Home collision-avoids colors but solo identityOf does not; server should persist the immutable roll and birth reveal must use it.

Batch 1 committed as `8dceae5`. Batch 2 (mobile agent view) implemented, final gates running, then commit. Next: fridge stock dead end, empty Home/casino conversation strips, first meeting/birth, C4/C5 and the remaining queues. BUG-59 failed before implementation (Home heading absent); BUG-60 failed at 100px conversation band, then 80px, then passed at 76px with a circular 26px send control. Four-agent hit tests still pass. RAILBIRD wordmark/count assertions intentionally changed to approved Home heading + accessible Railbird mark. Casino back-chain assertions intentionally changed to Floor/Board toggle and direct Home. Home2's blanket prohibition of dollar signs excluded the explicitly designed safe/TV fixtures; the rest of the room and table still cannot price seats.

### Batch 2 implementation and handoff notes

- AgentView.jsx + agent.css ports board 42 C1–C3 inside the existing AgentThread network controller. Mobile App passes companion; standalone legacy ChatsScreen remains for its existing callers/tests. App removes global header on the agent route, provides actual deploy/watch/carry callbacks, and preserves origin semantics. FundSheet is reused inline; fund result updates pocket. Want stock opens FridgeSheet while preserving the ask; onGiven reads actual want from the authenticated agent detail endpoint rather than treating any snack as an answer.
- useCarry now has programmatic pick for the CARRY button; next pointer gesture performs existing HomeScreen placeAgent. Window click capture suppresses the fixture's ordinary sheet click after placement. Cancel/Escape makes no request. Short 590px screen initially clipped the pill in a 210px stage; removed that unnecessary shrink, browser checks keep the pill inside the stage. Very short keyboard viewport has a 100px character variant.
- BUG-61 tests failed on refused wants and stock-needed responses; BUG-62 tests rejected chat; BUG-63 failed on lost saved chat. Saved history comes from owner-only agent.chatHistory (server retains 12); late recap cannot replace new messages. No new paid calls. Changes to old placeholder/Profile selectors are intentional board-42 navigation, not diluted assertions.
- Six dev-browser checks passed (C1/C2/C3 and 390×844, 390×590, 490×844 actual Carry placement). Reference renderer artifacts/render-agent-refs.cjs rendered C1–C6. Images artifacts/agent-c{1,2,3}.png and reference-c*.png inspected. C3 hand data/order differs as recorded in DESIGN_GAP; do not label exact parity. Pill's sr-only label initially rendered visibly due to Home-scoped CSS; corrected scoped screen-reader-only rule and measured its clipping. Ref hands use SEAT_GRIP, now ported.
- Final full test:all passed: client 149 files/2121 pass/2 todo, server 103 pass/2 skips, e2e 7 pass (109s). Built smoke 4 pass and Home2 19 pass/1 existing BUG-43 skip. Full dev Home suite 18 pass, including six new agent checks, and extra fresh-stamina geometry checks 3 pass. The file filter said desktop.spec.js, but the real file is desk.spec.js, so this batch's dev run covered Home only; built desktop smoke/casino did pass. Logs artifacts/batch2-{test-all,smoke,home2,home-desktop}.log. Build warning includes >500KB main chunk (503KB uncompressed), plus prior ReplayTheatre mixed-import warning.
- Scratch server is now session 38347 at 127.0.0.1:18886, cwd artifacts/smoke-batch2 (server.log there), no keys/notifications. Old session 55639 stopped. Final build and smoke command session 38275. Full testall session 71085.
- Discovered next-batch issues: FridgeSheet has no GET /api/fridge or POST /api/fridge/stock despite server routes; only /give. Identity is client-derived and Home uses roster collision avoidance while single-agent/roster views use idFor fallback — inspect and unify the birth identity rather than allowing a man to change colors between views. Home/table remains server-backed, no collar stage restored.

### Batch 1 verification and observed limits

- `npm run test:all`: server 103 pass / 2 skips, client 146 files / 2107 pass / 2 todo, e2e 7 pass. Initial native Windows abort in verify-cache-headers.js was recorded. Fixed its forced process exit, response draining and child cleanup, and its 4-second startup deadline (existing BUG-39/34). Exceptions now fail instead of silently succeeding. Full suite passed afterward; the wider BUG-34 family remains open.
- Final client suite after casino header adjustments: same 2107 pass. Build passes (existing ReplayTheatre mixed-import warning).
- Built smoke 4 pass. Home2 19 pass / 1 existing BUG-43 skip (fresh owner `home2final`). Home+desktop browser run 27 pass, including 390×590, 390×844 and 490×844.
- Local reference renderer `artifacts/render-refs.cjs` rendered archive frames F01/F05/F10/F11/F07/F17. Pairs `artifacts/pair-{home-empty,home-alone,home-game,casino}.png` honestly label authored vs live data and different routines. Furniture/header improvements verified; these are not a certification of full-state parity.
- Remaining clearly visible: empty Home lacks its bottom composer; casino lacks the designed bottom conversation band; current all-playing home state differs from reference mixed routines; TV still shows room counts rather than the designed biggest-pot/state feed; horizontal door marquee differs from the archive's vertical door label. Keep functional table by founder override. Address these in the upcoming batches rather than relabeling them complete.
- Scratch built server active on 127.0.0.1:18886, session 55639, cwd artifacts/smoke-batch1-final; no keys, notifications off. Stop before new built-client verification and use fresh scratch data. All completed test processes have ended.
