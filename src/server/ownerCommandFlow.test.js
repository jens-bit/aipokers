delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.env.RATE_LIMIT_CHAT_MAX = '1000';
process.env.NOTIFY_ENABLED = '0';
import test, { before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-owner-command-'));
let profiles, registry, store, server, base, owner, agent, sequence = 0;
let tape;
const seed = (id, pocket = 2000) => ({ id, name: 'The Clock', status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: pocket,
  pocket: { agentId: id, balance: pocket, mode: 'allowance', cap: null, realised: 0, ledger: [] },
  nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 45 }, stats: { handsPlayed: 0 },
  profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 }, sessionLog: [], ledger: [] });

before(async () => {
  store = await import('./store.js'); store._closeForTests(); process.chdir(scratch);
  profiles = await import('./agentProfiles.js'); registry = await import('./tableRegistry.js');
  tape = await import('./tapeRoom.js');
  const { default: express } = await import('express');
  const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => tape.reset());
beforeEach(() => {
  registry.resetRegistry('next command test');
  owner = `command-${++sequence}`;
  const id = `command-agent-${sequence}`;
  store.saveWallet(owner, { ownerId: owner, balance: 10000, ledger: [], fridge: { snack: 2, beer: 2 } });
  store.saveProfile(owner, { userId: owner, agents: [seed(id)] }); profiles.reloadOwners(owner);
  profiles.setLiveTableProvider(registry); agent = profiles._agentRecordForTests(id, owner);
});
after(async () => {
  registry.resetRegistry('commands over'); profiles.setLiveTableProvider(null);
  await new Promise(resolve => server.close(resolve)); store._closeForTests(); process.chdir(originalCwd);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});
async function say(content, extra = {}, headers = {}) {
  const response = await fetch(`${base}/api/agents/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ userId: owner, existingAgentId: agent.id, content, ...extra }) });
  return { status: response.status, body: await response.json() };
}

test('BUG-260: exact proposal acceptance saves a bounded private receipt and retries cannot apply twice or accept a replacement', async () => {
  agent.memory = { computed: { leaks: { foldedAsEquityFavorite: 3 } } };
  const proposal = profiles.maybeCreateProposal(agent);
  const proposalId = String(proposal.id ?? proposal.createdAt);
  const accept = async id => {
    const response = await fetch(`${base}/api/agents/${agent.id}/proposal/accept`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: owner, proposalId: id,
        suggestedPatch: { profileDelta: { aggression: 99 } } }) });
    return { status: response.status, body: await response.json() };
  };
  let broadcasts = 0; profiles.setAgentChangeListener(() => { broadcasts++; });
  try {
    const missing = await accept(undefined);
    assert.equal(missing.status, 409);
    assert.equal(agent.profile.tightness, 60);
    const first = await accept(proposalId);
    assert.equal(first.status, 200);
    assert.equal(first.body.profile.tightness, 52);
    assert.equal(first.body.profile.aggression, 45, 'client patch is never authority');
    assert.equal(first.body.proposal, null);
    assert.equal(first.body.ownerCommandRevision, 1);
    assert.match(first.body.proposalAcceptance.reply, /60%.*52%/);
    assert.doesNotMatch(first.body.proposalAcceptance.reply, /next time.*sit/i, 'an agent already home needs no deferred-session caveat');
    assert.equal(agent.chatHistory.at(-1).content, first.body.proposalAcceptance.reply);
    assert.equal(broadcasts, 1);
    const again = await accept(proposalId);
    assert.equal(again.status, 200);
    assert.equal(again.body.profile.tightness, 52);
    assert.equal(agent.chatHistory.length, 1, 'retry does not add a duplicate acknowledgement');
    assert.equal(broadcasts, 1);
    const replacement = profiles.maybeCreateProposal(agent);
    assert.notEqual(String(replacement.id ?? replacement.createdAt), proposalId);
    await accept(proposalId);
    assert.equal(agent.proposal, replacement);
    assert.equal(agent.profile.tightness, 52);
    assert.equal((await accept('other-proposal')).status, 409);
    assert.equal(profiles.presentAgent(agent, { owner: false }).lastProposalAcceptance, undefined);
  } finally { profiles.setAgentChangeListener(null); }
});

test('BUG-260: a seated acceptance explains next-seating activation and preserves the current strategy snapshot', async () => {
  agent.memory = { computed: { leaks: { foldedAsEquityFavorite: 3 } } };
  const proposal = profiles.maybeCreateProposal(agent);
  assert.equal(profiles.deployAgent(owner, agent.id, { body: { rung: 0 } }).status, 200);
  const table = registry.tableOfAgent(agent.id), seat = table.seatOfAgent(agent.id);
  table._maybeRunAiTurn = async () => {};
  table._clearTimers();
  const currentProfile = structuredClone(table.agentProfiles[seat]), currentStrategy = table.aiStrategy[seat];
  // The live chair remains authoritative if an old stored pointer is lost.
  agent.activeTableId = null;
  const accept = async () => {
    const response = await fetch(`${base}/api/agents/${agent.id}/proposal/accept`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: owner, proposalId: proposal.id }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const accepted = await accept();
  assert.match(accepted.proposalAcceptance.reply, /next time I sit down/i);
  assert.equal(agent.profile.tightness, 52);
  assert.notEqual(agent.strategy, currentStrategy);
  assert.deepEqual(table.agentProfiles[seat], currentProfile, 'acceptance never reloads an active session policy');
  assert.equal(table.aiStrategy[seat], currentStrategy);
  assert.deepEqual((await accept()).proposalAcceptance, accepted.proposalAcceptance, 'retry keeps the original truthful receipt');
  table.closeTable('acceptance timing test');
  assert.equal(profiles.deployAgent(owner, agent.id, { body: { rung: 0 } }).status, 200);
  const next = registry.tableOfAgent(agent.id), nextSeat = next.seatOfAgent(agent.id);
  next._maybeRunAiTurn = async () => {};
  next._clearTimers();
  assert.equal(next.agentProfiles[nextSeat].tightness, 52, 'the next seating uses the saved strategy');
  assert.equal(next.aiStrategy[nextSeat], agent.strategy);
});

test('BUG-260: a kitchen chair also explains next-seating activation without moving chips or its current policy', async () => {
  agent.memory = { computed: { leaks: { foldedAsEquityFavorite: 3 } } };
  const proposal = profiles.maybeCreateProposal(agent);
  const table = registry.getOrCreateTable(`home-${owner}`, { home: true, homeOwnerId: owner, maxSeats: 2 });
  const seat = table.seatAI({ agentId: agent.id, userId: owner, displayName: agent.name,
    strategy: agent.strategy, agentProfile: agent.profile, buyIn: 2000 });
  table.seatAI({ displayName: 'Kitchen companion', buyIn: 2000 });
  table._maybeRunAiTurn = async () => {};
  table.maybeStartHand(); table._clearTimers();
  assert.ok(table.handInProgress());
  assert.equal(agent.activeTableId, null, 'kitchen membership is not a casino session pointer');
  profiles.presentAgent(agent, { owner: true }); // Normalize the ordinary owner projection before comparing the pocket.
  const seated = structuredClone(table.agentProfiles[seat]), pocket = structuredClone(agent.pocket);
  const response = await fetch(`${base}/api/agents/${agent.id}/proposal/accept`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: owner, proposalId: proposal.id }) });
  assert.equal(response.status, 200);
  assert.match((await response.json()).proposalAcceptance.reply, /next time I sit down/i);
  assert.equal(agent.profile.tightness, 52);
  assert.deepEqual(table.agentProfiles[seat], seated);
  assert.deepEqual(agent.pocket, pocket);
});

test('BUG-264: a real completed casino session returns a private report when an existing conversation reopens', async () => {
  agent.chatHistory = [{ role: 'user', content: 'Play carefully.' }, { role: 'assistant', content: 'I will pick my spots.' }];
  await say('play 10/20');
  const table = registry.tableOfAgent(agent.id);
  const sessionId = table.sessionIdAtSeat(table.agentIds.indexOf(agent.id));
  table.closeTable('owner report test');
  const reopened = await (await fetch(`${base}/api/agents/${agent.id}?userId=${owner}`)).json();
  const reports = reopened.chatHistory.filter(m => m.reportKind === 'session');
  assert.equal(reports.length, 1, 'a new session result must survive alongside the earlier conversation');
  assert.equal(reports[0].reportId, sessionId);
  assert.match(reports[0].content, /0 hands.*\$0/i);
  assert.deepEqual(store.loadProfile(owner).agents[0].chatHistory.at(-1), reports[0], 'the report is durable, not just this process projection');
  assert.equal(reopened.chatHistory[0].content, 'Play carefully.');
  await fetch(`${base}/api/agents/${agent.id}/seen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: owner }) });
  table.closeTable('already closed');
  const again = await (await fetch(`${base}/api/agents/${agent.id}?userId=${owner}`)).json();
  assert.equal(again.chatHistory.filter(m => m.reportKind === 'session').length, 1);
  assert.equal(again.unseenRecap, false, 'reading/reopening never republishes an acknowledged result');
  assert.equal(profiles.presentAgent(agent, { owner: false }).chatHistory, undefined);
});

