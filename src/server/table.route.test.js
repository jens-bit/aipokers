// src/server/table.route.test.js — COST-1
//
// The router, the tempo and the talk, asserted at the table rather than in the
// pure modules — the claims here are about WIRING, and wiring is exactly what
// a pure test cannot see.
//
// Deterministic: plain seats, explicit actions, no model calls, no waiting.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Table } from './table.js';
import { Actions } from '../engine/game.js';
import { routeFor, Route, Reason } from './router.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });

let seq = 0;
function dealt({ maxSeats = 2, home = false, buyIn = 2000 } = {}) {
  const table = new Table({
    tableId: `route-${++seq}-${Math.random().toString(36).slice(2)}`,
    smallBlind: 10, bigBlind: 20, maxSeats, home,
  });
  for (let i = 0; i < maxSeats; i++) {
    table.seatPlayer(fakeWs(), { playerId: `p${i}`, buyIn, displayName: `P${i}` });
  }
  table.maybeStartHand({ clientDriven: true });
  return table;
}

// The briefing the router actually reads, for whoever is on the clock.
function briefingFor(table, seat = null) {
  const s = seat ?? table.game.toAct;
  table.aiSeats[s] = true;
  return table._buildAiGameState(s);
}

// ── the game state carries what the router needs ────────────────────────────

test('COST-1: the briefing tells the router whether a stack is already in', () => {
  const table = dealt();
  const gs = briefingFor(table);
  assert.equal(gs.anyAllIn, false);
  assert.equal(typeof gs.equity === 'number' || gs.equity === null, true);
});

test('COST-1: an all-in seat shows up on the briefing the router reads', () => {
  const table = dealt({ buyIn: 200 });
  const seat = table.game.toAct;
  table.applyAction(table.connections[seat], { type: Actions.RAISE, amount: 200 });
  assert.equal(briefingFor(table).anyAllIn, true);
});

// ── the router runs against real hands ──────────────────────────────────────

test('COST-1: a real preflop briefing routes somewhere, with a reason and a tag', () => {
  const table = dealt();
  const routed = routeFor(briefingFor(table), { home: false });
  assert.ok(routed.route === Route.POLICY || routed.route === Route.MODEL);
  assert.ok(Object.values(Reason).includes(routed.reason), routed.reason);
  assert.equal(routed.tag, `${routed.route}/${routed.reason}`);
  assert.ok(routed.options >= 1, 'a real hand always has at least one thing to do');
});

test('COST-1: the kitchen table never routes a decision to a model', () => {
  const table = dealt({ home: true });
  const routed = routeFor(briefingFor(table), { home: table.home });
  assert.equal(routed.route, Route.POLICY);
  assert.equal(routed.reason, Reason.HOME);
});

test('COST-1: a pot past the heat threshold routes to the model at a real table', () => {
  const table = dealt();
  const seat = table.game.toAct;
  // 25bb is PACE_HEAT_BB's default; 600 into a 10/20 game is well past it.
  table.applyAction(table.connections[seat], { type: Actions.RAISE, amount: 600 });
  const routed = routeFor(briefingFor(table), { home: false });
  assert.equal(routed.route, Route.MODEL);
});

// ── the tempo ───────────────────────────────────────────────────────────────

test('COST-1: watched is a spectator or a human in a seat, derived every time', () => {
  const table = dealt();
  // Two connected human seats.
  assert.equal(table.isWatched(), true);

  // An AI-only table with nobody looking at it.
  const ai = dealt();
  ai.connections = ai.connections.map(() => null);
  ai.aiSeats = ai.aiSeats.map(() => true);
  assert.equal(ai.isWatched(), false);

  ai.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  assert.equal(ai.isWatched(), true, 'a spectator is somebody');
});

test('COST-1: an unwatched autonomous table deals at a walking pace', () => {
  const table = dealt();
  table.connections = table.connections.map(() => null);
  table.aiSeats = table.aiSeats.map(() => true);
  table.autoPlay = true;
  table._handPauseNamed = false;
  table.handPauseMs = 8000;

  assert.equal(table._dealPauseMs(), 25_000, 'nobody is there');

  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  assert.equal(table._dealPauseMs(), 8000, 'and it snaps back the moment somebody is');
});

test('COST-1: a tempo somebody asked for is never second-guessed', () => {
  const table = dealt();
  table.connections = table.connections.map(() => null);
  table.aiSeats = table.aiSeats.map(() => true);
  table.autoPlay = true;
  table._handPauseNamed = true;
  table.handPauseMs = 500;
  assert.equal(table._dealPauseMs(), 500, 'the e2e scripts mean their 500ms');
});

