// src/server/handFacts.test.js — LIFE-2 job 2
//
// The supply half, at the seam it actually crosses.
//
// src/agent/talk.test.js proves that handFact() prints a board and a net when
// it is handed one. What is only testable HERE is that a real hand at a real
// table PUTS one there: the two fields travel table.js -> recordHandResult ->
// agent.recentHands -> the prompt, and every one of those hops is a place the
// pair could have been dropped without a single unit test noticing.
//
// The net is the one worth driving through the engine rather than asserting on
// a literal. `net` is not the pot — it is what the seat took out minus what it
// put in — and the two are equal only heads-up when the loser folded preflop.
// A test that hard-coded the number would pass on a build that quietly shipped
// the pot under the name `net`, which is exactly the bug the field exists to
// stop him repeating out loud.
//
// Seats are plain connections with an agent id patched on, driven by hand —
// the same shape table.session.test.js uses, for the same reason: no model
// call, no timer and no randomness anywhere near the assertions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-handfacts-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile } = await import('./store.js');
saveProfile('u1', {
  userId: 'u1',
  chat: [],
  agents: [
    { id: 'hero', name: 'Hero', status: 'playing', activeTableId: 'tbl',
      nature: { name: 'Rock' },
      pocket: { balance: 50_000, mode: 'auto', cap: 50_000, realised: 0, ledger: [] } },
    { id: 'rival', name: 'Rival', status: 'playing', activeTableId: 'tbl',
      pocket: { balance: 50_000, mode: 'auto', cap: 50_000, realised: 0, ledger: [] } },
  ],
});

const { Table } = await import('./table.js');
const { Actions } = await import('../engine/game.js');
const { setPersistEnabled } = await import('./opponentStats.js');
const { recordHandResult, _agentRecordForTests, buildAgentChatSystem } = await import('./agentProfiles.js');
const { handFact, selfFacts } = await import('../agent/talk.js');

setPersistEnabled(false);

function fakeWs() {
  return {
    readyState: 1, OPEN: 1, received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    of(type) { return this.received.filter((m) => m.type === type); },
  };
}

let seq = 0;
function seatedTable() {
  const table = new Table({ tableId: `hf-${seq++}`, smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const sockets = [];
  ['hero', 'rival'].forEach((agentId, i) => {
    const ws = fakeWs();
    table.seatPlayer(ws, { playerId: `p${i}`, buyIn: 1000, displayName: agentId });
    table.agentIds[i] = agentId;
    table.agentUserIds[i] = 'u1';
    table.seatSessionIds[i] = `sess-${table.tableId}-${i}`;
    table.seatSeatedAt[i] = Date.now() - 60_000;
    sockets.push(ws);
  });
  return { table, sockets };
}

/** Check/call the hand down to showdown. */
function playDown(table) {
  const before = table.handsThisSession;
  let safety = 400;
  while (table.game && table.handsThisSession === before && safety-- > 0) {
    const seat = table.game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = table.game.legalActions(seat);
    const pick = legal.find((a) => a.type === Actions.CHECK)
      ?? legal.find((a) => a.type === Actions.CALL)
      ?? { type: Actions.FOLD };
    table.applyAction(table.connections[seat], { type: pick.type });
  }
}

const heroHands = () => _agentRecordForTests('hero', 'u1').recentHands;

// ── the table writes them ───────────────────────────────────────────────────

test('LIFE-2: a real hand records what came and what it did to him', (t) => {
  const { table, sockets } = seatedTable();
  t.after(() => table._clearTimers());
  table.maybeStartHand({ clientDriven: true });
  playDown(table);

  const [msg] = sockets[0].of('hand_result');
  assert.ok(msg, 'the hand finished');

  const hand = heroHands()[0];
  assert.ok(hand, 'and it reached his record');

  // What came. Checked down heads-up, so all five are out.
  assert.equal(hand.board.length, 5, JSON.stringify(hand.board));
  assert.deepEqual(hand.board, msg.result.board ?? hand.board);

  // What it did to him — the ENGINE's number, not a figure this test invented.
  assert.equal(hand.net, Math.round(Number(msg.result.deltas[0])));
  assert.equal(
    Number(msg.result.deltas[0]) + Number(msg.result.deltas[1]), 0,
    'a hand moves chips, it never makes them',
  );

  // …and it is genuinely a different claim from the pot, which is what the
  // whole field is for. In a checked-down heads-up pot the winner's net is the
  // half of the pot that was never his.
  assert.notEqual(Math.abs(hand.net), hand.potSize, 'net is not the pot');
});

test('LIFE-2: a hand that ends before the flop records that it did', (t) => {
  const { table } = seatedTable();
  t.after(() => table._clearTimers());
  table.maybeStartHand({ clientDriven: true });
  // The first man to act gives it up: no flop, and somebody is down a blind.
  const seat = table.game.toAct;
  table.applyAction(table.connections[seat], { type: Actions.FOLD });

  const hand = heroHands()[0];
  assert.deepEqual(hand.board, [], 'nothing came, and that is a fact about the hand');
  assert.match(handFact(hand), /no flop/);
  assert.ok(Number.isFinite(hand.net), 'even a fold has a price');
});

// ── the prompt carries them ─────────────────────────────────────────────────

test('LIFE-2: and both reach the sentence he is given to speak from', () => {
  const agent = _agentRecordForTests('hero', 'u1');
  const facts = selfFacts(agent);
  assert.match(facts, /board [2-9TJQKA][shdc]/, facts);
  assert.match(facts, /(cost|made) you \d+/, facts);
  // Through the real prompt builder, not a copy of it.
  const prompt = buildAgentChatSystem(agent, { recentChat: [], said: 'what happened in that hand?' });
  assert.match(prompt, /A HAND YOU CITE IS A HAND YOU PLAYED/);
  assert.match(prompt, /Hand numbers: /);
});

// ── and the store keeps what it is handed ───────────────────────────────────

test('LIFE-2: the fields are additive — a hand written without them is unharmed', () => {
  // The pre-LIFE-2 call shape, which is still what a caller that has not been
  // updated sends. It must store, not throw, and must not fabricate a net: a
  // hand that cost him nothing and a hand whose cost was never written down are
  // different facts, and only one of them is safe to say out loud.
  recordHandResult('hero', 'u1', {
    won: true, potSize: 400, handNumber: 9001,
    decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }],
    holeCards: ['Ah', 'Kd'],
  });
  const hand = heroHands()[0];
  assert.equal(hand.handNumber, 9001);
  assert.deepEqual(hand.board, []);
  assert.equal(hand.net, null, 'unknown is null, never 0');
  assert.doesNotMatch(handFact(hand), /cost you|made you/);
});

