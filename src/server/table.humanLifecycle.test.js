import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.env.NOTIFY_ENABLED = '0';
const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-human-lifecycle-'));
process.chdir(scratch);
const { Table } = await import('./table.js');
const { Streets } = await import('../engine/game.js');
const store = await import('./store.js');
after(() => { store._closeForTests(); process.chdir(originalCwd);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true }); });

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, close() { this.readyState = 3; } });
let sequence = 0;
function tableFor(t, count = 2) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const table = new Table({ tableId: `human-${++sequence}`, home: true, smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  const sockets = Array.from({ length: count }, socket);
  sockets.forEach((ws, seat) => table.seatPlayer(ws, { playerId: `owner${seat}:p${seat}`, buyIn: 2000, displayName: `P${seat}` }));
  table.maybeStartHand();
  t.after(() => table._clearTimers());
  return { table, sockets };
}

test('BUG-267: an involuntary disconnect keeps the exact hand, chips and private seat for reconnect', t => {
  const { table, sockets } = tableFor(t);
  const seat = table.game.toAct;
  const game = table.game;
  const snapshot = game.getState(seat);
  table.removeConnection(sockets[seat], { reconnect: true });
  assert.equal(table.game, game, 'a network loss cannot discard the live pot');
  assert.equal(table.pending[seat].playerId, `owner${seat}:p${seat}`);
  assert.equal(table.connections[seat], null);
  t.mock.timers.tick(1000);
  const fresh = socket();
  assert.equal(table.seatPlayer(fresh, { playerId: `owner${seat}:p${seat}`, buyIn: 9999 }), seat);
  assert.deepEqual(game.getState(seat), snapshot, 'no new cards or buy-in on reconnect');
  assert.equal(table.seatedCount(), 2);
  table.removeConnection(sockets[seat], { reconnect: true });
  assert.equal(table.connections[seat], fresh, 'late old-socket close cannot detach the new socket');
});

test('BUG-267: explicit leave folds through settlement instead of deleting an active heads-up pot', t => {
  const { table, sockets } = tableFor(t);
  const seat = table.game.toAct;
  table.removeConnection(sockets[seat]);
  const results = sockets[1 - seat].sent.filter(message => message.type === 'hand_result');
  assert.equal(results.length, 1);
  assert.equal(results[0].result.type, 'uncontested');
  assert.equal(table.handsThisSession, 1);
  assert.equal(table.seatStack(1 - seat), 2010);
  table.removeConnection(sockets[seat]);
  assert.equal(sockets[1 - seat].sent.filter(message => message.type === 'hand_result').length, 1);
});

test('BUG-268: human facing a bet gets one authoritative fifteen-second deadline and then folds', t => {
  const { table, sockets } = tableFor(t);
  const acting = table.game.toAct;
  assert.deepEqual(table._actionTimerPayload(), { seat: acting, deadlineTs: 1_015_000, totalMs: 15_000 });
  table.sendPlayerSnapshot(sockets[acting], acting, { snapshot: true });
  t.mock.timers.tick(14_999);
  assert.equal(table.game.street, Streets.PREFLOP);
  t.mock.timers.tick(1);
  assert.equal(table.handsThisSession, 1);
  assert.equal(table.currentHandActionLog.filter(action => action.seat === acting && action.actionType === 'fold').length, 1);
  assert.equal(table.game.seats.reduce((sum, seat) => sum + seat.stack, 0), 4000);
});

test('BUG-268: a free human option checks, and accepted actions cancel obsolete deadlines', t => {
  const { table, sockets } = tableFor(t);
  t.mock.timers.tick(1000);
  table.applyAction(sockets[table.game.toAct], { type: 'call' });
  const nextSeat = table.game.toAct;
  assert.equal(table.game.legalActions(nextSeat).some(action => action.type === 'check'), true);
  const before = table._actionSeq;
  t.mock.timers.tick(14_000);
  assert.equal(table._actionSeq, before, 'superseded deadline does not act');
  t.mock.timers.tick(1000);
  assert.equal(table._actionSeq, before + 1);
  assert.equal(table.currentHandActionLog.at(-1).actionType, 'check');
  assert.equal(table.game.street, Streets.FLOP);
});

test('BUG-267: a nonacting departure waits for its legal fold and preserves all players’ committed chips', t => {
  const { table, sockets } = tableFor(t, 3);
  const game = table.game;
  table.removeConnection(sockets[1]);
  assert.equal(table.game, game);
  assert.equal(game.toAct, 0);
  assert.equal(table.seatedCount(), 3);
  table.applyAction(sockets[0], { type: 'call' });
  t.mock.timers.tick(0);
  assert.equal(game.seats[1].folded, true);
  while (game.street !== Streets.COMPLETE) {
    const seat = game.toAct;
    const type = game.legalActions(seat).some(action => action.type === 'check') ? 'check' : 'call';
    table.applyAction(sockets[seat], { type });
  }
  table._finishPaceHold();
  assert.equal(game.seats.reduce((sum, seat) => sum + seat.stack, 0), 6000);
  assert.equal(table.pending.some(seat => seat?.playerId === 'owner1:p1'), false);
  assert.equal(sockets[0].sent.filter(message => message.type === 'hand_result').length, 1);
});

test('BUG-267: reconnect cancels only its own grace expiry and never resets the active deadline', t => {
  const { table, sockets } = tableFor(t);
  const originalDeadline = table.actionTimer.deadlineTs;
  const seat = table.game.toAct;
  table.removeConnection(sockets[seat], { reconnect: true });
  t.mock.timers.tick(1000);
  const fresh = socket();
  table.seatPlayer(fresh, { playerId: `owner${seat}:p${seat}`, buyIn: 9999 });
  assert.equal(table.actionTimer.deadlineTs, originalDeadline);
  assert.equal(table.connections[seat], fresh);
  assert.equal(table._pendingSitOut.has(seat), false);
  table.applyAction(fresh, { type: 'call' });
  assert.equal(table.game.seats[seat].stack, 1980);
  assert.throws(() => table.applyAction(sockets[seat], { type: 'fold' }), /not seated/);
  table._scheduleNextHand = () => {};
  table.applyAction(sockets[1 - seat], { type: 'fold' });
  t.mock.timers.tick(29_000);
  assert.equal(table.closed, false, 'cancelled grace does not retire the reconnected seat');
  assert.equal(table.pending[seat].playerId, `owner${seat}:p${seat}`);
});

test('BUG-267: grace expiration settles the pending turn and retires the seat once', t => {
  const { table, sockets } = tableFor(t);
  table._scheduleNextHand = () => {}; // retain the completed hand during grace
  const seat = table.game.toAct;
  const game = table.game;
  table.removeConnection(sockets[seat], { reconnect: true });
  t.mock.timers.tick(15_000);
  assert.equal(table.handsThisSession, 1);
  assert.equal(game.seats.reduce((sum, player) => sum + player.stack, 0), 4000);
  assert.equal(table.closed, false);
  t.mock.timers.tick(15_000);
  assert.equal(table.closed, true);
  assert.equal(sockets[1 - seat].sent.filter(message => message.type === 'hand_result').length, 1);
  assert.equal(table._humanReconnects.size, 0);
});

test('BUG-268: closing or rebuilding the hand invalidates an obsolete timeout callback', t => {
  const { table } = tableFor(t);
  const seq = table._actionSeq;
  table.closeTable('test completed');
  t.mock.timers.tick(15_000);
  assert.equal(table._actionSeq, seq);
  assert.equal(table.handsThisSession, 0);
});

test('BUG-267: a retired grace window cannot reject tab replacement during a later fresh stay', t => {
  const { table, sockets } = tableFor(t, 3);
  table._scheduleNextHand = () => {};
  table.removeConnection(sockets[0], { reconnect: true });
  t.mock.timers.tick(15_000);
  table.applyAction(sockets[1], { type: 'fold' });
  t.mock.timers.tick(15_000);
  assert.equal(table.closed, false);
  assert.equal(table.pending.some(player => player?.playerId === 'owner0:p0'), false);
  const fresh = socket();
  const seat = table.seatPlayer(fresh, { playerId: 'owner0:p0', buyIn: 2000 });
  const replacement = socket();
  assert.equal(table.seatPlayer(replacement, { playerId: 'owner0:p0', buyIn: 9999 }), seat);
  assert.equal(table.connections[seat], replacement);
  assert.equal(table.seatStack(seat), 2000, 'tab replacement keeps the fresh stay buy-in');
});

test('BUG-267: real signed socket reconnect restores only its own reserved kitchen cards', async t => {
  process.env.TELEGRAM_BOT_TOKEN = '123456:human-lifecycle-local-token';
  const registry = await import('./tableRegistry.js');
  const home = await import('./homeGame.js');
  const { createServer } = await import('./wsServer.js');
  const { wss } = createServer({ port: 0, host: '127.0.0.1' });
  await once(wss, 'listening');
  const clients = [];
  t.after(async () => {
    for (const ws of clients) ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    home.reset(); registry.resetRegistry('human socket test over');
    delete process.env.TELEGRAM_BOT_TOKEN;
  });
  const owner = '92001';
  const tableId = home.homeTableId(owner);
  const table = registry.getOrCreateTable(tableId, { home: true, homeOwnerId: owner, smallBlind: 10, bigBlind: 20 });
  table.seatPlayer(socket(), { playerId: 'practice-opponent', buyIn: 2000 });
  const credential = id => {
    const fields = { id, first_name: 'Test', auth_date: String(Math.floor(Date.now() / 1000)) };
    const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
    const key = createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    return new URLSearchParams({ ...fields, hash: createHmac('sha256', key).update(text).digest('hex') }).toString();
  };
  const waitFor = async predicate => {
    for (let count = 0; count < 150; count++) { const value = predicate(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Expected authenticated socket state');
  };
  async function join(id, claimedOwner = id) {
    const ws = new WebSocket(`ws://127.0.0.1:${wss.address().port}`);
    const messages = []; clients.push(ws);
    ws.on('message', raw => messages.push(JSON.parse(raw)));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'join', tableId, playerId: 'reconnecting-player', displayName: 'You', buyIn: 2000,
      userId: claimedOwner, initData: credential(id), wantAI: false }));
    await waitFor(() => messages.some(message => ['joined', 'error'].includes(message.type)));
    return { ws, messages };
  }
  const first = await join(owner);
  const seat = first.messages.find(message => message.type === 'joined').seat;
  const initial = await waitFor(() => first.messages.find(message => message.type === 'state' && message.state.street === 'preflop'));
  const cards = initial.state.seats[seat].holeCards;
  assert.equal(cards.length, 2);
  assert.deepEqual(initial.state.seats[1 - seat].holeCards, []);
  const game = table.game;
  first.ws.terminate();
  await waitFor(() => table.connections[seat] === null);
  assert.equal(table.game, game);
  const stranger = await join('92002', owner);
  assert.equal(stranger.messages[0].type, 'error');
  assert.equal(stranger.messages.some(message => message.type === 'state'), false);
  const second = await join(owner);
  const restored = await waitFor(() => second.messages.find(message => message.type === 'state'));
  assert.equal(second.messages.find(message => message.type === 'joined').seat, seat);
  assert.deepEqual(restored.state.seats[seat].holeCards, cards);
  assert.deepEqual(restored.state.seats[1 - seat].holeCards, []);
  assert.equal(table.seatedCount(), 2);
  assert.equal(table.game, game);
});
