// src/server/agentLifecycle.test.js — AGENTS-2
//
// Two rules about how many agents an owner has and how one of them ends:
//
//   RETIRE  POST /api/agents/:id/retire. If he is in a seat he is CALLED IN —
//           the wallet's own bench, so he finishes the hand he is in — and the
//           record closes when the pocket comes home. If he is at the bar it all
//           happens on the call. Archived is hidden, never deleted: off the
//           floor, out of CHATS and off YOU, every hand still on his record,
//           and reachable again only with ?all=1.
//
//   CAP     Four active agents per owner. Both doors into commitAgent — the
//           draft finish inside /api/agents/chat and /api/agents/build — answer
//           409 { error: 'agentCap', cap: 4 } beyond it, and the check runs
//           BEFORE the model call so a full roster is never billed for one.
//
// The growth pace, the third rule in AGENTS-2, is a pure function and is
// asserted where the rest of the attribute engine is: src/agent/attributes.test.js.
//
// Same shape as walletRoutes.test.js: a real server, the real SQLite store in a
// scratch cwd, auth off (no bot token configured is the documented local-dev
// posture, and deleting it makes the result independent of the developer's
// shell — TEST-2).

// TEST-2 / the testing law: no automated suite talks to a real model. The
// runner strips this from every child it spawns; a file run directly must not
// depend on that, or its result depends on whose shell exported a key.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

// The smallest table this needs, in the shape table.js has. `sitOutSeat` with
// afterHand records the bench without freeing the seat, which is what "he
// finishes the hand he is in" looks like from the outside.
function fakeTable(agentIds) {
  return {
    agentIds,
    pending: agentIds.map((id) => (id ? { playerId: `agent_${id}` } : null)),
    benchedAfterHand: new Set(),
    foldedOut: new Set(),
    sitOutSeat(seat, { afterHand = false } = {}) {
      if (!this.pending[seat]) throw new Error('not at this table');
      (afterHand ? this.benchedAfterHand : this.foldedOut).add(seat);
      return { pending: true, seat };
    },
  };
}

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

const getJson = (url) => fetch(url).then((r) => r.json());

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-agents2-'));
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

const mkAgent = (id, name, extra = {}) => ({
  id, name, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: 3_000,
  pocket: { balance: 3_000, mode: 'auto', cap: 2_000, realised: 0, ledger: [] },
  stats: { handsPlayed: 140, handsWon: 30, totalDecisions: 400 },
  ...extra,
});

