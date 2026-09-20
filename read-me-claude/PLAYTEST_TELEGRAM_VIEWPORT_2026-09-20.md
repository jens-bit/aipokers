# Safe GIVE after a Telegram window resize

This follows the all-in/Safe repair in PR #10 and its test-fixture correction
in PR #11, deployed and publicly verified at 14:46 UTC on 20 September.
It is a separate, reproducible condition found while investigating
the supplied narrow Telegram screenshot. It does not reproduce that image's
nearly collapsed sheet or establish that the original session missed an event.

## Reproduction

A signed scratch owner opens roster, Your wallet, GIVE and a character's fund
form at 384 × 844, then enters 137. Shrinking the browser to 590 pixels while
Telegram's viewport event is delayed leaves `--tg-h` at 844 pixels. The form's
footer remains at 844, and GIVE cannot receive a tap inside the visible window.
Updating the SDK value without its event and sending a browser resize also
leaves the old CSS height. Delivering `viewportChanged` immediately restores
the footer to 590 and preserves the entered amount. Notified 420-pixel keyboard
and restored 844-pixel viewports pass as well.

The existing tracker subscribes exclusively to Telegram when an SDK object
exists. It therefore misses independent browser/visual viewport changes in
that mode. Original measured evidence is under
`artifacts/all-in-safe-repair/safe-resize-*`.

## Follow-up

Work is on `codex/telegram-viewport-recovery`, based on main `554e2f5`.
BUG-287 covers this conditional offscreen-footer problem. The tracker now
listens to SDK, window and visual-viewport resize events. Positive finite SDK
and normal-scale visual measurements are capped by the real window height;
the last normal-scale visual bound is retained during pinch zoom to preserve
an already-open keyboard. Cleanup removes every listener from its original
target. A stale smaller measurement can temporarily keep the layout compact
until that source catches up, rather than place controls outside the window.

Failure-first evidence: six unit cases failed on the old tracker, and the native
Safe journey measured a footer bottom of 844 in the 590-pixel window. Focused
verification passed 22 Telegram unit cases plus the existing App keyboard
case, all seven native pocket/Safe journeys, and the strengthened typing case
at 420 pixels. The native journey retains 137, checks Back without payment,
then verifies one signed 137-chip transfer with the committed game and buy-in
unchanged. Independent review and inspected short-window captures are clear.

Production build, eight built-bundle smoke cases, 20 phone-layout cases and
34 engine smoke checks passed. The build emits `index-Babgu0Q9.js` and unchanged
`index-BFJj5vbS.css`. The smoke server and scratch data were removed afterward.
New evidence is under `artifacts/telegram-viewport-recovery/`. The full exact
16-spec integrated browser gate passed all 218 cases in 10.2 minutes. Current
Safe captures were inspected at 590, 420, 844 and desktop heights. The owned
server was stopped and only its 20 generated tracked captures were preserved
and restored; unrelated existing traces were left untouched.

The first full client run overlapped both browser gates: 3,111 cases passed,
one App navigation case exceeded its existing five-second deadline, and the
following navigation case failed to find the expected screen. Preserve that
failure in `client-concurrent.log`; do not call the run green. With the browser
workloads stopped, the unchanged App file passed all 32 cases: the affected
cases took 2.8 and 3.9 seconds instead of 5.2 and 9.3. No assertions, deadlines
or retries changed. The complete serial client gate then passed all 3,113
tests across 257 files in 355.52 seconds (`client-serial.log`); those same
navigation cases passed in 2.9 and 4.2 seconds. The source stayed unchanged
through the isolated diagnostic and the full serial gate.

Review-branch CI, main deployment and public receipts will be recorded in the
release PR. The original collapsed-sheet
screenshot and historical table/stack report remain separately unverified.
