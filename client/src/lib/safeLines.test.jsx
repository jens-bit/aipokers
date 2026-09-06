// client/src/lib/safeLines.test.jsx — SAFE-2
//
// The vocabulary the safe speaks. Every assertion here is board 29 F12/F12b's
// one law in a different shape: no figure is ever drawn without the sentence
// that caused it, and the sentence is a thing that happened in the flat.

import { describe, expect, it } from 'vitest';

import { isTonight, ledgerDay, ledgerLine, ledgerTime, nightStart, tonightOf } from './safeLines.js';

const NAMES = { a1: 'Bluff', a2: 'Aggro', a3: 'Value' };
const nameOf = (id) => NAMES[id] ?? null;

// A fixed evening, so "tonight" is not whatever the clock says when CI runs.
const AT = (h, m = 0) => new Date(2026, 8, 6, h, m).getTime();
const NOW = AT(23, 30);

const entry = (type, amount, extra = {}) => ({
  id: `${type}-${amount}-${extra.ts ?? 0}`, type, amount, ts: NOW, ...extra,
});

describe('SAFE-2 — the night', () => {
  it('rolls at 04:00, so a session that crossed midnight is one night', () => {
    // 01:00 belongs to the night that started at 04:00 the day before.
    const oneAm = new Date(2026, 8, 7, 1, 0).getTime();
    expect(nightStart(oneAm)).toBe(AT(4));
    expect(isTonight(AT(22), oneAm)).toBe(true);
  });

  it('starts this morning once it is past the roll', () => {
    expect(nightStart(NOW)).toBe(AT(4));
    expect(isTonight(AT(3, 59), NOW)).toBe(false);
    expect(isTonight(AT(4, 1), NOW)).toBe(true);
  });

  it('says nothing about a timestamp it cannot read', () => {
    expect(isTonight(undefined, NOW)).toBe(false);
    expect(ledgerTime('nope')).toBe('');
    expect(ledgerDay(AT(22), NOW)).toBeNull();
  });
});

describe('SAFE-2 — one line per event', () => {
  it('names who came home, rather than printing a bare plus', () => {
    expect(ledgerLine(entry('collect', 2740, { agentId: 'a1' }), nameOf)).toBe('Bluff came home');
  });

  it('says whose pocket was topped up', () => {
    expect(ledgerLine(entry('fund', -1000, { agentId: 'a2' }), nameOf)).toBe("Topped up Aggro's pocket");
  });

  it('keeps the line when the agent is gone — the money still moved', () => {
    expect(ledgerLine(entry('collect', 310, { agentId: 'ghost' }), nameOf)).toBe('Winnings came home');
    expect(ledgerLine(entry('fund', -50, { agentId: 'ghost' }), nameOf)).toBe('Topped up a pocket');
  });

  it('separates a refill from a top-up: one of them was not the owner', () => {
    expect(ledgerLine(entry('refill', -1000, { agentId: 'a2' }), nameOf))
      .toBe("Aggro's pocket refilled itself");
  });

  it('counts the fridge, and says who asked', () => {
    expect(ledgerLine(entry('item', -60, { item: 'beer', qty: 2, agentId: 'a2' }), nameOf))
      .toBe('Beer × 2 — Aggro asked');
    // Stocked from the safe rather than handed over: nobody asked for it yet.
    expect(ledgerLine(entry('item', -120, { item: 'snack', qty: 3 }), nameOf)).toBe('Snack × 3');
    expect(ledgerLine(entry('item', -30, { item: 'beer', qty: 1 }), nameOf)).toBe('Beer');
  });

  it('has a word for the two lines nobody chose', () => {
    expect(ledgerLine(entry('seed', 4000), nameOf)).toBe('Opening balance');
    expect(ledgerLine({ type: 'mystery', amount: 1 }, nameOf)).toBe('Adjustment');
  });

  it('stamps the hour it happened, zero-padded', () => {
    expect(ledgerTime(AT(9, 5))).toBe('09:05');
    expect(ledgerTime(AT(23, 14))).toBe('23:14');
  });

  it('dates anything older than tonight, so a stale line cannot pass for a fresh one', () => {
    expect(ledgerDay(AT(3), NOW)).toBeTruthy();
  });
});

describe('SAFE-2 — tonight, in three lines', () => {
  const LEDGER = [
    entry('collect', 2740, { agentId: 'a1', ts: AT(23, 14) }),
    entry('item', -60, { item: 'beer', qty: 2, agentId: 'a2', ts: AT(22, 58) }),
    entry('fund', -1000, { agentId: 'a2', ts: AT(22, 31) }),
    entry('collect', 310, { agentId: 'a3', ts: AT(21, 47) }),
    entry('item', -120, { item: 'snack', qty: 3, ts: AT(21, 2) }),
    entry('fund', -1000, { agentId: 'a2', ts: AT(20, 40) }),
    // Last night's, and it must not land in tonight's arithmetic.
    entry('collect', 9999, { agentId: 'a1', ts: AT(3, 30) }),
  ];

  const lines = () => tonightOf(LEDGER, { nameOf, now: NOW });

  it('is always three lines, in the same order', () => {
    expect(lines().map((r) => r.key)).toEqual(['home', 'fridge', 'given']);
  });

  it('adds up only what happened tonight', () => {
    const [home, fridge, given] = lines();
    expect(home.amount).toBe(3050);      // 2,740 + 310, and not last night's 9,999
    expect(fridge.amount).toBe(-180);    // 60 + 120
    expect(given.amount).toBe(-2000);    // two top-ups of 1,000
  });

  it('gives every figure the sentence that caused it', () => {
    const [home, fridge, given] = lines();
    expect(home.note).toBe('Bluff and Value');
    expect(fridge.note).toBe('2 beers, 3 snacks');
    expect(given.note).toBe("Aggro's pocket, topped up twice");
  });

  it('still draws the three lines on a night when nothing happened', () => {
    const quiet = tonightOf([], { nameOf, now: NOW });
    expect(quiet).toHaveLength(3);
    expect(quiet.map((r) => r.amount)).toEqual([0, 0, 0]);
    // A zero is still a claim about the night, so it still says what it means.
    expect(quiet.map((r) => r.note)).toEqual([
      'nothing home yet', 'the fridge is untouched', 'nobody asked',
    ]);
  });

  it('counts a refill as given out — it left the safe either way', () => {
    const [, , given] = tonightOf(
      [entry('refill', -500, { agentId: 'a1', ts: AT(20) })], { nameOf, now: NOW },
    );
    expect(given.amount).toBe(-500);
    expect(given.note).toBe("Bluff's pocket");
  });

  it('survives a ledger that is not one', () => {
    expect(tonightOf(null, { nameOf, now: NOW })).toHaveLength(3);
    expect(tonightOf([{ type: 'fund' }], { nameOf, now: NOW })[2].amount).toBe(0);
  });
});