test('BUG-264: completed study reports its actual read once in the saved private conversation', async () => {
  agent.chatHistory = [{ role: 'user', content: 'Look at his sizing.' }, { role: 'assistant', content: 'I will watch it.' }];
  agent.sessionFlagged = [{ handNumber: 42, flagType: 'badBeat', pot: 900, holeCards: ['Ah', 'Kd'], won: false,
    streets: [], opponents: [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }],
    opponentShowdownCards: [{ seat: 1, holeCards: ['7h', '7s'] }] }];
  const started = await say('study hand 42');
  assert.equal(started.body.command.status, 'done');
  assert.equal(agent.chatHistory.filter(m => m.reportKind === 'study').length, 0, 'starting has not earned a read');
  const studying = { ...agent.study, pending: { ...agent.study.pending } };
  const learned = tape.finishStudy(agent.id, owner);
  assert.ok(learned?.text);
  const reopened = await (await fetch(`${base}/api/agents/${agent.id}?userId=${owner}`)).json();
  const reports = reopened.chatHistory.filter(m => m.reportKind === 'study');
  assert.equal(reports.length, 1);
  assert.match(reports[0].content, /hand #42/);
  assert.ok(reports[0].content.includes(learned.text), 'the reply repeats the earned read, not a generated claim');
  assert.deepEqual(store.loadProfile(owner).agents[0].chatHistory.at(-1), reports[0]);
  assert.equal(reopened.chatHistory[0].content, 'Look at his sizing.');
  tape.finishStudy(agent.id, owner, { pending: studying.pending, handNumber: 42, startedAt: studying.startedAt });
  assert.equal(agent.chatHistory.filter(m => m.reportKind === 'study').length, 1, 'a repeated completion cannot duplicate its report');
  assert.equal(profiles.presentAgent(agent, { owner: false }).chatHistory, undefined);
});

