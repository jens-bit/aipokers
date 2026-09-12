// BUG-142: the same owner message reaches eight characters, not eight copies
// of the recruiter. Keyless route checks exercise the actual saved conversation.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { NATURES } from '../agent/attributes.js';
import { deriveRoles } from '../agent/bio.js';
import { saveProfile, loadProfile, _closeForTests } from './store.js';
import { buildAgentChatSystem, installAgentProfileRoutes, setLiveTableProvider, reloadOwners, restAgent, ownerChatTurn, agentsOf } from './agentProfiles.js';

function character(nature = 'Rock', extra = {}) {
  return {
    id: 'stone', name: 'Stone', status: 'idle', activeTableId: null,
    strategy: 'Wait for a good hand.', nature: { name: nature },
    stats: { handsPlayed: 0 }, mood: { state: 'neutral', heat: 30 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    bankroll: 2000, ...extra,
  };
}

const emptyRegistry = { hasTable: () => false, getTable: () => null, homeTableOf: () => null };
after(() => { setLiveTableProvider(null); _closeForTests(); });

test('FIRST-CHAT-1: chat offers existing movement controls without calling a model or moving money or seats', async t => {
  process.env.ANTHROPIC_API_KEY = 'test-must-not-call';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('Movement guidance must not call a model'); });
  setLiveTableProvider(emptyRegistry);
  const home = character();
  const balance = home.pocket.balance;
  assert.match((await ownerChatTurn(home, 'chat-guidance', 'go home')).chat[0].content, /already.*home/i);
  assert.match((await ownerChatTurn(home, 'chat-guidance', 'Please go to the casino.')).chat[0].content, /Deploy/);
  assert.equal(home.pocket.balance, balance);
  assert.equal(home.activeTableId, null);
  const heard = [];
  const table = { tableId: 'casino', closed: false, seatOfAgent: () => 0,
    whisperContext: () => ({ tableId: 'casino', inHand: true, blinds: '1/2', opponents: [] }),
    receiveWhisper: () => {}, whisperReply: (_, text) => { heard.push(text); return 0; } };
  setLiveTableProvider({ ...emptyRegistry, hasTable: () => true, getTable: () => table });
  const away = character('Rock', { activeTableId: 'casino' });
  const reply = await ownerChatTurn(away, 'chat-guidance', 'come home');
  assert.match(reply.chat[0].content, /profile.*Call him in.*finish.*hand/i);
  assert.equal(away.activeTableId, 'casino');
  assert.equal(away.pocket.balance, balance);
  assert.deepEqual(heard, [reply.chat[0].content]);
  setLiveTableProvider(emptyRegistry);
  const visit = await ownerChatTurn(character('Rock', { visiting: { hostOwnerId: 'friend' } }), 'chat-guidance', 'go home');
  assert.equal(visit.chat[0].content, 'I am visiting another home. Chat does not move me or end the visit.');
  assert.equal(network.mock.callCount(), 0);
});

