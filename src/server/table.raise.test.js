// src/server/table.raise.test.js — RAISE-1
//
// Playtest: agents re-raising the minimum on one street until the stacks were
// in. Slow, and not poker. Two rules stop it, and both are enforced at the
// table rather than asked for in the prompt — a model offered "raise 10-1000"
// keeps taking the 10.
//
// Deterministic: plain seats, explicit actions, no model calls, no timers.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Table } from './table.js';
import { Actions } from '../engine/game.js';
import { raiseCapPerStreet } from './pace.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });

// Two plain seats at 10/20 with deep stacks, one hand dealt. Plain so every
// action is explicit; a seat is marked AI only where the test needs the
// briefing, because _raiseOffer and _disciplineAction do not care.
function dealt({ buyIn = 2000, buyIns = null } = {}) {
  const stacks = buyIns ?? [buyIn, buyIn];
  const table = new Table({
    tableId: `raise-${Math.random().toString(36).slice(2)}`,
    smallBlind: 10, bigBlind: 20, maxSeats: 2,
  });
  table.seatPlayer(fakeWs(), { playerId: 'p0', buyIn: stacks[0], displayName: 'P0' });
  table.seatPlayer(fakeWs(), { playerId: 'p1', buyIn: stacks[1], displayName: 'P1' });
  table.maybeStartHand({ clientDriven: true });
  return table;
}

// Build a pot worth raising into and get to the flop. The floor is a FRACTION
// OF THE POT, so it only bites once there is a pot — heads-up preflop the
// engine's own minimum is already the bigger number, which is correct and is
// not the case playtest complained about.
function toFlop(table, raiseTotal) {
  raiseTo(table, raiseTotal);
  table.applyAction(table.connections[table.game.toAct], { type: Actions.CALL });
  assert.equal(table.game.street, 'flop');
  return table;
}

// Raise to `to` from whoever is on the clock, through the table so the
// per-street counter moves the way a real action moves it.
function raiseTo(table, to) {
  const seat = table.game.toAct;
  table.applyAction(table.connections[seat], { type: Actions.RAISE, amount: to });
  return seat;
}

function capTheStreet(table) {
  let to = 60;
  for (let i = 0; i < raiseCapPerStreet(); i++) {
    raiseTo(table, to);
    to += 200;
  }
}

// -- (a) the min-raise floor -------------------------------------------------

test('RAISE-1a: an undersized bet into a real pot is rounded up to a third of it', () => {
  const table = toFlop(dealt(), 200);   // 400-chip pot on the flop
  const g = table.game;
  const seat = g.toAct;
  const engineMin = g.legalActions(seat).find((a) => a.type === Actions.BET).min;
  assert.equal(engineMin, 20, 'the engine would happily take one big blind');

  // The loop, exactly as playtest saw it: the smallest legal number, every turn.
  const played = table._disciplineAction(seat, { type: 'bet', amount: engineMin });

  const floor = g.currentBet + Math.ceil(g.pot / 3);
  assert.equal(played.amount, Math.max(engineMin, floor));
  assert.ok(played.amount > engineMin,
    `expected a lift above the engine minimum ${engineMin}, got ${played.amount}`);
});

test('RAISE-1a: and the same on a re-raise, where currentBet is not zero', () => {
  const table = toFlop(dealt(), 200);
  // Somebody bets the flop, so the next aggressive action is a raise.
  table.applyAction(table.connections[table.game.toAct], { type: Actions.BET, amount: 150 });
  const g = table.game;
  const seat = g.toAct;
  const engineMin = g.legalActions(seat).find((a) => a.type === Actions.RAISE).min;

  const played = table._disciplineAction(seat, { type: 'raise', amount: engineMin });
  assert.equal(played.amount, Math.max(engineMin, g.currentBet + Math.ceil(g.pot / 3)));
});

test('RAISE-1a: a raise that already clears the floor is left alone', () => {
  const table = toFlop(dealt(), 200);
  const seat = table.game.toAct;
  const big = { type: 'bet', amount: 400 };
  assert.deepEqual(table._disciplineAction(seat, big), big);
});

test('RAISE-1a: a call or a fold is never touched', () => {
  const table = dealt();
  const seat = table.game.toAct;
  assert.deepEqual(table._disciplineAction(seat, { type: 'call' }), { type: 'call' });
  assert.deepEqual(table._disciplineAction(seat, { type: 'fold' }), { type: 'fold' });
});

