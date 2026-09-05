// client/src/lib/pace.test.jsx — W5-1
//
// The pacing queue, as arithmetic. Playtest verdict on WATCH-4: "too stiff, no
// time to react, folds don't feel like anything." The felt was correct and
// unwatchable, so the client plays the table back instead of mirroring it.
//
// Everything here is pure: the queue is handed a `now` and asked what should be
// on screen, which is what makes a 1.5-second beat testable in a millisecond.
// hooks/usePacedTable.test.jsx covers the clock that drives it.

import { describe, expect, it } from 'vitest';

import {
  DWELL_MS, LAG_LIMIT_MS, CATCHUP_RATE, SHOWDOWN_HOLD_MS, CEREMONY_MS,
  stepOf, dwellOf, createQueue, pushFrame, advance, nextWaitMs, behindMs,
} from './pace.js';

// A snapshot in the shape the wire delivers, trimmed to the fields the queue
// reads. Three seats, hero at 0.
function snap(over = {}) {
  return {
    handNumber: 1,
    street: 'flop',
    community: ['5c', '4h', '8c'],
    currentBet: 0,
    pot: 100,
    toAct: 1,
    result: null,
    seats: [
      { folded: false, contribThisStreet: 0 },
      { folded: false, contribThisStreet: 0 },
      { folded: false, contribThisStreet: 0 },
    ],
    ...over,
  };
}

function withSeat(base, i, over) {
  return { ...base, seats: base.seats.map((s, j) => (j === i ? { ...s, ...over } : s)) };
}

const frame = (game) => ({ game, lastDecision: null, paceFrame: null, chatMessages: null });

describe('W5-1: reading the step off two snapshots', () => {
  it('calls the first snapshot a deal, because there is nothing to pace against', () => {
    expect(stepOf(null, snap())).toEqual({ kind: 'deal', seat: null });
  });

  it('calls a new hand number a deal', () => {
    expect(stepOf(snap(), snap({ handNumber: 2 }))).toEqual({ kind: 'deal', seat: null });
  });

  it('names a fold, and who folded', () => {
    const before = snap();
    expect(stepOf(before, withSeat(before, 2, { folded: true })))
      .toEqual({ kind: 'fold', seat: 2 });
  });

  it('tells a bet from a raise by what the price already was', () => {
    const before = snap();
    const bet = { ...withSeat(before, 1, { contribThisStreet: 40 }), currentBet: 40 };
    expect(stepOf(before, bet)).toEqual({ kind: 'bet', seat: 1 });

    const raise = { ...withSeat(bet, 2, { contribThisStreet: 120 }), currentBet: 120 };
    expect(stepOf(bet, raise)).toEqual({ kind: 'raise', seat: 2 });
  });

  it('calls money that does not move the price a call', () => {
    const bet = { ...snap({ currentBet: 40 }), seats: snap().seats };
    const called = withSeat(bet, 2, { contribThisStreet: 40 });
    expect(stepOf(bet, called)).toEqual({ kind: 'call', seat: 2 });
  });

  it('calls the action moving with no money a check', () => {
    expect(stepOf(snap({ toAct: 1 }), snap({ toAct: 2 })))
      .toEqual({ kind: 'check', seat: 1 });
  });

  it('calls a longer board a street', () => {
    expect(stepOf(snap(), snap({ community: ['5c', '4h', '8c', 'Kd'] })))
      .toEqual({ kind: 'street', seat: null });
  });

  // The terminal STATE carries the last action, the reveal and the result in
  // one commit, so it must not be read as whatever the action happened to be.
  it('calls a settled hand a showdown, whatever else changed on that frame', () => {
    const before = snap();
    const done = {
      ...withSeat(before, 2, { folded: true }),
      street: 'complete',
      result: { pot: 400, winners: [{ seat: 0 }] },
    };
    expect(stepOf(before, done)).toEqual({ kind: 'showdown', seat: null });
  });

  it('says nothing happened when nothing did', () => {
    expect(stepOf(snap(), snap({ pot: 100 }))).toEqual({ kind: 'none', seat: null });
  });
});

describe('W5-1: the beat', () => {
  it('is the brief’s table', () => {
    expect(dwellOf('bet')).toBe(1200);
    expect(dwellOf('raise')).toBe(1200);
    expect(dwellOf('call')).toBe(1200);
    expect(dwellOf('check')).toBe(900);
    expect(dwellOf('fold')).toBe(1500);
    expect(dwellOf('street')).toBe(1800);
    expect(dwellOf('showdown')).toBe(4000);
  });

  it('gives a fold the longest beat at the table that is not a showdown', () => {
    const others = ['bet', 'raise', 'call', 'check', 'deal', 'none'];
    for (const k of others) expect(DWELL_MS.fold).toBeGreaterThan(dwellOf(k));
  });

  // The ceremony runs inside the showdown's dwell, not after it, so the next
  // deal lands as the block leaves rather than a beat behind it.
  it('spends the showdown’s four seconds on the hold and the ceremony', () => {
    expect(SHOWDOWN_HOLD_MS + CEREMONY_MS).toBe(DWELL_MS.showdown);
    expect(CEREMONY_MS).toBe(3000);
  });

  it('waits for nothing it does not recognise', () => {
    expect(dwellOf('sneeze')).toBe(0);
  });
});

