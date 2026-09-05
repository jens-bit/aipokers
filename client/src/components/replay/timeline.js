// REPLAY-1 (R-1) — the authored timeline.
//
// Most hands happen while nobody watches. A flagged hand becomes the same
// theatre Watch v3 built — PaceFelt, TugBar, HeroRow3 — driven by this timeline
// instead of by the server. 20–40 seconds, scrubbable.
//
// Nothing here invents a beat that is not in the stored hand: every line is his
// own reasoning, every equity is the one the server computed at the time, and
// the board at each step is the board that was out. What IS authored is the
// clock — how long each street holds — because the stored hand has no timing in
// it and the ref's whole point is that the beats land where the tension is.
//
// Input is one entry from GET /api/agents/:id/flagged, built by
// src/server/flaggedHands.js buildFlaggedEntry:
//   { flagType, handNumber, pot, holeCards, opponentShowdownCards, won,
//     streets: [{ street, board, action, equity, potOdds, reasoning }],
//     attrCosts?: [{ key, line, street? }], flaggedAt }
//
// WHAT THE SERVER DOES NOT STORE, and what this has to approximate:
//   · the pot at each street — only the final pot is kept, so the ticker is
//     rebuilt by accumulating the amounts parsed out of the action strings and
//     is pinned to the real figure on the last beat. A lower bound that ends
//     exact, not a fabrication.
//   · whether an action was all-in — inferred from the action string, so a jam
//     recorded as "raise 1847" plays as a raise and the hold never fires.
//   · the big blind — the pacing ladder's HEATING threshold is 12x the big
//     blind server-side; here it is a share of the hand's own final pot.
//   · a per-street timestamp — the clock below is authored, not replayed.
//
// Pure and side-effect free.

export const FLAGS = {
  bigBluff: { key: 'bigBluff', label: 'BIG BLUFF', tone: 'gold' },
  badBeat: { key: 'badBeat', label: 'BAD BEAT', tone: 'red' },
  cooler: { key: 'cooler', label: 'COOLER', tone: 'purple' },
  heroCall: { key: 'heroCall', label: 'HERO CALL', tone: 'teal' },
  biggestPot: { key: 'biggestPot', label: 'BIGGEST POT', tone: 'gold' },
};

// Authored durations, in seconds. The runout gets the same 3–5s hold a live
// spectator gets and the reveal is held after it — the ALL-IN hold and the
// showdown reveal are the same beats Watch v3 plays, replayed.
export const BEAT_S = {
  preflop: 3.5,
  street: 6,
  allin: 5,
  reveal: 4,
  end: 3,
};

const STREET_LABEL = {
  preflop: 'PRE',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
};

// Once the pot has passed this share of where it ends up, the felt is warm.
// Server-side the ladder uses 12x the big blind; the stored hand has no blinds.
const HEAT_SHARE = 0.35;

const round1 = (n) => Math.round(n * 10) / 10;

// The ladder only ever advances — src/server/pace.js advancePace() is the rule
// server-side, and a replay that cooled back down after an all-in would be
// telling a different story than the one that was played.
const PACE_RANK = { calm: 0, heating: 1, allin: 2, showdown: 3 };
const advance = (from, to) => (PACE_RANK[to] > PACE_RANK[from] ? to : from);

