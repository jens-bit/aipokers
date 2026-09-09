# Railbird — release handoff, 9 September 2026

The main design and interaction repairs are implemented locally. This is ready for Jens's release playtest after the final integration gate and push; it is not a claim that production is already updated or every historical illustration is pixel-identical.

## What you should notice

- Home and casino use contextual navigation and the available phone shell. The kitchen table remains, actual table taps work, and a pending want has one answer surface. Home bodies use their saved appearance, walk out/return, and retain their real routines.
- The companion, private conversation, profile, roster, fridge, safe, TV and replay routes are connected. Agents visiting a friend now show actual live-table details and a working Watch destination, with private Home updates. Retirement archives the record through the correct endpoint. Casino pinch enlarges the same felt, and a second pinch opens Watch.
- Your full-screen phone Watch composition is preserved. Opponent read taps work, hidden cards stay private, expression/brow holds are independent, celebrations and gesture-unlocked audio play, and mute is reachable.
- First-agent entry uses four forming stages, no collar, and persistent hood/glow. Empty/quiet/history states explain the next action without inventing results. Desktop retains the room, roster and conversation with working Watch/Sit/action/return at 1280, 1440 and 1920.
- Railbird assets, header motion, locally served design fonts and portrait/wide share cards are prepared. The welcome page now uses ten refreshed actual product renders. Bot entry and notification buttons use configured destinations instead of the old hard-coded bot.

## Look at the result

[Current phone Home, casino and Watch](../client/e2e/shots/railbird-release-phone.png) · [Current desktop Home, casino, Watch and Sit](../client/e2e/shots/railbird-release-desktop.png).

These are the actual app with controlled example accounts, not production screenshots. [DESIGN_GAP.md](DESIGN_GAP.md) maps the references, verified states and deliberate differences; [OVERNIGHT_DESIGN_WORK.md](OVERNIGHT_DESIGN_WORK.md) records each batch, failed checks and corrections. The supplied archive was used as reference and was not edited.

## Verification

Batch39 final branch checks pass 108 server / 2242 client / seven e2e. Batch38 main integration passed 108 / 2241 / seven; batch39 main integration follows and its outcome is stated in the final handoff message. There are two intentional live server skips and two existing client todos. Batch38 passed the 66-case entry/draft/desktop browser run, build, seven fresh built smoke journeys and 20 Home2 checks. Batch39 passes all 55 desktop/visitor/BUG-55 browser checks; its final built-server results are recorded in the work log. The final bot-link repair uses fake bots and a scratch database; no real notification was sent.

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
