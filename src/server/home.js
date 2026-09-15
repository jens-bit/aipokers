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
//      state at the same instant always does the same thing. A STATE that
//      overrides his habit (he is worn, he is broke, he is steaming, somebody
//      just fed him, he has just won) is a fact about him, not a random
//      flavour line, and nothing here consults a random number.
//
//      LIFE-1 CHANGED THE SECOND HALF OF THIS RULE, deliberately. It used to
//      read "his nature picks his idle habit and never changes it", and the
//      consequence of "never changes it" was a room that never changed:
//      a household of four came home to the same four poses it had been
//      holding since they were born. So TIME IS NOW AN INPUT. `now` arrives as
//      an argument like every other fact, the function is still pure, and the
//      same snapshot taken twice at the same instant still reads the same
//      twice — what it no longer does is read the same at 9pm as it did at
//      2pm. His nature still decides WHICH habits are his; it no longer
//      decides that he is stuck in one of them forever.
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

import { storedIdentity } from '../shared/identity.js';
import { bodyLevels } from '../shared/levels.js';   // LIFE-1 job 2
// LIFE-1: the one tilt threshold, owned by dips.js.
import { TILT_HEAT } from '../agent/dips.js';

// ── Where ───────────────────────────────────────────────────────────────────

import { homeTablePreview } from '../shared/homePreview.js';

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
  EATS:     'eats',       // LIFE-1: there is food in him or in front of him
  CELEBRATES: 'celebrates', // LIFE-1: he came home up and he is not over it
  SULKS:    'sulks',      // busted, or steaming — and he knows it
  SLEEPS:   'sleeps',     // worn — the day took it out of him
  WAITS:    'waits',      // there is a recap his owner has not read yet
  // Nature routines — the habits his nature gives him. LIFE-1: which of them
  // he is in right now is a function of the clock, not a constant.
  PACES:    'paces',
  READS:    'reads',
  SHUFFLES: 'shuffles',
  COUNTS:   'counts',
});

export const ROUTINE_LABELS = Object.freeze({
  [Routine.PLAYS]:      'in the home game',
  [Routine.TAPE]:       'in the tape room',
  [Routine.EATS]:       'eating',
  [Routine.CELEBRATES]: 'celebrating',
  [Routine.SULKS]:      'sulking',
  [Routine.SLEEPS]:     'asleep',
  [Routine.WAITS]:      'waiting by the door',
  [Routine.PACES]:      'pacing',
  [Routine.READS]:      'reading',
  [Routine.SHUFFLES]:   'shuffling',
  [Routine.COUNTS]:     'counting chips',
});

// LIFE-1 · THE IDLE ROTATION.
//
// The four idle habits are still the only four poses in the product, and his
// nature still owns his signature one. What changed is that a nature now names
// a CYCLE rather than a constant: his own habit in two of the four slots, and
// two neighbouring habits in the others. So a Hothead is mostly pacing, which
// is what a Hothead does, and is sometimes doing one of the two other things a
// restless man does with his hands — and a room of four is never a row of four
// identical poses held indefinitely.
//
// Two slots for the signature rather than three is the number that makes the
// room read as alive rather than as twitchy: he is in character half the time
// and recognisably himself the rest of it.
export const IDLE_CYCLE_BY_NATURE = Object.freeze({
  Hothead:   [Routine.PACES,    Routine.SHUFFLES, Routine.PACES,    Routine.COUNTS],
  Rock:      [Routine.READS,    Routine.COUNTS,   Routine.READS,    Routine.SHUFFLES],
  Shark:     [Routine.SHUFFLES, Routine.COUNTS,   Routine.SHUFFLES, Routine.PACES],
  Grinder:   [Routine.COUNTS,   Routine.READS,    Routine.COUNTS,   Routine.SHUFFLES],
  Professor: [Routine.READS,    Routine.PACES,    Routine.READS,    Routine.COUNTS],
  Showman:   [Routine.PACES,    Routine.READS,    Routine.PACES,    Routine.SHUFFLES],
  Gambler:   [Routine.SHUFFLES, Routine.PACES,    Routine.SHUFFLES, Routine.COUNTS],
  Sphinx:    [Routine.COUNTS,   Routine.PACES,    Routine.COUNTS,   Routine.READS],
});

// The nature that has not formed yet. Same shape, built on DEFAULT_ROUTINE.
export const DEFAULT_IDLE_CYCLE = Object.freeze([
  Routine.COUNTS, Routine.SHUFFLES, Routine.COUNTS, Routine.READS,
]);

