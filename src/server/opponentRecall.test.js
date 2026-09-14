// src/server/opponentRecall.test.js — LIFE-1 job 4
//
// "You should know him well at this point, can you see the stats?"
// "Nah, I can't see the stats."
//
// He could. Every test here fails on that answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  namedOpponent, opponentKnowledge, opponentRecallContext, ledgerEntries, RECALL_MAX,
} from './opponentRecall.js';
import { recordHand, reset, setPersistEnabled } from './opponentStats.js';
import { readMinHands } from '../agent/attributes.js';

setPersistEnabled(false);

// Build an opponent with `n` hands in the ring, playing a recognisable way:
// a calling station — very loose, almost never folds — so classifyOpponent has
// a shape to name and the figures are checkable by eye.
function station(playerId, displayName, n) {
  for (let i = 0; i < n; i++) {
    recordHand({
      playerIdsBySeat: [playerId, 'hero'],
      displayNamesBySeat: [displayName, 'Hero'],
      actionLog: [
        { seat: 0, street: 'preflop', actionType: 'call' },
        { seat: 1, street: 'preflop', actionType: 'raise' },
        { seat: 0, street: 'flop', actionType: 'call' },
        { seat: 1, street: 'flop', actionType: 'bet' },
      ],
      showdownSeats: [0, 1],
    });
  }
}

