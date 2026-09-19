# Railbird recovery audit — 19 September 2026

Review branch: `codex/railbird-recovery-audit`, from `19b34a4`.
Status: regression repair batch complete and locally verified; ready for review.
No push or deployment. Product gaps below remain open.

## Authority and baseline

Jens asked for an audit, cleanup, design ownership, and the complete pre-push
test gate. He selected a review branch. The attached Claude postmortem is
evidence, not a new set of user instructions. Its prohibition on making layout
decisions does not apply to this recovery. Existing art and design references
are retained; the changes below are intentional product repairs, not a claim
of matching missing wave 65 frames.

The only local main commit after the 0.18.0 candidate adds shipped screenshots.
TALK-1, TABLE-3 and wave 65 frames were not found in this checkout. Remote or
production state has not been asserted from the local checkout. The pre-existing
untracked `design-refs/shipped/trace/` directory was preserved.

## Findings and repair scope

| Area | Verified cause | Recovery |
| --- | --- | --- |
| Casino placement | Successful seating leaves the placement prop active; failed HTTP responses and network failures give no useful response. | Dismiss after success or authoritative seated state; show refusal/remedy; permit retry after failure. BUG-234/235. |
| Casino census | The header counts all occupied seats, including House players; it is not a count of this owner's agents. | Label public population and separately count owned agents and distinct tables. BUG-236. No phantom-seat claim. |
| Casino navigation and room | Home is below the large preview; nested height budgets let controls cover the room on short phones. | Reachable top navigation, compact table selector, room and controls in a consistent scrolling layout. BUG-237/232. |
| Shared-table updates | `heroAgentIdFor` selects only the first of two owned agents sharing a table. | Emit the existing `FLOOR_GAME` shape once per owned agent, preserving the table throttle, ownership gate and trailing updates. BUG-227. |
| Watch board | Preflop suppression only applies while the hand is live. An uncontested award falls into the padded five-back board. | Keep an undealt board empty after settlement too. BUG-238. |
| Watch conversation | Tapping the hero selects Stats; editing the composer does not change the tab. | Open Conversation and switch to it on composer interaction without dropping the draft. BUG-239/240. |
| Watch visibility | The private agent panel overlays the hero's cards. | Dock it below the felt with a one-third viewport budget, preserving the skill cluster and opponent reading behavior. BUG-241. |
| Session-end conversation | The ceremony opens chat state but simultaneously suppresses the panel. | An explicit Talk action dismisses the local ceremony and shows the conversation while retaining session context. BUG-247. |
| Rake | The result carries rake, but the felt has no render slot. | Use the authoritative settled result and retain a fixed slot at the pot. BUG-218. No rate change. |
| Credited awards | Settlement deducts rake from stacks/deltas while leaving winner amounts and the pot gross. Win narration and celebrations displayed those gross amounts as paid. | Derive display awards from the public rake breakdown; subtract each seat's cut once across side pots. Preserve settlement data. BUG-249. |
| Fridge | The UI shows unlabelled arrows and hard-codes purchases of six. | Visible stat labels and colored effects, brief explanation, single-item purchase and singular confirmation. BUG-242. |
| Home TV | `CasinoOnTv` intentionally hides the board/pot and renders dots; tests enforce that old decision. | Show the real public board, pot, identities and current turn in a larger readable television. BUG-243/244. |
| Home turn updates | `useHomeState` drops `FLOOR_GAME.toAct`; the shared preview omits explicit null clearing. | Carry public actor changes and clear the previous actor when the hand ends. BUG-244. |
| Wall monitors | `MiniFelt` reduces community cards to colored marks and inherits dark text on its dark screen. | Readable ranks/suits, actual current turn, legible name/pot text and no invented occupants. BUG-245. |
| Home conversation strip | Browser measurement is 78px against the existing 76px limit. | Repair the layout and reactivate the original assertion. BUG-233 is a height bug, not a contrast bug as described in the handoff. |
| Screenshot audit | The inventory still navigates to upstairs/backroom after the one-room change. | Remove retired room journeys, assert the current floor, and allow audit output outside the reference directory. The repaired 26-screen run passes. |

Independent review caught two follow-on cases before the gate: kitchen-table
agents must remain deployable and can redeploy after returning; a newly seated
second companion's not-yet-dealt view must not erase the first companion's
public board. The latter now takes common public state from the table's
`feltView()`, while private cards remain per seat. Both have regression tests.