describe('W5-1: the queue', () => {
  it('shows the first snapshot at once — an opening felt never waits', () => {
    const q = createQueue(null, 0);
    pushFrame(q, frame(snap()), 0);
    expect(q.shown.game.handNumber).toBe(1);
    expect(q.pending).toHaveLength(0);
  });

  it('holds the next action for the dwell of the one on screen', () => {
    const first = snap();
    const q = createQueue(frame(first), 0);
    q.dwell = DWELL_MS.fold;                       // a fold is what is on screen

    const folded = withSeat(first, 2, { folded: true });
    pushFrame(q, frame(folded), 10);

    expect(advance(q, 1000)).toBe(false);
    expect(q.shown.game).toBe(first);
    expect(advance(q, 1500)).toBe(true);
    expect(q.shown.game).toBe(folded);
  });

  it('does not delay a snapshot that arrives after the beat has been served', () => {
    const first = snap();
    const q = createQueue(frame(first), 0);
    q.dwell = DWELL_MS.check;

    const next = snap({ toAct: 2 });
    pushFrame(q, frame(next), 5000);
    expect(advance(q, 5000)).toBe(true);
    expect(q.shown.game).toBe(next);
    expect(behindMs(q, 5000)).toBe(0);
  });

  it('says how far behind live it is running, by the age of the oldest unplayed frame', () => {
    const q = createQueue(frame(snap()), 0);
    q.dwell = DWELL_MS.fold;
    pushFrame(q, frame(snap({ toAct: 2 })), 100);
    expect(behindMs(q, 100)).toBe(0);
    expect(behindMs(q, 2600)).toBe(2500);
  });

  it('is empty, and therefore not behind at all, once it has drained', () => {
    const q = createQueue(frame(snap()), 0);
    pushFrame(q, frame(snap({ toAct: 2 })), 0);
    advance(q, 10000);
    expect(q.pending).toHaveLength(0);
    expect(behindMs(q, 10000)).toBe(0);
  });

  // The whole point of a floor rather than a schedule: catching up matters more
  // than the beat once the spectator is watching history.
  it('drains at 2x only once it is more than 12s behind', () => {
    const first = snap();
    const q = createQueue(frame(first), 0);
    q.dwell = DWELL_MS.street;                     // 1800

    pushFrame(q, frame(snap({ community: ['5c', '4h', '8c', 'Kd'] })), 0);
    // Under the limit: the full dwell stands.
    expect(nextWaitMs(q, 0)).toBe(1800);

    // A queue head that has been waiting past the limit halves it, so what is
    // on screen has already outstayed the shortened dwell.
    const late = LAG_LIMIT_MS + 1;
    expect(behindMs(q, late)).toBeGreaterThan(LAG_LIMIT_MS);
    expect(nextWaitMs(q, late)).toBe(0);
    expect(DWELL_MS.street / CATCHUP_RATE).toBe(900);
  });

  // A backlog is played back, not skipped: three actions that arrived together
  // are still three actions, and each gets its beat. Only real time drains the
  // queue, which is why an advance at a single instant releases one of them.
  it('plays a backlog back in order, one beat at a time', () => {
    const a = snap({ toAct: 1 });
    const b = snap({ toAct: 2 });
    const c = snap({ toAct: 0 });
    const q = createQueue(frame(a), 0);
    pushFrame(q, frame(b), 0);
    pushFrame(q, frame(c), 0);

    advance(q, 0);
    expect(q.shown.game).toBe(b);            // the first check, at once
    expect(q.pending).toHaveLength(1);

    expect(advance(q, 800)).toBe(false);     // the second waits out b's 900ms
    expect(advance(q, 900)).toBe(true);
    expect(q.shown.game).toBe(c);
    expect(q.pending).toHaveLength(0);
    expect(q.stats.released).toBe(2);
  });

  // Zero-dwell steps are the exception: a pot recount or a mood update is not
  // something anyone watches for, so a run of them does not cost a beat each.
  it('does not spend a beat on frames nobody is watching for', () => {
    const q = createQueue(frame(snap()), 0);
    pushFrame(q, frame(snap({ pot: 120 })), 0);
    pushFrame(q, frame(snap({ pot: 140 })), 0);
    expect(advance(q, 0)).toBe(true);
    expect(q.pending).toHaveLength(0);
    expect(q.shown.game.pot).toBe(140);
  });

  it('ignores a frame it has already been given', () => {
    const f = frame(snap());
    const q = createQueue(f, 0);
    pushFrame(q, f, 10);
    pushFrame(q, { ...f }, 20);        // same four fields, new wrapper
    expect(q.pending).toHaveLength(0);
  });

  it('has nothing to wait for when nothing is queued', () => {
    expect(nextWaitMs(createQueue(frame(snap()), 0), 0)).toBe(null);
  });
});
