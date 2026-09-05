// src/server/pace.test.js — PACE-1

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PACE,
  PACE_ORDER,
  ALLIN_HOLD_MIN_MS,
  ALLIN_HOLD_MAX_MS,
  RUNOUT_CARD_MS,
  REVEAL_HOLD_MS,
  paceRank,
  potInBb,
  paceFor,
  advancePace,
  heatThresholdBb,
  allInHoldMs,
  seedFor,
  holdPlan,
  raiseFloor,
  raisesCapped,
  raiseCapPerStreet,
  minRaisePotFraction,
} from './pace.js';

function withHeat(bb, fn) {
  const prev = process.env.PACE_HEAT_BB;
  process.env.PACE_HEAT_BB = String(bb);
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.PACE_HEAT_BB;
    else process.env.PACE_HEAT_BB = prev;
  }
}

describe('the ladder', () => {
  it('is CALM → HEATING → ALL-IN → SHOWDOWN', () => {
    assert.deepEqual(PACE_ORDER, ['calm', 'heating', 'allin', 'showdown']);
    assert.equal(paceRank(PACE.CALM) < paceRank(PACE.HEATING), true);
    assert.equal(paceRank(PACE.HEATING) < paceRank(PACE.ALLIN), true);
    assert.equal(paceRank(PACE.ALLIN) < paceRank(PACE.SHOWDOWN), true);
  });

  it('only ever advances — a refund does not cool the felt', () => {
    assert.equal(advancePace(PACE.HEATING, PACE.CALM), PACE.HEATING);
    assert.equal(advancePace(PACE.ALLIN, PACE.HEATING), PACE.ALLIN);
    assert.equal(advancePace(PACE.SHOWDOWN, PACE.CALM), PACE.SHOWDOWN);
    assert.equal(advancePace(PACE.CALM, PACE.HEATING), PACE.HEATING);
  });

  it('treats an unknown state as the floor rather than throwing', () => {
    assert.equal(paceRank('nonsense'), 0);
    assert.equal(advancePace('nonsense', PACE.HEATING), PACE.HEATING);
  });
});

describe('potInBb', () => {
  it('divides the pot by the big blind', () => {
    assert.equal(potInBb(500, 20), 25);
    assert.equal(potInBb(30, 20), 1.5);
  });
  it('never divides by zero or by nonsense', () => {
    assert.equal(potInBb(500, 0), 0);
    assert.equal(potInBb(NaN, 20), 0);
    assert.equal(potInBb(500, null), 0);
  });
});

describe('paceFor', () => {
  it('is calm on a small pot', () => {
    assert.equal(paceFor({ potChips: 60, bigBlind: 20 }), PACE.CALM);
  });

  it('heats at exactly the threshold, in big blinds', () => {
    withHeat(25, () => {
      assert.equal(paceFor({ potChips: 20 * 25 - 1, bigBlind: 20 }), PACE.CALM);
      assert.equal(paceFor({ potChips: 20 * 25, bigBlind: 20 }), PACE.HEATING);
    });
  });

  it('takes the threshold from the environment', () => {
    withHeat(12, () => assert.equal(paceFor({ potChips: 240, bigBlind: 20 }), PACE.HEATING));
    withHeat(60, () => assert.equal(paceFor({ potChips: 240, bigBlind: 20 }), PACE.CALM));
    withHeat('nonsense', () => assert.equal(heatThresholdBb(), 25));
    withHeat(-4, () => assert.equal(heatThresholdBb(), 25));
  });

  it('is ALL-IN only once the action is closed', () => {
    // A seat is all-in but someone can still act: that is not the beat yet.
    assert.equal(paceFor({ potChips: 4000, bigBlind: 20, anyAllIn: true, actionClosed: false }), PACE.HEATING);
    assert.equal(paceFor({ potChips: 4000, bigBlind: 20, anyAllIn: true, actionClosed: true }), PACE.ALLIN);
  });

  it('is SHOWDOWN once the hand is revealed, whatever else is true', () => {
    assert.equal(paceFor({ potChips: 40, bigBlind: 20, revealed: true }), PACE.SHOWDOWN);
    assert.equal(paceFor({ potChips: 9000, bigBlind: 20, anyAllIn: true, actionClosed: true, revealed: true }), PACE.SHOWDOWN);
  });

  it('defaults to calm with no arguments at all', () => {
    assert.equal(paceFor(), PACE.CALM);
  });
});

