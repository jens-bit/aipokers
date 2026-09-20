# Character menu — 20 September 2026

Jens requested implementation after the 19 September screenshot preview and
asked that pending work be pushed first. The earlier recovery was already merged
and deployed through PR #8 at `97d4971`. This change starts a fresh review branch,
`codex/character-menu`, from that deployed commit.

## Behavior

Opening a character keeps his full body, hands and owner-visible cards on stage.
Chat, Stats and Wardrobe change the lower pane. Chat retains unsent words across
tabs. Stats reads actual condition, attributes, career, recent changes and session
results; absent records stay unknown. Direct profile entry opens Stats within
the same shell. Desktop retains the room and roster beside the character.

Watch/Deploy and Give chips remain immediately available. More contains Carry
and His sheet, which retains the longer record, invitation, notification and
retirement controls. Back from His sheet restores the selected character pane;
its explicit Chat control returns to the conversation. Existing return origins,
owner-scoped drafts and watch privacy are preserved.

Jens corrected the initial palette proposal before PR #9 merged. Birth hood and
eye colours are permanent. The server rejects every identity PATCH, including a
mixed rename request. Wardrobe now offers a free starter cap, glasses and scarf.
Selection/Try on are local, Save persists removable equipment, and tapping a
selected item removes it. Cancel restores the saved outfit. A refused save keeps
the draft for retry; responses from another agent/owner cannot change this room.
Saved items appear on room, roster and public table portraits on their next frame.
This adds no stat boosts, paid cosmetics or real-money behavior. Private chat/cards remain private.
The proposed three-friend host invitation is a separate subsequent feature.

## Earlier verification — superseded by the playtest repair gate

The corrected starter Wardrobe and playtest repairs passed the full local gate:
209 server checks, 8 end-to-end tests, 3,101 client tests, production build,
8 browser smoke tests, 20 phone layout checks and 212 integrated journeys.
See `PLAYTEST_2026-09-20.md` for the final bar-layer regression and exact receipts.

The following receipts cover the original character menu at 76c4eb6, before the
founder corrections. They do not authorize release of the revised code. PR #9
was made draft; `PLAYTEST_2026-09-20.md` tracks the current repair gate.

Focused new behavior was reproduced red before implementation. Verification uses
Node 22.22.2, isolated scratch databases and no paid provider or Telegram bot keys.

- Server: 203 passed, two existing intentional exclusions; end-to-end: 8 passed.
- Client: all 3,041 tests in 250 files passed after the scoped-query corrections
  below; the default worker count, assertions and timeouts are unchanged.
- Production build: passed; browser smoke 8/8, Home layout 20/20, engine smoke 34
  checks across five hands.
- Required integrated browser selection: 200 passed initially; three retained
  geometry checks still expected the old 40 px header. Those now assert the exact
  new 48 px header for 44 px controls and pass 3/3, retaining short-phone composer,
  character readings and Carry placement checks. CI repeats the complete 203.
- Additional browser coverage: appearance/away-character/visit sharing 19/19,
  built Home journeys 6/6, shipped screenshot journeys 26/26 and real stakes 4/4.
- Public API JSON and 79 local schema references validate. Independent production
  code review found no actionable regression. Phone and desktop captures reviewed.

Local evidence is under artifacts/character-menu-release and
artifacts/character-menu. Production release goes through the branch PR and its
required GitHub checks, followed by the main deployment and public health/asset
verification; the PR and completion report carry those release receipts.

Old tests using the removed Profile button are migrated to Stats or More → His
sheet while retaining their substantive privacy, money, lifecycle and navigation
assertions. The old second profile composer is intentionally replaced by the
single retained Chat composer. Required CI includes the new character-menu browser
journeys alongside the existing recovery selection.

The retained mounted panes made broad jsdom role queries expensive. App and
desktop roster tests now query their actual control regions with unchanged
assertions and timeouts. The newborn entrance check controls its 260 ms animation
clock and verifies both entering and leaving the doorway, with explicit cleanup.
The extra high-stakes smoke also migrated retired casino-room/back-button
navigation to stake chips and Stop watching; it still proves House fallback,
second-owner admission and room isolation, now with exact native/public blinds.
