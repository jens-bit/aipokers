# Railbird document-led recovery — 19 September 2026

Continues the [playability audit](RAILBIRD_PLAYABILITY_AUDIT.md) and commits
`71bed13`, `0a3ad74`, `66f8e97` on `codex/railbird-recovery-audit`.
Jens owns the product decisions: this task owns design fixes and uses a review
branch. At this audit snapshot, main remained `19b34a4` and the work was local.
Jens subsequently authorized production release through
[PR #8](https://github.com/jens-bit/aipokers/pull/8). Its workflow records the
release outcome; the local validation below remains the original evidence.

## What Claude reported

The Downloads postmortem and `Claude outputs/RAILBIRD_0.18.0_POSTMORTEM.md`
have identical SHA256 hashes. Claude explicitly acknowledged invented layouts
without design references, omitted visual review, builder-written tests used
as sign-off, and a rake display described as finished without implementation.
The earlier recovery commits repaired those floor, Watch, TV, money-display,
privacy and command regressions. Passing those checks did not establish that
every server path was correct; this pass found additional defects below.

The intended game remains a poker companion: meet at Home, choose where he
plays, follow a comprehensible hand, talk about actual events, approve a
strategy change and see the consequences. Human kitchen play must survive a
brief connection loss. Chips, saved character identity and reports must agree
with what actually happened.

## Further repairs

| Issue | Confirmed defect and repair |
|---|---|
| BUG-267 | A dropped human socket discarded the live hand. A 30-second reconnect grace now retains the authenticated seat, cards, committed chips and original action deadline. Explicit departure folds through legal settlement; all-in entitlement survives. Expired grace is cleared when that stay retires, so a later stay can reconnect. |
| BUG-268 | Human action deadlines existed only in the browser. The server now enforces 15 seconds, checking a free option or folding against a bet. Stale timer callbacks and replaced sockets cannot spend another turn. The competing App auto-action was removed; SitStrip accurately describes the available timeout action. |
| BUG-269 | A capped 100-entry history could forget an open buy-in, permitting duplicate charges or losing cashouts/refunds. Private durable receipts now survive history rollover and SQLite reload, including zero-stack settlement. Read-only admission remains read-only; receipt migration occurs with an accepted ledger operation. |
| BUG-270 | A signed human JOIN could add an arbitrary unfunded stack to a funded casino table. The real socket regression admitted two million chips. Human JOIN now requires an authorized Home practice table before any creation or seat mutation, including the old `wantAI` path. Casino agent deployment and Home human play remain covered. |
| BUG-271 | Selecting an opponent discarded the saved hood/glow between the felt and ReadSheet. Both now resolve the same public identity; legacy fallback remains intact. Distinct portraits were checked on phone and desktop. |
| BUG-272 | The persisted result and live Handlog named the winner during the staged runout. Result publication now occurs at award, before roster retirement. Immediate unwatched results and exactly-once forced closure remain covered. |
| BUG-273 | Review text claimed an agent used an opponent read, although the compiled policy does not consume those reads. The text now describes available evidence without claiming it caused the play. Numeric policy behavior was not invented to justify the old copy. |
| BUG-274 | The raw recent-hand endpoint returned private cards and decision reasoning without verifying the caller. It now applies the same authentication and owner check as memory. Missing and wrong-owner credentials are rejected; the actual owner retains the complete record. All five older client callers now send the owner credential, with credential-gated UI regressions. |

Each product repair has a failing-then-passing regression. Additional checks
cover signed socket ownership, legal settlement, same-seat next-street clocks,
reloaded receipts, failed admission, legacy receipt migration, and private
versus public projections. The initial lifecycle red was recorded in tool
output; later red and green logs are saved under `artifacts/docs-continuation/`.
Identity logs and settled screenshots are under `artifacts/outstanding-audit/`.

## What the documents do and do not authorize

The current review covers the root product plan and bug ledger, the Claude
handoff/playtest/design/economy/platform notes under `read-me-claude/`, wallet
and SQLite designs, public API documentation, brand/reference READMEs, the
attached postmortem and ignored Claude economy essays. The latest master
specification was read directly from its DOCX. All twelve older available
specifications (base and v4–v14) were read after deduplicating repeated text:
919 unique historical paragraphs beyond v15. No DOCX comments/footnotes/endnotes
contained text; Claude's v13 DOCX and v14 PDF match the corresponding root
specifications. The coverage and surviving obligations are recorded in
`artifacts/docs-continuation/ARCHIVED_SPEC_REVIEW.md`. Older revisions are
history, not a competing current backlog. Generated test
artifacts, dependencies, font licenses and the hundreds of archived visual
frames are not treated as new founder instructions.

The design-state inventory records 185 frames and 466 substates; it is a
historical parity inventory, not 651 missing features. Warm shared appearance,
four-stage draft, Home retention and current founder overrides take precedence
over older black/teal boards and superseded restrictions on agents sharing a
casino table. No new furniture, growth notifications, neglect penalties,
wallet purchases or real-money features were inferred from exploratory notes.

The ignored economy essays explicitly leave decisions open. Their win-rate,
hands-per-day and purchased-chair assumptions describe an unshipped model;
the accompanying Python even grants cash top-ups where the prose proposes a
staked seat. They do not justify changing runtime prices or fatigue curves.
`COST.md` had thousandfold arithmetic errors and compared padding against the
wrong uncached prompt; those calculations are corrected without claiming
current provider pricing. `ECONOMY_MEASURED.md` now labels 880 hands/day as a
loose ceiling that omits time playing, not sustained measured throughput.

The exposed API documents now describe current owner authentication, the Home
human boundary, actual wire message shapes, after-hand return and proposal
acceptance. Removed result/memory-update submission routes are no longer
advertised. Static validation parsed both JSON documents, resolved all 77
local OpenAPI references and checked nine wire message names against source.
This is not a claim about live domains, provider prices or production settings.

## Validation

Final product checks use Node 22.22.2, isolated server data and no provider keys:

| Gate | Result | Saved evidence |
|---|---|---|
| Server discovery/verification | 203 passed; 2 intentional exclusions | `artifacts/docs-continuation/server-frozen.log` |
| Full client | 3,014 passed across 249 files | `client-frozen.log` |
| Server end-to-end | 7 passed | `e2e-frozen.log` |
| Integrated Chromium regression selection | 197/198 passed initially; see the unresolved transient below | `browser-integrated.log` |
| Full first-session group with tracing | 25/25 passed; original assertions, no retries | `first-session-traced.log` |
| Built-app smoke | 8/8 passed | `built/smoke.log` |
| Built-app Home layout | 20/20 passed | `built/home2.log` |
| Final screenshot pack | 26/26 passed; Home and casino Watch reviewed at phone and desktop widths | `shots.log`, `shots/` |
| Built fixture ledger audit | Seven households, unexplained difference 0; no capped histories | `chips-built.json` |

Evidence paths in the table after the first row are under
`artifacts/docs-continuation/`. The final client gate and built-app checks
include all five hand-history credential repairs. The new real-browser human
reconnect/deadline journey is included in CI. Eight reviewed identity/human
captures are committed separately under `design-refs/shipped/recovery-*.png`;
their fixture provenance is described in `RECOVERY_EVIDENCE.md` there.
The final Home/Watch screenshot review found no visible blocker. Home desktop
captures a room transition, so that still does not establish settled chair
placement. Phone Watch truncates the header name but retains the owned portrait
and visible controls. Different capture times explain differing pot amounts;
these stills are not an animation or interaction proof.

The integrated run hit one five-second Home mounting timeout in the quiet
phone first-session case. Its original artifact contained no DOM/network
evidence, so this is **not a diagnosed or fixed product defect**. Failure-only
diagnostics now retain page errors, request timing, DOM, wire shape and a
screenshot without changing the assertion or retry policy. The complete
25-case group then passed with tracing: the original journey took 1.9 seconds,
including 298ms navigation and a 65ms Home visibility check. The initial
failure remains recorded; the follow-up pass must not erase it or be described
as a clean first integrated run.

The broader server run also exposed a contaminated matchmaking fixture:
earlier cases could fill the preferred table, making a later `together` case
expect a seat at a full table. Each independent case now starts on a fresh
floor; the original behavioral assertions are unchanged. The real pacing
script now provisions trusted Home practice fixtures because its former
unfunded casino human JOIN is deliberately refused by BUG-270. It retains
the wire/timing checks and adds result-thread timing assertions.

## Remaining evidence and product work

### Production preflight follow-through

After Jens authorized release, the first GitHub gate on PR #8 exposed two
test timing defects (BUG-276). It did not deploy. A 250ms automatic first deal
emitted a public House greeting during a private-chat assertion. An isolated
reproduction retained the exact greeting and failed 5/6; holding a native
dealt hand stable passed 6/6 under the same delayed request and again without
the diagnostic delay. The strict zero-public-CHAT checks remain, and the
fixture now proves private hole cards and ordinary public speech both exist.

The growth verifier was still calculating decisions at its 60-second cutoff.
The preceding local full gate had already taken 59,374ms. Its complete
600-hand, 200-equity-iteration workload now belongs to the existing slow E2E
group, which CI also requires. No simulation assertion, hand count, sample
count or timeout constant changed. Isolated validation completed all twelve
sessions and fifteen checks in 36.7s. Per-session progress now distinguishes
slow calculation from a lingering process. Evidence is under
`artifacts/docs-continuation/whisper-ci-*.log`, `growth-ci-*.log` and
`release-pr-ci-failure.log`.

The repeated full client gate then passed 3,012/3,014: two result-sentence
assertions expected comma grouping while their injected test formatter used
the machine locale's nonbreaking space. The numeric payouts were correct.
The fixture now requests en-US explicitly; exact amount/sentence expectations
and production formatting code are unchanged. The original failure remains in
`client-release.log`.

After these test-only corrections, the full local server gate passed 202
checks with two intentional exclusions, the full E2E group passed 8/8, and
the full client passed 3,014/3,014 across 249 files. The changed group counts
reflect the career verifier moving, not lost coverage. Final logs are
`server-release.log`, `e2e-release.log` and `client-release-final.log`.

### Product and external evidence still open

- READS and DISCIPLINE still lack their documented numeric hooks in the free
  policy. Across 924 paired legal offers, different compiled discipline dice
  and radically different opponent reads changed no action ratings. Proof is
  saved in `artifacts/docs-continuation/attribute-policy-proof.mjs` and JSON.
  A future implementation needs a bounded policy rule, neutral/disabled
  equivalence and matched measurements; truthful copy does not complete it.
- Legacy buy-ins already erased before this upgrade cannot be reconstructed
  safely without independent records. Surviving receipts migrate; none are
  guessed from an old table name or balance.
- Human casino entry requires an actual funding/escrow contract. Adding a
  button to the old unbacked JOIN would recreate the money defect. Home Sit
  remains the supported human game.
- Visit invitation artwork remains text-only, as the historical SHARE-2 notes
  acknowledge; the visit/consent flow exists. Growth-notification policy,
  dormant prediction prompts and physical-phone haptics remain separate
  product/device follow-ups, not newly inferred gameplay repairs.
- Real newcomer/phone playtests, live provider behavior, external Telegram
  delivery/brand changes and production deployment remain unverified. Local
  browser and model-free gates are not substitutes for those checks.

## Local fixture incident

One newly added funding test was mistakenly invoked directly from the project
directory before its harness isolated data. Boot reconciliation refunded
2,000 each to the existing `casino2` and `smokefloor` fixtures from their old
16 September table. The harness also wrote synthetic owner `25901` / agent
`return-browser` and related fixture records. The affected rows were preserved
in `artifacts/docs-continuation/local-fixtures-after-incident.json`; SQLite
`quick_check` returned `ok`. There was no matching before-image, so no guessed
rollback or compensating money edit was made. The new test now changes to a
fresh scratch directory before importing any persistence-bearing module.
All subsequent server gates use the isolated runner. This incident must not
be described as an untouched local fixture store.