test('FIRST-CHAT-1: generated owner speech is normalized once and saved exactly as delivered', async t => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  setLiveTableProvider(emptyRegistry);
  let generated = '*leans against the wall*';
  const network = t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(JSON.stringify({
    id: 'test', type: 'message', role: 'assistant', model: 'test', stop_reason: 'end_turn',
    content: [{ type: 'text', text: generated }], usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  saveProfile('chat-normalize', { userId: 'chat-normalize', agents: [character()] });
  reloadOwners('chat-normalize');
  const agent = agentsOf('chat-normalize')[0];
  const unavailable = await ownerChatTurn(agent, 'chat-normalize', 'Tell me something.');
  assert.equal(unavailable.replyUnavailable, true);
  assert.match(unavailable.chat[0].content, /cannot answer.*right now/i);
  generated = '*nods* I heard you.';
  const spoken = await ownerChatTurn(agent, 'chat-normalize', 'Tell me about going home tomorrow.');
  assert.equal(spoken.chat[0].content, 'I heard you.');
  assert.equal(agent.chatHistory.at(-1).content, 'I heard you.');
  assert.equal(loadProfile('chat-normalize').agents[0].chatHistory.at(-1).content, 'I heard you.');
  assert.equal(network.mock.callCount(), 2, 'one call per ordinary message; no repair calls or broad movement interception');
  assert.match(buildAgentChatSystem(agent), /never claim.*chat.*(?:moved|move)/i);
});

test('BUG-142: couch rest acknowledgements have each nature’s cadence without inventing a bar', () => {
  setLiveTableProvider(emptyRegistry);
  const lines = NATURES.map(nature => {
    const agent = character(nature.name);
    assert.equal(restAgent(agent, 'rest-voice').pending, false);
    assert.doesNotMatch(agent.lastMoment.text, /\bbar\b|casino|one more hand/i);
    return agent.lastMoment.text;
  });
  assert.equal(new Set(lines).size, NATURES.length, 'eight authored natures do not share one stock line');
  const visitor = character('Professor', { visiting: { hostOwnerId: 'friend' } });
  restAgent(visitor, 'rest-voice');
  assert.doesNotMatch(visitor.lastMoment.text, /\bbar\b|casino|at home/i);
  const unknown = character(null, { nature: null });
  restAgent(unknown, 'rest-voice');
  assert.match(unknown.lastMoment.text, /rest|break|sit/i);
  setLiveTableProvider(null);
});

test('BUG-142: resting a seated agent still explains that the current hand finishes first', () => {
  const cuts = [];
  const table = { agentIds: ['stone'], pending: [{}], sitOutSeat: (...args) => cuts.push(args) };
  setLiveTableProvider({ ...emptyRegistry, hasTable: () => true, getTable: () => table });
  const agent = character('Rock', { activeTableId: 'casino-table' });
  assert.equal(restAgent(agent, 'rest-voice').pending, true);
  assert.deepEqual(cuts, [[0, { afterHand: true }]]);
  assert.match(agent.lastMoment.text, /hand.*out|finish.*hand/i);
  setLiveTableProvider(null);
});

test('BUG-142: owner chat carries every authored birth nature and voice without rerolling it', () => {
  for (const nature of NATURES) {
    const agent = character(nature.name);
    const prompt = buildAgentChatSystem(agent);
    assert.ok(prompt.includes(nature.sig), `${nature.name} signature must reach the model`);
    assert.ok(prompt.includes(nature.builtFor));
    assert.ok(prompt.includes(nature.struggle));
    assert.equal(agent.nature.name, nature.name);
    assert.match(prompt, /Railbird/);
    assert.doesNotMatch(prompt, /Agentic Poker|already built and playing/);
  }
});

test('BUG-142: a home conversation has its real routine, not a stale casino flag or a bar', () => {
  setLiveTableProvider(emptyRegistry);
  const prompt = buildAgentChatSystem(character('Rock', {
    activeTableId: 'closed-table', status: 'playing',
    mood: { state: 'neutral', heat: 30, cause: 'rested at the bar' },
  }));
  assert.match(prompt, /CURRENT PLACE: at home, reading/);
  assert.doesNotMatch(prompt, /at the bar|already built and playing/);
  assert.match(prompt, /Do not invent places, opponents or current table conditions/);
  assert.match(prompt, /Do not default to .yo./i);
  setLiveTableProvider(null);
});

test('BUG-142: established opponent memories precede the owner ledger and mood', () => {
  const bioLedger = { granite: {
    playerId: 'granite', displayName: 'Granite', hands: 50, net: -4000,
    coolersTaken: 2, coolersDealt: 0, biggestPotWon: 0, biggestPotLost: 2000,
    bluffsCaught: 0, showdowns: 10, lastSeenHand: 50,
  } };
  const opinion = deriveRoles(bioLedger).nemesis.opinion;
  const prompt = buildAgentChatSystem(character('Shark', { bioLedger }));
  assert.ok(prompt.includes(opinion));
  assert.ok(prompt.indexOf(opinion) < prompt.indexOf('STATE:'), 'bio before mood');
  assert.match(prompt, /These are memories, not evidence that those opponents are here now/);
});

test('BUG-142: a home table is distinguished from a casino whisper', () => {
  const table = { tableId: 'kitchen', inHand: true, blinds: '1/2', handNumber: 4,
    street: 'flop', board: ['Ah', '7d', '2c'], holeCards: ['As', 'Ks'],
    pot: 30, stack: 970, opponents: ['Grinder'], yourTurn: false };
  setLiveTableProvider({ ...emptyRegistry, homeTableOf: () => ({ tableId: 'kitchen' }) });
  const home = buildAgentChatSystem(character(), { table });
  assert.match(home, /CURRENT PLACE: at the kitchen table at home/);
  assert.match(home, /Board: Ah 7d 2c/);
  setLiveTableProvider(emptyRegistry);
  const casino = buildAgentChatSystem(character(), { table: { ...table, tableId: 'casino' } });
  assert.match(casino, /CURRENT PLACE: at a casino table/);
  assert.doesNotMatch(casino, /CURRENT PLACE: at home/);
  setLiveTableProvider(null);
});

test('BUG-142: an agent visiting another home is not told he is at a casino', () => {
  setLiveTableProvider(emptyRegistry);
  const prompt = buildAgentChatSystem(character('Professor', { visiting: { hostOwnerId: 'friend' } }));
  assert.match(prompt, /CURRENT PLACE: visiting another home/);
  assert.doesNotMatch(prompt, /CURRENT PLACE: at a casino/);
  setLiveTableProvider(null);
});

test('BUG-142: missing nature stays unknown and recent replies remain in the prompt', () => {
  const prompt = buildAgentChatSystem(character(null, { nature: null }), {
    recentChat: [{ role: 'assistant', content: 'I was reading that hand.' }],
  });
  assert.doesNotMatch(prompt, /Nature: Rock|Nature: Grinder/);
  assert.match(prompt, /You: I was reading that hand\./);
});

test('BUG-142: keyless owner chat saves honest replies and reaches the home-game seat', async () => {
  saveProfile('voice-owner', { userId: 'voice-owner', chat: [], agents: [character()] });
  reloadOwners('voice-owner');
  setLiveTableProvider(emptyRegistry);
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const send = async (content) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agents/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'voice-owner', existingAgentId: 'stone', content }),
      });
      assert.equal(response.status, 200);
      return response.json();
    };
    const location = await send('where are you?');
    assert.match(location.chat[0].content, /at home, reading/i);
    const unavailable = await send('what is your favourite song?');
    assert.equal(unavailable.replyUnavailable, true);
    assert.match(unavailable.chat[0].content, /cannot answer.*right now/i);
    assert.doesNotMatch(unavailable.chat[0].content, /review hands|adjust strategy|tables are soft|\byo\b/i);
    assert.equal(loadProfile('voice-owner').agents[0].chatHistory.at(-1).content, unavailable.chat[0].content);
    const heard = [];
    const kitchen = {
      tableId: 'kitchen', closed: false, seatOfAgent: () => 1,
      whisperContext: () => ({ tableId: 'kitchen', seat: 1, street: 'flop', inHand: true,
        blinds: '1/2', handNumber: 2, board: ['Ah', '7d', '2c'], holeCards: ['As', 'Ks'],
        pot: 30, stack: 970, opponents: ['Grinder'] }),
      receiveWhisper: (id, text) => heard.push({ id, text, from: 'owner' }),
      whisperReply: (id, text) => { heard.push({ id, text, from: 'agent' }); return 1; },
    };
    setLiveTableProvider({ ...emptyRegistry, homeTableOf: () => kitchen });
    const homeReply = await send('where are you?');
    assert.match(homeReply.chat[0].content, /kitchen table at home/);
    assert.deepEqual(homeReply.whisper, { tableId: 'kitchen', seat: 1, street: 'flop', inHand: true });
    assert.deepEqual(heard.map(line => line.from), ['owner', 'agent']);
  } finally {
    await new Promise(resolve => server.close(resolve));
    setLiveTableProvider(null);
  }
});

