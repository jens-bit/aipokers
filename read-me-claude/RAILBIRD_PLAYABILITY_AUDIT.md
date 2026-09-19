# Railbird playability audit — 19 September 2026

Review branch: `codex/railbird-recovery-audit`. Continues `71bed13` and
`0a3ad74`; main remains `19b34a4`. This work has not been pushed or deployed.
Jens asked us to own the design fixes, read his product documentation and
keep improving the playable game. Historical handoffs are evidence, not new
instructions; their former port-only restriction does not override him.

## The intended game

The consistent end state is a companion who plays poker, with a clear loop:
meet him at Home, choose where he plays, follow a real hand, talk about what
happened, approve a considered strategy change, then see its consequences.
Home is the default, the casino is deliberate, and the kitchen retains human
play. The owner must understand whose cards they see, where the companion is,
what happened to the chips and whether an action actually succeeded.

This reading is grounded in the current master spec
[`agentic-poker-master-spec-v15.docx`](../agentic-poker-master-spec-v15.docx)
(especially the self-change proposals and activity report-back),
[`CORE_GAME_PLAN.md`](../CORE_GAME_PLAN.md),
[`FIRST_SESSION_MISSION.md`](FIRST_SESSION_MISSION.md),
[`NEXT_PLAYTEST_FEEDBACK.md`](NEXT_PLAYTEST_FEEDBACK.md),
[`WARM_GAME_HANDOFF.md`](WARM_GAME_HANDOFF.md) and
[`DESKTOP_NEXT_DIRECTION.md`](DESKTOP_NEXT_DIRECTION.md). The master spec was
read directly from its DOCX; the older unpacked specification is not its substitute.

The engineering priorities follow from those documents:

- Strategy and attributes must affect real decisions. The server supplies
  poker math, ranges, dice and evidence; model language gives them personality.
- Existing conversations need continuity and truthful reports after activity.
  Approved strategy changes must be saved reliably and remain owner-controlled.
- Live Watch needs legible cards, useful conversation, stable geometry and a
  clear distinction between stopping observation and stopping the agent's play.
- Existing Home activities need honest availability and useful outcomes.
  Additions such as new furniture or autonomous spending cannot substitute for
  making these activities work.
- Shared warm appearance and character identity remain the visual foundation.
  Brief, skippable guidance belongs inside the actual journey, once per owner.
- Play money comes first. Real-money play, 3D, owned casinos and speculative
  new economy/stamina rules are later product decisions.

## This pass

The previous recovery repaired the main floor, Watch, privacy, commands and
economy regressions. This pass follows the companion loop through the parts
that remained disconnected.

| Issue | Behavior repaired | Evidence |
|---|---|---|
| BUG-259: stopping Watch versus stopping play | Explicit owned casino return action requests completion of the current hand; observation can stop independently. Pending return follows authoritative live-seat state. | Component tests, signed real lifecycle test and real WebSocket browser journeys. |
| BUG-260: accepting the companion's proposal | The exact stored proposal is applied once. An authoritative private receipt updates the displayed profile; errors remain visible and retryable. No model call is used to acknowledge a saved change. | Failure-first client/server checks, failed-save/retry/reopen journeys on phone and desktop. |
| BUG-261: a missing or failed model folds strong hands | The existing compiled legal policy chooses the fallback action. Invalid model actions also use that policy, with explicit provenance and actual usage retained when a response was paid for. | Missing-key, thrown-provider, malformed/illegal-output tests, real river settlement and chip conservation. |
| BUG-262: kitchen play and TV study conflict | Both automatic and requested study recheck live kitchen seating and the one household TV. A blocked automatic study leaves its daily allowance intact. | Stale-roster and real kitchen-hand tests; simultaneous household sweep, manual/automatic exclusion and separate-flat tests. |
| BUG-263: FOCUS is recorded but ignored by free decisions | Policy ratings and routing use the same deterministic perceived math as the model briefing and hand record. True equity telemetry is retained. | Failure-first boundary cases, exact neutral/disabled controls and matched action/session comparisons. |
| BUG-264: completed activities disappear from an existing conversation | A completed casino session or study files one private, deterministic report in the saved conversation. | Completion, duplicate delivery, existing-history reopening and owner-privacy regressions. |
| BUG-265: captures show only one recognizable hole card | Runtime inspection identified an unfinished staggered deal, not incorrect card placement. Capture only after both cards land; preserve game timing. | Separate exposed rank/suit-corner assertions on phone and desktop. |
| BUG-266: populated desktop floor clips the play action | Remove the inherited phone panel limit and reserve enough height for the casino room. | Three-agent household geometry, a complete 44px primary action, 240px live preview and unobscured room targets at 1440×900 and 1280×720. |

