// BUG-256: moving a stranded player must preserve the stakes he chose.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED = '0';

import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-requeue-'));
let store, profiles, registry, houseBank;
let owner, agent, sequence = 0;

before(async () => {
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  profiles = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  houseBank = await import('./houseBank.js');
});

beforeEach(() => {
  registry.resetRegistry('next requeue test');
  owner = `requeue-owner-${++sequence}`;
  const id = `requeue-agent-${sequence}`;
  store.saveWallet(owner, { ownerId: owner, balance: 10_000, ledger: [] });
  store.saveProfile(owner, { userId: owner, agents: [{
    id, name: 'The Clock', status: 'idle', activeTableId: null,
    style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: 12_000,
    pocket: { agentId: id, balance: 12_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 45 }, stats: { handsPlayed: 0 },
    profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 }, sessionLog: [], ledger: [],
  }] });
  profiles.reloadOwners(owner);
  profiles.setLiveTableProvider(registry);
  agent = profiles._agentRecordForTests(id, owner);
});

after(() => {
  registry.resetRegistry('requeue tests over');
  profiles.setLiveTableProvider(null);
  store._closeForTests();
  process.chdir(originalCwd);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});

const total = () => houseBank.balance() + agent.pocket.balance + store.loadWallet(owner).balance;

for (const stakes of [
  { rung: 0, smallBlind: 10, bigBlind: 20, buyIn: 2000 },
  { rung: 1, smallBlind: 25, bigBlind: 50, buyIn: 5000 },
]) {
  test(`BUG-256: lonely ${stakes.smallBlind}/${stakes.bigBlind} player keeps his room despite affording 50/100`, () => {
    const chips = total();
    const first = profiles.deployAgent(owner, agent.id, { body: { rung: stakes.rung } });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const oldTable = registry.tableOfAgent(agent.id);
    assert.equal(oldTable.bigBlind, stakes.bigBlind);
    assert.equal(agent.pocket.balance, 12_000 - stakes.buyIn);

    // Synchronous close exercises real settlement, registry removal and deploy;
    // no timer gets to deal a hand or change the player's balance between them.
    oldTable._closeAndRequeue();

    const replacement = registry.tableOfAgent(agent.id);
    assert.ok(replacement, 'the player is actually seated again');
    assert.equal(oldTable.closed, true);
    assert.notEqual(replacement.tableId, oldTable.tableId);
    assert.equal(replacement.smallBlind, stakes.smallBlind);
    assert.equal(replacement.bigBlind, stakes.bigBlind);
    assert.equal(agent.activeTableId, replacement.tableId);
    assert.equal(agent.pocket.balance, 12_000 - stakes.buyIn, 'replacement costs only the same room buy-in');
    assert.equal(store.loadWallet(owner).balance, 10_000, 'requeue does not pull extra safe funds');
    assert.equal(total(), chips, 'settlement and replacement conserve all chips');
    assert.equal(registry.listFloorTables().filter(t => t.agentIds.includes(agent.id)).length, 1);
  });
}

test('BUG-256: unsupported stakes settle home instead of choosing another room', () => {
  const chips = total();
  assert.equal(profiles.deployAgent(owner, agent.id, { body: { rung: 0 } }).status, 200);
  const table = registry.tableOfAgent(agent.id);
  table.smallBlind = 5;
  table._closeAndRequeue();
  assert.equal(registry.tableOfAgent(agent.id), null);
  assert.equal(agent.activeTableId, null);
  assert.equal(agent.pocket.balance, 12_000, 'original buy-in is settled before returning home');
  assert.equal(store.loadWallet(owner).balance, 10_000);
  assert.equal(total(), chips);
});

test('BUG-256: a player short of the original buy-in returns home without funding or moving down', () => {
  const chips = total();
  assert.equal(profiles.deployAgent(owner, agent.id, { body: { rung: 2 } }).status, 200);
  const table = registry.tableOfAgent(agent.id);
  const seat = table.agentIds.indexOf(agent.id);
  // Public session accounting after a losing run: 500 still on the felt,
  // 2,000 in his pocket. He could buy the floor, but did not request it.
  table.seatStacks[seat] = 500;
  table._closeAndRequeue();
  assert.equal(registry.tableOfAgent(agent.id), null);
  assert.equal(agent.activeTableId, null);
  assert.equal(agent.pocket.balance, 2500);
  assert.equal(agent.pocket.mode, 'allowance');
  assert.equal(store.loadWallet(owner).balance, 10_000);
  assert.equal(total(), chips);
});
