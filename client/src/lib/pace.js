// WATCH v3 — the pacing ladder, client side.
//
// Pure and side-effect free: no imports, no DOM, no clock. The server owns the
// state; this module owns the names, the reading of them, and the defaults that
// keep the felt renderable while feature/pace is still being built.
//
// Server contract (all fields optional today):
//   game.pace       = 'calm' | 'heating' | 'allin' | 'showdown'   absent → calm
//   game.potBb      = the pot in big blinds at the moment it changed
//   game.heroEquity = a probability, 0..1, on every snapshot       absent → the
//                     client's last-known read for the hand (FIX-1g)
//   game.reads      = an array, one entry per opponent             absent → the
//                     "no read yet" panel. See lib/reads.js.
//
// And, off the PACE message rather than the snapshot:
//   { pace, potBb, board?, card? }   the staged runout during an all-in hold
//
// CALM → HEATING → ALL-IN → SHOWDOWN is a server-driven ladder, not a UI mode:
// the client is told which state it is in and never infers one. The ALL-IN hold
// exists only while a spectator is watching — unwatched, the hand resolves at
// machine speed — which is why the client may not manufacture it.

export const PACE_STATES = ['calm', 'heating', 'allin', 'showdown'];

// glow drives the inset shadow's spread; `heat` is the warm felt + fat ticker
// that CALM and SHOWDOWN do not get. Copied from design-refs/mood-watch3.jsx.
export const PACE = {
  calm: {
    key: 'calm', label: 'CALM', glow: 0, heat: false,
    note: 'default. Nothing about the felt asks for attention.',
  },
  heating: {
    key: 'heating', label: 'HEATING', glow: 0.5, heat: true,
    note: 'pot crossed the threshold. Felt warms, ticker grows, one haptic tap.',
  },
  allin: {
    key: 'allin', label: 'ALL-IN', glow: 1, heat: true,
    note: 'a 3–5s hold on his line before the runout. Spectator only.',
  },
  showdown: {
    key: 'showdown', label: 'SHOWDOWN', glow: 0.7, heat: false,
    note: 'cards flip one at a time, the reveal is held, then the pot slides.',
  },
};

/** The state the server put the table in. Anything unrecognised reads as calm. */
export function paceOf(game) {
  const p = game?.pace;
  return PACE_STATES.includes(p) ? p : 'calm';
}

export function paceMeta(game) {
  return PACE[paceOf(game)];
}

/** True while the felt is warm — the gold/red half of the ladder. */
export function isHeated(game) {
  return paceMeta(game).heat;
}

