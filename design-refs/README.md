# Railbird — design boards

A railbird is the one at the rail watching somebody else play with money on it, and
that is the owner: you don't play, you raise a player, back him and sweat him.

A Tamagotchi-skinned poker manager in Telegram. You draft an agent in conversation,
he plays hands without you, and you live with who he turns out to be.

`railbird.se` · `@railbird_app_bot`

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
| 41 | Brand · Railbird | **Current.** The mark: the ghost at the rail, rebuilt from his own vector parts. Reduction, the chat-list and tab tests, the palettes, every placement at size, and the two motion beats |
| 42 | Mobile · The Agent | **Current.** Tap him, get him: the agent sheet, his line first, the whisper, the profile with RECENT, the roster, absence, the TV by state, the celebration, and the desktop column |

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
- **The mark is the ghost at the rail** (wave 63) — not a drawing *of* the product but the
  product itself, rebuilt from the ghost's own vector parts in `mood-atoms.jsx`: hood arch,
  face as a hole, two ellipse eyes, flat brows, the floating fists, both hands gripping a
  padded rail that runs off both edges with square ends. Wave 62's bird is dropped; a bird
  has nothing to do with this game. **One colour at a time:** the whole mark is an SVG mask
  filled with one colour, so every dark part is a *hole* and the background shows through —
  no second fill on black, burgundy, cream, or inside a circular crop. The eyes are never
  dots, at any size. Wordmark is Oswald 500 caps at 0.26em with its baseline on the mark's
  rail. `RailMark` in `mood-atoms.jsx` (aliased as `SpadeLogo`) keeps the 20×20 call site,
  so every header has now swapped twice without one screen changing. The door inside the
  flat still says CASINO.
- **Tap him, get him** (wave 63) — the agent view is not a chat page with an avatar in the
  header. The character fills the upper half at 196px, animated as he is in the room, and
  the conversation is what is left over, **his line first**. Nothing is written on him; the
  name pill floats above his head. The upgrade cards left the conversation entirely and live
  on the profile under RECENT. A want's Yes / Later / No sit under **his** bubble and nowhere
  else. Nothing in a conversation is a card except a hand.

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
- `mood-brand.jsx` — wave 62, rebuilt in wave 63: the mark and its five poses (close,
  lean, hood, far, glyph), the wordmark, the lockups, the bot avatar, the app icon and
  favicon, the marquee sign, the loading screen, the empty room, and the chat-list /
  browser-tab / reduction tests. Self-contained: its own tokens, no dependency on
  `mood-atoms.jsx`, so an export can load it alone.
- `mood-agent.jsx` / `mood-agent2.jsx` — wave 63: the agent sheet (stage, action row,
  thread, composer, profile) and everything around it (roster, absence, the TV's two
  states, the celebration, the desktop column).
- `brand/` — the three pose references for the mark. Reference only: the mark is vector,
  rebuilt from the ghost, never traced from these.
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
