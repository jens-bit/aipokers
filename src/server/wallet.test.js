// src/server/wallet.test.js — WALLET-1
//
// The money rules, offline. No server, no database, no model calls: wallet.js
// is deliberately pure so the one thing that must never be wrong — chips are
// neither created nor destroyed — can be asserted directly.
//
// The store-level seeding migration is exercised at the end against a fixture
// in today's data shape (agents carrying `bankroll` + `ledger`, no pocket).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  POCKET_FLOAT, ENTRY_BUYIN, STAKES, MODES,
  emptyWallet, emptyPocket, ensurePocket,
  stakesFor, isBroke, canAffordTable, buyInFor,
  fund, collect, autoRefill, debitBuyIn, creditCashOut, floatFor,
  seedOwner, walletProjection, pocketProjection,
  collectMoment, brokeMoment,
} from './wallet.js';

import { loadAgentStore, loadWallet, stakedTotal, openStore, _closeForTests } from './store.js';

// Total chips visible anywhere in a wallet+pockets pair.
const totalChips = (wallet, agents) =>
  wallet.balance + agents.reduce((n, a) => n + (a.pocket?.balance ?? 0), 0);

// ── The ladder ───────────────────────────────────────────────────────────────

test('the ladder is the three documented rungs, ascending', () => {
  assert.deepEqual(STAKES.map((s) => [s.smallBlind, s.bigBlind]), [[10, 20], [25, 50], [50, 100]]);
  assert.deepEqual(STAKES.map((s) => s.buyIn), [2_000, 5_000, 10_000]);
  assert.equal(ENTRY_BUYIN, 2_000);
});

test('an agent plays the highest rung his pocket covers', () => {
  assert.equal(stakesFor(0), null);
  assert.equal(stakesFor(1_999), null);
  assert.equal(stakesFor(2_000).label, '$10/$20');
  assert.equal(stakesFor(4_999).label, '$10/$20');
  assert.equal(stakesFor(5_000).label, '$25/$50');
  assert.equal(stakesFor(9_999).label, '$25/$50');
  assert.equal(stakesFor(10_000).label, '$50/$100');
  assert.equal(stakesFor(1_000_000).label, '$50/$100', 'the top rung is the ceiling');
});

test('broke is a pocket below one buy-in at the entry rung', () => {
  assert.equal(isBroke(0), true);
  assert.equal(isBroke(1_999), true);
  assert.equal(isBroke(2_000), false);
});

test('an agent may only join a table whose buy-in his pocket covers', () => {
  assert.equal(canAffordTable(2_000, 20), true);
  assert.equal(canAffordTable(2_000, 50), false, 'a $25/$50 table needs 5000');
  assert.equal(canAffordTable(5_000, 50), true);
  assert.equal(buyInFor(100), 10_000);
});

// ── Funding ──────────────────────────────────────────────────────────────────

test('funding moves chips wallet → pocket and conserves the total', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const agent = { id: 'a1', pocket: emptyPocket() };
  const before = totalChips(wallet, [agent]);

  const r = fund(wallet, agent.pocket, { mode: 'allowance', amount: 3_000, cap: 5_000 });
  assert.equal(r.ok, true);
  assert.equal(r.moved, 3_000);
  assert.equal(wallet.balance, 7_000);
  assert.equal(agent.pocket.balance, 3_000);
  assert.equal(agent.pocket.mode, 'allowance');
  assert.equal(agent.pocket.cap, 5_000);
  assert.equal(totalChips(wallet, [agent]), before, 'no chips created or destroyed');
});

test('funding more than the wallet holds is refused outright', () => {
  const wallet = emptyWallet('o'); wallet.balance = 100;
  const pocket = emptyPocket();
  const r = fund(wallet, pocket, { mode: 'topup', amount: 500 });
  assert.equal(r.ok, false);
  assert.equal(r.moved, 0);
  assert.equal(wallet.balance, 100, 'wallet untouched');
  assert.equal(pocket.balance, 0, 'pocket untouched');
});

