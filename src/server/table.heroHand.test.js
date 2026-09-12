// SHOW-3: narration names only this viewer's accepted action, on its original board.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED = '0';

const { Table } = await import('./table.js');
const { Dealer, createDeck } = await import('../engine/deck.js');
const { evaluate } = await import('../engine/hand.js');
const { plainHandName } = await import('../engine/handName.js');
const { _closeForTests } = await import('./store.js');
after(() => _closeForTests());

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });
let serial = 0;
function fixture(t) {
  const table = new Table({ tableId: `show3-${++serial}`, smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  const sockets = [socket(), socket()];
  sockets.forEach((ws, i) => table.seatPlayer(ws, { playerId: `p${i}`, displayName: `Player ${i}`, buyIn: 1000 }));
  table._maybeRunAiTurn = async () => {};
  table._handCompleted = () => {}; // The tests drive the actual wire/engine, not persistence or model reporting.
  table.maybeStartHand();
  table.game.seats[0].holeCards = ['6s', '6h'];
  table.game.seats[1].holeCards = ['Ks', 'Kh'];
  // A set on the flop becomes quads on the turn, so a late evaluation is observably wrong.
  const runout = ['2c', '6d', '9h', 'Jc', '3c', '6c', '4c', 'Ad'];
  const used = new Set([...runout, ...table.game.seats.flatMap(s => s.holeCards)]);
  table.game.dealer = new Dealer([...runout, ...createDeck().filter(c => !used.has(c))]);
  t.after(() => table._clearTimers());
  return { table, sockets };
}

function act(table, sockets, action) {
  const seat = table.game.toAct;
  table.applyAction(sockets[seat], action);
  return seat;
}

function snapshot(table, seat) {
  const ws = socket();
  table.sendSnapshot(ws, seat);
  return ws.sent.find(m => m.type === 'state')?.state;
}

test('SHOW-3: a human action names pocket sixes only in the actor owner state', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  const own = snapshot(table, 0);
  assert.deepEqual(own.heroHand, { seq: 1, handNumber: 1, seat: 0, street: 'preflop', label: 'pocket sixes' });
  assert.equal(sockets[0].sent.at(-1).state.heroHand.label, 'pocket sixes', 'the normal player broadcast has the same field');
  assert.equal(snapshot(table, 1).heroHand, null, 'another owner does not own the acting hand');
  const publicState = snapshot(table, -1);
  assert.equal(publicState.heroHand, null);
  assert.ok(publicState.seats.every(s => s.holeCards.length === 0));
  assert.ok(!JSON.stringify(table.feltView()).includes('heroHand'), 'the public floor never gets even the private field');
  assert.ok(!JSON.stringify(table.feltView()).includes('pocket sixes'));
  assert.ok(!JSON.stringify(own.lastAction).includes('label'), 'public motion stays independent of private narration');
});

test('SHOW-3: a flop action uses the existing evaluator before that action deals the turn', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  act(table, sockets, { type: 'check' });
  assert.equal(table.game.street, 'flop');
  act(table, sockets, { type: 'check' });
  const expected = plainHandName(evaluate(table.game.seats[0].holeCards, table.game.community));
  assert.equal(expected, 'three sixes');
  act(table, sockets, { type: 'check' });
  assert.equal(table.game.street, 'turn');
  assert.equal(plainHandName(evaluate(table.game.seats[0].holeCards, table.game.community)), 'four sixes');
  assert.deepEqual(snapshot(table, 0).heroHand, { seq: 4, handNumber: 1, seat: 0, street: 'flop', label: expected });
});

