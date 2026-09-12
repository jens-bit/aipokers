// FIRST-SEAT-1: parallel arrivals keep the room each owner chose.
// Exercise the actual HTTP route against scratch storage; no tables/models run.
delete process.env.ANTHROPIC_API_KEY;
import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-queue-admission-'));
const savedEnv = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET', 'GUEST_ENABLED'].map(k => [k, process.env[k]]));
let store, profiles, server, base, clock = Date.now();
const names = ['up-a', 'g_back-a', 'floor-a', 'up-b', 'back-b', 'floor-b',
  'invalid-a', 'invalid-b', 'invalid-c', 'cost-a', 'cost-b', 'cost-c',
  'auto-a', 'auto-b', 'auto-c', 'auto-d', 'same-owner',
  'poor-a', 'poor-b', 'poor-c', 'ttl-a', 'ttl-b', 'ttl-c', 'ttl-d'];
const agent = id => ({ id, name: id, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: 12000,
  pocket: { agentId: id, balance: ['cost-b', 'poor-b', 'same-owner'].includes(id) ? 6000 : 12000,
    mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 40, handsWon: 10 },
});
before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  process.env.GUEST_ENABLED = '1';
  store = await import('./store.js');
  store._closeForTests(); process.chdir(scratch);
  for (const name of names) {
    store.saveWallet(name, { ownerId: name, balance: 5000, ledger: [] });
    store.saveProfile(name, { userId: name, chat: [], agents: [agent(name)] });
  }
  store.insertGuest({ token: 'queue-admission-guest', ownerId: 'g_back-a' });
  profiles = await import('./agentProfiles.js');
  const { default: express } = await import('express');
  const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
  server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(t => {
  // A fresh TTL window gives each case an empty queue without a product reset seam.
  clock += 6 * 60_000;
  t.mock.method(Date, 'now', () => clock);
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  store._closeForTests(); process.chdir(originalCwd);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});
async function queue(owner, extra = {}) {
  const response = await fetch(`${base}/api/agents/${owner}/queue`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: owner, ...extra }),
  });
  return { status: response.status, body: await response.json() };
}
async function admitted(owner, extra) {
  const result = await queue(owner, extra);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
const record = owner => profiles._agentRecordForTests(owner, owner);

test('FIRST-SEAT-1: parallel upstairs, backroom and floor arrivals retain independent exact-rung slots', async () => {
  const first = [];
  for (const [owner, rung, room, smallBlind, bigBlind] of [
    ['up-a', 1, 'upstairs', 25, 50], ['g_back-a', 2, 'backroom', 50, 100], ['floor-a', 0, 'floor', 10, 20],
  ]) {
    const pocket = structuredClone(record(owner).pocket);
    const wallet = store.loadWallet(owner);
    const guest = owner === 'g_back-a' ? store.loadGuestByOwner(owner) : null;
    const body = await admitted(owner, { rung });
    assert.equal(body.matched, false, `${room} must not match another room's pending slot`);
    assert.equal(body.room, room);
    assert.equal(body.stakes.rung, rung);
    assert.equal(body.smallBlind, smallBlind);
    assert.equal(body.bigBlind, bigBlind);
    assert.equal(record(owner).headingTo, room);
    assert.equal(record(owner).activeTableId, body.tableId);
    assert.deepEqual(record(owner).pocket, pocket, 'queue does not spend a buy-in');
    assert.deepEqual(store.loadWallet(owner), wallet);
    if (guest) assert.deepEqual(store.loadGuestByOwner(owner), guest, 'queue preserves guest session accounting');
    first.push(body);
  }
  assert.equal(new Set(first.map(row => row.tableId)).size, 3);
  for (const [owner, rung, index] of [['back-b', 2, 1], ['up-b', 1, 0], ['floor-b', 0, 2]]) {
    const paired = await admitted(owner, { rung });
    assert.equal(paired.matched, true);
    assert.equal(paired.tableId, first[index].tableId, 'the other rooms must retain their waiting peers');
    assert.equal(paired.stakes.rung, rung);
  }
});

test('FIRST-SEAT-1: a pending slot cannot bypass invalid requested-rung validation', async () => {
  const first = await admitted('invalid-a', { rung: 1 });
  for (const rung of [7, -1, 'upstairs', 1.5]) {
    const result = await queue('invalid-b', { rung });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'badRung');
    assert.equal(record('invalid-b').activeTableId, null);
  }
  const paired = await admitted('invalid-c', { rung: 1 });
  assert.equal(paired.tableId, first.tableId, 'a refused request leaves the slot open');
});

test('FIRST-SEAT-1: an unaffordable requested room is refused while a cheaper peer stays queued', async () => {
  const first = await admitted('cost-a', { rung: 0 });
  const result = await queue('cost-b', { rung: 2 });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'cantAfford');
  assert.equal(result.body.rung, 2);
  assert.equal(result.body.buyIn, 10000);
  assert.equal(record('cost-b').activeTableId, null);
  assert.equal(record('cost-b').pocket.balance, 6000);
  const paired = await admitted('cost-c', { rung: 0 });
  assert.equal(paired.tableId, first.tableId);
});

test('FIRST-SEAT-1: omitted or empty rung keeps automatic matching against the oldest pending peer', async () => {
  const first = await admitted('auto-a', { rung: 2 });
  const second = await admitted('auto-b', { rung: 1 });
  const third = await admitted('auto-c');
  assert.equal(third.matched, true);
  assert.equal(third.tableId, first.tableId);
  assert.equal(third.stakes.rung, 2);
  const fourth = await admitted('auto-d', { rung: '' });
  assert.equal(fourth.tableId, second.tableId);
  assert.equal(fourth.stakes.rung, 1);
});

test('FIRST-SEAT-1: no waiting peer keeps affordable default and existing same-owner pairing', async () => {
  const first = await admitted('same-owner');
  assert.equal(first.matched, false);
  assert.equal(first.stakes.rung, 1);
  const second = await admitted('same-owner', { rung: null });
  assert.equal(second.matched, true);
  assert.equal(second.tableId, first.tableId);
  assert.equal(record('same-owner').pocket.balance, 6000);
});

test('FIRST-SEAT-1: automatic matching retains affordability refusal without consuming the slot', async () => {
  const first = await admitted('poor-a', { rung: 2 });
  const refused = await queue('poor-b');
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error, 'cantAfford');
  assert.equal(refused.body.matched, true);
  const paired = await admitted('poor-c');
  assert.equal(paired.tableId, first.tableId);
});

test('FIRST-SEAT-1: room slots expire independently after the existing five-minute TTL', async () => {
  const expired = await admitted('ttl-a', { rung: 1 });
  clock += 4 * 60_000;
  const current = await admitted('ttl-b', { rung: 2 });
  clock += 2 * 60_000;
  const fresh = await admitted('ttl-c', { rung: 1 });
  assert.equal(fresh.matched, false);
  assert.notEqual(fresh.tableId, expired.tableId);
  const paired = await admitted('ttl-d', { rung: 2 });
  assert.equal(paired.matched, true);
  assert.equal(paired.tableId, current.tableId);
});