// The wire has carried equity as a 0..1 fraction since WV2-2, but a snapshot
// field could reasonably arrive as a percent. Accept both, the way the watch
// screen already does for a decision's equity.
export function toPct(equity) {
  const n = typeof equity === 'number' ? equity : parseFloat(equity);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

/**
 * The hero's share of the pot, for the rope under the board.
 *
 * Reads the snapshot first — feature/pace puts it on every frame, which is the
 * whole point of finding 2 — and falls back to whatever the client last learned
 * from a decision. Before the deal there is nothing to know: null, and the rope
 * sits dead centre rather than empty.
 */
export function heroEquityOf(game, fallback = null, heroSeat = 0) {
  const fromSnapshot = toPct(game?.heroEquity);
  if (fromSnapshot !== null) return fromSnapshot;

  const seat = Array.isArray(game?.seats) ? game.seats[heroSeat] : null;
  const fromSeat = toPct(seat?.equity);
  if (fromSeat !== null) return fromSeat;

  return toPct(fallback);
}

/**
 * How many board cards have landed.
 *
 * Everywhere but a showdown this is simply how many the server has dealt. On a
 * showdown the runout is revealed one card at a time, so the caller says how
 * many are face up and this clamps it to what actually exists.
 */
export function landedCount(game, revealed = null) {
  const dealt = Array.isArray(game?.community) ? game.community.length : 0;
  if (revealed == null) return dealt;
  return Math.max(0, Math.min(dealt, revealed));
}

/**
 * W3-5: the runout, as the server stages it.
 *
 * During a spectator-only all-in hold the PACE message carries the runout card
 * by card — `board` is what is visible so far and `card` is the one just turned
 * — while the STATE snapshot already holds the finished board. So the frame is
 * the truth about what is face up, and the client's own timer is only the
 * fallback for a server that is not staging (or a client whose container does
 * not forward the frames yet).
 *
 * Returns the number of cards face up, or null for "no frame, use the fallback".
 */
export function stagedCount(frame) {
  if (!frame) return null;
  if (Array.isArray(frame.board)) return frame.board.length;
  // A frame with a card but no board still means one more has landed; without
  // a board to count there is nothing to say, so defer to the fallback.
  return null;
}

// The fallback cadence, used only when the server is not staging the runout.
// One card every 450ms: five cards in 2.0s, the ww-ref's "≈ 2s reveal".
export const FLIP_MS = 450;

// ── W5-1 · the pacing queue ────────────────────────────────────────────────
//
// Playtest verdict on WATCH-4: "too stiff, no time to react, folds don't feel
// like anything." The felt was correct and unwatchable — the server resolves a
// hand as fast as the model answers and the client painted every frame the
// instant it arrived, so three actions could land inside 400ms and the
// spectator saw a jump cut instead of a hand.
//
// So the client plays the table back rather than mirroring it. Snapshots go
// into a queue and come out no faster than the beat below, which is a floor and
// not a schedule: a snapshot that arrives after its predecessor has already
// served its dwell is shown at once, and the queue is empty most of the time.
//
// The dwell belongs to the frame being SHOWN, not to the one waiting: an action
// holds the felt for its own length before the next thing is allowed on. That
// is what makes a fold feel like something — it is the longest beat at the
// table that is not a showdown.
//
// Pure, like the rest of this file: no DOM, no timers, no React. The caller
// supplies `now` and owns the clock. hooks/usePacedTable.js is that caller.

// The beat, in milliseconds. Every number here is the brief's.
export const DWELL_MS = {
  bet: 1200, raise: 1200, call: 1200,
  check: 900,
  fold: 1500,
  street: 1800,     // a street's cards turning over
  showdown: 4000,   // the reveal, the hold, and the quiet settle after it
  deal: 0,          // a new hand is not a beat to wait through
  none: 0,          // reads, moods, a pot recount — nothing anyone watches for
};

// The showdown's 4s is spent, not idle: the reveal is held, and then the hand
// SETTLES — the pot slides to the winner, his stack ticks to its new number, and
// a result toast comes and goes over his strip. The two add up to the dwell
// exactly, so the next deal lands the moment the felt is quiet again.
//
// WATCH-7 renamed the second half. It was CEREMONY_MS, because a WON/LOST block
// used to take the felt at the end of every hand; the playtest called that what
// it was — a session moment fired forty times a session — and the ceremony now
// belongs to SESSION_END alone. Nothing about the timing changed, only what
// happens inside it, and the name had to stop describing something that is no
// longer there.
export const SHOWDOWN_HOLD_MS = 1000;
export const SETTLE_MS = DWELL_MS.showdown - SHOWDOWN_HOLD_MS;   // 3000

// How long the result toast sits over his strip. Short on purpose: it is a
// receipt, not an announcement, and the next deal must never wait for it.
export const RESULT_TOAST_MS = 1500;

// The stack tick under it — the hero's number counting from what he had when
// the hand was dealt to what he has now, rather than jumping.
export const STACK_TICK_MS = 700;

// How far behind live the queue is allowed to fall before it stops savouring.
// Twelve seconds is roughly two unwatchably fast hands: past that the spectator
// is watching history, and catching up matters more than the beat.
export const LAG_LIMIT_MS = 12000;
export const CATCHUP_RATE = 2;

const COMPLETE = 'complete';   // Streets.COMPLETE, inlined to keep this pure.

function seatsOf(g) { return (g && Array.isArray(g.seats)) ? g.seats : []; }
function boardLen(g) { return (g && Array.isArray(g.community)) ? g.community.length : 0; }
function isSettled(g) { return !!(g && g.street === COMPLETE && g.result); }

/**
 * What happened between two snapshots.
 *
 * The wire does not name the step — STATE is a picture, not an event — so it is
 * read back off the two pictures. The DECISION message would name the hero's
 * action, but only the hero's, and the whole point of the dwell is that an
 * opponent's fold gets its beat too.
 *
 * @returns {{ kind: string, seat: number|null }} a key of DWELL_MS, and who did it
 */
export function stepOf(prev, next) {
  if (!next) return { kind: 'none', seat: null };
  if (!prev) return { kind: 'deal', seat: null };
  if (prev.handNumber !== next.handNumber) return { kind: 'deal', seat: null };

  // The hand ending outranks everything else on the same frame: the terminal
  // STATE carries the last action, the reveal and the result together.
  if (isSettled(next) && !isSettled(prev)) return { kind: 'showdown', seat: null };
  if (boardLen(next) > boardLen(prev)) return { kind: 'street', seat: null };

  const before = seatsOf(prev);
  const after  = seatsOf(next);

  for (let i = 0; i < after.length; i++) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) continue;
    if (!a.folded && b.folded) return { kind: 'fold', seat: i };
  }

  for (let i = 0; i < after.length; i++) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) continue;
    const put = (b.contribThisStreet || 0) - (a.contribThisStreet || 0);
    if (put <= 0) continue;
    const wasBet = (prev.currentBet || 0);
    const nowBet = (next.currentBet || 0);
    if (nowBet > wasBet) return { kind: wasBet > 0 ? 'raise' : 'bet', seat: i };
    return { kind: 'call', seat: i };
  }

  // Nobody put anything in and the action moved on: a check.
  if (prev.toAct != null && next.toAct !== prev.toAct) {
    return { kind: 'check', seat: prev.toAct };
  }

  return { kind: 'none', seat: null };
}