test('BUG-251: owner chooses stakes in chat and gets one actual seat and one buy-in', async () => {
  const ask = await say('go to the casino');
  assert.equal(ask.status, 200);
  assert.equal(ask.body.command?.status, 'clarification');
  assert.equal(ask.body.agent.ownerCommandRevision, 1);
  assert.equal(agent.activeTableId, null);
  const dealt = await say('10/20');
  assert.equal(dealt.body.command?.status, 'done', JSON.stringify(dealt.body));
  assert.equal(dealt.body.agent.ownerCommandRevision, 2);
  const table = registry.tableOfAgent(agent.id);
  assert.ok(table, 'a reply alone does not seat the agent');
  assert.equal(table.bigBlind, 20);
  assert.equal(agent.pocket.balance, 0);
  const tableId = table.tableId;
  await say('play 10/20');
  assert.equal(registry.tableOfAgent(agent.id).tableId, tableId);
  assert.equal(agent.pocket.balance, 0, 'a repeated request never pays twice');
});

test('BUG-251: a refused stake asks before moving safe funds, then confirms actual transfer and seat', async () => {
  const refused = await say('play 25/50');
  assert.equal(refused.body.command?.status, 'clarification');
  assert.equal(agent.pocket.balance, 2000);
  assert.equal(store.loadWallet(owner).balance, 10000);
  const accepted = await say('yes');
  assert.equal(accepted.body.command?.status, 'done', JSON.stringify(accepted.body));
  assert.equal(registry.tableOfAgent(agent.id)?.bigBlind, 50);
  assert.equal(store.loadWallet(owner).balance, 7000);
  assert.equal(agent.pocket.balance, 0);
});

