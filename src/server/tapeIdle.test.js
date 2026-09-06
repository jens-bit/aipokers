// src/server/tapeIdle.test.js — COST-1
//
// He puts the tape on himself: the pick, the bounds, and the two things the
// hand he keeps going back to does to him afterwards.
//
// One agent per claim rather than a reset between tests. agentProfiles caches
// the whole store in module state and loads it exactly once, so re-seeding the
// database underneath it would write rows nothing reads — see db() there. The
// fixture is therefore seeded ONCE, before that module is imported, with a
// separate character for every bound being asserted.

// TEST-2 / the testing law: no automated suite talks to a real model. Nothing
// in the tape room ever does, and this asserts it stays that way.
delete process.env.ANTHROPIC_API_KEY;

// Ninety seconds is the product; sixty milliseconds is the test.
process.env.HOME_STUDY_MS = '60';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildFlaggedEntry } from './flaggedHands.js';
import { _closeForTests } from './store.js';
import { Where } from './home.js';

const tape = await import('./tapeRoom.js');
const idle = await import('./tapeIdle.js');

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-tapeidle-'));
const DAY = 24 * 60 * 60 * 1000;

let profiles;

// A flagged hand as table.js builds one.
const flagged = (handNumber, flagType, { pot = 3000, won = false, ageDays = 0 } = {}) => ({
  ...buildFlaggedEntry({
    flagType,
    handNumber,
    pot,
    won,
    holeCards: ['Ah', 'Kd'],
    decisions: [{ street: 'flop', action: { type: 'bet', amount: 120 }, equity: 0.82, community: ['Ac', '7d', '2s'] }],
    opponentShowdownCards: [{ seat: 1, holeCards: ['7h', '7s'] }],
    opponents: [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }],
  }),
  flaggedAt: Date.now() - ageDays * DAY,
});

const mkAgent = (id, hands, extra = {}) => ({
  id,
  name: id,
  status: 'idle',
  activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: 3_000,
  pocket: { balance: 3_000, mode: 'topup', cap: null, realised: 0, ledger: [] },
  stats: { handsPlayed: 40, handsWon: 10, totalDecisions: 100 },
  sessionFlagged: hands,
  tape: { watches: {}, self: { day: null, count: 0 }, stack: 2000 },
  ...extra,
});

// A big recent bad beat next to a small old cooler: the ranking has to prefer
// the first without being told which is which.
const REAL_TAPE = [
  flagged(41, 'badBeat', { pot: 3600 }),
  flagged(20, 'cooler', { pot: 120, ageDays: 6 }),
];

// The presented shape tapeIdle reads — the same projection homeGame.eligible does.
const presented = (id, over = {}) => ({
  id,
  name: id,
  location: { where: Where.HOME, tableId: null, room: null, since: 0 },
  study: null,
  fatigue: 'fresh',
  ...over,
});

before(async () => {
  _closeForTests();
  process.chdir(dir);
  const store = await import('./store.js');
  store.saveProfile('idle', {
    userId: 'idle',
    chat: [],
    agents: [
      mkAgent('picker', REAL_TAPE),      // the pick, and the ledger
      mkAgent('opener', REAL_TAPE),      // the opener clause
      mkAgent('once', REAL_TAPE),        // one watch is not an obsession
      mkAgent('twice', REAL_TAPE),       // the twice-a-day cap
      mkAgent('tomorrow', REAL_TAPE),    // the day rollover
      mkAgent('busy', REAL_TAPE),        // already in the room
      mkAgent('sweeper', REAL_TAPE),     // the household sweep
      mkAgent('trivial', [flagged(9, 'heroCall', { pot: 40, ageDays: 6 })]),
      mkAgent('blank', []),
    ],
  });
  profiles = await import('./agentProfiles.js');
});

