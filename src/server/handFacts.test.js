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