The full client gate then caught two integration regressions. Queue receipts
may omit `agentId`; that existing response remains valid while an explicitly
mismatched ID is rejected. The enlarged TV entered the standing speech lane
by 2.5px, suppressing replies and recaps. Moving it 4px down restores all 39
existing bubble tests while keeping it clear of its seated viewer. The new
BUG-248 test protects all three geometries; no bubble collision rule changed.

Visual review also caught colliding six-seat money labels on the compact
Watch felt and result cards covering rake. The compact panel uses a clear
opponent row; closed-felt top stacks stay under their own seats. Result/rake
geometry is checked in the browser, including a major win.

Checking those captions exposed BUG-249: the server intentionally retains
gross winner amounts while deducting rake from stacks and deltas. Win display
surfaces now share a pure paid-award calculation using `rake.bySeat`. A $12,000
gross pot with a $60 cut displays $11,940 paid; profit still accounts for the
winner's contribution separately. Repeated side-pot entries subtract the cut
once. Unknown legacy split allocations are not invented, and no settlement
record is mutated. Eight regressions failed before this display correction.
Final caller review added five failing regressions for the shared formatter,
session ceremony, major-win accessible label and replay award. All result
sentences now accept the original wire record and calculate paid money once.

Final review caught a ceremony lifecycle edge case: opening Chat after a human
game must not permanently remove Play again/Back home. The conversation now
temporarily replaces the ceremony; closing either human or agent conversation
restores its choices. Both close paths failed before repair and now have tests.

The deployment workflow previously ran only the BUG-55 slice of Home's browser
tests. It now runs the complete Home and desk suites and dedicated floor/Watch
recovery specs, retaining the existing production smoke and Home2 gates.
The first expanded run passed 123/124; its short-phone TV check incorrectly
expected an offscreen wall monitor to keep painting. The existing visibility
pause is intentional. The test now returns that monitor to view before checking
its latest state, preserving every TV geometry, hit-target and turn assertion.
One later concurrent run lost the Vite listener after 55 successful cases;
the remaining 69 failed initial navigation with `ERR_CONNECTION_REFUSED`.
The log does not establish why that process stopped. That failed attempt is
preserved as `recovery-ci-server-loss.log`; final browser evidence comes from
a fresh sequential run, without changing product code or relaxing assertions.

## Foundations checked

- The complete server suite includes engine rules, seat admission, ownership,
  stamina, wallet and chip-conservation tests. The initial run passed these;
  one route verifier timed out starting its child server. It immediately passed
  standalone. This failure is retained in the evidence, not silently called a
  clean baseline.
- The first full client run passed all existing tests and failed the 13 newly
  added regression assertions across Watch, casino and Home. This establishes
  that the old green suite did not protect these reported behaviors.
- The full server end-to-end gate passed all seven wrapper tests, covering
  guest, seating, pace, personality, lifecycle and Watch journeys.
- `node scripts/audit-chips.js --json` reconciled the seeded scratch household
  with a zero chip delta. This does not prove the economy is enjoyable or that
  production balances reconcile.
- Automated runs use scratch persistence and keyless agents. No production
  database, real model budget, Telegram messages, or rake settings were changed.

## Important product gaps beyond the regression batch

1. **Economy and progression need a separate measured decision.** The checked-in
   ECON-1 report says policy-only play is approximately breakeven before rake
   and negative after it. Its 24,094-hand result is a simulation, not a sample
   of production players, and the exact real-House measurement script was not
   committed. The existing economy simulator begins with a synthetic opponent.
   Before tuning: preserve a reproducible real-cast benchmark, choose a target
   progression rate, and compare rake/cast changes against that target. The
   postmortem's proposed rates are not treated as an approved product decision.
2. **Agent conversation is still missing functionality.** No landed TALK-1
   implementation was found. Fixing the conversation panel does not make typed
   commands such as “go to the casino” execute or provide a bounded multi-turn
   command system. This needs a separately specified behavioral implementation.
3. **House characterization remains planned work.** Names and silhouettes do
   not provide the proposed individual dialogue and memory. No VILLAIN-1
   completion is claimed.