test('BUG-251: unrelated conversation cancels pending action and foreign agent cannot inherit it', async () => {
  await say('go to the casino');
  await say('where are you?');
  await say('yes');
  assert.equal(agent.activeTableId, null);
  assert.equal(agent.ownerCommand ?? null, null);
  const foreign = await say('play 10/20', { existingAgentId: 'another-owners-agent' });
  assert.equal(foreign.status, 404);
});

test('BUG-251: snack and rest change real care state; missing study cannot claim success', async () => {
  agent.stamina = { left: 50, at: Date.now(), stage: 'settled' };
  const beforeHeat = agent.mood.heat;
  const fed = await say('have a snack');
  assert.equal(fed.body.command?.status, 'done', JSON.stringify(fed.body));
  assert.equal(store.loadWallet(owner).fridge.snack, 1);
  assert.ok(agent.mood.heat < beforeHeat);
  agent.stamina = { left: 20, at: Date.now(), stage: 'cooked' };
  const rested = await say('take a nap');
  assert.equal(rested.body.command?.status, 'done');
  assert.ok(agent.restBench);
  const study = await say('study');
  assert.equal(study.body.command?.status, 'refused');
  assert.match(study.body.chat[0].content, /nothing.*tape/i);
});

test('BUG-251: signed strangers and forged command identities cannot spend or move this agent', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'command-test-token';
  try {
    const data = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 'stranger' }) });
    const signed = [...data.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    data.set('hash', createHmac('sha256', secret).update(signed).digest('hex'));
    const refused = await say('play 10/20', { ownerId: 'stranger', command: { action: 'deploy', userId: owner } },
      { 'x-telegram-init-data': data.toString() });
    assert.equal(refused.status, 403);
    assert.equal(agent.pocket.balance, 2000);
    assert.equal(agent.activeTableId, null);
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; }
});

