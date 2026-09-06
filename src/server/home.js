// src/server/home.js — HOME-STATE-1
//
// Where he is, and what he is doing there.
//
// The floor answers "is he playing". That was enough while the only two
// answers were PLAYING and RESTING, and it is why the HOME screen (board 29)
// could not be built: a Tamagotchi that is either at work or a grey card is
// not a companion, it is a status light. So an agent now has a LOCATION and,
// when he is home, a ROUTINE — the small thing he is doing while nobody is
// watching him do it.
//
// Three rules the shape of this file comes from:
//
//   1. LOCATION IS DERIVED, NEVER DECLARED. `where` is read off the live table
//      registry every time it is asked for, exactly as `presence` is — the
//      stale stored flag is what made the floor lie about frozen tables
//      (BUG-16), and a second stored flag would make the same lie twice. The
//      ONE thing that is remembered is `since`, because "when did he get
//      home" cannot be recomputed from anything.
//
//   2. THE ROUTINE IS A CONSEQUENCE, NOT A ROLL. The same agent in the same
//      state always does the same thing. His nature picks his idle habit and
//      never changes it — a Hothead paces because he is a Hothead — and a
//      STATE that overrides it (he is worn, he is broke, there is a recap he
//      has not read) is a fact about him, not a random flavour line. Nothing
//      here consults a clock or a random number, so the same snapshot taken
//      twice reads the same twice.
//
//   3. THIS MODULE KNOWS ABOUT NO TABLE AND NO PROFILE. Same law as
//      rooms.js and floorChannel.js: everything arrives as arguments and the
//      whole thing is testable with object literals. The snapshot that reaches
//      the wire is assembled in agentProfiles.js, where the agents live.
//
// The ROUTINE VOCABULARY IS CLOSED. A client switches on `key` and draws a
// pose; `label` is the same thing in words, for a screen that would rather
// print it. Adding a tenth verb means adding a pose, so the list is short on
// purpose.

// ── Where ───────────────────────────────────────────────────────────────────

export const Where = Object.freeze({
  // At home. Not seated anywhere, not on his way anywhere.
  HOME: 'home',
  // At the casino but not in a hand — he has a table but it is not dealing
  // him in yet, or it has just died under him and he has not got home.
  // Deliberately its own answer rather than being folded into `home`: an agent
  // who is out is out, and drawing him in the living room while his table
  // stands up is the same class of lie as BUG-16.
  CASINO: 'casino',
  // In a seat, in a game that is actually advancing hands.
  TABLE: 'table',
});

const WHERES = new Set(Object.values(Where));

// ── Routines ────────────────────────────────────────────────────────────────

export const Routine = Object.freeze({
  // State routines — what has happened to him wins over what he is like.
  PLAYS:    'plays',      // he is in the home game
  TAPE:     'tape',       // the tape room: he is studying a flagged hand
  SULKS:    'sulks',      // busted — no pocket, no casino, and he knows it
  SLEEPS:   'sleeps',     // worn — the session took it out of him
  WAITS:    'waits',      // there is a recap his owner has not read yet
  // Nature routines — his idle habit, fixed at birth.
  PACES:    'paces',
  READS:    'reads',
  SHUFFLES: 'shuffles',
  COUNTS:   'counts',
});

export const ROUTINE_LABELS = Object.freeze({
  [Routine.PLAYS]:    'in the home game',
  [Routine.TAPE]:     'in the tape room',
  [Routine.SULKS]:    'sulking',
  [Routine.SLEEPS]:   'asleep',
  [Routine.WAITS]:    'waiting by the door',
  [Routine.PACES]:    'pacing',
  [Routine.READS]:    'reading',
  [Routine.SHUFFLES]: 'shuffling',
  [Routine.COUNTS]:   'counting chips',
});

