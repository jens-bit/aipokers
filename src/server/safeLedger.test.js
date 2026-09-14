// src/server/safeLedger.test.js — MONEY-1 job 4
//
// THE SAFE HAS TO EXPLAIN ITSELF.
//
// Jens's playtest: "nothing visibly leaves the safe when an agent buys in", and
// "the way you earn money looks wrong too". Both were one omission. The safe
// renders `walletProjection().ledger`, which was the WALLET's ledger and only
// that — fund, refill, collect, seed, item. A buy-in and a cash-out are written
// to the POCKET's ledger and to no other (debitBuyIn / creditCashOut), so the
// two events that move the most money in this product appeared on no screen.
//
// walletProjection now merges them into the list it hands the sheet. What is
// asserted here is that it is a VIEW and not a second ledger: nothing is
// written, the stored wallet ledger still explains the safe balance (which is
// what scripts/audit-chips.js reconciles against), and no event is drawn twice.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  walletProjection, emptyWallet, emptyPocket,
  fund, collect, debitBuyIn, creditCashOut, appendEntry,
} from './wallet.js';

function household() {
  const wallet = emptyWallet('u1');
  wallet.balance = 10_000;
  const hero = { id: 'a1', name: 'Balance', pocket: emptyPocket({ mode: 'auto', cap: 2_000 }) };
  const other = { id: 'a2', name: 'Granite', pocket: emptyPocket({ mode: 'auto', cap: 2_000 }) };
  hero.pocket.agentId = 'a1';
  other.pocket.agentId = 'a2';
  return { wallet, agents: [hero, other] };
}

test('MONEY-1: a buy-in and a cash-out reach the safe, named and signed', () => {
  const { wallet, agents } = household();
  const [hero] = agents;

  fund(wallet, hero.pocket, { amount: 2_000, mode: 'auto', cap: 2_000 });
  debitBuyIn(hero.pocket, 2_000, 't-1');
  creditCashOut(hero.pocket, 3_400, 't-1');

  const ledger = walletProjection(wallet, agents).ledger;
  const types = ledger.map((e) => e.type);
  assert.ok(types.includes('buyin'), 'the buy-in is on the record the owner reads');
  assert.ok(types.includes('cashout'), 'and so is what came back');

  const buyin = ledger.find((e) => e.type === 'buyin');
  assert.equal(buyin.amount, -2_000, 'out, and signed as out');
  assert.equal(buyin.agentId, 'a1', 'and attributed, so the sheet can say his name');

  const cashout = ledger.find((e) => e.type === 'cashout');
  assert.equal(cashout.amount, 3_400);
  assert.equal(cashout.agentId, 'a1');

  // 3,400 back against 2,000 out: the night is a sentence made of two lines,
  // which is what "show me how I earn money" actually asks for.
  assert.equal(cashout.amount + buyin.amount, 1_400);
});

test('MONEY-1: each agent keeps his own name on his own lines', () => {
  const { wallet, agents } = household();
  const [hero, other] = agents;
  fund(wallet, hero.pocket, { amount: 2_000 });
  fund(wallet, other.pocket, { amount: 2_000 });
  debitBuyIn(hero.pocket, 2_000, 't-1');
  debitBuyIn(other.pocket, 2_000, 't-2');

  const ledger = walletProjection(wallet, agents).ledger;
  const buyins = ledger.filter((e) => e.type === 'buyin');
  assert.equal(buyins.length, 2);
  assert.deepEqual(buyins.map((e) => e.agentId).sort(), ['a1', 'a2']);
});

test('MONEY-1: it is a view — nothing is written, and the books still balance', () => {
  const { wallet, agents } = household();
  const [hero] = agents;
  fund(wallet, hero.pocket, { amount: 2_000 });
  debitBuyIn(hero.pocket, 2_000, 't-1');

  const storedBefore = JSON.stringify(wallet.ledger);
  const pocketBefore = JSON.stringify(hero.pocket.ledger);
  walletProjection(wallet, agents);
  walletProjection(wallet, agents);
  assert.equal(JSON.stringify(wallet.ledger), storedBefore, 'the wallet ledger is untouched');
  assert.equal(JSON.stringify(hero.pocket.ledger), pocketBefore, 'and so is the pocket');

  // The stored wallet ledger still sums to the safe balance, which is the
  // invariant scripts/audit-chips.js reads. A merged list written back would
  // have broken it.
  const walletSum = wallet.ledger.reduce((n, e) => n + (Number(e.amount) || 0), 0);
  assert.equal(wallet.balance, 10_000 + walletSum);
});

test('MONEY-1: a transfer is drawn once, not once per side', () => {
  const { wallet, agents } = household();
  const [hero] = agents;
  // fund writes BOTH sides: -2,000 on the wallet, +2,000 on the pocket. Only
  // the wallet's may reach the sheet, or one top-up reads as two events that
  // cancel out.
  fund(wallet, hero.pocket, { amount: 2_000 });
  collect(wallet, hero.pocket, { all: true });

  const ledger = walletProjection(wallet, agents).ledger;
  assert.equal(ledger.filter((e) => e.type === 'fund').length, 1);
  assert.equal(ledger.filter((e) => e.type === 'collect').length, 1);
});

test('MONEY-1: newest first, across both sources', () => {
  const { wallet, agents } = household();
  const [hero] = agents;
  wallet.ledger = appendEntry(wallet.ledger, { type: 'fund', amount: -2_000, agentId: 'a1', ts: 1_000 });
  hero.pocket.ledger = appendEntry(hero.pocket.ledger, { type: 'buyin', amount: -2_000, tableId: 't', ts: 2_000 });
  wallet.ledger = appendEntry(wallet.ledger, { type: 'item', amount: -60, agentId: null, ts: 3_000 });
  // appendEntry stamps its own ts, so pin them to make the ordering the subject.
  wallet.ledger[0].ts = 1_000;
  hero.pocket.ledger[0].ts = 2_000;
  wallet.ledger[1].ts = 3_000;

  const ledger = walletProjection(wallet, agents).ledger;
  assert.deepEqual(ledger.map((e) => e.type), ['item', 'buyin', 'fund']);
});

test('MONEY-1: the list is capped, and the cap keeps the newest', () => {
  const { wallet, agents } = household();
  const [hero] = agents;
  for (let i = 0; i < 60; i++) {
    hero.pocket.ledger = appendEntry(hero.pocket.ledger, { type: 'buyin', amount: -2_000, tableId: `t-${i}` });
    hero.pocket.ledger.at(-1).ts = 1_000 + i;
  }
  const ledger = walletProjection(wallet, agents).ledger;
  assert.equal(ledger.length, 40, 'the sheet pages twelve at a time and can scroll to forty');
  assert.equal(ledger[0].tableId, 't-59', 'newest first');
});

test('a wallet with no agents is exactly what it was', () => {
  const wallet = emptyWallet('u1');
  wallet.ledger = appendEntry(wallet.ledger, { type: 'seed', amount: 8_000, agentId: null });
  const projection = walletProjection(wallet, []);
  assert.equal(projection.ledger.length, 1);
  assert.equal(projection.ledger[0].type, 'seed');
});
