// src/server/rake.test.js — MONEY-2 job 3
//
// The house's cut: the arithmetic, the two dials, the split, and the one rule
// that matters more than any of them — IT NEVER APPLIES AT A HOME TABLE.
//
// The conservation half lives in money2Rake.test.js, which reads
// `Σ safes + Σ pockets + bank` out of SQLite around a raked session. This file
// is the pure module and the table's own skim.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rakeFor, splitRake, rakeSettings, rakeLine, DEFAULT_RAKE_PERCENT, DEFAULT_RAKE_CAP_BB } from './rake.js';
import { Table } from './table.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

const savedEnv = { percent: process.env.RAKE_PERCENT, capBb: process.env.RAKE_CAP_BB };
beforeEach(() => { delete process.env.RAKE_PERCENT; delete process.env.RAKE_CAP_BB; });
afterEach(() => {
  if (savedEnv.percent === undefined) delete process.env.RAKE_PERCENT; else process.env.RAKE_PERCENT = savedEnv.percent;
  if (savedEnv.capBb === undefined) delete process.env.RAKE_CAP_BB; else process.env.RAKE_CAP_BB = savedEnv.capBb;
});

// ── the arithmetic ──────────────────────────────────────────────────────────

test('MONEY-2: the rake is a percentage of the pot, floored — the house never rounds up', () => {
  const settings = { percent: 5, capBb: 100 };
  assert.equal(rakeFor(1_000, 20, settings), 50);
  assert.equal(rakeFor(999, 20, settings), 49, '49.95 is 49');
  assert.equal(rakeFor(19, 20, settings), 0, 'a pot too small to rake is not raked');
  assert.equal(rakeFor(0, 20, settings), 0);
});

test('MONEY-2: the cap is in big blinds, so it scales with the room', () => {
  const settings = { percent: 10, capBb: 3 };
  // Floor, $10/$20: three big blinds is 60.
  assert.equal(rakeFor(500, 20, settings), 50, 'under the cap, the percentage wins');
  assert.equal(rakeFor(5_000, 20, settings), 60, 'over it, the cap wins');
  // Back room, $50/$100: the same cap is 300, because a big blind is bigger.
  assert.equal(rakeFor(5_000, 100, settings), 300);
});

test('MONEY-2: the rake never exceeds the pot itself', () => {
  assert.equal(rakeFor(10, 20, { percent: 100, capBb: 10 }), 10);
});

test('MONEY-2: either dial at zero switches the rake off completely', () => {
  assert.equal(rakeFor(5_000, 20, { percent: 0, capBb: 3 }), 0, 'RAKE_PERCENT=0 is the way back');
  assert.equal(rakeFor(5_000, 20, { percent: 5, capBb: 0 }), 0);
  assert.equal(rakeFor(5_000, 0, { percent: 5, capBb: 3 }), 0, 'and a table with no blind has no cap to cap at');
});

test('MONEY-2: both dials come from the environment, read per call', () => {
  assert.deepEqual(rakeSettings(), { percent: DEFAULT_RAKE_PERCENT, capBb: DEFAULT_RAKE_CAP_BB });

  process.env.RAKE_PERCENT = '7';
  process.env.RAKE_CAP_BB = '2';
  assert.deepEqual(rakeSettings(), { percent: 7, capBb: 2 }, 'no restart, no import-time capture');
  assert.equal(rakeFor(1_000, 20, rakeSettings()), 40, '7% of 1,000 is 70, capped at two 20s');

  process.env.RAKE_PERCENT = 'nonsense';
  assert.equal(rakeSettings().percent, DEFAULT_RAKE_PERCENT, 'a typo falls back rather than raking zero or everything');

  process.env.RAKE_PERCENT = '900';
  assert.equal(rakeSettings().percent, 100, 'and is bounded either way');
});

// ── the split ───────────────────────────────────────────────────────────────

test('MONEY-2: a split pot is one rake, shared in proportion to what each took', () => {
  const shares = splitRake(100, [{ seat: 0, amount: 750 }, { seat: 1, amount: 250 }]);
  assert.equal(shares.get(0), 75);
  assert.equal(shares.get(1), 25);
  assert.equal([...shares.values()].reduce((a, b) => a + b, 0), 100, 'and it adds up to exactly the rake');
});

test('MONEY-2: the flooring remainder goes to the biggest winner, deterministically', () => {
  const shares = splitRake(10, [{ seat: 0, amount: 100 }, { seat: 1, amount: 100 }, { seat: 2, amount: 100 }]);
  assert.equal([...shares.values()].reduce((a, b) => a + b, 0), 10);
  assert.equal(shares.get(0), 4, 'a three-way tie hands the odd chip to the lowest seat');
  assert.equal(shares.get(1), 3);
  assert.equal(shares.get(2), 3);
});

test('MONEY-2: a rake with nobody to take it from takes nothing', () => {
  assert.equal(splitRake(100, []).size, 0);
  assert.equal(splitRake(0, [{ seat: 0, amount: 500 }]).size, 0);
});

test('MONEY-2: the cut has one phrase, so the felt and the history cannot disagree', () => {
  assert.equal(rakeLine(1_250), '1,250 to the house');
  assert.equal(rakeLine(0), '', 'an unraked hand says nothing at all');
});

// ── the table's own skim ────────────────────────────────────────────────────

function newTable(opts = {}) {
  const table = new Table({ tableId: 'rake-test', smallBlind: 10, bigBlind: 20, maxSeats: 6, ...opts });
  table._scheduleNextHand = () => {};
  table.startSessionLoop = () => {};
  return table;
}