describe('the all-in hold', () => {
  it('is 3–5 seconds', () => {
    for (let i = 0; i < 500; i++) {
      const ms = allInHoldMs(seedFor('t', i));
      assert.ok(ms >= ALLIN_HOLD_MIN_MS && ms <= ALLIN_HOLD_MAX_MS, `${ms} out of range`);
    }
  });

  it('is deterministic for a table and hand', () => {
    assert.equal(allInHoldMs(seedFor('table-7', 12)), allInHoldMs(seedFor('table-7', 12)));
    assert.notEqual(seedFor('table-7', 12), seedFor('table-7', 13));
  });

  it('varies across hands, so it never feels metronomic', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(allInHoldMs(seedFor('t', i)));
    assert.ok(seen.size > 20, `only ${seen.size} distinct holds in 40 hands`);
  });
});

describe('holdPlan', () => {
  const heldBoard = ['Kc', '9c', '4c'];
  const runout = ['2c', '5h'];
  const seed = seedFor('table-x', 3);
  const hold = allInHoldMs(seed);

  it('is empty and instant when nobody is watching', () => {
    const p = holdPlan({ heldBoard, runout, seed, watched: false });
    assert.deepEqual(p.frames, []);
    assert.equal(p.awardAt, 0);
    assert.equal(p.totalMs, 0);
    assert.equal(p.watched, false);
  });

  it('opens on the all-in with the board as it stood', () => {
    const p = holdPlan({ heldBoard, runout, seed });
    assert.equal(p.frames[0].at, 0);
    assert.equal(p.frames[0].pace, PACE.ALLIN);
    assert.deepEqual(p.frames[0].board, heldBoard);
    assert.equal(p.frames[0].card, null);
  });

  it('deals the runout one card at a time, 700ms apart, after the hold', () => {
    const p = holdPlan({ heldBoard, runout, seed });
    assert.equal(p.frames.length, 1 + runout.length);
    assert.equal(p.frames[1].at, hold);
    assert.equal(p.frames[1].card, '2c');
    assert.deepEqual(p.frames[1].board, ['Kc', '9c', '4c', '2c']);
    assert.equal(p.frames[2].at, hold + RUNOUT_CARD_MS);
    assert.equal(p.frames[2].card, '5h');
    assert.deepEqual(p.frames[2].board, ['Kc', '9c', '4c', '2c', '5h']);
    assert.ok(p.frames.slice(1).every((f) => f.pace === PACE.SHOWDOWN));
  });

  it('holds the finished board for two seconds before the pot moves', () => {
    const p = holdPlan({ heldBoard, runout, seed });
    const lastCardAt = hold + RUNOUT_CARD_MS;
    assert.equal(p.awardAt, lastCardAt + REVEAL_HOLD_MS);
    assert.equal(p.totalMs, p.awardAt);
  });

  it('still holds when there is nothing left to deal — all-in on the river', () => {
    const p = holdPlan({ heldBoard: ['Kc', '9c', '4c', '2c', '5h'], runout: [], seed });
    assert.equal(p.frames.length, 1);
    assert.equal(p.awardAt, hold + REVEAL_HOLD_MS);
  });

  it('deals a full five-card runout from a preflop jam', () => {
    const p = holdPlan({ heldBoard: [], runout: ['Ah', 'Kd', '2c', '7s', '9h'], seed });
    assert.equal(p.frames.length, 6);
    assert.deepEqual(p.frames.at(-1).board.length, 5);
    assert.equal(p.awardAt, hold + RUNOUT_CARD_MS * 4 + REVEAL_HOLD_MS);
  });

  it('never mutates the board it was handed', () => {
    const held = ['Kc', '9c', '4c'];
    holdPlan({ heldBoard: held, runout, seed });
    assert.deepEqual(held, ['Kc', '9c', '4c']);
  });

  it('is exactly reproducible', () => {
    assert.deepEqual(holdPlan({ heldBoard, runout, seed }), holdPlan({ heldBoard, runout, seed }));
  });
});

