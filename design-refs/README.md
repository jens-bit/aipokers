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
| 29 | Mobile · Home | **Current.** The flat: the home game, the away wall, routines, the safe, the fridge, four chairs |
| 30 | Desktop · Command Center | The desktop product |
| 31 | Desktop · Parity | Desktop versions of everything mobile drew first, including home |
| 40 | Marketing · Landing | "How it plays" in plain language |

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
- **The owner never plays the hand**, and never looks like he does. No guilt anywhere.

## Component files

Shared atoms first, then one file per wave. Every board loads the chain it needs, so
a file is rarely owned by a single board.

- `mood-atoms.jsx`, `mood-faces.jsx`, `mood-hands.jsx`, `cards.jsx`, `icons.jsx`,
  `header.jsx`, `ios-frame.jsx` — the shared layer.
- `char-*.jsx` — the character system. **Locked**: the attribute primitives, the
  profile card and the birth card are not edited by later waves.
- `mood-home.jsx` / `mood-home2.jsx` / `mood-home-desk.jsx` — the flat: coordinate
  space (`FLAT`, `STAND`, `TABLE_SEATS`), bodies, fixtures, sheets, and the desktop
  room.
- `mood-watch*.jsx`, `mood-wallet.jsx`, `mood-casino*.jsx`, `mood-birth*.jsx`,
  `mood-flow*.jsx`, `mood-ftu2.jsx`, `mood-notify.jsx` — one family per system.
- `mood-desktop*.jsx`, `mood-desk-parity*.jsx` — the desktop shell and its screens.

`archive/` holds superseded prototypes and their component files. Nothing in it is
referenced by a numbered board.
