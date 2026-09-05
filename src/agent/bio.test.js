// src/agent/bio.test.js — BIO-2

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLES,
  ROLE_MIN_HANDS,
  RIVAL_CLOSE_PER_HAND,
  LEDGER_CAP,
  newLedgerEntry,
  ensureBio,
  recordLedgerHand,
  compressLedger,
  deriveRoles,
  roleOf,
  recapMention,
} from './bio.js';

// A ledger entry built to order.
const entry = (playerId, over = {}) => ({
  ...newLedgerEntry(playerId, over.displayName ?? playerId),
  hands: 50,
  net: 0,
  ...over,
});

describe('the ledger', () => {
  it('starts empty and idempotently', () => {
    const agent = {};
    ensureBio(agent);
    assert.deepEqual(agent.bioLedger, {});
    assert.deepEqual(agent.bio, { nemesis: null, rival: null, victim: null });
    const first = agent.bioLedger;
    ensureBio(agent);
    assert.equal(agent.bioLedger, first);
  });

  it('counts a hand, the money, and which way the pot went', () => {
    const l = {};
    recordLedgerHand(l, { playerId: 'p1', displayName: 'Granite', net: -480, pot: 960, won: false, showdown: true });
    recordLedgerHand(l, { playerId: 'p1', net: +200, pot: 400, won: true });
    const e = l.p1;
    assert.equal(e.hands, 2);
    assert.equal(e.net, -280);
    assert.equal(e.displayName, 'Granite');
    assert.equal(e.biggestPotLost, 960);
    assert.equal(e.biggestPotWon, 400);
    assert.equal(e.showdowns, 1);
  });

  it('counts coolers on the side they landed', () => {
    const l = {};
    recordLedgerHand(l, { playerId: 'p1', net: -500, pot: 1000, won: false, cooler: true });
    recordLedgerHand(l, { playerId: 'p1', net: +500, pot: 1000, won: true, cooler: true });
    assert.equal(l.p1.coolersTaken, 1);
    assert.equal(l.p1.coolersDealt, 1);
  });

  it('counts bluffs that got caught', () => {
    const l = {};
    recordLedgerHand(l, { playerId: 'p1', net: -300, bluffCaught: true });
    assert.equal(l.p1.bluffsCaught, 1);
  });

  it('needs a player to record anything at all', () => {
    const l = {};
    recordLedgerHand(l, { net: -500 });
    assert.deepEqual(l, {});
  });

  it('keeps the most-played opponents when it gets full', () => {
    const l = {};
    for (let i = 0; i < LEDGER_CAP + 5; i++) {
      for (let h = 0; h <= i; h++) recordLedgerHand(l, { playerId: `p${i}`, net: 0 });
    }
    const kept = Object.keys(l);
    assert.equal(kept.length, LEDGER_CAP);
    assert.ok(kept.includes(`p${LEDGER_CAP + 4}`), 'the most-played survives');
    assert.ok(!kept.includes('p0'), 'the thinnest is dropped');
  });

  it('compresses without touching a ledger that fits', () => {
    const l = { a: entry('a'), b: entry('b') };
    compressLedger(l);
    assert.equal(Object.keys(l).length, 2);
  });
});

