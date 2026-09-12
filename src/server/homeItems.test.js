// HOME-2: Home animates an accepted fridge action, never a guess from dialogue.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED = '0';

const { saveProfile, loadProfile, saveWallet, loadWallet, _closeForTests } = await import('./store.js');
const { agentsOf, reloadOwners, giveItemTo, giveItemFrom, takeDrinkForSession,
  homeSnapshot, floorSnapshot, presentedRoster, presentAgentById, setLiveTableProvider } = await import('./agentProfiles.js');

after(() => { setLiveTableProvider(null); _closeForTests(); });
let sequence = 0;
function fixture(extra = {}, fridge = { beer: 3, snack: 2 }) {
  const owner = `home2-item-${++sequence}`;
  saveWallet(owner, { ownerId: owner, balance: 1000, fridge, ledger: [] });
  saveProfile(owner, { userId: owner, chat: [], agents: [{
    id: `${owner}-agent`, name: 'Rock', nature: 'Rock', status: 'idle', activeTableId: null,
    strategy: 'Wait for a good hand.', stats: { handsPlayed: 0 },
    mood: { state: 'tilted', heat: 80 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] }, bankroll: 2000,
    ...extra,
  }] });
  reloadOwners(owner);
  setLiveTableProvider({ hasTable: () => false, getTable: () => null, homeTableOf: () => null });
  return { owner, agent: agentsOf(owner)[0], home: () => homeSnapshot(owner, { owner: true }).agents[0] };
}

test('HOME-2: an accepted beer persists its exact event while reads and the next session cannot replay it', t => {
  let now = 1700000000000;
  t.mock.method(Date, 'now', () => now);
  const { agent, owner, home } = fixture();
  assert.equal(home().homeItem, null);
  const result = giveItemFrom(agent, owner, 'beer');
  assert.equal(result.status, 200);
  assert.equal(result.body.spent, 0);
  assert.equal(result.body.mood.heat, 65);
  assert.deepEqual(home().homeItem, { item: 'beer', at: now });
  assert.deepEqual(loadProfile(owner).agents[0].homeItem, home().homeItem);
  assert.equal(home().homeItem.at, result.body.moment.at);
  assert.equal(loadWallet(owner).balance, 1000);
  assert.deepEqual(loadWallet(owner).fridge, { beer: 2, snack: 2 });
  assert.equal(agent.drinkPending, true);
  now += 60000;
  reloadOwners(owner);
  assert.deepEqual(home().homeItem, { item: 'beer', at: now - 60000 }, 'reload/read does not create a new action');
  assert.equal(takeDrinkForSession(agent.id, owner), true);
  assert.equal(takeDrinkForSession(agent.id, owner), false);
  assert.deepEqual(home().homeItem, { item: 'beer', at: now - 60000 }, 'session flag has its own lifetime');
});

test('HOME-2: the next accepted snack replaces the event and preserves existing snack/drink effects', t => {
  let now = 1700000000000;
  t.mock.method(Date, 'now', () => now);
  const { agent, owner, home } = fixture();
  assert.equal(giveItemFrom(agent, owner, 'beer').status, 200);
  now += 10000;
  const result = giveItemFrom(agent, owner, 'snack');
  assert.equal(result.status, 200);
  assert.equal(result.body.drinking, false);
  assert.equal(agent.lastSnackAt, now);
  assert.equal(agent.drinkPending, true, 'snack does not spend next-session beer');
  assert.deepEqual(home().homeItem, { item: 'snack', at: now });
  assert.deepEqual(loadProfile(owner).agents[0].homeItem, home().homeItem);
  assert.deepEqual(loadWallet(owner).fridge, { beer: 2, snack: 1 });
  assert.equal(loadWallet(owner).balance, 1000);
});

test('HOME-2: the common accepted give path records the event before each caller saves', t => {
  t.mock.method(Date, 'now', () => 1700000000000);
  const { agent, owner, home } = fixture();
  assert.equal(giveItemTo(agent, owner, 'snack').ok, true);
  assert.deepEqual(home().homeItem, { item: 'snack', at: 1700000000000 });
  assert.equal(loadProfile(owner).agents[0].homeItem, undefined,
    'the common helper still saves only the wallet; give/want callers own the agent save');
});

test('HOME-2: invalid, empty and level refusals never create or replace an accepted event', () => {
  for (const previous of [undefined, { item: 'beer', at: 1700000000000 }]) {
    for (const refusal of ['invalid', 'empty', 'level']) {
      const { agent, owner, home } = fixture({ homeItem: previous,
        ...(refusal === 'level' ? { mood: { state: 'neutral', heat: 0 } } : {}),
      }, refusal === 'empty' ? { beer: 0, snack: 0 } : { beer: 3, snack: 2 });
      home(); // Existing presentation backfills legacy mood defaults.
      const wallet = loadWallet(owner);
      const mood = structuredClone(agent.mood);
      const result = giveItemFrom(agent, owner, refusal === 'invalid' ? 'caviar' : 'beer');
      assert.equal(result.status, refusal === 'empty' ? 409 : 400, refusal);
      assert.deepEqual(home().homeItem, previous ?? null, refusal);
      assert.deepEqual(agent.mood, mood, refusal);
      assert.deepEqual(loadWallet(owner), wallet, refusal);
      assert.equal(agent.drinkPending, undefined, refusal);
    }
  }
});

test('HOME-2: only owner Home gets its own typed event; guests, floor and profile remain private', () => {
  const { owner, agent, home } = fixture({ homeItem: { item: 'beer', at: 1700000000000, privateNote: 'do not expose' } });
  const other = fixture({ homeItem: { item: 'snack', at: 1700000000001000 } });
  assert.deepEqual(home().homeItem, { item: 'beer', at: 1700000000000 });
  assert.deepEqual(other.home().homeItem, { item: 'snack', at: 1700000000001000 });
  const guest = { ...presentAgentById(other.agent.id, other.owner, { owner: true }), homeItem: other.agent.homeItem };
  const visiting = homeSnapshot(owner, { owner: true, visitors: [guest] });
  assert.equal(visiting.agents.find(a => a.id === other.agent.id).guest, true);
  assert.equal(Object.hasOwn(visiting.agents.find(a => a.id === other.agent.id), 'homeItem'), false);
  for (const ownerView of [false, true]) {
    for (const projection of [floorSnapshot(owner, { owner: ownerView })[0],
      presentedRoster(owner, { owner: ownerView })[0], presentAgentById(agent.id, owner, { owner: ownerView })]) {
      assert.equal(Object.hasOwn(projection, 'homeItem'), false);
    }
  }
  assert.equal(Object.hasOwn(homeSnapshot(owner).agents[0], 'homeItem'), false);
  const projected = home().homeItem;
  projected.item = 'snack';
  assert.equal(agent.homeItem.item, 'beer', 'wire projection cannot mutate the stored event');
});

test('HOME-2: malformed stored item records cannot become a fridge animation', () => {
  for (const homeItem of [null, {}, { item: 'caviar', at: 1700000000000 },
    { item: 'beer', at: 0 }, { item: 'beer', at: -1 }, { item: 'snack', at: '1700000000000' }]) {
    assert.equal(fixture({ homeItem }).home().homeItem, null);
  }
});
