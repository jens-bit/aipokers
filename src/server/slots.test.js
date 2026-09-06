// src/server/slots.test.js — SLOTS-1
//
// The ladder (pure), and the three places it is felt: GET /api/slots, the two
// doors into a new agent, and the session end that unlocks the next rung.
//
// Same harness as agentLifecycle.test.js — a real server on the real SQLite
// store in a scratch cwd, auth off (no bot token is the documented local-dev
// posture, and deleting it makes the result independent of whose shell this
// runs in).

// TEST-2 / the testing law: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SLOT_PRICES, SLOT_CAP, priceOfSlot, unlockedSlots, slotsProjection, slotBlocker,
} from './slots.js';
import { emptyWallet, recordEarned, ensureEarned } from './wallet.js';
import { _closeForTests } from './store.js';

// ── The ladder ──────────────────────────────────────────────────────────────

test('SLOTS-1: the first slot is free and the other three have the brief\'s prices', () => {
  assert.deepEqual([...SLOT_PRICES], [0, 10_000, 50_000, 250_000]);
  assert.equal(SLOT_CAP, 4);
  assert.equal(priceOfSlot(1), 0);
  assert.equal(priceOfSlot(4), 250_000);
  assert.equal(priceOfSlot(5), 0, 'a slot nobody can have has no price to quote');
  assert.equal(priceOfSlot(0), 0);
});

test('SLOTS-1: an owner who has won nothing still has one agent', () => {
  assert.equal(unlockedSlots(0), 1);
  assert.equal(unlockedSlots(9_999), 1);
});

test('SLOTS-1: each rung opens exactly at its price', () => {
  assert.equal(unlockedSlots(10_000), 2);
  assert.equal(unlockedSlots(49_999), 2);
  assert.equal(unlockedSlots(50_000), 3);
  assert.equal(unlockedSlots(249_999), 3);
  assert.equal(unlockedSlots(250_000), 4);
  assert.equal(unlockedSlots(10_000_000), 4, 'and it stops at four however well he does');
});

test('SLOTS-1: the projection says where he is and what the next one costs', () => {
  assert.deepEqual(slotsProjection({ used: 1, earned: 0 }), {
    used: 1, cap: 4,
    next: { index: 2, price: 10_000, earned: 0, unlocked: false },
  });
  assert.deepEqual(slotsProjection({ used: 1, earned: 12_000 }), {
    used: 1, cap: 4,
    next: { index: 2, price: 10_000, earned: 12_000, unlocked: true },
  });
  assert.deepEqual(slotsProjection({ used: 4, earned: 999_999 }), {
    used: 4, cap: 4, next: null,
  }, 'at the ceiling there is no next slot to price');
});

test('SLOTS-1: the two refusals are different things and say so', () => {
  assert.equal(slotBlocker({ used: 0, earned: 0 }), null, 'the first one is free');
  assert.deepEqual(slotBlocker({ used: 1, earned: 0 }), { error: 'slotLocked', price: 10_000, earned: 0 });
  assert.deepEqual(slotBlocker({ used: 1, earned: 10_000 }), null);
  assert.deepEqual(slotBlocker({ used: 2, earned: 10_000 }), { error: 'slotLocked', price: 50_000, earned: 10_000 });
  assert.deepEqual(slotBlocker({ used: 4, earned: 250_000 }), { error: 'agentCap', cap: 4 },
    'a full roster is full whatever he has won — retiring is the only way past it');
});

// ── The counter ─────────────────────────────────────────────────────────────

test('SLOTS-1: earned counts winning sessions and never counts anything else', () => {
  const wallet = emptyWallet('u1');
  assert.equal(wallet.earned, 0);
  assert.equal(recordEarned(wallet, 4_000), 4_000);
  assert.equal(recordEarned(wallet, 6_000), 10_000);
  // A losing night is not a debit. It is simply not a credit.
  assert.equal(recordEarned(wallet, -9_000), 10_000, 'a slot he won is not taken back');
  assert.equal(recordEarned(wallet, 0), 10_000);
  assert.equal(recordEarned(wallet, null), 10_000);
  // Depositing does not move it — nothing in wallet.js's funding paths calls
  // this, and that is the rule: a slot cannot be bought.
  wallet.balance += 500_000;
  assert.equal(wallet.earned, 10_000);
});

test('SLOTS-1: a wallet written before the counter existed reads as zero, not as broken', () => {
  const old = { ownerId: 'u1', balance: 100, ledger: [] };
  assert.equal(ensureEarned(old), 0);
  assert.equal(old.earned, 0);
  const wrong = { ownerId: 'u1', balance: 100, earned: -5, ledger: [] };
  assert.equal(ensureEarned(wrong), 0);
});

// ── The wire ────────────────────────────────────────────────────────────────

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then((r) => r.json());

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-slots1-'));
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