/** The amount committed by an action string — "raise 120" → 120. */
export function actionAmount(action) {
  const found = /(-?\d[\d,]*)/.exec(String(action ?? ''));
  if (!found) return 0;
  const n = Number(found[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Whether an action string reads as a stack going in. */
export function isAllIn(action) {
  return /\ball[\s-]?in\b|\bjam\b|\bshove\b/i.test(String(action ?? ''));
}

function streetKey(street) {
  const s = String(street ?? '').toLowerCase();
  return STREET_LABEL[s] ? s : 'preflop';
}

/**
 * The beats, in order, with a clock on them.
 *
 * @returns {{
 *   flag: { key, label, tone },
 *   handNumber: number|null,
 *   pot: number,
 *   won: boolean,
 *   holeCards: string[],
 *   beats: Array<{
 *     key, label, at, seconds, pace, board, flip, equity, pot, line, action,
 *     attrCosts: Array<{ key, line }>,
 *   }>,
 *   total: number,
 * }}
 */
export function buildTimeline(hand) {
  const streets = Array.isArray(hand?.streets) ? hand.streets : [];
  const finalPot = Number.isFinite(hand?.pot) ? hand.pot : 0;
  const flag = FLAGS[hand?.flagType] ?? FLAGS.biggestPot;

  // attrCosts land at their street; anything without one rides the last beat,
  // where the hand is over and there is room to read it.
  const costs = Array.isArray(hand?.attrCosts) ? hand.attrCosts.filter((c) => c?.key && c?.line) : [];
  const costsFor = (street) => costs.filter((c) => streetKey(c.street) === street && c.street);
  const looseCosts = costs.filter((c) => !c.street);

  const beats = [];
  let at = 0;
  let running = 0;
  let lastBoard = [];
  let pace = 'calm';

  streets.forEach((s, i) => {
    const street = streetKey(s.street);
    const board = Array.isArray(s.board) ? s.board : lastBoard;
    lastBoard = board;

    running += actionAmount(s.action);
    // The running total is a lower bound rebuilt from the actions; the last
    // street is pinned to the pot the server actually recorded.
    const isLast = i === streets.length - 1;
    const pot = isLast ? Math.max(running, finalPot) : Math.min(running, finalPot);

    const jam = isAllIn(s.action);
    const seconds = jam ? BEAT_S.allin : (street === 'preflop' ? BEAT_S.preflop : BEAT_S.street);
    const heated = finalPot > 0 && pot >= finalPot * HEAT_SHARE;
    pace = advance(pace, jam ? 'allin' : (heated ? 'heating' : 'calm'));

    beats.push({
      key: `${street}-${i}`,
      label: jam ? 'ALL-IN' : STREET_LABEL[street],
      at: round1(at),
      seconds,
      pace,
      board,
      flip: board.length,
      equity: Number.isFinite(s.equity) ? s.equity : null,
      pot,
      line: typeof s.reasoning === 'string' && s.reasoning ? s.reasoning : null,
      action: s.action ?? null,
      attrCosts: costsFor(street),
    });
    at += seconds;
  });

  // The reveal. Cards are on the table, the pot has been decided, and his
  // equity is no longer a question — it is 100 or 0.
  const showdown = Array.isArray(hand?.opponentShowdownCards) && hand.opponentShowdownCards.length > 0;
  const finalBoard = lastBoard;
  beats.push({
    key: 'end',
    label: 'END',
    at: round1(at),
    seconds: showdown ? BEAT_S.reveal : BEAT_S.end,
    pace: 'showdown',
    board: finalBoard,
    flip: finalBoard.length,
    equity: hand?.won ? 100 : 0,
    pot: finalPot,
    line: null,
    action: null,
    attrCosts: looseCosts,
  });
  at += showdown ? BEAT_S.reveal : BEAT_S.end;

  return {
    flag,
    handNumber: Number.isFinite(hand?.handNumber) ? hand.handNumber : null,
    pot: finalPot,
    won: !!hand?.won,
    holeCards: Array.isArray(hand?.holeCards) ? hand.holeCards : [],
    opponentShowdownCards: Array.isArray(hand?.opponentShowdownCards) ? hand.opponentShowdownCards : [],
    beats,
    total: round1(at),
  };
}

/** The beat playing at `t` seconds. Never null for a timeline with beats. */
export function beatAt(timeline, t) {
  const beats = timeline?.beats ?? [];
  if (beats.length === 0) return null;
  const clamped = Math.max(0, Math.min(timeline.total, t));
  for (let i = beats.length - 1; i >= 0; i--) {
    if (clamped >= beats[i].at) return beats[i];
  }
  return beats[0];
}

/** Its index, for the scrubber's ticks. */
export function beatIndexAt(timeline, t) {
  const beat = beatAt(timeline, t);
  return beat ? timeline.beats.indexOf(beat) : -1;
}
