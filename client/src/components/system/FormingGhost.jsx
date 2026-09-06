// client/src/components/system/FormingGhost.jsx — DRAFT-2
//
// HE FORMS WHILE YOU ANSWER. Port of `DRAFT_STAGES` / `FormingGhost` from
// design-refs/mood-sit.jsx (board 29, frames F02 / F02b, wave 56).
//
// ONE ATOM, FOUR PARAMETER SETS. The ref's whole claim about this component,
// and the reason it is four numbers rather than four drawings:
//
//   1  a near-black hood with a near-black glow ....... a silhouette
//   2  the real hood with a dead glow ................. the hood, a body with no eyes
//   3  the real hood with a dim glow .................. the eyes
//   4  the real hood with his real glow, and a halo ... his colour
//
// Every one of them is `MoodGhost`. Nothing here is a second drawing of the
// ghost, so he cannot drift from the creature the rest of the product renders —
// which is the failure the old `FormingGhost` in BirthScreen.jsx had by
// construction: it was its own SVG path, its own eyes, and its own idea of what
// he looked like, so the thing you watched take shape was never the thing that
// then walked into the room.
//
// The stage is a COUNT OF ANSWERS, not a percentage. See draftStage() below.

import { MoodGhost } from './MoodGhost.jsx';
import { HOODS, GLOWS } from '../../lib/identity.js';

/**
 * The four stages, verbatim from the ref.
 *
 * The hood and glow he forms in are HOODS[1] / GLOWS[1] — the ref's own choice,
 * and a fixed one, because the draft cannot know his real pair: identity is
 * rolled at birth, on the server, from a seed that does not exist until he does.
 * What the owner watches assemble is a man taking shape, not a preview of the
 * exact cloth he will wear.
 */
export const DRAFT_STAGES = [
  { n: 1, hood: { top: '#0C0F12', bot: '#05070A' }, glow: '#0B0E11',   halo: 0,    cap: 'a silhouette' },
  { n: 2, hood: HOODS[1],                           glow: '#191C20',   halo: 0,    cap: 'the hood' },
  { n: 3, hood: HOODS[1],                           glow: '#7E6420',   halo: 0.35, cap: 'the eyes' },
  { n: 4, hood: HOODS[1],                           glow: GLOWS[1].c,  halo: 1,    cap: 'his colour' },
];

/** How many stages there are. The sheet's head counts against this. */
export const DRAFT_STAGE_COUNT = DRAFT_STAGES.length;

/**
 * Answers landed → the stage he is at.
 *
 * Clamped at both ends: nought answers is still stage 1 (he is a silhouette
 * from the moment the sheet opens, not an empty box that pops into existence on
 * the first reply), and a draft that runs long stays at stage 4 rather than
 * indexing off the end. A conversation is allowed to be longer than four turns;
 * he is simply finished forming before it ends.
 */
export function draftStage(answers = 0) {
  const n = Number.isFinite(answers) ? Math.floor(answers) : 0;
  return Math.max(1, Math.min(DRAFT_STAGE_COUNT, n + 1));
}

/**
 * Him, forming.
 *
 * `stage` is 1–4. `size` is the ghost's, and the halo is drawn at twice it —
 * the ref's radial gradient, at the ref's two strengths.
 */
export function FormingGhost({ stage = 1, size = 104 }) {
  const s = DRAFT_STAGES[Math.max(0, Math.min(DRAFT_STAGE_COUNT - 1, stage - 1))];
  const halo = s.halo ? (s.halo > 0.6 ? '26' : '12') : '00';
  return (
    <div className="draft-forming" data-stage={s.n} data-testid="draft-forming">
      <span
        className="draft-forming__halo"
        style={{
          width: size * 2,
          height: size * 2,
          background: `radial-gradient(circle, ${GLOWS[1].c}${halo}, transparent 66%)`,
        }}
        aria-hidden
      />
      <span className="draft-forming__body" style={{ opacity: s.n === 1 ? 0.8 : 1 }}>
        <MoodGhost
          mood="neutral"
          accent={GLOWS[1].c}
          size={size}
          ring={false}
          hood={s.hood}
          glow={s.glow}
        />
      </span>
    </div>
  );
}