test('BUG-251: ordinary model turns retain bounded context and cannot manufacture command success', async t => {
  const requests = [];
  let output = 'I heard you.';
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com');
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'command-model-fixture', type: 'message', role: 'assistant', model: 'fixture',
      stop_reason: 'end_turn', content: [{ type: 'text', text: output }], usage: { input_tokens: 1, output_tokens: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  process.env.ANTHROPIC_API_KEY = 'intercepted-never-sent';
  try {
    await profiles.ownerChatTurn(agent, owner, 'Remember that I prefer quiet evenings.');
    await profiles.ownerChatTurn(agent, owner, 'What did I just tell you?');
    assert.deepEqual(requests[1].messages.map(m => m.role), ['user', 'assistant', 'user']);
    assert.match(requests[1].messages[0].content, /quiet evenings/);
    output = '{"action":"deploy","ownerId":"someone-else","message":"I bought a seat"}';
    const answer = await profiles.ownerChatTurn(agent, owner, 'Tell me a story.');
    assert.doesNotMatch(answer.chat[0].content, /someone-else|bought|action/);
    assert.equal(agent.activeTableId, null);
    assert.equal(agent.pocket.balance, 2000);
    assert.equal(requests.length, 3, 'one call per ordinary owner message, no repair call');
  } finally { delete process.env.ANTHROPIC_API_KEY; }
});

test('BUG-251: a room-wide command asks for a private target and cannot deploy every resident', async () => {
  const response = await profiles.ownerChatTurn(agent, owner, 'play 10/20', { commandScope: 'room' });
  assert.equal(response.command.status, 'clarification');
  assert.match(response.chat[0].content, /private conversation/);
  assert.equal(agent.activeTableId, null);
  assert.equal(agent.pocket.balance, 2000);
});

test('BUG-251: oversized owner messages are refused before saving or model calls', async () => {
  const response = await say('x'.repeat(2001));
  assert.equal(response.status, 400);
  assert.equal(agent.chatHistory, undefined);
});

test('BUG-251: a rest command at the kitchen table waits for the actual seat to finish', async () => {
  const cuts = [];
  agent.stamina = { left: 40, at: Date.now(), stage: 'settled' };
  const before = { ...agent.stamina };
  const kitchen = { tableId: 'home-command', agentIds: [agent.id], pending: [{}], closed: false,
    seatOfAgent: () => 0, sitOutSeat: (seat, options) => cuts.push({ seat, options }),
    whisperContext: () => ({ tableId: 'home-command', seat: 0, street: 'flop', inHand: true }),
    receiveWhisper() {}, whisperReply() { return 0; } };
  profiles.setLiveTableProvider({ ...registry, homeTableOf: () => kitchen });
  const rested = await say('rest');
  assert.equal(rested.body.command.status, 'pending');
  assert.match(rested.body.chat[0].content, /finish this hand, then rest/);
  assert.deepEqual(cuts, [{ seat: 0, options: { afterHand: true } }]);
  assert.deepEqual(agent.stamina, before, 'seated time never earns rest credit');
});

test('BUG-251: a chip transfer preserves existing automatic backing and its cap', async () => {
  agent.pocket.mode = 'auto'; agent.pocket.cap = 6000;
  const funded = await say('give me 500 chips');
  assert.equal(funded.body.command.status, 'done');
  assert.equal(agent.pocket.balance, 2500);
  assert.equal(agent.pocket.mode, 'auto');
  assert.equal(agent.pocket.cap, 6000);
  await say('play 25/50');
  await say('yes');
  assert.equal(agent.pocket.mode, 'auto');
  assert.equal(agent.pocket.cap, 6000);
});

test('BUG-251: funding a called-in agent does not silently resume play; explicit resume confirms the rule', async () => {
  agent.pocket.mode = 'cut'; agent.pocket.recall = true;
  const funded = await say('give me 500 chips');
  assert.equal(funded.body.command.status, 'done');
  assert.equal(agent.pocket.mode, 'cut');
  assert.equal(agent.pocket.recall, true);
  assert.match(funded.body.chat[0].content, /still called in/);
  const requested = await say('play 10/20');
  assert.equal(requested.body.command.status, 'clarification');
  assert.match(requested.body.chat[0].content, /resume.*no automatic refill/i);
  assert.equal(registry.tableOfAgent(agent.id), null);
  const confirmed = await say('yes');
  assert.equal(confirmed.body.command.status, 'done');
  assert.equal(agent.pocket.mode, 'allowance');
  assert.equal(agent.pocket.recall, false);
  assert.equal(registry.tableOfAgent(agent.id)?.bigBlind, 20);
});

test('BUG-251: return-home uses an actual casino seat even when the stored table id is stale', async () => {
  await say('play 10/20');
  const table = registry.tableOfAgent(agent.id);
  agent.activeTableId = 'stale-table';
  const reply = await say('come home');
  assert.notEqual(reply.body.chat[0].content, 'I am already home.');
  assert.equal(agent.pocket.mode, 'cut');
  assert.ok(table.pending[table.seatOfAgent(agent.id)] || !registry.tableOfAgent(agent.id));
});

test('BUG-251: asking for different stakes while already seated reports the real seat and moves no funds', async () => {
  await say('play 10/20');
  const walletBefore = store.loadWallet(owner).balance;
  const reply = await say('play 25/50');
  assert.match(reply.body.chat[0].content, /already seated at \$10\/\$20/);
  assert.equal(registry.tableOfAgent(agent.id).bigBlind, 20);
  assert.equal(store.loadWallet(owner).balance, walletBefore);
});

test('BUG-251: drink and study use owned inventory and a real ninety-second tape activity', async () => {
  agent.mood = { state: 'frustrated', heat: 65 };
  agent.sessionFlagged = [{ handNumber: 42, flagType: 'badBeat', pot: 900, holeCards: ['Ah', 'Kd'], won: false,
    streets: [], opponents: [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }],
    opponentShowdownCards: [{ seat: 1, holeCards: ['7h', '7s'] }] }];
  const drank = await say('drink a beer');
  assert.equal(drank.body.command.status, 'done', JSON.stringify(drank.body));
  assert.equal(store.loadWallet(owner).fridge.beer, 1);
  const studied = await say('review hand 42');
  assert.equal(studied.body.command.status, 'done', JSON.stringify(studied.body));
  assert.equal(agent.study.handNumber, 42);
  assert.ok(tape.isStudying(agent.id));
  assert.equal(agent.study.endsAt - agent.study.startedAt, 90000);
  assert.match(studied.body.chat[0].content, /studying hand 42/);
  assert.equal(studied.body.command.receipt.study.pending, undefined, 'a read is not earned before watching');
});

