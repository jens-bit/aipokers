// src/server/walletRoutes.test.js — WALLET-5, WALLET-7
//
// The two money routes, over a real server, against the two playtest bugs that
// were about the SERVER and not the drawing:
//
//   #1  funding above the seeded cap must land in the pocket. The seeding rule
//       (pocket = min(bankroll, 2000) on auto at a 2,000 cap) describes what a
//       migrated agent starts with, not a ceiling every later top-up is
//       clipped to.
//   #2  "Cut him off" must persist AND reach the table he is sitting at. The
//       funding sheet promises "he finishes the hand he is in and takes a seat
//       at the bar"; until now the promise was decoration.
//
// WALLET-7 turned that second one into "call him in" — the same promise plus
// the money: everything in the pocket comes home, and the chips still in front
// of him follow when the session pays them back. The verbs the client speaks
// are mapped to the stored modes here, at the route, so nothing is migrated.
//
// This lives beside wallet.test.js rather than inside it because agentProfiles
// caches the whole agent store in a module-level `store` on first read. Only
// the first withServer() in a process can seed through store.saveProfile — and
// wallet.test.js already spends that on the collect receipt. Each test file is
// spawned as its own process (src/test/legacy.test.js), so a second file gets a
// cold cache. Both scenarios below therefore share one server and one seed.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

// The smallest table this needs, in the shape table.js has: which agent sits
// in which seat, which seats are occupied, and the seat-scoped sit-out that
// frees a seat once the hand in progress completes.
function fakeTable(agentIds) {
  return {
    agentIds,
    pending: agentIds.map((id) => (id ? { playerId: `agent_${id}` } : null)),
    benchedAfterHand: new Set(),   // played the hand out, then benched
    foldedOut: new Set(),          // folded out of the hand in progress
    sitOutSeat(seat, { afterHand = false } = {}) {
      if (!this.pending[seat]) throw new Error('not at this table');
      (afterHand ? this.benchedAfterHand : this.foldedOut).add(seat);
      return { pending: true, seat };
    },
  };
}

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

// Auth off: with neither TELEGRAM_BOT_TOKEN nor DEV_API_SECRET configured the
// middleware allows all and isOwner is true, which is the documented local-dev
// posture. Deleting them makes the test independent of the developer's shell.
async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wallet5-'));
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

