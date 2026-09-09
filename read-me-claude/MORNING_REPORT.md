# Railbird — release handoff, 9 September 2026

Jens's morning playtest exposed substantial remaining defects in continuous play. The earlier release-readiness assessment was too broad: individual screen checks missed accounting, repeated speech, shared room occupancy and confusing player flows. The active plan is now [MORNING_PLAYTEST_QUEUE.md](MORNING_PLAYTEST_QUEUE.md). The implementation notes below describe earlier changes, not a claim that the app is ready to share.

Batch42 repairs the reproducible draft/retire money exploit and legacy reload accounting. Focused HTTP/SQLite regressions pass; full server/client checks and seven gameplay e2e checks pass with explicit safe funding in established-owner fixtures. A real phone draft/retire/redraft journey is being added before integration. Nothing in batch42 is deployed yet.

## What you should notice

- Home and casino use contextual navigation and the available phone shell. The kitchen table remains, actual table taps work, and a pending want has one answer surface. Home bodies use their saved appearance, walk out/return, and retain their real routines. Carry now has the three designed held reactions, five destination labels, safe edge bounds and refusal before lifting during a known active hand.
- The companion, private conversation, profile, roster, fridge, safe, TV and replay routes are connected. Agents visiting a friend now show actual live-table details and a working Watch destination, with private Home updates. Retirement archives the record through the correct endpoint. Casino pinch enlarges the same felt, and a second pinch opens Watch.
- Your full-screen phone Watch composition is preserved. Opponent read taps work, owned cards remain above read glass, stale cost notes clear correctly, hidden cards stay private, expression/brow holds are independent, celebrations and gesture-unlocked audio play, and mute is reachable.
- First-agent entry uses four forming stages, no collar, and persistent hood/glow. Empty/quiet/history states explain the next action without inventing results. Desktop retains the room, roster and conversation with working Watch/Sit/action/return at 1280, 1440 and 1920.
- Railbird assets, header motion, locally served design fonts and portrait/wide share cards are prepared. The welcome page now uses ten refreshed actual product renders. Bot entry and notification buttons use configured destinations instead of the old hard-coded bot.

## Look at the result

[Current phone Home, casino and Watch](../client/e2e/shots/railbird-release-phone.png) · [Current desktop Home, casino, Watch and Sit](../client/e2e/shots/railbird-release-desktop.png).

These are the actual app with controlled example accounts, not production screenshots. [DESIGN_GAP.md](DESIGN_GAP.md) maps the references, verified states and deliberate differences; [OVERNIGHT_DESIGN_WORK.md](OVERNIGHT_DESIGN_WORK.md) records each batch, failed checks and corrections. The supplied archive was used as reference and was not edited.

## Verification

Batch41 final branch gate passed108 server /2250 client /seven e2e,86 browser cases including all53 desktop, build, seven fresh built smoke journeys and20 Home2 checks. Two intentional live server skips and two existing client todos remain. Three carry comparison sheets were inspected; source checks ran again after the last refusal-bubble adjustment. Post-merge verification on Node24 hit the existing native-process crash in guestLimits (BUG-94/34). A separate full run using a checksum-verified temporary Node22.22.2, matching the documented VPS version and CI major, passed108 server/2250 client/seven e2e. The original Node24 failure remains recorded and unresolved; no system runtime or dependency was changed.

GitHub now contains the earlier work through3958991. Its [Deploy to VPS run](https://github.com/jens-bit/aipokers/actions/runs/34390530302) has successful Tests, Browser smoke, and Deploy & health-check jobs. This is verified workflow status, not a phone account playtest. Batch41 is a new local change; no push was made by Codex.

The controlled sprite audit covers 101 native-size cases, all matching the reference pixels. This does not assert every possible character, game state or viewport is identical. Earlier unexplained Windows/test/capture intermittency stays in BUGS.md; later passing runs are not a diagnosis.

## What remains outside local implementation

1. Push and wait for the deploy for that exact commit to go green, then reopen the Mini App. A push alone does not prove the new bundle is live.
2. Confirm the intended Telegram app destination/account artwork and guest rollout. Last public config inspected had guest=false and botUsername=agenticpoker_bot. These settings were not changed. MINI_APP_URL takes precedence over TELEGRAM_BOT_USERNAME; a username-only launch requires the bot's Main Mini App to be configured. [Telegram's launch documentation](https://core.telegram.org/bots/webapps#launching-the-main-mini-app). Invalid/missing destination configuration now yields no false old-bot button.
3. Play one real phone session: Home table, one want, whisper, casino Watch and return; then draft from a fresh account. This validates production authentication, real model behavior and latency, Telegram keyboard/viewport behavior and personal visual/audio preference. Those cannot be certified by local fixtures.

Rare birth tiers and coordinated future flat-day choreography remain explicitly deferred in the spec. Undesigned visit/referral/share variants are not labelled design-complete. The standalone growth notification from the old board is absent from the later v14 shipped ladder; the policy difference is recorded. No 3D redesign was added.

## Push from PowerShell

After the final message confirms main's gate passed:

~~~powershell
Set-Location C:\Projects\ai-poker
git push origin main
~~~

This follows HOW_WE_WORK: the integrator prepares main and Jens pushes. No push, production database mutation, paid model call, external share/notification or Claude/Opus review is claimed.

My assessment: your diagnosis was right. The gameplay presentation gave a clearer sense of place and action than the surrounding screens. The bottleneck was the implementation and its visual verification, not a need to add 3D. You had enough product direction to identify that gap; the process needed a reliable way to distinguish imported design, implemented code, inspected screens and deployed behavior. The current inventory and saved pairs make those distinctions reviewable.

Automatic approval review rejected npm audit because it sends dependency metadata to npm. The separate approval question is still unanswered, so that audit has not run; installs used --no-audit.
