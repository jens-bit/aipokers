// BUG-145: one draft, one chosen name, one birth. Every HTTP request is local;
// synthetic model responses are intercepted before they can leave this process.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.env.RATE_LIMIT_CHAT_MAX = '100000';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { installAgentProfileRoutes, reloadOwners, setBirthListener } from './agentProfiles.js';
import { loadProfile, loadWallet, saveWallet, _closeForTests, adminDb } from './store.js';

const localFetch = globalThis.fetch;
let server, base;
let requestObserver = null;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { requestObserver?.(req); next(); });
  installAgentProfileRoutes(app);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = localFetch; delete process.env.ANTHROPIC_API_KEY; await new Promise(r => server.close(r)); _closeForTests(); });

async function post(route, body) {
  const res = await localFetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { response: text }; }
  return { status: res.status, body: data };
}
async function begin(userId, draftId) {
  const res = await post('/api/agents/draft', { userId, ...(draftId ? { draftId } : {}) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.draftId);
  return res.body;
}
async function say(userId, draftId, content, draftIntent = 'brief', extra = {}) {
  const res = await post('/api/agents/chat', { userId, draftId, content, draftIntent, ...extra });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}
async function prepared(userId, brief = 'Tight and patient', name = 'Granite') {
  const draft = await begin(userId);
  await say(userId, draft.draftId, brief);
  if (name) await say(userId, draft.draftId, name, 'name');
  return draft.draftId;
}
const finish = (userId, draftId, attemptId = randomUUID()) =>
  say(userId, draftId, 'lets go', 'create', { attemptId });

test('BUG-151: a refused visitor arrival preserves the new agent and replays its factual birth outcome once',async()=>{
  const userId='draft-refused-visitor',draftId=await prepared(userId);let calls=0;
  const visitOutcome={ok:false,status:409,reason:'inHand',error:'He is in a hand. Try again after it finishes.',agentName:'Away Day',retryable:true};
  setBirthListener(()=>{calls++;return visitOutcome;});
  try{
    const built=await finish(userId,draftId,'visitor-attempt');
    assert.ok(built.createdAgent.id);assert.deepEqual(built.visitOutcome,visitOutcome);assert.equal(calls,1);
    const total=chips(userId);reloadOwners(userId);
    const replay=await begin(userId,draftId);
    assert.equal(replay.agentId,built.agentId);assert.deepEqual(replay.visitOutcome,visitOutcome);assert.equal(chips(userId),total);assert.equal(calls,1);
  }finally{setBirthListener(null);}
});
function chips(userId) {
  return (loadWallet(userId)?.balance ?? 0) + (loadProfile(userId)?.agents ?? []).reduce((n, agent) => n + (agent.pocket?.balance ?? 0), 0);
}
function unlockNext(userId) {
  const wallet = loadWallet(userId);
  saveWallet(userId, { ...wallet, earned: 1_000_000 });
  reloadOwners(userId);
}

function holdModel() {
  let entered, release, calls = 0;
  const requests = [];
  const seen = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (input, options) => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com');
    requests.push(JSON.parse(options.body));
    calls++; entered();
    await gate;
    return new Response(JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: JSON.stringify({ name: 'Model Name', style: 'Tight', risk: 'Low', strategy: 'Wait for premium holdings.', tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 }) }], usage: { input_tokens: 0, output_tokens: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
  return { seen, release, requests, calls: () => calls, restore() { release(); globalThis.fetch = localFetch; delete process.env.ANTHROPIC_API_KEY; } };
}

test('BUG-145: the name question has its own stage; a name never changes the play brief', async () => {
  const userId = 'draft-stages';
  const first = await begin(userId);
  assert.equal(first.draftStep, 'briefing');
  assert.equal(first.ready, false);
  assert.ok(first.chat.length <= 1, 'one opening, no previous draft');
  const style = await say(userId, first.draftId, 'Tight and patient');
  assert.equal(style.ready, true, 'legacy quick draft still has enough style to build');
  assert.equal(style.draftStep, 'naming');
  assert.equal(style.draftName, null);
  assert.match(style.chat.at(-1).content, /name|call/i);
  const named = await say(userId, first.draftId, 'Wild Card', 'name');
  assert.equal(named.draftStep, 'ready');
  assert.equal(named.draftName, 'Wild Card');
  assert.deepEqual(named.profile, style.profile);
  const built = await finish(userId, first.draftId);
  assert.equal(built.draftStep, 'created');
  assert.equal(built.agentName, 'Wild Card');
  assert.deepEqual(built.createdAgent.profile, style.profile);
  assert.equal(built.firstAgent, true);
  assert.ok(built.createdAgent.identity);
});

test('BUG-145: explicit name Go stays a name; choosing for me still permits a quick draft', async () => {
  const chosen = await prepared('draft-name-go', 'Tight and patient', 'Go');
  assert.equal(loadProfile('draft-name-go').agents.length, 0);
  assert.equal((await finish('draft-name-go', chosen)).agentName, 'Go');
  const quick = await prepared('draft-quick', 'Aggressive bluffer', null);
  const built = await finish('draft-quick', quick);
  assert.ok(built.agentId);
  assert.ok(built.createdAgent.profile.aggression >= 80);
});

test('BUG-145: arbitrary conversation and confirmation cannot silently create a default character', async () => {
  const userId = 'draft-no-brief';
  const first = await begin(userId);
  const unknown = await say(userId, first.draftId, 'hello, banana, lol');
  assert.equal(unknown.draftStep, 'briefing');
  const confirm = await finish(userId, first.draftId);
  assert.equal(confirm.draftStep, 'briefing');
  assert.equal(confirm.ready, false);
  assert.equal(confirm.agentId, undefined);
  assert.equal(loadProfile(userId).agents.length, 0);
  assert.equal(chips(userId), 0);
});

test('BUG-145: back/reload resumes the current draft; a second birth has no earlier name or style', async () => {
  const userId = 'draft-isolation';
  const one = await prepared(userId, 'Tight and patient', 'Granite');
  _closeForTests();
  reloadOwners(userId);
  const resumed = await begin(userId, one);
  assert.equal(resumed.draftStep, 'ready');
  assert.equal(resumed.draftName, 'Granite');
  assert.deepEqual((await begin(userId)).chat, resumed.chat);
  const first = await finish(userId, one);
  unlockNext(userId);
  const two = await begin(userId);
  assert.notEqual(two.draftId, one);
  assert.equal(two.draftStep, 'briefing');
  assert.equal(two.draftName, null);
  assert.doesNotMatch(JSON.stringify(two.chat), /Granite|Tight and patient/);
  const style = await say(userId, two.draftId, 'Chaotic and unpredictable');
  assert.equal(style.draftStep, 'naming');
  await say(userId, two.draftId, 'Sparks', 'name');
  const second = await finish(userId, two.draftId);
  assert.equal(second.agentName, 'Sparks');
  assert.notDeepEqual(second.createdAgent.profile, first.createdAgent.profile);
  assert.equal(second.firstAgent, false);
  assert.equal(chips(userId), 10_000, 'the second agent is funded from existing chips');
});

test('BUG-145: a completed creation retry survives SQLite reload and does not fund another agent', async () => {
  const userId = 'draft-retry';
  const draftId = await prepared(userId);
  const attemptId = randomUUID();
  const first = await finish(userId, draftId, attemptId);
  const total = chips(userId);
  _closeForTests();
  reloadOwners(userId);
  const retry = await finish(userId, draftId, attemptId);
  assert.equal(retry.agentId, first.agentId);
  assert.equal((await begin(userId, draftId)).agentId, first.agentId);
  assert.equal(loadProfile(userId).agents.length, 1);
  assert.equal(chips(userId), total);
  assert.equal(loadWallet(userId).ledger.filter(entry => entry.type === 'seed').length, 1);
});

test('BUG-145: concurrent chat/build attempts share one generation and commit one grant', async () => {
  const userId = 'draft-concurrent';
  const draftId = await prepared(userId);
  let entered;
  const modelEntered = new Promise(resolve => { entered = resolve; });
  let release;
  const modelGate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  globalThis.fetch = async (input) => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com');
    calls++; entered();
    await modelGate;
    return new Response(JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: JSON.stringify({ name: 'Model Name', style: 'Tight', risk: 'Low', strategy: 'Wait for premium holdings.', tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 }) }], usage: { input_tokens: 0, output_tokens: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
  try {
    const first = post('/api/agents/chat', { userId, draftId, content: 'lets go', draftIntent: 'create', attemptId: 'attempt-one' });
    await modelEntered;
    let arrived;
    const secondArrived = new Promise(resolve => { arrived = resolve; });
    requestObserver = req => { if (req.body?.attemptId === 'attempt-two') arrived(); };
    const second = post('/api/agents/build', { userId, draftId, attemptId: 'attempt-two' });
    await secondArrived;
    release();
    const results = await Promise.all([first, second]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(results[0].body.agentId, results[1].body.agentId);
    assert.equal(calls, 1);
    assert.equal(loadProfile(userId).agents.length, 1);
    assert.equal(chips(userId), 10_000);
  } finally { release(); requestObserver = null; globalThis.fetch = localFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test('BUG-145: explicit missing edit/chat targets cannot fall through into creation', async () => {
  for (const route of ['/api/agents/build', '/api/agents/chat']) {
    const userId = `missing-${route.split('/').at(-1)}`;
    const response = await post(route, { userId, existingAgentId: 'does-not-exist', content: 'lets go' });
    assert.equal(response.status, 404);
    assert.equal(loadProfile(userId)?.agents.length ?? 0, 0);
    assert.equal(chips(userId), 0);
  }
});

test('BUG-145: unknown draft tokens fail without erasing the current draft or creating agents', async () => {
  const userId = 'draft-expired';
  const current = await prepared(userId);
  const invalid = randomUUID();
  const old = await post('/api/agents/chat', { userId, draftId: invalid, content: 'lets go', draftIntent: 'create', attemptId: randomUUID() });
  assert.equal(old.status, 409);
  assert.equal(old.body.error, 'draftExpired');
  assert.equal((await begin(userId)).draftId, current);
  assert.equal(loadProfile(userId).agents.length, 0);
});

test('BUG-145: a chosen name is not offered to the model as a poker instruction', async () => {
  const userId = 'draft-model-name';
  const draftId = await prepared(userId, 'Tight and patient', 'Wild Card');
  const held = holdModel();
  try {
    const pending = finish(userId, draftId);
    await held.seen;
    held.release();
    const built = await pending;
    assert.equal(built.agentName, 'Wild Card');
    const prompt = JSON.stringify(held.requests[0].messages);
    assert.match(prompt, /Tight and patient/);
    assert.doesNotMatch(prompt, /Wild Card|Ready when you are|lets go/);
  } finally { held.restore(); }
});

test('BUG-145: creation request ids are bounded strings, not arbitrary saved objects', async () => {
  const userId = 'draft-attempt-validation';
  const draftId = await prepared(userId);
  for (const attemptId of [{ huge: 'x'.repeat(10_000) }, 'x'.repeat(129)]) {
    const response = await post('/api/agents/chat', { userId, draftId, draftIntent: 'create', content: 'lets go', attemptId });
    assert.equal(response.status, 400);
  }
  assert.equal(loadProfile(userId).agents.length, 0);
});

test('BUG-145: a slow build cannot resurrect a draft explicitly reset while it was finishing', async () => {
  const userId = 'draft-reset-race';
  const draftId = await prepared(userId);
  const held = holdModel();
  try {
    const pending = post('/api/agents/chat', { userId, draftId, content: 'lets go', draftIntent: 'create', attemptId: 'slow-reset' });
    await held.seen;
    const fresh = await post('/api/agents/chat/reset', { userId });
    assert.equal(fresh.status, 200);
    held.release();
    const late = await pending;
    assert.equal(late.status, 409);
    assert.equal(late.body.error, 'draftExpired');
    assert.equal(loadProfile(userId).agents.length, 0);
    assert.equal(chips(userId), 0);
    assert.equal((await begin(userId)).draftId, fresh.body.draftId);
  } finally { held.restore(); }
});

test('BUG-145: a failed atomic save emits no birth and retries the same draft without duplicating chips', async () => {
  const userId = 'draft-save-failure';
  const draftId = await prepared(userId);
  const births = [];
  setBirthListener((owner, agent) => births.push({ owner, id: agent.id }));
  adminDb().exec("CREATE TRIGGER draft_fail_save BEFORE INSERT ON agents WHEN NEW.owner_id = 'draft-save-failure' BEGIN SELECT RAISE(ABORT, 'Synthetic save failure'); END;");
  try {
    const failed = await post('/api/agents/chat', { userId, draftId, content: 'lets go', draftIntent: 'create', attemptId: 'save-attempt' });
    assert.equal(failed.status, 503);
    assert.equal(loadProfile(userId).agents.length, 0);
    assert.equal(loadProfile(userId).draft.receipts.length, 0);
    assert.equal(chips(userId), 0);
    assert.deepEqual(births, [], 'arrival/listeners happen only after the household commit');
  } finally { adminDb().exec('DROP TRIGGER draft_fail_save'); setBirthListener(null); }
  const retry = await finish(userId, draftId, 'save-attempt');
  assert.ok(retry.agentId);
  assert.equal(loadProfile(userId).agents.length, 1);
  assert.equal(chips(userId), 10_000);
});

test('BUG-145: receipts are bounded and an expired old token never becomes a new creation', async () => {
  const userId = 'draft-receipt-bound';
  let oldest;
  for (let i = 0; i < 10; i++) {
    const draftId = await prepared(userId);
    if (i === 0) oldest = draftId;
    const agent = await finish(userId, draftId);
    const retired = await post(`/api/agents/${agent.agentId}/retire`, { userId });
    assert.equal(retired.status, 200);
  }
  const profile = loadProfile(userId);
  assert.equal(profile.draft.receipts.length, 8);
  const before = chips(userId);
  const old = await post('/api/agents/chat', { userId, draftId: oldest, content: 'lets go', draftIntent: 'create', attemptId: 'old-retry' });
  assert.equal(old.status, 409);
  assert.equal(old.body.error, 'draftExpired');
  assert.equal(loadProfile(userId).agents.length, 10);
  assert.equal(chips(userId), before);
});

test('BUG-145: a missing strategy in a syntactically valid model response preserves the draft', async () => {
  const userId = 'draft-invalid-strategy';
  const draftId = await prepared(userId);
  globalThis.fetch = async input => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com');
    return new Response(JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: JSON.stringify({ name: 'Wrong', strategy: {} }) }], usage: { input_tokens: 0, output_tokens: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
  try {
    const response = await post('/api/agents/chat', { userId, draftId, draftIntent: 'create', content: 'lets go', attemptId: 'bad-strategy' });
    assert.equal(response.status, 503);
    assert.equal(loadProfile(userId).agents.length, 0);
    assert.equal(chips(userId), 0);
    assert.equal((await begin(userId, draftId)).draftStep, 'ready');
  } finally { globalThis.fetch = localFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test('BUG-145: an edit whose target disappears during generation cannot turn into another birth', async () => {
  const userId = 'draft-edit-race';
  const draftId = await prepared(userId);
  const first = await finish(userId, draftId);
  const held = holdModel();
  try {
    const pending = post('/api/agents/build', { userId, existingAgentId: first.agentId });
    await held.seen;
    const removed = await localFetch(`${base}/api/agents/${first.agentId}?userId=${userId}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    const remaining = chips(userId);
    held.release();
    const late = await pending;
    assert.equal(late.status, 404);
    assert.equal(loadProfile(userId).agents.length, 0);
    assert.equal(chips(userId), remaining);
  } finally { held.restore(); }
});
