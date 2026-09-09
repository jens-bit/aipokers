# Railbird — current design gap inventory

Updated 9 September 2026 after batch 45. This is a source-indexed visual audit, not a deployment record. Source enumeration: [current-frame-inventory.json](../artifacts/current-frame-inventory.json). The previous batch 41 document is preserved **byte-for-byte** in [DESIGN_GAP_BATCH41.md](DESIGN_GAP_BATCH41.md); its older history remains in [DESIGN_GAP_HISTORY.md](DESIGN_GAP_HISTORY.md).

The previous grouped “VERIFIED” values recorded inspected implementation checks, selected pairs and successful journeys. Those results remain useful within their stated scope. They did not establish a complete current same-scale visual match for every individual frame and substate. The narrower statuses below measure that requirement; this is not a claim that earlier work was lost.

There are **185 authored frame/inset rows**, **466 composite substate rows** in [DESIGN_STATE_GAP.md](DESIGN_STATE_GAP.md), and **5 unboarded interactions**. These are enumeration counts, not independent product screens or a completion percentage. Current frame baseline: **0 SHIPPED · 99 PARTIAL · 80 BUILT? · 1 NOT BUILT · 0 NOT DESIGNED · 5 SUPERSEDED**. All five unboarded interactions are NOT DESIGNED.

| Status | Meaning |
|---|---|
| SHIPPED | Complete current frame/state has a same-scale reference-left/actual-right pair inspected with no unexplained mismatch. Functional gates alone do not qualify. No current row meets this full-frame standard. |
| PARTIAL | Implementation/evidence exists and a concrete presentation, state, data, policy or external-application difference remains. |
| BUILT? | Code or earlier evidence exists, but this individual current frame/state lacks inspected matching-pair proof. This does not mean the feature is absent. |
| NOT BUILT | An authored feature/state is absent from current implementation. |
| NOT DESIGNED | No complete authored interaction exists; repair of existing bugs does not authorize a new design. |
| SUPERSEDED | An explicit later reference or founder instruction replaces this application; applicable content/states remain separately tracked. |

## Evidence rules

Rows name the authored HTML frame, source symbol/line and required pair path. Source lines are from the inventory snapshot. Standalone pointers include the embedded resource UUID and its **decoded source line**, not a misleading line number in the containing HTML. HTML links target the visible frame. Parent rows link all enumerated children in the appendix.

**Unverified candidates/renders are discovery leads, not reviewed proof.** They may cover another state, scale or old revision. A composite or whole-page picture does not certify each child. A dash means no more specific difference was established in this source-enumeration pass; status and required-pair obligations still apply. Shared gap notes are linked once rather than repeated across hundreds of rows.

Pairs belong at the exact named path: reference left, current actual right, same scale; normally 390×844 phone and 1440×900 desktop, preserving other explicitly authored widths. Do not edit source art to force a match. Use real data or explicit controlled fixtures, never fabricated production facts. Tests, release status and external account configuration are separate evidence.

## Overrides and source conflicts