test('RAISE-1a: the floor never exceeds the jam, so a short stack can still shove', () => {
  // A 300-chip pot and 50 chips behind: a third of the pot is more than he has.
  // The short stack is seat 1 because heads-up it is the non-button who is
  // first to act after the flop, and he is the one this test is about.
  const table = toFlop(dealt({ buyIns: [2000, 200] }), 150);
  const seat = table.game.toAct;
  assert.equal(seat, 1);
  const offer = table._raiseOffer(seat, 'bet');
  assert.ok(offer, 'a bet is still legal');
  assert.ok(Math.ceil(table.game.pot / 3) > offer.max,
    'the setup must actually put a third of the pot out of his reach');
  assert.equal(offer.min, offer.max, 'the floor collapses onto the jam rather than becoming illegal');

  const played = table._disciplineAction(seat, { type: 'bet', amount: offer.engineMin });
  assert.equal(played.amount, offer.max);
});

test('RAISE-1a: the briefing offers the disciplined minimum, not the engine one', () => {
  const table = toFlop(dealt(), 200);
  const seat = table.game.toAct;
  table.aiSeats[seat] = true;
  const gs = table._buildAiGameState(seat);
  const engineMin = table.game.legalActions(seat).find((a) => a.type === Actions.BET).min;
  assert.ok(gs.canBet);
  assert.equal(gs.minBet, table._raiseOffer(seat, 'bet').min);
  assert.ok(gs.minBet > engineMin, 'the agent must never be shown the +20');
  assert.equal(gs.raiseCapped, false);
});

// -- (b) the four-raise cap --------------------------------------------------

test('RAISE-1b: after the cap the only raise on offer is the jam', () => {
  const table = dealt();
  const cap = raiseCapPerStreet();
  assert.equal(cap, 4);

  capTheStreet(table);   // open, raise, re-raise, cap
  assert.equal(table._getRaiseCountThisStreet(), cap);
  assert.equal(table.game.street, 'preflop',
    'the street must still be live for the cap to mean anything');

  const seat = table.game.toAct;
  const offer = table._raiseOffer(seat, 'raise');
  assert.ok(offer, 'a raise is still legal — it is the jam');
  assert.equal(offer.capped, true);
  assert.equal(offer.min, offer.max, 'call, fold or all-in — there is no smaller raise');
  assert.equal(offer.max, table.game.legalActions(seat).find((a) => a.type === Actions.RAISE).max);
});

test('RAISE-1b: a small raise past the cap becomes the all-in', () => {
  const table = dealt();
  capTheStreet(table);

  const seat = table.game.toAct;
  const jam = table.game.legalActions(seat).find((a) => a.type === Actions.RAISE).max;
  const played = table._disciplineAction(seat, { type: 'raise', amount: 900 });
  assert.equal(played.amount, jam,
    'the fifth min-raise is the thing that made this take forever');
});

test('RAISE-1b: the briefing says the street is capped', () => {
  const table = dealt();
  capTheStreet(table);

  const seat = table.game.toAct;
  table.aiSeats[seat] = true;
  const gs = table._buildAiGameState(seat);
  assert.equal(gs.raiseCapped, true);
  assert.equal(gs.raiseCap, raiseCapPerStreet());
  assert.equal(gs.minRaise, gs.maxRaise);
  // Call and fold are still there — the cap removes escalation, not the hand.
  assert.ok(gs.toCall > 0);
});

test('RAISE-1b: the count is per street, so a new street starts uncapped', () => {
  const table = dealt();
  capTheStreet(table);
  assert.equal(table._getRaiseCountThisStreet(), raiseCapPerStreet());

  // Close the street.
  const seat = table.game.toAct;
  table.applyAction(table.connections[seat], { type: Actions.CALL });
  assert.equal(table.game.street, 'flop');
  assert.equal(table._getRaiseCountThisStreet(), 0);
  const offer = table._raiseOffer(table.game.toAct, 'bet');
  if (offer) assert.equal(offer.capped, false);
});

// -- the loop itself ---------------------------------------------------------

test('RAISE-1: a street of nothing but minimum raises now terminates', () => {
  const table = dealt();
  // Every action is the smallest thing the agent could ask for, disciplined by
  // the table on the way in — the exact shape of the playtest loop.
  let guard = 40;
  let actions = 0;
  while (table.game && table.game.street === 'preflop' && guard-- > 0) {
    const seat = table.game.toAct;
    if (seat === null || seat === undefined) break;
    const offer = table._raiseOffer(seat, 'raise') ?? table._raiseOffer(seat, 'bet');
    if (!offer) break;
    const played = table._disciplineAction(seat, { type: offer.type, amount: offer.engineMin });
    table.applyAction(table.connections[seat], played);
    actions++;
  }
  // Before RAISE-1 this ran to the guard: +20 a time into a 2000-chip stack.
  assert.ok(actions <= raiseCapPerStreet() + 1, `street took ${actions} aggressive actions`);
});
