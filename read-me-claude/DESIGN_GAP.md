# Railbird — design gap, by screen

Updated 12 September 2026 for the Home-first run; untouched screen notes retain their earlier evidence. **One section per screen**: where it stands, what is open against it, and what to look at on the phone. It is meant to be read in five minutes, at the start of a session, by a person — and it is kept current by hand because it is short enough to be.

The 185-frame source-indexed inventory and its 466 substates are in **[DESIGN_STATE_GAP.md](DESIGN_STATE_GAP.md)** — the enumeration of everything the boards author, indexed to the exact reference line, with the six statuses, the evidence rules, the shared gap notes and the per-batch evidence log. That file is *referenced, not maintained by hand*: query it, or regenerate it from [current-frame-inventory.json](../artifacts/current-frame-inventory.json). Batch 41 is preserved byte-for-byte in [DESIGN_GAP_BATCH41.md](DESIGN_GAP_BATCH41.md) and the older history in [DESIGN_GAP_HISTORY.md](DESIGN_GAP_HISTORY.md). [HOW_WE_WORK.md](HOW_WE_WORK.md#design_gapmd) says why the two were split.

**This is not a deployment record.** A screen being ported does not mean it is on the VPS; the night log and the Actions page say that.

**The words used here.** *Ported* — a named job moved it and the pair was inspected and matched. *Partial* — it works, and a specific named difference remains. *Unpaired* — code exists, nobody has put it beside its reference at the same scale. *Blocked* — the reference itself is unfinished, or a product decision is missing. A status with no named difference is not a status.

**Pairs.** Only for the frames a job names, three to six per queue, never inventory-wide, never redone once matched — see [HOW_WE_WORK.md](HOW_WE_WORK.md#pairs). Reference left, actual right, same scale, 390×844 phone and 1440×900 desktop. Real data or a declared fixture, never invented production facts. Every reference carries simulated iOS chrome the product does not have; that difference is permanent and is not worth writing down again.

---

## Overrides and source conflicts

Founder decisions and reference contradictions. They outrank the boards, and permission to repair a bug is never permission to reopen one.

- **Founder:** Home is the default destination after the existing entry/onboarding flow. The casino is a deliberate destination from Home; floor-first applies only inside the casino. The kitchen table and home games stay. The approved Watch composition stays. Human Sit keeps working. The draft has four stages and no collar. Branding is the Railbird ghost at the rail. The roster control is separate from the live count. No shared-room redesign is inferred from permission to fix a bug in it.
- **Desktop retention:** [board 31's introduction](<../design-refs/Agentic Poker Desktop Parity.html>) explicitly retains the pace, wallet, floor, matrix and glass states. P1–P13 are not superseded layouts.
- **Brand:** the standalone embedded wave-62 bird yields to [board 41's](<../design-refs/Railbird Brand.html#b1>) ghost. The README's one-colour law still contradicts B1's felt-tone exception at 96px and above — **unresolved**, and it has to be decided before any brand variant can be called matched.
- **Notifications:** [board 25 N6](<../design-refs/Agentic Poker Notifications.html#nbudget>) says 2/day, a 4h gap and 00–08 quiet. The master spec §8.6 describes the shipped 3/day, 30min, 23–08 ladder. **Unresolved**; neither is silently a board match.
- **Crossing timing:** F06/F09's captions say 1.8s/1.6s, [mood-home2.jsx](../design-refs/mood-home2.jsx) says 2.2s/1.9s. Use the source and keep the conflict explicit.
- **Artwork counts:** the current atoms carry seven expressions and nine hand poses, including asleep and raise. The stale "Six expressions" and "Eight poses" captions do not delete them.
- **TV:** [C7b](<../design-refs/Railbird The Agent.html#c7b>) leaves the couch-facing-TV arrangement unfinished under freeze. Do not invent a rearrangement and call it parity.
- **Undesigned:** visit/knock/accept, the referral doorway, the visit-specific share card, hold-to-fast-forward and public-account selfie states have no complete authored board. Existing bugs in them may be fixed; new design may not be inferred.

---

## Home

*Partial, and the most worked-on screen in the product.* The room, the conversation band, the request, the away card and the header have been ported frame by frame across batches 50–54: the first-action typography, F01's confirmed-empty system sentence, the collapsed band's glass, the speaker avatar and compact inline name, the side tail on ordinary speech, the want answers' condensed type, the away frame's mono numbers, the request's saved portrait, compact away names, and — in batch 54 — the header's muted subtitle and quiet-count ink (BUG-195).

**Home-first run:** HOME-1 corrected the fixed-height room seam, quiet roster outline, near/opponent sizes, phone cards and printed backs, and empty wall hooks. Root inspected the native F10 pair. HOME-2 adds the authored fridge pose, light and return prop from an accepted owner Home event, with one pickup place and no replay of old events. Its phone/desktop browser paths pass; final full gate is recorded in ASTRA_NIGHT.md. Recaps no longer restart on a Home return, and idle phases differ by character.

The same F10 pair is updated in artifacts/show/home-1-F10-pair.png. It keeps the kitchen table by founder instruction; wallet, saved identities, resources and TV history use actual fixture values instead of the reference samples. Other previously recorded header/footer substates remain partial unless specifically paired. The fridge animation uses the existing 1.6-second walk clock for out/hold/back; the source supplies poses, not these durations.

The room's own name pills are deliberately six characters with no ellipsis — "Granite" over a body reads `Granit`. That is the rule, not a clipping bug; the plate and the roster carry the full name.

**Open**
- **BUG-164** — the lone-agent pose and size still differ from F05. *Blocked*: the authored solo couch/TV state has no truthful trigger for a reader with no replay history. The decision is in [DECISIONS_NEEDED.md](DECISIONS_NEEDED.md) and it is Jens's.
- **BUG-176** — the TV's lower opponent is hard to tell apart in a two-seat game. *Blocked* by an overlap in the authored caption and body.
- **BUG-187** — one isolated cold browser entry did not mount Home within five seconds. Unclassified, not reproduced since.

**On the phone:** open Home with two or more agents. The location line and the quiet count under the room name should read as soft grey, not near-black. A request should carry the speaker's actual saved portrait and his name inline. Then sit in it for a minute — whether it reads as a room is the question no pair can answer.

## Draft

*Partial.* Four stages and no collar; that is the founder override, not a missing feature. Batch 45 verified 1→2→3→4 at three heights: the neutral hood before colour, the real name handoff, and safe retries on a failed build — a failed paid draft returns a retryable 503 and keeps the conversation instead of silently becoming an agent nobody asked for.

The named differences are the responsive glass edge and compact header against the reference's fixed geometry, the 16px input field, and the missing pre-birth name and resource pill. Stamina and heat are deliberately *not* invented before he exists.

Board 24's first-five-minutes path — all fourteen frames — is partial, and its nine-step sequence has never been walked end to end against the reference.

**Open** — nothing named. The gap here is unwalked verification, not a defect.

**On the phone:** make an agent from nothing. Watch the four stages arrive, and check that no number about him appears before he is born.

## Agent

*Partial, with the expensive half already matched.* The batch-53 companion audit put C1 and C2 beside the product natively: the 178px saved portrait and the 264px stage match. Profile shows real statistics and returns directly to Chat.

**Open**
- **BUG-197** — the phone action strip loses the authored weight, number size and ink: 400-weight labels where the source says 600, `#A1A1A1` where the current muted role is `#9E9EA2`, 9px numbers where the source says 10px mono, and `.1em` tracking on DEPLOY instead of `.14em`. Scoped to the phone AgentView; the portrait and the stage are not rebuilt.
- **BUG-196** — Profile's RECENT costs carry no event time and sort behind older growth entries. `buildFlaggedEntry` records a numeric `flaggedAt` that the overview never reads, so a freshly flagged cost sorts as time zero.

**On the phone:** open an agent and look at the lettering in the action strip under him — the labels, the numbers, the word DEPLOY. Then open Profile and check RECENT is genuinely newest-first with real times on it.

## Roster

*Partial.* A row now shows the two distinct facts C5 asks for — where he is, and what he is playing — instead of merging or repeating them (BUG-167). The muted ink and the name-pill ink are corrected (BUG-171, BUG-166). Real 1/2 kitchen stakes and the saved cast replace the reference's samples, and the roster control stays separate from the live count.

Visiting projections and their labels exist, but the visit lifecycle has no authored board at all, so the away and absence states can only be checked against what is written down here rather than against a reference.

**Open** — nothing named.

**On the phone:** open the roster with somebody away. His place and his stakes should be two facts, not one sentence. The live count should not behave like a button.

## Casino

*Unpaired.* All three board-27 frames and both of Home's casino frames have code behind them and no inspected pair. Inside the casino, floor-first is the retained behaviour: Board stays reachable and the older two-header overview is not restored to make a pair match. Home remains the app default and the way into the casino.

**Open** — nothing named.

**On the phone:** enter the casino. You should land on the floor, and Board should still be one tap away.

## Watch

*Mostly unpaired, composition frozen by decision.* The approved Watch composition is retained and not reopened. The ordinary-win card is ported and pair-inspected (BUG-173, C8a). The big win and the bust exist and run, with originally synthesized audio — the reference supplies no recording, so those phases have never been paired and the sound has never been judged against anything.

**Open**
- **BUG-176** — two-seat miniature legibility, shared with Home's TV.
- **BUG-31** — the prediction beat has no home in the current watch layout.

**On the phone:** watch a hand to showdown and look at the ordinary win card. If you can catch a big win or a bust, look at those too — and listen, because nobody has judged the sound yet.

## Safe / Fridge

*Partial.* Batch 45 repaired the safe's typography and borders, removed the duplicated title, put the ledger newest-first and killed a false-zero display. The ledger being empty is real data, not a broken screen. The stocked fridge exists; the spec's snack semantics differ from the reference's older beer example, and the glass and stock geometry have not been compared against actual data.

**Open** — nothing named.

**On the phone:** open the safe, then the ledger, then the fridge. If the ledger is empty it is telling the truth.

## Landing / Guest

*Partial.* The real recruiter mounts directly rather than behind a blank Suspense state, and the guest recruiter owns its own scroll so focusing the field no longer drags the room off screen. All four board-40 frames and all four standalone-landing frames are partial, on current branding and on real guest-enabled behaviour.

**`GUEST_ENABLED` is off and is not set on the VPS.** The guest routes 404, no cookie is read, and the guest door cannot be playtested in prod until somebody flips it — which is deliberate, and is also the way back without a deploy.

**Open**
- **BUG-156** — the entry bundle is large despite a fast local paint (the built entry chunk is about 564 KB, 178 KB gzipped). Measured debt, not a regression.

**On the phone:** the landing page in a browser. The guest path needs the flag set first; ask before flipping it.

## Brand

*Mostly unpaired.* The ghost at the rail replaces wave 62's bird everywhere it matters; the bundled atoms still carry the old mark, and the hero and the body need inspecting separately. B12, the loading screen, now paints the authored artwork while the Telegram SDK is still pending, without deciding an owner early — that is BUG-191's parser half.

The unresolved brand conflict is above: the one-colour law against B1's felt-tone exception at 96px and up. Nothing brand-related can be called matched while that is open.

**Open**
- **BUG-191** — the external Telegram SDK still delays the first screen on a normal cold entry. The parser blocking and the readiness guard are fixed; the wait a person actually experiences is not, and no numerical improvement is claimed.

**On the phone:** cold-open the app from Telegram, from a killed app, and count. This one is genuinely yours to judge — the loading screen looking right is not the same thing as the wait being bearable.

## Desktop

*Partial, all twenty-nine frames.* Three columns, always open: roster left, room or felt centre, thread or fixture right. The roster is a permanent 250px column and is not a mode anything toggles. Board 31 explicitly retains the pace, wallet, floor, matrix and glass states — they are not old layouts to be discarded.

Batch 54 closed three navigation defects at 1440×900: an unseated away agent's **Open him** now opens his profile in the rail (BUG-192), an owned agent visiting a friend's kitchen can open Watch from his away card (BUG-193), and a Watch the server refuses now shows the actual reason with a working way home instead of an empty felt saying SHUFFLING (BUG-194).

**Open**
- **BUG-109** — a broad desktop draft test times out inside the full gate. Query scope mitigated, cause not settled.

**Not a phone screen.** Look at it at 1440×900: press Open him on somebody who is walking, and open Watch on somebody visiting a friend.

## Notifications

*Partial, and blocked on a decision.* Eight frames partial; one — N8's "he grew" ping — is drawn on the board and absent from the product.

The conflict is above and it is not a bug: the board says 2/day with a 4h gap and 00–08 quiet, the spec and the shipped notifier say 3/day with a 30min gap and a 23–08 ladder. Until that is decided neither is a match, and the existing notifier tests do not settle it.

**Open** — the policy decision itself.

**On the phone:** nothing yet. This screen needs a ruling before it needs a playtest.

---

## What to do next

One frame at a time, named by the job that touches it. Render the pair, name the mismatch, repair inside the reference and the overrides above, recapture — then stop, rather than regenerating the neighbours. When a screen's section here goes a whole batch without changing, that is the screen to playtest, not the one to re-audit.

Execution and release evidence lives in [OVERNIGHT_DESIGN_WORK.md](OVERNIGHT_DESIGN_WORK.md), [MORNING_PLAYTEST_QUEUE.md](MORNING_PLAYTEST_QUEUE.md) and the current night log. Nothing in this document claims a push, a deployment, guest enablement, a delivered notification or an external account update.