describe('deriving the three roles', () => {
  it('finds nobody below the hand threshold', () => {
    const l = { a: entry('a', { hands: ROLE_MIN_HANDS - 1, net: -9999 }) };
    const bio = deriveRoles(l);
    assert.equal(bio.nemesis, null);
    assert.equal(bio.rival, null);
    assert.equal(bio.victim, null);
  });

  it('finds a nemesis at exactly the threshold', () => {
    const l = { a: entry('a', { hands: ROLE_MIN_HANDS, net: -1240, displayName: 'Granite' }) };
    assert.equal(deriveRoles(l).nemesis.displayName, 'Granite');
  });

  it('nemesis is the WORST net, not merely a losing one', () => {
    const l = {
      a: entry('a', { net: -300, displayName: 'Mild' }),
      b: entry('b', { net: -1240, displayName: 'Granite' }),
    };
    assert.equal(deriveRoles(l).nemesis.displayName, 'Granite');
  });

  it('a grudge needs him to be DOWN — winning is not a grudge', () => {
    const l = { a: entry('a', { net: +500 }), b: entry('b', { net: +100 }) };
    assert.equal(deriveRoles(l).nemesis, null);
  });

  it('victim is the best net, and needs him to be up', () => {
    const l = {
      a: entry('a', { net: +880, displayName: 'doyle_v3' }),
      b: entry('b', { net: +120 }),
    };
    assert.equal(deriveRoles(l).victim.displayName, 'doyle_v3');
    assert.equal(deriveRoles({ a: entry('a', { net: -50 }) }).victim, null);
  });

  it('rival is the most hands, among opponents neither of them is beating', () => {
    const l = {
      grinder: entry('grinder', { hands: 388, net: +60, displayName: 'Phil_AI' }),
      brief:   entry('brief',   { hands: 40,  net: 0 }),
    };
    assert.equal(deriveRoles(l).rival.displayName, 'Phil_AI');
  });

  it('a lopsided history is not a rivalry however many hands it has', () => {
    const l = {
      lopsided: entry('lopsided', { hands: 400, net: -8000 }),
      even:     entry('even',     { hands: 60,  net: +30, displayName: 'Even Steven' }),
    };
    const bio = deriveRoles(l);
    assert.equal(bio.nemesis.playerId, 'lopsided');
    assert.equal(bio.rival.displayName, 'Even Steven');
  });

  it('nobody holds two roles at once', () => {
    const l = {
      one: entry('one', { hands: 500, net: -2000 }),
      two: entry('two', { hands: 400, net: +1500 }),
      three: entry('three', { hands: 300, net: +10 }),
    };
    const bio = deriveRoles(l);
    const ids = ROLES.map((r) => bio[r]?.playerId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('the closeness rule scales with the hands played', () => {
    // +200 over 40 hands is a beating; over 400 hands it is noise.
    const short = { s: entry('s', { hands: 40, net: 200 }) };
    const long = { l: entry('l', { hands: 400, net: 200 }) };
    assert.ok(200 > RIVAL_CLOSE_PER_HAND * 40);
    assert.equal(deriveRoles(short).rival, null);
    assert.equal(deriveRoles(long).rival?.playerId, 'l');
  });

  it('carries the fact each role is built on', () => {
    const l = { a: entry('a', { hands: 142, net: -1240, coolersTaken: 3, displayName: 'Granite' }) };
    const nem = deriveRoles(l).nemesis;
    assert.match(nem.evidence, /142 HANDS/);
    assert.match(nem.evidence, /3 COOLERS FROM HIM/);
    assert.match(nem.opinion, /Granite/);
    assert.match(nem.opinion, /1,240/);
  });

  it('says it in his own voice, not as a stat line', () => {
    const l = { a: entry('a', { hands: 96, net: +880, displayName: 'doyle_v3' }) };
    const v = deriveRoles(l).victim;
    assert.match(v.opinion, /I am not going to stop/);
    assert.doesNotMatch(v.opinion, /^net:|^\+?\d+$/);
  });

  it('is derived fresh every time, so it is reversible', () => {
    const l = { a: entry('a', { hands: 100, net: -1000, displayName: 'Granite' }) };
    assert.equal(deriveRoles(l).nemesis.displayName, 'Granite');
    l.a.net = +1000;                       // three good sessions later
    assert.equal(deriveRoles(l).nemesis, null);
    assert.equal(deriveRoles(l).victim.displayName, 'Granite');
  });

  it('survives a ledger full of nonsense', () => {
    assert.deepEqual(deriveRoles(null), { nemesis: null, rival: null, victim: null });
    assert.deepEqual(deriveRoles({}), { nemesis: null, rival: null, victim: null });
    assert.deepEqual(deriveRoles({ a: null }), { nemesis: null, rival: null, victim: null });
  });
});

describe('roleOf', () => {
  const bio = deriveRoles({
    g: entry('g', { hands: 142, net: -1240, displayName: 'Granite' }),
    d: entry('d', { hands: 96, net: +880, displayName: 'doyle_v3' }),
  });

  it('names the role an opponent holds', () => {
    assert.equal(roleOf(bio, 'g'), 'nemesis');
    assert.equal(roleOf(bio, 'd'), 'victim');
  });

  it('is null for a stranger', () => {
    assert.equal(roleOf(bio, 'nobody'), null);
    assert.equal(roleOf(null, 'g'), null);
    assert.equal(roleOf(bio, null), null);
  });
});

describe('the recap mention', () => {
  const bio = deriveRoles({
    g: entry('g', { hands: 142, net: -1240, displayName: 'Granite' }),
    d: entry('d', { hands: 96, net: +880, displayName: 'doyle_v3' }),
  });

  it('names the nemesis when he was actually at the table', () => {
    assert.equal(recapMention(bio, ['g', 'x']), 'Granite again. He owes me a cooler.');
  });

  it('says nothing when he was not', () => {
    assert.equal(recapMention(bio, ['x', 'y']), null);
    assert.equal(recapMention(bio, []), null);
  });

  it('prefers the nemesis when both were there', () => {
    assert.match(recapMention(bio, ['d', 'g']), /Granite/);
  });

  it('has something for the victim too', () => {
    assert.match(recapMention(bio, ['d']), /doyle_v3/);
  });
});

// ── THE LAW ─────────────────────────────────────────────────────────────────
describe('what the biography layer may touch', () => {
  it('exports nothing that returns a modifier', () => {
    // Every export is a ledger operation, a derivation, or a sentence. If one
    // of them ever returns a number meant to be added to an attribute, this
    // list is where it would have to be added first.
    const surface = [
      'ROLES', 'ROLE_MIN_HANDS', 'RIVAL_CLOSE_PER_HAND', 'LEDGER_CAP',
      'newLedgerEntry', 'ensureBio', 'recordLedgerHand', 'compressLedger',
      'deriveRoles', 'roleOf', 'recapMention',
    ];
    assert.deepEqual(surface.sort(), surface.slice().sort());
  });

  it('never writes an attribute, band, fatigue or strategy field', () => {
    const agent = {
      attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
      potential: { READS: { lo: 60, hi: 90 } },
      fatigue: 'settled',
      strategy: 'You are a tight aggressive player.',
      profile: { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 80 },
    };
    const before = JSON.stringify(agent);

    ensureBio(agent);
    for (let i = 0; i < 60; i++) {
      recordLedgerHand(agent.bioLedger, {
        playerId: 'g', displayName: 'Granite', net: -40, pot: 400,
        won: false, cooler: i % 10 === 0, showdown: true, handNumber: i,
      });
    }
    agent.bio = deriveRoles(agent.bioLedger);
    roleOf(agent.bio, 'g');
    recapMention(agent.bio, ['g']);

    const after = JSON.parse(JSON.stringify(agent));
    delete after.bio;
    delete after.bioLedger;
    assert.equal(JSON.stringify(after), before, 'the rest of the agent is untouched');
    assert.ok(agent.bio.nemesis, 'and the biography itself did form');
  });
});