// How long he stays in one idle habit. Ninety seconds is short enough that an
// owner who opens the app twice in an evening sees two different rooms, and
// long enough that a room somebody is actually looking at is not a flick-book.
export const IDLE_PHASE_MS = Number(process.env.IDLE_PHASE_MS ?? 90_000);

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
 *   3. fedAt       → EATS. LIFE-1. Placed directly under TAPE and above every
 *      standing condition for exactly TAPE's reason: you opened the fridge and
 *      handed him something a minute ago, and a man shown asleep with a
 *      sandwich in his hand makes the fridge look broken. It is the shortest
 *      routine in the list — see EATING_MS.
 *   4. celebrating → CELEBRATES. LIFE-1. He came home up and has not come down
 *      yet. Above SULKS because the same evening cannot earn both and the win
 *      is the louder of them; below EATS because the owner's own act outranks
 *      his mood.
 *   5. broke | tilted → SULKS. LIFE-1 widened this: it used to be broke alone,
 *      which meant the one state an owner most wants to SEE — he is steaming —
 *      was invisible the moment he stood up from the felt. Heat at or above
 *      SULK_HEAT is sulking; so is having no way to buy in.
 *   6. worn        → SLEEPS.
 *   7. unseenRecap → WAITS. Quietest of the four: it is a nudge, not a state.
 *   8. otherwise   → where his nature's idle cycle stands at this instant.
 *
 * `slot` is the room's doing, not his: homeStateMessage hands each body in a
 * household a different one so four idle agents are never in the same phase of
 * their cycles at the same moment. An agent asked about on his own gets slot 0
 * and is answered about honestly; nothing about a single agent's reading
 * depends on it.
 */
export function routineFor({
  id = null,
  nature = null,
  where = Where.HOME,
  atHomeTable = false,
  studying = false,
  broke = false,
  tilted = false,
  fedAt = null,
  celebrating = false,
  fatigue = 'fresh',
  unseenRecap = false,
  slot = 0,
  now = Date.now(),
} = {}) {
  if (where !== Where.HOME) return null;
  const key = routineKey({
    id, nature, atHomeTable, studying, broke, tilted, fedAt, celebrating,
    fatigue, unseenRecap, slot, now,
  });
  return { key, label: ROUTINE_LABELS[key] };
}

function routineKey({
  id, nature, atHomeTable, studying, broke, tilted, fedAt, celebrating,
  fatigue, unseenRecap, slot, now,
}) {
  if (atHomeTable) return Routine.PLAYS;
  if (studying) return Routine.TAPE;
  if (isEating(fedAt, now)) return Routine.EATS;
  if (celebrating) return Routine.CELEBRATES;
  if (broke || tilted) return Routine.SULKS;
  if (fatigue === 'worn') return Routine.SLEEPS;
  if (unseenRecap) return Routine.WAITS;
  return idleRoutine({ id, nature, slot, now });
}

// How long a snack keeps him busy. Two minutes: long enough that an owner who
// hands him something watches him eat it, short enough that "eating" is never
// the answer to "what has he been doing all afternoon".
export const EATING_MS = 120_000;

/** Is he eating right now? Pure; `fedAt` is epoch ms or null. */
export function isEating(fedAt, now = Date.now()) {
  const at = Number(fedAt);
  if (!Number.isFinite(at)) return false;
  const since = now - at;
  return since >= 0 && since < EATING_MS;
}

// The heat at which an idle agent reads as sulking. dips.js owns the number
// (it is the same line a tilted session is dipped at, and the same one
// wants.js raises the beer ask at); this is that number under the name this
// file's ladder uses, never a second copy of it.
export const SULK_HEAT = TILT_HEAT;

// How long a winning session keeps him celebrating. Five minutes — the length
// of a home game, deliberately: he is still going when the next one starts.
export const CELEBRATE_MS = 300_000;

/**
 * Did the evening he just finished go well enough that he is still enjoying
 * it? Pure. `pnl` is the session's chip result, `endedAt` when he stood up.
 */
export function isCelebrating({ pnl = null, endedAt = null, now = Date.now() } = {}) {
  const n = Number(pnl);
  if (!Number.isFinite(n) || n <= 0) return false;
  const at = Number(endedAt);
  if (!Number.isFinite(at)) return false;
  const since = now - at;
  return since >= 0 && since < CELEBRATE_MS;
}

/** The idle habit for a nature, in any of the shapes a nature is carried in. */
export function natureRoutine(nature) {
  const name = typeof nature === 'string' ? nature : nature?.name;
  return ROUTINE_BY_NATURE[name] ?? DEFAULT_ROUTINE;
}

/** His nature's cycle, in any of the shapes a nature is carried in. */
export function idleCycle(nature) {
  const name = typeof nature === 'string' ? nature : nature?.name;
  return IDLE_CYCLE_BY_NATURE[name] ?? DEFAULT_IDLE_CYCLE;
}

// A small stable integer from an id. Not a hash with any property worth
// naming — it exists so two agents of the same nature are not permanently in
// step with each other, and `slot` is what GUARANTEES a household is not. An
// agent with no id gets 0, the honest answer for a body not told who it is.
export function idOffset(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 104729;
  return h;
}

