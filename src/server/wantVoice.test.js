// src/server/wantVoice.test.js — LIFE-2 job 1
//
// The wiring half. src/agent/wantVoice.test.js proves the table: sixty-four
// lines, five verbs, no two natures alike. What is only testable HERE is that
// the table reaches the owner —
//
//   * the agent view says it in HIS voice and names what to do about it,
//   * the room says the same sentence over his head,
//   * two agents of different natures in the SAME state do not say the same
//     thing to the same owner in the same response, which is the failure the
//     job was written against,
//   * and a want raised before any of this existed is spoken in his voice from
//     the next projection onward, with nothing written and nothing migrated.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';
import { NATURE_WANT_LINES } from '../agent/wantVoice.js';

const MIN = 60_000;
const now = Date.now();

const getJson = (url) => fetch(url).then((r) => r.json());

// Same shape as wants.test.js's seed, plus the one field this file is about.
function agent(id, name, nature, over = {}) {
  return {
    id,
    name,
    nature: { name: nature },
    status: 'idle',
    activeTableId: null,
    fatigue: 'fresh',
    restedAt: now - 5 * MIN,
    bankroll: 5_000,
    pocket: { balance: 5_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 300, handsWon: 150, winRate: 50, biggestPot: 900 },
    sessionLog: [{ endedAt: now - 20 * MIN, mood: 'neutral', net: 100, hands: 40, biggestPot: 900 }],
    ...over,
  };
}

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wantvoice-'));
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  const savedSecret = process.env.DEV_API_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);

  const { default: express } = await import('express');
  const { installAgentProfileRoutes } = await import('./agentProfiles.js');
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

test('LIFE-2 job 1: he asks for what he wants, in his own voice', async (t) => {
  const { setLiveTableProvider, homeSnapshot } = await import('./agentProfiles.js');
  setLiveTableProvider({
    getTable: () => null,
    hasTable: () => false,
    getLiveGame: () => null,
    homeTableOf: () => null,
    countAutonomousTables: () => 0,
    MAX_CONCURRENT_TABLES: 4,
    findJoinableTable: () => null,
    getDefaultBlinds: () => ({ smallBlind: 10, bigBlind: 20 }),
  });

  try {
    await withServer(async (base) => {
      const store = await import('./store.js');
      store.saveWallet('u1', { ownerId: 'u1', balance: 10_000, fridge: { beer: 4, snack: 4 }, ledger: [] });
      store.saveProfile('u1', {
        userId: 'u1',
        chat: [],
        agents: [
          // FOUR MEN IN THE SAME STATE. Every one of them is cooked, which is
          // the top rung of the ladder, so every one of them raises `rest` —
          // and that is exactly the household the playtest saw saying one
          // sentence four times.
          agent('grind', 'The Grinder', 'Grinder', { fatigue: 'worn', restedAt: now }),
          agent('hoth', 'Powder Keg', 'Hothead', { fatigue: 'worn', restedAt: now }),
          agent('rock', 'Granite', 'Rock', { fatigue: 'worn', restedAt: now }),
          agent('show', 'The Turn', 'Showman', { fatigue: 'worn', restedAt: now }),
          // One of each of the other actions, so the verbs are exercised over
          // the real route rather than only in the table's own unit test.
          agent('busted', 'Skint', 'Sphinx', {
            bankroll: 0, pocket: { balance: 0, mode: 'allowance', cap: null, realised: 0, ledger: [] },
          }),
          agent('bored', 'Ready Freddy', 'Gambler', { restedAt: now - 25 * MIN }),
          agent('hot', 'Steaming', 'Shark', {
            mood: { state: 'tilted', heat: 78, losingRun: 3 }, restedAt: now - 15 * MIN,
          }),
          // A want stored by an older build: the neutral sentence, no nature
          // stamp, nothing that knows this tree happened.
          agent('legacy', 'Old Stock', 'Professor', {
            fatigue: 'worn',
            restedAt: now,
            want: {
              kind: 'rest', priority: 1, needs: null, dangerous: false, item: null,
              text: "Sit one out. I'm cooked.", mood: 'neutral', at: now - 3 * MIN,
              answered: null, answeredAt: null, snoozedUntil: null,
            },
          }),
        ],
      });

      const wantOf = async (id) => (await getJson(`${base}/api/agents/${id}?userId=u1`)).want;

      await t.test('the agent view says it in his own voice', async () => {
        assert.equal((await wantOf('grind')).text, NATURE_WANT_LINES.Grinder.rest);
        assert.equal((await wantOf('rock')).text, NATURE_WANT_LINES.Rock.rest);
        assert.equal((await wantOf('rock')).text, "I'm knackered. Let me sleep.");
      });

      await t.test('a Rock does not sound like a Showman in the same state', async () => {
        const lines = await Promise.all(['grind', 'hoth', 'rock', 'show'].map(async (id) => {
          const want = await wantOf(id);
          assert.equal(want.kind, 'rest', `${id} should be asking to sit one out`);
          return want.text;
        }));
        assert.equal(new Set(lines).size, 4, `four cooked men said ${JSON.stringify(lines)}`);
      });

      await t.test('the want names an action the owner can take tonight', async () => {
        const expected = {
          grind: ['rest', 'Sit him out'],
          busted: ['chips', 'Give him chips'],
          bored: ['deploy', 'Put him in'],
          hot: ['feed', 'Open the fridge'],
        };
        for (const [id, [action, label]] of Object.entries(expected)) {
          const want = await wantOf(id);
          assert.equal(want.action, action, `${id} wants ${want.kind}`);
          assert.equal(want.actionLabel, label);
        }
      });

      await t.test('a want stored before this tree speaks in his voice anyway', async () => {
        const want = await wantOf('legacy');
        assert.equal(want.text, NATURE_WANT_LINES.Professor.rest);
        assert.equal(want.action, 'rest');
        // …and nothing was rewritten to achieve it. The record still carries the
        // sentence he raised it with; only the projection changed.
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        assert.equal(_agentRecordForTests('legacy', 'u1').want.text, "Sit one out. I'm cooked.");
      });

      await t.test('the room carries the bubble and its actionable label without private stock fields', async () => {
        const snap = homeSnapshot('u1', { owner: true });
        const rock = snap.agents.find((a) => a.id === 'rock');
        assert.deepEqual(rock.want, {
          kind: 'rest',
          text: NATURE_WANT_LINES.Rock.rest,
          action: 'rest',
          actionLabel: 'Sit him out',
        });
        // The same sentence in both places — the room and the card cannot put
        // different words in the same mouth.
        assert.equal(rock.want.text, (await wantOf('rock')).text);
        // And a man with nothing on his mind says nothing over his head.
        const quiet = snap.agents.find((a) => a.id === 'show');
        assert.equal(typeof quiet.want?.text, 'string');
        assert.notEqual(quiet.want.text, rock.want.text);
      });

      await t.test('a visitor is not yours to feed, so he does not ask you', async () => {
        const snap = homeSnapshot('u1', {
          owner: true,
          visitors: [{ id: 'stranger', name: 'Away Day', want: { kind: 'beer', text: 'Get me a beer.', action: 'feed' } }],
        });
        const guest = snap.agents.find((a) => a.id === 'stranger');
        assert.equal(guest.guest, true);
        assert.equal(guest.want, null);
      });
    });
  } finally {
    setLiveTableProvider(null);
  }
});