test('an unknown mode is refused and changes nothing', () => {
  const wallet = emptyWallet('o'); wallet.balance = 100;
  const pocket = emptyPocket();
  const r = fund(wallet, pocket, { mode: 'gamble', amount: 50 });
  assert.equal(r.ok, false);
  assert.equal(wallet.balance, 100);
  assert.equal(pocket.mode, 'topup');
});

test('changing mode with no money is a valid call — cutting him off', () => {
  const wallet = emptyWallet('o'); wallet.balance = 500;
  const pocket = emptyPocket({ mode: 'auto', cap: 2_000, balance: 900 });
  const r = fund(wallet, pocket, { mode: 'cut' });
  assert.equal(r.ok, true);
  assert.equal(r.moved, 0);
  assert.equal(pocket.mode, 'cut');
  assert.equal(pocket.cap, null);
  assert.equal(pocket.balance, 900, 'he keeps the roll he already has — nothing is taken away');
});

test('every documented mode is accepted', () => {
  for (const mode of MODES) {
    const wallet = emptyWallet('o'); wallet.balance = 1_000;
    const pocket = emptyPocket();
    assert.equal(fund(wallet, pocket, { mode, amount: 0 }).ok, true, mode);
  }
});

// ── Collect ──────────────────────────────────────────────────────────────────

test('collect moves the surplus pocket → wallet and leaves the float', () => {
  const wallet = emptyWallet('o'); wallet.balance = 1_000;
  const agent = { id: 'a1', pocket: emptyPocket({ mode: 'auto', cap: 3_000, balance: 6_400 }) };
  const before = totalChips(wallet, [agent]);

  const r = collect(wallet, agent.pocket);
  assert.equal(r.ok, true);
  assert.equal(r.moved, 3_400, '6400 down to the 3000 float');
  assert.equal(agent.pocket.balance, 3_000);
  assert.equal(wallet.balance, 4_400);
  assert.equal(totalChips(wallet, [agent]), before);
});

test('collect never leaves him unable to sit down again', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'topup', balance: 2_400 });
  collect(wallet, pocket);
  assert.ok(pocket.balance >= ENTRY_BUYIN, `left ${pocket.balance}, needs ${ENTRY_BUYIN}`);
});

test('collect can take everything when the owner asks for it', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ balance: 2_400 });
  const r = collect(wallet, pocket, { leaveFloat: false });
  assert.equal(r.moved, 2_400);
  assert.equal(pocket.balance, 0);
  assert.equal(wallet.balance, 2_400);
});

test('collect with nothing above the float is refused, not a zero transfer', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ balance: 500 });
  const r = collect(wallet, pocket);
  assert.equal(r.ok, false);
  assert.equal(r.moved, 0);
  assert.equal(pocket.balance, 500);
});

// ── Auto-refill ──────────────────────────────────────────────────────────────

test('auto refills a broke pocket from the wallet, up to the cap', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const agent = { id: 'a1', pocket: emptyPocket({ mode: 'auto', cap: 2_000, balance: 0 }) };
  const before = totalChips(wallet, [agent]);

  const r = autoRefill(wallet, agent.pocket);
  assert.equal(r.ok, true);
  assert.equal(r.moved, 2_000);
  assert.equal(agent.pocket.balance, 2_000);
  assert.equal(wallet.balance, 8_000);
  assert.equal(totalChips(wallet, [agent]), before);
  assert.equal(isBroke(agent.pocket.balance), false, 'he can sit down again');
});

