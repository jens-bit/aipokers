import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_COMPAT_KEY;
process.env.NOTIFY_ENABLED = '0';
process.env.GUEST_ENABLED = '0';
process.env.EQUITY_ITERATIONS = '20';
const previousCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-all-in-strategy-'));
process.chdir(scratch);
const { Table } = await import('./table.js');
const { chooseFromPolicy } = await import('../agent/policyPlay.js');
const { ALL_IN_EVERY_HAND_STRATEGY, ALL_IN_EVERY_HAND } = await import('../agent/strategyIntent.js');
const { _closeForTests } = await import('./store.js');
after(() => {
  _closeForTests(); process.chdir(previousCwd);
  if (path.dirname(scratch) !== path.resolve(os.tmpdir())) throw new Error('Unsafe scratch path');
  fs.rmSync(scratch, { recursive: true, force: true });
});

function tableFor(t, { home = false, stacks = [1000, 1000], strategies = [ALL_IN_EVERY_HAND_STRATEGY, 'Play balanced poker.'] } = {}) {
  const table = new Table({ tableId: `bug283-${t.name}`, smallBlind: 10, bigBlind: 20, maxSeats: stacks.length });
  t.after(() => table._clearTimers());
  table.home = home;
  // Hold only automatic scheduling and transport. Compilation, routing,
  // action discipline and the poker engine remain the actual native path.
  table._maybeRunAiTurn = async () => {};
  table._broadcastState = () => {};
  table._handCompleted = () => {};
  stacks.forEach((buyIn, seat) => table.seatAI({ buyIn, displayName: `Player ${seat}`,
    strategy: strategies[seat] ?? 'Play balanced poker.',
    agentProfile: { tightness: 10, aggression: 98, bluffFreq: 70, discipline: 35 } }));
  table._rebuildGame(table.pending.map(seat => seat.playerId));
  table.game.startHand();
  return table;
}

async function actNative(table) {
  const seat = table.game.toAct;
  table.actionTimer = { seat, key: `test:${table.game.handNumber}:${table._actionSeq}:${seat}`, deadlineTs: Date.now() };
  await Table.prototype._maybeRunAiTurn.call(table);
}

for (const [label, home, router] of [['Home', true, 'on'], ['casino', false, 'on'], ['router disabled', false, 'off']]) {
  test(`BUG-283: real ${label} seats put the full stack in on successive hands and conserve chips`, async t => {
    const before = process.env.DECISION_ROUTER;
    process.env.DECISION_ROUTER = router;
    t.after(() => { if (before === undefined) delete process.env.DECISION_ROUTER; else process.env.DECISION_ROUTER = before; });
    const table = tableFor(t, { home });
    for (let hand = 0; hand < 3; hand++) {
      if (hand) table.game.startHand();
      // A big-blind option is still a raise, not an opening bet.
      if (table.game.toAct !== 0) table.game.act(table.game.toAct, { type: 'call' });
      const total = table.game.seats[0].contribThisStreet + table.game.seats[0].stack;
      await actNative(table);
      assert.deepEqual(table.currentHandDecisions.at(-1).action, { type: 'raise', amount: total });
      assert.equal(table.game.seats[0].stack, 0);
      assert.equal(table.game.seats[0].allIn, true);
      assert.equal(table.game.pot + table.game.seats.reduce((sum, seat) => sum + seat.stack, 0), 2000);
      table.game.act(table.game.toAct, { type: 'fold' });
      assert.equal(table.game.street, 'complete');
      assert.equal(table.game.seats.reduce((sum, seat) => sum + seat.stack, 0), 2000);
    }
    assert.equal(table.routes.policy, 3);
    assert.equal(table.routes.model, 0);
  });
}

test('BUG-283/285: actual short all-in closes earlier raise rights while an unacted seat retains its shove', async t => {
  const table = tableFor(t, { stacks: [1000, 150, 1000],
    strategies: [ALL_IN_EVERY_HAND_STRATEGY, '', ALL_IN_EVERY_HAND_STRATEGY] });
  table.game.act(0, { type: 'raise', amount: 100 });
  table.game.act(1, { type: 'raise', amount: 150 });
  const unacted = table._buildAiGameState(2);
  assert.equal(unacted.canRaise, true);
  assert.deepEqual(chooseFromPolicy(unacted).action, { type: 'raise', amount: 1000 });
  table.game.act(2, { type: 'call' });
  const reopened = table._buildAiGameState(0);
  assert.equal(reopened.canRaise, false);
  assert.equal(reopened.toCall, 50);
  assert.deepEqual(chooseFromPolicy(reopened).action, { type: 'call' });
  await actNative(table);
  assert.equal(table.currentHandDecisions.at(-1).action.type, 'call');
  assert.equal(table.game.seats[0].stack, 850);
  assert.equal(table.game.street, 'flop');
  assert.equal(table.game.pot + table.game.seats.reduce((sum, seat) => sum + seat.stack, 0), 2150);
});

test('BUG-283: a full raise reopens the instructed player for a legal shove', t => {
  const table = tableFor(t, { stacks: [1000, 150, 1000] });
  table.game.act(0, { type: 'raise', amount: 100 });
  table.game.act(1, { type: 'raise', amount: 150 });
  table.game.act(2, { type: 'raise', amount: 300 });
  const gs = table._buildAiGameState(0);
  assert.equal(gs.canRaise, true);
  assert.deepEqual(chooseFromPolicy(gs).action, { type: 'raise', amount: 1000 });
  assert.doesNotThrow(() => table.game.act(0, chooseFromPolicy(gs).action));
});

test('BUG-283: per-seat strategy cannot inherit another player\'s legacy table-wide mandate', t => {
  const table = tableFor(t, { strategies: ['', 'Play loose and aggressive.'] });
  table.agentStrategy = ALL_IN_EVERY_HAND_STRATEGY;
  assert.equal(table._buildAiGameState(0).policy.intent, undefined);
  table.aiStrategy[0] = ALL_IN_EVERY_HAND_STRATEGY;
  assert.equal(table._buildAiGameState(0).policy.intent, ALL_IN_EVERY_HAND);
  table.game.act(0, { type: 'call' });
  assert.equal(table._buildAiGameState(1).policy.intent, undefined);
});
