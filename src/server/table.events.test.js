// src/server/table.events.test.js — EVENT-1
//
// One scripted hand per event type, driven through the real Table.
//
// The unit file next door (events.test.js) owns the ring, the ids and the
// heater window. This file owns the only question that file cannot answer: do
// the hooks in table.js actually fire, on the hands they are supposed to fire
// on, with the right names and the right pot?
//
// Deterministic: plain seats, explicit actions, a stacked deck where the
// showdown matters. No model calls, no timers, no sockets.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { Table } from './table.js';
import { Actions } from '../engine/game.js';
import {
  installAgentProfileRoutes, recordOpponentHand, finishAgentSession,
} from './agentProfiles.js';
import { setPersistEnabled } from './opponentStats.js';
import { EventType, eventsSince, resetEvents, bigPotThresholdBb, hotThresholdBb } from './events.js';

setPersistEnabled(false);
// Ten agents over two limited endpoints each would trip the LLM-spending
// limiter (10/min) halfway through the file. Raised before the routes are
// installed, which is where the limiter reads it.
process.env.RATE_LIMIT_CHAT_MAX = '500';
// Both thresholds are derived from this one dial, so pinning it pins the whole
// file's arithmetic: hot at 25bb (500 chips at 10/20), bigPot at 75bb (1500).
process.env.PACE_HEAT_BB = '25';

let server;
let base;
const userId = 'events-e2e-user';
let tableSeq = 0;

// The floor events themselves read nothing but table.agentIds, so most of this
// file names its agents rather than creating them: building one over REST
// costs more than every scripted hand in the file put together. The two
// nemesis tests are the exception — a grudge has to be stored on a real agent.
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

const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });

// Two seats, two names, two agents behind them. Plain (non-AI) seats so every
// action in these tests is explicit.
function seatTable({ names = ['Rounder', 'Taker'], agents = [null, null], buyIn = 1000 } = {}) {
  const table = new Table({
    tableId: `events-test-${++tableSeq}`, smallBlind: 10, bigBlind: 20, maxSeats: 2,
  });
  names.forEach((displayName, i) => {
    table.seatPlayer(fakeWs(), { playerId: `p${i}`, buyIn, displayName });
    table.agentIds[i] = agents[i];
    table.agentUserIds[i] = agents[i] ? userId : null;
  });
  return table;
}

const ofType = (type) => eventsSince(0).filter((e) => e.type === type);

