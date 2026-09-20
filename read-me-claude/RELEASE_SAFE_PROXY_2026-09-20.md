# Release gate follow-up: native Safe request forwarding

PR #10 merged as `8586f3b` on 20 September 2026 at 13:18 UTC. Its complete
PR gate passed, including 216 integrated browser checks. The main workflow
`35513098607` then passed server, end-to-end, client, built smoke and phone
layout checks, but its integrated run had 215 passes and one failure:
`pocket-transfers.spec.js`, the desktop committed-hand transfer journey.

The exception was `route.fulfill: Route is already handled!` in the test's
native HTTP proxy. Deployment was skipped. Production remains on PR #9's
`b20d21d` until a subsequent main deployment and public checks succeed.

The downloaded CI artifacts show the journey reached the final funding form;
they contain screenshots and an error context, but no request trace. Do not
claim that those artifacts alone identify the racing request. Independent
inspection of the installed Playwright 1.63.0 implementation found a teardown
race: `unrouteAll({ behavior: 'wait' })` clears client routing before waiting,
so one completed callback can remove native interception while another still
awaits `route.fetch()`. That request can be continued before its callback calls
`fulfill()`.

Follow-up work uses `codex/safe-proxy-lifecycle` from the merged main revision.
Controlled outstanding native responses reproduced the exact failure and the
slower request escaping to the origin. The same proof passes with direct
continuation. A shared `forwardNative` helper now sends eight unmodified native
response forwarders across seven specs through `route.continue({ url })`. This keeps
the browser responsible for response completion and removes the test-only
fetch/fulfill round trip. Preserve all signed routes, SQLite writes, injected
first-transfer refusal, balance checks and committed-hand assertions. Do not
ignore route errors, weaken assertions, add retries or raise deadlines.

The final review PR records the reproduction, corrected native and integrated
gates, exact merge, deployment and public verification receipts. A test-only
fix still goes through the normal review branch and main deployment gates.

Evidence from the failed main run is under
`artifacts/all-in-safe-repair/main-first-ci.log` and
`artifacts/all-in-safe-repair/main-failure/`.

The permanent BUG-286 case invokes the same shared helper as the real money
fixtures. Its old implementation failed with the exact exception in 403 ms;
the corrected six-case proxy/money selection passed both planned runs (12/12),
with no retries masking a failure. Logs are `proxy-regression-red.log` and
`proxy-pocket-green.log`; standalone proof logs and traces use `proxy-*` in
the same artifact directory. The full 217-case integrated gate passed in
9.8 minutes using the exact 16-spec CI selection; its log and captures are
under `final-proxy-integrated/`. Independent final review found no issues.
The product source and build are unchanged from the already-passed PR #10
gates. The follow-up still requires its normal PR and main CI runs before
deployment; record those results and public checks in the review PR.
