# Railbird — decisions needing a design or founder choice

Updated 9 September 2026. Existing bug repairs continue autonomously. This file records additions or unresolved design choices; it is not an approval gate for already requested repairs. No proposal below has been implemented just because it is listed.

| Moment observed | Problem | Smallest change | Cost | Recommendation |
|---|---|---|---|---|
| Visit audit after Jens could not find how friends join | Visit/knock/accept and the referral doorway have working pieces but no complete authored interaction board. | Draw sender invitation, recipient preview/consent, knock, host acceptance, both households during a visit, shared kitchen Watch and return. | One design wave; no added model call is required. | Keep the current interaction and repair its bugs, including ownership checks; use a board before expanding it into a general shared-room feature. |
| Sharing an agent | The share card and visit variant lack a complete authored recipient state. | Draw the invitation text/card, expired or unavailable invitation, sender identity and recipient's next action. | One design wave; existing share renderer can be reused. | Repair bare-link text and blinking now; retain the existing visual treatment until designed. |
| Inspecting a fast-forwarded hand | Hold-to-fast-forward works without a supplied complete state design. | Draw the held affordance, progress, release, reduced-motion behavior and live/replay boundary. | One small design wave; no model call. | Keep it working without inventing a new Watch layout. |
| Reviewing authored haptics (BUG-30) | Older brief and HAPTIC4 disagree on soft/light and reveal/pot priority. | Choose one authored sequence and verify it on a physical phone. | Founder/device playtest; no bundle or model cost. | Keep the current tested sequence until the conflicting instruction is settled. |
| Reviewing the hidden prediction beat (BUG-31) | A default-off prediction feature has no current Watch placement. | Either explicitly retire it or draw its role without changing the manager game. | A design decision; implementation depends on that choice. | Keep it off; no new placement during the fidelity pass. |
| Final short-phone runout capture at390×590 | The stack text touches the equity meter in the existing Watch layout. | Adjust local clearance while keeping the same composition, if the corresponding reference confirms it. | CSS and a browser bounds regression; no model call. | Treat as a visible bug and verify against the authored geometry, not as permission to redesign Watch. |

No new optional server behavior flag has been introduced in this pass. Existing bar-location dialogue is a founder-reported bug being repaired, not a new routine feature.

| Moment observed | Problem | Smallest change | Cost | Recommendation |
|---|---|---|---|---|
| New-owner built two-minute playtest | “Nobody live” can sound as though the visible living agent is inactive or absent, although it counts casino play. | Clarify that count's label while keeping the separate roster button requested by Jens. | Copy decision and a tiny header pair; no model call. | Confirm the intended live-count meaning against the current header design before changing its label. |
| Four-stage draft comparison | Stage4's reference pill shows sample stamina96/heat6 before the server has generated an actual character. | Show only the real chosen name, or design a forming-state pill without invented resource readings. | Small design correction; no model call. | Keep the current real-name caption; mark the resource-pill difference PARTIAL. |
| Empty safe-ledger comparison | “Pull up for the ledger” removes its own prompt but an empty LedgerList draws no heading or rows. | Define the empty ledger state or omit the pull action until a real entry exists. | One state/copy decision and browser check. | Preserve honest empty history; do not fill it with sample transactions just to match F12b. |
