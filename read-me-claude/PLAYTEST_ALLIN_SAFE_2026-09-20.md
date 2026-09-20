# Follow-up: all-in instructions and Safe GIVE

Jens reported that a character drafted to "go all in each hand" still makes
ordinary poker decisions, and that Safe → GIVE leaves its menu unreachable.
PR #9 was already deployed as `b20d21d` before this follow-up. Work continues
on `codex/all-in-safe-repair`, through the normal review and production gates.

## Reproduced causes and repair

- **BUG-283:** the earlier BUG-223 repair understood the words but only proved
  aggression/tightness and strategy prose. Free automatic play read the numeric
  profile, and its sizes remained ordinary bets. Model generation could also
  replace the explicit brief, and guest draft summaries lost it entirely.
  Preserve bounded original play turns (excluding names), canonicalize an
  affirmative unconditional instruction, and compile it into the same legal
  action across Home, casino, router-off and model fallback paths. Native table
  tests play successive hands and verify chip conservation and seat isolation.
- Interpret only explicit unconditional instructions. A name such as "Goes All
  In", high aggression, questions, opponent descriptions, quoted examples and
  conditional/negative instructions do not make a character shove every hand.
  Later explicit restrictions revoke earlier instructions; later affirmative
  instructions can re-enable them. Strategy replacement applies at the next
  seating, following the existing snapshot contract. Existing explicit saved
  strategies, including the old BUG-223 fallback, work without recreating him.
  If a past draft already lost the owner's words, do not invent those words or
  silently overwrite a later edit; this repair does not guess from a name.
- **BUG-284:** the desktop Home Safe's funding page has absolutely positioned
  children and its rail parent does not supply the height implied by `flex: 1`.
  Its height collapses to zero. Explicit available height repairs that host;
  input, Back and confirmation remain reachable with the body scrolling.
  The reported phone image was not reproduced on fresh current-source or
  shipped-bundle runs at 390×590 and 390×844, including a populated ledger.
  Reload/session clarification is pending. Keep that distinction explicit.
- **BUG-285:** while checking legal all-in actions, a native engine regression
  found short all-ins incorrectly reopening prior actors' raises. Both the
  legal offer and submitted action now enforce raise rights. Cumulative short
  raises count toward a full increment since that player's own last action;
  an unacted player keeps the option. This follows the
  [Poker TDA reopening rule](https://www.pokertda.com/view-poker-tda-rules/).
  When a raise is closed, the all-in plan must call the legal amount or check.

## Evidence

Failure-first logs are under `artifacts/all-in-safe/` for draft preservation
and correction order, and `artifacts/all-in-safe-repair/` for policy, real
tables, Safe geometry and raise rights. Server tests use isolated scratch
databases and stripped provider keys; provider-generation fixtures never call
a real model. Browser tests use native scratch APIs and check actual hit targets
and exact safe/pocket changes without altering committed chips or a live hand.

Focused checks precede the complete server/client/end-to-end, built smoke,
phone layout and integrated browser gate. No retries, default deadlines or
assertions are relaxed. The final PR records exact gate counts, merge and
production verification; a pushed branch alone is not a deployed repair.

Final local gate on Node 22.22.2: server harness 213 passed / 2 intentional
exclusions, client 3,105 passed across 257 files, end-to-end 8 passed,
production-bundle browser smoke 8 passed, HOME-2 layout 20 passed and engine
smoke 34 checks passed. The full 16-spec integrated browser selection passed
216/216 in 10.4 minutes with the existing worker, deadline and retry settings.
The production build emits `index-GKlXy-od.js` and `index-BFJj5vbS.css`.
Receipts are `artifacts/all-in-safe-repair/{server-final,client-final,e2e-final}.log`
and `artifacts/all-in-safe-repair/built-final/gate-results.json`; integrated
results and reviewed captures are under `artifacts/all-in-safe-repair/final-integrated/`.
