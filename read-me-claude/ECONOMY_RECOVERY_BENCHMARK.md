# Economy recovery measurement — 19 September 2026

The entry-room House mix now gives the default balanced policy a measured positive return while retaining losing sessions and strong opponents. The measured estimate is **+14.43 big blinds per 100 hands after rake**, with substantial uncertainty: standard error 7.24, approximate 95% interval **+0.24 to +28.63**. This is evidence for a limited starter adjustment, not a promise that every agent earns money or that the entire progression economy is solved.

The founder authorized continuing the economy repair. With no narrower preference supplied, the working assumption was modest positive expected earnings for a cared-for starter, losses and variance preserved, and harder opposition above the entry room. No cash gifts, starting-grant changes, rake changes, slot-price changes, or poker-profile changes were made.

## What changed

**BUG-253:** on a new House seating at the entry stake (big blind 20), two thirds of draws prefer existing calling-station regular TiltedTed; the other third uses the existing complementary selection. Higher stakes and callers without a casino stake keep the original selection. All six identities, strategies and profiles remain intact. The exclusion rule still prevents two copies of the same regular at one table. Fresh sessions, short-table refills and the delayed House fallback all pass the actual table stakes into the selector.

This is a probability per seating, not a guaranteed sequence or a fraction of hands. Replacements are included in the measurement below. An already occupied table is not rewritten. Other owners can still be the opponents; this benchmark measures heads-up play against the House.

**BUG-254:** the strict harness exposed a pre-existing blind all-in deadlock. With a 4-chip small blind against a covered 20-chip big blind, `Game.startHand()` left the all-in small blind as the actor. The engine now closes a betting street when only one player can act and that player already covers the current bet. The existing refund/runout path returns the uncalled excess and resolves the hand. A live player who still owes chips keeps the call/fold decision; multiway betting remains open when two live stacks remain.

## Measured poker results

All primary rows use the real engine, `Table` policy briefing, raise discipline/counters, accepted-action log, House profiles and per-pot rake. The model API is never called. The profile is the game's default balanced numeric policy: tightness 55, aggression 60, bluff frequency 25, discipline 65. It is held neutral and rested, without model memory, drinks, fatigue or growth.

Each row contains 150 independent sessions, capped at 100 hands, with three seed groups of 50 sessions. A busted House regular is replaced; a busted starter ends the session. Decks, Monte Carlo equity draws and policy dice are seeded. Equity uses **120 iterations**, compared with the product default of 800. Standard errors cluster at the session level, rather than treating all hands inside one stack as independent.

| House at entry stakes | Hands | Net bb/100 | Rake bb/100 | Standard error | Approximate 95% interval | Starter busts / sessions |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Original complementary selection: Doyle_v3 for this profile | 9,818 | -73.27 | 6.80 | 12.59 | -97.95 to -48.59 | 96 / 150 |
| TiltedTed only — counterfactual | 14,886 | +39.96 | 3.57 | 4.68 | +30.79 to +49.12 | 4 / 150 |
| Entry mix retained in the repair | 13,317 | **+14.43** | 4.23 | 7.24 | +0.24 to +28.63 | 31 / 150 |

The retained mix had 92 winning sessions. Its three seed groups returned **-4.91, +23.12 and +24.06 bb/100**; a losing run remains possible. Its measured gross return before its own rake was +18.67 bb/100. The original row's corresponding gross return was -66.47: lowering rake alone would not repair this particular matchup.

Actual exposure in the retained mix:

| Regular | First seats | All seatings, including refills | Hands opposite starter |
| --- | ---: | ---: | ---: |
| TiltedTed | 106 / 150 | 131 / 188 | 10,596 / 13,317 (79.57%) |
| Doyle_v3 | 44 / 150 | 57 / 188 | 2,721 / 13,317 (20.43%) |

Longer survival against Ted increases his share of hands relative to his seating probability. The result is measured from the actual mixed selector, not obtained by averaging the two opponent-only rates.

The preliminary 20-iteration screen is not the final calibration: it measured the original opponent at -30.70 rather than -73.27 bb/100. This sensitivity is why the 120-iteration confirmation controls the decision. The mixed screen was +14.88, close to the confirmation, but that agreement does not remove model or sampling uncertainty. The confidence interval only describes the sampled policy model; it does not include approximation error from using 120 instead of 800 equity iterations.

## Bankroll and slot projections

These are **resampled-session scenarios**, not additional played hands or predicted calendar days. Each simulated household starts with the actual 10,000-chip first-owner grant, split 8,000 safe / 2,000 pocket. The real wallet transfer functions perform buy-ins, gross cash-out, rake and auto-refill. The bank is the counterparty; safe + pocket + bank is asserted to remain 10,000 at every settlement. No replacement grant is issued.

