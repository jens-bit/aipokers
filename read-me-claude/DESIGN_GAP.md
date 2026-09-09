# Railbird — current design gap inventory

Updated 9 September 2026, batch31. Source: supplied Agentic Poker (56).zip, imported design-refs, the current code and inspected browser pairs. Jens's explicit overrides take precedence: keep the kitchen table/home games, preserve the phone Watch composition, cancel the collar, and use Railbird branding.

This replaces the contradictory old inventory that still called implemented boards 41/42 entirely unbuilt. Its original text and all batch1–29 entries are preserved in [DESIGN_GAP_HISTORY.md](DESIGN_GAP_HISTORY.md). Chronological execution evidence remains in [OVERNIGHT_DESIGN_WORK.md](OVERNIGHT_DESIGN_WORK.md).

**Status meanings:** VERIFIED means the named local implementation/check or pair was inspected; it is not a production deployment claim. PARTIAL names a known difference. UNVERIFIED means code exists but the complete frame/state has not been compared. MISSING means required implementation/assets are absent. SUPERSEDED means a newer reference or Jens's instruction replaces it. UNDESIGNED means the supplied reference does not specify the interaction. These are separate from release status: Jens's push and a production playtest remain outstanding.

## Current frame inventory

| Board / frames | Current assessment | Evidence or next action |
|---|---|---|
| 01 S1–S3/S5, 02 42–45: tokens, bodies, expressions, heat and sizes | PARTIAL | Shared mood/identity atoms and face tests exist. Batch29 verifies saved hood/glow across moods and camera seats in live tables. Still render the complete expression/size matrix against Faces before declaring all anatomy exact. |
| 01 S6: mark | VERIFIED locally | Shared Railbird mark; batch20 loading/reduction/export pairs. Account applications remain below. |
| 02 48–51: eight hand poses and brow triggers | PARTIAL | Existing push/toss/muck/hold, Watch tests and batch11 win/bust effects. Full pose/brow matrix remains unpaired. |
| 10 Character / 11 Biography | VERIFIED implementation; presentation PARTIAL | Existing attributes, nature, biography and growth laws. The old claim that condition dips never reach the client is obsolete: current owner projection and C4/C9 present condition/recent. Continuous numeric stamina is not fabricated from the server's three fatigue bands. |
| 20–23 / 30 older mobile/navigation and 24 D1 login | SUPERSEDED | Use current 26/29/31/42 and the current guest/sign-in flow. Earlier birth-card composition is only authoritative where not replaced. |
| 24 40a–40i first five minutes | PARTIAL | Four-stage draft, birth arrival, first game and recap paths exist; draft overflow/identity/birth/deployment repaired in batches4/17/27. Telegram first-open and the entire fresh-account sequence still need production playtest. |
| 24 41 empty-state matrix | UNVERIFIED as a complete matrix | Several Home/guest/empty-table cases pass; render all seven authored rows rather than extrapolating from those. |
| 25 N0–N8 notifications | PARTIAL / external verification pending | Server notification/refusal/budget tests exist. No actual phone delivery is claimed. Do not send real notifications merely to manufacture audit evidence. Compare prepared message payloads to the frames, then verify authorized production settings/delivery. |
| 26 52a–f/i–n: Watch, betting, hold, thread/read, cards, six seats | VERIFIED existing implementation with remaining matrix audit | Phone composition retained by Jens. Existing Watch/Sit/hand/privacy tests; batch29 saved identities. Keep complete scene checks distinct from unit coverage. |
| 26 52g/h/p/q/r and 42 C8a/b/c: win/big-win/bust | PARTIAL | Batch11 pairs verify fists up, three bursts for >=100bb and actual knockout, darkened/falling busted opponents, reduced motion and split winners. Batch31 implements gesture-unlocked original effects and the specified timing; real-browser playback/mute passed. The archive supplies no recording to match. [Original preview](../client/e2e/sounds/c8-original-preview.wav); final listening preference remains Jens's. |
| 27 K1 arrival/deploy / K2 Board | VERIFIED local journeys; batch30 layout port | Actual deployment/queue/Watch/Leave smoke passes. Phone Board now follows N3/F07: separate Live now and Tonight before room doors. Floor-first toggle is a later approved requirement. |
| 27 K3 hot felt | PARTIAL | Live pot/Watch/hot rows and floor glow exist. Need a dedicated hot-frame pair, not just ordinary floor screenshots. |
| 29 F01 empty Home / F02–F03b draft / F04 arrival | VERIFIED locally with recorded differences | Batches1/3/4/17/27 and their pairs. Four forming stages, no collar. Actual names/rolled appearances replace samples. Birth card currently retains the earlier 96px correction rather than C2's illustrated 64px. |
| 29 F05 alone / F10 home game / F11 want | VERIFIED local repairs | One contextual header, full phone space, retained table, distinct agent/table taps, one want answer surface and safe table hit target. BUG-55 passes at 390×590 and 390×844. One-agent reference has no active home game; table furniture remains by Jens's override. |
| 29 F06 departure / F09 return | UNVERIFIED complete animation | Walking code exists; compare the authored three departure beats/1.8s and return/1.6s to actual transitions. Do not mark matched from static Home pairs. |
| 29 F07/F07b casino / F08/F08b own hand | VERIFIED local flow; PARTIAL visual coverage | Batch30 N3b pair and phone layout checks; actual live-table smoke and preserved Watch. Both quiet N3b and live-server N3 pairs are inspected in batch30. |
| 29 F12/F12b safe/ledger | VERIFIED local repair | Glass safe/ledger and real wallet tests; Home2 browser checks. Earlier BUG-39 status is superseded. |
| 29 F13 fridge | VERIFIED local implementation | Batch3 stock/prices/charged restock pair and server smoke. Current identity/condition flows and beer tests supersede the old “beer does nothing” note; final production playtest remains. |
| 29 F14/F15 human Sit/BET | VERIFIED locally | Phone existing Sit; batch25 desktop shared felt with real Join/action/Leave and 1280/1440/1920 geometry pairs. |
| 29 F16 retire / F18 pinch zoom | UNVERIFIED complete frames | Existing retire and FloorZoom code. Need direct browser interaction/state evidence and reference comparisons. |
| 29 F17 casino floor | VERIFIED local sizing; PARTIAL all states | Batch23 responsive/late-felt sizing, batch24 one header, batch26 actual owned/public Watch, batch29 saved identity. No claim that an ordinary floor pair covers every hot/empty/crowded frame. |
| 29 carry C1–C5 | VERIFIED repaired paths; PARTIAL walking coverage | BUG-43/45 re-enabled and fixed in batch15; explicit placement/cancel/refusal/fixture-capacity tests. Preserve the remaining unpaired transition distinction. |
| 29 G1–G4 / 31 Z1 guest | VERIFIED locally; production pending | Batches13/16/22 real guest room, claim and responsive entry. Last inspected public config guest=false; implementation does not imply enabled rollout. |
| 29 S1 story / S2 preview | PARTIAL, formats need port | Current SHARE-2 exists but server advertises a square 1080×1080 card. Reference specifies 1080×1920 and 1200×630, both from one proportional composition. Inspect/port these formats and real-data sharing; keep visit variant separate. |
| 31 P1–P13 older DESK-2 composition | SUPERSEDED layout; state audit remains | Later X/Y and C9 define the three columns. Retain applicable game/result/privacy states; do not restore old panels merely to match obsolete screenshots. |
| 31 X1–X3 flat/hover, X4 safe, X5 casino | VERIFIED local implementation | Batches12/17/18/19/23/24 wider room, compact profile/context header and floor. Current 38-case desktop run covers multiple widths and interaction. |
| 31 X6 Watch | VERIFIED local port | Batch28 shared 900×648 felt/context header/conversation; batch29 identity. Inspected owned/public pairs. Later permanent 250px roster supersedes the older miniature floor strip. |
| 31 X7/X8 Sit/BET | VERIFIED locally | Batch25 pairs and real server action smoke. The older “NOT BUILT” entry is obsolete. |
| 31 Y1–Y4 1920 variants | PARTIAL | 1920 browser checks pass; consolidate one-to-one comparison for every authored Y frame. |
| 40 H1/H2 and standalone L2 | VERIFIED local port with documented differences | Batches13/22/23/25/28: real guest room, nine sections, current product captures, responsive/reduced-motion checks. Guest-disabled deployments retain sign-in. Production served revision still unverified. |
| 41 B1/B3–B7/B9–B12: mark/reductions/icons/lockups/header/sign/share/loading | PARTIAL by application | Shared mark, favicon/install/touch exports and loading verified in batch20. Existing headers/signs are Railbird. Audit the share-card corner with S1/S2 and enumerate any remaining application rather than calling the whole board absent. |
| 41 B8/B14: bot avatar/description | Prepared assets; external application pending | Avatar export exists. BotFather application and account username remain external; no account change claimed. Last public botUsername=agenticpoker_bot. |
| 41 B13 empty room/far pose / B15 motion | PARTIAL | Actual empty room and shared loading present; kitchen table retained intentionally. Audit remaining mark motion/application against their precise frames. |
| 42 C1–C3 companion/conversation/want | VERIFIED local port with differences | Batch2 inspected pairs, real private conversation and actual hand card; 178px character follows implemented fit. Carry explicitly returns to the visible room for placement. |
| 42 C4 profile | VERIFIED local port with differences | Batch6 phone/batch18 desktop: name once, nature/birth, CONDITION/RECENT, real session values and More. No invented TONIGHT sum or nonexistent continuous stamina. |
| 42 C5–C6 roster/absence | PARTIAL | Batches5/7 pairs and current location/unread/want/identity. Friend's live table is not projected into this owner's roster; no backend permanent chair reservation is claimed. |
| 42 C7a/b TV live/tape | VERIFIED local state/tap with reference limitation | Batch8 real live Watch or authenticated latest/study hand, inactive when absent. Couch-facing-TV relocation explicitly unfinished in reference; retained room/table is intentional. |
| 42 C9 desktop companion | VERIFIED local port with differences | Batches12/17/18/19, pairs, complete desktop interactions. Real saved messages lack fabricated timestamps; hand card is not attached to a guessed sentence. |

