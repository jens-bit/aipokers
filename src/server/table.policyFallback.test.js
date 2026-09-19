import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_COMPAT_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.AI_MODEL = 'claude-haiku-4-5';
process.env.AI_PROVIDER = 'anthropic';
process.env.DECISION_ROUTER = 'off';
process.env.GUEST_ENABLED = '0';
process.env.NOTIFY_ENABLED = '0';
process.env.EQUITY_ITERATIONS = '20';
const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-policy-fallback-'));
process.chdir(scratch);
const { Table } = await import('./table.js');
const { createDeck } = await import('../engine/deck.js');
const { _closeForTests } = await import('./store.js');
after(() => { _closeForTests(); process.chdir(originalCwd); fs.rmSync(scratch, { recursive: true, force: true }); });

test('BUG-261: real casino Table uses no-key policy on a winning river and conserves chips with rake', async t => {
  const table = new Table({ tableId: 'bug261-river', smallBlind: 10, bigBlind: 20, maxSeats: 2 });
  t.after(() => table._clearTimers());
  // Only schedulers, transport and persistence are held. The actual briefing,
  // model router, handler, legal discipline, engine and rake all execute.
  table._maybeRunAiTurn = async () => {};
  table._broadcastState = () => {};
  table._handCompleted = () => {};
  const sockets = [0, 1].map(() => ({ OPEN: 1, readyState: 1, send() {} }));
  sockets.forEach((ws, i) => table.seatPlayer(ws, { playerId: `p${i}`, displayName: `Player ${i}`, buyIn: 1000 }));
  table._rebuildGame(['p0', 'p1']);
  const dealt = ['Ks', 'As', 'Kh', 'Ah', '9d', 'Ac', '7h', '2c', '4s', 'Ad', '8d', '3c'];
  table.game.startHand([...dealt, ...createDeck().filter(card => !dealt.includes(card))]);
  while (table.game.street !== 'river') {
    const seat = table.game.toAct;
    const legal = table.game.legalActions(seat);
    table.applyAction(sockets[seat], { type: legal.some(action => action.type === 'check') ? 'check' : 'call' });
  }
  assert.equal(table.game.toAct, 1);
  table.applyAction(sockets[1], { type: 'bet', amount: 100 });
  table.aiSeats[0] = true;
  table.actionTimer = { seat: 0, key: 'bug261-river-turn', deadlineTs: Date.now() };
  await Table.prototype._maybeRunAiTurn.call(table);
  assert.equal(table.game.seats[0].folded, false, 'four aces cannot be auto-folded merely because no model is configured');
  assert.deepEqual(table.currentHandDecisions.at(-1).fallback, { policy: true, reason: 'unconfigured' });
  assert.equal(table.currentHandActionLog.at(-1).actionType, 'call');
  assert.equal(table.game.street, 'complete');
  assert.equal(table.game.result.winners[0].seat, 0);
  const rake = table._takeRake(table.game.result);
  assert.equal(table.game.seats.reduce((total, seat) => total + seat.stack, 0) + rake, 2000);
  assert.equal(Object.values(table.game.result.deltas).reduce((total, delta) => total + delta, 0) + rake, 0);
  assert.equal(table.currentHandDecisions.length, 1, 'one decision and no rejection fallback storm');
});