The base scenario explicitly chooses entry stakes at every new deploy, rests between sessions, buys no food, creates no additional agents, and stops after 100 sessions or when the combined safe and pocket cannot fund a 2,000-chip seat. It resamples the 120-iteration session observations above for 1,000 households:

| Opponents | Can still fund an entry seat | Mean remaining safe + pocket | Unlock second slot | Unlock third slot |
| --- | ---: | ---: | ---: | ---: |
| Original selection | 0 / 1,000 | 960 chips | 95 / 1,000 | 0 / 1,000 |
| Ted only | 1,000 / 1,000 | 90,024 chips | 1,000 / 1,000 | 1,000 / 1,000 |
| Retained mix | 866 / 1,000 | 33,570 chips | 937 / 1,000 | 870 / 1,000 |

For the retained mix, the median second-slot unlock among households reaching it was session 13; third slot, session 61. No household unlocked the fourth within this horizon. These are **unlocks**, not newly created or funded companions. The result is conditional on this empirical session sample and the stated owner behavior, so the projected survival percentage is not a population guarantee.

Slots use the actual lifetime positive-session earnings thresholds **10,000 / 50,000 / 250,000**. They do not spend the safe balance, and losing sessions do not subtract from that counter. This corrects the earlier report's reconstructed arc, which purchased chairs at different prices and used an invented three-buy-in promotion buffer.

A separate, deliberately demanding scenario requests the highest affordable rung on **every new deploy**. At the cheaper 20-iteration screening precision, only 6 / 1,000 households remained fundable after at most 100 sessions; 895 / 215 / 5 unlocked slots two / three / four, and 575 reached the highest rung. This scenario has no learning or model-assisted improvement and retains the harder upper-room House. It demonstrates that starter tuning is not proof of a healthy full progression arc.

That scenario is **not automatic promotion during play**. `agentProfiles.js` `stakesForRequest()` honors an explicit rung; only a deploy without one defaults to the highest affordable rung. The room-door path in `place.js` uses that default, while the running table keeps its blinds. Owners can choose a lower rung. Do not present the stress scenario as what every household must experience.

## Reproduction and evidence

Run from the repository root with `ANTHROPIC_API_KEY` unset. The script rejects a key, creates its own scratch cwd, and makes no model calls or production-data writes. Output is JSON; progress goes to stderr.

```text
node scripts/simulate-house-economy.js --rungs 0 --sessions 50 --seeds 3 --iterations 120 --seed 20260919
node scripts/simulate-house-economy.js --rungs 0 --sessions 50 --seeds 3 --iterations 120 --seed 20260919 --opponent doyle_v3
node scripts/simulate-house-economy.js --rungs 0 --sessions 50 --seeds 3 --iterations 120 --seed 20260919 --opponent tilted_ted
node scripts/simulate-house-economy.js --sessions 50 --seeds 3 --iterations 20 --seed 20260919
```

The original production-selection row was captured before the entry mix was added. For this balanced heads-up profile it selected Doyle from the first hand and on every refill; the explicit Doyle counterfactual above preserves that original opposition on the repaired branch. Outputs record their loaded source hashes. The machine-readable summary accompanying this report preserves configs, seed-group results, bankroll projections and hashes; complete per-session artifacts are in `artifacts/recovery-audit/economy-{current,station,mixed}-entry.json` and `economy-mixed-screen.json`.

The existing required sweep was also rerun, in scratch with `EQUITY_ITERATIONS=120`, using `node scripts/simulate-economy.js --sweep --hands 400 --seeds 3 --progress --json`. Its six rake settings and three seeds completed. This legacy script starts with a synthetic balanced opponent, leaves policy/equity randomness unseeded and omits the accepted-action/raise-counter path. Its noisy drift is therefore not the tuning basis. Rake remains **1% capped at 3 big blinds**, including its existing whole-chip rounding and casino-only scope.

Validation captured before integration gates:

- BUG-254 regressions: two failures before the engine fix; all five pass after it. The complete engine test command passed 24 runner tests, including the existing engine suite.
- Rake, wallet-settlement and benchmark invariants: 25 tests pass.
- BUG-253 selection tests: three failures before the selection/caller changes; all four pass after. With existing matchmaking and benchmark tests, 22 pass.
- Focused table seating, loneliness, casino startup, raise discipline, House dialogue and economy integration: 46 runner tests pass, including the existing seating suite.
- Every measured hand asserts chip conservation after rake. Every resampled wallet settlement asserts bank/safe/pocket conservation. Invalid policy actions abort the benchmark; they are never silently replaced or discarded.

The final server, client and browser gates are recorded in the recovery audit, not inferred from these focused runs.