test('allowance and top-up do NOT refill — that is the whole point of them', () => {
  for (const mode of ['topup', 'allowance', 'cut']) {
    const wallet = emptyWallet('o'); wallet.balance = 10_000;
    const pocket = emptyPocket({ mode, cap: 5_000, balance: 0 });
    const r = autoRefill(wallet, pocket);
    assert.equal(r.ok, false, mode);
    assert.equal(pocket.balance, 0, `${mode} must stay broke`);
    assert.equal(wallet.balance, 10_000, `${mode} must not touch the wallet`);
  }
});

test('auto with an empty wallet leaves him broke rather than going negative', () => {
  const wallet = emptyWallet('o'); wallet.balance = 0;
  const pocket = emptyPocket({ mode: 'auto', cap: 2_000, balance: 0 });
  const r = autoRefill(wallet, pocket);
  assert.equal(r.ok, false);
  assert.equal(wallet.balance, 0);
  assert.equal(pocket.balance, 0);
});

test('auto refills only the shortfall when the wallet is thin', () => {
  const wallet = emptyWallet('o'); wallet.balance = 700;
  const agent = { id: 'a', pocket: emptyPocket({ mode: 'auto', cap: 2_000, balance: 100 }) };
  const before = totalChips(wallet, [agent]);
  const r = autoRefill(wallet, agent.pocket);
  assert.equal(r.moved, 700);
  assert.equal(agent.pocket.balance, 800);
  assert.equal(wallet.balance, 0);
  assert.equal(totalChips(wallet, [agent]), before);
});

// ── Table money ──────────────────────────────────────────────────────────────

test('buy-in leaves the pocket and the whole final stack comes back', () => {
  const pocket = emptyPocket({ balance: 5_000 });
  assert.equal(debitBuyIn(pocket, 2_000, 't1').ok, true);
  assert.equal(pocket.balance, 3_000);
  creditCashOut(pocket, 2_600, 't1');           // walked away up 600
  assert.equal(pocket.balance, 5_600);
});

test('a buy-in the pocket cannot cover is refused', () => {
  const pocket = emptyPocket({ balance: 500 });
  const r = debitBuyIn(pocket, 2_000);
  assert.equal(r.ok, false);
  assert.equal(pocket.balance, 500);
});

// ── Projections ──────────────────────────────────────────────────────────────

test('walletProjection matches the shape the design ref reads', () => {
  const wallet = emptyWallet('o'); wallet.balance = 2_340;
  const agents = [
    { status: 'playing', pocket: emptyPocket({ balance: 640 }) },
    { status: 'idle', activeTableId: null, pocket: emptyPocket({ balance: 510 }) },
  ];
  const p = walletProjection(wallet, agents, { sessionNet: 486 });
  assert.deepEqual(Object.keys(p).sort(), ['balance', 'ledger', 'playing', 'session', 'staked']);
  assert.equal(p.balance, 2_340);
  assert.equal(p.staked, 1_150);
  assert.equal(p.session, 486);
  assert.deepEqual(p.playing, { live: 1, total: 2 });
});

test('pocketProjection carries money and stakes only — never an attribute', () => {
  const pocket = emptyPocket({ mode: 'auto', cap: 3_000, balance: 6_400 });
  const p = pocketProjection(pocket);
  assert.equal(p.balance, 6_400);
  assert.equal(p.mode, 'auto');
  assert.equal(p.cap, 3_000);
  assert.equal(p.have, 6_400);
  assert.deepEqual(p.stakes, { smallBlind: 25, bigBlind: 50, label: '$25/$50' });
  assert.equal(p.broke, false);
  assert.equal(p.collectable, 3_400);
  for (const forbidden of ['attrs', 'mood', 'band', 'strategy', 'focus']) {
    assert.equal(forbidden in p, false, `pocket projection must not carry ${forbidden}`);
  }
});

test('a broke pocket projects broke with no stakes', () => {
  const p = pocketProjection(emptyPocket({ balance: 0 }));
  assert.equal(p.broke, true);
  assert.equal(p.stakes, null);
  assert.equal(p.collectable, 0);
});