test('BUG-142: a failed model request uses the same honest saved reply as an absent model', async () => {
  // The SDK uses this fetch; nothing can leave the process. The local route
  // request below deliberately keeps the original fetch instead.
  const localFetch = globalThis.fetch;
  const captured = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com');
    captured.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Test model unavailable' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  };
  process.env.ANTHROPIC_API_KEY = 'test-model-never-sent';
  saveProfile('failed-voice', { userId: 'failed-voice', chat: [], agents: [character('Showman')] });
  reloadOwners('failed-voice');
  setLiveTableProvider(emptyRegistry);
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const response = await localFetch(`http://127.0.0.1:${server.address().port}/api/agents/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'failed-voice', existingAgentId: 'stone', content: 'tell me something' }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(captured.length, 1);
    assert.match(captured[0].system[0].text, /Nature: Showman/);
    assert.match(captured[0].system[0].text, /CURRENT PLACE: at home, pacing/);
    assert.equal(body.replyUnavailable, true);
    assert.match(body.chat[0].content, /cannot answer.*right now/i);
    assert.equal(loadProfile('failed-voice').agents[0].chatHistory.at(-1).content, body.chat[0].content);
  } finally {
    globalThis.fetch = localFetch;
    delete process.env.ANTHROPIC_API_KEY;
    await new Promise(resolve => server.close(resolve));
    setLiveTableProvider(null);
  }
});