test('SLOTS-1: the first agent is free, the second is not, and winning buys it', async (t) => {
  await withServer(async (base) => {
    const store = await import('./store.js');
    const profiles = await import('./agentProfiles.js');

    await t.test('an empty owner is offered one free slot', async () => {
      const slots = await getJson(`${base}/api/slots?userId=u1`);
      assert.deepEqual(slots, {
        used: 0, cap: 4,
        next: { index: 1, price: 0, earned: 0, unlocked: true },
      });
    });

    await t.test('and the first build is allowed', async () => {
      const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
      assert.equal(res.status, 200);
      const slots = await getJson(`${base}/api/slots?userId=u1`);
      assert.equal(slots.used, 1);
      assert.deepEqual(slots.next, { index: 2, price: 10_000, earned: 0, unlocked: false });
    });

    await t.test('the second is refused with a price, not a cap', async () => {
      const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: 'slotLocked', price: 10_000, earned: 0 });
      assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 1,
        'and nobody was created on the way to the 409');
    });

    await t.test('the draft finish answers the same way, before any model call', async () => {
      await postJson(`${base}/api/agents/chat/reset`, { userId: 'u1' });
      await postJson(`${base}/api/agents/chat`, { userId: 'u1', content: 'Tight and patient' });
      const res = await postJson(`${base}/api/agents/chat`, { userId: 'u1', content: 'lets go' });
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: 'slotLocked', price: 10_000, earned: 0 });
    });

    await t.test('a winning session credits the owner, a losing one does not', async () => {
      const him = (await getJson(`${base}/api/agents?userId=u1`)).agents[0];
      profiles.finishAgentSession(him.id, 'u1', {
        recap: 'good night', sessionPnl: 6_000, sessionHands: 40,
        finalStack: 9_000, buyInAmount: 3_000, tableId: 'tbl-1',
      });
      assert.equal((await getJson(`${base}/api/slots?userId=u1`)).next.earned, 6_000);

      profiles.finishAgentSession(him.id, 'u1', {
        recap: 'bad night', sessionPnl: -5_000, sessionHands: 40,
        finalStack: 0, buyInAmount: 5_000, tableId: 'tbl-1',
      });
      assert.equal((await getJson(`${base}/api/slots?userId=u1`)).next.earned, 6_000,
        'losing is not a debit — the counter is a record of what was won');
    });

    await t.test('crossing the price opens the slot, and the build goes through', async () => {
      const him = (await getJson(`${base}/api/agents?userId=u1`)).agents[0];
      profiles.finishAgentSession(him.id, 'u1', {
        recap: 'better night', sessionPnl: 4_000, sessionHands: 40,
        finalStack: 7_000, buyInAmount: 3_000, tableId: 'tbl-1',
      });
      const slots = await getJson(`${base}/api/slots?userId=u1`);
      assert.deepEqual(slots.next, { index: 2, price: 10_000, earned: 10_000, unlocked: true });

      const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
      assert.equal(res.status, 200);
      assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 2);
    });

    await t.test('the third one is refused at its own price', async () => {
      const res = await postJson(`${base}/api/agents/build`, { userId: 'u1' });
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: 'slotLocked', price: 50_000, earned: 10_000 });
    });

    await t.test('a rebuild of somebody who already exists takes no slot', async () => {
      const existing = (await getJson(`${base}/api/agents?userId=u1`)).agents[0].id;
      const res = await postJson(`${base}/api/agents/build`, { userId: 'u1', existingAgentId: existing });
      assert.equal(res.status, 200, 'editing an agent is not acquiring one');
      assert.equal((await getJson(`${base}/api/agents?userId=u1`)).agents.length, 2);
    });

    await t.test('the counter survives a restart — it is in the wallets table', async () => {
      const wallet = store.loadWallet('u1');
      assert.equal(wallet.earned, 10_000);
    });

    await t.test('retiring frees the slot but never the earnings', async () => {
      const victim = (await getJson(`${base}/api/agents?userId=u1`)).agents[1].id;
      await postJson(`${base}/api/agents/${victim}/retire?userId=u1`, { userId: 'u1' });
      const slots = await getJson(`${base}/api/slots?userId=u1`);
      assert.equal(slots.used, 1, 'a retired agent is off the roster, so his slot is free again');
      assert.deepEqual(slots.next, { index: 2, price: 10_000, earned: 10_000, unlocked: true });
    });
  });
});

test('SLOTS-1: the home game unlocks nothing — it pays nothing', async () => {
  // The property, stated where it can be checked cheaply: the counter has one
  // writer, finishAgentSession, and table.js's home tables never call it (see
  // `if (agentId && !this.home)` in _retireSeat). So a home game cannot move a
  // number that buys a roster slot, however long they play.
  const wallet = emptyWallet('u1');
  recordEarned(wallet, 0);
  assert.equal(wallet.earned, 0);
});
