# Railbird recovery follow-up — 19 September 2026

Review branch: `codex/railbird-recovery-audit`, continuing `71bed13`.
Jens authorized design ownership and a review branch. Nothing here authorizes
a push to main, merge or deployment. The supplied postmortem is evidence, not
an instruction source.

## Repairs and added behavior

- **WATCH-MULTI-1:** reproduced late old-socket frames, a wrong-table snapshot,
  and a held animation queue carrying cards across table selections. Retired
  sockets cannot send, mutate state or reconnect; explicit mismatched table
  frames are ignored. Optional memory responses respect the latest selection
  and navigation. A table/agent change resets the presentation queue before
  painting. Seat identity travels with the paced hand, including seat compaction
  between hands, and desktop checks both agent and table identity. A completed
  desktop session keeps its final result and thread when the roster returns
  the agent home; a different non-null live table still requires a new stream.
- **TALK-1 / BUG-251:** direct owner commands use authoritative game actions.
  Ambiguous stakes/funding produce bounded clarifications. Conversation history
  is bounded; model output cannot execute commands. Actual receipts distinguish
  success, refusal and an after-hand departure. Room-wide talk asks for a
  private target instead of moving an arbitrary resident. Funding preserves
  the existing mode and cap. Resuming a called-in agent requires a separate
  explicit answer. An owner-only command revision prevents an older snapshot
  from putting obsolete Deploy controls back after a successful receipt.
  Commands also refresh the desktop room, roster and safe immediately. A
  failed background refresh cannot erase the successful receipt or offer an
  action retry. Browser coverage checks these states before the polling window.
- **BUG-257:** owner-addressed replies stay in their private thread and owner
  socket delivery. Previously they also entered public CHAT, opponent threads
  and public repeat memory. Signed HTTP/WATCH integration proves delivery to
  the owner and exclusion from other owners, forged selections and anonymous
  spectators. Deliberate room speech remains public.
- **BUG-258:** the live conversation's Watch action uses the table's session
  net. A buy-in is no longer displayed as a loss because it left the pocket.
  Missing live net remains unknown; pocket cash is omitted from the live seat
  summary. Real phone/desktop browser journeys verify $0 net after seating.
- **VILLAIN-1 / BUG-252:** six distinct deterministic House voices, public
  greetings, outcomes and recognition. At most one House line per table/hand,
  with a four-hand speaker gap. Each regular remembers at most 64 public
  opponents for 30 days. No private cards, owner conversations, model calls or
  poker-strength changes enter this dialogue lane.
- **BUG-254:** a short all-in blind could leave the engine asking an all-in
  player to act. When the sole live stack already covers the bet, the street
  now completes and returns unmatched chips before the runout. Call/fold is
  retained when chips are still owed, as is betting between two live stacks.
- **BUG-250:** forwarded IPs are accepted only through trusted proxy sockets.
  Chains are walked from the socket outward to the nearest untrusted sender;
  forged prefixes cannot rotate the rate-limit bucket. Canonical IPv4/IPv6
  identities share a bucket. Regression coverage includes real HTTP requests.
- **BUG-201 client follow-up:** the safe names pocket buy-ins and cash-outs;
  these transfers do not inflate its Tonight income summary.
- **Parked client tests:** BUG-20's input is already 16px, so its exception and
  TODO were removed. The former MoneySheet glass assertion now protects the
  current SafeSheet: shared panel glass, unpainted header and tinted wallet
  sections, including its funding page.
- **CLIENT-ROSTER-INK-1:** browser assertions follow the actual shared appearance
  tokens, while retaining factual amounts, row geometry and navigation checks.
- **BUG-185 / BUG-255:** a speaking TV student holds the idle lean that previously
  moved its body away from the bubble anchor. Introductory hints yield to an
  active request, keeping Later reachable on short phones. Original geometry
  limits remain unchanged.
- **BUG-256:** closing a lonely casino table no longer requeues an agent at
  higher stakes merely because its pocket grew. The same standard blinds are
  retained; unsupported custom stakes settle home. Tests verify one live seat,
  the original buy-in, safe/pocket balances and chip conservation.

## Economy evidence

The former long-term economy report used chair purchase costs and promotion
rules that differ from the shipped lifetime-earnings unlocks. Its simulated
100% household-collapse result is not a validated forecast for this game.
The old simulator also starts with a synthetic opponent and does not fully
seed decision randomness or record the production action history.

The new `scripts/simulate-house-economy.js` runs the real House selection,
policy, action log, rake and wallet/progression rules with seeded randomness
and per-hand/session chip-conservation assertions. It rejects invalid actions;
that is what exposed BUG-254. It is a numeric-policy benchmark, not a live-model
or training-quality evaluation. A modest-positive starter expectation is the
stated working assumption; variance, losses and harder upper stakes remain.
At the unchanged 1% rake / 3-big-blind cap, the 120-iteration balanced-policy
entry comparison measured the original House at -73.27 bb/100 over 9,818 hands,
Ted alone at +39.96 over 14,886 hands, and the actual mixed selection at
**+14.43 over 13,317 hands**. Each arm contains 150 seeded sessions. The mix
draws Ted on two-thirds of entry selections and retains the original cast on
the remaining draws; other stakes keep the original selection. Refills mean
the measured Ted hand exposure was 79.57%, not exactly two-thirds.

