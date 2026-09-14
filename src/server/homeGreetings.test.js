// HOME-2: recognizable hellos keep the existing nature voice when chat is unavailable.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { idleCycle, ROUTINE_LABELS } from './home.js';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED = '0';

const { NATURES } = await import('../agent/attributes.js');
const { natureOpener } = await import('../agent/moment.js');
const { saveProfile, loadProfile, _closeForTests } = await import('./store.js');
const { agentsOf, ownerChatTurn, reloadOwners, setLiveTableProvider } = await import('./agentProfiles.js');
const emptyRegistry = { hasTable: () => false, getTable: () => null, homeTableOf: () => null };
after(() => { setLiveTableProvider(null); _closeForTests(); });
let sequence = 0;

function fixture(t, nature, extra = {}) {
  const owner = `home2-greeting-${++sequence}`;
  const agent = {
    id: `${owner}-agent`, name: nature?.name ?? nature ?? 'Unknown',
    nature, status: 'idle', activeTableId: null,
    strategy: 'Wait for a good hand.', stats: { handsPlayed: 0 },
    mood: { state: 'neutral', heat: 30 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    bankroll: 2000, ...extra,
  };
  saveProfile(owner, { userId: owner, chat: [], agents: [agent] });
  reloadOwners(owner);
  setLiveTableProvider(emptyRegistry);
  t.after(() => setLiveTableProvider(null));
  const owned = agentsOf(owner)[0];
  return { agent: owned, owner, say: text => ownerChatTurn(owned, owner, text) };
}

test('HOME-2: eight natures answer a plain hello in eight existing voices and save the reply', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('Greeting must not use a model'); });
  const lines = [];
  for (const nature of NATURES) {
    const { owner, say } = fixture(t, nature);
    const body = await say('Hello!');
    assert.equal(body.replyUnavailable, undefined);
    assert.equal(body.chat[0].content, natureOpener(nature));
    assert.doesNotMatch(body.chat[0].content, /^yo\b/i);
    assert.equal(loadProfile(owner).agents[0].chatHistory.at(-1).content, body.chat[0].content);
    lines.push(body.chat[0].content);
  }
  assert.equal(new Set(lines).size, 8);
  assert.equal(network.mock.callCount(), 0);
});

test('HOME-2: greeting recognition is anchored, case-insensitive and limited to ordinary hellos', async t => {
  const { say } = fixture(t, 'Rock');
  for (const greeting of ['hi', '  HEY!!  ', 'hello there.', 'Hi there', 'hey there', 'hiya', 'yo', 'Good morning!', 'good afternoon', 'good evening']) {
    const body = await say(greeting);
    assert.equal(body.chat[0].content, natureOpener('Rock'), greeting);
    assert.equal(body.replyUnavailable, undefined, greeting);
  }
});

for (const home of [true, false]) test(`HOME-2: an actual ${home ? 'kitchen' : 'casino'} seat receives its seated nature greeting`, async t => {
  for (const nature of NATURES) {
    const { agent, say } = fixture(t, nature, home ? {} : { activeTableId: 'casino-greeting' });
    const heard = [];
    const table = {
      tableId: home ? 'kitchen-greeting' : 'casino-greeting', closed: false,
      seatOfAgent: id => id === agent.id ? 1 : null,
      whisperContext: () => ({ tableId: home ? 'kitchen-greeting' : 'casino-greeting', seat: 1,
        inHand: true, street: 'flop', blinds: '10/20', handNumber: 2,
        board: ['Ah', '7d', '2c'], holeCards: ['As', 'Ks'], pot: 30, stack: 970, opponents: ['Other player'] }),
      receiveWhisper: (id, text) => heard.push({ id, text, from: 'owner' }),
      whisperReply: (id, text) => { heard.push({ id, text, from: 'agent' }); return 1; },
    };
    setLiveTableProvider({ ...emptyRegistry,
      hasTable: id => !home && id === table.tableId,
      getTable: id => !home && id === table.tableId ? table : null,
      homeTableOf: id => home && id === agent.id ? table : null,
    });
    const body = await say('Hey');
    assert.equal(body.chat[0].content, natureOpener(nature, { seated: true }));
    assert.equal(body.replyUnavailable, undefined);
    assert.doesNotMatch(body.chat[0].content, /deal me in|put me at|give me a table|ready when you|sit down|\byo\b/i);
    assert.deepEqual(heard.map(row => row.from), ['owner', 'agent']);
    assert.equal(heard[1].text, body.chat[0].content);
    assert.equal(body.whisper.tableId, table.tableId);
  }
});

test('HOME-2: unknown nature stays unknown and a dead stored table is not a seated greeting', async t => {
  const { say, agent } = fixture(t, null, { activeTableId: 'closed-table', status: 'playing' });
  const body = await say('Hi');
  assert.equal(body.chat[0].content, 'Ready when you are.');
  assert.equal(body.replyUnavailable, undefined);
  assert.equal(agent.nature, null);
  assert.equal(body.whisper, null);
});

test('HOME-2: unsupported questions still say unavailable, even when they start with hello', async t => {
  const { say, owner } = fixture(t, { name: 'Professor' });
  for (const question of ['Hello, what is your favourite song?', 'Hi, should I call?', 'What time is it?', 'good morning tell me a story', 'high stakes']) {
    const body = await say(question);
    assert.equal(body.replyUnavailable, true, question);
    assert.equal(body.chat[0].content, 'I cannot answer that right now. Try me again in a moment.');
    assert.equal(loadProfile(owner).agents[0].chatHistory.at(-1).content, body.chat[0].content);
  }
  const location = await say('Where are you?');
  assert.equal(location.replyUnavailable, undefined);
  // LIFE-1: an idle body moves through his nature's cycle instead of holding
  // one habit for life, so the assertion is on the cycle. The case is still
  // that 'where are you' is answered from his REAL place, without a model.
  const labels = [...new Set(idleCycle('Professor').map((k) => ROUTINE_LABELS[k]))].join('|');
  assert.match(location.chat[0].content, new RegExp(`at home, (?:${labels})`, 'i'));
});