// ── RAISE-1 · raise discipline dials ─────────────────────────────────────────
describe('RAISE-1 raiseFloor', () => {
  it('lifts a min-raise to a third of the pot', () => {
    // 400-chip pot, bet to 20, engine minimum 40. A third of the pot is 134,
    // so the floor is 154 — not the +20 the engine would have allowed.
    assert.equal(raiseFloor({ minLegal: 40, maxLegal: 1000, pot: 400, currentBet: 20 }), 154);
  });

  it('keeps the engine minimum when it is already the bigger number', () => {
    // Tiny pot, big outstanding bet: the legal minimum wins and nothing moves.
    assert.equal(raiseFloor({ minLegal: 300, maxLegal: 1000, pot: 60, currentBet: 150 }), 300);
  });

  it('never asks for more than the jam', () => {
    // He cannot afford a third of the pot. All-in is the one raise that is
    // always big enough, so the floor collapses onto it rather than making the
    // raise illegal.
    assert.equal(raiseFloor({ minLegal: 40, maxLegal: 90, pot: 900, currentBet: 20 }), 90);
  });

  it('is the same rule for an opening bet, where currentBet is 0', () => {
    assert.equal(raiseFloor({ minLegal: 20, maxLegal: 1000, pot: 300, currentBet: 0 }), 100);
  });

  it('survives junk without throwing', () => {
    assert.equal(raiseFloor(), 0);
    assert.equal(raiseFloor({ minLegal: NaN, maxLegal: 500, pot: 'x', currentBet: null }), 0);
  });

  it('follows the RAISE_MIN_POT_FRACTION dial', () => {
    const prev = process.env.RAISE_MIN_POT_FRACTION;
    process.env.RAISE_MIN_POT_FRACTION = '0.5';
    try {
      assert.equal(minRaisePotFraction(), 0.5);
      assert.equal(raiseFloor({ minLegal: 40, maxLegal: 1000, pot: 400, currentBet: 20 }), 220);
    } finally {
      if (prev === undefined) delete process.env.RAISE_MIN_POT_FRACTION;
      else process.env.RAISE_MIN_POT_FRACTION = prev;
    }
  });

  it('ignores a nonsense fraction rather than disabling the floor', () => {
    const prev = process.env.RAISE_MIN_POT_FRACTION;
    process.env.RAISE_MIN_POT_FRACTION = '-3';
    try {
      assert.equal(minRaisePotFraction(), 1 / 3);
    } finally {
      if (prev === undefined) delete process.env.RAISE_MIN_POT_FRACTION;
      else process.env.RAISE_MIN_POT_FRACTION = prev;
    }
  });
});

describe('RAISE-1 raisesCapped', () => {
  it('caps at four aggressive actions — bet, raise, re-raise, cap', () => {
    assert.equal(raiseCapPerStreet(), 4);
    assert.equal(raisesCapped(0), false);
    assert.equal(raisesCapped(3), false);
    assert.equal(raisesCapped(4), true);
    assert.equal(raisesCapped(9), true);
  });

  it('treats a missing count as uncapped', () => {
    assert.equal(raisesCapped(undefined), false);
    assert.equal(raisesCapped(null), false);
  });

  it('follows the RAISE_CAP_PER_STREET dial', () => {
    const prev = process.env.RAISE_CAP_PER_STREET;
    process.env.RAISE_CAP_PER_STREET = '2';
    try {
      assert.equal(raiseCapPerStreet(), 2);
      assert.equal(raisesCapped(2), true);
      assert.equal(raisesCapped(1), false);
    } finally {
      if (prev === undefined) delete process.env.RAISE_CAP_PER_STREET;
      else process.env.RAISE_CAP_PER_STREET = prev;
    }
  });
});