function hero({ reads = 50, ledger = {} } = {}) {
  return {
    id: 'hero', name: 'Hero',
    attrs: { READS: reads, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    bioLedger: ledger,
  };
}

function entry(playerId, displayName, extra = {}) {
  return {
    playerId, displayName, hands: 100, net: -4200,
    coolersDealt: 0, coolersTaken: 2, biggestPotWon: 0, biggestPotLost: 1800,
    bluffsCaught: 1, showdowns: 20, lastSeenHand: 100, ...extra,
  };
}

// ── The gate is the existing one ────────────────────────────────────────────

test('LIFE-1: the threshold is readMinHands, not a number invented here', () => {
  reset();
  station('gran', 'Granite', 40);
  const him = hero({ reads: 50, ledger: { gran: entry('gran', 'Granite') } });
  const k = opponentKnowledge(him, him.bioLedger.gran);
  // The same call table.js makes to gate the in-hand briefing, with the same
  // arguments a conversation can supply.
  assert.equal(k.gate, readMinHands({ reads: 50, deception: null }));
  assert.equal(k.known, true, '40 observed hands is well past a neutral agent\'s bar');
});

test('LIFE-1: a sharper agent needs fewer hands, exactly as at the table', () => {
  reset();
  station('gran', 'Granite', 40);
  const sharp = opponentKnowledge(hero({ reads: 100, ledger: {} }), entry('gran', 'Granite'));
  const dull = opponentKnowledge(hero({ reads: 0, ledger: {} }), entry('gran', 'Granite'));
  assert.ok(sharp.gate < dull.gate, `${sharp.gate} should be under ${dull.gate}`);
});

test('LIFE-1: below the bar he has no read, and is told to say so', () => {
  reset();
  station('newguy', 'Newcomer', 2);
  const him = hero({ reads: 50, ledger: { newguy: entry('newguy', 'Newcomer', { hands: 2 }) } });
  const k = opponentKnowledge(him, him.bioLedger.newguy);
  assert.equal(k.known, false);
  const block = opponentRecallContext(him, 'what do you make of Newcomer?');
  assert.match(block, /YOU DO NOT HAVE A READ ON HIM YET/);
  assert.match(block, /have not\s+play(?:ed)? him enough|not\s+played him enough/);
  // And crucially it must not teach him the answer that started this job.
  assert.doesNotMatch(block, /cannot see|can't see/i);
});

// ── The figures are real ────────────────────────────────────────────────────

test('LIFE-1: above the bar the ACTUAL numbers are in the prompt', () => {
  reset();
  station('gran', 'Granite', 40);
  const him = hero({ ledger: { gran: entry('gran', 'Granite') } });
  const block = opponentRecallContext(him, 'you should know Granite by now, can you see the stats?');
  assert.match(block, /Granite/);
  assert.match(block, /VPIP \d+%/, 'the real VPIP, not an adjective');
  assert.match(block, /PFR \d+%/);
  assert.match(block, /40 hands/, 'and how much evidence is behind it');
  // The shape reads.js would name at the table is the shape he uses at home.
  assert.match(block, /read on him in a word: station/);
});

test('LIFE-1: he quotes the SAME read the felt briefs him with', async () => {
  reset();
  station('gran', 'Granite', 40);
  const { getRead } = await import('./opponentStats.js');
  const { formatOpponentRead } = await import('../agent/reads.js');
  const briefing = formatOpponentRead(getRead('gran'), { reads: 50, deception: null })[0];
  const him = hero({ ledger: { gran: entry('gran', 'Granite') } });
  assert.ok(opponentRecallContext(him, 'tell me about Granite').includes(briefing),
    'the living room and the felt must not quote two different reads');
});

test('LIFE-1: the history only he has rides along with the statistics', () => {
  reset();
  station('gran', 'Granite', 40);
  const him = hero({ ledger: { gran: entry('gran', 'Granite') } });
  const block = opponentRecallContext(him, 'how do you do against Granite?');
  assert.match(block, /100 hands against him/);
  assert.match(block, /down 4200 chips/);
  assert.match(block, /coolered you 2×/);
  assert.match(block, /snapped you off bluffing 1×/);
});

// ── Whose book it is ────────────────────────────────────────────────────────

test('LIFE-1: he only knows the men in HIS OWN ledger', () => {
  reset();
  station('stranger', 'Stranger', 50);
  const him = hero({ ledger: {} });       // he has never sat with anybody
  assert.equal(namedOpponent(him, 'what about Stranger?'), null);
  assert.equal(opponentRecallContext(him, 'what about Stranger?'), '',
    'he cannot produce statistics on a man he has never played');
});

test('LIFE-1: the longest matching name wins, so two Doyles do not collide', () => {
  const him = hero({ ledger: {
    d1: entry('d1', 'Doyle'),
    d2: entry('d2', 'Doyle Jr'),
  } });
  assert.equal(namedOpponent(him, 'ask Doyle Jr about the turn').playerId, 'd2');
  assert.equal(namedOpponent(him, 'ask Doyle about the turn').playerId, 'd1');
});

test('LIFE-1: a two-letter name is not matched out of ordinary words', () => {
  const him = hero({ ledger: { al: entry('al', 'Al') } });
  assert.equal(namedOpponent(him, 'also, how was the session?'), null);
});

test('LIFE-1: no name asked about gets the men he knows best, bounded', () => {
  reset();
  for (const [id, name, n] of [['a', 'Alpha', 40], ['b', 'Bravo', 40], ['c', 'Charlie', 40], ['d', 'Delta', 40], ['e', 'Echo', 40]]) {
    station(id, name, n);
  }
  const him = hero({ ledger: {
    a: entry('a', 'Alpha', { hands: 10 }), b: entry('b', 'Bravo', { hands: 200 }),
    c: entry('c', 'Charlie', { hands: 150 }), d: entry('d', 'Delta', { hands: 120 }),
    e: entry('e', 'Echo', { hands: 5 }),
  } });
  const block = opponentRecallContext(him, 'how is the field these days');
  const named = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].filter((n) => block.includes(n));
  assert.equal(named.length, RECALL_MAX, `named ${named.join(', ')}`);
  assert.deepEqual(named.sort(), ['Bravo', 'Charlie', 'Delta'], 'the three he knows best');
});

test('LIFE-1: an agent who has played nobody carries no block at all', () => {
  assert.equal(opponentRecallContext(hero({ ledger: {} }), 'anything'), '');
  assert.equal(opponentRecallContext({}, 'anything'), '');
  assert.deepEqual(ledgerEntries(null), []);
});

test('LIFE-1: the block forbids the answer that started this job', () => {
  reset();
  station('gran', 'Granite', 40);
  const him = hero({ ledger: { gran: entry('gran', 'Granite') } });
  const block = opponentRecallContext(him, 'can you see the stats on Granite?');
  assert.match(block, /you can absolutely see them — never say you cannot/);
});