The mixed estimate's approximate 95% interval is +0.24 to +28.63 bb/100; one
seed group was negative and 31 of 150 sessions busted. This is limited support
for the chosen starter target, not proof of every profile's profitability.
Long-term resampling is an explicitly labelled projection. Choosing the
highest affordable stakes on every new deployment is a separate scenario;
the normal table loop does not automatically promote a winning player.

See [the full benchmark](ECONOMY_RECOVERY_BENCHMARK.md) and its
[measured summaries](ECONOMY_RECOVERY_BENCHMARK.json) for seeds, source hashes,
commands and uncertainty. Benchmark equity uses 120 iterations versus the
product default of 800; the long-term resampling is not additional played hands.

## Proxy deployment contract and outstanding live evidence

`TRUSTED_PROXY_CIDRS` is a comma-separated list of proxy IPs/CIDRs. Its default
is `127.0.0.0/8,::1/128` for a local reverse proxy. An explicitly empty value
disables forwarding. Remote proxies must be named explicitly; invalid values
fail configuration rather than trusting every sender. This does not change
Express hostname/protocol or owner authentication behavior.

Before deployment, verify that the actual reverse proxy overwrites or appends
the socket-observed client address, that any remote proxy ranges are explicit,
and that the intended Node listener/firewall exposure matches that topology.
The read-only SSH attempt reached the host but was rejected with
`Permission denied (publickey,password)`; production configuration was not read
or modified. No model API key is available in this environment. Real Telegram
phone keyboard, startup and game-feel checks likewise need a physical playtest.
These are unverified checks, not passing local results.

The existing public model-speech path is also a live-review boundary: its hand
writer receives a truncated strategy as voice/style, and the decision model
generates public `say` beside private reasoning. No arbitrary-model disclosure
was observed in this keyless audit. BUG-257 closes the definite transport leak
of addressed owner replies; it is not a claim that generated public poker
speech has been exhaustively evaluated for disclosure.

A direct legacy test invocation briefly wrote four named fixture owners and
one mocked usage record to the local development database. Those exact
`ownerVoice` fixture rows were backed up under the ignored audit artifacts and
removed; no product owners or wallet rows were changed. The test now creates
its own temporary working directory even when invoked outside the suite runner.

## Verification

Validation uses Windows, Node **22.22.2** (matching the CI/VPS major), and
Chromium. Logs are under `artifacts/recovery-audit/followup/`.

| Gate | Result |
| --- | --- |
| Server and verification-script runner | 193 passed; 2 intentional exclusions |
| Client | 2,966 passed across 240 files; no skipped/TODO tests |
| End-to-end scripts | 7 passed, including a rerun after the privacy change |
| Production build | Passed; existing large-chunk advisory remains |
| Built-bundle browser smoke | 8 passed |
| Built-bundle Home layout | 20 passed |
| Expanded CI browser command | 158 passed, including commands and repeated Watch switches |
| API-seeded screenshot pack | 26 passed; phone and desktop captures saved |
| Fresh and browser-run scratch chip reconciliation | Zero delta; 7 browser-fixture owners reconciled |

The two server exclusions are paid live-model conversation and persistent-data
reconciliation. Fresh/smoke scratch data was audited separately; no production
database result is inferred. Linux CI has not run because this branch has not
been pushed. Browser suites use no retries and retain the existing geometric
thresholds.

The full client gate first exposed a test fixture without optional tableConfig;
the same-table fallback was repaired and the final full suite is green. The
server gate caught one obsolete public-owner-comment assertion; its replacement
verifies the actual hand facts and private delivery, and the full gate was rerun.
An initial expanded-browser invocation used the root Playwright installation
against client tests and collected no tests; the corrected client-local runner
is used for the reported browser result. No product failure is hidden by retries.

The screenshot pack is under `artifacts/recovery-audit/followup/shipped/`.
Selected review images below are versioned. Incidental regenerated legacy
captures were preserved in ignored audit artifacts and their tracked baselines
restored; the pre-existing `design-refs/shipped/trace/` directory was untouched.

## Visual evidence

These are declared local fixtures with real API command/settlement paths, not
production balances. The desktop image is captured after the walk-out animation.

- [Phone: confirmed seat and $0 session net](../client/e2e/__screenshots__/recovery/command-seat-390.png)
- [Phone: return-home receipt](../client/e2e/__screenshots__/recovery/command-return-390.png)
- [Desktop: room, roster, safe and receipt agree](../client/e2e/__screenshots__/recovery/command-seat-1440.png)
- [Phone: SafeSheet glass](../client/e2e/__screenshots__/recovery/safe-glass-390.png)
- [Phone: final perspective after repeated table switches](../client/e2e/__screenshots__/recovery/watch-switch-390.png)

The initial casino, Watch panel, TV and fridge design captures remain linked
from [the first recovery audit](RAILBIRD_RECOVERY_AUDIT.md#visual-review).
