# ECONOMY_MEASURED.md — the four assumed numbers, replaced with real ones

> **Historical report; corrected on 19 September 2026.** The long-term model
> below assumes chair purchase costs and promotion rules that differ from the
> shipped game. Its 100% household-collapse claim is not a validated forecast.
> The original simulator also uses a synthetic initial opponent and incompletely
> seeded decisions. See [the recovery benchmark](ECONOMY_RECOVERY_BENCHMARK.md)
> for reproducible real-House comparisons, current progression rules and limits.
> The original text remains here as an audit record.

ECON-1, 2026-09-16, on `chore/econ-1` (branched from `origin/main`, worktree at
`C:\Projects\ai-poker-tableview`). This is a measurement job — nothing in `src/`
or `client/` changed. `data/arena/` is gitignored everywhere except this
worktree's own branch history, which is the only reason the 7 Sep arena runs
exist anywhere: they are the three `run-2026-09-07T*.json` files, carried over
from the prior arena branch's uncommitted work (stashed, applied, not dropped —
see the note at the end).

## 0. The one-paragraph answer

**The assumed model does not survive contact with the real numbers.** An
economy arc was built on a win rate of +20bb/100. The measured win rate, pooled
across 24,094 real hands against the real House cast at all three stakes, is
**-8.9bb/100** — agents are net losers, not 20bb/100 winners, and that holds
whether or not the rake is counted (pre-rake the population is close to
breakeven, +0.5bb/100; the rake is what pushes it negative). Re-run with the
measured inputs, the arc's own simulation shows **100% of 2,000 simulated
households eventually go broke**, essentially nobody reaches a 3rd agent
(0.5–0.9%), and **nobody reaches a 4th agent or high stakes at all** inside 400
days. This matches Jens's live experience exactly: his agents keep losing to
the House.

---

## 1. Win rate vs House bots, bb/100, per stake

### Sourcing, in the order the job specified

1. **The arena JSONs — do not answer this question.** All 17 files in
   `data/arena/` (`run-2026-08-29…` through `run-2026-09-07T23-48-26-590Z.json`)
   are the four `scripts/arena-profiles.json` archetypes (Nit, Loose Cannon,
   TAG, Calling Station) playing **each other**, always at $10/$20, never
   against a House cast member. Checked directly: no file contains any of the
   six `HOUSE_CAST` names (`src/server/houseCast.js` — Doyle_v3, Phil_AI,
   Granite, MsAllIn, TiltedTed, TheProfessor); a naive grep hit on "allin" was
   `Calling` containing the substring, not a match. 17 files, 8,760 hands
   total, and none of it is the number this job asks for. Ruled out rather
   than stretched to fit.
2. **`scripts/audit-chips.js`'s 350-hand run — a conservation check, not a
   win-rate measurement.** The "350 hands across ten households" runs recorded
   in `CHANGELOG.md` (MERGE-10, CI-FIX) measure `Σ safes + Σ pockets + bank`
   before and after — they prove chips aren't created or destroyed, and say
   nothing about who wins. Not a source for this number either, and the run
   itself was never checked into the repo (ephemeral, scratch cwd, by design —
   same as every measurement in `MONEY_AUDIT.md`).