4. **Proxy trust needs deployment verification.** The rate limiter accepts the
   leftmost `x-forwarded-for` value without validating the socket's proxy trust.
   If the ingress accepts a client-supplied chain or the Node port is publicly
   reachable, a caller can vary that header to evade an IP bucket. The actual
   ingress/firewall configuration is not in this checkout. Validate it before
   declaring rate limiting hardened; a local code read cannot establish it.
5. **Real phone and model behavior remain separate evidence.** Desktop Chromium
   at phone sizes proves geometry and routes, not Telegram keyboard behavior,
   network startup on a real phone, private conversation quality or game feel.

## Verification evidence

Local logs and screenshots are in `artifacts/recovery-audit/`. The baseline
client log includes intentional failing regression tests; the final evidence
is listed separately below. The screenshot pack is a real API-seeded household on a
scratch server. Dedicated layout tests use declared deterministic fixtures.

| Gate | Result | Local evidence |
| --- | --- | --- |
| `npm test` | 184 passed, 2 intentional skips, 0 failures (186 wrapper tests) | `server-final.log` |
| `npm run test:e2e` | 7 passed, 0 failures | `e2e-final.log` |
| `npm run test:client` | 2,941 passed, 2 existing TODOs, 0 failures (238 files) | `client-final.log` |
| Production build | Passed; existing >500 kB chunk warning remains | `build-final.log` |
| Production browser smoke | 8 passed, 0 failures | `smoke.log` |
| Production Home2 layout | 20 passed, 0 failures | `home2.log` |
| Expanded CI browser command: Home, desk, floor recovery, Watch recovery | 124 passed, 0 failures, 0 skips | `recovery-ci-browser.log` |
| API-seeded shipped-screen audit | 26 passed, 0 failures | `shots.log` |
| Scratch chip reconciliation | Zero delta | `node scripts/audit-chips.js --json` |

Additional affected-suite coverage included appearance and Home journeys,
Watch10/TABLE-2, phone TV/bubble clearance, co-seated public/private updates,
and queue receipt compatibility. The final expanded CI command is recorded in
`.github/workflows/deploy.yml` and was run locally with its exact spec list.

The two server exclusions are the paid live-model conversation test and the
machine's persistent database reconciliation. Neither is silently treated as
passing. The client has two pre-existing TODOs (BUG-20 and BUG-39); this repair
adds no skipped tests. Local validation uses Windows/Node 24.15 and Chromium;
Linux/Node 22 CI has not run because this branch has not been pushed. Real
Telegram WebView behavior and live-model quality remain unverified here.

## Visual review

These are declared browser fixtures at native phone dimensions. They are not
production balances or a claim of matching the missing wave 65 references.

| Surface | 390×844 | Short phone / detail |
| --- | --- | --- |
| Casino floor | [Phone](../client/e2e/__screenshots__/recovery/floor-844.png) | [390×590](../client/e2e/__screenshots__/recovery/floor-590.png) |
| Casino zoom | [Phone](../client/e2e/__screenshots__/recovery/floor-zoom-844.png) | [390×590](../client/e2e/__screenshots__/recovery/floor-zoom-590.png) |
| Agent conversation | [Phone](../client/e2e/__screenshots__/recovery/watch-agent-844.png) | [390×590](../client/e2e/__screenshots__/recovery/watch-agent-590.png) |
| Agent skills | [Phone](../client/e2e/__screenshots__/recovery/watch-stats-844.png) | [390×590](../client/e2e/__screenshots__/recovery/watch-stats-590.png) |
| Paid award / rake | [Phone](../client/e2e/__screenshots__/recovery/watch-uncontested-rake-844.png) | [390×590](../client/e2e/__screenshots__/recovery/watch-uncontested-rake-590.png) |
| Major win / rake | — | [390×590](../client/e2e/__screenshots__/recovery/watch-major-rake-590.png) |
| Home TV and monitors | [Phone](../client/e2e/__screenshots__/recovery/home-tv-bug243-844.png) | [390×590, scrolled to TV](../client/e2e/__screenshots__/recovery/home-tv-bug243-590.png) |
| Fridge | [Labels, explanation and BUY 1](../client/e2e/__screenshots__/recovery/fridge-bug242-390.png) | Colors checked across all three appearances |

The real API-seeded screenshot pack is saved under
`artifacts/recovery-audit/shipped/`. The selected deterministic review images
above accompany this branch; the broader screenshot pack and execution logs
are local artifacts. The reference directory was not overwritten.
