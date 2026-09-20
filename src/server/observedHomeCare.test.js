import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-home-care-'));
process.chdir(scratch);
for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET']) delete process.env[key];
const store = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const floor = await import('./floorChannel.js');
const originalNow = Date.now;
let now = 1_800_000_000_000;
let serial = 0;
let seats;
const socket = () => ({ OPEN: 1, readyState: 1, frames: [], send(text) { this.frames.push(JSON.parse(text)); } });
function household({ snacks = 3, left = 20, extra = {} } = {}) {
  const userId = `observed-home-${++serial}`;
  const id = `care-${serial}`;
  store.saveProfile(userId, { userId, chat: [], agents: [{ id, name: 'Ember', status: 'idle', activeTableId: null,
    nature: { name: 'Hothead' }, mood: { state: 'neutral', heat: 30 }, stamina: { left, at: now, stage: 'worn' },
    attrs: { STAMINA: 50 }, pocket: { balance: 2000, mode: 'allowance', cap: null, ledger: [] }, ...extra }] });
  store.saveWallet(userId, { ownerId: userId, balance: 10_000, fridge: { snack: snacks, beer: 2 }, ledger: [] });
  profiles.reloadOwners(userId);
  return { userId, id, agent: () => profiles.agentsOf(userId)[0], wallet: () => store.loadWallet(userId) };
}
before(() => { Date.now = () => now; });
beforeEach(() => {
  floor.reset();
  seats = new Map();
  const tables = { hasTable: id => [...seats.values()].some(t => t.tableId === id), homeTableOf: id => seats.get(id) ?? null,
    tableOfAgent: id => seats.get(id) ?? null, listTables: () => [], listFloorTables: () => [] };
  profiles.setLiveTableProvider(tables);
  profiles.setAgentChangeListener(userId => floor.notifyAgentsChanged(userId));
  floor.configure({ liveTables: tables });
});
after(() => {
  floor.reset(); profiles.setLiveTableProvider(null); profiles.setAgentChangeListener(null); Date.now = originalNow;
  store._closeForTests(); process.chdir(cwd); fs.rmSync(scratch, { recursive: true, force: true });
});

test('BUG-279: stocked snacks are consumed once per visible trip, only by authenticated Home observation', () => {
  const h = household();
  const publicSocket = socket();
  floor.subscribe(publicSocket, { userId: h.userId, owner: false });
  assert.equal(h.wallet().fridge.snack, 3, 'a subscription alone does not eat');
  floor.observeHome(publicSocket, true);
  assert.equal(h.wallet().fridge.snack, 3, 'a public observer cannot spend another owner\'s stock');
  const owner = socket(); const second = socket();
  floor.subscribe(owner, { userId: h.userId, owner: true });
  floor.subscribe(second, { userId: h.userId, owner: true });
  floor.observeHome(owner, false);
  assert.equal(h.wallet().fridge.snack, 3);
  floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 2);
  assert.equal(h.agent().stamina.left, 45);
  assert.equal(h.agent().homeItem.item, 'snack', 'the real item event drives the visible trip');
  assert.ok(owner.frames.some(frame => frame.type === 'home_state' && frame.agents.some(a => a.homeItem?.at === now)));
  floor.observeHome(second, true);
  floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 2, 'duplicates and a second tab cannot eat twice');
  now += 10_000;
  floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 1);
  assert.ok(h.agent().stamina.left >= 70);
  assert.equal(profiles.restRefusalFor(h.id, h.userId), null, 'two real snacks resolve the actual deployment gate');
  now += 10_000; floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 1, 'stop when the existing recovery floor is met');
  assert.equal(h.wallet().balance, 10_000, 'observation never buys food');
});