test('AGENTS-2: retire, the cap, and what a retired agent is', async (t) => {
  const table = fakeTable(['seated']);
  const profiles = await import('./agentProfiles.js');
  profiles.setLiveTableProvider({
    getTable: (id) => (id === 'tbl-1' ? table : null),
    hasTable: (id) => id === 'tbl-1',
    getLiveGame: () => null,
  });

  try {
    await withServer(async (base) => {
      const store = await import('./store.js');
      store.saveWallet('u1', { ownerId: 'u1', balance: 1_000, ledger: [] });
      store.saveProfile('u1', {
        userId: 'u1',
        chat: [],
        agents: [
          mkAgent('bar', 'The Nit'),
          mkAgent('seated', 'Loose Cannon', { status: 'playing', activeTableId: 'tbl-1' }),
          mkAgent('spare1', 'River Rat'),
          mkAgent('spare2', 'The Clock'),
        ],
      });

      // ── Retiring an agent who is at the bar ───────────────────────────────
      await t.test('his pocket comes home and the record closes on the call', async () => {
        const res = await postJson(`${base}/api/agents/bar/retire?userId=u1`, { userId: 'u1' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));

        assert.equal(body.archived, true);
        assert.equal(body.pending, false, 'nothing to wait for — he was not in a seat');
        assert.equal(body.collected, 3_000, 'everything, float included');
        assert.equal(body.pocket.balance, 0);
        assert.equal(body.wallet.balance, 4_000, 'the wallet is 1,000 + his 3,000');
      });

      await t.test('he is off the floor, out of CHATS and off YOU', async () => {
        // All three screens read GET /api/agents. One exclusion, three surfaces.
        const roster = await getJson(`${base}/api/agents?userId=u1`);
        assert.equal(roster.agents.some((a) => a.id === 'bar'), false);
        assert.equal(roster.agents.length, 3);

        const full = await getJson(`${base}/api/agent-profile?userId=u1`);
        assert.equal(full.agents.some((a) => a.id === 'bar'), false);

        // AGE-38: the WebSocket floor push reads the same roster.
        assert.equal(profiles.floorSnapshot('u1', { owner: true }).some((a) => a.id === 'bar'), false);
      });

      await t.test('the record is kept, and ?all=1 is the way back to it', async () => {
        const all = await getJson(`${base}/api/agents?userId=u1&all=1`);
        const gone = all.agents.find((a) => a.id === 'bar');
        assert.ok(gone, 'nothing was deleted');
        assert.equal(gone.archived, true);
        assert.ok(gone.archivedAt > 0);
        assert.equal(gone.careerStats.hands, 140, 'his career is still on the record');
        assert.equal(gone.ledger.some((e) => e.type === 'retire'), true, 'and the hand-back is a ledger line');
      });

      await t.test('a retired agent cannot be put back in a seat', async () => {
        const res = await postJson(`${base}/api/agents/bar/deploy`, { userId: 'u1' });
        assert.equal(res.status, 410);
        assert.equal((await res.json()).error, 'agentRetired');
      });

      await t.test('nor into the matchmaking queue', async () => {
        const res = await postJson(`${base}/api/agents/bar/queue`, { userId: 'u1' });
        assert.equal(res.status, 410, 'both doors to a seat answer the same way');
        assert.equal((await res.json()).error, 'agentRetired');
      });

      await t.test('retiring him again is a no-op, not an error', async () => {
        const res = await postJson(`${base}/api/agents/bar/retire?userId=u1`, { userId: 'u1' });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.archived, true);
        assert.equal(body.collected, 0, 'his pocket was already empty — no second sweep');
        assert.equal(body.wallet.balance, 4_000);
      });

      // ── Retiring an agent who is in a seat ────────────────────────────────
      await t.test('a seated agent is called in, and plays the hand out', async () => {
        const res = await postJson(`${base}/api/agents/seated/retire?userId=u1`, { userId: 'u1' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));

        assert.equal(body.pending, true, 'he is coming in — the record closes when the hand does');
        assert.equal(body.archived, false);
        assert.equal(body.collected, 0, 'chips at the table are not swept out from under him');
        assert.deepEqual([...table.benchedAfterHand], [0], 'his seat, and nobody else’s');
        assert.equal(table.foldedOut.size, 0, 'he finishes the hand he is in');
      });

      await t.test('and until it does he is still on the roster', async () => {
        const roster = await getJson(`${base}/api/agents?userId=u1`);
        assert.equal(roster.agents.some((a) => a.id === 'seated'), true);
      });

      await t.test('the pocket returning is what archives him', async () => {
        // What table.js does when the hand he was called in from completes.
        profiles.finishAgentSession('seated', 'u1', {
          recap: 'called in', sessionPnl: 500, sessionHands: 20,
          finalStack: 1_500, buyInAmount: 1_000, tableId: 'tbl-1',
        });

        const all = await getJson(`${base}/api/agents?userId=u1&all=1`);
        const him = all.agents.find((a) => a.id === 'seated');
        assert.equal(him.archived, true);
        assert.equal(him.pocket.balance, 0, 'the pocket is home');
        // He sat down on 3,000, the buy-in is already out of it, and 1,500 came
        // back — so 3,000 + 1,500 lands in the wallet on top of the 4,000.
        const wallet = await getJson(`${base}/api/wallet?userId=u1`);
        assert.equal(wallet.balance, 8_500);

        const roster = await getJson(`${base}/api/agents?userId=u1`);
        assert.equal(roster.agents.some((a) => a.id === 'seated'), false, 'and now he is off the floor');
      });

      // ── The cap ──────────────────────────────────────────────────────────
      await t.test('the cap counts the roster, not the record', async () => {
        // Two retired, two left. Room for two more.
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 2);

        for (const name of ['fresh-a', 'fresh-b']) {
          const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
          assert.equal(res.status, 200, `${name} should fit under the cap`);
        }
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 4);
      });

      await t.test('POST /api/agents/build answers 409 agentCap beyond four', async () => {
        const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
        assert.equal(res.status, 409);
        assert.deepEqual(await res.json(), { error: 'agentCap', cap: 4 });
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 4,
          'and nobody was created on the way to the 409');
      });

      await t.test('rebuilding an agent who already exists is never capped', async () => {
        const roster = await getJson(`${base}/api/agents?userId=u1`);
        const existing = roster.agents[0].id;
        const res = await postJson(`${base}/api/agents/build`, { userId: 'u1', existingAgentId: existing });
        assert.equal(res.status, 200, 'a full roster must still be able to edit its own agents');
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 4);
      });

      await t.test('the draft finish answers 409 agentCap too, before any model call', async () => {
        await postJson(`${base}/api/agents/chat/reset`, { userId: 'u1' });
        // A brief, then the go signal. The cap is checked before buildFromDraft,
        // so this costs nothing and leaves the draft where it was.
        await postJson(`${base}/api/agents/chat`, { userId: 'u1', content: 'Tight and patient' });
        const res = await postJson(`${base}/api/agents/chat`, { userId: 'u1', content: 'lets go' });
        assert.equal(res.status, 409);
        assert.deepEqual(await res.json(), { error: 'agentCap', cap: 4 });
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 4);
      });

      await t.test('retiring one makes room, and the same draft then builds', async () => {
        const roster = await getJson(`${base}/api/agents?userId=u1`);
        const victim = roster.agents[0].id;
        await postJson(`${base}/api/agents/${victim}/retire?userId=u1`, { userId: 'u1' });
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 3);

        const res = await postJson(`${base}/api/agents/chat`, { userId: 'u1', content: 'lets go' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.ok(body.agentId, 'the draft that was turned down is the draft that gets built');
        assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 4);
      });
    });
  } finally {
    profiles.setLiveTableProvider(null);
  }
});
