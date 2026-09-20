import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, Streets } from './game.js';
import { createDeck } from './deck.js';

function deal(stacks) {
  const game = new Game({ tableId: 'raise-rights', smallBlind: 10, bigBlind: 20,
    seats: stacks.map((stack, i) => ({ playerId: `p${i}`, stack })) });
  game.startHand(createDeck());
  return game;
}

// Every player calls the blinds; the supplied stacks are what they have on
// the flop. Postflop order is 1, 2, ... 0, so the assertions use real actions.
function flop(stacks) {
  const game = deal(stacks.map(stack => stack + 20));
  while (game.street === Streets.PREFLOP) {
    const legal = game.legalActions(game.toAct);
    game.act(game.toAct, { type: legal.some(a => a.type === 'check') ? 'check' : 'call' });
  }
  assert.equal(game.street, Streets.FLOP);
  assert.equal(game.toAct, 1);
  return game;
}

const raise = game => game.legalActions(game.toAct).find(action => action.type === 'raise');
const chips = game => game.pot + game.seats.reduce((sum, seat) => sum + seat.stack, 0);

function shortRaise() {
  const game = flop([1000, 1000, 150]);
  game.act(1, { type: 'bet', amount: 100 });
  game.act(2, { type: 'raise', amount: 150 });
  game.act(0, { type: 'call' });
  assert.equal(game.toAct, 1);
  return game;
}

test('BUG-285: a short all-in offers the previous bettor only call or fold', () => {
  const game = shortRaise();
  assert.deepEqual(game.legalActions(1), [{ type: 'fold' }, { type: 'call', amount: 50 }]);
});

test('BUG-285: direct raise enforcement rejects reopening without moving a chip', () => {
  const game = shortRaise(), before = structuredClone(game.getState());
  assert.throws(() => game.act(1, { type: 'raise', amount: 1000 }), /not reopened/);
  assert.deepEqual(game.getState(), before, 'a refused action leaves cards, turn, pot and stacks unchanged');
  game.act(1, { type: 'call' });
  assert.equal(game.street, Streets.TURN);
});

test('BUG-285: an unacted player can raise over a short jam and a full raise reopens the bettor', () => {
  const game = flop([1000, 1000, 150]);
  game.act(1, { type: 'bet', amount: 100 });
  game.act(2, { type: 'raise', amount: 150 });
  assert.equal(game.toAct, 0);
  assert.deepEqual(raise(game), { type: 'raise', min: 250, max: 1000 });
  game.act(0, { type: 'raise', amount: 250 });
  assert.equal(game.toAct, 1);
  assert.deepEqual(raise(game), { type: 'raise', min: 350, max: 1000 });
  game.act(1, { type: 'raise', amount: 350 });
  assert.equal(chips(game), 2210);
});

test('BUG-285: cumulative short all-ins reopen only once they reach a full raise', () => {
  for (const finalBet of [199, 200]) {
    const game = flop([1000, 1000, 150, finalBet]);
    game.act(1, { type: 'bet', amount: 100 });
    game.act(2, { type: 'raise', amount: 150 });
    game.act(3, { type: 'raise', amount: finalBet });
    game.act(0, { type: 'call' });
    assert.equal(game.toAct, 1);
    assert.equal(game.lastRaiseSize, 100, 'short jams do not lower or compound the minimum increment');
    if (finalBet === 199) assert.equal(raise(game), undefined);
    else {
      assert.deepEqual(raise(game), { type: 'raise', min: 300, max: 1000 });
      game.act(1, { type: 'raise', amount: 300 });
    }
  }
});

test('BUG-285: a caller between short jams faces only the increase since his own call', () => {
  const stacks = [1000, 1000, 150, 1000, 200], game = flop(stacks);
  const total = chips(game);
  game.act(1, { type: 'bet', amount: 100 });
  game.act(2, { type: 'raise', amount: 150 });
  game.act(3, { type: 'call' });
  game.act(4, { type: 'raise', amount: 200 });
  game.act(0, { type: 'call' });
  assert.ok(raise(game), 'the original bettor now faces a full cumulative raise');
  game.act(1, { type: 'call' });
  assert.equal(game.toAct, 3);
  assert.equal(raise(game), undefined, 'the intervening caller faces only fifty more');
  game.act(3, { type: 'call' });
  assert.equal(game.street, Streets.TURN);
  assert.ok(game.legalActions(game.toAct).some(action => action.type === 'bet'), 'a new street restores betting rights');
  let turns = 0;
  while (game.street !== Streets.COMPLETE) {
    assert.ok(turns++ < 30);
    game.act(game.toAct, { type: 'check' });
  }
  assert.equal(chips(game), total);
  assert.equal(game.result.winners.reduce((sum, winner) => sum + winner.amount, 0), game.result.pot);
  assert.equal(Object.values(game.result.deltas).reduce((sum, delta) => sum + delta, 0), 0);
});

test('BUG-285: the big blind retains an unacted option but an earlier caller cannot reopen a short preflop jam', () => {
  const game = deal([1000, 35, 1000]);
  game.act(0, { type: 'call' });
  game.act(1, { type: 'raise', amount: 35 });
  assert.equal(game.toAct, 2);
  assert.deepEqual(raise(game), { type: 'raise', min: 55, max: 1000 });
  game.act(2, { type: 'call' });
  assert.equal(game.toAct, 0);
  assert.equal(raise(game), undefined);
});

test('BUG-285: an opening all-in below the minimum bet does not reopen an earlier check', () => {
  const game = flop([5, 1000, 1000]);
  game.act(1, { type: 'check' });
  game.act(2, { type: 'check' });
  game.act(0, { type: 'bet', amount: 5 });
  assert.equal(game.toAct, 1);
  assert.equal(raise(game), undefined);
  const before = structuredClone(game.getState());
  assert.throws(() => game.act(1, { type: 'raise', amount: 25 }), /not reopened/);
  assert.deepEqual(game.getState(), before);
});
