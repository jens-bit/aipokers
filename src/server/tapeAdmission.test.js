// BUG-262: both study entry points respect the live kitchen and the single TV.
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
process.env.HOME_STUDY_MS = '90000';
const cwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-study-admission-'));
process.chdir(scratch);
const store = await import('./store.js');
const { buildFlaggedEntry } = await import('./flaggedHands.js');
const tape = await import('./tapeRoom.js');
const idle = await import('./tapeIdle.js');
const home = await import('./homeGame.js');
const registry = await import('./tableRegistry.js');
let profiles;
const owners = ['kitchen-auto', 'kitchen-manual', 'tv-auto', 'tv-manual', 'other-flat'];
const ids = owner => [`${owner}-one`, `${owner}-two`];

before(async () => {
  for (const owner of owners) store.saveProfile(owner, { userId: owner, chat: [], agents: ids(owner).map(id => ({
    id, name: id, status: 'idle', activeTableId: null,
    style: 'Balanced', risk: 'Medium', strategy: 'Play patient poker.',
    profile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 },
    bankroll: 3000, pocket: { balance: 3000, mode: 'topup', cap: null, realised: 0, ledger: [] },
    stats: { handsPlayed: 40, handsWon: 10, totalDecisions: 100 },
    sessionFlagged: [{ ...buildFlaggedEntry({
      handNumber: 41, flagType: 'badBeat', pot: 3600, won: false, holeCards: ['Ah', 'Kd'],
      opponents: [{ seat: 1, playerId: 'granite', displayName: 'Granite' }],
      opponentShowdownCards: [{ seat: 1, holeCards: ['7h', '7s'] }],
    }), flaggedAt: Date.now() }],
  })) });
  profiles = await import('./agentProfiles.js');
  profiles.setLiveTableProvider(registry);
});

beforeEach(() => {
  home.reset(); registry.resetRegistry('between admission tests'); tape.reset();
  for (const owner of owners) for (const id of ids(owner)) profiles.setAgentStudy(id, owner, null);
});

after(() => {
  home.reset(); registry.resetRegistry('admission tests complete'); tape.reset();
  profiles?.setLiveTableProvider(null); store._closeForTests(); process.chdir(cwd);
  fs.rmSync(scratch, { recursive: true, force: true });
});

const roster = owner => profiles.presentedRoster(owner, { owner: true });
const count = (owner, id) => store.loadProfile(owner).agents.find(agent => agent.id === id).tape?.self?.count ?? 0;

test('automatic study excludes every presented live kitchen seat', () => {
  const atHome = { id: 'a', location: { where: 'home' }, fatigue: 'fresh' };
  assert.equal(idle.idleAtHome(atHome), true);
  assert.equal(idle.idleAtHome({ ...atHome, homeTableId: 'home-owner' }), false);
  assert.equal(idle.idleAtHome({ ...atHome, liveGame: { home: true, tableId: 'home-owner' } }), false);
});

for (const automatic of [true, false]) test(`${automatic ? 'automatic' : 'owner-requested'} study cannot take an agent out of a real kitchen hand`, () => {
  const owner = automatic ? 'kitchen-auto' : 'kitchen-manual';
  const [id] = ids(owner);
  const stale = roster(owner).find(agent => agent.id === id);
  home.configure({ liveTables: registry, agentsFor: roster });
  const started = home.sync(owner);
  const table = registry.getTable(started.tableId);
  assert.ok(table?.home);
  table._maybeRunAiTurn = async () => {}; // Hold this real hand at the decision boundary.
  table.maybeStartHand();
  assert.ok(table.handInProgress());
  const hand = table.game;
  const before = JSON.stringify(hand.getPublicState(-1));
  assert.equal(profiles.getAgentHome(id, owner).homeTableId, table.tableId);
  if (automatic) {
    assert.equal(idle.maybeStudy(stale, owner), null, 'a stale idle projection must also be refused');
    assert.equal(idle.sweep(owner, roster(owner)), 0);
  } else {
    const result = tape.beginStudy(id, owner, { handId: 41 });
    assert.equal(result.status, 409);
    assert.match(result.body.error, /kitchen table/i);
  }
  assert.equal(profiles.getAgentStudy(id, owner), null);
  assert.equal(count(owner, id), 0, 'being busy does not consume a daily study');
  home.sync(owner);
  assert.equal(table.closed, false);
  assert.equal(table.game, hand);
  assert.equal(JSON.stringify(hand.getPublicState(-1)), before);
});

test('a household sweep admits one student and leaves the next daily allowance intact', () => {
  const owner = 'tv-auto', [first, second] = ids(owner);
  assert.equal(idle.sweep(owner, roster(owner)), 1);
  assert.ok(tape.isStudying(first)); assert.equal(tape.isStudying(second), false);
  assert.equal(count(owner, first), 1); assert.equal(count(owner, second), 0);
  assert.deepEqual(profiles.getTapeWatches(second, owner), {});
  assert.equal(tape.beginStudy(second, owner, { handId: 41 }).status, 409);
  assert.ok(tape.finishStudy(first, owner));
  assert.ok(idle.maybeStudy(roster(owner).find(agent => agent.id === second), owner));
  assert.equal(count(owner, second), 1, 'a free TV permits the deferred student');
});

test('automatic study respects an owner-requested tape; another flat has its own TV', () => {
  const owner = 'tv-manual', [first, second] = ids(owner);
  assert.equal(tape.beginStudy(first, owner, { handId: 41 }).status, 200);
  assert.equal(idle.maybeStudy(roster(owner).find(agent => agent.id === second), owner), null);
  assert.equal(count(owner, second), 0);
  assert.ok(idle.maybeStudy(roster('other-flat')[0], 'other-flat'));
  assert.equal(roster(owner).filter(agent => agent.study).length, 1);
});
