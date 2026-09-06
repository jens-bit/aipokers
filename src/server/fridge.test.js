// src/server/fridge.test.js — FRIDGE-1
//
// The fixture (pure), and the two things it is felt through: the stock route,
// and the beer's second half at the table.
//
// The want side — "we're out of beer", yes opening the fridge, the same want
// coming back in his own words once it is stocked — is asserted end to end in
// wants.test.js, where the rest of the ask layer lives.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ITEMS, ITEM_IDS, MAX_STOCK_PER_BUY,
  DRINK_DISCIPLINE_PENALTY, DRINK_BLUFF_BONUS,
  emptyFridge, ensureFridge, countOf, hasStock, takeOne, stock,
  fridgeProjection, priceOf, heatEffectOf, outOfStockLine, isItem,
} from './fridge.js';
import { applyItem } from '../agent/mood.js';
import { Table } from './table.js';
import { _closeForTests } from './store.js';

// ── The shelves ─────────────────────────────────────────────────────────────

test('FRIDGE-1: two items, at the brief\'s prices', () => {
  assert.deepEqual([...ITEM_IDS], ['beer', 'snack']);
  assert.equal(priceOf('beer'), 200);
  assert.equal(priceOf('snack'), 100);
  assert.equal(priceOf('caviar'), 0);
  assert.equal(isItem('beer'), true);
  assert.equal(isItem('caviar'), false);
});

test('FRIDGE-1: a beer cools 15, a snack 8, and only the beer follows him to work', () => {
  assert.equal(heatEffectOf('beer'), -15);
  assert.equal(heatEffectOf('snack'), -8);
  assert.equal(ITEMS.beer.session, 'drinking');
  assert.equal(ITEMS.snack.session, null, 'a snack is just a snack');
});

test('FRIDGE-1: nothing in the fridge touches a skill upwards', () => {
  // The one effect either item has on how well he plays is the beer's, and it
  // is a PENALTY. If this ever reads as a bonus, an item has become a powerup.
  assert.ok(DRINK_DISCIPLINE_PENALTY > 0);
  assert.ok(DRINK_BLUFF_BONUS > 0, 'bluffing more is looser play, not better play');
});

test('FRIDGE-1: an owner who has never stocked one has an empty fridge, not a broken one', () => {
  assert.deepEqual(emptyFridge(), { beer: 0, snack: 0 });
  const old = { ownerId: 'u1', balance: 500, ledger: [] };
  assert.deepEqual(ensureFridge(old), { beer: 0, snack: 0 });
  assert.deepEqual(old.fridge, { beer: 0, snack: 0 });
  assert.deepEqual(ensureFridge({ fridge: { beer: 'x', snack: -3 } }), { beer: 0, snack: 0 });
});

// ── Stocking ────────────────────────────────────────────────────────────────

