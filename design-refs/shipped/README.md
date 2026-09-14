# Shipped screens — ground truth for design

SHOTS-1. Claude Design can read the code but cannot run the app, so its boards drift
from what actually shipped. Everything in this folder is a real screenshot of the
real built client behind the real server — no mocked API, no scripted socket — at
390×844 (phone) and 1440×900 (desktop). It is **not** a design reference to port
from; `design-refs/` above this folder is still the one source of truth for that.
This is what the product actually looks like right now, for comparison against it.

## Refresh it

```
npm run shots
```

One command. It builds the client, seeds a scratch SQLite database with a real
household through the shipped HTTP API, walks every screen below in a real
Chromium browser, and overwrites every PNG in this folder. Nothing here is hand-
edited — a stale picture is a bug in `client/e2e/shipped-shots.spec.js` or
`scripts/shots.js`, not a reason to touch the PNG.

## The household

One owner, three real agents, all built through `/api/agents/build` (no model —
keyless `inferFallback`), no fixture objects:

| Agent | Brief given | Ends up | Doing |
|---|---|---|---|
| **The Rock** | "Play tight, safe and conservative." | at the kitchen table | seated in the real home game |
| **The Closer** | "Be aggressive, bluff and pressure people." | deployed to the floor | mid-hand, real chips moving |
| **The Grinder** | *(none — default)* | at home, undeployed | idling in the room, ordinary fatigue |

Two more real rooms (upstairs, the back room) are populated by throwaway single-
agent households funded and deployed at each rung, purely so those floors have a
table running on them — neither of those agents is "his".

**Gap — The Grinder is not actually asleep.** The intent was one agent visibly
resting/asleep; the home routine's `Routine.SLEEPS` only fires once real fatigue
reaches `'worn'` (`src/server/home.js`), and `attributes.js`'s fatigue curve needs
roughly 60–240 real hands of play (STAMINA-dependent) to get there. There is no
debug endpoint that sets it, and playing that many hands for every refresh of this
pack was not a real option. He is seeded ordinary and awake instead.

**Gap — no true spectator screen.** WATCH-PUBLIC-1's public view (`publicOnly`,
`spectatorSeat: -1`) only exists when the server has a real `TELEGRAM_BOT_TOKEN`.
Every server in this pack is deliberately keyless (that's what lets seeding run
over plain HTTP), and without a token `src/server/wsServer.js`'s own `localDev`
branch marks *every* watcher the owner — so a second browser watching the first
owner's table cannot be told apart from the owner's own watch on this server. Not
captured, rather than captured as a lie.

## The screens

| Screen | File | Route | Component |
|---|---|---|---|
| Landing | `landing-390.png` / `landing-1440.png` | `GET /welcome` (no login, guest off) | `client/src/components/guest/GuestLanding.jsx` |
| Guest draft | `guest-draft-390.png` / `guest-draft-1440.png` | `/` on a `GUEST_ENABLED=1` server, fresh browser | `client/src/components/guest/GuestLanding.jsx` → `client/src/components/draft/DraftSheet.jsx` |
| Owner draft | `owner-draft-390.png` / `owner-draft-1440.png` | `/`, a logged-in owner with zero agents | `client/src/screens/BirthScreen.jsx` → `client/src/components/draft/DraftSheet.jsx` |
| Home | `home-390.png` / `home-1440.png` | `/` | `client/src/screens/HomeScreen.jsx` |
| Agent view | `agent-view-390.png` / `agent-view-1440.png` | tap The Rock's body on Home | `client/src/components/agent/AgentView.jsx` |
| Agent profile | `agent-profile-390.png` / `agent-profile-1440.png` | "Profile" from the agent view | `client/src/components/agent/AgentProfileOverview.jsx` (via `client/src/screens/AgentProfileScreen.jsx`) |
| Roster | `roster-390.png` / `roster-1440.png` | "Your agents" (phone sheet) / ambient rail (desktop) | `client/src/components/RosterSheet.jsx` / `client/src/components/desktop/DeskRoster.jsx` |
| Casino · the floor | `casino-floor-390.png` / `casino-floor-1440.png` | CASINO → Floor → the floor | `client/src/components/casino/FloorView.jsx` + `TheFloor.jsx` (`client/src/screens/CasinoScreen.jsx`) |
| Casino · upstairs | `casino-upstairs-390.png` / `casino-upstairs-1440.png` | CASINO → Board → upstairs | same |
| Casino · the back room | `casino-backroom-390.png` / `casino-backroom-1440.png` | CASINO → Board → the back room | same |
| Watch — home, as owner | `watch-home-390.png` / `watch-home-1440.png` | tap the kitchen table → Watch | `client/src/components/WatchScreen.jsx` / `client/src/components/desktop/DeskHomeTable.jsx` |
| Watch — casino, as owner | `watch-casino-390.png` / `watch-casino-1440.png` | phone: `?startapp=table_<id>` deep link; desktop: the felt tile on the floor | `client/src/components/WatchScreen.jsx` / `client/src/components/desktop/DeskCasinoTable.jsx` |
| Safe | `safe-390.png` / `safe-1440.png` | tap the safe on Home | `client/src/components/wallet/SafeSheet.jsx` |
| Ledger, from the safe | `ledger-safe-390.png` / `ledger-safe-1440.png` | phone: "pull up for the ledger"; desktop: already in the rail | `client/src/components/wallet/SafeSheet.jsx` → `client/src/components/wallet/LedgerList.jsx` |
| Ledger, from the roster | `ledger-roster-390.png` / `ledger-roster-1440.png` | phone: roster → LEDGER; desktop: "Wallet for …" top-bar button | `client/src/components/RosterSheet.jsx` / `client/src/components/desktop/DesktopTopBar.jsx` → `LedgerList.jsx` |

Note on the last two: at 1440 both doors land on the same `.dsk-wallet` rail panel
(`SafeSheet.jsx`'s own note — "the desk has no pull: the rail has a column for
tonight and the ledger at once"). Real, but not two different desktop screens; kept
as two files because the phone doors genuinely differ.

Captured 2026-09-14.