test('BUG-279: hidden, expired, disconnected and unsubscribed observers cannot trigger care', () => {
  const h = household(); const owner = socket();
  floor.subscribe(owner, { userId: h.userId, owner: true });
  floor.observeHome(owner, true);
  floor.observeHome(owner, false);
  now += 10_000;
  floor.careForObservedHome(h.userId);
  assert.equal(h.wallet().fridge.snack, 2);
  floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 1);
  const other = household(); floor.subscribe(owner, { userId: other.userId, owner: true });
  floor.observeHome(owner, true);
  now += 20_000;
  floor.careForObservedHome(other.userId);
  assert.equal(other.wallet().fridge.snack, 2, 'an expired foreground lease is inactive');
  owner.readyState = 3; floor.observeHome(owner, true);
  assert.equal(other.wallet().fridge.snack, 2);
  owner.readyState = 1; floor.unsubscribe(owner); floor.observeHome(owner, true);
  assert.equal(other.wallet().fridge.snack, 2);
});

test('BUG-279: empty shelves ask to open the fridge without changing money or consuming offline', () => {
  const h = household({ snacks: 0 }); const owner = socket();
  floor.subscribe(owner, { userId: h.userId, owner: true });
  floor.observeHome(owner, true);
  const first = profiles.presentAgentById(h.id, h.userId, { owner: true });
  assert.equal(first.want?.kind, 'food');
  assert.equal(first.want?.needs, 'stock');
  assert.equal(first.want?.action, 'feed');
  assert.match(first.want.text, /out of snacks/i);
  assert.equal(owner.frames.filter(frame => frame.type === 'home_state').at(-1).agents[0].want.actionLabel, 'Open the fridge');
  const stamp = first.want.at;
  now += 10_000; floor.observeHome(owner, true);
  assert.equal(profiles.presentAgentById(h.id, h.userId, { owner: true }).want.at, stamp, 'do not repeat the same ask');
  assert.equal(h.wallet().balance, 10_000);
  assert.equal(h.agent().lastSnackAt, undefined);
});

test('BUG-279: care leaves live seats, studies and visitors alone', () => {
  for (const extra of [{ study: { handId: 'h', endsAt: now + 90_000 } }, { visiting: { hostUserId: 'friend' } }, { archived: true }]) {
    const h = household({ extra }); const owner = socket();
    floor.subscribe(owner, { userId: h.userId, owner: true }); floor.observeHome(owner, true);
    assert.equal(h.wallet().fridge.snack, 3);
  }
  const h = household();
  seats.set(h.id, { tableId: 'home-live', closed: false, handInProgress: () => true });
  const owner = socket(); floor.subscribe(owner, { userId: h.userId, owner: true }); floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 3);
});

test('BUG-279: failed meal storage preserves stock and the visible agent, then retries once', () => {
  const h = household(); const owner = socket();
  floor.subscribe(owner, { userId: h.userId, owner: true });
  const before = structuredClone(h.agent()), wallet = h.wallet();
  store.adminDb().exec(`CREATE TRIGGER home_care_write_failure BEFORE INSERT ON agents WHEN NEW.owner_id='${h.userId}' BEGIN SELECT RAISE(ABORT, 'home care fixture failure'); END`);
  try {
    try { floor.observeHome(owner, true); } catch { /* state must still roll back */ }
    assert.deepEqual(h.wallet(), wallet, 'no snack can disappear before its effect is durable');
    assert.deepEqual(h.agent(), before);
  } finally { store.adminDb().exec('DROP TRIGGER home_care_write_failure'); }
  floor.observeHome(owner, true);
  assert.equal(h.wallet().fridge.snack, 2);
  assert.equal(h.agent().stamina.left, 45);
});

test('BUG-279: observing respects an explicit food No or Later', () => {
  for (const answer of ['no', 'later']) {
    const h = household({ extra: { homeFoodAskedAt: now - 1000,
      ...(answer === 'no' ? { snackRefusedAt: now } : {}), want: { kind: 'food', item: 'snack', homeCare: true, at: now - 1000,
      ...(answer === 'no' ? { answered: 'no' } : { snoozedUntil: now + 1800000 }) },
      wantCooldowns: answer === 'no' ? { food: now } : {} } });
    const owner = socket(); floor.subscribe(owner, { userId: h.userId, owner: true });
    floor.observeHome(owner, true);
    assert.equal(h.wallet().fridge.snack, 3, answer);
    assert.equal(h.agent().homeItem, undefined);
  }
});