test('pocket pnl counts what he was given against what he holds and gave back', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const pocket = emptyPocket();
  fund(wallet, pocket, { mode: 'topup', amount: 3_000 });
  creditCashOut(pocket, 340);                    // won 340 at the table
  assert.equal(pocketProjection(pocket).pnl, 340);
  collect(wallet, pocket, { leaveFloat: false });
  assert.equal(pocketProjection(pocket).pnl, 340, 'collecting is a transfer, not a loss');
});

// ── Voice ────────────────────────────────────────────────────────────────────

test('the collect and broke lines are in his voice and carry no owner-guilt', () => {
  const guilt = /you (never|forgot|left|abandoned)|why did you|please come|miss you|your fault/i;
  for (const n of [0, 1, 2, 3, 4]) {
    const c = collectMoment({ moved: 340 * (n + 1), left: 300, agentName: `A${n}` });
    const b = brokeMoment({ mode: MODES[n % MODES.length], agentName: `A${n}` });
    for (const line of [c, b]) {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0 && line.length < 200);
      assert.equal(guilt.test(line), false, `owner-guilt in: ${line}`);
    }
  }
});

test('the same agent gets a stable line rather than a fresh roll each render', () => {
  const a = brokeMoment({ mode: 'topup', agentName: 'Value Bot' });
  const b = brokeMoment({ mode: 'topup', agentName: 'Value Bot' });
  assert.equal(a, b);
});

// ── SEED-1: the migration, on today's data shape ─────────────────────────────

test('SEED-1: seeding conserves every chip on a fixture of today\'s shape', () => {
  // Exactly what data/agents.json holds today: bankroll + ledger, no pocket.
  const profile = {
    userId: 'u_7b84me44mxup',
    chat: [],
    agents: [
      { id: 'a1', name: 'Loose Cannon', bankroll: 10_000, ledger: [{ ts: 1, type: 'grant', amount: 10_000 }] },
      { id: 'a2', name: 'Rock Solid',   bankroll: 14_300, ledger: [{ ts: 1, type: 'grant', amount: 10_000 }] },
      { id: 'a3', name: 'Short Stack',  bankroll: 900,    ledger: [] },
      { id: 'a4', name: 'Ancient',      ledger: [] },              // predates BNK-1: no bankroll at all
    ],
  };
  const totalBefore = profile.agents.reduce((n, a) => n + Math.max(0, a.bankroll ?? 0), 0);

  const { wallet, seeded, swept } = seedOwner(profile);

  assert.equal(seeded, 4);
  assert.equal(totalChips(wallet, profile.agents), totalBefore, 'not one chip created or destroyed');
  assert.equal(wallet.balance, swept);

  // The rule, verbatim: pocket = min(bankroll, POCKET_FLOAT), rest to wallet.
  assert.equal(profile.agents[0].pocket.balance, POCKET_FLOAT);
  assert.equal(profile.agents[1].pocket.balance, POCKET_FLOAT);
  assert.equal(profile.agents[2].pocket.balance, 900, 'a short agent keeps all of it');
  assert.equal(profile.agents[3].pocket.balance, 0, 'no bankroll means no chips, not a windfall');
  assert.equal(wallet.balance, (10_000 - 2_000) + (14_300 - 2_000) + 0 + 0);

  // Mode default reproduces the old runway rather than changing behaviour.
  for (const a of profile.agents) {
    assert.equal(a.pocket.mode, 'auto');
    assert.equal(a.pocket.cap, POCKET_FLOAT);
  }
});

test('SEED-1: seeding is idempotent — a second pass moves nothing', () => {
  const profile = {
    userId: 'o',
    agents: [{ id: 'a1', bankroll: 10_000 }],
  };
  const first = seedOwner(profile);
  const afterFirst = totalChips(first.wallet, profile.agents);

  const second = seedOwner(profile);
  assert.equal(second.seeded, 0, 'an agent that already has a pocket is left alone');
  assert.equal(second.swept, 0);
  assert.equal(second.wallet.balance, 0);
  assert.equal(profile.agents[0].pocket.balance, POCKET_FLOAT, 'pocket unchanged');
  assert.equal(afterFirst, 10_000);
});

