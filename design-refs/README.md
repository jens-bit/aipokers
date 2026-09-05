# Agentic Poker — file map

Boards are numbered by **layer, then platform**, so the page list sorts into the
order you'd read them in. Everything at the root is current; `archive/` is
superseded.

## Boards

| | Board | What it settles |
|---|---|---|
| 01 | Foundations · Design System | Tokens, atoms, the anatomy sheets, the state matrix |
| 02 | Foundations · Faces | 5 states × 3 heat tiers, 6 event expressions, 4 sizes |
| 10 | System · Character | Attributes, natures, potential, growth & fatigue (S0–S7) |
| 11 | System · Biography | Nemesis / rival / favourite victim, the grudge ledger |
| 20 | Mobile · Mood & Casino | The main canvas — floor, thread, birth, profile, snacks |
| 21 | Mobile · Watch & Wallet | Pacing states, the rope, owner wallet and agent pockets |
| 22 | Mobile · Watch v4b | Bubbles, seated opponents, the read sheet, the TABLE tab |
| 23 | Mobile · Forward Motion | The draft→birth→floor→watch chain, floor v2 |
| 24 | Mobile · First Five Minutes | The complete first-run path and every empty state |
| 25 | Mobile · Notifications | The ladder, the budget board, the violations board |
| 30 | Desktop · Command Center | The 1440 shell — stage, rail, roster |
| 31 | Desktop · Parity | The audit, the missing states, one desktop matrix |
| 40 | Marketing · Landing | The public page |

## Component layer

Boards load plain `.jsx` files from the root by `<script type="text/babel" src>`.
They are **not** modules — each defines globals and exports them via
`Object.assign(window, {...})`, so **load order matters** and every board lists
its own dependencies.

| Prefix | Holds |
|---|---|
| `icons` `cards` `header` `ios-frame` | Primitives shared by everything |
| `mood-atoms` | Tokens, `MoodGhost` + the face system, `MoodBand`, `LiveBar`, shells |
| `mood-screens-a…f` | Mobile screen sets (thread, watch, floor, hand review) |
| `mood-casino` `mood-casino2` | The floor: layouts, dioramas, occupants; v2 adds heat/walk-in |
| `mood-watch` `mood-watch3` `mood-watch4` `mood-watch4b` | Watch v1 → v4b |
| `mood-desktop` `-2` `-3` | The desktop shell and its screen sets |
| `mood-desk-parity` `-parity2` | The wave-39 audit, heat, and the missing desktop states |
| `mood-birth` `-2` `-3` | The draft and birth flow |
| `mood-flow2` `mood-ftu2` | Forward motion, and the first-run path |
| `mood-wallet` `mood-snack` | Money, and the only item |
| `mood-heat` `mood-relate` `mood-share` | Heat, wants + the ledger, the share card |
| `mood-faces` | The faces reference sheet (geometry lives in `mood-atoms`) |
| `char-*` | The character system: attributes, profile v2, birth, biography |
| `mood-system` `mood-system2` | The design-system sheets |
| `mood-landing` | The landing page sections |

`design-refs/` is a handoff snapshot, not a live source — it is a copy taken at
wave 33 and refreshed occasionally. Edit the root files.

## Naming rules, so this stays clean

- **Boards** get `NN Layer · Name.html`. Numbers leave gaps (10, 11, 20, 21…) so a
  new board slots in without renumbering.
- **No `&` in filenames** if it can be avoided — one board shipped as
  `Watch &amp; Wallet.html` because an HTML entity got into the name.
- **Component files** keep their `mood-`/`char-` prefix and their suffix number.
  Do not rename them: every board's `<script src>` list points at these paths.
- **Superseded boards** move to `archive/` rather than being deleted. Their
  relative `.jsx` paths no longer resolve from that folder, which is fine — they
  are kept as a record of the direction, not as working files.