before(async () => {
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

beforeEach(() => resetEvents());

// ── bigPot + bust + cooler ──────────────────────────────────────────────────
//
// Kings full of nines over trip nines, stacks in preflop. One hand, three
// events, which is the honest shape of it: a 100bb all-in cooler that leaves a
// man with nothing IS three things worth shouting about.

const COOLER_DECK = ['3s', '9h', '9d', 'Kc', '4d', '2s', '5c', '7h'];
const COOLER_HOLE = [['Kh', 'Ks'], ['Ah', '9s']];

function playScriptedCooler(table) {
  table.maybeStartHand({ clientDriven: true });
  const g = table.game;
  g.seats[0].holeCards = [...COOLER_HOLE[0]];
  g.seats[1].holeCards = [...COOLER_HOLE[1]];
  g.dealer.deck = [...COOLER_DECK];
  g.dealer.cursor = 0;

  let guard = 20;
  while (g.toAct !== null && g.toAct !== undefined && guard-- > 0) {
    const seat = g.toAct;
    const legal = g.legalActions(seat);
    const raise = legal.find((a) => a.type === Actions.RAISE);
    const call = legal.find((a) => a.type === Actions.CALL);
    if (raise) table.applyAction(table.connections[seat], { type: Actions.RAISE, amount: raise.max });
    else if (call) table.applyAction(table.connections[seat], { type: Actions.CALL });
    else break;
  }
  return g;
}

test('EVENT-1 bigPot: a pot past three times the heat threshold reaches the floor', () => {
  const [winner, loser] = ['agent-rounder', 'agent-taker'];
  const table = seatTable({ agents: [winner, loser] });

  const g = playScriptedCooler(table);
  assert.equal(g.result?.type, 'showdown', 'the scripted hand reached a showdown');
  assert.equal(g.result.pot, 2000, 'both 1000-chip stacks went in');

  const [ev, ...rest] = ofType(EventType.BIG_POT);
  assert.ok(ev, `a ${g.result.pot / 20}bb pot clears the ${bigPotThresholdBb()}bb bar`);
  assert.deepEqual(rest, [], 'and it is shouted once');
  assert.equal(ev.tableId, table.tableId);
  assert.equal(ev.pot, 2000);
  assert.equal(ev.headline, 'Rounder and Taker played a 100bb pot');
  assert.deepEqual([...ev.agentIds].sort(), [winner, loser].sort(), 'both agents are on it');

  table.closeTable('test done');
});

test('EVENT-1 bigPot: an ordinary pot is not news', () => {
  const table = seatTable();
  table.maybeStartHand({ clientDriven: true });
  const g = table.game;
  // The small blind gives it up preflop: a 20-chip pot, 1bb.
  table.applyAction(table.connections[g.toAct], { type: Actions.FOLD });

  assert.ok((g.result?.pot ?? 0) / 20 < bigPotThresholdBb());
  assert.deepEqual(ofType(EventType.BIG_POT), [], 'a fold for the blinds does not reach the ticker');
  table.closeTable('test done');
});

test('EVENT-1 cooler: cooler.js\'s classification is what the floor is told', () => {
  const [winner, loser] = ['agent-rounder', 'agent-taker'];
  const table = seatTable({ agents: [winner, loser] });

  playScriptedCooler(table);

  const [ev, ...rest] = ofType(EventType.COOLER);
  assert.ok(ev, 'kings full over trips, all-in, is a cooler');
  assert.deepEqual(rest, [], 'one hand, one cooler event');
  // The winner DEALT it and the loser TOOK it — the same symmetry SEAT-1b put
  // in the ledger, said out loud in the order a person says it.
  assert.equal(ev.headline, 'Rounder coolered Taker for 100bb');
  assert.equal(ev.pot, 2000);
  assert.deepEqual([...ev.agentIds], [winner, loser], 'dealer first, taker second');

  table.closeTable('test done');
});

test('EVENT-1 bust: a seat that hits zero is announced', () => {
  const [winner, loser] = ['agent-rounder', 'agent-taker'];
  const table = seatTable({ agents: [winner, loser] });

  const g = playScriptedCooler(table);
  assert.equal(g.seats[1].stack, 0, 'the loser has nothing left');
  assert.equal(g.seats[0].stack, 2000, 'and the winner has all of it');

  const [ev, ...rest] = ofType(EventType.BUST);
  assert.ok(ev, 'a seat at zero is a bust');
  assert.deepEqual(rest, [], 'only the seat that actually busted');
  assert.equal(ev.headline, 'Taker is out of chips');
  assert.deepEqual([...ev.agentIds], [loser], 'it is about him, not about the table');

  table.closeTable('test done');
});

// ── hot ─────────────────────────────────────────────────────────────────────

test('EVENT-1 hot: a big pot on the river is shouted BEFORE the showdown', () => {
  const table = seatTable();
  table.maybeStartHand({ clientDriven: true });
  const g = table.game;

  // Build a 600-chip pot preflop — 30bb, past the 25bb heat threshold — and
  // then check it down to the river so the betting is still open when it gets
  // there.
  const raise = g.legalActions(g.toAct).find((a) => a.type === Actions.RAISE);
  table.applyAction(table.connections[g.toAct], { type: Actions.RAISE, amount: 300 });
  assert.ok(raise, 'a raise was on offer');
  table.applyAction(table.connections[g.toAct], { type: Actions.CALL });
  assert.equal(g.pot, 600);

  assert.deepEqual(ofType(EventType.HOT), [], 'preflop, however big, is not the river');

  // Flop and turn, checked through.
  for (const street of ['flop', 'turn']) {
    assert.equal(g.street, street);
    table.applyAction(table.connections[g.toAct], { type: Actions.CHECK });
    assert.deepEqual(ofType(EventType.HOT), [], `nothing on the ${street}`);
    table.applyAction(table.connections[g.toAct], { type: Actions.CHECK });
  }

  assert.equal(g.street, 'river', 'the river is out');
  assert.equal(g.result ?? null, null, 'and the hand has NOT been decided — this is the point');
  assert.equal(g.community.length, 5);

  const [ev, ...rest] = ofType(EventType.HOT);
  assert.ok(ev, `a ${g.pot / 20}bb pot clears the ${hotThresholdBb()}bb bar`);
  assert.equal(ev.pot, 600);
  assert.equal(ev.headline, '30bb on the river, Rounder and Taker still live');
  assert.equal(ev.tableId, table.tableId);

  // Every river action calls _broadcastPace, and the ticker must not repeat.
  table.applyAction(table.connections[g.toAct], { type: Actions.CHECK });
  table.applyAction(table.connections[g.toAct], { type: Actions.CHECK });
  assert.deepEqual(rest, [], 'one hand, one hot event');
  assert.equal(ofType(EventType.HOT).length, 1, 'and the rest of the street does not repeat it');

  table.closeTable('test done');
});

test('EVENT-1 hot: a small river pot, and a river nobody is left to contest, stay quiet', () => {
  // (a) Two players on the river, but only a 2bb pot: not worth walking over.
  const quiet = seatTable();
  quiet.maybeStartHand({ clientDriven: true });
  const g = quiet.game;
  quiet.applyAction(quiet.connections[g.toAct], { type: Actions.CALL });
  quiet.applyAction(quiet.connections[g.toAct], { type: Actions.CHECK });
  for (let i = 0; i < 6 && g.street !== 'river'; i++) {
    quiet.applyAction(quiet.connections[g.toAct], { type: Actions.CHECK });
  }
  assert.equal(g.street, 'river');
  assert.ok(g.pot / 20 < hotThresholdBb(), `${g.pot / 20}bb is under the bar`);
  assert.deepEqual(ofType(EventType.HOT), [], 'a 2bb river is not a reason to change tables');
  quiet.closeTable('test done');

  // (b) A big pot that ends before the river: there is nothing to jump into.
  resetEvents();
  const folded = seatTable();
  folded.maybeStartHand({ clientDriven: true });
  const g2 = folded.game;
  folded.applyAction(folded.connections[g2.toAct], { type: Actions.RAISE, amount: 300 });
  folded.applyAction(folded.connections[g2.toAct], { type: Actions.FOLD });
  assert.ok(g2.result ?? null, 'the hand is over');
  assert.deepEqual(ofType(EventType.HOT), [], 'it never reached a river with two live seats');
  folded.closeTable('test done');
});

// ── heater ──────────────────────────────────────────────────────────────────

test('EVENT-1 heater: five hands of winning, and the floor hears about it once', () => {
  const [hot, cold] = ['agent-rounder', 'agent-taker'];
  const table = seatTable({ agents: [hot, cold], buyIn: 5000 });

  // Five hands in a row where seat 1 gives it up preflop. Seat 0 wins every
  // one of them, which is what a heater is.
  for (let hand = 1; hand <= 5; hand++) {
    table.maybeStartHand({ clientDriven: true });
    const g = table.game;
    let guard = 6;
    while (g.result == null && guard-- > 0) {
      const seat = g.toAct;
      if (seat === 1) table.applyAction(table.connections[1], { type: Actions.FOLD });
      else {
        const legal = g.legalActions(0);
        const call = legal.find((a) => a.type === Actions.CALL);
        table.applyAction(table.connections[0], call ? { type: Actions.CALL } : { type: Actions.CHECK });
      }
    }
    assert.ok(g.result?.winners?.some((w) => w.seat === 0), `seat 0 won hand ${hand}`);
    if (hand < 5) {
      assert.deepEqual(ofType(EventType.HEATER), [], `four in a row is not yet a heater (after ${hand})`);
    }
  }

  const [ev, ...rest] = ofType(EventType.HEATER);
  assert.ok(ev, 'five of the last five crosses the line');
  assert.deepEqual(rest, [], 'and it fires once, not on every hand it stays true for');
  assert.equal(ev.headline, 'Rounder has won 5 of the last 5');
  assert.deepEqual([...ev.agentIds], [hot], 'it is a claim about him, so only he is on it');
  assert.equal(ev.tableId, table.tableId);

  // A sixth win keeps it true and stays quiet.
  table.maybeStartHand({ clientDriven: true });
  const g = table.game;
  let guard = 6;
  while (g.result == null && guard-- > 0) {
    const seat = g.toAct;
    if (seat === 1) table.applyAction(table.connections[1], { type: Actions.FOLD });
    else {
      const call = g.legalActions(0).find((a) => a.type === Actions.CALL);
      table.applyAction(table.connections[0], call ? { type: Actions.CALL } : { type: Actions.CHECK });
    }
  }
  assert.equal(ofType(EventType.HEATER).length, 1, 'still hot, still not news');

  table.closeTable('test done');
});

// ── nemesisSeated ───────────────────────────────────────────────────────────

test('EVENT-1 nemesisSeated: he sits down across from the man he is losing to', async () => {
  const hero = await buildAgent('Rounder');
  const villain = 'agent-taker';

  // Build a real grudge the way the product does: enough hands, all of them
  // losing ones, then a session end to derive the roles (BIO-2b).
  for (let hand = 1; hand <= 40; hand++) {
    recordOpponentHand(hero.id, userId, {
      opponents: [{ playerId: 'p1', displayName: 'Taker' }],
      net: -200, pot: 400, won: false, showdown: true, handNumber: hand,
    });
  }
  finishAgentSession(hero.id, userId, { recap: 'rough one' });

  const table = seatTable({ agents: [hero.id, villain] });
  table.maybeStartHand({ clientDriven: true });

  const [ev, ...rest] = ofType(EventType.NEMESIS_SEATED);
  assert.ok(ev, 'the roster for the hand is settled, so this is when he notices');
  assert.deepEqual(rest, [], 'once per session per seat — the man arriving is a moment, not a state');
  assert.equal(ev.headline, 'Rounder sits down across from Taker');
  assert.equal(ev.pot, 0, 'nothing has been played yet');
  assert.deepEqual([...ev.agentIds].sort(), [hero.id, villain].sort(), 'both sides of the grudge');

  // Deal again: he does not re-notice a man who was already sitting there.
  resetEvents();
  let guard = 6;
  const g = table.game;
  while (g.result == null && guard-- > 0) {
    table.applyAction(table.connections[g.toAct], { type: Actions.FOLD });
  }
  table.maybeStartHand({ clientDriven: true });
  assert.deepEqual(ofType(EventType.NEMESIS_SEATED), [], 'the second hand is not news');

  table.closeTable('test done');
});

test('EVENT-1 nemesisSeated: an agent with no grudge says nothing', async () => {
  // A real agent, with a real (empty) bio: nobody is his nemesis yet.
  const a = await buildAgent('Stranger');
  const table = seatTable({ agents: [a.id, 'agent-taker'] });
  table.maybeStartHand({ clientDriven: true });
  assert.deepEqual(ofType(EventType.NEMESIS_SEATED), [], 'strangers are not a story');
  table.closeTable('test done');
});