export function dwellOf(kind) {
  return Object.prototype.hasOwnProperty.call(DWELL_MS, kind) ? DWELL_MS[kind] : 0;
}

/**
 * A queue with the first frame already on screen.
 *
 * The first snapshot a viewer ever sees is never delayed — there is nothing to
 * pace against, and a spectator opening the screen must not stare at an empty
 * felt for a beat and a half.
 */
export function createQueue(frame = null, now = 0) {
  return {
    shown: frame || null,
    shownAt: now,
    dwell: 0,
    kind: frame ? 'deal' : 'none',
    pending: [],
    // How long the frame currently on screen waited in the queue before it was
    // shown — the answer to "how far behind live is the felt", and the one that
    // holds still between releases, which is what a readout needs.
    waitedMs: 0,
    // Diagnostics, for the report.
    stats: { released: 0, maxBehindMs: 0 },
  };
}

/** The newest frame the queue knows about, shown or not. */
function newestFrame(q) {
  return q.pending.length ? q.pending[q.pending.length - 1].frame : q.shown;
}

function sameFrame(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.game === b.game
    && a.lastDecision === b.lastDecision
    && a.chatMessages === b.chatMessages
    && a.paceFrame === b.paceFrame;
}

/**
 * Take a snapshot off the wire.
 *
 * `frame` is the whole bundle the screen renders from — the snapshot plus the
 * decision, the pace frame and the chat that arrived with it — so speech can
 * never appear a second before the action it was said about.
 */
export function pushFrame(q, frame, now) {
  if (!frame) return q;
  const prev = newestFrame(q);
  if (sameFrame(prev, frame)) return q;

  if (!q.shown && q.pending.length === 0) {
    q.shown = frame;
    q.shownAt = now;
    q.kind = 'deal';
    q.dwell = 0;
    return q;
  }

  const step = stepOf(prev ? prev.game : null, frame.game);
  q.pending.push({ frame: frame, kind: step.kind, seat: step.seat, at: now });
  return q;
}

/**
 * How far behind live the queue is running.
 *
 * The age of the OLDEST frame that has not been shown yet: if the head has been
 * waiting nine seconds, the spectator is nine seconds behind the table. Zero
 * when the queue is empty, which is where it sits for most of a hand.
 */
export function behindMs(q, now) {
  if (!q.pending.length) return 0;
  return Math.max(0, now - q.pending[0].at);
}

/** The dwell actually in force, halved while the queue is catching up. */
export function effectiveDwell(q, now) {
  return behindMs(q, now) > LAG_LIMIT_MS ? q.dwell / CATCHUP_RATE : q.dwell;
}

/**
 * Release every frame whose turn has come.
 *
 * @returns {boolean} whether what is on screen changed
 */
export function advance(q, now) {
  let changed = false;
  // Bounded by the queue length: each iteration shifts one frame off.
  for (let guard = q.pending.length; guard > 0; guard--) {
    if (!q.pending.length) break;
    if (now - q.shownAt < effectiveDwell(q, now)) break;
    const behind = behindMs(q, now);
    if (behind > q.stats.maxBehindMs) q.stats.maxBehindMs = behind;
    const item = q.pending.shift();
    q.shown = item.frame;
    q.shownAt = now;
    q.kind = item.kind;
    q.dwell = dwellOf(item.kind);
    q.waitedMs = behind;
    q.stats.released += 1;
    changed = true;
  }
  return changed;
}

/**
 * Milliseconds until the next frame may be shown, or null when nothing waits.
 * The caller sets one timer off this rather than polling.
 */
export function nextWaitMs(q, now) {
  if (!q.pending.length) return null;
  return Math.max(0, effectiveDwell(q, now) - (now - q.shownAt));
}

// ── SERVER-3 · the action clock ──────────────────────────────────────────────
// The server keeps the acting seat's deadline and puts it on every STATE:
// { seat, deadlineTs, totalMs }, deadlineTs in server epoch ms. Before this the
// client started its own clock on arrival — off by the network, and wrong again
// on a reconnect mid-think. Drawing a ring the server is not keeping is worse
// than drawing none, so a snapshot without a timer draws none.

/** How many whole seconds are left on a seat's clock, floored at 0. */
export function timerLeft(actionTimer, now) {
  if (!actionTimer || !Number.isFinite(actionTimer.deadlineTs)) return null;
  const t = Number.isFinite(now) ? now : Date.now();
  return Math.max(0, Math.ceil((actionTimer.deadlineTs - t) / 1000));
}

/** How far round the ring starts — the full length of that seat's clock. */
export function timerOf(actionTimer) {
  if (!actionTimer || !Number.isFinite(actionTimer.totalMs)) return null;
  return Math.max(1, Math.ceil(actionTimer.totalMs / 1000));
}
