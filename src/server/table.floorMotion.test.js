// SHOW-2: the floor animates accepted public play, never the agent's private view.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED = '0';

const { Table } = await import('./table.js');
const { _closeForTests } = await import('./store.js');
const { OWNER: THREAD_OWNER } = await import('./thread.js');
after(() => _closeForTests());

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });
let sequence = 0;
function tableFor(t, stacks = [1000, 1000]) {
  const sockets = stacks.map(socket);
  const table = new Table({ tableId: `show2-motion-${++sequence}`, smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  sockets.forEach((ws, i) => table.seatPlayer(ws, { playerId: `p${i}`, displayName: `Player ${i}`, buyIn: stacks[i] }));
  table._maybeRunAiTurn = async () => {};
  table._handCompleted = () => {}; // Public-action tests do not persist completed hands.
  table.maybeStartHand();
  t.after(() => table._clearTimers());
  return { table, sockets };
}

function act(table, sockets, action) {
  const seat = table.game.toAct;
  table.applyAction(sockets[seat], action);
  return seat;
}

test('SHOW-2: public action records actual call chips and distinct repeated actions across streets', (t) => {
  const { table, sockets } = tableFor(t);
  const firstSeat = act(table, sockets, { type: 'call', amount: 999999, reasoning: 'secret', holeCards: ['As', 'Ah'] });
  const first = table.feltView().lastAction;
  assert.deepEqual(first, {
    seq: 1, handNumber: 1, seat: firstSeat, street: 'preflop', type: 'call',
    amount: 10, chips: 10, allIn: false, pot: 40,
  });
  assert.deepEqual(table._augmentState(table.game.getPublicState(-1), -1).lastAction, first);
  act(table, sockets, { type: 'check' });
  const second = table.feltView().lastAction;
  assert.equal(second.street, 'preflop', 'the action belongs to the street it closed');
  assert.equal(table.game.street, 'flop');
  act(table, sockets, { type: 'check' });
  const third = table.feltView().lastAction;
  assert.equal(third.seat, second.seat, 'heads-up the same player checks either side of the flop');
  assert.equal(third.type, second.type);
  assert.equal(third.seq, second.seq + 1, 'the miniature can animate both accepted checks');
  assert.equal(third.amount, 0);
  assert.equal(third.chips, 0);
  assert.equal(first.seq, 1, 'new actions never mutate a snapshot already served');
});

test('SHOW-2: raises report raise-to separately from pushed chips and name a short all-in call', (t) => {
  const { table, sockets } = tableFor(t, [200, 1000]);
  const caller = table.game.toAct;
  const before = table.game.seats[caller];
  const pushed = 100 - before.contribThisStreet;
  act(table, sockets, { type: 'raise', amount: 100 });
  assert.equal(table.feltView().lastAction.amount, 100);
  assert.equal(table.feltView().lastAction.chips, pushed);
  const raiser = table.game.toAct;
  act(table, sockets, { type: 'raise', amount: table.game.legalActions(raiser).find(a => a.type === 'raise').max });
  assert.equal(table.feltView().lastAction.allIn, true);
  const shortStack = table.game.seats[table.game.toAct].stack;
  act(table, sockets, { type: 'call' });
  assert.equal(table.feltView().lastAction.amount, shortStack);
  assert.equal(table.feltView().lastAction.chips, shortStack);
  assert.equal(table.feltView().lastAction.allIn, true, 'winning the showdown does not un-shove the accepted call');
});

test('SHOW-2: rejected actions do not become public motion, and a new hand clears the previous action', (t) => {
  const { table, sockets } = tableFor(t);
  act(table, sockets, { type: 'call' });
  const latest = table.feltView().lastAction;
  assert.throws(() => table.applyAction(sockets[table.game.toAct], { type: 'raise', amount: -1 }));
  assert.deepEqual(table.feltView().lastAction, latest);
  act(table, sockets, { type: 'fold' });
  table._rebuildGame(table.pending.filter(Boolean).map(p => p.playerId));
  assert.equal(table.feltView().lastAction, null, 'a rebuilt waiting roster cannot inherit the old seat action');
  table.maybeStartHand();
  assert.equal(table.feltView().lastAction, null);
  assert.equal(table._augmentState(table.game.getPublicState(-1), -1).lastAction, null);
});

test('SHOW-2: only public speech reaches the miniature and it expires without further play', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const { table } = tableFor(t);
  let pushes = 0;
  table.onStateChange = () => pushes++;
  table.sendChat(0, 'I can wait.', true);
  const spoken = table.feltView().recentChat;
  assert.deepEqual(spoken, {
    seq: 1, seat: 0, displayName: 'Player 0', text: 'I can wait.', isAI: true,
    timestamp: 1000000, expiresAt: 1004000,
  });
  assert.equal(pushes, 1, 'a public remark can reach the floor even between actions');
  table.sendChat(0, 'My hidden cards are aces.', true, { from: 'a0', to: THREAD_OWNER });
  table._broadcastDecision({ seat: 0, action: { type: 'raise' }, reasoning: 'Private reason' });
  assert.deepEqual(table.feltView().recentChat, spoken, 'owner replies and reasoning cannot replace public speech');
  assert.equal(pushes, 1, 'owner replies do not generate a floor update');
  t.mock.timers.tick(4000);
  assert.equal(table.feltView().recentChat, null);
  table.sendChat(0, 'Your move.', true);
  assert.equal(table.feltView().recentChat.seq, 2);
  table.pending[0] = { ...table.pending[0], playerId: 'replacement', displayName: 'Somebody else' };
  assert.equal(table.feltView().recentChat, null, 'a replacement never inherits the previous body\'s speech');
});

test('SHOW-2: floor action and speech projection never carries private cards or reasoning', (t) => {
  const { table, sockets } = tableFor(t);
  act(table, sockets, { type: 'call', reasoning: 'Secret reasoning', heroHand: 'pocket aces' });
  table.sendChat(0, 'A public line.', true, { from: 'private-owner-id' });
  const view = table.feltView();
  const projected = JSON.stringify({ lastAction: view.lastAction, recentChat: view.recentChat });
  assert.ok(!/holeCards|heroHand|reasoning|private-owner-id|Secret reasoning/.test(projected));
  for (const seat of table.game.seats) {
    for (const card of seat.holeCards) assert.ok(!projected.includes(`"${card}"`));
  }
  assert.equal(view.recentChat.text, 'A public line.');
});

for (const fallback of [false, true]) test(`SHOW-2: an AI ${fallback ? 'safe fallback' : 'accepted decision'} produces the same public action record`, async (t) => {
  const { table } = tableFor(t);
  const seat = table.game.toAct;
  table.home = true; // The real policy router guarantees a keyless decision.
  table.aiSeats[seat] = true;
  table.actionTimer = { seat, key: 'show2-ai-turn', deadlineTs: Date.now() };
  table._disciplineAction = () => fallback ? { type: 'raise', amount: -1 } : { type: 'call' };
  await Table.prototype._maybeRunAiTurn.call(table);
  assert.deepEqual(table.feltView().lastAction, {
    seq: 1, handNumber: 1, seat, street: 'preflop', type: 'call',
    amount: 10, chips: 10, allIn: false, pot: 40,
  });
  assert.equal(table.currentHandActionLog.length, 1, 'the rejected proposal does not get a public sequence');
});

test('SHOW-2: an AI sitting out produces its accepted public fold without a model decision', async (t) => {
  const { table } = tableFor(t, [1000, 1000, 1000]);
  const seat = table.game.toAct;
  table.aiSeats[seat] = true;
  table._pendingSitOut.add(seat);
  await Table.prototype._maybeRunAiTurn.call(table);
  assert.equal(table.feltView().lastAction.type, 'fold');
  assert.equal(table.feltView().lastAction.seat, seat);
  assert.equal(table.feltView().lastAction.chips, 0);
  assert.equal(table.currentHandDecisions.length, 0);
});
