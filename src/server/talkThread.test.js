// src/server/talkThread.test.js — LIFE-3 jobs 2 and 4
//
// The transcript, driven through the real chat path.
//
// talk.test.js proves the resolver and the gate against object literals. What
// is only testable HERE is that the PRODUCT does it: `ownerChatTurn` is the
// function an owner's message actually reaches, and the thread has to survive
// every hop of it — the prompt build, the model call, the grade, the repair,
// the chatHistory write and the save. Any one of those is a place the hand
// under discussion could be dropped without a unit test noticing.
//
// The model is mocked to return the exact sentences Jens was given on the
// night of 15 September. No key, no live call: the fetch is intercepted, and
// the assertion is on what the owner ends up reading.

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { saveProfile, _closeForTests } from './store.js';
import {
  installAgentProfileRoutes, setLiveTableProvider, reloadOwners, ownerChatTurn, agentsOf,
} from './agentProfiles.js';
import { focusOf } from '../agent/talk.js';

void installAgentProfileRoutes;
const emptyRegistry = { hasTable: () => false, getTable: () => null, homeTableOf: () => null };
after(() => { setLiveTableProvider(null); _closeForTests(); });

// The two sentences from the transcript, word for word.
const WHICH_HAND = "Don't remember that one, man — which hand you talking about?";
const DEAD_END = "Man, I don't know what you're asking about — what happened?";

// The hand Jens asked about: a queen-six he got his stack in with and busted
// on, and the reason he had for it.
function burn() {
  return {
    id: 'burn', name: 'Burn', status: 'idle', activeTableId: null,
    strategy: 'Push when it is on him.', nature: { name: 'Hothead' },
    stats: { handsPlayed: 812, winRate: 18.4, netWon: -2400 },
    mood: { state: 'tilted', heat: 78 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    bankroll: 2000,
    sessionLog: [{ endedAt: Date.now() - 3600_000, net: -1450, hands: 96 }],
    recentHands: [
      { handNumber: 812, won: false, potSize: 1450, holeCards: ['Qh', '6d'],
        board: ['Qs', '7d', '2s', 'Kc', '3h'], net: -820, timestamp: Date.now(),
        decisions: [{ street: 'turn', action: { type: 'call', amount: 400 }, allIn: true }],
        why: { street: 'turn', action: { type: 'call', amount: 400 }, allIn: true,
          reasoning: 'he has been firing every street, I put him on a bluff',
          heat: 78, stamina: 'worn', moodState: 'tilted' } },
      { handNumber: 811, won: true, potSize: 620, holeCards: ['Js', 'Td'],
        board: ['9c', '4d', '4s'], net: 260, timestamp: Date.now(),
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }],
        why: { street: 'preflop', action: { type: 'raise', amount: 60 }, allIn: false,
          reasoning: 'cheap enough to see a flop with', heat: 30,
          stamina: 'fresh', moodState: 'neutral' } },
    ],
  };
}

