# Agentic Poker — design boards

A Tamagotchi-skinned poker manager in Telegram. You draft an agent in conversation,
he plays hands without you, and you live with who he turns out to be.

Boards are numbered by layer, not by date. Open the highest number in a family for
the current thinking; earlier boards in the same family are kept because their
captions carry decisions the later ones assume.

## Boards

| # | Board | What it holds |
|---|---|---|
| 01 | Foundations · Design System | Tokens, type, MoodBand, GhostChip, anatomy sheets |
| 02 | Foundations · Faces | The ghost, its moods, hands and postures |
| 10 | System · Character | S0–S6: six attributes, natures, current vs potential, growth, fatigue |
| 11 | System · Biography | Nemesis, rival, favourite victim, the grudge ledger |
| 20 | Mobile · Mood and Casino | The mood suite and the original casino floor |
| 21 | Mobile · Watch & Wallet | Watch v3, replay theatre, owner wallet and agent pockets |
| 22 | Mobile · Watch v4b | Deal beat, seated opponents, the voice feed |
| 23 | Mobile · Forward Motion | Draft → birth → floor → watch, one primary action per screen |
| 24 | Mobile · First Five Minutes | The whole first run, every empty state a room that breathes |
| 25 | Mobile · Notifications | The notification kit and its budget laws |
| 26 | Mobile · Watch v5 | Current watch screen |
| 27 | Mobile · Casino | Current casino floor |
| 29 | Mobile · Home | **Current.** The flat: the home game, the away wall, routines, the safe, the fridge, four chairs, sitting down yourself, and the wave-53 nav |
| 30 | Desktop · Command Center | The desktop product |
| 31 | Desktop · Parity | Desktop versions of everything mobile drew first, including home |
| 40 | Marketing · Landing | **Current.** The landing page: nine sections, every screenshot a live component from 26 · 27 · 29 |

## Laws that bind every board

- **Fish-tank law** — his own hole cards face up, everyone else's face down.
- **Mood law** — every mood effect is visible, bounded, and counterable through play.
- **Character laws** — no purchase path for attributes, ever; attributes never gate
  whether he can play; the ceiling is never a number on a bar (only inside a tapped
  bar, once, in gold); every cost line is *his* misjudgment, never the app's;
  biography touches voice, table talk and mood only.
- **Density** — a panel is a picture, not a paragraph. Long voice lives in the
  thread; the felt gets one line of twelve words or fewer.
- **The room shows, it doesn't label** (wave 52) — what an agent is doing is visible,
  so it is not written. His name sits in a pill above his head with his two resource
  bars inside it, and nothing sits under his feet.
- **Bubble anatomy** (wave 52) — name pill above the head, bubble *beside* the head
  with the tail from the side, cards and hands below. A bubble's width and side come
  from the clearance it actually has, measured against what is on screen — inside the
  table camera that is the visible slice of the room, not the room.
- **No bottom bar** (wave 53) — HOME · CASINO · YOU are things in the world, not tabs
  over it: YOU is the avatar top-right (roster sheet, money behind it), CASINO is the
  door, HOME is where you already are. The composer is the only thing at the bottom.
- **Identity is rolled at birth** (wave 53, corrected 56) — six hoods × six glows,
  fixed for life. Mood moves the face, never the colour. The roll is a *preference*
  and the roster is the authority: a hood already worn in your room is taken, so four
  agents always wear four hoods (`rollRoster`). A uniform hash alone still collided
  about half the time.
- **Both bars are anchored at the left wall** (wave 56) — stamina full is the whole
  bar and its right end recedes leftward as it drains, green → amber → red; heat
  empty is nothing and its fill grows rightward, ember → red. A worn, tilted agent is
  a short red stub over a long red bar: two opposite shapes.
- **Every panel over the felt or the room is one glass** (wave 56) — `V5GLASS` from
  board 26's ThreadSheet. Sheets take `raised`, strips and toasts take `panel`, the
  hairline is `edgeUp`. No solid grey bands anywhere, including the owner's action
  strip and the BET panel.
- **The owner never plays the hand**, and never looks like he does. No guilt anywhere.

## Component files

Shared atoms first, then one file per wave. Every board loads the chain it needs, so
a file is rarely owned by a single board.

- `mood-atoms.jsx`, `mood-faces.jsx`, `mood-hands.jsx`, `cards.jsx`, `icons.jsx`,
  `header.jsx`, `ios-frame.jsx` — the shared layer. `mood-atoms.jsx` also owns
  `HOODS`, `GLOWS` and `idFor()`, the birth identity roll.
- `char-*.jsx` — the character system. **Locked**: the attribute primitives, the
  profile card and the birth card are not edited by later waves.
- `mood-home.jsx` / `mood-home2.jsx` / `mood-home-desk.jsx` — the flat: coordinate
  space (`FLAT`, `STAND`, `TABLE_SEATS`), bodies, fixtures, sheets, the table camera
  (`TableCam`) and the desktop room.
- `mood-nav.jsx` — wave 53: the roster sheet behind the avatar, the ranked floor
  board, the identity sheet, and the first five minutes on the no-bar nav.
- `mood-landing2.jsx` — wave 54: the landing page. `mood-landing.jsx` is the previous
  one and is still loaded by board 02 for its hero anatomy.
- `mood-watch*.jsx`, `mood-wallet.jsx`, `mood-casino*.jsx`, `mood-birth*.jsx`,
  `mood-flow*.jsx`, `mood-ftu2.jsx`, `mood-notify.jsx` — one family per system.
- `mood-desktop*.jsx`, `mood-desk-parity*.jsx` — the desktop shell and its screens.

Moved to `archive/` in wave 54 because no numbered board loads them:
`mood-relate.jsx` (superseded by `char-bio.jsx`), `mood-share.jsx` (the share card,
not yet re-drawn against the current felt), `mood-heat.jsx` (its `heatStyle` was
inlined into `mood-watch4c.jsx`), and `styles.css` (only the archived early
prototypes link it, and they link it relatively).

`archive/` holds superseded prototypes and their component files. Nothing in it is
referenced by a numbered board.