test('BUG-251: private funding receipts never reach the shared table chat', async t => {
  await say('play 10/20');
  const table = registry.tableOfAgent(agent.id);
  const publicReply = t.mock.method(table, 'whisperReply', () => 0);
  const reply = await say('give me 500 chips');
  assert.equal(reply.body.command.status, 'done');
  assert.equal(reply.body.whisper, null);
  assert.equal(publicReply.mock.callCount(), 0);
  assert.match(agent.chatHistory.at(-1).content, /\$500/);
});

test('BUG-251: resting with a stale table id waits for the live casino seat', async t => {
  await say('play 10/20');
  const table = registry.tableOfAgent(agent.id);
  agent.activeTableId = null;
  agent.stamina = { left: 40, at: Date.now(), stage: 'settled' };
  const before = { ...agent.stamina };
  const cut = t.mock.method(table, 'sitOutSeat', () => {});
  const reply = await say('rest');
  assert.equal(reply.body.command.status, 'pending');
  assert.equal(cut.mock.callCount(), 1);
  assert.deepEqual(agent.stamina, before);
});

test('BUG-251: come home at an actual kitchen seat neither collects funds nor claims casino movement', async () => {
  const kitchen = { tableId: 'home-command', home: true, closed: false, agentIds: [agent.id], pending: [{}],
    seatOfAgent: () => 0, whisperContext: () => ({ tableId: 'home-command', seat: 0, inHand: true }),
    receiveWhisper() {}, whisperReply() { return 0; } };
  agent.activeTableId = kitchen.tableId;
  profiles.setLiveTableProvider({ ...registry, getTable: () => kitchen, homeTableOf: () => kitchen });
  const reply = await say('come home');
  assert.equal(reply.body.chat[0].content, 'I am already home.');
  assert.equal(agent.pocket.balance, 2000);
  assert.equal(agent.pocket.mode, 'allowance');
});