// His idle habit, by nature. Four habits, eight natures: the four the brief
// names are the anchors and the other four are placed against them by the
// attribute each nature is BUILT ON (see NATURES in src/agent/attributes.js),
// so nothing here is arbitrary and nothing needs a fifth pose drawn for it.
//
//   paces     the restless ones — DECEPTION up, COMPOSURE or READS down
//   reads     the studious ones — DISCIPLINE or FOCUS up
//   shuffles  the ones whose hands are busy — READS up, or DISCIPLINE down
//   counts    the still ones — STAMINA or COMPOSURE up
export const ROUTINE_BY_NATURE = Object.freeze({
  Hothead:   Routine.PACES,      // named in the brief
  Rock:      Routine.READS,      // named in the brief
  Shark:     Routine.SHUFFLES,   // named in the brief
  Grinder:   Routine.COUNTS,     // named in the brief
  Professor: Routine.READS,      // FOCUS up — the other one who reads
  Showman:   Routine.PACES,      // plays to a room; cannot sit still in an empty one
  Gambler:   Routine.SHUFFLES,   // DISCIPLINE down — his hands find the deck
  Sphinx:    Routine.COUNTS,     // COMPOSURE up — the other one who is still
});

// An agent whose nature has not formed yet (the record exists, the draft did
// not name one). Counting is the plainest of the four; it says nothing about
// him, which is correct, because nothing is known about him.
export const DEFAULT_ROUTINE = Routine.COUNTS;

/**
 * What he is doing at home.
 *
 * Returns { key, label } — or null when he is not home at all, because a
 * routine is a HOME thing and inventing one for a man in a seat would put two
 * contradictory answers on the same card.
 *
 * The ladder, in order, and why it is this order rather than the order the
 * brief lists it in:
 *
 *   1. atHomeTable → PLAYS. He is visibly in a chair with cards in front of
 *      him. Every other answer would be a second thing to draw him doing.
 *   2. studying    → TAPE. The owner started this, deliberately, ninety
 *      seconds ago. It outranks the conditions below for the same reason a
 *      deliberate act outranks a standing state: it is the only one of these
 *      he chose, and showing him asleep instead would make the button look
 *      broken.
 *   3. broke       → SULKS. He cannot buy in. It is the loudest fact about
 *      him and the one the owner can do something about.
 *   4. worn        → SLEEPS.
 *   5. unseenRecap → WAITS. Quietest of the four: it is a nudge, not a state.
 *   6. otherwise   → his nature's habit.
 */
export function routineFor({
  nature = null,
  where = Where.HOME,
  atHomeTable = false,
  studying = false,
  broke = false,
  fatigue = 'fresh',
  unseenRecap = false,
} = {}) {
  if (where !== Where.HOME) return null;
  const key = routineKey({ nature, atHomeTable, studying, broke, fatigue, unseenRecap });
  return { key, label: ROUTINE_LABELS[key] };
}

function routineKey({ nature, atHomeTable, studying, broke, fatigue, unseenRecap }) {
  if (atHomeTable) return Routine.PLAYS;
  if (studying) return Routine.TAPE;
  if (broke) return Routine.SULKS;
  if (fatigue === 'worn') return Routine.SLEEPS;
  if (unseenRecap) return Routine.WAITS;
  return natureRoutine(nature);
}

/** The idle habit for a nature, in any of the shapes a nature is carried in. */
export function natureRoutine(nature) {
  const name = typeof nature === 'string' ? nature : nature?.name;
  return ROUTINE_BY_NATURE[name] ?? DEFAULT_ROUTINE;
}

// ── Location ────────────────────────────────────────────────────────────────

/**
 * Where he is, derived. Nothing stored is consulted except through the
 * arguments, so this answers the same way for a caller holding a live registry
 * and for a test holding two booleans.
 *
 *   presence   'playing' | 'resting' | 'broke' — presentAgent's own answer,
 *              already derived from the live table
 *   tableId    his activeTableId, or null
 *   room       the stakes-tier room id his table is in (rooms.js), or null
 *
 * Returns { where, tableId, room } — WITHOUT `since`, which only stampLocation
 * can supply, because it is the one part of this that is remembered.
 */
export function locationFor({ presence = 'resting', tableId = null, room = null } = {}) {
  if (presence === 'playing' && tableId) {
    return { where: Where.TABLE, tableId: String(tableId), room: room ?? null };
  }
  // He has a table but it is not dealing him in: he is at the casino, between
  // the door and a seat. His table may already be gone, in which case the room
  // is unknown and says so rather than guessing at the floor.
  if (tableId) {
    return { where: Where.CASINO, tableId: String(tableId), room: room ?? null };
  }
  return { where: Where.HOME, tableId: null, room: null };
}