test('SEED-1: a negative bankroll cannot mint chips', () => {
  const profile = { userId: 'o', agents: [{ id: 'a1', bankroll: -500 }] };
  const { wallet } = seedOwner(profile);
  assert.equal(wallet.balance, 0);
  assert.equal(profile.agents[0].pocket.balance, 0);
});

test('SEED-1: the runway is unchanged — same number of buy-ins as before', () => {
  // A 10 000 bankroll bought five 2 000 buy-ins. After seeding: 2 000 in the
  // pocket and 8 000 in the wallet, refilled 2 000 at a time. Same five.
  const profile = { userId: 'o', agents: [{ id: 'a1', bankroll: 10_000 }] };
  const { wallet } = seedOwner(profile);
  const pocket = profile.agents[0].pocket;

  let buyIns = 0;
  for (;;) {
    if (isBroke(pocket.balance)) {
      if (!autoRefill(wallet, pocket).ok) break;
    }
    if (!debitBuyIn(pocket, ENTRY_BUYIN).ok) break;
    buyIns++;                                    // he busts every one of them
    if (buyIns > 50) break;                      // guard, never reached
  }
  assert.equal(buyIns, 5, '10 000 chips is five 2 000 buy-ins, before and after');
});

// ── The store-level migration ────────────────────────────────────────────────

test('SEED-1 through the store: wallets appear and staked matches the pockets', () => {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wallet-'));
  _closeForTests();
  process.chdir(dir);
  try {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'agents.json'), JSON.stringify({
      o1: { userId: 'o1', chat: [], agents: [
        { id: 'a1', name: 'One', bankroll: 10_000 },
        { id: 'a2', name: 'Two', bankroll: 3_000 },
      ] },
      o2: { userId: 'o2', chat: [], agents: [{ id: 'b1', name: 'Solo', bankroll: 1_500 }] },
    }), 'utf8');

    openStore();

    const store = loadAgentStore();
    assert.equal(store.o1.agents[0].pocket.balance, 2_000);
    assert.equal(store.o1.agents[1].pocket.balance, 2_000);
    assert.equal(store.o2.agents[0].pocket.balance, 1_500);

    assert.equal(loadWallet('o1').balance, (10_000 - 2_000) + (3_000 - 2_000));
    assert.equal(loadWallet('o2').balance, 0);

    // The lifted column answers the "in pockets" tile without walking records.
    assert.equal(stakedTotal('o1'), 4_000);
    assert.equal(stakedTotal('o2'), 1_500);

    // Conservation across the whole store.
    const seeded = loadWallet('o1').balance + loadWallet('o2').balance + 4_000 + 1_500;
    assert.equal(seeded, 10_000 + 3_000 + 1_500);

    // Second boot changes nothing.
    _closeForTests();
    openStore();
    assert.equal(loadWallet('o1').balance, 9_000);
    assert.equal(stakedTotal('o1'), 4_000);
  } finally {
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('ensurePocket backfills without inventing chips', () => {
  const agent = { id: 'a1', bankroll: 9_000 };
  const p = ensurePocket(agent);
  assert.equal(p.balance, 0, 'backfill is not a grant — seeding is the only place money moves');
  assert.equal(p.mode, 'topup');
  ensurePocket(agent);
  assert.equal(agent.pocket.balance, 0, 'idempotent');
});

test('floatFor never drops below one buy-in', () => {
  assert.equal(floatFor({ cap: 0 }), ENTRY_BUYIN);
  assert.equal(floatFor({ cap: null }), POCKET_FLOAT);
  assert.equal(floatFor({ cap: 5_000 }), 5_000);
});