test('COST-1: the kitchen table keeps its own tempo whoever is watching', () => {
  const table = dealt({ home: true });
  table.connections = table.connections.map(() => null);
  table.aiSeats = table.aiSeats.map(() => true);
  table.autoPlay = true;
  table._handPauseNamed = false;
  table.handPauseMs = 30_000;
  assert.equal(table._dealPauseMs(), 30_000);
});

test('COST-1: a table that never went autonomous keeps the old 2.5s', () => {
  const table = dealt();
  table.autoPlay = false;
  assert.equal(table._dealPauseMs(), 2500);
});

// ── one bubble per face per hand ────────────────────────────────────────────

test('COST-1: an agent says one thing per hand, whichever path produced it', () => {
  const table = dealt();
  table.aiSeats[0] = true;
  assert.equal(table._speakOnce(0, 'That was mine.'), true);
  assert.equal(table._speakOnce(0, 'And so was that.'), false, 'twice in one hand is once too many');
  assert.equal(table.chatHistory.filter((c) => c.seat === 0).length, 1);
});

test('COST-1: nothing is said for an empty line or an empty seat', () => {
  const table = dealt();
  table.aiSeats[0] = true;
  assert.equal(table._speakOnce(0, '   '), false);
  assert.equal(table._speakOnce(0, null), false);
  assert.equal(table._speakOnce(1, 'anything'), false, 'seat 1 is not an AI here');
  assert.equal(table.chatHistory.length, 0);
});

// ── a human typing does not buy a model call any more ───────────────────────

test('COST-1: what somebody says is queued for the agents, not answered per remark', () => {
  const table = dealt();
  table.aiSeats[1] = true;
  table._hearFromTable('Still folding, then?', 0);
  assert.equal(table.pendingNeedle[1], 'Still folding, then?');
  assert.equal(table.pendingNeedle[0], null, 'the speaker does not needle himself');
  // And the briefing carries it, which is what the router reads as a reason.
  assert.equal(table._buildAiGameState(1).tableTalk, 'Still folding, then?');
});

test('COST-1: a House regular answers from his own lines, immediately and free', () => {
  const table = dealt();
  table.aiSeats[1] = true;
  table.seatTalkLines[1] = ['Sit down.'];
  table._hearFromTable('Anyone home?', 0);
  assert.equal(table.pendingNeedle[1], null, 'he answered rather than queueing');
  assert.deepEqual(table.chatHistory.map((c) => c.text), ['Sit down.']);
});

test('COST-1: an empty line reaches nobody', () => {
  const table = dealt();
  table.aiSeats[1] = true;
  table._hearFromTable('   ', 0);
  table._hearFromTable(null, 0);
  assert.equal(table.pendingNeedle[1], null);
});

// ── the moments an unwatched session is written up from ─────────────────────

test('COST-1: a flagged hand becomes one sentence for the write-up', () => {
  const table = dealt();
  table._noteMoment(0, 'badBeat', 900, false);
  table._noteMoment(1, 'bigBluff', 400, true);
  table._noteMoment(0, 'somethingUnknown', 100, true);
  assert.equal(table.sessionMoments.length, 2, 'an unknown flag says nothing rather than something vague');
  assert.match(table.sessionMoments[0], /was a long way in front and lost 900/);
  assert.match(table.sessionMoments[1], /took 400 off the table with nothing/);
});

test('COST-1: the moment list is bounded — an evening is not a hundred things', () => {
  const table = dealt();
  for (let i = 0; i < 40; i++) table._noteMoment(0, 'cooler', 100 + i, false);
  assert.equal(table.sessionMoments.length, 12);
});

test('COST-1: a watched session is not written up — he already watched it', () => {
  const table = dealt();
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  table._writeNightRecap();
  assert.equal(table._recapWritten, false, 'it did not even claim the write');
});

test('COST-1: a session he watched and then closed his phone on is not written up', () => {
  const table = dealt();
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  assert.equal(table.isWatched(), true);

  // He shuts the app. The table plays on and eventually closes with nobody
  // attached — but the evening was watched, and handing him a write-up of the
  // session he just sat through is worse than handing him nothing.
  table.spectators.length = 0;
  table.connections = table.connections.map(() => null);
  assert.equal(table.isWatched(), false);
  table._writeNightRecap();
  assert.equal(table._recapWritten, false);
});

test('COST-1: the kitchen table is never written up either', () => {
  const table = dealt({ home: true });
  table.connections = table.connections.map(() => null);
  table._writeNightRecap();
  assert.equal(table._recapWritten, false);
});

// ── the route counter ───────────────────────────────────────────────────────

test('COST-1: a fresh table has counted nothing rather than claiming a share', () => {
  const table = dealt();
  assert.equal(table.routes.total, 0);
  assert.equal(table.routes.policy, 0);
  assert.equal(table.routes.model, 0);
  assert.deepEqual(table.routes.byReason, {});
});