## Undesigned or explicitly deferred

- Visit/knock/accept, referral door, two-agent share variant, public-account selfie states, and hold-to-fast-forward have no complete authored interaction design. Existing behavior can be tested and repaired, but it cannot be labelled reference parity.
- The coordinated flat-day behaviors are a future wave after friends' feedback. Existing routines and batch10 five-minutes-play/ten-off cadence remain; full invented furniture choreography is outside the supplied current design.
- Rare silver/gold birth rolls are explicitly parked in master-spec v14 until population justifies them. The cancelled collar does not authorize a new item economy.
- Notification delivery, guest enablement, username/domain/account setup, and production deployment are separate release tasks. No secret or paid API/model action is needed for the local visual audit.

## Ordered work remaining

1. Batch30 post-integration main checks passed. Batch31 audio/local browser/build/smoke/Home2 checks passed 106 server / 2225 client / 7 end-to-end; main integration follows.
2. Audio playback/C8 hooks are implemented in batch31 with original synthesis. Keep the saved preview available for listening feedback; do not represent it as a supplied recording.
3. Port S1/S2 share formats and compare populated/empty/failed-share states with actual data.
4. Close the UNVERIFIED expression/pose/empty/transition/retire/pinch/hot/1920 frame checks above. Repair reproduced failures and label deliberate differences.
5. Refresh final product captures and release evidence. Recheck branding applications and the original first-thirty-seconds journey across phone and desktop.
6. Final integrator fetch, checks and explicit push handoff. Jens pushes; verify deployed commit and production behavior afterwards. External account/feature settings and founder playtest remain explicit, not silently counted complete.

Current known tooling issues remain in BUGS.md: intermittent Windows child exits (BUG-94), earlier invite/draft test timeouts (BUG-102/109), and marketing capture timeout (BUG-110). Later successful runs are evidence, not proof of their original causes. Dependency audit remains unrun because automatic approval review rejected sending dependency metadata to npm; the approval question is still unanswered.
