# Casino entry and live guidance — 12 September 2026

This is the first implementation slice of [NEXT_PLAYTEST_FEEDBACK.md](NEXT_PLAYTEST_FEEDBACK.md), under [FIRST_SESSION_MISSION.md](FIRST_SESSION_MISSION.md). It does not complete the overall newcomer mission or the remaining playtest feedback.

## What changed

- The quiet casino floor offers **Send NAME to play**, with the room's stakes and play-money buy-in visible before the action. Multiple available agents have a named selector. It uses the existing `/deploy` path to join a compatible table or create a session; admission, opponents, buy-in and limits remain server-owned. The older placement tray's `/queue` behavior is unchanged.
- The action stays available on populated floors without taking space from the canvas: in the existing right column on desktop and a compact lower panel on phone. The phone's full board remains behind its existing Board toggle. Funding uses the existing sheet and refreshes the pocket before returning.
- A synchronous guard prevents duplicate requests. Rejections and failed responses remain visible and allow a deliberate retry. Leaving the floor invalidates late navigation or funding callbacks without cancelling the already-authorized server deployment. Unstarted sessions are described as waiting rather than falsely called live.
- Opening an owned agent's table from the floor, board or hot-table control preserves the authenticated roster's agent identity in WATCH. The desktop can use that newer roster even when its Home poll is stale. Public Watch remains public; only cards served by the server can be displayed.
- The old shared-card lesson is replaced by **You are watching. Your AI agent is playing.** Then OK points at the actual private composer, the character itself and an actual opponent. Each step is short, skippable and leaves the game running. The guest chat step says **Sign in to talk to your agent here.** Public/human/kitchen states receive only applicable guidance; loading and covering sheets suppress pointers.
- The existing `railbird.guide.v1:<owner>` seen record is retained. Previously seen owners are not enrolled again by this update. The guide never sends chat, opens a claim wall, deploys or seats a human on its own.

## Evidence and verification

All local logs and screenshots are under ignored `artifacts/casino-entry/` in the implementation worktree. Final client regression ran after the floor geometry and character-outline corrections: **228 files, 2,827 passed, two existing todos** (`client-complete.log/json`). Server: **140 passed, two intentional skips**. Engine e2e: **7 passed**. Built smoke: **8 passed**. Home2: **20 passed**.

Browser coverage: all **54 desktop cases** covered; the four floor geometry/touch failures were repaired and passed unchanged assertions, and the development-only B15 import case passed on its required dev server. The final affected built run passed **27 cases**: 21 first-session cases, three floor geometry sizes and three real-touch pinch sizes. The earlier broad run also passed **26 Home cases**, including BUG-55 at 390×590 and 390×844, and **5 public-Watch identity/privacy cases**. Real development-owner journeys: **2 passed**. Real fresh-guest journeys at normal timing: **2 passed**, including the actual returning-user room entry. No automated model calls were made.

Build succeeded; the known 500 kB entry warning remains. Watch stays eager. Useful reviewed previews are `show/phone-play.png`, `show/desktop-play.png`, `show/agent-guide.png` and `show/desktop-guide.png`. Generated reference screenshots were copied to ignored artifacts and restored before staging.

Regressions were demonstrated before their fixes: missing floor action, owned WATCH losing agentId, delayed deployment overriding navigation, guest-owner chat wording, oversized character outline, and populated-floor geometry/touch failures. Existing geometry, gesture and privacy assertions were kept. The shared-card tutorial expectation was intentionally replaced to match Jens's new product instruction.

Visually inspected the built quiet and populated floor, phone character pointer, desktop composer pointer, and real phone/desktop game entry. The final character outline encloses the actual ghost instead of the whole stack row. Populated-floor tables retain their original canvas space and the play action stays visible on a short phone.

The real guest check uses normal server pauses and slow browser interactions, with provider keys removed and isolated data. It drafts, returns Home, follows the guide, verifies the existing private-chat sign-in requirement, reloads through the actual **OPEN YOUR ROOM** control, and sends the agent from the casino into a real session with a distinct opponent. This is functional evidence, not a claim that a newcomer understood the experience or wants to return.

## Next slice

1. Keep the live Watch connection beneath contextual own-agent inspection/chat, with appropriate in-game actions and Back returning to the same table. Current mobile own-agent chat still leaves Watch; this patch does not claim to repair that larger navigation/menu problem.
2. Reproduce and repair opponent/Home/funding dismissal separately. Opponent outside dismissal is currently absent; Close and Escape have handlers, and scrolling prevents the existing downward-drag dismissal. Do not conflate those cases.
3. Stabilize table geometry across actions/results, then explain the actual current hand and winning-chance estimate. Diagnose whisper persistence and routing at normal speed before changing shared game timing.

Stamina-dot design, bar drinks, new objects, proactive memory/messages and additional ongoing model cost remain product decisions recorded in the feedback plan. No backend, timing, economy or paid-call settings changed here. Jens pushes; local readiness is not evidence of a completed deployment.
