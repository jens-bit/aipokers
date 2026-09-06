// client/src/components/home/routines.js — HOME-1
//
// What a routine LOOKS like. Ported from design-refs/mood-home.jsx (H_ROUTINE,
// NATURE_ROUTINE, routineFor).
//
// The server decides WHICH routine (src/server/home.js — nature picks the idle
// habit, state overrides it, and the ladder is its business). This file decides
// only how each one is drawn: which hand pose, which prop, whether his back is
// turned, and what he is animated doing. The split is deliberate and is the same
// one the mood layer already draws — the server owns the state, the client owns
// the body language.
//
// So there is NO second ladder here. `presentRoutine` reads `agent.routine.key`
// and looks it up. The nature fallback below exists for exactly one case: a
// server that predates HOME-STATE-1 and sends no routine at all. It is a
// last-ditch, not a parallel implementation, and it is the only place in this
// client that knows a Hothead paces.
//
// Naming: the server's keys are the vocabulary (plays | tape | sulks | sleeps |
// waits | paces | reads | shuffles | counts). The ref used its own shorter names
// (pace / paper / tv / game); those are gone rather than aliased, because two
// names for one routine is how a third one gets born.

// One entry per server routine key. Every field is optional except `label`.
//
//   pose   a GhostHands pose (client/src/components/system/GhostHands.jsx)
//   prop   a small object drawn beside him — paper | cards | chips | zzz
//   face   a FACE_EVENTS overlay, for the two routines that change his face
//   back   true = drawn as a silhouette with no face, facing the wall
//   anim   a CSS animation name from home.css, for a routine that MOVES
export const ROUTINES = {
  plays:    { label: 'in a hand',      pose: 'hold' },
  tape:     { label: 'the tape room',  pose: 'hold',   anim: 'home-lean' },
  sulks:    { label: 'facing the wall', pose: 'cover', back: true },
  // The eyes close. `bored` is the face the ref uses for sleep and it is the
  // one FACE_EVENTS entry that draws lids rather than a brow.
  sleeps:   { label: 'asleep',         pose: 'rest',   face: 'bored', prop: 'zzz' },
  waits:    { label: 'by the door',    pose: 'rest' },
  paces:    { label: 'pacing',         pose: 'clench', anim: 'home-pace' },
  reads:    { label: 'reading',        pose: 'hold',   prop: 'paper' },
  shuffles: { label: 'shuffling',      pose: 'push',   prop: 'cards', anim: 'home-shuffle' },
  counts:   { label: 'counting chips', pose: 'push',   prop: 'chips', anim: 'home-count' },
};

export const ROUTINE_KEYS = Object.keys(ROUTINES);

// The last-ditch only. See the header: this is not a second ladder, it is what
// an older server leaves us with.
const NATURE_FALLBACK = {
  Hothead: 'paces', Showman: 'paces',
  Rock: 'reads', Professor: 'reads', Sphinx: 'counts',
  Shark: 'shuffles', Gambler: 'shuffles',
  Grinder: 'counts',
};

const DEFAULT_KEY = 'counts';

/**
 * How to draw what this agent is doing.
 *
 * @returns {{ key, label, pose, prop, face, back, anim }} — never null, because
 *          a body in the room is always doing something. An agent who is not at
 *          home has no routine (the server sends null) and is not in the room at
 *          all; he is a frame on the wall, so nothing calls this for him.
 */
export function presentRoutine(agent) {
  const key = routineKeyOf(agent);
  const r = ROUTINES[key] ?? ROUTINES[DEFAULT_KEY];
  return { key, ...r };
}

export function routineKeyOf(agent) {
  const served = agent?.routine?.key;
  if (served && ROUTINES[served]) return served;
  const nature = typeof agent?.nature === 'string' ? agent.nature : agent?.nature?.name;
  return NATURE_FALLBACK[nature] ?? DEFAULT_KEY;
}

/** Is he doing something that takes him out of the home game? */
export function isBusy(agent) {
  const key = routineKeyOf(agent);
  return key === 'tape' || key === 'sleeps';
}
