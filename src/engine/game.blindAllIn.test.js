import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, Streets } from './game.js';
import { createDeck } from './deck.js';

function deal(stacks, dealerSeat = 0) {
  const game = new Game({ tableId: 'blind-all-in', smallBlind: 10, bigBlind: 20, dealerSeat,
    seats: stacks.map((stack, i) => ({ playerId: `p${i}`, stack })) });
  game.startHand(createDeck());
  return game;
}

function conserved(game, initial) {
  assert.equal(game.seats.reduce((sum, p) => sum + p.stack, 0) + game.pot, initial.reduce((sum, n) => sum + n, 0));
  assert.equal(Object.values(game.result.deltas).reduce((sum, delta) => sum + delta, 0), 0);
  game.seats.forEach((p, i) => assert.equal(p.stack - initial[i], game.result.deltas[i]));
}

test('BUG-254: a heads-up small blind all-in runs out without asking that seat to act', () => {
  for (const dealer of [0, 1]) {
    const stacks = dealer === 0 ? [4, 3844] : [3844, 4];
    const game = deal(stacks, dealer);
    assert.equal(game.street, Streets.COMPLETE);
    assert.equal(game.toAct, null);
    assert.equal(game.community.length, 5);
    assert.equal(game.result.pot, 8, 'the uncalled sixteen chips return before showdown');
    conserved(game, stacks);
  }
});

test('BUG-254: an all-in big blind below the small blind refunds excess and runs out', () => {
  const stacks = [1000, 3], game = deal(stacks);
  assert.equal(game.street, Streets.COMPLETE);
  assert.equal(game.result.pot, 6);
  conserved(game, stacks);
});

test('BUG-254: an all-in big blind above the small blind still gives the opponent a call or fold', () => {
  for (const response of ['call', 'fold']) {
    const stacks = [1000, 15], game = deal(stacks);
    assert.equal(game.street, Streets.PREFLOP);
    assert.equal(game.toAct, 0);
    assert.equal(game.legalActions(0).find(a => a.type === 'call').amount, 5);
    game.act(0, { type: response });
    assert.equal(game.street, Streets.COMPLETE);
    assert.equal(game.community.length, response === 'call' ? 5 : 0);
    assert.equal(game.result.type, response === 'call' ? 'showdown' : 'uncontested');
    conserved(game, stacks);
  }
});

test('BUG-254: two all-in blinds do not skip the uncommitted multiway player', () => {
  const stacks = [1000, 4, 8], game = deal(stacks);
  assert.equal(game.street, Streets.PREFLOP);
  assert.equal(game.toAct, 0);
  game.act(0, { type: 'call' });
  assert.equal(game.street, Streets.COMPLETE);
  assert.equal(game.result.pot, 20);
  conserved(game, stacks);
});

test('BUG-254: one all-in blind leaves normal betting between two live multiway seats', () => {
  const stacks = [1000, 4, 1000], game = deal(stacks);
  assert.equal(game.toAct, 0);
  game.act(0, { type: 'call' });
  assert.equal(game.toAct, 2, 'skip the all-in small blind');
  game.act(2, { type: 'check' });
  assert.equal(game.street, Streets.FLOP);
  let guard = 0;
  while (game.street !== Streets.COMPLETE) {
    assert.ok(guard++ < 30);
    assert.equal(game.seats[game.toAct].allIn, false);
    game.act(game.toAct, { type: 'check' });
  }
  assert.equal(game.result.pot, 44);
  conserved(game, stacks);
});