/**
 * A hand that has just completed, with seat 0 having taken the whole pot.
 *
 * `contribTotal` is split evenly by default because that is a CALLED pot —
 * nothing in it is uncalled, so the whole of it is rakeable. The uncalled case
 * has its own test below, with its own contributions.
 */
function completedHand(table, { pot = 1_000, winnerStack = 3_000, contribs = null } = {}) {
  const split = contribs ?? [Math.floor(pot / 2), pot - Math.floor(pot / 2)];
  table.game = {
    seats: [
      { playerId: 'p0', stack: winnerStack, contribTotal: split[0] },
      { playerId: 'p1', stack: 1_000, contribTotal: split[1] },
    ],
    result: {
      type: 'showdown',
      pot,
      winners: [{ seat: 0, playerId: 'p0', amount: pot }],
      deltas: { 0: pot - split[0], 1: -split[1] },
    },
  };
  return table.game.result;
}

test('MONEY-2: the table takes the cut off the winner\'s stack and names it on the result', () => {
  process.env.RAKE_PERCENT = '5';
  process.env.RAKE_CAP_BB = '10';
  const table = newTable();
  const result = completedHand(table, { pot: 1_000, winnerStack: 3_000 });

  const taken = table._takeRake(result);

  assert.equal(taken, 50);
  assert.equal(table.game.seats[0].stack, 2_950, 'it came off the chips in front of him');
  assert.equal(table.game.seats[1].stack, 1_000, 'and off nobody else');
  assert.equal(result.rake.total, 50);
  assert.deepEqual(result.rake.bySeat, { 0: 50 });
  assert.equal(result.rake.percent, 5);
  assert.equal(result.rake.capBb, 10);
  assert.equal(result.rake.bigBlind, 20);
  assert.equal(result.deltas[0], 450, 'his net for the hand is what he actually kept');
  assert.equal(table.seatRakePaid(0), 50, 'and the stay remembers it, for the rail');
});

test('MONEY-2: a winner is never raked on his own uncalled bet', () => {
  process.env.RAKE_PERCENT = '10';
  process.env.RAKE_CAP_BB = '100';
  const table = newTable();
  // He raises to 300 into a 20 blind and everybody folds. `result.pot` is 320;
  // what he WON is 20, and the 300 was never in the middle. A cardroom pushes
  // the uncalled portion back before it counts the pot, and so does this.
  const result = completedHand(table, { pot: 320, winnerStack: 3_000, contribs: [300, 20] });

  const taken = table._takeRake(result);

  assert.equal(taken, 4, '10% of the 40 that was actually contested, not of the 320 on the table');
  assert.equal(result.deltas[0], 20 - 4, 'so the cut is a slice of his win and not of his own stack');
});

test('MONEY-2: THE RAKE NEVER APPLIES AT A HOME TABLE', () => {
  process.env.RAKE_PERCENT = '50';
  process.env.RAKE_CAP_BB = '1000';
  const table = newTable({ tableId: 'home-kitchen', home: true, homeOwnerId: 'flat', smallBlind: 1, bigBlind: 2 });
  const result = completedHand(table, { pot: 400, winnerStack: 600 });

  const taken = table._takeRake(result);

  assert.equal(taken, 0, 'the kitchen table is not a casino');
  assert.equal(table.game.seats[0].stack, 600, 'his chips are untouched');
  assert.equal(result.rake, undefined, 'and nothing on the wire claims a cut was taken');
  assert.equal(result.deltas[0], 200, 'his net for the hand is the whole of it');
  assert.equal(table.seatRakePaid(0), 0);
});

test('MONEY-2: a rake of zero leaves the result exactly as the engine built it', () => {
  process.env.RAKE_PERCENT = '0';
  const table = newTable();
  const result = completedHand(table, { pot: 1_000 });

  assert.equal(table._takeRake(result), 0);
  assert.equal(result.rake, undefined);
  assert.equal(result.deltas[0], 500);
});

test('MONEY-2: a winner is never raked into a negative stack', () => {
  process.env.RAKE_PERCENT = '100';
  process.env.RAKE_CAP_BB = '1000';
  const table = newTable();
  const result = completedHand(table, { pot: 1_000, winnerStack: 30 });

  assert.equal(table._takeRake(result), 30, 'it takes what is there and not a chip more');
  assert.equal(table.game.seats[0].stack, 0);
});

test('MONEY-2: the result line names the cut beside the pot', () => {
  process.env.RAKE_PERCENT = '5';
  process.env.RAKE_CAP_BB = '10';
  const table = newTable();
  table.pending[0] = { playerId: 'p0', displayName: 'GRANITE', buyIn: 2_000 };
  table.pending[1] = { playerId: 'p1', displayName: 'MARLOW', buyIn: 2_000 };
  const lines = [];
  table._threadTable = (text) => lines.push(text);

  const result = completedHand(table, { pot: 1_000 });
  table._takeRake(result);
  table._threadResult(result);

  assert.equal(lines.length, 1);
  assert.match(lines[0], /won 1000 at showdown/);
  assert.match(lines[0], /50 to the house/, 'the owner reads the cut on the line that says who won');
});

test('MONEY-2: an unraked hand says nothing about a rake on the result line', () => {
  process.env.RAKE_PERCENT = '0';
  const table = newTable();
  table.pending[0] = { playerId: 'p0', displayName: 'GRANITE', buyIn: 2_000 };
  const lines = [];
  table._threadTable = (text) => lines.push(text);

  const result = completedHand(table, { pot: 1_000 });
  table._takeRake(result);
  table._threadResult(result);

  assert.doesNotMatch(lines[0], /house/);
});
