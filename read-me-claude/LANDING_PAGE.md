# Welcome page — board 40, wave 61

`/welcome` and a new guest's `/` entry share GuestLanding: the viewport hero, a real room, and the nine explanatory sections. The server serves the app's current index and hashed bundle for `/welcome`; the earlier hand-drawn static page has been removed.

The live guest flag determines the action. Guests enabled: mint once and draft in the room. Guests disabled or mint refused: show the existing Telegram sign-in gate and say so. Returning guests and signed-in web users can open their room from the same page. No bot username is inferred from the design archive.

LandingDetails ports the burgundy/gold section layout and typography. Product illustrations are actual App captures at 390×844 and 1440×900, with local test data explicitly described as examples. They are not design screenshots or recreated product SVGs. Phone captures omit the reference's decorative iPhone status-bar bezel. The kitchen table remains by Jens's instruction. Section 07 now shows the working phone or desktop kitchen-table seat at the matching width (BUG-99). Desktop uses DkOwnerM’s 900×648 felt and compact owner cards, with the current permanent roster and shared room conversation. The phone keeps its established Watch/Sit layout.

## Refreshing the product captures

From client, start the dedicated local Vite server on port 5199. In another terminal run:

```powershell
node scripts/capture-marketing.mjs
```

Then stop that Vite server and run:

```powershell
npx --no-install playwright test e2e/welcome.spec.js
```

The exporter reuses the fixture setup functions from the existing Home, desktop and Watch browser specifications, stopping before test registrations. All API responses and sockets are local fixtures. It produces ten PNGs plus capture.json under public/welcome/screens. It asserts the six desktop casino felts the separation of desktop condition labels from numbers, and an uncropped desktop owner seat with real cards from its matching table state. Capture data follows the current wire schema; the older desk fixture's sb/bb shorthand is superseded by the canonical rooms fixture, with ROOM_TABLES sent over its socket.

The browser verification checks real guest creation, typing, returning from the footer, guest-off behavior, all image URLs, five widths, reduced motion and ordinary scrolling. Wide sections are exported with the body's viewport clip released only after interaction checks, so a tall section screenshot includes its heading and caption.

## Evidence and limitations

Four paired section captures are in client/e2e/shots/design-batch22-{home,casino}-{390,1280}.png. Actual products use their current data, authored samples differ, and the retained kitchen table is intentional. The earlier L2 hero pairs still explain its geometry. The complete design/spec goal remains open; this page does not imply external rollout or complete specification parity. Batch25 adds the two design-batch25-sit-{390,1280}.png pairs; the desktop is connected to actual Watch/Join/actions/Leave, while the phone’s existing wider information strip remains an explicit reference difference.

Read-only production check on 9 September 2026: /api/auth/config returned guest=false and botUsername=agenticpoker_bot. Those settings were not changed. The provided bot-avatar files are prepared assets, not proof of an applied Telegram account change.