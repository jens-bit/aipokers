import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { HOODS, GLOWS } from '../shared/identity.js';

// Isolate before importing any persistence-owning module. No model calls.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
const token = '123456:wardrobe-fixture';
process.env.TELEGRAM_BOT_TOKEN = token;
process.env.NOTIFY_ENABLED = '0';
const previousCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-wardrobe-'));
process.chdir(scratch);
const { saveProfile, loadProfile, adminDb, _closeForTests } = await import('./store.js');
for (const userId of ['9101', '9102', 'guest-wardrobe']) saveProfile(userId, {
  userId, chat: [], agents: [{ id: `bird-${userId}`, name: 'Moss', status: 'idle',
    identity: { hood: 'ash', glow: 'teal' }, strategy: 'PRIVATE STRATEGY', ownerCommandRevision: 4,
    ownerReportIds: ['PRIVATE REPORT RECEIPT'], lastProposalAcceptance: { id: 'PRIVATE ACCEPTANCE' } }],
});
const { installAgentProfileRoutes, agentsOf, reloadOwners, floorSnapshot, setAgentChangeListener } = await import('./agentProfiles.js');
const { setGuestResolver } = await import('./auth.js');
const changes = [];
setAgentChangeListener(owner => changes.push(owner));
const app = express();
app.use(express.json());
installAgentProfileRoutes(app);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  setGuestResolver(null);
  setAgentChangeListener(null);
  await new Promise(resolve => server.close(resolve));
  _closeForTests();
  process.chdir(previousCwd);
  if (path.dirname(scratch) !== path.resolve(os.tmpdir())) throw new Error('Unsafe scratch path');
  fs.rmSync(scratch, { recursive: true, force: true });
});
function signed(id) {
  const fields = { id, first_name: 'Wardrobe', auth_date: String(Math.floor(Date.now() / 1000)) };
  const line = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', key).update(line).digest('hex');
  return { 'x-telegram-init-data': new URLSearchParams({ ...fields, hash }).toString() };
}
const patch = (body, headers = signed('9101'), owner = '9101', query = '') => fetch(`${base}/api/agents/bird-${owner}${query}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ userId: owner, ...body }),
});
const look = { hood: 'moss', glow: 'gold' };

test('Wardrobe: signed owner saves palette IDs durably, receives a sanitized revision and notifies the roster', async () => {
  const before = agentsOf('9101')[0].ownerCommandRevision;
  const response = await patch({ identity: look });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.identity, look);
  assert.equal(data.ownerCommandRevision, before + 1);
  assert.equal(data.ownerReportIds, undefined);
  assert.equal(data.lastProposalAcceptance, undefined);
  assert.deepEqual(changes, ['9101']);
  assert.deepEqual(loadProfile('9101').agents[0].identity, look);
  reloadOwners('9101');
  assert.deepEqual(agentsOf('9101')[0].identity, look);
  assert.equal(agentsOf('9101')[0].ownerCommandRevision, before + 1);
});

test('Wardrobe: missing credentials, another owner and conflicting identities cannot recolor an agent', async () => {
  const before = structuredClone(agentsOf('9101')[0]);
  assert.equal((await patch({ identity: look }, {})).status, 401);
  assert.equal((await patch({ identity: look }, signed('9102'))).status, 403);
  assert.equal((await patch({ identity: look }, signed('9101'), '9101', '?userId=9102')).status, 403);
  assert.deepEqual(agentsOf('9101')[0], before);
});

test('Wardrobe: malformed or unrecognized palettes reject before rename or strategy can change', async () => {
  const before = structuredClone(agentsOf('9101')[0]);
  const emissions = changes.length;
  for (const identity of [null, [], 'moss', {}, { hood: 'moss' }, { hood: 'rainbow', glow: 'gold' },
    { hood: 'moss', glow: '#C9A227' }, { hood: { id: 'moss' }, glow: 'gold' }, { ...look, attrs: { focus: 100 } }]) {
    const response = await patch({ identity, name: 'Should not change', strategy: 'Should not change' });
    assert.equal(response.status, 400, JSON.stringify(identity));
    assert.equal((await response.json()).error, 'invalidAppearance');
    assert.deepEqual(agentsOf('9101')[0], before);
  }
  assert.equal(changes.length, emissions);
});

test('Wardrobe: all existing palette combinations are accepted without changing gameplay or private records', async () => {
  // A restored legacy record receives ordinary attribute/pocket backfills on
  // its first read. Compare the loaded playable record, not a partial seed.
  await fetch(`${base}/api/agents/bird-9101?userId=9101`, { headers: signed('9101') });
  const before = structuredClone(agentsOf('9101')[0]);
  for (const hood of HOODS) for (const glow of GLOWS) {
    const response = await patch({ identity: { hood: hood.id, glow: glow.id },
      attrs: { focus: 100 }, pocket: { balance: 999999 }, profile: { aggression: 100 }, ownerReportIds: [] });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).identity, { hood: hood.id, glow: glow.id });
  }
  const after = agentsOf('9101')[0];
  for (const key of ['attrs', 'pocket', 'profile', 'strategy', 'ownerReportIds', 'lastProposalAcceptance']) {
    assert.deepEqual(after[key], before[key], key);
  }
});

test('Wardrobe: a valid guest cookie may change only its own existing agent', async () => {
  setGuestResolver(req => req.headers.cookie === 'fixture=wardrobe' ? 'guest-wardrobe' : null);
  try {
    const response = await patch({ identity: look }, { cookie: 'fixture=wardrobe' }, 'guest-wardrobe');
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).identity, look);
    const before = structuredClone(agentsOf('9101')[0]);
    assert.equal((await patch({ identity: look }, { cookie: 'fixture=wardrobe' })).status, 403);
    assert.deepEqual(agentsOf('9101')[0], before);
  } finally { setGuestResolver(null); }
});

test('Wardrobe: public and compact projections show saved colors without private receipt data', async () => {
  const response = await fetch(`${base}/api/agents/bird-9101?userId=9101`, { headers: signed('9102') });
  const data = await response.json();
  assert.deepEqual(data.identity, agentsOf('9101')[0].identity);
  assert.equal(data.ownerCommandRevision, undefined);
  assert.equal(data.strategy, undefined);
  for (const owner of [false, true]) {
    const compact = floorSnapshot('9101', { owner })[0];
    assert.deepEqual(compact.identity, data.identity);
    assert.equal(compact.ownerCommandRevision, owner ? agentsOf('9101')[0].ownerCommandRevision : undefined);
    assert.equal(compact.ownerReportIds, undefined);
  }
});

test('Wardrobe: the next real table snapshot reads saved colors without changing the hand or exposing cards', async () => {
  const { Table } = await import('./table.js');
  const { Game } = await import('../engine/game.js');
  const table = new Table({ tableId: 'wardrobe-live', smallBlind: 10, bigBlind: 20 });
  const seats = [{ playerId: 'p0', stack: 2000 }, { playerId: 'p1', stack: 2000 }];
  table.pending[0] = { playerId: 'p0', displayName: 'Moss', buyIn: 2000 };
  table.pending[1] = { playerId: 'p1', displayName: 'Other', buyIn: 2000 };
  table.agentIds[0] = 'bird-9101'; table.agentUserIds[0] = '9101';
  table.game = new Game({ tableId: table.tableId, seats, smallBlind: 10, bigBlind: 20 });
  table.game.startHand(); table.autoPlay = true;
  const unchangedHand = structuredClone(table.game.getPublicState(0));
  const next = { hood: 'indigo', glow: 'ember' };
  assert.notDeepEqual(table._seatIdentity(0), next);
  assert.equal((await patch({ identity: next })).status, 200);
  const publicState = table._augmentState(table.game.getPublicState(-1), -1);
  const ownState = table._augmentState(table.game.getPublicState(0), 0);
  for (const view of [publicState, ownState, table.feltView(), table.liveGameView('bird-9101')]) {
    assert.deepEqual(view.seats[0].identity, next);
    assert.equal(view.seats[1].identity, null);
    assert.equal(JSON.stringify(view).includes('PRIVATE'), false);
  }
  assert.deepEqual(publicState.seats.map(seat => seat.holeCards), [[], []]);
  assert.equal(ownState.seats[0].holeCards.length, 2);
  assert.deepEqual(ownState.seats[1].holeCards, []);
  assert.deepEqual(table.game.getPublicState(0), unchangedHand);
  assert.equal(table.actionTimer, null);
});

test('Wardrobe: a rejected database write leaves in-memory colors and revision unchanged and can be retried', async () => {
  const before = structuredClone(agentsOf('9101')[0]);
  const storedBefore = loadProfile('9101');
  const emissions = changes.length;
  adminDb().exec("CREATE TRIGGER wardrobe_write_failure BEFORE INSERT ON agents WHEN NEW.owner_id='9101' BEGIN SELECT RAISE(ABORT, 'wardrobe fixture failure'); END");
  try {
    const response = await patch({ identity: look, name: 'No partial rename' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'appearanceSaveFailed');
    assert.deepEqual(agentsOf('9101')[0], before);
    assert.deepEqual(loadProfile('9101'), storedBefore);
    assert.equal(changes.length, emissions);
  } finally { adminDb().exec('DROP TRIGGER wardrobe_write_failure'); }
  assert.equal((await patch({ identity: look })).status, 200);
  assert.deepEqual(loadProfile('9101').agents[0].identity, look);
});

test('Wardrobe: legacy rename/strategy PATCH retains its existing response contract', async () => {
  const before = agentsOf('9102')[0].identity;
  const response = await patch({ name: 'Updated name', strategy: 'Updated strategy' }, signed('9102'), '9102');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.name, 'Updated name');
  assert.equal(data.strategy, 'Updated strategy');
  assert.deepEqual(data.identity, before);
});
