# Railbird — progress and handoff, 9 September 2026

Thirty-six implementation batches are prepared. The full design/spec goal remains active. This is a tested local milestone, not final friends-shareable sign-off or a deployment claim.

Home and casino use the available phone space and contextual navigation. The kitchen table/home games remain, wants have one answer surface, and table taps work. The companion, conversation, compact profile, roster, absence, fridge and TV use actual data. Desktop has the wider room, permanent companion column and fitted Watch/Sit with working actions and return routes.

First-agent entry uses four forming stages, no collar, and persistent hood/glow. Batch29 carries that identity through server table messages, casino normalization, floor/preview/deployment and both Watch renderers. Batch30 aligns the phone Board with N3: separate Live now and Tonight above the room doors. The welcome page uses the real entry/room and product captures; Railbird mark/icons/loading assets are prepared.

Home departures and returns now move through the doorway instead of unmounting in place. Returning agents show their actual session result briefly, and receive cards when seated.

Audio now plays after a user gesture, with original C8 swell/reports/knock timing and reachable phone/desktop mute controls. A listening preview is [c8-original-preview.wav](../client/e2e/sounds/c8-original-preview.wav).

## Latest verification

Batch36: 107 server checks, 2236 client checks and seven end-to-end scripts passed; two intentional server live skips and two existing client todos remain. The broad browser run passed 45 and exposed two resize failures; the correction passed all eight focused resize/retire/pinch cases, covering every selected case. Reference pairs for retirement and the casino zoom were inspected. Main35 post-integration passed; main36 integration follows.

Retirement now finishes the hand and keeps the record through the correct server endpoint. The casino has its authored two-stage pinch camera; ordinary taps still open Watch. A fresh account no longer claims one session of history.

The app now serves its original design fonts locally. The first smoke exposed an external Playfair request failure; the new blocked-Google tests and fresh built smoke pass. The original Chrome error's cause remains unproven.

No Claude/Opus review, real notification, paid model call, account update or production change is claimed. The documented overnight execution interruption remains in the work log; the paused heartbeat has not been restarted. BUGS.md retains unexplained earlier Windows/test/capture intermittency rather than claiming later passes prove their cause.

## Work still required

[DESIGN_GAP.md](DESIGN_GAP.md) is now the current frame-by-frame inventory; [DESIGN_GAP_HISTORY.md](DESIGN_GAP_HISTORY.md) preserves the earlier audit and batch notes.

1. S1/S2 are now implemented: portrait/wide formats, Railbird branding, saved appearance and truthful net/pot labels. External Telegram delivery and account configuration still need release verification. C8 audio uses original synthesis; the preview is available for listening feedback.
2. Complete the remaining empty/hot/1920 comparisons and repair reproduced failures.
3. Refresh final product captures and branding applications, then recheck the first-thirty-seconds journey.
4. Integrate, hand off the push, verify deployed revision and production behavior. Last public config had guest=false and botUsername=agenticpoker_bot. Code availability does not change those settings.

Explicitly deferred rare birth rolls/future flat-day choreography and undesigned visit/referral/share variants are distinguished from current missing requirements. The collar remains cancelled.

## Deployment

Jens pushes after the final integration gate. A successful push starts deployment; it does not prove that the app is serving the new build. The eventual command remains:

```powershell
Set-Location C:\Projects\ai-poker
git push origin main
```

Automatic approval review rejected npm audit because it sends dependency metadata to npm. That separate permission question remains unanswered; the audit has not run. Installs used --no-audit.