3. **So: the sim, per the job's own fallback.** `scripts/simulate-economy.js`
   already exists (MONEY-2 job 3) and already measures something close to
   this, but it seats a synthetic "balanced" character as the **opening**
   House opponent and only reaches the real `HOUSE_CAST` on a re-seat after a
   bust. For "win rate vs House bots" specifically, I wrote a second scratch
   script (not committed — lives only in this session's scratchpad, per the
   job's "you change nothing in src/ or client/") that seats the **real**
   House cast from the first hand, via the table's own
   `_seatHouseRegulars`/`pickHouseRegular` — the same call `startAgentSession`
   and `_finishCompletedHand` make in production — at each of the three
   `wallet.js` `STAKES` rungs. Real engine (`src/engine/game.js`), real
   `Table`, real compiled policy (`chooseFromPolicy`, through the table's own
   `_buildAiGameState`), real `_takeRake`. `EQUITY_ITERATIONS=120` (not the
   product's 800) for tractability — the same substitution `MONEY_AUDIT.md`
   §18 already checked against the product default and found "same answer,
   same sign" (-2.2% vs -3.7% on the same seeds). No `ANTHROPIC_API_KEY` in
   the environment at any point (the script refuses to start with one).

### The measurement

Two passes, to see whether the number was noise or signal. A **hero** — one of
the four arena archetypes, round-robin, so the population isn't one
personality — deployed against the real House cast, in 100-hand sessions,
re-buying whenever a session ends, until each stake had at least 2,000 hands.

| pass | hands/stake | total hands |
|---|---|---|
| sanity check | ~2,200–2,260 | 6,695 |
| main measurement | ~8,000–8,050 | 24,094 |

Main measurement, net of rake (what actually reaches the agent's stack):

| stake | hands | sessions | busts | bb/100 (net of rake) | rake, bb/100 | stdev, bb/100 |
|---|---|---|---|---|---|---|
| $10/$20  | 8,003 | 193 | 87 | **-4.1** | 9.1 | 144.9 |
| $25/$50  | 8,039 | 199 | 95 | **-19.3** | 9.4 | 143.3 |
| $50/$100 | 8,052 | 195 | 87 | **-3.2** | 9.9 | 145.1 |
| **pooled** | **24,094** | 587 | 269 | **-8.9** | **9.4** | **144.5** |

Pre-rake (i.e. what the hero actually won or lost against the House's skill,
before the house's cut): **+0.5bb/100 pooled** — statistically indistinguishable
from breakeven. **The loss is almost entirely the rake, not weaker play.**

The per-stake numbers swing a lot (-4, -19, -3) and that swing is exactly what
the sanity-check pass at a third the hands also showed (-45.9, +30.5, -19.3 —
a completely different pattern from the main pass). That is not the measurement
being wrong; it is `stdev ≈ 144bb/100` doing what a stdev that size does at
only ~8,000 hands (standard error ≈ 144/√80 ≈ **16bb/100** per stake — the
$25/$50 row is well within noise of the other two). **The pooled, 24,094-hand
number is the one to trust**, both because it has four times the samples of
any one stake and because §2 below finds no mechanism by which the House
should play differently by stake in the first place — pooling isn't
convenience, it's what the code says should be true.

### Cross-check against work already in this repo

`MONEY_AUDIT.md` §18 ran `scripts/simulate-economy.js` — 12 owners, 3 seeds,
~1,500 hands per seed, $10/$20, the *synthetic* opening opponent — and found
the same qualitative answer independently: **"a population playing a roughly
break-even game against the House"** pre-rake (drift -0.3%, "inside its own
noise"), and **-1.9% mean drift at the shipped 1%/3bb rake** (`RAKE_PERCENT`,
`RAKE_CAP_BB` — `src/server/rake.js`). Converted to the same units: 1,170
chips raked per 1,000 hands on that population ≈ **5.9bb/100** — same sign and
same order of magnitude as my 9.1–9.9bb/100, lower because their opening seat
is a synthetic "balanced" profile rather than the real, contextually-picked
House cast every hand of mine uses. Two independently-run measurements,
different code paths, same conclusion: **breakeven before the rake, a real
loser after it.**

### Reconciling against the one real data point given

*"A single agent with 844 hands, 63.5% win rate, 10 sessions."* At `stdev ≈
144bb/100`, the standard error at 844 hands is ≈144/√8.44 ≈ **50bb/100**. A
single agent running hot by 50-100bb/100 over 844 hands against a population
mean of -8.9bb/100 is unremarkable — it's under two standard errors. **One
winning agent in prod does not contradict a population that mostly loses**; it
is exactly the kind of outlier `stdev` this large predicts constantly.

### Trust

**Medium-high on the sign, medium on the magnitude.** The engine, the table,
the real House cast, and the rake are all the product's own code, unmodified —
nothing here is a guess about mechanics. What is *not* real: the compiled
policy stands in for the model. Production sends hard spots at a watched table
to the model (`DECISION_ROUTER`), which plays better than the policy —
`MONEY_AUDIT.md` says so explicitly and that caveat applies here unchanged. So
a real, watched, model-assisted agent may lose less than -8.9bb/100, or even
win — but a population of policy-only play, which is most of an agent's
unwatched hours, loses. 24,094 hands and a second independent measurement
(`MONEY_AUDIT.md`) agreeing on the sign is enough to trust **the direction**;
the exact **magnitude** wants another order of magnitude more hands before
anyone should tune anything off the -8.9 by itself.

---

## 2. Hands per day

> **19 September correction:** the 440 / 880 / 1,760 figures below are loose
> long-run recovery ceilings, not measured sustainable hands per calendar day.
> They allocate all 24 hours to resting and omit the time spent playing,
> during which recovery stops. A real throughput estimate must include both
> table pacing and rest. A full initial reserve can additionally fund a first
> day's burst; it does not recur every day without time to recover.

Straight from `src/agent/stamina.js`, no simulation:

- `STAMINA_MAX = 100`, `RECOVER_PER_HOUR = 22` — a full reserve, uncontested,
  comes back in 100/22 ≈ 4.5 hours resting.
- `HAND_COST = 0.6` (neutral stamina attribute), `HAND_COST_LOW = 1.2`
  (STAMINA attribute 0), `HAND_COST_HIGH = 0.3` (STAMINA attribute 100). Casino
  hands only — `HOME_HAND_WEIGHT = 0.3` prices a kitchen-table hand at 30% of
  a casino one, and this section is about the casino, where stakes live.
- `staminaNow` only credits recovery while `resting: true` — **no recovery
  while seated.** So the reserve is a throughput cap, not a burst cap: over any
  long stretch, recovered hands/day = (hours resting × RECOVER_PER_HOUR) ÷
  (cost per hand). Substituting 24 resting hours produces only the upper
  bound `24 × RECOVER_PER_HOUR ÷ HAND_COST`, with zero playing time budgeted.

**Never fed — recovery-only upper bounds:**

| stamina attribute | hand cost | recovery ceiling = 24 × 22 ÷ cost |
|---|---|---|
| worst (0)    | 1.2 | 528 ÷ 1.2 = **440** |
| neutral      | 0.6 | 528 ÷ 0.6 = **880** |
| best (100)   | 0.3 | 528 ÷ 0.3 = **1,760** |

**Fed to the brim every time he asks:** `SNACK_STAMINA = 25`
(`src/server/fridge.js`) is added instantly, uncapped by "resting," any time
`itemHelp()`'s gate says he's not at 100 (`feeds = staminaEffectOf > 0 &&
tired`, where `tired` is "reserve below 100 OR stage isn't fresh"). One snack
replaces roughly 21–83 hands' worth of natural drain in a single instant, with
no cooldown in the code. So an agent fed on every ask never actually runs the
reserve down far enough to be throughput-limited by it — **the reserve stops
being the constraint at all**, and hands/day becomes bounded by something this
file has no opinion on (table pacing, `HAND_PAUSE_MS`/`UNWATCHED_HAND_PAUSE_MS`,
how often the owner is around to buy snacks) rather than by stamina.

**Source: the shipped constants, arithmetic only.** The recovery arithmetic
is exact under the stated assumptions; 880/day is not a validated throughput.
Matching a reconstructed progression model to assumed inputs is not an
independent measurement of playing or resting time.

---

## 3. Standard deviation, bb/100

**~144–145bb/100, pooled ≈ 144.5.** From the same 24,094 hands as §1 — every
`stack_after − stack_before` per hand, in bb, across all three stakes,
population variance converted to the 100-hand convention
(`stdev_100 = stdev_per_hand × √100`).

| stake | stdev, bb/100 |
|---|---|
| $10/$20 | 144.9 |
| $25/$50 | 143.3 |
| $50/$100 | 145.1 |

This is the most stable number this job produced. It barely moved between the
6,695-hand sanity pass (138.7–144.2) and the 24,094-hand main pass
(143.3–145.1) — unlike the mean, which swung wildly between the two passes
(§1). **Real poker sits near 100bb/100; these bots run about 45% hotter.**
Plausible reasons visible in the code rather than guessed: heads-up only (no
multiway pots to average variance down), full 100bb stacks every session, and
a "Loose Cannon" maniac profile (`tightness: 35, aggression: 80, bluffFreq: 45`
in the rotation) that plays for stack-sized swings by design.

**Source: my own sim. Trust: high** — large sample, consistent across stakes,
consistent across two independent runs at different sample sizes.

Consequence stated plainly, because it's what the number is *for*: a $100
starting bankroll at $10/$20 (bb = $0.10) sees a **one-session** (100-hand)
swing of `stdev × √1 ≈ 144.5bb ≈ $14.45` — nearly 15% of the whole bankroll,
from variance alone, before the -8.9bb/100 drift even enters. A bankroll this
size busts from bad luck alone on a routine basis, never mind a losing edge.

---

## 4. Rake drag, bb/100

**Measured directly from the same hands as §1, not estimated** — `_takeRake`
is real, `RAKE_PERCENT=1`/`RAKE_CAP_BB=3` are the shipped defaults
(`src/server/rake.js`), and `table.seatRakePaid(seat)` is read straight off the
table after every session.

| stake | rake, bb/100 |
|---|---|
| $10/$20 | 9.1 |
| $25/$50 | 9.4 |
| $50/$100 | 9.9 |
| **pooled** | **9.4** |

Rake is charged on every pot the hero **wins**, independent of how his overall
session lands — a raked pot on hand 40 of a session he ultimately loses costs
exactly what it would in a session he ultimately wins. So "on a winning agent"
reads as: this is what a competent, active player actually pays, not a
theoretical cost that only lands on the lucky. At ~9.4bb/100 against a
pre-rake result of +0.5bb/100 (§1), **the rake is the entire story of why
agents lose** — it converts an otherwise-breakeven population into a losing
one, almost chip for chip (0.5 − 9.4 ≈ −8.9, which is exactly the pooled net
figure in §1).

**Cross-check:** `MONEY_AUDIT.md` §18's own measurement at the same settings,
different population (12 owners, synthetic opening opponent): 1,170 chips per
1,000 hands at $10/$20 ≈ 5.9bb/100. Lower than my 9.1–9.9, and the likely
reason is visible in the setup, not a contradiction: my hero faces the real,
contextually-picked `HOUSE_CAST` from hand one, theirs faces a synthetic
"balanced" character until the first bust. Both agree the rake is a real,
mid-single-digit-to-low-double-digit bb/100 drain — nowhere near free, nowhere
near confiscatory.

**Source: measured, both runs. Trust: high** on the mechanism (the rake code
is exact and deterministic given the pot), **medium** on the precise figure
for the reason §1 gives (policy-only play, not model-assisted).

---

## 5. Do the House bots get harder at higher stakes?

**No. The same six bots, unchanged, everywhere.**

`src/server/houseCast.js`'s `HOUSE_CAST` is six named regulars (Doyle_v3,
Phil_AI, Granite, MsAllIn, TiltedTed, TheProfessor) with **static** profiles —
`{ tightness, aggression, bluffFreq, discipline }` — fixed at module load, with
no reference to `bigBlind`, stake, or buy-in anywhere in the file.
`pickCastMember()`/`pickCastMemberExcluding()` (`src/server/matchmaking.js`)
choose among them by the **opposing table's mean tightness/aggression** —
seating a maniac (`MsAllIn`) against a table of nits, an aggressor
(`Phil_AI`) against a table of stations, and so on, purely to generate action
and contrast. `table.js`'s `_seatHouseRegulars()`, called from
`startAgentSession`, `_finishCompletedHand` (every bust), and the loneliness
repair, passes only the opposing profiles and the already-seated cast ids —
never the stake — into that pick.

The measurement in §1 is consistent with this: bb/100 swings between stakes
(-4.1, -19.3, -3.2) but with **no monotonic trend**, and every swing is inside
one standard error (§1) of the pooled mean. If the House got tougher upstairs,
the pooled measurement would show a trend across stakes; it doesn't, because
there is no mechanism in the code that could produce one.

---

## 6. The arc, re-run with measured numbers

`economy_model.py` is not in this repo (checked: no file of that name anywhere
under the working tree). Rewritten as `arc-sim.mjs`, a from-scratch Monte
Carlo — kept only in this session's scratchpad, not committed, per "you change
nothing in `src/` or `client/`" (it isn't source, but it also isn't something
this repo needs to carry). Structure, stated plainly since nothing here is
handed down from the original script:

- **$100 start**, one agent, one bankroll.
- **Stakes**: $10 / $100 / $1,000 buy-in (bb = buy-in ÷ 100, matching the
  product's 100bb-stack convention). Promotes to the next stake once the
  bankroll holds **3 buy-ins of the next tier** (a small, explicit
  shot-taking buffer, not the product's own rule — there isn't one in the
  code to port). Demotes back down if the bankroll can no longer cover the
  current stake's buy-in.
- **Chairs** at $100 / $600 / $2,500 for the 2nd/3rd/4th agent, purchased the
  instant the bankroll can cover the price and still leave one buy-in in
  reserve.
- **880 hands/day** (§2's recovery-only ceiling, used as an assumed pace).
  This is not always available or a conservative calendar-time estimate:
  playing consumes time that the formula assigned to recovery.
- **One snack a day, 6bb** at the day's stake, debited from the bankroll —
  the daily cost of keeping him at that pace.
- Daily result: `Normal(mean = winrate_bb100/100 × hands, sd = stdev_bb100 ×
  √(hands/100))`, at the measured, net-of-rake win rate and stdev (§1, §3) —
  **pooled across stakes**, because §5 found no reason to model stakes
  differently.
- **2,000 simulated households**, 400-day cap, median day of first arrival
  at each milestone.

**Calibration check, not part of the finding:** run with the *assumed* inputs
(+20bb/100, stdev 100, and — solved for, not measured — 800 hands/day) the
model reproduces the assumed table closely (2nd agent day 1 vs. day 3, mid
stakes day 18 vs. 19, 3rd agent day 21 vs. 24, 4th agent day 37 vs. 37 exactly,
high stakes day 56 vs. 45). This is calibration to assumed outcomes, not an
independent confirmation: §2's 880 is a recovery-only upper bound and does
not measure the calendar-day pace used by this reconstruction.

### The table asked for

| milestone | assumed | measured |
|---|---|---|
| 2nd agent | day 3 | day 1 (but only 61% of households ever get here at all) |
| mid stakes | day 19 | day 15–18 (1.8–2.2% of households ever get here) |
| 3rd agent | day 24 | day 15–28 (0.5–0.9% of households ever get here) |
| 4th agent | day 37 | **never** — 0–0.1% across four different seeds |
| high stakes | day 45 | **never** — 0% across four different seeds |

Robust across four random seeds (20260916, 1, 2, 3) — not one run's fluke.
**100% of the 2,000 simulated households go broke before day 400 in every
seed.** The early milestones look almost on-pace at the median because
variance (§3) is large enough to carry a lucky minority up before the -8.9bb/100
drift (§1) catches them — the 61% who ever reach a 2nd agent illustrates
exactly that, and the 39% who never do illustrates the other side of the same
coin. Past the 3rd agent, luck runs out faster than it can compound: nobody's
2,000-household sample, in any seed, reaches a 4th chair or a high-stakes
table within 400 days.

**Per the brief: the arc never completes, and that is the finding.** Nothing
above was tuned to make the table fill in; the model was built once, calibrated
against the *assumed* row to confirm its shape was sane, then re-run once with
the measured numbers substituted in.

---

## 7. Summary for the report-back

- **Win rate vs House, bb/100:** -8.9 pooled (24,094 hands; -4.1/-19.3/-3.2 by
  stake, each individually noisy at ~±16bb/100 SE). Pre-rake, ≈breakeven
  (+0.5). Cross-checked against `MONEY_AUDIT.md`'s independent measurement,
  same conclusion. Trust: medium-high on sign, medium on magnitude — policy
  play only, no model calls.
- **Hands/day:** 440–1,760 (880 at neutral) are unfed recovery-only ceilings,
  not sustainable calendar-day measurements; actual pacing and rest were
  omitted. Frequent feeding moves the constraint toward pacing and owner
  availability. No observed hands/day claim is established here.
- **Stdev, bb/100:** ~144.5 pooled, stable across stakes and sample sizes.
  ~45% hotter than real poker's ~100. Trust: high.
- **Rake drag, bb/100:** ~9.4 pooled, charged per pot won regardless of
  session outcome. Cross-checked against `MONEY_AUDIT.md` (5.9, different
  population). It is essentially the entire gap between breakeven and losing.
  Trust: high on mechanism, medium on exact figure.
- **Bots harder at higher stakes?** No — same six-member fixed cast
  everywhere, picked for table contrast, never for stake. Confirmed both in
  the code (`houseCast.js`, `matchmaking.js`) and in the measurement (no trend
  across stakes, all differences inside noise).
- **The arc:** assumed model said 2nd agent day 3 → high stakes day 45.
  Measured model says most households never see a 3rd agent, none see a 4th
  or high stakes, and all of them eventually go broke.

**One sentence:** the assumed model does not survive contact with the real
numbers — it was built on a 20bb/100 win rate that the real system does not
produce, the real system is a rake-driven net loser for the population that
plays it, and Jens's agents losing to the House is not an anomaly, it is what
the code, measured honestly, says should happen to everyone.

---

## Note on how this branch started

`git status` at the start of this job showed the previous arena branch's work
still uncommitted: 14 tracked arena JSON files (`run-2026-08-29…` through
`run-2026-09-06…`) showing as deleted from the working tree, and the three
7 Sep files sitting untracked. Per the job's own instruction, that was stashed
(`git stash push -u`, tagged `econ-1-preserve-arena-20260916`) rather than
discarded before switching branches, then re-applied on `chore/econ-1`. The 14
"deleted" files were restored from `origin/main`'s own history (they are
tracked there) so this measurement could read all 17 runs; the stash itself
was left in the stash list, untouched, for whoever was mid-task on the arena
branch to find.
