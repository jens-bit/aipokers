# Railbird home playtest repair — 2026-09-08

Jens pushed 4007703 and supplied a successful deployment screenshot plus a four-agent home where Loose Cannon's request covered the felt, the table could not be clicked, and the app still said Agentic Poker. Astra verified that deployment 34271458168 succeeded. Those visible gaps were real; the earlier security batch did not finish them.

## Changes

- **BUG-55 — blocked felt:** a speech slot was a flex child of the agent's button. It enlarged the invisible button above his name pill and over the middle of the table. The new browser test reproduced a click on the felt selecting Loose Cannon instead of opening TableSheet at both 390×590 and 390×844. Speech is now absolutely positioned outside the button's bounds and cannot intercept pointer events. Other room speech is excluded from the felt's rectangle as well. Body/name taps and long-press carry remain available.
- **BUG-56 — duplicated request:** the request now speaks once, in its compact answer strip. Removed its duplicate room bubble and suppressed the stale recap that would otherwise replace it. The strip uses F11's plain panel glass and small pills with extended touch targets, and occupies layout space rather than covering the room. This is a repair choice for Jens's obstruction report, not a claim that board 42's full agent conversation is built. The full sentence remains visible; Yes/Later/No still use the existing endpoint.
- **Short Telegram windows:** the room fits the available width and can scroll vertically to reach the TV. It does not shrink every character to fit a short window. The regression fixture now reads the actual viewport height instead of claiming 844px inside a 590px browser.
- **BUG-57 — actual client branding:** ported RailMark from design-refs/mood-atoms.jsx (board 41), including its single-colour mask and per-instance SVG ids. Phone and watch headers, desktop branding, the guest masthead, website title/favicon and /welcome branding now use Railbird. The wordmark follows the reference's Oswald 500 / .26em rule. This is not the full landing-page or board-41 motion port.
- **Casino count:** the mobile label now says “N in casino”, with an explanation that home games are separate. A zero does not pulse as a live signal; a failed refresh hides the stale count. The public production stats read at 20:14:48 UTC returned 0 activeAgents, 0 activeTables and 15 totalAgents. Zero was the casino-seat metric, not the number of agents Jens owns. No production agents, records or sessions were changed by this work. Desktop retains its existing own-roster live count.
- **BUG-58 — stale gesture check:** the old couch-drop test assumed a seat before a 600ms hold meant a client-side refusal with no POST. SERVER-5 had already moved that decision to /place, and a hand can end during the gesture. The observed failure showed an accepted server response while the test waited for obsolete “In a hand” text. The check now requires exactly one couch placement request, validates 200/placed or 409/inHand, and verifies the actual server sentence appears. It does not bypass the server or loosen a real failure.

## Checks

- `npm run test:all`: 103 server passes (2 existing skips); 146 client files, 2107 passes (2 existing todo); all 7 outer end-to-end checks including all 6 full-stack scripts.
- Client production build: passed; 192 modules. Existing ReplayTheatre import warning remains.
- Built browser smoke: 4 passed, phone and desktop, against an isolated keyless local server.
- HOME-2: 19 passed, 1 existing BUG-43 skip, on a fresh isolated database after fixing BUG-58. The gold-gradient assertion was deliberately replaced with exact plain-panel/blur/gold-edge assertions to match the current F11 reference.
- Desktop and home browser suites: 23 passed, including all 15 desktop checks and the two new four-agent regressions.
- New four-agent browser tests run in the deploy workflow before deployment; screenshots upload with the smoke artifact.

Astra viewed the repaired short/full phone screenshots, desktop home, board-29 F10/F11 reference crops and the reference/product pair. The pair is `client/e2e/shots/railbird-home-reference-pair.png`. The reference depicts a different routine distribution; this is a comparison of remaining visual differences, not a pixel-match claim. Furniture detail, TV content, safe balance treatment, the larger agent view and other ledger gaps remain unfinished. No Claude/Opus review is claimed.

## Publishing and Telegram's outer title

The integrator prepares local main; Jens pushes from PowerShell. This work does not itself push or deploy. A green deployment must be followed by a production playtest of the felt, agent taps, request answers and short-window scrolling.

The title above the webview belongs to the Telegram bot. Changing HTML cannot rename that bot. In BotFather, send `/setname`, select `@agenticpoker_bot`, then enter `Railbird`. This changes the display name, not the existing links/username. Official reference: https://core.telegram.org/bots/features#edit-bots. Bot avatar/configuration, existing bot links and the host domain were not changed.