/** A fetch that answers every decision call with whatever `say` currently is. */
function mockModel(t, say) {
  const box = { text: say };
  t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(JSON.stringify({
    id: 'test', type: 'message', role: 'assistant', model: 'test', stop_reason: 'end_turn',
    content: [{ type: 'text', text: box.text }], usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  return box;
}

function seat(userId) {
  saveProfile(userId, { userId, agents: [burn()] });
  reloadOwners(userId);
  setLiveTableProvider(emptyRegistry);
  return agentsOf(userId)[0];
}

test('LIFE-3: the dead end never reaches the owner — the hand does', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  mockModel(t, WHICH_HAND);
  const agent = seat('thread-dead-end');

  const turn = await ownerChatTurn(agent, 'thread-dead-end', 'why did you go all in on that hand?');
  const said = turn.chat[0].content;
  assert.ok(turn.talkFaults.includes('confusion'), JSON.stringify(turn.talkFaults));
  assert.notEqual(said, WHICH_HAND, 'the line the model wrote does not ship');
  assert.match(said, /Hand 812, the queen-six/);
  assert.match(said, /I put him on a bluff/, 'the reason he actually had');
  assert.match(said, /I was steaming/, 'and the state he was actually in');
  assert.match(said, /that one is on me/);
  // …and it is what the owner will read back tomorrow, not only what the route
  // returned once.
  assert.equal(agent.chatHistory.at(-1).content, said);
});

test('LIFE-3: "why???" is a follow-up to his own last answer, across the real path', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  const model = mockModel(t, 'Hand 811, the jack-ten. Cheap enough to see a flop with, and it came in.');
  const agent = seat('thread-holds');

  await ownerChatTurn(agent, 'thread-holds', 'tell me about hand 811');
  assert.equal(focusOf(agent), 811, 'the thread is on 811 after the first answer');

  // Now he deflects on the follow-up, exactly as he did on the night.
  model.text = DEAD_END;
  const two = await ownerChatTurn(agent, 'thread-holds', 'why???');
  assert.match(two.chat[0].content, /Hand 811/, 'the follow-up follows 811, not the notable hand');
  assert.doesNotMatch(two.chat[0].content, /Hand 812/);

  const three = await ownerChatTurn(agent, 'thread-holds', 'why that');
  assert.match(three.chat[0].content, /Hand 811/, 'and it holds for the second follow-up');
  assert.equal(focusOf(agent), 811);
});

test('LIFE-3: it may not be said twice in one conversation, whatever else is wrong', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  mockModel(t, DEAD_END);
  const agent = seat('thread-repeat');

  const one = await ownerChatTurn(agent, 'thread-repeat', 'why did you go all in on that hand?');
  assert.ok(!one.talkFaults.includes('repeatConfusion'), 'the first one is not a repeat');
  const two = await ownerChatTurn(agent, 'thread-repeat', 'why???');
  // The repaired first reply is what went into the history, so the repeat rule
  // has nothing to count — which is the point: the owner never sees it twice
  // because he never sees it once.
  assert.doesNotMatch(two.chat[0].content, /don't know what you're asking/i);
  assert.equal(agent.chatHistory.filter((m) => /don't know what you're asking/i.test(m.content)).length, 0);
});

test('LIFE-3: changing the subject lets the hand go, across the real path', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  const model = mockModel(t, 'Hand 811, the jack-ten. It came in.');
  const agent = seat('thread-subject');

  await ownerChatTurn(agent, 'thread-subject', 'tell me about hand 811');
  assert.equal(focusOf(agent), 811);
  model.text = 'Not hungry. I ate before I sat down.';
  await ownerChatTurn(agent, 'thread-subject', 'are you hungry?');
  assert.equal(focusOf(agent), null, 'a message about nothing to do with a hand drops it');
});

// ── LIFE-3-D: the owner asking about a hand, recorded as asking about a hand ─

test('LIFE-3-D: an owner who asks about a hand is remembered as having asked', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-intercepted';
  t.after(() => { delete process.env.ANTHROPIC_API_KEY; setLiveTableProvider(null); });
  mockModel(t, 'The queen-six. I had him on a bluff and he had the king.');
  const agent = seat('thread-about-hand');

  // MOOD-2b routes this as `care`, and RELATE-1a writes the owner line from
  // `aboutHand`. The test the corruption made impossible: the regex deciding
  // that flag had its word boundaries replaced by literal backspace characters,
  // so `aboutHand` was false for every message ever sent and the ledger always
  // took the other branch.
  // He has just been talked down, so the pep-talk cooldown is on and the same
  // message lands as plain `care` rather than as a second soothe. That is the
  // branch `aboutHand` decides.
  agent.mood.pepTalkAtHand = agent.stats.handsPlayed;
  await ownerChatTurn(agent, 'thread-about-hand', 'what happened in that hand? are you alright?');
  const written = (agent.ownerMemory ?? []).map((m) => m.text).join(' | ');
  assert.match(written, /asked about/, written);
  assert.doesNotMatch(written, /says something decent when it goes well/, written);
});
