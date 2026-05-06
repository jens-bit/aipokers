# Bug Report — Agentic Poker
Last updated: 2026-05-06 after v0.7.0 merge

---

## BUG-01 — Nav bar icons missing
**Severity:** High (visual, all tabs affected)
**Where:** client/src/App.jsx
**What:** HomeIcon, PlayIcon, AgentsIcon, HistoryIcon, ProfileIcon are used in JSX (lines ~301-334) but never defined in the file. They were supposed to be added by the feature/nav-bar branch but got lost in the merge. Tabs currently show labels only.
**Fix:** Add the 5 SVG icon components to the bottom of App.jsx. Use icons from design-refs/icons.jsx (Codex already designed these).

---

## BUG-02 — Chat input causes iOS zoom
**Severity:** Medium (UX, mobile only)
**Where:** client/src/styles/globals.css — .dr-chat-input input (or ChatBar input)
**What:** On iOS/mobile, any input with font-size < 16px triggers automatic zoom when tapped. The chat input is likely at 14px.
**Fix:** Add `font-size: 16px` to all input and textarea elements in the chat bar and create agent screen. Can revert visual size with `transform: scale()` on the wrapper if needed.

---

## BUG-03 — Agent creation double-confirm
**Severity:** Medium (UX)
**Where:** client/src/components/CreateAgent.jsx
**What:** Two separate confirmation steps: first a "Draft Ready" panel appears asking to confirm, then after creating there is an "Agent Created" card with Deploy/Keep tuning. Users have to confirm twice.
**Fix:** Remove the intermediate "Draft Ready" step. Go straight from chat to "Agent Created" once the backend returns a created agent. The Draft Ready panel was meant to be a preview, not a gate.

---

## BUG-04 — Game continues vs dead AI after player leaves
**Severity:** High (game logic)
**Where:** src/server/table.js or wsServer.js
**What:** When a human player clicks LEAVE during a hand, the server keeps the table alive and the AI continues playing against an empty seat. The table should pause or close when the human disconnects.
**Fix:** In wsServer.js, when a LEAVE message arrives or a socket disconnects, check if any non-AI human seats are now empty. If so, end the current hand and close the table (or put it in a waiting state).

---

## BUG-05 — WatchBanner text has no spacing
**Severity:** Low (visual)
**Where:** client/src/App.jsx — WatchBanner component
**What:** The banner renders "Loose CannonHand #3 · COMPLETESPECTATING" — no spaces between agent name, hand info, and SPECTATING tag. Looks broken.
**Fix:** The WatchBanner component already has separate elements (.watch-banner__name, .watch-banner__sub, .watch-banner__tag). This is likely a CSS gap/flex issue. Add `gap: 8px` to .watch-banner or check that the elements are not collapsing into each other.

---

## BUG-06 — Table layout breaks during human player's turn
**Severity:** High (game-breaking)
**Where:** client/src/App.jsx — TableView component, or client/src/components/PlayerSeat.jsx
**What:** When it is the human player's turn to act, the table layout shifts or overlaps — seats misaligned, action bar overlapping board. Spectator view (when agent plays) seems fine.
**Fix:** Read TableView in App.jsx carefully. The layout likely has a conditional CSS class that is applied when mySeat === game.toAct and that class is breaking the flex/grid layout. Check .table-area and .seat classes for conflicting positioning when the active seat is the bottom/hero seat.

---

## BUG-07 — Both seats show same agent name
**Severity:** Medium (confusing UX)
**Where:** TableView / PlayerSeat — displayNames logic
**What:** In a vs-AI game, both the hero seat and opponent seat show "Loose Cannon". The opponent seat should show a distinct name (the AI opponent's display name or "Opponent").
**Fix:** Check displayNames construction in App.jsx. The AI opponent seat should get the agentDisplayName from the game config, not fall back to the same value as the hero seat.

---

## BUG-08 — HistoryPlaceholder and ProfilePlaceholder undefined
**Severity:** Medium (crash on those tabs)
**Where:** client/src/App.jsx
**What:** App.jsx references HistoryPlaceholder and ProfilePlaceholder in the tab render section, but these functions were defined in the feature/nav-bar branch's App.jsx and may not have survived the merge cleanly. Clicking HISTORY or PROFILE tab may throw a React error.
**Fix:** Add simple placeholder components to App.jsx:
  function HistoryPlaceholder() { return <div className="placeholder-screen"><h2>History</h2><p>Coming soon</p></div>; }
  function ProfilePlaceholder() { return <div className="placeholder-screen"><h2>Profile</h2><p>Coming soon</p></div>; }
Or better: build the real screens (see Roadmap).

---

## Notes for next session
- All design work (icons, oval table, cards, home screen) should be PORTED from design-refs/ folder, not redesigned from scratch. Codex already built the designs. Claude's job is to port them to production React.
- When merging branches, NEVER use PowerShell `>` redirect for git show output — it creates UTF-16 files. Use: `git show branch:file | python -c "import sys; open('file','w',encoding='utf-8',newline='\n').write(sys.stdin.read())"`
- Merge conflicts in globals.css happen every session. Consider splitting globals.css into logical chunks (tokens.css, components.css, layout.css) so branches touch different files.