The first-session baseline passed 21 of 25 browser cases. Three failures
expected Stats to open after editing the whisper, although the approved
behavior now preserves Conversation. Those checks now verify the draft in
Conversation and explicitly open Stats before measuring it. The fourth
expected the full stake form above the populated short-phone room; visual
inspection confirmed the named companion's **Send him to play** entry is
visible. Its test now walks that entry into the stake tray and checks that
**Deal him in** is visible before any deployment. These remain behavioral and
geometry checks, rather than weakened visibility thresholds.

The expanded run also reproduced a 320px header regression: the explicit
**Stop watching** label squeezed the name to zero width and pushed Chat beyond
the viewport, so guidance correctly refused to point at it. The narrow header
now stacks name and status within one 44px row, preserving the visible stop
label and separate touch targets. Wider phone and desktop layouts retain
their existing arrangement. The first-session and return tests check the
actual target and control bounds.

Checking the actual skill rows also exposed a short-phone Stats viewport of
31px for 36px rows. Reusing the compact toolbar on short phones leaves complete
rows scrollable, preserves 44px controls and keeps the panel at 160px, below
the one-third ceiling. No card area or visibility threshold was sacrificed.

The first-session suite is now part of the browser CI gate.

The populated desktop capture exposed a separate height constraint: the
right panel had 171px for 206px of content, clipping its play action, while
the oversized upper preview reduced the casino room to 305px wide. Scoped
desktop sizing now leaves a 394px room at 1440×900 and the whole 44px action.
The shorter laptop layout preserves uniform room scaling and the 240px live
preview; phone rules are unchanged. The final floor run passed all four
cases, and ten existing desktop geometry/stake/zoom checks passed on the same
CSS (`desktop-floor-complete.log`, `desktop-floor-verified.log`).

An open private conversation refreshes its selected authenticated profile every
ten seconds while visible. Its first full private profile restores saved chat
even when Home initially supplied a compact agent. Later updates append unseen
activity reports and expose the current proposal without reopening the thread;
accepted or withdrawn proposals do not return. Drafts and local pending message
IDs are retained. Ordinary turns have no stable server IDs, so repeated words
are preserved rather than treated as proof of a duplicate. Hidden or closed
views stop those reads, and switched-agent responses are ignored. Equal-revision
hydration retains private fields omitted by later compact projections while
respecting their newer lifecycle state. This adds read-only requests, not model
calls or external notifications.

Accepted strategy changes are saved immediately. A companion already seated
retains the strategy snapshot taken at seating until the next session; this
pass does not reload strategy during an active hand. The acceptance receipt
now says "I'll use it next time I sit down" for an actual casino or kitchen
chair. Real-seat tests verify that promise, the unchanged current session,
the updated next seating and repeat acceptance (`proposal-timing-green.log`,
22 passed). An idle Home companion receives the concise saved-change receipt.

## Measurement limits

FOCUS now has the previously authored effect on free policy decisions; this
is not a new attribute curve or a rake/profile change. Across 512 deterministic
decision fixtures, FOCUS 30 changed 17 selected actions (3.32%). Neutral 50 and
high 80 matched the former ratings, margins and actions exactly. A short
real-House sensitivity check used three seeds, 50 hands per seed and 20 equity
iterations: raw math returned +496 chips with 155 own rake; corrected FOCUS 30
returned -1,088 with 133 own rake. The neutral control exactly matched the
legacy session fields. All 450 comparison hands conserved chips.
The per-condition results and seed are preserved in
[`PLAYABILITY_FOCUS_MEASUREMENT.json`](PLAYABILITY_FOCUS_MEASUREMENT.json).

That small sample demonstrates behavioral sensitivity, **not a new win-rate
estimate**. The previous 13,317-hand starter benchmark explicitly models a
numeric policy without owned attributes; this patch preserves that neutral
control. It does not establish profitability for growing or low-FOCUS agents,
and it does not validate live model quality. The free policy's DISCIPLINE
deviation and opponent-exploitation behavior still need their own measured
audit; this pass does not claim those attribute loops are complete.

## Final validation

Local validation uses Windows, Node 22.22.2 and Chromium with isolated data.
Logs are under `artifacts/playability-audit/`.