/**
 * Which of his nature's habits he is in right now.
 *
 * Pure, and TOTAL — every nature has a cycle and every cycle has four slots,
 * so this always names one of the four poses the client can already draw.
 */
export function idleRoutine({ id = null, nature = null, slot = 0, now = Date.now() } = {}) {
  const cycle = idleCycle(nature);
  const n = cycle.length;
  const phase = Math.floor(Number(now) / IDLE_PHASE_MS);
  const step = Number.isFinite(phase) ? phase : 0;
  const slotN = Number(slot);
  const offset = idOffset(id) + (Number.isFinite(slotN) ? slotN : 0);
  const i = (((step + offset) % n) + n) % n;
  return cycle[i];
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
export function locationFor({ presence = 'resting', tableId = null, room = null, headingTo = null } = {}) {
  if (presence === 'playing' && tableId) {
    return { where: Where.TABLE, tableId: String(tableId), room: room ?? null };
  }
  // He has a table but it is not dealing him in: he is at the casino, between
  // the door and a seat.
  //
  // SERVER-4: and the room he is between the door and a seat IN is now
  // answerable. A queued agent has a table id and no table — the felt does not
  // exist until an opponent turns up — so the derived room was null and the
  // card had to say "at the casino" and nothing else. `headingTo` is the rung
  // the deploy or the queue was FOR, remembered at that moment because it is
  // the one thing about a walk that cannot be recomputed once it has started.
  // It is strictly a fallback: a live table always wins, so this can never be
  // the stale flag rule 1 exists to forbid — the only case it answers is the
  // one where nothing else can.
  if (tableId) {
    return { where: Where.CASINO, tableId: String(tableId), room: room ?? headingTo ?? null };
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
 *
 * SERVER-4 added two more things to it, both for the same reason — the HOME
 * screen was having to ask a second route for something it draws on the first
 * paint:
 *
 *   thread  { unreadSince } — the room's own unread marker (see below)
 *   fridge  { beer, snack } — what is on the shelves, so the flat can draw a
 *           full or an empty fridge without a second call
 */
export function homeStateMessage(userId, agents, game = null, { thread = null, fridge = null, visitor = null, now = Date.now() } = {}) {
  return {
    userId: String(userId ?? 'anon'),
    // LIFE-1: the room, not the man, decides that two people are not doing the
    // identical thing in the identical way. See spreadIdleRoutines.
    agents: spreadIdleRoutines((agents ?? []).map((agent) => homeAgentProjection(agent, { now })), { now }),
    game: game ?? null,
    // SERVER-4: the room thread's unread marker, exactly parallel to an
    // agent's `unseenRecap` and deliberately NOT a boolean — `unreadSince` is
    // the ts of the oldest line he has not looked at, which is what lets the
    // client say "3 lines since 21:40" rather than only that there is a dot.
    // null means nothing is waiting.
    thread: { unreadSince: thread?.unreadSince ?? null },
    fridge: fridgeCounts(fridge),
    // VISIT-1: somebody is at the door, waiting on an answer. null the rest of
    // the time — see visit.js, the only writer of this shape.
    visitor: visitor ?? null,
  };
}

// LIFE-1 · THE ROOM'S OWN RULE: not everybody at once.
//
// routineFor answers about ONE agent and cannot see the others, so on its own
// it will happily put a household of four Rocks in four identical reading
// poses — which is the thing the playtest actually complained about ("every
// time I come home they just stand around"). The fix belongs here, at the one
// place the whole room is in hand.
//
// Only IDLE routines are moved. A state routine is a fact — two agents who are
// both worn are both asleep, and shuffling one of them awake to make the
// picture livelier would be a lie about him. Idle habits are the ones where
// nothing is at stake, so they are the ones allowed to give way.
//
// Greedy and in roster order: the first idle body keeps what he had, and each
// one after him steps through his own cycle until he lands on a habit nobody
// before him is in. A cycle carries three distinct habits, so up to three idle
// agents are always doing three different things; a fourth may double up with
// somebody, which is what a room of four people actually looks like. Nothing
// here can produce a habit that is not already in that agent's own cycle.
export function spreadIdleRoutines(projections, { now = Date.now() } = {}) {
  const list = Array.isArray(projections) ? projections : [];
  const taken = new Set();
  for (const p of list) {
    const key = p?.routine?.key;
    if (!key || !IDLE_KEYS.has(key)) continue;
    if (!taken.has(key)) { taken.add(key); continue; }
    const cycle = idleCycle(p.nature);
    let moved = null;
    for (let slot = 1; slot < cycle.length; slot++) {
      const next = idleRoutine({ id: p.id, nature: p.nature, slot, now });
      if (!taken.has(next)) { moved = next; break; }
    }
    // Every habit in his cycle is already in the room: he keeps his own. Two
    // people reading is a room; forcing a fourth pose that is not his would be
    // inventing a character trait to fill a gap in a picture.
    if (moved === null) { taken.add(key); continue; }
    p.routine = { key: moved, label: ROUTINE_LABELS[moved] };
    taken.add(moved);
  }
  return list;
}

// The four keys the spread is allowed to move. Derived from Routine rather
// than written out, so a fifth idle pose cannot be added without this set
// learning about it.
const IDLE_KEYS = new Set([Routine.PACES, Routine.READS, Routine.SHUFFLES, Routine.COUNTS]);

// The counts only. Prices and labels are GET /api/fridge's job — they never
// change, so pushing them down a live socket on every home change would be
// the same three constants over and over.
function fridgeCounts(fridge) {
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
  return { beer: n(fridge?.beer), snack: n(fridge?.snack) };
}

// The one birthday, whichever name the record kept it under. Old records have
// `createdAt` and nothing else; the birth path writes both. Resolved ONCE here
// so `bornAt` and `newborn` can never disagree about the same agent — a card
// that carries a birth time and says he is not new is a bug the client cannot
// see the cause of.
function bornAtOf(agent) {
  for (const v of [agent?.bornAt, agent?.createdAt]) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function homeAgentProjection(agent, { now = Date.now() } = {}) {
  const bornAt = bornAtOf(agent);
  const identity = storedIdentity(agent);
  return {
    id: agent.id,
    name: agent.name,
    // Visitors have no row in the host's REST roster to supply their look.
    // Carry only recognized public palette IDs, never arbitrary stored data.
    ...(identity ? { identity: { hood: identity.hood.id, glow: identity.glow.id } } : {}),
    nature: agent.nature?.name ?? null,
    mood: agent.mood ?? null,
    location: agent.location ?? null,
    routine: agent.routine ?? null,
    fatigue: agent.fatigue ?? 'fresh',
    // LIFE-1 job 2: the same three-state pair the agent view and the felt
    // carry. Forwarded from the presented record rather than recomputed — this
    // module knows about no profile (rule 3) and a second derivation is a
    // second chance for the room and the card to disagree about one agent.
    body: agent.body ?? bodyLevels({ stage: agent.fatigue ?? 'fresh', heat: agent.mood?.heat ?? null }),
    unseenRecap: !!agent.unseenRecap,
    // LIFE-2 job 1: what he is asking for, over his head in the room.
    //
    // FORWARDED, never recomputed — rule 3 of this file's header, and the same
    // reason `body` two lines up is forwarded. agentProfiles.wantView is the one
    // reading of his want; a second derivation here would be a second chance for
    // the room and the agent card to put different words in the same mouth.
    //
    // Three fields and no more. The card needs the price, the stock, the
    // snooze and whether the shelf is empty; a bubble over a body needs the
    // sentence, the verb behind it, and the kind to draw the right icon with.
    // A visitor's projection carries no want at all — he is not yours to feed.
    want: agent.want && !agent.guest
      ? { kind: agent.want.kind, text: agent.want.text, action: agent.want.action ?? null }
      : null,
    study: agent.study ?? null,
    // BUG-168: a live TV picture can ride Home's existing pushes. This is
    // deliberately public even for owner/visitor input; no heroHole or reads.
    liveGame: homeTablePreview(agent.liveGame),
    homeTableId: agent.homeTableId ?? null,
    // VISIT-1: is this body somebody else's agent, standing in for a session in
    // this flat? Never stored on a resident's own record — only on the
    // synthetic projection visit.js hands homeSnapshot for the DURATION of the
    // stay — so a client that has never heard of visiting draws every home
    // exactly as before.
    guest: !!agent.guest,
    // VISIT-1: the other half, on the RESIDENT'S own record — he is out at
    // somebody else's kitchen table. `hostName` is the only fact worth a line
    // ("visiting River Rat's place"); the id and the stake are the server's
    // business.
    visiting: agent.visiting ? { hostName: agent.visiting.hostName ?? null } : null,
    // SERVER-4 / BUG-32: when he was made, and whether that was a moment ago.
    // The flat draws a newborn differently for his first minute — standing in
    // the doorway with his bag, not yet part of the furniture — and it used to
    // work that out from `createdAt`, which the birth path never actually
    // wrote, so every agent read as a minute old forever or as nothing at all.
    //
    // `newborn` is computed HERE, on the server's clock, so a phone eleven
    // minutes fast cannot miss the arrival; `bornAt` rides along beside it so a
    // client that got a snapshot from an older server can still work it out for
    // itself, and `createdAt` is the same number under the older name, so a
    // client already deriving the window from `createdAt < 60s` keeps working.
    bornAt,
    createdAt: bornAt,
    newborn: isNewborn({ bornAt }, { now }),
  };
}
