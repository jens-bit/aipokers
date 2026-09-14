// src/agent/ownerHands.test.js — LIFE-1 job 6
//
// "He comments on the owner's actual play afterwards — 'you folded that? I had
// nothing' — using the real hand, and he can be asked about it later."

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OWNER_HANDS_MAX, recordOwnerHand, ensureOwnerHands, lastOwnerHand,
  ownerHandComment, ownerHandsContext,
} from './ownerHands.js';

const NOW = 1_700_000_000_000;

const hand = (extra = {}) => ({
  handNumber: 12, ownerName: 'Jens', pot: 640,
  ownerActions: [
    { street: 'preflop', type: 'call', amount: 20 },
    { street: 'flop', type: 'check' },
    { street: 'flop', type: 'fold' },
  ],
  ownerFolded: true, ownerWon: false, ownerShowed: null,
  mine: ['7h', '2c'], myHand: 'High card', board: ['Ks', 'Qd', '4c'],
  iWon: true, showdown: false,
  ...extra,
});

// ── The line ────────────────────────────────────────────────────────────────

test('LIFE-1: he tells you when you folded to nothing', () => {
  // The line the job names, and the best one in the list — you only ever find
  // out you were bluffed if he says so.
  assert.equal(ownerHandComment(hand()), 'You folded that? I had nothing. 640 chips for a story.');
});

test('LIFE-1: and when you were right to fold, which is the only way a fold is confirmed', () => {
  const line = ownerHandComment(hand({ myHand: 'Two pair, kings and fours' }));
  assert.match(line, /Good fold/);
  assert.match(line, /two pair, kings and fours/);
});

test('LIFE-1: a preflop fold is not an event', () => {
  assert.equal(ownerHandComment(hand({
    ownerActions: [{ street: 'preflop', type: 'fold' }],
  })), null, 'a remark after every single hand is the pathology TLK-1 already capped');
});

test('LIFE-1: he says something when you paid him off', () => {
  const line = ownerHandComment(hand({
    ownerFolded: false, iWon: true, showdown: true,
    myHand: 'Flush, king high', ownerShowed: ['Ad', '9d'],
    ownerActions: [{ street: 'river', type: 'call', amount: 300 }],
  }));
  assert.match(line, /You called me down against Ad 9d/);
  assert.match(line, /flush, king high/);
});

test('LIFE-1: and when you beat him', () => {
  const line = ownerHandComment(hand({
    ownerFolded: false, ownerWon: true, iWon: false, showdown: true,
    myHand: 'Pair of sevens',
    ownerActions: [{ street: 'river', type: 'bet', amount: 200 }],
  }));
  assert.match(line, /You had me/);
  assert.match(line, /pair of sevens/);
});

test('LIFE-1: and when you bet him off it, with the real figure', () => {
  const line = ownerHandComment(hand({
    ownerFolded: false, ownerWon: true, iWon: false, showdown: false,
    ownerActions: [
      { street: 'flop', type: 'bet', amount: 120 },
      { street: 'turn', type: 'bet', amount: 400 },
    ],
  }));
  assert.match(line, /That 400 did it/, 'the amount is the owner\'s actual bet');
});

test('LIFE-1: and when you never bet once', () => {
  const line = ownerHandComment(hand({
    ownerFolded: false, ownerWon: true, iWon: false, showdown: false,
    ownerActions: [
      { street: 'flop', type: 'check' }, { street: 'turn', type: 'check' },
      { street: 'river', type: 'check' },
    ],
  }));
  assert.match(line, /never bet once/);
});

test('LIFE-1: no hand, no line', () => {
  assert.equal(ownerHandComment(null), null);
  assert.equal(ownerHandComment({ ownerActions: [] }), null);
});

test('LIFE-1: the line can only name a card that was actually turned over', () => {
  // He may name HIS OWN holding freely. The owner's is only ever quoted from
  // `ownerShowed`, which the table fills in at showdown and nowhere else.
  const folded = ownerHandComment(hand({ ownerShowed: null }));
  assert.doesNotMatch(folded, /Ad|9d/);
  const shown = ownerHandComment(hand({
    ownerFolded: false, iWon: true, showdown: true,
    myHand: 'Two pair', ownerShowed: ['Ad', '9d'],
    ownerActions: [{ street: 'river', type: 'call', amount: 300 }],
  }));
  assert.match(shown, /Ad 9d/);
});

// ── The book ────────────────────────────────────────────────────────────────

test('LIFE-1: a hand the owner was never dealt into is not a hand between you', () => {
  const him = {};
  assert.equal(recordOwnerHand(him, hand({ ownerActions: [] }), { now: NOW }), null);
  assert.equal(recordOwnerHand(him, null, { now: NOW }), null);
  assert.deepEqual(ensureOwnerHands(him), []);
});

test('LIFE-1: newest first, and bounded', () => {
  const him = {};
  for (let i = 0; i < 20; i++) recordOwnerHand(him, hand({ handNumber: i }), { now: NOW + i });
  assert.equal(him.ownerHands.length, OWNER_HANDS_MAX);
  assert.equal(lastOwnerHand(him).handNumber, 19);
});

test('LIFE-1: what is stored is what was true at the table', () => {
  const him = {};
  const stored = recordOwnerHand(him, hand(), { now: NOW });
  assert.equal(stored.at, NOW);
  assert.equal(stored.ownerName, 'Jens');
  assert.equal(stored.ownerFolded, true);
  assert.deepEqual(stored.mine, ['7h', '2c']);
  assert.deepEqual(stored.board, ['Ks', 'Qd', '4c']);
  assert.equal(stored.ownerShowed, null, 'a card nobody turned over is not stored');
});

// ── Asked about it later ────────────────────────────────────────────────────

test('LIFE-1: he can be asked about it later', () => {
  const him = {};
  recordOwnerHand(him, hand(), { now: NOW });
  const block = ownerHandsContext(him);
  assert.match(block, /Hand 12 at your kitchen table, pot 640/);
  assert.match(block, /You held 7h 2c \(High card\)/);
  assert.match(block, /board Ks Qd 4c/);
  assert.match(block, /HE played it: preflop call 20, flop check, flop fold/);
  assert.match(block, /He folded\./);
  // And what he is meant to talk about when asked.
  assert.match(block, /talk\s+about HIS play in it/);
  assert.match(block, /Never claim to have seen a card that is not listed/);
});

test('LIFE-1: only the two most recent, because it is a memory not a transcript', () => {
  const him = {};
  for (let i = 0; i < 5; i++) recordOwnerHand(him, hand({ handNumber: i }), { now: NOW + i });
  const block = ownerHandsContext(him);
  assert.match(block, /Hand 4 /);
  assert.match(block, /Hand 3 /);
  assert.doesNotMatch(block, /Hand 2 /);
});

test('LIFE-1: an agent who has never played his owner carries no block', () => {
  assert.equal(ownerHandsContext({}), '');
  assert.equal(ownerHandsContext(null), '');
});
