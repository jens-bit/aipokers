import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';
const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-thread-categories-'));
process.chdir(scratch);
const { Table } = await import('./table.js');
const { readThread, setLineListener } = await import('./thread.js');
const { _closeForTests } = await import('./store.js');
test.after(() => {
  setLineListener(null);
  _closeForTests();
  process.chdir(originalCwd);
  fs.rmSync(scratch, { recursive: true, force: true });
});

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });
function tableFor(t, session) {
  const table = new Table({ tableId: session, smallBlind: 1, bigBlind: 2, maxSeats: 2 });
  table.pending[0] = { playerId: 'p0', displayName: 'Your agent' };
  table.pending[1] = { playerId: 'p1', displayName: 'Opponent' };
  table.agentIds[0] = 'a1';
  table.agentUserIds[0] = 'u1';
  table.seatSessionIds[0] = session;
  t.after(() => table._clearTimers());
  return table;
}

test('FIRST-WATCH-1: real table writers label actions, reasoning, results, chat and session speech', t => {
  const table = tableFor(t, 'writer-categories');
  table._threadAction(0, { type: 'bet', amount: 10 });
  table._broadcastDecision({ seat: 0, action: { type: 'bet', amount: 10 }, reasoning: 'A private read.' });
  table._threadResult({ type: 'showdown', winners: [{ seat: 0 }], pot: 20 });
  table._threadSpoken(0, 'Your agent', 'An actual reply.', true, { from: 'a1', to: 'owner' });
  table.receiveWhisper('a1', 'An owner question.');
  table._fileRecapLines([{ seat: 0, name: 'Your agent', text: 'The session is over.' }],
    [{ seat: 0, sessionId: 'writer-categories', agentId: 'a1', ownerId: 'u1' }]);
  const rows = readThread('writer-categories', { owner: true });
  assert.deepEqual(rows.map(row => row.category), ['action', 'decision', 'result', 'chat', 'chat', 'session']);
  assert.equal(rows[3].to, 'owner');
  assert.equal(rows[4].from, 'owner');
});

test('FIRST-WATCH-1: live category metadata follows only the existing matching seat and session delivery', t => {
  const table = tableFor(t, 'push-categories');
  const mine = socket(), other = socket(), player = socket();
  table.spectators.push({ ws: mine, spectatorSeat: 0 }, { ws: other, spectatorSeat: 1 });
  table.connections[0] = player;
  setLineListener(row => table.deliverThreadLine(row));
  t.after(() => setLineListener(null));
  table._threadSpoken(0, 'Your agent', 'Private addressed reply.', true, { from: 'a1', to: 'owner' });
  assert.equal(mine.sent.length, 1);
  assert.equal(player.sent.length, 1);
  assert.equal(other.sent.length, 0);
  const message = mine.sent[0];
  assert.equal(message.type, 'thread_line');
  assert.equal(message.line.category, 'chat');
  assert.equal('from' in message.line, false);
  assert.equal('to' in message.line, false);
  table.deliverThreadLine({ agentId: 'a1', sessionId: 'an-old-session', kind: 'him', text: 'Old', category: 'chat' });
  assert.equal(mine.sent.length, 1);
});