- **Founder:** retain kitchen table/home games, approved Watch composition, working human Sit, four draft stages without collar, Railbird ghost-at-rail branding, and roster control separate from live count. No shared-room redesign is inferred from permission to repair existing bugs.
- **Desktop retention:** [Board 31 introduction](<../design-refs/Agentic Poker Desktop Parity.html>) explicitly retains pace/wallet/floor/matrix/glass states. P1–P13 are not discarded as old layouts. The prior grouped supersession claim is replaced with individual PARTIAL entries.
- **Brand:** standalone embedded wave 62 bird artwork yields to current [Board 41](<../design-refs/Railbird Brand.html#b1>) ghost. Other standalone states remain. README one-colour law conflicts with B1's felt-tone exception at 96px and above; record a resolution before certifying every variant.
- **Notifications:** [Board 25 N6](<../design-refs/Agentic Poker Notifications.html#nbudget>) says 2/day, 4h gap,00–08 quiet; master v14§8.6 describes current 3/day, 30min,23–08 ladder. Latest objective requests Board 25 text verification, so current policy is not silently called a board match. N8's standalone growth ping remains absent.
- **Crossing:** F06/F09 HTML says 1.8s/1.6s; [mood-home2.jsx](../design-refs/mood-home2.jsx) uses 2.2s/1.9s. Use current source timing with the caption conflict explicit.
- **Artwork counts:** current source includes seven expressions and nine hand poses, including asleep and raise; stale Six/Eight captions do not remove them. Artwork, event trigger and hold timing require separate proof.
- **Foundation/applications:** locked char-* primitives coexist with later C2/C4 layouts. Do not infer all old profile/birth sizes or states were superseded; compare each application.
- **TV:** [C7b](<../design-refs/Railbird The Agent.html#c7b>) explicitly leaves couch-facing-TV unfinished under freeze. Do not invent a rearrangement and label it parity.

## Latest inspected partial evidence

[Batch 45 draft notes](../artifacts/batch45-draft-client-notes.md) record functioning 1→2→3→4 at three sizes, neutral hood before colour, real name/identity and safe retries. Pairs retain responsive glass position, current Home table, compact header, real transcript and 16px fields. Stage 4 has the real-name caption but lacks the reference name/resource pill; draft stamina/heat are not invented. The card retains the 96px well correction and Home backdrop. The 24-S5 pair is evidence for 40e's card application, not proof of the entire first-run journey or the separately named 24-40e target.

F12/F12b pairs include corrected typography/borders and removal of the extra title. **Room, actual data and external phone chrome still differ**; the actual ledger is honestly empty. These rows remain PARTIAL despite functional gates.

## Authored frames

### Board 24 · 14 frames

[Agentic Poker First Five Minutes.html](<../design-refs/Agentic Poker First Five Minutes.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-24-path"></a> **24-PATH · The path**<br>[9 substates](DESIGN_STATE_GAP.md#states-24-path) | PARTIAL | [HTML #strip · L73](<../design-refs/Agentic Poker First Five Minutes.html#strip>)<br>[FtuPathStrip · L424](<../design-refs/mood-ftu2.jsx#L424>) | Fresh-account path still needs all nine steps; actual Home entry replaces the sample casino entry. | `artifacts/pairs/24-PATH.png` |
| <a id="frame-24-40a"></a> **24-40a · 1 · Telegram** | PARTIAL | [HTML #s1 · L80](<../design-refs/Agentic Poker First Five Minutes.html#s1>)<br>[FtuTelegramScreenM · L38](<../design-refs/mood-ftu2.jsx#L38>) | Actual Telegram opening, CTA destination and truthful live count are not externally verified. | `artifacts/pairs/24-40a.png` |
| <a id="frame-24-40b"></a> **24-40b · 2 · The empty floor** | PARTIAL | [HTML #s2 · L86](<../design-refs/Agentic Poker First Five Minutes.html#s2>)<br>[FtuEmptyFloorScreenM · L63](<../design-refs/mood-ftu2.jsx#L63>) | Actual first room is Home with the retained kitchen table, not the older empty casino. | `artifacts/pairs/24-40b.png` |
| <a id="frame-24-40c"></a> **24-40c · 3 · The draft, empty** | PARTIAL | [HTML #s3 · L92](<../design-refs/Agentic Poker First Five Minutes.html#s3>)<br>[FtuDraftEmptyScreenM · L97](<../design-refs/mood-ftu2.jsx#L97>) | Current four-stage glass draft replaces the older grey draft; compare this exact first-run application. | `artifacts/pairs/24-40c.png` |
| <a id="frame-24-40d"></a> **24-40d · 4 · Brief usable** | PARTIAL | [HTML #s4 · L98](<../design-refs/Agentic Poker First Five Minutes.html#s4>)<br>[FtuDraftReadyScreenM · L120](<../design-refs/mood-ftu2.jsx#L120>) | A usable brief now asks for a name before Deal. The ready-only interaction is superseded, not every first-run state. | `artifacts/pairs/24-40d.png` |
| <a id="frame-24-40e"></a> **24-40e · 5 · The card** | PARTIAL | [HTML #s5 · L104](<../design-refs/Agentic Poker First Five Minutes.html#s5>)<br>[FtuBirthCardScreenM · L199](<../design-refs/mood-ftu2.jsx#L199>) | Returned name/identity/first words, 96px well correction and Home backdrop differ; inspected 24-S5 application pair remains partial.<br>Inspected partial: [24-S5.png](<../artifacts/pairs/24-S5.png>) | `artifacts/pairs/24-40e.png` |
| <a id="frame-24-40f"></a> **24-40f · 6 · He walks in** | PARTIAL | [HTML #s6 · L110](<../design-refs/Agentic Poker First Five Minutes.html#s6>)<br>[FtuWalkInScreenM · L218](<../design-refs/mood-ftu2.jsx#L218>) | Actual Home arrival and retained table replace the illustrated first casino arrival. | `artifacts/pairs/24-40f.png` |
| <a id="frame-24-40g"></a> **24-40g · 7 · His first hand** | PARTIAL | [HTML #s7 · L116](<../design-refs/Agentic Poker First Five Minutes.html#s7>)<br>[FtuFirstHandScreenM · L317](<../design-refs/mood-ftu2.jsx#L317>) | Preserve approved Watch; first-account deal/result/return need this isolated comparison. | `artifacts/pairs/24-40g.png` |
| <a id="frame-24-40h"></a> **24-40h · 8 · His first recap** | PARTIAL | [HTML #s8 · L122](<../design-refs/Agentic Poker First Five Minutes.html#s8>)<br>[FtuFirstRecapScreenM · L331](<../design-refs/mood-ftu2.jsx#L331>) | Real recap replaces sample outcomes; zero/one-session history omits a premature rate. | `artifacts/pairs/24-40h.png` |
| <a id="frame-24-40i"></a> **24-40i · 9 · You** | PARTIAL | [HTML #s9 · L128](<../design-refs/Agentic Poker First Five Minutes.html#s9>)<br>[FtuYouScreenM · L366](<../design-refs/mood-ftu2.jsx#L366>) | Current world navigation replaces bottom tabs; seeded wallet and totals must remain truthful. | `artifacts/pairs/24-40i.png` |
| <a id="frame-24-41"></a> **24-41 · Empty states, as matrix rows**<br>[7 substates](DESIGN_STATE_GAP.md#states-24-41) | PARTIAL | [HTML #mx · L134](<../design-refs/Agentic Poker First Five Minutes.html#mx>)<br>[FtuMatrixM · L445](<../design-refs/mood-ftu2.jsx#L445>) | Seven empty cases stay separate: Give replaces staking; seat taps replace the read tab; no invented history.<br>Unverified candidates: [design-batch37-empty.png](<../client/e2e/shots/design-batch37-empty.png>) | `artifacts/pairs/24-41.png` |
| <a id="frame-24-d1"></a> **24-D1 · Web login** | PARTIAL | [HTML #e1 · L141](<../design-refs/Agentic Poker First Five Minutes.html#e1>)<br>[D5FtuLoginScreenM · L512](<../design-refs/mood-ftu2.jsx#L512>) | Current guest/sign-in flow changes the older login composition; login content remains required. | `artifacts/pairs/24-D1.png` |
| <a id="frame-24-d2"></a> **24-D2 · The empty room** | PARTIAL | [HTML #e2 · L147](<../design-refs/Agentic Poker First Five Minutes.html#e2>)<br>[D5FtuEmptyScreenM · L537](<../design-refs/mood-ftu2.jsx#L537>) | Current Home/table and permanent roster replace the older empty-room shell. | `artifacts/pairs/24-D2.png` |
| <a id="frame-24-d3"></a> **24-D3 · His first hand** | PARTIAL | [HTML #e3 · L153](<../design-refs/Agentic Poker First Five Minutes.html#e3>)<br>[D5FtuFirstHandScreenM · L570](<../design-refs/mood-ftu2.jsx#L570>) | Current three-column first-hand application must retain approved Watch. | `artifacts/pairs/24-D3.png` |

### Board 25 · 9 frames

[Agentic Poker Notifications.html](<../design-refs/Agentic Poker Notifications.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-25-n0"></a> **25-N0 · Telegram chat**<br>[3 substates](DESIGN_STATE_GAP.md#states-25-n0) | PARTIAL | [HTML #nday · L67](<../design-refs/Agentic Poker Notifications.html#nday>)<br>[NotifyDayScreenM · L113](<../design-refs/mood-notify.jsx#L113>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N0.png` |
| <a id="frame-25-n1"></a> **25-N1 · Session recap**<br>[4 substates](DESIGN_STATE_GAP.md#states-25-n1) | PARTIAL | [HTML #n1 · L73](<../design-refs/Agentic Poker Notifications.html#n1>)<br>[Notif1 · L320](<../design-refs/mood-notify.jsx#L320>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N1.png` |
| <a id="frame-25-n2"></a> **25-N2 · The proposal**<br>[3 substates](DESIGN_STATE_GAP.md#states-25-n2) | PARTIAL | [HTML #n2 · L79](<../design-refs/Agentic Poker Notifications.html#n2>)<br>[Notif2 · L334](<../design-refs/mood-notify.jsx#L334>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N2.png` |
| <a id="frame-25-n3"></a> **25-N3 · The mood alert**<br>[4 substates](DESIGN_STATE_GAP.md#states-25-n3) | PARTIAL | [HTML #n3 · L85](<../design-refs/Agentic Poker Notifications.html#n3>)<br>[Notif3 · L347](<../design-refs/mood-notify.jsx#L347>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N3.png` |
| <a id="frame-25-n4"></a> **25-N4 · The quiet win**<br>[4 substates](DESIGN_STATE_GAP.md#states-25-n4) | PARTIAL | [HTML #n4 · L91](<../design-refs/Agentic Poker Notifications.html#n4>)<br>[Notif4 · L360](<../design-refs/mood-notify.jsx#L360>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N4.png` |
| <a id="frame-25-n5"></a> **25-N5 · The milestone**<br>[4 substates](DESIGN_STATE_GAP.md#states-25-n5) | PARTIAL | [HTML #n5 · L97](<../design-refs/Agentic Poker Notifications.html#n5>)<br>[Notif5 · L373](<../design-refs/mood-notify.jsx#L373>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N5.png` |
| <a id="frame-25-n6"></a> **25-N6 · The budget**<br>[8 substates](DESIGN_STATE_GAP.md#states-25-n6) | PARTIAL | [HTML #nbudget · L103](<../design-refs/Agentic Poker Notifications.html#nbudget>)<br>[BudgetBoard · L202](<../design-refs/mood-notify.jsx#L202>) | [G3](DESIGN_GAP.md#gap-g3) | `artifacts/pairs/25-N6.png` |
| <a id="frame-25-n7"></a> **25-N7 · The refusals**<br>[5 substates](DESIGN_STATE_GAP.md#states-25-n7) | PARTIAL | [HTML #nviolations · L109](<../design-refs/Agentic Poker Notifications.html#nviolations>)<br>[ViolationsBoard · L286](<../design-refs/mood-notify.jsx#L286>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/25-N7.png` |
| <a id="frame-25-n8"></a> **25-N8 · He grew**<br>[4 substates](DESIGN_STATE_GAP.md#states-25-n8) | NOT BUILT | [HTML #n6 · L115](<../design-refs/Agentic Poker Notifications.html#n6>)<br>[Notif6 · L386](<../design-refs/mood-notify.jsx#L386>) | [G31](DESIGN_GAP.md#gap-g31) | `artifacts/pairs/25-N8.png` |

### Board 26 · 16 frames

[Agentic Poker Watch v5.html](<../design-refs/Agentic Poker Watch v5.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-26-52a"></a> **26-52a · Seated · betting** | BUILT? | [HTML #v1 · L76](<../design-refs/Agentic Poker Watch v5.html#v1>)<br>[V5CalmScreenM · L672](<../design-refs/mood-watch5.jsx#L672>) | — | `artifacts/pairs/26-52a.png` |
| <a id="frame-26-52b"></a> **26-52b · Pre-flop** | BUILT? | [HTML #v2 · L81](<../design-refs/Agentic Poker Watch v5.html#v2>)<br>[V5HoldScreenM · L679](<../design-refs/mood-watch5.jsx#L679>) | —<br>Unverified candidates: [design-batch37-empty.png](<../client/e2e/shots/design-batch37-empty.png>) | `artifacts/pairs/26-52b.png` |
| <a id="frame-26-52c"></a> **26-52c · A whisper** | BUILT? | [HTML #v3 · L86](<../design-refs/Agentic Poker Watch v5.html#v3>)<br>[V5WhisperScreenM · L687](<../design-refs/mood-watch5.jsx#L687>) | —<br>Unverified candidates: [design-batch40-watch-overlays.png](<../client/e2e/shots/design-batch40-watch-overlays.png>) | `artifacts/pairs/26-52c.png` |
| <a id="frame-26-52d"></a> **26-52d · The thread** | PARTIAL | [HTML #v4 · L91](<../design-refs/Agentic Poker Watch v5.html#v4>)<br>[V5ThreadScreenM · L696](<../design-refs/mood-watch5.jsx#L696>) | [G1](DESIGN_GAP.md#gap-g1)<br>Unverified candidates: [design-batch40-watch-companion.png](<../client/e2e/shots/design-batch40-watch-companion.png>) | `artifacts/pairs/26-52d.png` |
| <a id="frame-26-52e"></a> **26-52e · A read** | BUILT? | [HTML #v5 · L96](<../design-refs/Agentic Poker Watch v5.html#v5>)<br>[V5ReadScreenM · L704](<../design-refs/mood-watch5.jsx#L704>) | —<br>Unverified candidates: [design-batch40-watch-overlays.png](<../client/e2e/shots/design-batch40-watch-overlays.png>) | `artifacts/pairs/26-52e.png` |
| <a id="frame-26-52f"></a> **26-52f · A cost, as a toast** | BUILT? | [HTML #v6 · L101](<../design-refs/Agentic Poker Watch v5.html#v6>)<br>[V5CostScreenM · L712](<../design-refs/mood-watch5.jsx#L712>) | —<br>Unverified candidates: [design-batch40-watch-cost.png](<../client/e2e/shots/design-batch40-watch-cost.png>) | `artifacts/pairs/26-52f.png` |
| <a id="frame-26-52k"></a> **26-52k · …collapsed to a dot** | BUILT? | [HTML #v11 · L106](<../design-refs/Agentic Poker Watch v5.html#v11>)<br>[V5CostDotScreenM · L746](<../design-refs/mood-watch5.jsx#L746>) | —<br>Unverified candidates: [design-batch40-watch-cost.png](<../client/e2e/shots/design-batch40-watch-cost.png>) | `artifacts/pairs/26-52k.png` |
| <a id="frame-26-52g"></a> **26-52g · WON** | PARTIAL | [HTML #v7 · L114](<../design-refs/Agentic Poker Watch v5.html#v7>)<br>[V5CeremonyWonScreenM · L728](<../design-refs/mood-watch5.jsx#L728>) | [G6](DESIGN_GAP.md#gap-g6) | `artifacts/pairs/26-52g.png` |
| <a id="frame-26-52h"></a> **26-52h · LOST · tilted** | PARTIAL | [HTML #v8 · L119](<../design-refs/Agentic Poker Watch v5.html#v8>)<br>[V5CeremonyLostScreenM · L737](<../design-refs/mood-watch5.jsx#L737>) | [G6](DESIGN_GAP.md#gap-g6) | `artifacts/pairs/26-52h.png` |
| <a id="frame-26-52i"></a> **26-52i · An opponent mucks**<br>[3 substates](DESIGN_STATE_GAP.md#states-26-52i) | BUILT? | [HTML #v9 · L124](<../design-refs/Agentic Poker Watch v5.html#v9>)<br>[OppMuckStripM · L628](<../design-refs/mood-watch5.jsx#L628>) | — | `artifacts/pairs/26-52i.png` |
| <a id="frame-26-52j"></a> **26-52j · A bet, as objects**<br>[4 substates](DESIGN_STATE_GAP.md#states-26-52j) | BUILT? | [HTML #v10 · L130](<../design-refs/Agentic Poker Watch v5.html#v10>)<br>[HeroBetStripM · L425](<../design-refs/mood-watch5.jsx#L425>) | — | `artifacts/pairs/26-52j.png` |
| <a id="frame-26-52m"></a> **26-52m · The anatomy** | BUILT? | [HTML #v12 · L138](<../design-refs/Agentic Poker Watch v5.html#v12>)<br>[SeatAnatomyM · L529](<../design-refs/mood-watch5.jsx#L529>) | — | `artifacts/pairs/26-52m.png` |
| <a id="frame-26-52n"></a> **26-52n · Table sizes**<br>[5 substates](DESIGN_STATE_GAP.md#states-26-52n) | BUILT? | [HTML #v13 · L143](<../design-refs/Agentic Poker Watch v5.html#v13>)<br>[TableSizesM · L577](<../design-refs/mood-watch5.jsx#L577>) | —<br>Unverified candidates: [design-batch40-watch-rings.png](<../client/e2e/shots/design-batch40-watch-rings.png>) | `artifacts/pairs/26-52n.png` |
| <a id="frame-26-52p"></a> **26-52p · An ordinary win** | PARTIAL | [HTML #v14 · L151](<../design-refs/Agentic Poker Watch v5.html#v14>)<br>[AgentCelebWinM · L236](<../design-refs/mood-agent2.jsx#L236>) | [G6](DESIGN_GAP.md#gap-g6)<br>Unverified candidates: [overnight-batch11-celebration-c8a.png](<../client/e2e/shots/overnight-batch11-celebration-c8a.png>) | `artifacts/pairs/26-52p.png` |
| <a id="frame-26-52q"></a> **26-52q · A big win** | PARTIAL | [HTML #v15 · L156](<../design-refs/Agentic Poker Watch v5.html#v15>)<br>[AgentCelebBigM · L237](<../design-refs/mood-agent2.jsx#L237>) | [G6](DESIGN_GAP.md#gap-g6)<br>Unverified candidates: [overnight-batch11-celebration-c8b.png](<../client/e2e/shots/overnight-batch11-celebration-c8b.png>) | `artifacts/pairs/26-52q.png` |
| <a id="frame-26-52r"></a> **26-52r · A bust** | PARTIAL | [HTML #v16 · L161](<../design-refs/Agentic Poker Watch v5.html#v16>)<br>[AgentCelebBustM · L238](<../design-refs/mood-agent2.jsx#L238>) | [G6](DESIGN_GAP.md#gap-g6)<br>Unverified candidates: [overnight-batch11-celebration-c8c.png](<../client/e2e/shots/overnight-batch11-celebration-c8c.png>) | `artifacts/pairs/26-52r.png` |

### Board 27 · 3 frames

[Agentic Poker Casino.html](<../design-refs/Agentic Poker Casino.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-27-k1"></a> **27-K1 · Arriving with an agent** | BUILT? | [HTML #k1 · L73](<../design-refs/Agentic Poker Casino.html#k1>)<br>[CasinoDeployM · L656](<../design-refs/mood-floor3.jsx#L656>) | — | `artifacts/pairs/27-K1.png` |
| <a id="frame-27-k2"></a> **27-K2 · The board by the stairs** | BUILT? | [HTML #k2 · L79](<../design-refs/Agentic Poker Casino.html#k2>)<br>[CasinoBoardM · L669](<../design-refs/mood-floor3.jsx#L669>) | —<br>Unverified candidates: [design-batch30-casino-live.png](<../client/e2e/shots/design-batch30-casino-live.png>) | `artifacts/pairs/27-K2.png` |
| <a id="frame-27-k3"></a> **27-K3 · A felt goes hot** | BUILT? | [HTML #k3 · L85](<../design-refs/Agentic Poker Casino.html#k3>)<br>[CasinoHotM · L688](<../design-refs/mood-floor3.jsx#L688>) | —<br>Unverified candidates: [design-batch37-hot.png](<../client/e2e/shots/design-batch37-hot.png>) | `artifacts/pairs/27-K3.png` |

### Board 29 · 35 frames

[Agentic Poker Home.html](<../design-refs/Agentic Poker Home.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-29-f01"></a> **29-F01 · Open · nobody yet** | PARTIAL | [HTML #f01 · L121](<../design-refs/Agentic Poker Home.html#f01>)<br>[NavEmptyM · L391](<../design-refs/mood-nav.jsx#L391>) | Retained table, contextual header and current empty invitation differ from the sample.<br>Unverified candidates: [overnight-batch1-home-empty.png](<../client/e2e/shots/overnight-batch1-home-empty.png>) | `artifacts/pairs/29-F01.png` |
| <a id="frame-29-f02"></a> **29-F02 · The draft opens** | PARTIAL | [HTML #f02 · L128](<../design-refs/Agentic Poker Home.html#f02>)<br>[Draft1M · L241](<../design-refs/mood-sit.jsx#L241>) | Final batch 45 opening pair inspected: responsive glass edge, compact header, real opener and 16px field differ.<br>Inspected partial: [29-F02.png](<../artifacts/pairs/29-F02.png>) | `artifacts/pairs/29-F02.png` |
| <a id="frame-29-f02b"></a> **29-F02b · He forms**<br>[4 substates](DESIGN_STATE_GAP.md#states-29-f02b) | PARTIAL | [HTML #f02b · L134](<../design-refs/Agentic Poker Home.html#f02b>)<br>[FormingStripM · L247](<../design-refs/mood-sit.jsx#L247>) | Final quick path visibly 1→2→3→4; neutral hood before colour, no collar. Full-screen middle-stage pairs are not an identical composite-strip layout.<br>Inspected partial: [29-F02b.png](<../artifacts/pairs/29-F02b.png>), [29-F02b-stage2.png](<../artifacts/pairs/29-F02b-stage2.png>), [29-F02b-stage3.png](<../artifacts/pairs/29-F02b-stage3.png>) | `artifacts/pairs/29-F02b.png` |
| <a id="frame-29-f03"></a> **29-F03 · Colour and name** | PARTIAL | [HTML #f03 · L141](<../design-refs/Agentic Poker Home.html#f03>)<br>[Draft4M · L243](<../design-refs/mood-sit.jsx#L243>) | Actual name question occurs with eyes, then accepted name brings colour. Exact F03 final-colour/name comparison is still required. | `artifacts/pairs/29-F03.png` |
| <a id="frame-29-f03b"></a> **29-F03b · He has a name** | PARTIAL | [HTML #f03b · L147](<../design-refs/Agentic Poker Home.html#f03b>)<br>[Draft5M · L244](<../design-refs/mood-sit.jsx#L244>) | Final batch 45 named pair inspected: real-name caption/Deal present; reference name/resource pill absent. No fabricated pre-birth stamina/heat.<br>Inspected partial: [29-F03b.png](<../artifacts/pairs/29-F03b.png>)<br>Unverified candidates: [overnight-batch4-birth-card.png](<../client/e2e/shots/overnight-batch4-birth-card.png>) | `artifacts/pairs/29-F03b.png` |
| <a id="frame-29-f04"></a> **29-F04 · Born · he walks in**<br>[3 substates](DESIGN_STATE_GAP.md#states-29-f04) | PARTIAL | [HTML #f04 · L154](<../design-refs/Agentic Poker Home.html#f04>)<br>[BirthWalkInStripM · L742](<../design-refs/mood-home2.jsx#L742>) | Actual born body/Home arrival exists; all three authored beats still require individual current pairs. | `artifacts/pairs/29-F04.png` |
| <a id="frame-29-f05"></a> **29-F05 · Alone at home** | PARTIAL | [HTML #f05 · L161](<../design-refs/Agentic Poker Home.html#f05>)<br>[HomeAloneM · L579](<../design-refs/mood-home.jsx#L579>) | [G24](DESIGN_GAP.md#gap-g24)<br>Unverified candidates: [overnight-batch1-home-alone.png](<../client/e2e/shots/overnight-batch1-home-alone.png>) | `artifacts/pairs/29-F05.png` |
| <a id="frame-29-f06"></a> **29-F06 · Sent out**<br>[3 substates](DESIGN_STATE_GAP.md#states-29-f06) | PARTIAL | [HTML #f06 · L168](<../design-refs/Agentic Poker Home.html#f06>)<br>[WalkOutStripM · L1055](<../design-refs/mood-home2.jsx#L1055>) | [G20](DESIGN_GAP.md#gap-g20)<br>Unverified candidates: [design-batch33-out.png](<../client/e2e/shots/design-batch33-out.png>) | `artifacts/pairs/29-F06.png` |
| <a id="frame-29-f07"></a> **29-F07 · The casino** | PARTIAL | [HTML #f07 · L175](<../design-refs/Agentic Poker Home.html#f07>)<br>[NavCasinoM · L266](<../design-refs/mood-nav.jsx#L266>) | [G18](DESIGN_GAP.md#gap-g18)<br>Unverified candidates: [design-batch30-casino-live.png](<../client/e2e/shots/design-batch30-casino-live.png>) | `artifacts/pairs/29-F07.png` |
| <a id="frame-29-f07b"></a> **29-F07b · Nobody of yours in** | PARTIAL | [HTML #f07b · L181](<../design-refs/Agentic Poker Home.html#f07b>)<br>[NavCasinoIdleM · L298](<../design-refs/mood-nav.jsx#L298>) | [G18](DESIGN_GAP.md#gap-g18)<br>Unverified candidates: [design-batch30-casino-n3b.png](<../client/e2e/shots/design-batch30-casino-n3b.png>) | `artifacts/pairs/29-F07b.png` |
| <a id="frame-29-f08"></a> **29-F08 · His table** | BUILT? | [HTML #f08 · L188](<../design-refs/Agentic Poker Home.html#f08>)<br>[V5CalmScreenM · L672](<../design-refs/mood-watch5.jsx#L672>) | — | `artifacts/pairs/29-F08.png` |
| <a id="frame-29-f08b"></a> **29-F08b · The hand ends** | BUILT? | [HTML #f08b · L194](<../design-refs/Agentic Poker Home.html#f08b>)<br>[V5CeremonyWonScreenM · L728](<../design-refs/mood-watch5.jsx#L728>) | — | `artifacts/pairs/29-F08b.png` |
| <a id="frame-29-f09"></a> **29-F09 · He comes home**<br>[3 substates](DESIGN_STATE_GAP.md#states-29-f09) | PARTIAL | [HTML #f09 · L201](<../design-refs/Agentic Poker Home.html#f09>)<br>[WalkHomeStripM · L1056](<../design-refs/mood-home2.jsx#L1056>) | [G20](DESIGN_GAP.md#gap-g20)<br>Unverified candidates: [design-batch33-home.png](<../client/e2e/shots/design-batch33-home.png>) | `artifacts/pairs/29-F09.png` |
| <a id="frame-29-f10"></a> **29-F10 · The home game** | PARTIAL | [HTML #f10 · L208](<../design-refs/Agentic Poker Home.html#f10>)<br>[FourApartM · L348](<../design-refs/mood-nav.jsx#L348>) | [G24](DESIGN_GAP.md#gap-g24)<br>Unverified candidates: [overnight-batch1-home-game.png](<../client/e2e/shots/overnight-batch1-home-game.png>) | `artifacts/pairs/29-F10.png` |
| <a id="frame-29-f11"></a> **29-F11 · A want** | PARTIAL | [HTML #f11 · L215](<../design-refs/Agentic Poker Home.html#f11>)<br>[HomeWantM · L472](<../design-refs/mood-home2.jsx#L472>) | [G24](DESIGN_GAP.md#gap-g24) | `artifacts/pairs/29-F11.png` |
| <a id="frame-29-f12"></a> **29-F12 · The safe** | PARTIAL | [HTML #f12 · L222](<../design-refs/Agentic Poker Home.html#f12>)<br>[SafeSheetM · L252](<../design-refs/mood-floor58.jsx#L252>) | Batch 45 pair inspected: authored typography/borders repaired and redundant title removed; room/data/external phone chrome still differ.<br>Inspected partial: [29-F12.png](<../artifacts/pairs/29-F12.png>)<br>Unverified candidates: [29-F12.png](<../artifacts/pairs/29-F12.png>) | `artifacts/pairs/29-F12.png` |
| <a id="frame-29-f12b"></a> **29-F12b · The ledger** | PARTIAL | [HTML #f12b · L228](<../design-refs/Agentic Poker Home.html#f12b>)<br>[SafeLedgerM · L253](<../design-refs/mood-floor58.jsx#L253>) | Batch 45 pair inspected: newest-first ledger/typography repaired; actual ledger is honestly empty, and room/data/chrome differ.<br>Inspected partial: [29-F12b.png](<../artifacts/pairs/29-F12b.png>)<br>Unverified candidates: [29-F12b.png](<../artifacts/pairs/29-F12b.png>) | `artifacts/pairs/29-F12b.png` |
| <a id="frame-29-f13"></a> **29-F13 · The fridge** | PARTIAL | [HTML #f13 · L235](<../design-refs/Agentic Poker Home.html#f13>)<br>[FridgeOpenM · L611](<../design-refs/mood-home2.jsx#L611>) | [G11](DESIGN_GAP.md#gap-g11)<br>Unverified candidates: [overnight-batch3-fridge-f13.png](<../client/e2e/shots/overnight-batch3-fridge-f13.png>) | `artifacts/pairs/29-F13.png` |
| <a id="frame-29-f14"></a> **29-F14 · You sit down** | PARTIAL | [HTML #f14 · L242](<../design-refs/Agentic Poker Home.html#f14>)<br>[SitDownM · L117](<../design-refs/mood-sit.jsx#L117>) | [G24](DESIGN_GAP.md#gap-g24) | `artifacts/pairs/29-F14.png` |
| <a id="frame-29-f15"></a> **29-F15 · BET** | PARTIAL | [HTML #f15 · L249](<../design-refs/Agentic Poker Home.html#f15>)<br>[SitBetM · L128](<../design-refs/mood-sit.jsx#L128>) | [G24](DESIGN_GAP.md#gap-g24) | `artifacts/pairs/29-F15.png` |
| <a id="frame-29-f16"></a> **29-F16 · One retires** | BUILT? | [HTML #f16 · L256](<../design-refs/Agentic Poker Home.html#f16>)<br>[NavRetiredM · L410](<../design-refs/mood-nav.jsx#L410>) | —<br>Unverified candidates: [design-batch36-retire.png](<../client/e2e/shots/design-batch36-retire.png>) | `artifacts/pairs/29-F16.png` |
| <a id="frame-29-f17"></a> **29-F17 · The floor** | BUILT? | [HTML #f17 · L263](<../design-refs/Agentic Poker Home.html#f17>)<br>[FloorScreenM · L117](<../design-refs/mood-floor58.jsx#L117>) | — | `artifacts/pairs/29-F17.png` |
| <a id="frame-29-f18"></a> **29-F18 · Pinching in** | BUILT? | [HTML #f18 · L270](<../design-refs/Agentic Poker Home.html#f18>)<br>[FloorZoomM · L136](<../design-refs/mood-floor58.jsx#L136>) | —<br>Unverified candidates: [design-batch36-zoom.png](<../client/e2e/shots/design-batch36-zoom.png>) | `artifacts/pairs/29-F18.png` |
| <a id="frame-29-c1"></a> **29-C1 · The lift** | BUILT? | [HTML #c1 · L278](<../design-refs/Agentic Poker Home.html#c1>)<br>[CarryLiftM · L107](<../design-refs/mood-carry.jsx#L107>) | —<br>Unverified candidates: [design-batch41-carry-lift-drag.png](<../client/e2e/shots/design-batch41-carry-lift-drag.png>) | `artifacts/pairs/29-C1.png` |
| <a id="frame-29-c2"></a> **29-C2 · Dragging** | BUILT? | [HTML #c2 · L284](<../design-refs/Agentic Poker Home.html#c2>)<br>[CarryDragM · L116](<../design-refs/mood-carry.jsx#L116>) | —<br>Unverified candidates: [design-batch41-carry-lift-drag.png](<../client/e2e/shots/design-batch41-carry-lift-drag.png>) | `artifacts/pairs/29-C2.png` |
| <a id="frame-29-c2b"></a> **29-C2b · Over the door** | BUILT? | [HTML #c2b · L290](<../design-refs/Agentic Poker Home.html#c2b>)<br>[CarryDoorM · L127](<../design-refs/mood-carry.jsx#L127>) | —<br>Unverified candidates: [design-batch41-carry-door-refusal.png](<../client/e2e/shots/design-batch41-carry-door-refusal.png>) | `artifacts/pairs/29-C2b.png` |
| <a id="frame-29-c3"></a> **29-C3 · The drop** | BUILT? | [HTML #c3 · L296](<../design-refs/Agentic Poker Home.html#c3>)<br>[CarryDropM · L137](<../design-refs/mood-carry.jsx#L137>) | —<br>Unverified candidates: [design-batch41-carry-drop-desktop.png](<../client/e2e/shots/design-batch41-carry-drop-desktop.png>) | `artifacts/pairs/29-C3.png` |
| <a id="frame-29-c4"></a> **29-C4 · He refuses** | BUILT? | [HTML #c4 · L302](<../design-refs/Agentic Poker Home.html#c4>)<br>[CarryRefuseM · L149](<../design-refs/mood-carry.jsx#L149>) | —<br>Unverified candidates: [design-batch41-carry-door-refusal.png](<../client/e2e/shots/design-batch41-carry-door-refusal.png>) | `artifacts/pairs/29-C4.png` |
| <a id="frame-29-c5"></a> **29-C5 · Four states**<br>[4 substates](DESIGN_STATE_GAP.md#states-29-c5) | BUILT? | [HTML #c5 · L308](<../design-refs/Agentic Poker Home.html#c5>)<br>[CarryStatesM · L163](<../design-refs/mood-carry.jsx#L163>) | —<br>Unverified candidates: [design-batch41-carry-lift-drag.png](<../client/e2e/shots/design-batch41-carry-lift-drag.png>) | `artifacts/pairs/29-C5.png` |
| <a id="frame-29-g1"></a> **29-G1 · The recruiter is already up** | BUILT? | [HTML #g1 · L316](<../design-refs/Agentic Poker Home.html#g1>)<br>[GuestDraftM · L50](<../design-refs/mood-guest.jsx#L50>) | — | `artifacts/pairs/29-G1.png` |
| <a id="frame-29-g2"></a> **29-G2 · He walks in** | BUILT? | [HTML #g2 · L322](<../design-refs/Agentic Poker Home.html#g2>)<br>[GuestBornM · L84](<../design-refs/mood-guest.jsx#L84>) | — | `artifacts/pairs/29-G2.png` |
| <a id="frame-29-g3"></a> **29-G3 · His one session** | BUILT? | [HTML #g3 · L328](<../design-refs/Agentic Poker Home.html#g3>)<br>[GuestWatchM · L106](<../design-refs/mood-guest.jsx#L106>) | — | `artifacts/pairs/29-G3.png` |
| <a id="frame-29-g4"></a> **29-G4 · The claim wall** | BUILT? | [HTML #g4 · L334](<../design-refs/Agentic Poker Home.html#g4>)<br>[GuestClaimM · L173](<../design-refs/mood-guest.jsx#L173>) | — | `artifacts/pairs/29-G4.png` |
| <a id="frame-29-s1"></a> **29-S1 · 1080 × 1920** | BUILT? | [HTML #s1 · L342](<../design-refs/Agentic Poker Home.html#s1>)<br>[ShareStoryM · L259](<../design-refs/mood-guest.jsx#L259>) | —<br>Unverified candidates: [design-batch32-s1.png](<../client/e2e/shots/design-batch32-s1.png>) | `artifacts/pairs/29-S1.png` |
| <a id="frame-29-s2"></a> **29-S2 · 1200 × 630** | BUILT? | [HTML #s2 · L348](<../design-refs/Agentic Poker Home.html#s2>)<br>[ShareOgM · L260](<../design-refs/mood-guest.jsx#L260>) | —<br>Unverified candidates: [design-batch32-s2.png](<../client/e2e/shots/design-batch32-s2.png>) | `artifacts/pairs/29-S2.png` |

### Board 31 · 29 frames

[Agentic Poker Desktop Parity.html](<../design-refs/Agentic Poker Desktop Parity.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-31-audit"></a> **31-AUDIT · 1 · The audit**<br>[31 substates](DESIGN_STATE_GAP.md#states-31-audit) | PARTIAL | [HTML #a1 · L83](<../design-refs/Agentic Poker Desktop Parity.html#a1>)<br>[AuditSheetM · L77](<../design-refs/mood-desk-parity.jsx#L77>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-AUDIT.png` |
| <a id="frame-31-p1"></a> **31-P1 · DEAL** | PARTIAL | [HTML #d1 · L90](<../design-refs/Agentic Poker Desktop Parity.html#d1>)<br>[D7W4DealScreenM · L19](<../design-refs/mood-desk-parity2.jsx#L19>) | DEAL state remains required in the current shell; it is not discarded as an old composition. | `artifacts/pairs/31-P1.png` |
| <a id="frame-31-p2"></a> **31-P2 · HEATING** | PARTIAL | [HTML #d2 · L96](<../design-refs/Agentic Poker Desktop Parity.html#d2>)<br>[D7W4HeatingScreenM · L31](<../design-refs/mood-desk-parity2.jsx#L31>) | HEATING remains required; compare mood/rope/hand and rail together. | `artifacts/pairs/31-P2.png` |
| <a id="frame-31-p3"></a> **31-P3 · ALL-IN** | PARTIAL | [HTML #d3 · L102](<../design-refs/Agentic Poker Desktop Parity.html#d3>)<br>[D7W4AllInScreenM · L43](<../design-refs/mood-desk-parity2.jsx#L43>) | ALL-IN remains required; compare hidden/public cards, runout and result clarity. | `artifacts/pairs/31-P3.png` |
| <a id="frame-31-p4"></a> **31-P4 · Between hands** | PARTIAL | [HTML #d4 · L108](<../design-refs/Agentic Poker Desktop Parity.html#d4>)<br>[D7W4BetweenScreenM · L59](<../design-refs/mood-desk-parity2.jsx#L59>) | Between-hands remains required; current faster pacing must not leave stale cards. | `artifacts/pairs/31-P4.png` |
| <a id="frame-31-p5"></a> **31-P5 · Collect** | PARTIAL | [HTML #d5 · L116](<../design-refs/Agentic Poker Desktop Parity.html#d5>)<br>[D7CollectScreenM · L76](<../design-refs/mood-desk-parity2.jsx#L76>) | Collect remains required with real funds and mutation/error states. | `artifacts/pairs/31-P5.png` |
| <a id="frame-31-p6"></a> **31-P6 · Broke and cut off**<br>[3 substates](DESIGN_STATE_GAP.md#states-31-p6) | PARTIAL | [HTML #d6 · L122](<../design-refs/Agentic Poker Desktop Parity.html#d6>)<br>[D7WalletBrokeScreenM · L125](<../design-refs/mood-desk-parity2.jsx#L125>) | Broke, cut-off and nothing-staked remain three separate required states. | `artifacts/pairs/31-P6.png` |
| <a id="frame-31-p7"></a> **31-P7 · Resting, and breathing** | PARTIAL | [HTML #d7 · L130](<../design-refs/Agentic Poker Desktop Parity.html#d7>)<br>[D7FloorRestingScreenM · L179](<../design-refs/mood-desk-parity2.jsx#L179>) | Resting-room state remains required; current routines/spacing differ from sample cast. | `artifacts/pairs/31-P7.png` |
| <a id="frame-31-p8"></a> **31-P8 · No brief** | PARTIAL | [HTML #d8 · L138](<../design-refs/Agentic Poker Desktop Parity.html#d8>)<br>[D7FtuDraftScreenM · L230](<../design-refs/mood-desk-parity2.jsx#L230>) | Current named glass draft replaces blank-brief presentation; the desktop source state remains tracked. | `artifacts/pairs/31-P8.png` |
| <a id="frame-31-p9"></a> **31-P9 · First recap**<br>[3 substates](DESIGN_STATE_GAP.md#states-31-p9) | PARTIAL | [HTML #d9 · L144](<../design-refs/Agentic Poker Desktop Parity.html#d9>)<br>[D7FtuRecapScreenM · L274](<../design-refs/mood-desk-parity2.jsx#L274>) | No flags, no history and first cost remain distinct; no fabricated hand/history. | `artifacts/pairs/31-P9.png` |
| <a id="frame-31-p10"></a> **31-P10 · Heat 0–100 · the seat pip · the ledger**<br>[6 substates](DESIGN_STATE_GAP.md#states-31-p10) | PARTIAL | [HTML #d10 · L152](<../design-refs/Agentic Poker Desktop Parity.html#d10>)<br>[D7HeatScreenM · L339](<../design-refs/mood-desk-parity2.jsx#L339>) | Four heat values, seat biography pip and ledger remain separate requirements. | `artifacts/pairs/31-P10.png` |
| <a id="frame-31-matrix"></a> **31-MATRIX · 3 · One desktop matrix**<br>[18 substates](DESIGN_STATE_GAP.md#states-31-matrix) | PARTIAL | [HTML #m1 · L163](<../design-refs/Agentic Poker Desktop Parity.html#m1>)<br>[DeskMatrixM · L415](<../design-refs/mood-desk-parity2.jsx#L415>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-MATRIX.png` |
| <a id="frame-31-p11"></a> **31-P11 · The glass rail** | PARTIAL | [HTML #w1 · L170](<../design-refs/Agentic Poker Desktop Parity.html#w1>)<br>[D8GlassScreenM · L303](<../design-refs/mood-watch4c.jsx#L303>) | Glass-rail state remains required; owned cards/table geometry need a complete current pair. | `artifacts/pairs/31-P11.png` |
| <a id="frame-31-p12"></a> **31-P12 · WON, on the stage** | PARTIAL | [HTML #w2 · L175](<../design-refs/Agentic Poker Desktop Parity.html#w2>)<br>[D8HandEndScreenM · L328](<../design-refs/mood-watch4c.jsx#L328>) | Won-on-stage remains required with current result timing and real totals. | `artifacts/pairs/31-P12.png` |
| <a id="frame-31-p13"></a> **31-P13 · Seated, and the thread always open** | PARTIAL | [HTML #w3 · L183](<../design-refs/Agentic Poker Desktop Parity.html#w3>)<br>[D9V5ScreenM · L755](<../design-refs/mood-watch5.jsx#L755>) | Seated/open-thread state remains required; C9/permanent roster changes the surrounding shell. | `artifacts/pairs/31-P13.png` |
| <a id="frame-31-x1"></a> **31-X1 · The flat** | PARTIAL | [HTML #x1 · L201](<../design-refs/Agentic Poker Desktop Parity.html#x1>)<br>[DkHomeRoomScreenM · L371](<../design-refs/mood-desk59.jsx#L371>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-X1.png` |
| <a id="frame-31-x2"></a> **31-X2 · Hovering a body** | PARTIAL | [HTML #x2 · L207](<../design-refs/Agentic Poker Desktop Parity.html#x2>)<br>[DkHoverScreenM · L383](<../design-refs/mood-desk59.jsx#L383>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-X2.png` |
| <a id="frame-31-x3"></a> **31-X3 · Hovering a fixture** | PARTIAL | [HTML #x3 · L213](<../design-refs/Agentic Poker Desktop Parity.html#x3>)<br>[DkFixtureHoverScreenM · L394](<../design-refs/mood-desk59.jsx#L394>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-X3.png` |
| <a id="frame-31-x4"></a> **31-X4 · The safe, clicked** | PARTIAL | [HTML #x4 · L219](<../design-refs/Agentic Poker Desktop Parity.html#x4>)<br>[DkSafeScreenM · L406](<../design-refs/mood-desk59.jsx#L406>) | Batch 45 safe loading/error/funding repairs do not certify the complete desktop safe frame. | `artifacts/pairs/31-X4.png` |
| <a id="frame-31-x5"></a> **31-X5 · The casino** | PARTIAL | [HTML #x5 · L225](<../design-refs/Agentic Poker Desktop Parity.html#x5>)<br>[DkCasinoFloorScreenM · L47](<../design-refs/mood-desk59b.jsx#L47>) | [G30](DESIGN_GAP.md#gap-g30) | `artifacts/pairs/31-X5.png` |
| <a id="frame-31-x6"></a> **31-X6 · Watching one** | PARTIAL | [HTML #x6 · L231](<../design-refs/Agentic Poker Desktop Parity.html#x6>)<br>[DkWatchM · L136](<../design-refs/mood-desk59b.jsx#L136>) | Later permanent roster replaces the miniature floor strip; preserve shared felt and conversation.<br>Unverified candidates: [design-batch29-owned.png](<../client/e2e/shots/design-batch29-owned.png>), [design-batch29-public.png](<../client/e2e/shots/design-batch29-public.png>) | `artifacts/pairs/31-X6.png` |
| <a id="frame-31-x7"></a> **31-X7 · You sit down** | PARTIAL | [HTML #x7 · L237](<../design-refs/Agentic Poker Desktop Parity.html#x7>)<br>[DkOwnerM · L137](<../design-refs/mood-desk59b.jsx#L137>) | Real Join/action/Leave tested; current cards/roster/layout still require a complete comparison.<br>Unverified candidates: [design-batch25-sit-1280.png](<../client/e2e/shots/design-batch25-sit-1280.png>) | `artifacts/pairs/31-X7.png` |
| <a id="frame-31-x8"></a> **31-X8 · BET** | PARTIAL | [HTML #x8 · L243](<../design-refs/Agentic Poker Desktop Parity.html#x8>)<br>[DkOwnerBetM · L138](<../design-refs/mood-desk59b.jsx#L138>) | Legal BET controls exist; exact current amount/panel/geometry comparison remains.<br>Unverified candidates: [design-batch25-sit-1280.png](<../client/e2e/shots/design-batch25-sit-1280.png>) | `artifacts/pairs/31-X8.png` |
| <a id="frame-31-y1"></a> **31-Y1 · The flat** | PARTIAL | [HTML #y1 · L251](<../design-refs/Agentic Poker Desktop Parity.html#y1>)<br>[DkHome1920M · L144](<../design-refs/mood-desk59b.jsx#L144>) | 1920 geometry has prior evidence; saved cast and retained table differ from samples.<br>Unverified candidates: [design-batch37-wide.png](<../client/e2e/shots/design-batch37-wide.png>) | `artifacts/pairs/31-Y1.png` |
| <a id="frame-31-y2"></a> **31-Y2 · The casino** | PARTIAL | [HTML #y2 · L257](<../design-refs/Agentic Poker Desktop Parity.html#y2>)<br>[DkCasino1920M · L145](<../design-refs/mood-desk59b.jsx#L145>) | 1920 geometry has prior evidence; actual table count and hot states need separate captures.<br>Unverified candidates: [design-batch37-wide.png](<../client/e2e/shots/design-batch37-wide.png>) | `artifacts/pairs/31-Y2.png` |
| <a id="frame-31-y3"></a> **31-Y3 · Watch** | PARTIAL | [HTML #y3 · L263](<../design-refs/Agentic Poker Desktop Parity.html#y3>)<br>[DkWatch1920M · L146](<../design-refs/mood-desk59b.jsx#L146>) | Current permanent roster/identity/hand replace sample 1920 Watch data.<br>Unverified candidates: [design-batch37-wide.png](<../client/e2e/shots/design-batch37-wide.png>) | `artifacts/pairs/31-Y3.png` |
| <a id="frame-31-y4"></a> **31-Y4 · Sitting down** | PARTIAL | [HTML #y4 · L269](<../design-refs/Agentic Poker Desktop Parity.html#y4>)<br>[DkOwner1920M · L147](<../design-refs/mood-desk59b.jsx#L147>) | Real Join/actions exist; a full-frame 1920 Sit match is not certified.<br>Unverified candidates: [design-batch37-wide.png](<../client/e2e/shots/design-batch37-wide.png>) | `artifacts/pairs/31-Y4.png` |
| <a id="frame-31-z1"></a> **31-Z1 · Keep him** | PARTIAL | [HTML #z1 · L277](<../design-refs/Agentic Poker Desktop Parity.html#z1>)<br>[GuestClaimDeskM · L191](<../design-refs/mood-guest.jsx#L191>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch17-guest-room-1280.png](<../client/e2e/shots/overnight-batch17-guest-room-1280.png>) | `artifacts/pairs/31-Z1.png` |
| <a id="frame-31-c9"></a> **31-C9 · The agent in the column** | PARTIAL | [HTML #c9 · L285](<../design-refs/Agentic Poker Desktop Parity.html#c9>)<br>[DkAgentScreenM · L311](<../design-refs/mood-agent2.jsx#L311>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch19-desktop-c9.png](<../client/e2e/shots/overnight-batch19-desktop-c9.png>) | `artifacts/pairs/31-C9.png` |

### Board 40 · 4 frames

[Agentic Poker Landing.html](<../design-refs/Agentic Poker Landing.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-40-h1"></a> **40-H1 · Hero · 1280×800** | PARTIAL | [HTML #lh1280 · L109](<../design-refs/Agentic Poker Landing.html#lh1280>)<br>[LandingHeroN · L419](<../design-refs/mood-landing2.jsx#L419>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/40-H1.png` |
| <a id="frame-40-h2"></a> **40-H2 · Hero · 1440×900** | PARTIAL | [HTML #lh1440 · L115](<../design-refs/Agentic Poker Landing.html#lh1440>)<br>[LandingHeroN · L419](<../design-refs/mood-landing2.jsx#L419>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/40-H2.png` |
| <a id="frame-40-l1"></a> **40-L1 · Full page · 1280**<br>[11 substates](DESIGN_STATE_GAP.md#states-40-l1) | PARTIAL | [HTML #lp1280 · L121](<../design-refs/Agentic Poker Landing.html#lp1280>)<br>[Landing1280N · L417](<../design-refs/mood-landing2.jsx#L417>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/40-L1.png` |
| <a id="frame-40-l2"></a> **40-L2 · Full page · 390**<br>[11 substates](DESIGN_STATE_GAP.md#states-40-l2) | PARTIAL | [HTML #lp390 · L127](<../design-refs/Agentic Poker Landing.html#lp390>)<br>[Landing390N · L418](<../design-refs/mood-landing2.jsx#L418>) | [G30](DESIGN_GAP.md#gap-g30)<br>Unverified candidates: [overnight-batch13-landing-390.png](<../client/e2e/shots/overnight-batch13-landing-390.png>) | `artifacts/pairs/40-L2.png` |

### Board 41 · 17 frames

[Railbird Brand.html](<../design-refs/Railbird Brand.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-41-b0"></a> **41-B0 · Overlay against all three references**<br>[3 substates](DESIGN_STATE_GAP.md#states-41-b0) | BUILT? | [HTML #b0 · L109](<../design-refs/Railbird Brand.html#b0>)<br>[inline mount · L109](<../design-refs/Railbird Brand.html#L109>) | — | `artifacts/pairs/41-B0.png` |
| <a id="frame-41-b1"></a> **41-B1 · The mark**<br>[4 substates](DESIGN_STATE_GAP.md#states-41-b1) | BUILT? | [HTML #b1 · L116](<../design-refs/Railbird Brand.html#b1>)<br>[inline mount · L116](<../design-refs/Railbird Brand.html#L116>) | README one-colour rule conflicts with large felt-tone exception; resolve before certifying all variants. | `artifacts/pairs/41-B1.png` |
| <a id="frame-41-b3"></a> **41-B3 · Reduction**<br>[9 substates](DESIGN_STATE_GAP.md#states-41-b3) | BUILT? | [HTML #b3 · L123](<../design-refs/Railbird Brand.html#b3>)<br>[inline mount · L123](<../design-refs/Railbird Brand.html#L123>) | — | `artifacts/pairs/41-B3.png` |
| <a id="frame-41-b2"></a> **41-B2 · Construction** | BUILT? | [HTML #b2 · L130](<../design-refs/Railbird Brand.html#b2>)<br>[inline mount · L130](<../design-refs/Railbird Brand.html#L130>) | — | `artifacts/pairs/41-B2.png` |
| <a id="frame-41-b4"></a> **41-B4 · Chat list**<br>[5 substates](DESIGN_STATE_GAP.md#states-41-b4) | BUILT? | [HTML #b4 · L138](<../design-refs/Railbird Brand.html#b4>)<br>[inline mount · L138](<../design-refs/Railbird Brand.html#L138>) | — | `artifacts/pairs/41-B4.png` |
| <a id="frame-41-b5"></a> **41-B5 · Favicon**<br>[3 substates](DESIGN_STATE_GAP.md#states-41-b5) | BUILT? | [HTML #b5 · L145](<../design-refs/Railbird Brand.html#b5>)<br>[inline mount · L145](<../design-refs/Railbird Brand.html#L145>) | —<br>Unverified candidates: [design-batch20-brand-assets.png](<../client/e2e/shots/design-batch20-brand-assets.png>) | `artifacts/pairs/41-B5.png` |
| <a id="frame-41-b5b"></a> **41-B5b · App icon**<br>[3 substates](DESIGN_STATE_GAP.md#states-41-b5b) | BUILT? | [HTML #b5b · L152](<../design-refs/Railbird Brand.html#b5b>)<br>[inline mount · L152](<../design-refs/Railbird Brand.html#L152>) | —<br>Unverified candidates: [design-batch20-brand-assets.png](<../client/e2e/shots/design-batch20-brand-assets.png>) | `artifacts/pairs/41-B5b.png` |
| <a id="frame-41-b6"></a> **41-B6 · Lockups**<br>[7 substates](DESIGN_STATE_GAP.md#states-41-b6) | BUILT? | [HTML #b6 · L161](<../design-refs/Railbird Brand.html#b6>)<br>[inline mount · L161](<../design-refs/Railbird Brand.html#L161>) | — | `artifacts/pairs/41-B6.png` |
| <a id="frame-41-b7"></a> **41-B7 · Four fields**<br>[4 substates](DESIGN_STATE_GAP.md#states-41-b7) | BUILT? | [HTML #b7 · L170](<../design-refs/Railbird Brand.html#b7>)<br>[inline mount · L170](<../design-refs/Railbird Brand.html#L170>) | — | `artifacts/pairs/41-B7.png` |
| <a id="frame-41-b8"></a> **41-B8 · Bot avatar & public account**<br>[10 substates](DESIGN_STATE_GAP.md#states-41-b8) | PARTIAL | [HTML #b8 · L179](<../design-refs/Railbird Brand.html#b8>)<br>[inline mount · L179](<../design-refs/Railbird Brand.html#L179>) | [G25](DESIGN_GAP.md#gap-g25)<br>Unverified candidates: [design-batch20-brand-assets.png](<../client/e2e/shots/design-batch20-brand-assets.png>) | `artifacts/pairs/41-B8.png` |
| <a id="frame-41-b9"></a> **41-B9 · Page header**<br>[3 substates](DESIGN_STATE_GAP.md#states-41-b9) | BUILT? | [HTML #b9 · L186](<../design-refs/Railbird Brand.html#b9>)<br>[inline mount · L186](<../design-refs/Railbird Brand.html#L186>) | — | `artifacts/pairs/41-B9.png` |
| <a id="frame-41-b10"></a> **41-B10 · The sign over the door**<br>[2 substates](DESIGN_STATE_GAP.md#states-41-b10) | BUILT? | [HTML #b10 · L193](<../design-refs/Railbird Brand.html#b10>)<br>[inline mount · L193](<../design-refs/Railbird Brand.html#L193>) | — | `artifacts/pairs/41-B10.png` |
| <a id="frame-41-b11"></a> **41-B11 · Share card corner**<br>[2 substates](DESIGN_STATE_GAP.md#states-41-b11) | BUILT? | [HTML #b11 · L199](<../design-refs/Railbird Brand.html#b11>)<br>[inline mount · L199](<../design-refs/Railbird Brand.html#L199>) | — | `artifacts/pairs/41-B11.png` |
| <a id="frame-41-b12"></a> **41-B12 · Loading screen**<br>[3 substates](DESIGN_STATE_GAP.md#states-41-b12) | BUILT? | [HTML #b12 · L206](<../design-refs/Railbird Brand.html#b12>)<br>[inline mount · L206](<../design-refs/Railbird Brand.html#L206>) | —<br>Unverified candidates: [design-batch20-loading-b12.png](<../client/e2e/shots/design-batch20-loading-b12.png>) | `artifacts/pairs/41-B12.png` |
| <a id="frame-41-b13"></a> **41-B13 · The far pose**<br>[2 substates](DESIGN_STATE_GAP.md#states-41-b13) | PARTIAL | [HTML #b13 · L213](<../design-refs/Railbird Brand.html#b13>)<br>[inline mount · L213](<../design-refs/Railbird Brand.html#L213>) | [G15](DESIGN_GAP.md#gap-g15)<br>Unverified candidates: [design-batch37-brand.png](<../client/e2e/shots/design-batch37-brand.png>) | `artifacts/pairs/41-B13.png` |
| <a id="frame-41-b14"></a> **41-B14 · Bot description** | PARTIAL | [HTML #b14 · L219](<../design-refs/Railbird Brand.html#b14>)<br>[inline mount · L219](<../design-refs/Railbird Brand.html#L219>) | [G25](DESIGN_GAP.md#gap-g25) | `artifacts/pairs/41-B14.png` |
| <a id="frame-41-b15"></a> **41-B15 · Motion**<br>[2 substates](DESIGN_STATE_GAP.md#states-41-b15) | BUILT? | [HTML #b15 · L227](<../design-refs/Railbird Brand.html#b15>)<br>[inline mount · L227](<../design-refs/Railbird Brand.html#L227>) | —<br>Unverified candidates: [design-batch37-brand.png](<../client/e2e/shots/design-batch37-brand.png>) | `artifacts/pairs/41-B15.png` |

### Board 42 · 14 frames

[Railbird The Agent.html](<../design-refs/Railbird The Agent.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-42-c1"></a> **42-C1 · The agent** | PARTIAL | [HTML #c1 · L126](<../design-refs/Railbird The Agent.html#c1>)<br>[AgentSheetM · L231](<../design-refs/mood-agent.jsx#L231>) | [G8](DESIGN_GAP.md#gap-g8)<br>Unverified candidates: [overnight-batch2-agent-c1.png](<../client/e2e/shots/overnight-batch2-agent-c1.png>) | `artifacts/pairs/42-C1.png` |
| <a id="frame-42-c2"></a> **42-C2 · His line first** | PARTIAL | [HTML #c2 · L133](<../design-refs/Railbird The Agent.html#c2>)<br>[AgentWantM · L252](<../design-refs/mood-agent.jsx#L252>) | [G8](DESIGN_GAP.md#gap-g8)<br>Unverified candidates: [overnight-batch2-agent-c2.png](<../client/e2e/shots/overnight-batch2-agent-c2.png>) | `artifacts/pairs/42-C2.png` |
| <a id="frame-42-c3"></a> **42-C3 · The whisper** | PARTIAL | [HTML #c3 · L140](<../design-refs/Railbird The Agent.html#c3>)<br>[AgentWhisperM · L273](<../design-refs/mood-agent.jsx#L273>) | [G8](DESIGN_GAP.md#gap-g8)<br>Unverified candidates: [overnight-batch2-agent-c3.png](<../client/e2e/shots/overnight-batch2-agent-c3.png>) | `artifacts/pairs/42-C3.png` |
| <a id="frame-42-c4"></a> **42-C4 · What left the chat** | PARTIAL | [HTML #c4 · L147](<../design-refs/Railbird The Agent.html#c4>)<br>[AgentProfileM · L337](<../design-refs/mood-agent.jsx#L337>) | Profile now exposes real statistics and direct Chat return; fresh complete-frame proof remains.<br>Unverified candidates: [overnight-batch6-profile-c4.png](<../client/e2e/shots/overnight-batch6-profile-c4.png>) | `artifacts/pairs/42-C4.png` |
| <a id="frame-42-c5"></a> **42-C5 · Four agents, four places**<br>[4 substates](DESIGN_STATE_GAP.md#states-42-c5) | PARTIAL | [HTML #c5 · L162](<../design-refs/Railbird The Agent.html#c5>)<br>[AgentRosterM · L66](<../design-refs/mood-agent2.jsx#L66>) | [G29](DESIGN_GAP.md#gap-g29)<br>Unverified candidates: [design-batch39-visitor.png](<../client/e2e/shots/design-batch39-visitor.png>), [overnight-batch5-roster-c5.png](<../client/e2e/shots/overnight-batch5-roster-c5.png>) | `artifacts/pairs/42-C5.png` |
| <a id="frame-42-c5b"></a> **42-C5b · The rows alone**<br>[4 substates](DESIGN_STATE_GAP.md#states-42-c5b) | PARTIAL | [HTML #c5b · L168](<../design-refs/Railbird The Agent.html#c5b>)<br>[AgentRosterSheet · L45](<../design-refs/mood-agent2.jsx#L45>) | [G29](DESIGN_GAP.md#gap-g29) | `artifacts/pairs/42-C5b.png` |
| <a id="frame-42-c5c"></a> **42-C5c · On the desk**<br>[5 substates](DESIGN_STATE_GAP.md#states-42-c5c) | PARTIAL | [HTML #c5c · L174](<../design-refs/Railbird The Agent.html#c5c>)<br>[DkRoster · L81](<../design-refs/mood-desk59.jsx#L81>) | Desktop roster/fifth-chair states remain separate; latest instruction separates roster control from live count. | `artifacts/pairs/42-C5c.png` |
| <a id="frame-42-c6"></a> **42-C6 · Absence** | PARTIAL | [HTML #c6 · L189](<../design-refs/Railbird The Agent.html#c6>)<br>[AgentAbsenceM · L96](<../design-refs/mood-agent2.jsx#L96>) | [G29](DESIGN_GAP.md#gap-g29)<br>Unverified candidates: [overnight-batch7-absence-c6.png](<../client/e2e/shots/overnight-batch7-absence-c6.png>) | `artifacts/pairs/42-C6.png` |
| <a id="frame-42-c7a"></a> **42-C7a · The TV · someone is out** | BUILT? | [HTML #c7a · L196](<../design-refs/Railbird The Agent.html#c7a>)<br>[AgentTvAwayM · L120](<../design-refs/mood-agent2.jsx#L120>) | —<br>Unverified candidates: [overnight-batch8-tv-c7a.png](<../client/e2e/shots/overnight-batch8-tv-c7a.png>) | `artifacts/pairs/42-C7a.png` |
| <a id="frame-42-c7b"></a> **42-C7b · The TV · everyone home** | PARTIAL | [HTML #c7b · L202](<../design-refs/Railbird The Agent.html#c7b>)<br>[AgentTvHomeM · L137](<../design-refs/mood-agent2.jsx#L137>) | Reference itself leaves couch-facing-TV unfinished. Retain that limitation and the working tape path.<br>Unverified candidates: [overnight-batch8-tv-c7b.png](<../client/e2e/shots/overnight-batch8-tv-c7b.png>) | `artifacts/pairs/42-C7b.png` |
| <a id="frame-42-c8a"></a> **42-C8a · An ordinary win** | PARTIAL | [HTML #c8a · L218](<../design-refs/Railbird The Agent.html#c8a>)<br>[AgentCelebWinM · L236](<../design-refs/mood-agent2.jsx#L236>) | [G7](DESIGN_GAP.md#gap-g7)<br>Unverified candidates: [overnight-batch11-celebration-c8a.png](<../client/e2e/shots/overnight-batch11-celebration-c8a.png>) | `artifacts/pairs/42-C8a.png` |
| <a id="frame-42-c8b"></a> **42-C8b · A big win** | PARTIAL | [HTML #c8b · L225](<../design-refs/Railbird The Agent.html#c8b>)<br>[AgentCelebBigM · L237](<../design-refs/mood-agent2.jsx#L237>) | [G7](DESIGN_GAP.md#gap-g7)<br>Unverified candidates: [overnight-batch11-celebration-c8b.png](<../client/e2e/shots/overnight-batch11-celebration-c8b.png>) | `artifacts/pairs/42-C8b.png` |
| <a id="frame-42-c8c"></a> **42-C8c · A bust** | PARTIAL | [HTML #c8c · L232](<../design-refs/Railbird The Agent.html#c8c>)<br>[AgentCelebBustM · L238](<../design-refs/mood-agent2.jsx#L238>) | [G7](DESIGN_GAP.md#gap-g7)<br>Unverified candidates: [overnight-batch11-celebration-c8c.png](<../client/e2e/shots/overnight-batch11-celebration-c8c.png>) | `artifacts/pairs/42-C8c.png` |
| <a id="frame-42-c9"></a> **42-C9 · The agent in the column** | PARTIAL | [HTML #c9 · L245](<../design-refs/Railbird The Agent.html#c9>)<br>[DkAgentScreenM · L311](<../design-refs/mood-agent2.jsx#L311>) | [G8](DESIGN_GAP.md#gap-g8)<br>Unverified candidates: [overnight-batch19-desktop-c9.png](<../client/e2e/shots/overnight-batch19-desktop-c9.png>) | `artifacts/pairs/42-C9.png` |

### Board 01 · 9 frames

[Agentic Poker Design System.html](<../design-refs/Agentic Poker Design System.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-01-s1"></a> **01-S1 · Tokens** | BUILT? | [HTML #y1 · L70](<../design-refs/Agentic Poker Design System.html#y1>)<br>[SystemTokensM · L196](<../design-refs/mood-system.jsx#L196>) | — | `artifacts/pairs/01-S1.png` |
| <a id="frame-01-s2"></a> **01-S2 · Mood logic**<br>[5 substates](DESIGN_STATE_GAP.md#states-01-s2) | BUILT? | [HTML #y2 · L75](<../design-refs/Agentic Poker Design System.html#y2>)<br>[MoodMatrixM · L303](<../design-refs/mood-system.jsx#L303>) | — | `artifacts/pairs/01-S2.png` |
| <a id="frame-01-s3"></a> **01-S3 · Ghost anatomy**<br>[3 substates](DESIGN_STATE_GAP.md#states-01-s3) | BUILT? | [HTML #y3 · L81](<../design-refs/Agentic Poker Design System.html#y3>)<br>[GhostAnatomyM · L357](<../design-refs/mood-system.jsx#L357>) | — | `artifacts/pairs/01-S3.png` |
| <a id="frame-01-s5"></a> **01-S5 · State matrix**<br>[4 substates](DESIGN_STATE_GAP.md#states-01-s5) | BUILT? | [HTML #y5 · L86](<../design-refs/Agentic Poker Design System.html#y5>)<br>[StateMatrixM · L185](<../design-refs/mood-system2.jsx#L185>) | — | `artifacts/pairs/01-S5.png` |
| <a id="frame-01-s4"></a> **01-S4 · Component inventory** | BUILT? | [HTML #y4 · L91](<../design-refs/Agentic Poker Design System.html#y4>)<br>[ComponentInventoryM · L49](<../design-refs/mood-system2.jsx#L49>) | — | `artifacts/pairs/01-S4.png` |
| <a id="frame-01-s6"></a> **01-S6 · The mark**<br>[8 substates](DESIGN_STATE_GAP.md#states-01-s6) | BUILT? | [HTML #y6 · L99](<../design-refs/Agentic Poker Design System.html#y6>)<br>[BrandRowS6 · L152](<../design-refs/Agentic Poker Design System.html#L152>) | — | `artifacts/pairs/01-S6.png` |
| <a id="frame-01-g1"></a> **01-G1 · Hand review** | BUILT? | [HTML #g1 · L108](<../design-refs/Agentic Poker Design System.html#g1>)<br>[HandReviewScreenM · L80](<../design-refs/mood-screens-f.jsx#L80>) | — | `artifacts/pairs/01-G1.png` |
| <a id="frame-01-g2"></a> **01-G2 · You** | SUPERSEDED | [HTML #g2 · L114](<../design-refs/Agentic Poker Design System.html#g2>)<br>[YouScreenM · L44](<../design-refs/mood-screens-d.jsx#L44>) | [G27](DESIGN_GAP.md#gap-g27) | `artifacts/pairs/01-G2.png` |
| <a id="frame-01-g3"></a> **01-G3 · Chats** | SUPERSEDED | [HTML #g3 · L120](<../design-refs/Agentic Poker Design System.html#g3>)<br>[HomeScreenM · L118](<../design-refs/mood-screens-a.jsx#L118>) | [G27](DESIGN_GAP.md#gap-g27) | `artifacts/pairs/01-G3.png` |

### Board 02 · 9 frames

[Agentic Poker Faces.html](<../design-refs/Agentic Poker Faces.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-02-faces"></a> **02-FACES · The fifteen**<br>[15 substates](DESIGN_STATE_GAP.md#states-02-faces) | BUILT? | [HTML #f1 · L70](<../design-refs/Agentic Poker Faces.html#f1>)<br>[FacesGridM · L26](<../design-refs/mood-faces.jsx#L26>) | —<br>Unverified candidates: [design-batch34-tiers.png](<../client/e2e/shots/design-batch34-tiers.png>) | `artifacts/pairs/02-FACES.png` |
| <a id="frame-02-42"></a> **02-42 · Heat as a continuum**<br>[35 substates](DESIGN_STATE_GAP.md#states-02-42) | BUILT? | [HTML #f2 · L75](<../design-refs/Agentic Poker Faces.html#f2>)<br>[FaceHeatStripM · L136](<../design-refs/mood-faces.jsx#L136>) | —<br>Unverified candidates: [design-batch34-heat.png](<../client/e2e/shots/design-batch34-heat.png>) | `artifacts/pairs/02-42.png` |
| <a id="frame-02-43"></a> **02-43 · Six expressions**<br>[7 substates](DESIGN_STATE_GAP.md#states-02-43) | BUILT? | [HTML #f3 · L81](<../design-refs/Agentic Poker Faces.html#f3>)<br>[FaceEventsM · L56](<../design-refs/mood-faces.jsx#L56>) | —<br>Unverified candidates: [design-batch34-events.png](<../client/e2e/shots/design-batch34-events.png>) | `artifacts/pairs/02-43.png` |
| <a id="frame-02-44"></a> **02-44 · Four sizes**<br>[20 substates](DESIGN_STATE_GAP.md#states-02-44) | BUILT? | [HTML #f4 · L87](<../design-refs/Agentic Poker Faces.html#f4>)<br>[FaceSizesM · L93](<../design-refs/mood-faces.jsx#L93>) | —<br>Unverified candidates: [design-batch34-sizes.png](<../client/e2e/shots/design-batch34-sizes.png>) | `artifacts/pairs/02-44.png` |
| <a id="frame-02-45"></a> **02-45 · THE MOODS**<br>[5 substates](DESIGN_STATE_GAP.md#states-02-45) | BUILT? | [HTML #f5 · L95](<../design-refs/Agentic Poker Faces.html#f5>)<br>[MoodsBoardSection · L143](<../design-refs/Agentic Poker Faces.html#L143>) | — | `artifacts/pairs/02-45.png` |
| <a id="frame-02-48"></a> **02-48 · Eight poses, three sizes**<br>[27 substates](DESIGN_STATE_GAP.md#states-02-48) | BUILT? | [HTML #h1 · L103](<../design-refs/Agentic Poker Faces.html#h1>)<br>[HandsSheetM · L17](<../design-refs/mood-hands.jsx#L17>) | —<br>Unverified candidates: [design-batch34-poses.png](<../client/e2e/shots/design-batch34-poses.png>) | `artifacts/pairs/02-48.png` |
| <a id="frame-02-49"></a> **02-49 · Push · three bet bands**<br>[3 substates](DESIGN_STATE_GAP.md#states-02-49) | BUILT? | [HTML #h2 · L109](<../design-refs/Agentic Poker Faces.html#h2>)<br>[HandBetBandsM · L60](<../design-refs/mood-hands.jsx#L60>) | — | `artifacts/pairs/02-49.png` |
| <a id="frame-02-50"></a> **02-50 · Push, toss, cover**<br>[12 substates](DESIGN_STATE_GAP.md#states-02-50) | BUILT? | [HTML #h3 · L115](<../design-refs/Agentic Poker Faces.html#h3>)<br>[HandStripsM · L108](<../design-refs/mood-hands.jsx#L108>) | — | `artifacts/pairs/02-50.png` |
| <a id="frame-02-51"></a> **02-51 · Brow triggers**<br>[3 substates](DESIGN_STATE_GAP.md#states-02-51) | BUILT? | [HTML #h4 · L121](<../design-refs/Agentic Poker Faces.html#h4>)<br>[BrowTriggersM · L150](<../design-refs/mood-hands.jsx#L150>) | —<br>Unverified candidates: [design-batch34-brows.png](<../client/e2e/shots/design-batch34-brows.png>), [design-batch35-reactions.png](<../client/e2e/shots/design-batch35-reactions.png>) | `artifacts/pairs/02-51.png` |

### Board 10 · 8 frames

[Agentic Poker Character System.html](<../design-refs/Agentic Poker Character System.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-10-s0"></a> **10-S0 · Philosophy** | BUILT? | [HTML #s0 · L67](<../design-refs/Agentic Poker Character System.html#s0>)<br>[CharPhilosophyM · L171](<../design-refs/char-system.jsx#L171>) | — | `artifacts/pairs/10-S0.png` |
| <a id="frame-10-s1"></a> **10-S1 · The six attributes**<br>[6 substates](DESIGN_STATE_GAP.md#states-10-s1) | BUILT? | [HTML #s1 · L72](<../design-refs/Agentic Poker Character System.html#s1>)<br>[AttributesSheetM · L211](<../design-refs/char-system.jsx#L211>) | — | `artifacts/pairs/10-S1.png` |
| <a id="frame-10-s2"></a> **10-S2 · Natures**<br>[8 substates](DESIGN_STATE_GAP.md#states-10-s2) | BUILT? | [HTML #s2 · L78](<../design-refs/Agentic Poker Character System.html#s2>)<br>[NaturesSheetM · L250](<../design-refs/char-system.jsx#L250>) | — | `artifacts/pairs/10-S2.png` |
| <a id="frame-10-s3"></a> **10-S3 · Current vs potential**<br>[4 substates](DESIGN_STATE_GAP.md#states-10-s3) | BUILT? | [HTML #s3 · L83](<../design-refs/Agentic Poker Character System.html#s3>)<br>[PotentialSheetM · L15](<../design-refs/char-system2.jsx#L15>) | — | `artifacts/pairs/10-S3.png` |
| <a id="frame-10-s4"></a> **10-S4 · Growth & fatigue**<br>[4 substates](DESIGN_STATE_GAP.md#states-10-s4) | BUILT? | [HTML #s4 · L88](<../design-refs/Agentic Poker Character System.html#s4>)<br>[GrowthFatigueSheetM · L84](<../design-refs/char-system2.jsx#L84>) | — | `artifacts/pairs/10-S4.png` |
| <a id="frame-10-s5"></a> **10-S5 · Where it surfaces** | BUILT? | [HTML #s5 · L93](<../design-refs/Agentic Poker Character System.html#s5>)<br>[SurfaceMapSheetM · L195](<../design-refs/char-system2.jsx#L195>) | — | `artifacts/pairs/10-S5.png` |
| <a id="frame-10-s6"></a> **10-S6 · State matrix · attributes**<br>[8 substates](DESIGN_STATE_GAP.md#states-10-s6) | BUILT? | [HTML #s6 · L98](<../design-refs/Agentic Poker Character System.html#s6>)<br>[AttrStateMatrixM · L56](<../design-refs/char-close.jsx#L56>) | — | `artifacts/pairs/10-S6.png` |
| <a id="frame-10-s7"></a> **10-S7 · How it plays**<br>[5 substates](DESIGN_STATE_GAP.md#states-10-s7) | BUILT? | [HTML #s7 · L104](<../design-refs/Agentic Poker Character System.html#s7>)<br>[HowItPlaysM · L342](<../design-refs/char-close.jsx#L342>) | — | `artifacts/pairs/10-S7.png` |

### Board 11 · 5 frames

[Agentic Poker Biography.html](<../design-refs/Agentic Poker Biography.html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-11-b0"></a> **11-B0 · The law** | BUILT? | [HTML #b0 · L66](<../design-refs/Agentic Poker Biography.html#b0>)<br>[BiographySheetM · L149](<../design-refs/char-bio.jsx#L149>) | — | `artifacts/pairs/11-B0.png` |
| <a id="frame-11-b1"></a> **11-B1 · On the player card** | BUILT? | [HTML #b1 · L73](<../design-refs/Agentic Poker Biography.html#b1>)<br>[ProfileRelScreenM · L37](<../design-refs/char-bio.jsx#L37>) | — | `artifacts/pairs/11-B1.png` |
| <a id="frame-11-b1-ledger"></a> **11-B1-ledger · Grudge ledger (standalone inset)** | BUILT? | [HTML #b1s · L75](<../design-refs/Agentic Poker Biography.html#b1s>)<br>[GrudgeLedgerM · L49](<../design-refs/char-bio.jsx#L49>) | Separately mounted grudge-ledger inset; do not absorb it into the player-card row. | `artifacts/pairs/11-B1-ledger.png` |
| <a id="frame-11-b2"></a> **11-B2 · At the felt** | BUILT? | [HTML #b2 · L80](<../design-refs/Agentic Poker Biography.html#b2>)<br>[WatchGrudgeScreenM · L75](<../design-refs/char-bio.jsx#L75>) | — | `artifacts/pairs/11-B2.png` |
| <a id="frame-11-b3"></a> **11-B3 · The grudge forms** | BUILT? | [HTML #b3 · L86](<../design-refs/Agentic Poker Biography.html#b3>)<br>[ThreadGrudgeScreenM · L120](<../design-refs/char-bio.jsx#L120>) | — | `artifacts/pairs/11-B3.png` |

### Board standalone-system · 9 frames

[Railbird Design System (standalone).html](<../design-refs/Railbird Design System (standalone).html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-standalone-system-s1"></a> **standalone-system-S1 · Tokens** | BUILT? | [HTML #y1 · L801](<../design-refs/Railbird Design System (standalone).html#y1>)<br>[SystemTokensM](<../design-refs/Railbird Design System (standalone).html>) · embedded `91073355-9fa0-4b27-b06e-e7f7809dfcdf`:196 | — | `artifacts/pairs/standalone-system-S1.png` |
| <a id="frame-standalone-system-s2"></a> **standalone-system-S2 · Mood logic**<br>[5 substates](DESIGN_STATE_GAP.md#states-standalone-system-s2) | BUILT? | [HTML #y2 · L806](<../design-refs/Railbird Design System (standalone).html#y2>)<br>[MoodMatrixM](<../design-refs/Railbird Design System (standalone).html>) · embedded `91073355-9fa0-4b27-b06e-e7f7809dfcdf`:303 | — | `artifacts/pairs/standalone-system-S2.png` |
| <a id="frame-standalone-system-s3"></a> **standalone-system-S3 · Ghost anatomy**<br>[3 substates](DESIGN_STATE_GAP.md#states-standalone-system-s3) | BUILT? | [HTML #y3 · L812](<../design-refs/Railbird Design System (standalone).html#y3>)<br>[GhostAnatomyM](<../design-refs/Railbird Design System (standalone).html>) · embedded `91073355-9fa0-4b27-b06e-e7f7809dfcdf`:357 | — | `artifacts/pairs/standalone-system-S3.png` |
| <a id="frame-standalone-system-s5"></a> **standalone-system-S5 · State matrix**<br>[4 substates](DESIGN_STATE_GAP.md#states-standalone-system-s5) | BUILT? | [HTML #y5 · L817](<../design-refs/Railbird Design System (standalone).html#y5>)<br>[StateMatrixM](<../design-refs/Railbird Design System (standalone).html>) · embedded `ec0b1c72-003d-4c7a-ac1a-f490748c3d9d`:185 | — | `artifacts/pairs/standalone-system-S5.png` |
| <a id="frame-standalone-system-s4"></a> **standalone-system-S4 · Component inventory** | BUILT? | [HTML #y4 · L822](<../design-refs/Railbird Design System (standalone).html#y4>)<br>[ComponentInventoryM](<../design-refs/Railbird Design System (standalone).html>) · embedded `ec0b1c72-003d-4c7a-ac1a-f490748c3d9d`:49 | — | `artifacts/pairs/standalone-system-S4.png` |
| <a id="frame-standalone-system-s6"></a> **standalone-system-S6 · The mark**<br>[8 substates](DESIGN_STATE_GAP.md#states-standalone-system-s6) | SUPERSEDED | [HTML #y6 · L830](<../design-refs/Railbird Design System (standalone).html#y6>)<br>[BrandRowS6 · L883](<../design-refs/Railbird Design System (standalone).html#L883>) | [G13](DESIGN_GAP.md#gap-g13) | `artifacts/pairs/standalone-system-S6.png` |
| <a id="frame-standalone-system-g1"></a> **standalone-system-G1 · Hand review** | BUILT? | [HTML #g1 · L839](<../design-refs/Railbird Design System (standalone).html#g1>)<br>[HandReviewScreenM](<../design-refs/Railbird Design System (standalone).html>) · embedded `c6561186-1d61-4087-a771-9804fd9e7f16`:80 | — | `artifacts/pairs/standalone-system-G1.png` |
| <a id="frame-standalone-system-g2"></a> **standalone-system-G2 · You** | SUPERSEDED | [HTML #g2 · L845](<../design-refs/Railbird Design System (standalone).html#g2>)<br>[YouScreenM](<../design-refs/Railbird Design System (standalone).html>) · embedded `524f822c-8a49-4118-ab18-c19136c6dcee`:44 | [G27](DESIGN_GAP.md#gap-g27) | `artifacts/pairs/standalone-system-G2.png` |
| <a id="frame-standalone-system-g3"></a> **standalone-system-G3 · Chats** | SUPERSEDED | [HTML #g3 · L851](<../design-refs/Railbird Design System (standalone).html#g3>)<br>[HomeScreenM](<../design-refs/Railbird Design System (standalone).html>) · embedded `47f4bc02-1bd0-4ecf-81c0-199100866fbd`:118 | [G27](DESIGN_GAP.md#gap-g27) | `artifacts/pairs/standalone-system-G3.png` |

### Board standalone-landing · 4 frames

[Railbird Landing Page (standalone).html](<../design-refs/Railbird Landing Page (standalone).html>)

| Frame / title | Status | Exact reference | Gap / evidence | Required pair |
|---|---|---|---|---|
| <a id="frame-standalone-landing-h1"></a> **standalone-landing-H1 · Hero · 1280×800** | PARTIAL | [HTML #lh1280 · L918](<../design-refs/Railbird Landing Page (standalone).html#lh1280>)<br>[LandingHeroN](<../design-refs/Railbird Landing Page (standalone).html>) · embedded `0ce7f473-003c-482d-92ac-dfc83c1d8dd5`:419 | [G14](DESIGN_GAP.md#gap-g14)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/standalone-landing-H1.png` |
| <a id="frame-standalone-landing-h2"></a> **standalone-landing-H2 · Hero · 1440×900** | PARTIAL | [HTML #lh1440 · L924](<../design-refs/Railbird Landing Page (standalone).html#lh1440>)<br>[LandingHeroN](<../design-refs/Railbird Landing Page (standalone).html>) · embedded `0ce7f473-003c-482d-92ac-dfc83c1d8dd5`:419 | [G14](DESIGN_GAP.md#gap-g14)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/standalone-landing-H2.png` |
| <a id="frame-standalone-landing-l1"></a> **standalone-landing-L1 · Full page · 1280**<br>[11 substates](DESIGN_STATE_GAP.md#states-standalone-landing-l1) | PARTIAL | [HTML #lp1280 · L930](<../design-refs/Railbird Landing Page (standalone).html#lp1280>)<br>[Landing1280N](<../design-refs/Railbird Landing Page (standalone).html>) · embedded `0ce7f473-003c-482d-92ac-dfc83c1d8dd5`:417 | [G14](DESIGN_GAP.md#gap-g14)<br>Unverified candidates: [overnight-batch13-landing-1280.png](<../client/e2e/shots/overnight-batch13-landing-1280.png>) | `artifacts/pairs/standalone-landing-L1.png` |
| <a id="frame-standalone-landing-l2"></a> **standalone-landing-L2 · Full page · 390**<br>[11 substates](DESIGN_STATE_GAP.md#states-standalone-landing-l2) | PARTIAL | [HTML #lp390 · L936](<../design-refs/Railbird Landing Page (standalone).html#lp390>)<br>[Landing390N](<../design-refs/Railbird Landing Page (standalone).html>) · embedded `0ce7f473-003c-482d-92ac-dfc83c1d8dd5`:418 | [G14](DESIGN_GAP.md#gap-g14)<br>Unverified candidates: [overnight-batch13-landing-390.png](<../client/e2e/shots/overnight-batch13-landing-390.png>) | `artifacts/pairs/standalone-landing-L2.png` |

## Unboarded interactions

Pair paths here are reserved checkpoints, not claims that an authored reference exists.

| Interaction | Status | Source | Design gap | Reserved pair |
|---|---|---|---|---|
| <a id="frame-unboarded-visit"></a> **unboarded-visit · Visit / knock / accept** | NOT DESIGNED | [Recorded design absence](<DESIGN_GAP_BATCH41.md#undesigned-or-explicitly-deferred>) | Existing knock/accept bugs may be repaired; complete authored shared-room lifecycle is missing. | `artifacts/pairs/unboarded-visit.png` |
| <a id="frame-unboarded-referral"></a> **unboarded-referral · Referral doorway** | NOT DESIGNED | [Recorded design absence](<DESIGN_GAP_BATCH41.md#undesigned-or-explicitly-deferred>) | Visitor promise/doorway handoff exists; complete referral interaction design is missing. | `artifacts/pairs/unboarded-referral.png` |
| <a id="frame-unboarded-visit-share"></a> **unboarded-visit-share · Visit share-card variant** | NOT DESIGNED | [Recorded design absence](<DESIGN_GAP_BATCH41.md#undesigned-or-explicitly-deferred>) | No complete authored visit-specific share-card layout/state sequence. | `artifacts/pairs/unboarded-visit-share.png` |
| <a id="frame-unboarded-fast-forward"></a> **unboarded-fast-forward · Hold-to-fast-forward** | NOT DESIGNED | [Recorded design absence](<DESIGN_GAP_BATCH41.md#undesigned-or-explicitly-deferred>) | Existing hold behavior lacks a complete authored interaction/timing design. | `artifacts/pairs/unboarded-fast-forward.png` |
| <a id="frame-unboarded-public-selfie"></a> **unboarded-public-selfie · Public-account selfie states** | NOT DESIGNED | [Recorded design absence](<DESIGN_GAP_BATCH41.md#undesigned-or-explicitly-deferred>) | Public-account selfie states lack a complete authored current board. | `artifacts/pairs/unboarded-public-selfie.png` |

## Shared gap notes

<a id="gap-g1"></a> **G1** — 42-C1 replaces the owner conversation application; retain in-Watch glass/read/card layering laws. Do not retire the whole screen without reviewing those states.

<a id="gap-g2"></a> **G2** — Authored audit row; EXISTS/MAPS/MISSING describe design coverage, not current implementation status. Exact state must be checked.

<a id="gap-g3"></a> **G3** — Board 25 says 2/day, 4h gap,00–08 quiet; master v14§8.6 says3/day,30min,23–08 and expanded ladder. Latest goal asks board text verification; unresolved policy/copy reconciliation must be explicit.

<a id="gap-g4"></a> **G4** — Board 31 explicitly retains this state row; apply it to current three-column shell and verify all five surfaces.

<a id="gap-g5"></a> **G5** — Board 41 explicitly selects line1; these two alternatives remain documented, not simultaneous product requirements.

<a id="gap-g6"></a> **G6** — Celebration exists, including batch44 timing/result repairs; authored visual phases and final current layout need individual pairs.

<a id="gap-g7"></a> **G7** — Celebration implemented with original synthesized audio; supplied reference has no recording. Exact current phase pairs and physical listening remain.

<a id="gap-g8"></a> **G8** — Companion/Profile implementation exists with real conversation/stats and known stage/data differences. Batch44/45 changes invalidate blanket older pair claims.

<a id="gap-g9"></a> **G9** — Current atom includes raise; stale Eight poses caption must not drop the authored ninth pose. Pair must use actual board size.

<a id="gap-g10"></a> **G10** — Current atom keys override stale Six expressions caption; artwork and event trigger/hold are separate verification concerns.

<a id="gap-g11"></a> **G11** — Current stocked fridge exists; v14 snack semantics differ from old beer example. Match glass/stock geometry with actual data.

<a id="gap-g12"></a> **G12** — DirectionB is not selected for app identity/header; retained only for marquee/hero.

<a id="gap-g13"></a> **G13** — Embedded standalone is wave 62 bird artwork; current board 41 and mood-atoms wave 63 replace the mark with ghost-at-rail.

<a id="gap-g14"></a> **G14** — Embedded wave 61 landing source remains applicable, but bundled atoms/brand still contain wave 62 bird mark. Use current board 41 ghost mark; inspect hero and body separately.

<a id="gap-g15"></a> **G15** — Empty-room central far-pose application conflicts with Jens retained Home/table; notification glyph remains independently relevant.

<a id="gap-g16"></a> **G16** — Batch 45 ledger typography/order and false zero/error behavior are repaired. Inspected F12b remains PARTIAL: actual ledger is honestly empty and room/data/phone chrome differ.

<a id="gap-g17"></a> **G17** — Batch 45 safe/earned-seat behavior and typography are repaired. Inspected F12 remains PARTIAL: room/data/phone chrome differ despite the redundant title removal.

<a id="gap-g18"></a> **G18** — Floor-first entry is the later approved behavior; Board remains reachable. Do not restore two headers to match an older overview.

<a id="gap-g19"></a> **G19** — Batch 45 now verifies the functioning four-stage draft, neutral hood before colour, name handoff, served identity and safe retries. Full-frame differences remain: responsive glass/header,16px input and missing pre-birth name/resource pill; no invented stamina/heat. See inspected pairs.

<a id="gap-g20"></a> **G20** — HTML badge timing conflicts with current JSX WALKS: use source out2.2s/home1.9s; current cast/table replaces schematic sample.

<a id="gap-g21"></a> **G21** — Implementation or earlier evidence exists; this audit has not inspected a current matching pair for this individual frame.

<a id="gap-g22"></a> **G22** — Individual page section in authored width; existing whole-page evidence is only a candidate. Current branding and real guest-enabled/disabled behavior must be checked.

<a id="gap-g23"></a> **G23** — Jens explicitly requires the actual Home room/kitchen table, not a central far-pose placeholder.

<a id="gap-g24"></a> **G24** — Jens retains the kitchen table/home play and existing Watch composition; later no-duplicate-want law applies. Exact current pair still needs inspection.

<a id="gap-g25"></a> **G25** — Local assets/copy may exist; external bot/public account application has not been verified. No account mutation in this audit.

<a id="gap-g26"></a> **G26** — No complete authored current board. Existing feature bugs may be repaired under latest user authorization; no invented redesign.

<a id="gap-g27"></a> **G27** — Old You/Chats tab navigation is replaced by world navigation, roster and current companion; preserve any still-required balance/replay/chat content.

<a id="gap-g28"></a> **G28** — Reference explicitly leaves couch-facing-TV arrangement undone. Current actual replay path exists; no full reference parity claim.

<a id="gap-g29"></a> **G29** — Saved cast and true 1/2 kitchen stakes replace samples. Visiting projection/labels exist, but the full visit lifecycle requires its own audit. Named absence is visual, not a promise of permanent backend chair reservation.

<a id="gap-g30"></a> **G30** — Source state remains required; current implementation has later layout/copy/data changes. Compare this exact frame before promotion. Apply current ghost-at-rail branding, retained kitchen table, four forming stages/no collar, fixed identity and the existing Watch composition. Current sample data must be real, not fabricated.

<a id="gap-g31"></a> **G31** — Standalone He grew notification is drawn in board 25 but absent in v14 shipped ladder/current notifier; do not hide the gap behind grouped notification coverage.

## Next audit work

Inspect one current frame/state at a time, starting with known Home/draft/Safe differences and current Profile/roster/friend-entry blockers. Produce the required same-scale pair, name the mismatch, repair within the reference and founder instructions, then recapture. Do not promote a parent from one successful child. Keep source conflicts and undesigned decisions explicit.

Execution and release evidence remains in [OVERNIGHT_DESIGN_WORK.md](OVERNIGHT_DESIGN_WORK.md), [MORNING_PLAYTEST_QUEUE.md](MORNING_PLAYTEST_QUEUE.md) and the current night log. This inventory does not claim a push, deployment, guest enablement, notification delivery or external account update.