test('WALLET-5: the fund route', async (t) => {
  const table = fakeTable(['cannon']);
  const { setLiveTableProvider } = await import('./agentProfiles.js');
  setLiveTableProvider({
    getTable: (id) => (id === 'tbl-1' ? table : null),
    hasTable: (id) => id === 'tbl-1',
    getLiveGame: () => null,
  });

  try {
    await withServer(async (base) => {
      const store = await import('./store.js');
      store.saveWallet('u1', { ownerId: 'u1', balance: 10_000, ledger: [] });
      store.saveProfile('u1', {
        userId: 'u1',
        chat: [],
        agents: [
          // At a table, and about to be cut off.
          {
            id: 'cannon', name: 'Loose Cannon', status: 'playing', activeTableId: 'tbl-1',
            bankroll: 4_000,
            pocket: { balance: 4_000, mode: 'auto', cap: 2_000, realised: 0, ledger: [] },
          },
          // Exactly what SEED-1 leaves behind, about to be topped up past it.
          {
            id: 'seeded', name: 'Seeded', status: 'idle', activeTableId: null,
            bankroll: 2_000,
            pocket: { balance: 2_000, mode: 'auto', cap: 2_000, realised: 0, ledger: [] },
          },
          // WALLET-7: the two verbs, on an agent of their own.
          {
            id: 'giver', name: 'Given Chips', status: 'idle', activeTableId: null,
            bankroll: 0,
            pocket: { balance: 0, mode: 'topup', cap: null, realised: 0, ledger: [] },
          },
          // WALLET-7: called in while seated, and the table has since paid him
          // back — this is the pocket the recall sweep exists for.
          {
            id: 'homer', name: 'On His Way Home', status: 'idle', activeTableId: null,
            bankroll: 2_600,
            pocket: { balance: 2_600, mode: 'cut', cap: null, realised: 0, recall: true, ledger: [] },
          },
        ],
      });

      await t.test('the seeded cap is not a ceiling on later top-ups', async () => {
        const res = await postJson(`${base}/api/agents/seeded/fund?userId=u1`, {
          userId: 'u1', mode: 'auto', amount: 2_000, cap: 4_000,
        });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));

        assert.equal(body.moved, 2_000);
        assert.equal(body.pocket.balance, 4_000, 'all of it landed in the pocket');
        assert.equal(body.pocket.cap, 4_000, 'and the sheet reopens on the size it was set to');
        // He has won nothing, so none of this is winnings. The row must not
        // read a top-up as money to bring home — that is what made Fund
        // disappear behind a Collect button.
        assert.equal(body.pocket.pnl, 0);
      });

      // WALLET-7 — this asserted that cutting him off "costs him nothing", i.e.
      // left the pocket exactly as it was. That was the old four-mode cut: a
      // tag change. The verb is now "call him in", and calling a horse in means
      // the money comes back with him — that is the whole difference between
      // the two verbs and the four modes. He still loses nothing he cares
      // about: attributes, read book and grudges all keep.
      await t.test('calling him in brings the pocket home and persists the decision', async () => {
        const before = await fetch(`${base}/api/wallet?userId=u1`).then((r) => r.json());
        const res = await postJson(`${base}/api/agents/cannon/fund?userId=u1`, {
          userId: 'u1', verb: 'callin', amount: null, cap: null,
        });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));

        assert.equal(body.pocket.mode, 'cut');
        assert.equal(body.collected, 4_000, 'everything in the pocket came back');
        assert.equal(body.pocket.balance, 0);
        assert.equal(body.wallet.balance, before.balance + 4_000, 'and it landed in the wallet');

        // The reported bug this file was opened for: reopening the sheet showed
        // Allowance again. The decision has to survive the round trip.
        const after = await fetch(`${base}/api/agents?userId=u1`).then((r) => r.json());
        const cannon = after.agents.find((a) => a.id === 'cannon');
        assert.equal(cannon.pocket.mode, 'cut');
        assert.equal(cannon.pocket.balance, 0);
      });

      await t.test('cutting him off benches his seat at the table he is at', async () => {
        // Queued, not yanked: table.js frees the seat once the hand in progress
        // completes, and the floor draws him at the bar from there. WALLET-6:
        // he plays that hand out rather than folding out of it.
        assert.deepEqual([...table.benchedAfterHand], [0], 'his seat, and nobody else’s');
        assert.equal(table.foldedOut.size, 0, 'he finishes the hand he is in');
      });

      await t.test('WALLET-7: "give him chips" is an allowance, and the toggle makes it a refill', async () => {
        const plain = await postJson(`${base}/api/agents/giver/fund?userId=u1`, {
          userId: 'u1', verb: 'give', amount: 2_000, cap: 2_000, refill: false,
        }).then((r) => r.json());
        assert.equal(plain.moved, 2_000);
        assert.equal(plain.pocket.mode, 'allowance', 'no refill is the allowance the store already knows');
        assert.equal(plain.pocket.balance, 2_000);
        assert.deepEqual(plain.pocket.stakes, { smallBlind: 10, bigBlind: 20, label: '$10/$20' });

        const refilling = await postJson(`${base}/api/agents/giver/fund?userId=u1`, {
          userId: 'u1', verb: 'give', amount: 3_000, cap: 5_000, refill: true,
        }).then((r) => r.json());
        assert.equal(refilling.pocket.mode, 'auto', 'the toggle is the whole of auto-refill');
        assert.equal(refilling.pocket.cap, 5_000, 'and the cap is what it refills to');
        assert.equal(refilling.pocket.balance, 5_000);
      });

      await t.test('WALLET-7: a pocket funded once with no winnings has nothing to collect', async () => {
        // The symptom the tree is named after: under the old rule the $5,000
        // above his float read as money to bring home, and Collect took the
        // owner's own top-up straight back out of the pocket he had just filled.
        const agents = await fetch(`${base}/api/agents?userId=u1`).then((r) => r.json());
        const giver = agents.agents.find((a) => a.id === 'giver');
        assert.equal(giver.pocket.pnl, 0);
        assert.equal(giver.pocket.collectable, 0, 'the row draws no Collect from this');

        const refused = await postJson(`${base}/api/agents/giver/collect?userId=u1`, { userId: 'u1' });
        assert.equal(refused.status, 400);
        assert.match((await refused.json()).error, /nothing to collect/);
      });

      await t.test('WALLET-7: and calling that same pocket in works', async () => {
        const res = await postJson(`${base}/api/agents/giver/fund?userId=u1`, {
          userId: 'u1', verb: 'callin',
        });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.collected, 5_000, 'all of it, principal included — he is done');
        assert.equal(body.pocket.balance, 0);
        assert.equal(body.pocket.mode, 'cut');
      });

      await t.test('WALLET-7: chips still at the table come home on the next look at the wallet', async () => {
        // `homer` was called in while seated and the session has since paid him
        // back into his pocket. Reading the wallet is what sweeps it: the owner
        // took the decision once and is not asked to collect a second time.
        const w = await fetch(`${base}/api/wallet?userId=u1`).then((r) => r.json());
        const swept = w.ledger.filter((e) => e.agentId === 'homer' && e.type === 'collect');
        assert.equal(swept.length, 1, 'the sweep is a collect in the wallet ledger, like any other');
        assert.equal(swept[0].amount, 2_600);

        const agents = await fetch(`${base}/api/agents?userId=u1`).then((r) => r.json());
        const homer = agents.agents.find((a) => a.id === 'homer');
        assert.equal(homer.pocket.balance, 0, 'his pocket is empty because it is all in the wallet');

        // And it happens exactly once, however often the screen is opened.
        const again = await fetch(`${base}/api/wallet?userId=u1`).then((r) => r.json());
        assert.equal(again.balance, w.balance);
        assert.equal(again.ledger.filter((e) => e.agentId === 'homer' && e.type === 'collect').length, 1);
      });

      await t.test('funding him again lifts the cut and leaves the seat alone', async () => {
        const res = await postJson(`${base}/api/agents/seeded/fund?userId=u1`, {
          userId: 'u1', mode: 'allowance', amount: 0, cap: 5_000,
        });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.pocket.mode, 'allowance');
        assert.equal(body.pocket.cap, 5_000, 'an allowance is a size, and it is remembered');
        assert.deepEqual([...table.benchedAfterHand], [0], 'no second seat was touched');
      });
    });
  } finally {
    setLiveTableProvider(null);
  }
});
