// client/src/lib/reads.test.jsx — W3-5
//
// The three things the client has to get right about a shape it does not own:
// which opponent to show, that confidence is a certainty rather than a width,
// and that a null value is not a zero.

import { describe, expect, it } from 'vitest';

import {
  MAX_BRACKET, READ_KEYS, bracketFor, normalizeReads, pickOpponent,
} from './reads.js';

// readPanel() output from feature/pace @ 5a7832d.
const GRANITE = {
  playerId: 'p_granite', displayName: 'Granite', seat: 2, handsObserved: 142,
  gate: 8.8, formed: true, shape: 'nit',
  line: 'He folds far too often. That is where the money is.',
  rows: [
    { k: 'vpip', label: 'PLAYS', value: 14, confidence: 1, formed: true },
    { k: 'pfr', label: 'RAISES FIRST', value: 9, confidence: 1, formed: true },
    { k: 'aggr', label: 'AGGRESSION', value: 37, confidence: 1, formed: true },
    { k: 'fold', label: 'FOLDS TO HEAT', value: 62, confidence: 1, formed: true },
    { k: 'sd', label: 'GOES TO SHOWDOWN', value: 21, confidence: 1, formed: true },
  ],
};

const FRESH = {
  playerId: 'p_new', displayName: null, seat: 1, handsObserved: 0,
  gate: 8.8, formed: false, shape: null, line: null,
  rows: READ_KEYS.map((k) => ({ k, label: k.toUpperCase(), value: null, confidence: 0, formed: false })),
};

describe('W3-5 the served read shape', () => {
  it('W3-5: keeps the server’s rows, labels and order', () => {
    const model = normalizeReads(GRANITE);
    expect(model.rows.map((r) => r.key)).toEqual(READ_KEYS);
    expect(model.rows.map((r) => r.label))
      .toEqual(['PLAYS', 'RAISES FIRST', 'AGGRESSION', 'FOLDS TO HEAT', 'GOES TO SHOWDOWN']);
    expect(model.rows.map((r) => r.v)).toEqual([14, 9, 37, 62, 21]);
    expect(model.name).toBe('Granite');
    expect(model.hands).toBe(142);
    expect(model.gate).toBe(8.8);
    expect(model.shape).toBe('nit');
    expect(model.formed).toBe(true);
  });

  // The bug this test exists for: Number(null) is 0, so a null row was
  // rendering as a confident zero.
  it('W3-5: a null value is unanswered, never a zero', () => {
    const model = normalizeReads(FRESH);
    expect(model.rows.map((r) => r.v)).toEqual([null, null, null, null, null]);
    expect(model.known).toBe(false);
    // And no bracket either — there is no number to draw a range around.
    expect(model.rows.every((r) => r.conf === 0)).toBe(true);
  });

  it('W3-5: confidence is a certainty, and the bracket is its inverse', () => {
    expect(bracketFor(1)).toBe(0);              // as sure as he gets: a number
    expect(bracketFor(0.5)).toBe(6);
    expect(bracketFor(0.15)).toBe(10);
    expect(bracketFor(0)).toBe(MAX_BRACKET);    // no idea: the widest it draws
    expect(bracketFor(undefined)).toBe(MAX_BRACKET);
  });

  it('W3-5: fills in a short or reordered rows array', () => {
    const model = normalizeReads({ ...GRANITE, rows: [GRANITE.rows[4], GRANITE.rows[0]] });
    expect(model.rows.map((r) => r.key)).toEqual(READ_KEYS);
    expect(model.rows.map((r) => r.v)).toEqual([14, null, null, null, 21]);
  });

  it('W3-5: an absent panel is still five rows', () => {
    expect(normalizeReads(undefined).rows).toHaveLength(5);
    expect(normalizeReads(undefined).known).toBe(false);
  });
});

describe('W3-5 pickOpponent', () => {
  const doyle = { playerId: 'p_doyle', displayName: 'doyle_v3', seat: 1, handsObserved: 48 };
  const nash = { playerId: 'p_nash', displayName: 'Nash_EQ', seat: 2, handsObserved: 210 };

  const game = (folded = []) => ({
    seats: [{ folded: false }, { folded: folded.includes(1) }, { folded: folded.includes(2) }],
  });

  it('W3-5: prefers whoever is still in the hand', () => {
    expect(pickOpponent([doyle, nash], game([2])).playerId).toBe('p_doyle');
    expect(pickOpponent([doyle, nash], game([1])).playerId).toBe('p_nash');
  });

  it('W3-5: among the live, the one he has seen most of', () => {
    expect(pickOpponent([doyle, nash], game()).playerId).toBe('p_nash');
  });

  it('W3-5: with nobody live, still the most observed', () => {
    expect(pickOpponent([doyle, nash], game([1, 2])).playerId).toBe('p_nash');
  });

  it('W3-5: with no game to consult, the most observed', () => {
    expect(pickOpponent([doyle, nash], null).playerId).toBe('p_nash');
  });

  it('W3-5: nothing to pick from is null, not a throw', () => {
    expect(pickOpponent([], game())).toBeNull();
    expect(pickOpponent(null, game())).toBeNull();
    expect(pickOpponent(undefined)).toBeNull();
  });

  it('W3-5: a tie keeps the server’s order, which is seat order', () => {
    const a = { playerId: 'a', seat: 1, handsObserved: 30 };
    const b = { playerId: 'b', seat: 2, handsObserved: 30 };
    expect(pickOpponent([a, b], game()).playerId).toBe('a');
  });
});
