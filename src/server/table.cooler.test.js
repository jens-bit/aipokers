// src/server/table.cooler.test.js — SEAT-1b
//
// BIO-2 shipped a grudge ledger with two cooler counters and only one of them
// could ever move. table.js decided "cooler" from the agent's OWN equity on a
// hand he lost, so `coolersDealt` — the counter behind "I have coolered him
// twice" — was structurally pinned at 0 for every agent in the product.
//
// This deals one scripted cooler through the real Table and asserts both
// counters move, on the two sides of the same hand.
//
// Deterministic: plain seats, explicit actions, a stacked deck. No model calls,
// no timers.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { Table } from './table.js';
import { Actions } from '../engine/game.js';
import { installAgentProfileRoutes, getAgentBioLedger } from './agentProfiles.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

// Kings full of nines beats trip nines, all-in, on a board neither of them was
// ever folding. That is a cooler in any cardroom on earth.
const BOARD_DECK = ['3s', '9h', '9d', 'Kc', '4d', '2s', '5c', '7h'];
const HOLE = [['Kh', 'Ks'], ['Ah', '9s']];

let server;
let base;
const userId = 'cooler-e2e-user';
// SLOTS-1: agent slots are earned now — the second, third and fourth cost
// 10k / 50k / 250k in winnings. This suite needs two agents for reasons that
// have nothing to do with slots, so its owner is seeded as somebody whose
// stable has already won them. The ladder itself is asserted in slots.test.js.
import { saveWallet } from './store.js';
saveWallet('cooler-e2e-user', { ownerId: 'cooler-e2e-user', balance: 0, earned: 250_000, ledger: [] });


async function buildAgent(name) {
  await fetch(`${base}/api/agents/chat/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await fetch(`${base}/api/agents/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, message: `Call him ${name}. Tight and aggressive.` }),
  });
  const built = await fetch(`${base}/api/agents/build`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  }).then((r) => r.json());
  return built.createdAgent;
}

before(async () => {
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); });

test('SEAT-1b: a scripted cooler moves coolersDealt on the winner and coolersTaken on the loser', async () => {
  const winner = await buildAgent('Dealer');
  const loser  = await buildAgent('Taker');
  assert.ok(winner?.id && loser?.id && winner.id !== loser.id, 'two distinct agents were built');

  const table = new Table({ tableId: 'cooler-test', smallBlind: 10, bigBlind: 20, maxSeats: 2 });
  const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });
  table.seatPlayer(fakeWs(), { playerId: 'p0', buyIn: 1000, displayName: 'Dealer' });
  table.seatPlayer(fakeWs(), { playerId: 'p1', buyIn: 1000, displayName: 'Taker' });

  // Plain seats so every action is explicit, but reported as the agents they
  // stand for — this is the seat→agent link _recordBiographyHand reads.
  table.agentIds[0] = winner.id;
  table.agentIds[1] = loser.id;
  table.agentUserIds[0] = userId;
  table.agentUserIds[1] = userId;

  table.maybeStartHand({ clientDriven: true });
  const g = table.game;

  // Stack the deck: hole cards by hand, board off a scripted dealer.
  g.seats[0].holeCards = [...HOLE[0]];
  g.seats[1].holeCards = [...HOLE[1]];
  g.dealer.deck = [...BOARD_DECK];
  g.dealer.cursor = 0;

  // Get it all in preflop.
  let guard = 20;
  while (g.toAct !== null && g.toAct !== undefined && guard-- > 0) {
    const seat = g.toAct;
    const legal = g.legalActions(seat);
    const raise = legal.find((a) => a.type === Actions.RAISE);
    const call  = legal.find((a) => a.type === Actions.CALL);
    if (raise) table.applyAction(table.connections[seat], { type: Actions.RAISE, amount: raise.max });
    else if (call) table.applyAction(table.connections[seat], { type: Actions.CALL });
    else break;
  }

  assert.equal(g.result?.type, 'showdown', 'the scripted hand reached a showdown');
  assert.deepEqual(g.community, ['9h', '9d', 'Kc', '2s', '7h'], 'the scripted board ran out');
  assert.deepEqual(g.result.winners.map((w) => w.seat), [0], 'the full house won');

  // The two counters, on the two sides of the same hand.
  const dealt = ledgerEntry(winner.id, 'p1');
  const taken = ledgerEntry(loser.id, 'p0');

  assert.equal(dealt?.coolersDealt, 1, 'the winner is credited with dealing it — the counter BIO-2 could never move');
  assert.equal(dealt?.coolersTaken, 0, 'and not with taking it');
  assert.equal(taken?.coolersTaken, 1, 'the loser is credited with taking it');
  assert.equal(taken?.coolersDealt, 0, 'and not with dealing it');

  table.closeTable('test done');
});

// Read one row straight out of the stored ledger the bio card is derived from.
function ledgerEntry(agentId, opponentPlayerId) {
  return getAgentBioLedger(agentId, userId)?.[opponentPlayerId] ?? null;
}