test('SHOW-3: an all-in action keeps its preflop holding through staged runout and reconnect snapshots', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000000 });
  const { table, sockets } = fixture(t);
  const owner = socket();
  table.spectators.push({ ws: owner, spectatorSeat: 0 });
  act(table, sockets, { type: 'call' });
  act(table, sockets, { type: 'raise', amount: 1000 });
  act(table, sockets, { type: 'call' });
  assert.equal(table.game.street, 'complete');
  assert.equal(plainHandName(evaluate(table.game.seats[0].holeCards, table.game.community)), 'four sixes');
  const original = { seq: 3, handNumber: 1, seat: 0, street: 'preflop', label: 'pocket sixes' };
  const early = snapshot(table, 0);
  assert.deepEqual(early.paceFrame.board, [], 'the terminal STATE arrives before its runout');
  assert.deepEqual(early.heroHand, original);
  const holdMs = table._paceHold(table.game.result);
  assert.ok(holdMs > 0);
  t.mock.timers.tick(Math.floor(holdMs / 2));
  assert.deepEqual(snapshot(table, 0).heroHand, original);
  t.mock.timers.tick(holdMs);
  const finished = snapshot(table, 0);
  assert.equal(finished.paceFrame.board.length, 5);
  assert.deepEqual(finished.heroHand, original, 'the action never changes into the eventual winner description');
  assert.equal(snapshot(table, -1).heroHand, null, 'public showdown cards do not grant an owner action record');
  assert.equal(snapshot(table, 1).heroHand, null);
});

test('SHOW-3: rejected actions neither overwrite an accepted holding nor advance its sequence', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  const accepted = snapshot(table, 0).heroHand;
  assert.throws(() => table.applyAction(sockets[1], { type: 'raise', amount: -1, heroHand: 'pocket aces' }));
  assert.deepEqual(snapshot(table, 0).heroHand, accepted);
  assert.equal(snapshot(table, 1).heroHand, null);
  act(table, sockets, { type: 'check' });
  assert.equal(snapshot(table, 0).heroHand, null, 'a new actor invalidates the former actor\'s last-action holding');
  assert.equal(snapshot(table, 1).heroHand.seq, 2);
  assert.equal(snapshot(table, 1).heroHand.label, 'pocket kings');
});

for (const fallback of [false, true]) test(`SHOW-3: the real AI ${fallback ? 'safe fallback' : 'accepted action'} retains the owner-only pre-action holding`, async (t) => {
  const { table } = fixture(t);
  table.home = true; // The production router guarantees a keyless policy decision.
  const seat = table.game.toAct;
  table.aiSeats[seat] = true;
  table.actionTimer = { seat, key: 'show3-ai', deadlineTs: Date.now() };
  table._disciplineAction = () => fallback ? { type: 'raise', amount: -1 } : { type: 'call' };
  await Table.prototype._maybeRunAiTurn.call(table);
  assert.deepEqual(snapshot(table, seat).heroHand, { seq: 1, handNumber: 1, seat, street: 'preflop', label: 'pocket sixes' });
  assert.equal(snapshot(table, 1 - seat).heroHand, null);
  assert.equal(table.feltView().lastAction.type, 'call');
});

test('SHOW-3: a replaced or not-yet-dealt player never inherits the prior occupant\'s hand label', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  assert.equal(snapshot(table, 0).heroHand.label, 'pocket sixes');
  table.pending[0] = { ...table.pending[0], playerId: 'replacement', displayName: 'New person' };
  assert.equal(snapshot(table, 0).heroHand, null);
  const waiting = socket();
  table.sendPlayerSnapshot(waiting, 0);
  assert.equal(waiting.sent.at(-1).state.waitingForNextHand, true);
  assert.equal(waiting.sent.at(-1).state.heroHand, null);
  assert.ok(waiting.sent.at(-1).state.seats.every(s => s.holeCards.length === 0));
});

test('SHOW-3: rebuilding the roster or beginning a new hand clears the old holding', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  act(table, sockets, { type: 'fold' });
  assert.equal(snapshot(table, 1).heroHand.label, 'pocket kings');
  table._rebuildGame(table.pending.filter(Boolean).map(p => p.playerId));
  assert.equal(snapshot(table, 1).heroHand, null, 'same hand number, new waiting roster');
  table.maybeStartHand();
  assert.equal(snapshot(table, 1).heroHand, null);
  act(table, sockets, { type: 'call' });
  const seat = table.feltView().lastAction.seat;
  assert.equal(snapshot(table, seat).heroHand.handNumber, 2);
  assert.ok(snapshot(table, seat).heroHand.seq > 2);
});

test('SHOW-3: an unfiltered viewpoint argument cannot conjure a label from a card-free snapshot', (t) => {
  const { table, sockets } = fixture(t);
  act(table, sockets, { type: 'call' });
  const publicState = table.game.getPublicState(-1);
  assert.equal(table._augmentState(publicState, 0).heroHand, null);
});
