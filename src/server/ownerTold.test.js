// src/server/ownerTold.test.js — LIFE-1 job 3
//
// The finding, end to end: "if you chat to them about specific plans and stuff
// like that, they won't properly remember it."
//
// ownerInstructions.test.js pins the book itself. This pins the two things
// that make it a feature rather than a data structure: the owner-chat path
// WRITES to it, and a LATER conversation — after the six-exchange chatHistory
// window has rolled over, which is exactly where a plan used to vanish —
// still carries it into the prompt.
//
// Keyless throughout, in ownerVoice.test.js's style: no model is called and
// none may be.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;

import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import { _closeForTests } from './store.js';
import { buildAgentChatSystem, ownerChatTurn, setLiveTableProvider } from './agentProfiles.js';
import { OWNER_INSTRUCTIONS_MAX } from '../agent/ownerInstructions.js';

const emptyRegistry = { hasTable: () => false, getTable: () => null, homeTableOf: () => null };
after(() => { setLiveTableProvider(null); _closeForTests(); });

function character(extra = {}) {
  return {
    id: 'stone', name: 'Stone', status: 'idle', activeTableId: null,
    strategy: 'Wait for a good hand.', nature: { name: 'Rock' },
    stats: { handsPlayed: 0 }, mood: { state: 'neutral', heat: 30 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    bankroll: 2000, ...extra,
  };
}

test('LIFE-1: a plan said in chat is on his record afterwards', async () => {
  setLiveTableProvider(emptyRegistry);
  const him = character();
  await ownerChatTurn(him, 'told-owner', 'from now on only play the low room');
  assert.equal(him.ownerInstructions.length, 1, 'the plan was written');
  assert.equal(him.ownerInstructions[0].text, 'from now on only play the low room');
  assert.equal(him.ownerInstructions[0].kind, 'plan');
});

test('LIFE-1: small talk writes nothing, which is most of what is said', async () => {
  setLiveTableProvider(emptyRegistry);
  const him = character();
  for (const noise of ['hey', 'thanks', 'how are you?', 'that was brutal', 'lol']) {
    await ownerChatTurn(him, 'told-owner', noise);
  }
  assert.deepEqual(him.ownerInstructions ?? [], [],
    'a book that fills up with "hey" holds nothing worth remembering');
});

test('LIFE-1: a later conversation still has it, after the thread rolled over', async () => {
  setLiveTableProvider(emptyRegistry);
  const him = character();
  await ownerChatTurn(him, 'told-owner', 'from now on only play the low room');

  // chatHistory is capped at twelve entries — six exchanges — so this is well
  // past the point where the plan has fallen out of the visible thread. That
  // window was the ONLY thing carrying a plan forward before this job.
  for (let i = 0; i < 8; i++) await ownerChatTurn(him, 'told-owner', `how did hand ${i} go?`);
  const thread = (him.chatHistory ?? []).map((m) => m.content).join(' ');
  assert.doesNotMatch(thread, /low room/, 'the plan is genuinely out of the thread');

  const prompt = buildAgentChatSystem(him, { recentChat: (him.chatHistory ?? []).slice(-6) });
  assert.match(prompt, /from now on only play the low room/, 'he still has it — the whole job');
  assert.match(prompt, /HIS OWN WORDS/, 'and knows they are yours, not his own conclusions');
  assert.match(prompt, /Newest wins/);
});

test('LIFE-1: the instruction he was just given is in the prompt that answers it', async () => {
  // An agent who has to be told a thing twice before he can refer to it is the
  // same bug with an extra step.
  setLiveTableProvider(emptyRegistry);
  const him = character();
  await ownerChatTurn(him, 'told-owner', 'stop bluffing the river against Granite');
  assert.match(buildAgentChatSystem(him, { recentChat: [] }),
    /stop bluffing the river against Granite/);
});

test('LIFE-1: a correction outranks the thing it corrects', async () => {
  setLiveTableProvider(emptyRegistry);
  const him = character();
  await ownerChatTurn(him, 'told-owner', 'play tighter from the blinds');
  await ownerChatTurn(him, 'told-owner', 'actually play looser from the blinds');
  assert.equal(him.ownerInstructions[0].text, 'actually play looser from the blinds');
  const prompt = buildAgentChatSystem(him, { recentChat: [] });
  assert.ok(prompt.indexOf('actually play looser') < prompt.indexOf('play tighter'),
    'the newer one is nearer the top, which is how newest-wins is expressed');
});

test('LIFE-1: the book stays bounded however much the owner types', async () => {
  setLiveTableProvider(emptyRegistry);
  const him = character();
  for (let i = 0; i < 30; i++) await ownerChatTurn(him, 'told-owner', `play tighter in spot ${i}`);
  assert.ok(him.ownerInstructions.length <= OWNER_INSTRUCTIONS_MAX,
    `grew to ${him.ownerInstructions.length}`);
});

test('LIFE-1: an agent nobody has instructed carries no block at all', () => {
  const prompt = buildAgentChatSystem(character(), { recentChat: [] });
  assert.doesNotMatch(prompt, /WHAT YOUR OWNER HAS TOLD YOU/);
});