/**
 * Attach a derived location to the agent record, keeping `since`.
 *
 * `since` is the only remembered part, and it moves only when the answer to
 * "where is he" actually changes — arriving at a different table counts, the
 * same table dealing another hand does not. That is what lets a client print
 * "home, 40 minutes" instead of "home, 0 seconds" once a second.
 *
 * Mutates the agent, exactly as presentAgent already does for `fatigue`, and
 * returns the location it settled on.
 */
export function stampLocation(agent, next, { now = Date.now() } = {}) {
  const location = {
    where: WHERES.has(next?.where) ? next.where : Where.HOME,
    tableId: next?.tableId ?? null,
    room: next?.room ?? null,
    since: now,
  };
  const prev = agent?.location;
  const unchanged = prev
    && prev.where === location.where
    && (prev.tableId ?? null) === (location.tableId ?? null);
  if (unchanged && Number.isFinite(prev.since)) location.since = prev.since;
  if (agent) agent.location = location;
  return location;
}

/**
 * How long he has been where he is, in milliseconds. Zero rather than negative
 * for a `since` in the future (a clock that went backwards) — a card that
 * prints "home for -3 minutes" is worse than one that prints "just got in".
 */
export function timeAtLocation(location, { now = Date.now() } = {}) {
  const since = Number(location?.since);
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, now - since);
}

/** Is he home? The question three other modules ask, spelled once. */
export function isHome(location) {
  return location?.where === Where.HOME;
}

// ── Newborn ─────────────────────────────────────────────────────────────────

/**
 * BIRTH-5 / BUG-32 — how long after birth he still counts as having just
 * arrived.
 *
 * A minute, and the number matters less than the fact that there IS one. The
 * room walks a newborn in through the door instead of materialising him in a
 * chair, and that has to be a thing that stops being true: without a window,
 * every reconnect for the rest of his career would walk him in again, and an
 * arrival that happens every time is not an arrival.
 *
 * The window is also why the marker is a boolean on the wire rather than a
 * timestamp the client subtracts from its own clock. A phone whose clock is
 * eleven minutes fast would otherwise never see a birth at all.
 */
export const NEWBORN_MS = 60_000;

/**
 * Was this agent born a moment ago?
 *
 * False for anyone with no `bornAt`, which is every agent made before BIRTH-5
 * put the field on the record. That is the right answer for them: an agent who
 * has been in the room for a month did not just walk in, and guessing his age
 * out of his id would make the room replay a birth from March.
 */
export function isNewborn(agent, { now = Date.now() } = {}) {
  const born = Number(agent?.bornAt);
  if (!Number.isFinite(born)) return false;
  return now - born >= 0 && now - born < NEWBORN_MS;
}

// ── The wire ────────────────────────────────────────────────────────────────

/**
 * The HOME_STATE body. Assembled from an already-presented roster (so this
 * module still touches no profile) plus the home game, if one is running.
 *
 * Only the fields the HOME screen draws: this rides the same socket as
 * FLOOR_STATE and there is no reason to send a strategy prompt twice.
 */
export function homeStateMessage(userId, agents, game = null, { now = Date.now() } = {}) {
  return {
    userId: String(userId ?? 'anon'),
    agents: (agents ?? []).map((agent) => homeAgentProjection(agent, { now })),
    game: game ?? null,
  };
}

function homeAgentProjection(agent, { now = Date.now() } = {}) {
  return {
    id: agent.id,
    name: agent.name,
    nature: agent.nature?.name ?? null,
    mood: agent.mood ?? null,
    location: agent.location ?? null,
    routine: agent.routine ?? null,
    fatigue: agent.fatigue ?? 'fresh',
    unseenRecap: !!agent.unseenRecap,
    study: agent.study ?? null,
    // BUG-32: he was born a moment ago, so the room walks him in through the
    // door rather than drawing him already sitting down. Computed here, on the
    // server's clock, so a phone with a wrong clock cannot miss the arrival —
    // and `bornAt` rides along beside it so a client that got a snapshot from
    // an older server can still work it out for itself.
    bornAt: Number.isFinite(Number(agent.bornAt)) ? Number(agent.bornAt) : null,
    newborn: isNewborn(agent, { now }),
  };
}