| Gate | Result |
|---|---|
| Server and verification scripts | 201 passed; 2 intentional live/data exclusions (`server-frozen.log`) |
| Client | 3,001 passed across 246 files, no skips/TODO (`client-frozen.log`) |
| End-to-end scripts | 7 passed, no skips (`e2e-final.log`) |
| Expanded CI browser coverage | 194 distinct cases passed: 191 in the integrated run, one corrected artifact-write case and two added desktop-floor cases (`browser-final-verified.log`, `bug51-final.log`, `desktop-floor-complete.log`) |
| First-session and narrow-header journeys | 26 passed; included in the browser gate (`first-session-complete.log`) |
| Production build | Passed after the desktop-floor correction; existing large-chunk advisory remains (`shots-frozen.log`) |
| Built-bundle smoke | 8 passed on a fresh server after the desktop-floor correction (`built-frozen/smoke.log`) |
| Built-bundle Home layout | 20 passed before the final desktop-floor-only CSS correction; Home sources unchanged (`home2.log`) |
| API-seeded screenshot pack | 26 passed on the final build; populated desktop floor and fully arrived guest draft inspected (`shots-frozen.log`) |
| Chip reconciliation | Delta 0 in fresh scratch, Home-layout scratch (7 owners) and final smoke scratch (6 owners); no capped ledgers |

The integrated browser run hit a Windows file-open error while overwriting
the legacy BUG-51 screenshot, after its geometry assertion passed. The capture
now uses that run's own output directory; the unchanged geometry and draft-click
checks passed on the targeted rerun. The exact OS cause was not established.
An earlier client run overlapped the final agent-switch marker fix; the frozen
rerun above passed all tests. Other discovered failures and their corrected
fixtures remain in the logs rather than being hidden with retries.

The first built-smoke run still expected the old desktop back-button label.
It now uses **Stop watching**, retaining the real floor-return, identity and
reopening assertions; the full eight-case rerun above passed on a fresh server.

Final visual review also caught a premature desktop return capture. The normal
roster and private-report refresh completed correctly; the manual-clock fixture
had omitted Table's final native STATE broadcast. Its settlement now uses the
normal broadcast order, and the capture awaits the completed felt, Home roster
and saved report. All five return browser cases passed again on the final
fixture, as did all six shared native return/identity checks
(`return-all-final.log`, `return-native-final.log`).

The guest draft capture now waits for its entire input to enter the viewport
after the landing page's smooth scroll. This corrects an early capture; the
guest journey and scrolling behavior are unchanged.

No paid provider call or production database check is included. Linux CI has
not run because the branch has not been pushed. The two server exclusions are
live-model conversation and persistent-data reconciliation; scratch money
checks are recorded separately (`chips-fresh.json`, `chips-home2.json`,
`chips-built-frozen.json`). Cold database reconciliation cannot see live table
stacks; actual hand/seat conservation is covered by the native settlement tests
and seeded FOCUS comparisons, not inferred from those cold files.

## Visual evidence

These are local fixtures on the review candidate, not production balances or
deployed screenshots. Original design references and the pre-existing
`design-refs/shipped/trace/` directory remain untouched.

- [Phone: return pending with both hole cards visible](../design-refs/shipped/playability-return-pending-phone.png)
- [Short phone: return controls and readable conversation](../design-refs/shipped/playability-return-short-phone.png)
- [Keyboard-height phone: pending return and composer](../design-refs/shipped/playability-return-keyboard.png)
- [Desktop: completed hand, Home roster and saved session report](../design-refs/shipped/playability-return-settled-desktop.png)
- [Short phone: scrollable skills below the hand](../design-refs/shipped/playability-stats-short-phone.png)
- [Smallest phone: visible name and real guidance target](../design-refs/shipped/playability-guide-small-phone.png)
- [Desktop: populated floor with a fully visible play action](../design-refs/shipped/playability-floor-desktop.png)
- [Phone: saved strategy-change receipt](../design-refs/shipped/playability-proposal-phone.png)
- [Desktop: saved strategy-change receipt](../design-refs/shipped/playability-proposal-desktop.png)
- [Phone: finished study and preserved draft](../design-refs/shipped/playability-study-phone.png)
- [Desktop: finished study and preserved draft](../design-refs/shipped/playability-study-desktop.png)

## What still determines whether this is a good game

Local automated checks can prove routes, permissions, settlement, saved
changes and geometry. They cannot prove that a newcomer understands the game
or wants another session. The documented target remains five unaided first
sessions, with at least four users completing the core loop in about ten
minutes. Observe comprehension and voluntary continuation before changing
cadence or adding mechanics.

The next evidence priorities are a normal-speed physical-phone playtest and
an authenticated live-model exchange, then a larger owned-attribute economy
measurement and the remaining DISCIPLINE/READS policy audit. Human-play
discovery, broader human/replay hand labels, condition/stamina explanations
and report timing remain useful product follow-ups where current evidence is
insufficient. Existing unanswered ideas about new casino drinking, alternate
live speeds, autonomous spending, new room objects and a substantial identity
redesign have not been treated as approved mechanics.

Production proxy behavior and live provider quality still require working
environment access. Earlier read-only SSH authentication was rejected, and
local live-model credentials were unavailable. No production changes were made.
Physical-phone and newcomer observations likewise remain unverified.