test('LIFE-2: a net of zero is kept as zero', () => {
  recordHandResult('hero', 'u1', {
    won: false, potSize: 40, handNumber: 9002, holeCards: ['7h', '2c'],
    board: ['9c', '4d', '4s'], net: 0,
  });
  assert.equal(heroHands()[0].net, 0);
  assert.match(handFact(heroHands()[0]), /made you 0/);
});

// ── LIFE-3 job 1: and the fifth thing a hand is made of ─────────────────────
//
// The reason survived the whole way to the record already — every decision has
// carried `reasoning` since the first model call, and formatHandForPrompt reads
// it. What did not survive was any way to USE it: nothing picked the decisive
// decision out of the three to five in a hand, the prompt rebuilt the line with
// the reasons stripped out, and his heat and stamina at the time were never
// written down at all.
//
// Two seams, because they fail independently. The table has to WRITE the heat
// onto the decision, and the record has to turn a hand's decisions into one
// `why` and put it in the sentence he speaks from.

test('LIFE-3: the table writes his heat onto the decision he makes', async (t) => {
  const { chooseFromPolicy } = await import('../agent/policyPlay.js');
  const table = new Table({ tableId: `hw-${seq++}`, home: true, homeOwnerId: 'o', smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  t.after(() => table._clearTimers());
  table._broadcastState = () => {};
  table._maybeRunAiTurn = async () => {};
  table.seatAI({ displayName: 'One', stableId: 'a1', userId: 'u1', buyIn: 2000 });
  table.seatAI({ displayName: 'Two', stableId: 'a2', userId: 'u2', buyIn: 2000 });
  table.autoPlay = true;
  table.maybeStartHand();

  const seat = table.game.toAct;
  // The briefing he would really be handed, with a mood on it. `heat` is the
  // number the old context dropped: moodState is five words, and a hand played
  // at 78 and a hand played at 61 are both 'tilted'.
  const gs = {
    ...table._buildAiGameState(seat), seat, street: 'flop', nature: 'Shark',
    equity: 0.7, potOdds: 0.25, canCheck: false, canBet: false, canRaise: false, toCall: 10,
    mood: { state: 'tilted', heat: 78 }, fatigue: 'worn',
  };
  const expected = chooseFromPolicy(gs);
  table._buildAiGameState = () => gs;
  table.actionTimer = { seat, key: 'hw-turn', deadlineTs: Date.now() };
  await Table.prototype._maybeRunAiTurn.call(table);

  const d = table.currentHandDecisions.at(-1);
  assert.equal(d.attr.heat, 78, 'the number, not just the band');
  assert.equal(d.attr.moodState, 'tilted');
  assert.equal(d.attr.fatigue, 'worn');
  assert.equal(d.reasoning, expected.reasoning, 'and the reason he acted on');
});

test('LIFE-3: the record turns a hand into one why, and the prompt speaks from it', () => {
  recordHandResult('hero', 'u1', {
    won: false, potSize: 1450, handNumber: 9100,
    holeCards: ['Ah', 'Kd'], board: ['Qh', '7d', '2s', 'Kc', '3h'], net: -820,
    decisions: [
      { street: 'preflop', action: { type: 'raise', amount: 60 },
        reasoning: 'standard open', attr: { heat: 20, fatigue: 'fresh', moodState: 'neutral' } },
      { street: 'turn', action: { type: 'call', amount: 400 },
        reasoning: 'he fires every turn, I am not folding top pair',
        attr: { heat: 78, fatigue: 'worn', moodState: 'tilted' } },
    ],
  });
  const hand = heroHands()[0];
  // The DECISIVE one — the 400 he lost on, not the 60 he opened with.
  assert.equal(hand.why.street, 'turn');
  assert.equal(hand.why.action.amount, 400);
  assert.match(hand.why.reasoning, /not folding top pair/);
  assert.equal(hand.why.heat, 78);
  assert.equal(hand.why.stamina, 'worn');

  const facts = selfFacts(_agentRecordForTests('hero', 'u1'));
  assert.match(facts, /why: you turn called 400/, facts);
  assert.match(facts, /not folding top pair/, facts);
  assert.match(facts, /I was steaming/, facts);
});

test('LIFE-3: why is additive — a hand with no reason on file prints what it always did', () => {
  recordHandResult('hero', 'u1', {
    won: true, potSize: 300, handNumber: 9101, holeCards: ['Qs', 'Qc'],
    board: ['9c', '4d', '4s'], net: 140,
    decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }],
  });
  const hand = heroHands()[0];
  assert.equal(hand.why, null, 'nothing on file is null, never an empty shell');
  assert.doesNotMatch(handFact(hand), /why:/);
  assert.match(handFact(hand), /made you 140/, 'and everything else is unharmed');
});