test('FRIDGE-1: stocking debits the wallet and fills the shelf', () => {
  const wallet = { ownerId: 'u1', balance: 1_000, ledger: [] };
  const res = stock(wallet, { item: 'beer', qty: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.spent, 600);
  assert.equal(wallet.balance, 400);
  assert.equal(countOf(wallet, 'beer'), 3);
  assert.equal(countOf(wallet, 'snack'), 0);

  const snacks = stock(wallet, { item: 'snack', qty: 4 });
  assert.equal(snacks.ok, true);
  assert.equal(snacks.spent, 400);
  assert.equal(wallet.balance, 0);
  assert.equal(countOf(wallet, 'snack'), 4);
});

test('FRIDGE-1: a wallet that cannot cover the lot buys none of it', () => {
  const wallet = { ownerId: 'u1', balance: 500, ledger: [] };
  const res = stock(wallet, { item: 'beer', qty: 6 });
  assert.equal(res.ok, false);
  assert.equal(res.cost, 1_200);
  assert.equal(res.available, 500);
  assert.equal(wallet.balance, 500, 'and nothing was taken on the way to the refusal');
  assert.equal(countOf(wallet, 'beer'), 0, 'a BUY 6 that silently buys two is worse than a no');
});

test('FRIDGE-1: the qty is bounded and validated', () => {
  const wallet = { ownerId: 'u1', balance: 1_000_000, ledger: [] };
  assert.equal(stock(wallet, { item: 'caviar', qty: 1 }).ok, false);
  assert.equal(stock(wallet, { item: 'beer', qty: 0 }).ok, false);
  assert.equal(stock(wallet, { item: 'beer', qty: -4 }).ok, false);
  assert.equal(stock(wallet, { item: 'beer', qty: MAX_STOCK_PER_BUY + 1 }).ok, false);
  assert.equal(wallet.balance, 1_000_000);
  assert.equal(stock(wallet, { item: 'beer', qty: MAX_STOCK_PER_BUY }).ok, true);
});

test('FRIDGE-1: taking one out is the only way anything leaves', () => {
  const wallet = { ownerId: 'u1', balance: 1_000, ledger: [] };
  stock(wallet, { item: 'beer', qty: 1 });
  assert.equal(hasStock(wallet, 'beer'), true);
  assert.equal(takeOne(wallet, 'beer'), true);
  assert.equal(countOf(wallet, 'beer'), 0);
  assert.equal(takeOne(wallet, 'beer'), false, 'an empty shelf gives nothing and goes no further negative');
  assert.equal(countOf(wallet, 'beer'), 0);
  assert.equal(wallet.balance, 800, 'and drinking it costs nothing — the spend was the stocking');
});

test('FRIDGE-1: the projection is what the fridge sheet draws', () => {
  const wallet = { ownerId: 'u1', balance: 1_000, ledger: [] };
  stock(wallet, { item: 'beer', qty: 2 });
  assert.deepEqual(fridgeProjection(wallet), {
    items: [
      { id: 'beer', label: 'a beer', count: 2, price: 200 },
      { id: 'snack', label: 'a snack', count: 0, price: 100 },
    ],
    beer: 2,
    snack: 0,
  });
  assert.equal(outOfStockLine('beer'), "we're out of beer");
  assert.equal(outOfStockLine('snack'), "we're out of snacks");
});

// ── What it does to him ─────────────────────────────────────────────────────

test('FRIDGE-1: an item cools heat and can never make him pleased with himself', () => {
  const tilted = { state: 'tilted', heat: 80, losingRun: 3 };
  const beer = applyItem(tilted, -15);
  assert.equal(beer.cooled, true);
  assert.equal(beer.mood.heat, 65);

  const snack = applyItem(tilted, -8);
  assert.equal(snack.mood.heat, 72);

  // The floor is the neutral midpoint: an item settles a man down, it does not
  // manufacture confidence he has not earned at a table.
  const calm = applyItem({ state: 'frustrated', heat: 40, losingRun: 0 }, -15);
  assert.ok(calm.mood.heat >= 30, `went under the neutral midpoint: ${calm.mood.heat}`);

  const level = applyItem({ state: 'neutral', heat: 30, losingRun: 0 }, -15);
  assert.equal(level.cooled, false, "he's fine — save it");
});

test('FRIDGE-1: the beer follows him to his next session and no further', () => {
  // A table, two seats, and an agent record that is carrying a drink. The
  // agentProfiles side is stubbed through the same seam the table already uses
  // for attributes: what is under test is the SEAT, not the flag's storage.
  const table = new Table({ tableId: 'fridge-seat', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const seat = table.seatAI({
    displayName: 'BALANCE', strategy: '', agentId: null,
    agentProfile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 },
    buyIn: 1_000,
  });
  // A seat with no agent record behind it can never be drinking: there is
  // nobody to have had the beer.
  assert.equal(table.seatDrinking[seat], false);
  assert.equal(table.agentProfiles[seat].bluffFreq, 25, 'and its profile is untouched');
  table.closeTable('test over', { recap: 'test over' });
});

// ── The routes ──────────────────────────────────────────────────────────────

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then((r) => r.json());

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-fridge1-'));
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

test('FRIDGE-1: GET /api/fridge and POST /api/fridge/stock', async (t) => {
  await withServer(async (base) => {
    const store = await import('./store.js');
    store.saveWallet('u1', { ownerId: 'u1', balance: 1_000, ledger: [] });
    store.saveProfile('u1', {
      userId: 'u1', chat: [],
      agents: [{
        id: 'him', name: 'Steaming', status: 'idle', activeTableId: null,
        strategy: 'You are a poker player.', style: 'Balanced', risk: 'Medium',
        bankroll: 3_000,
        pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
        mood: { state: 'tilted', heat: 80, losingRun: 3 },
        stats: { handsPlayed: 200, handsWon: 80 },
        profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
      }],
    });

    await t.test('an empty fridge reads as zeroes, not as an error', async () => {
      assert.deepEqual(await getJson(`${base}/api/fridge?userId=u1`), fridgeProjection({}));
    });

    await t.test('stocking moves money out of the wallet and beer into the fridge', async () => {
      const res = await postJson(`${base}/api/fridge/stock?userId=u1`, { userId: 'u1', item: 'beer', qty: 3 });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.spent, 600);
      assert.equal(body.qty, 3);
      assert.equal(body.fridge.beer, 3);
      assert.equal(body.wallet.balance, 400);

      const wallet = store.loadWallet('u1');
      assert.equal(wallet.balance, 400, 'and it survives a restart');
      assert.equal(wallet.fridge.beer, 3);
      assert.ok(wallet.ledger.some((e) => e.type === 'item' && e.amount === -600),
        'one line in the wallet history for one spend');
    });

    await t.test('what it cannot cover, it does not buy', async () => {
      const res = await postJson(`${base}/api/fridge/stock?userId=u1`, { userId: 'u1', item: 'beer', qty: 6 });
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.cost, 1_200);
      assert.equal(store.loadWallet('u1').balance, 400, 'nothing moved');
      assert.equal(store.loadWallet('u1').fridge.beer, 3);
    });

    await t.test('a shelf nobody has heard of is a 400, not a new shelf', async () => {
      const res = await postJson(`${base}/api/fridge/stock?userId=u1`, { userId: 'u1', item: 'caviar', qty: 1 });
      assert.equal(res.status, 400);
      assert.deepEqual(Object.keys(store.loadWallet('u1').fridge).sort(), ['beer', 'snack']);
    });

    await t.test('giving him a beer takes one out and marks his next session', async () => {
      const res = await postJson(`${base}/api/agents/him/give?userId=u1`, { userId: 'u1', item: 'beer' });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.given, 'beer');
      assert.equal(body.spent, 0, 'the fridge was paid for already');
      assert.equal(body.drinking, true);
      assert.equal(body.mood.heat, 65, 'a beer is 15 off the heat');
      assert.equal(store.loadWallet('u1').fridge.beer, 2);
      assert.equal(store.loadWallet('u1').balance, 400, 'and no second spend');

      const { _agentRecordForTests, takeDrinkForSession } = await import('./agentProfiles.js');
      assert.equal(_agentRecordForTests('him', 'u1').drinkPending, true);
      assert.equal(takeDrinkForSession('him', 'u1'), true, 'the next seat spends it');
      assert.equal(takeDrinkForSession('him', 'u1'), false, 'and the one after that does not');
    });

    await t.test('an empty shelf answers with the door to open, and takes nothing', async () => {
      const wallet = store.loadWallet('u1');
      // Drink the rest by hand so the shelf is genuinely empty.
      const res1 = await postJson(`${base}/api/agents/him/give?userId=u1`, { userId: 'u1', item: 'snack' });
      const body1 = await res1.json();
      assert.equal(res1.status, 409, JSON.stringify(body1));
      assert.equal(body1.outOfStock, true);
      assert.equal(body1.needs, 'stock');
      assert.equal(body1.item, 'snack');
      assert.equal(body1.price, 100);
      assert.equal(store.loadWallet('u1').balance, wallet.balance, 'and it bought nothing to fix it');
    });

    await t.test('the seat he takes next is the one that pays for it', async () => {
      // Stock one more and hand it to him, so there is a drink pending, then
      // seat him at a real table and read what the seat is actually playing
      // with. This is the half that cannot be tested with literals: the
      // penalty is applied at the seat and never written to his record.
      await postJson(`${base}/api/fridge/stock?userId=u1`, { userId: 'u1', item: 'beer', qty: 1 });
      const given = await (await postJson(`${base}/api/agents/him/give?userId=u1`, { userId: 'u1', item: 'beer' })).json();
      assert.equal(given.drinking, true, JSON.stringify(given));

      const { _agentRecordForTests, getAgentAttributes } = await import('./agentProfiles.js');
      const record = _agentRecordForTests('him', 'u1');
      // Through the accessor, not the raw record: an agent born before ATTR-1
      // has his six backfilled the first time anybody asks for them, and the
      // table asks through exactly this door.
      const storedDiscipline = getAgentAttributes('him', 'u1').attrs.DISCIPLINE;
      const storedBluff = record.profile?.bluffFreq ?? null;

      const table = new Table({ tableId: 'fridge-drunk', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
      const seat = table.seatAI({
        displayName: record.name, strategy: record.strategy ?? '',
        agentId: 'him', userId: 'u1', agentProfile: record.profile, buyIn: 1_000,
      });
      assert.equal(table.seatDrinking[seat], true, 'the seat knows he has had one');
      assert.equal(table.agentProfiles[seat].bluffFreq, storedBluff + DRINK_BLUFF_BONUS,
        'he bluffs 10 points more often tonight');
      const attrs = table._seatAttrs(seat);
      assert.equal(attrs.DISCIPLINE, Math.max(0, storedDiscipline - DRINK_DISCIPLINE_PENALTY),
        'and is 5 less careful with it');

      // None of that is in his record. Tomorrow he is himself again.
      assert.equal(getAgentAttributes('him', 'u1').attrs.DISCIPLINE, storedDiscipline);
      assert.equal(_agentRecordForTests('him', 'u1').profile.bluffFreq, storedBluff);
      assert.equal(_agentRecordForTests('him', 'u1').drinkPending, false, 'and the beer is spent');

      const sober = new Table({ tableId: 'fridge-sober', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
      const seat2 = sober.seatAI({
        displayName: record.name, strategy: '', agentId: 'him', userId: 'u1',
        agentProfile: record.profile, buyIn: 1_000,
      });
      assert.equal(sober.seatDrinking[seat2], false, 'one beer, one session');
      assert.equal(sober.agentProfiles[seat2].bluffFreq, storedBluff);

      table.closeTable('test over', { recap: 'test over' });
      sober.closeTable('test over', { recap: 'test over' });
    });

    await t.test('somebody else\'s fridge is nobody else\'s business', async () => {
      // With no bot token configured every caller is the owner (the documented
      // local-dev posture), so what is asserted here is the SHAPE: the routes
      // are behind the same ownership check /api/wallet is.
      const res = await getJson(`${base}/api/fridge?userId=u2`);
      assert.deepEqual(res, fridgeProjection({}), 'a different owner has a different fridge');
    });
  });
});