after(async () => {
  tape.reset();
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const openerOf = (id) =>
  profiles.presentedRoster('idle', { owner: true }).find((a) => a.id === id)?.opener ?? '';

// ── the pick ────────────────────────────────────────────────────────────────

test('the tape is ranked, and the top of it is the hand a person would pick', () => {
  const ranked = profiles.getAgentTape('picker', 'idle');
  assert.equal(ranked[0].handNumber, 41, 'the big recent beat, not the small old cooler');
  assert.ok(ranked[0].salience > ranked[1].salience);
});

test('he picks it himself when he is home with nothing on', () => {
  const study = idle.maybeStudy(presented('picker'), 'idle');
  assert.ok(study, 'he went and put it on');
  assert.equal(study.handNumber, 41);
  assert.equal(tape.isStudying('picker'), true);
});

test('watching is recorded when it STARTS, and the ledger counts repeats', () => {
  let watches = profiles.getTapeWatches('picker', 'idle');
  assert.equal(watches['41'].count, 1, 'the study above');
  assert.equal(watches['41'].won, false);
  assert.equal(watches['41'].flagType, 'badBeat');
  assert.equal(watches['41'].subject, 'Granite');

  tape.reset();                                   // he finished watching
  idle.maybeStudy(presented('picker'), 'idle');
  watches = profiles.getTapeWatches('picker', 'idle');
  assert.equal(watches['41'].count, 2, 'he went back to it');
});

test('a hand nobody would go back to is not worth the ninety seconds', () => {
  assert.equal(idle.pickHand('trivial', 'idle'), null);
  assert.equal(idle.maybeStudy(presented('trivial'), 'idle'), null);
});

test('an empty tape is a skip, not a crash', () => {
  assert.equal(idle.pickHand('blank', 'idle'), null);
  assert.equal(idle.maybeStudy(presented('blank'), 'idle'), null);
  assert.deepEqual(profiles.getAgentTape('blank', 'idle'), []);
  assert.equal(profiles.getAgentTape('nobody', 'idle'), null);
});

// ── the bounds ──────────────────────────────────────────────────────────────

test('idle means idle — a seat, a study or a worn man is none of it', () => {
  assert.equal(idle.idleAtHome(presented('picker')), true);
  assert.equal(idle.idleAtHome(presented('picker', { location: { where: Where.TABLE } })), false);
  assert.equal(idle.idleAtHome(presented('picker', { location: { where: Where.CASINO } })), false);
  assert.equal(idle.idleAtHome(presented('picker', { study: { handNumber: 41 } })), false);
  assert.equal(idle.idleAtHome(presented('picker', { fatigue: 'worn' })), false);
  assert.equal(idle.idleAtHome(null), false);
});

test('twice a day and no more', () => {
  assert.ok(idle.maybeStudy(presented('twice'), 'idle'), 'first');
  tape.reset();
  assert.ok(idle.maybeStudy(presented('twice'), 'idle'), 'second');
  tape.reset();
  assert.equal(idle.maybeStudy(presented('twice'), 'idle'), null, 'third, same day');
});

test('tomorrow he is allowed to watch something again', () => {
  const now = Date.UTC(2026, 8, 6, 12, 0, 0);
  assert.ok(idle.maybeStudy(presented('tomorrow'), 'idle', { now }));
  tape.reset();
  assert.ok(idle.maybeStudy(presented('tomorrow'), 'idle', { now }));
  tape.reset();
  assert.equal(idle.maybeStudy(presented('tomorrow'), 'idle', { now }), null);
  assert.ok(idle.maybeStudy(presented('tomorrow'), 'idle', { now: now + DAY }), 'a new day');
});

test('a man already in the tape room is not sent into it again', () => {
  assert.ok(idle.maybeStudy(presented('busy'), 'idle'));
  assert.equal(idle.maybeStudy(presented('busy'), 'idle'), null);
});

test('the sweep answers for the whole household and counts what it started', () => {
  const started = idle.sweep('idle', [
    presented('sweeper'),
    presented('picker', { location: { where: Where.TABLE } }),
    presented('blank'),
  ]);
  assert.equal(started, 1);
  assert.equal(idle.eligibleCount([presented('a'), presented('b', { fatigue: 'worn' })]), 1);
  assert.equal(idle.sweep('idle', null), 0);
});

// ── what watching does to him ───────────────────────────────────────────────

test('one watch is just watching — it takes two to be on his mind', () => {
  idle.maybeStudy(presented('once'), 'idle');
  tape.reset();
  assert.ok(!/Still thinking/.test(openerOf('once')), openerOf('once'));
});

test('the hand he keeps watching is named in his opener', () => {
  idle.maybeStudy(presented('opener'), 'idle');
  tape.reset();
  idle.maybeStudy(presented('opener'), 'idle');
  tape.reset();
  assert.match(openerOf('opener'), /Still thinking about that beat against Granite\./);
});

test('a hand he WON is named the same way — the tape is not a list of defeats', () => {
  // tapeObsession reads the record it is handed, so the claim can be made
  // against a literal rather than by playing out a session he wins.
  const agent = {
    name: 'Winner',
    tape: { watches: { 77: { count: 3, lastAt: Date.now(), won: true, flagType: 'biggestPot', subject: 'Doyle' } } },
    mood: { state: 'neutral', heat: 50 },
    stats: { handsPlayed: 40 },
  };
  assert.match(profiles.openerForAgent(agent), /Still thinking about that pot against Doyle\./);
});

test('the obsession carries the nudge it makes to where he rests', () => {
  const brooding = { tape: { watches: { 41: { count: 3, lastAt: Date.now(), won: false, flagType: 'badBeat', subject: 'Granite' } } } };
  assert.equal(profiles.tapeObsession(brooding).drift, 5, 'a beat winds him up');

  const pleased = { tape: { watches: { 41: { count: 3, lastAt: Date.now(), won: true, flagType: 'badBeat' } } } };
  assert.equal(profiles.tapeObsession(pleased).drift, -3, 'a win he replays settles him');

  assert.equal(profiles.tapeObsession({ tape: { watches: {} } }), null);
  assert.equal(profiles.tapeObsession(null), null);
});
