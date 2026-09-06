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
  fund, collect, collectable, autoRefill, debitBuyIn, creditCashOut, floatFor,
  callIn, sweepRecall, modeForRequest,
  seedOwner, walletProjection, pocketProjection, benchCutSeat,
  collectMoment, callInMoment, brokeMoment,
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

// WALLET-7 replaces the old rule, which was "collect takes everything above
// the float". The float is the roll he is kept at, not a statement about whose
// money it is, and reading a balance above it as money to bring home is what
// made a $4,000 one-time top-up offer a Collect that took the top-up straight
// back out. The rule now: the WINNINGS are the owner's at any time; the
// PRINCIPAL comes home when he does.

test('collect moves the winnings pocket → wallet and leaves the principal', () => {
  const wallet = emptyWallet('o'); wallet.balance = 1_000;
  const agent = { id: 'a1', pocket: emptyPocket({ mode: 'auto', cap: 3_000, balance: 3_000 }) };
  debitBuyIn(agent.pocket, 3_000, 't1');
  creditCashOut(agent.pocket, 6_400, 't1');            // up 3 400
  const before = totalChips(wallet, [agent]);

  const r = collect(wallet, agent.pocket);
  assert.equal(r.ok, true);
  assert.equal(r.moved, 3_400, 'the 3400 he won, and not the 3000 he was staked');
  assert.equal(agent.pocket.balance, 3_000);
  assert.equal(wallet.balance, 4_400);
  assert.equal(totalChips(wallet, [agent]), before);
});

test('collect never takes the roll the owner staked out from under him', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'topup', balance: 2_400 });
  debitBuyIn(pocket, 2_000); creditCashOut(pocket, 2_400);     // up 400
  collect(wallet, pocket);
  assert.equal(pocket.balance, 2_400, 'the staked 2400 stayed; only the 400 he won left');
  assert.ok(pocket.balance >= ENTRY_BUYIN, `left ${pocket.balance}, needs ${ENTRY_BUYIN}`);
});

test('collect can take everything when the owner calls him in', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ balance: 2_400 });
  const r = collect(wallet, pocket, { all: true });
  assert.equal(r.moved, 2_400);
  assert.equal(pocket.balance, 0);
  assert.equal(wallet.balance, 2_400);
});

test('collect with nothing won is refused, not a zero transfer', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ balance: 500 });
  const r = collect(wallet, pocket);
  assert.equal(r.ok, false);
  assert.equal(r.moved, 0);
  assert.equal(pocket.balance, 500);
});

// WALLET-7 · the reported symptom, at the level the rule lives at.
test('WALLET-7: a pocket funded once and never played offers nothing to collect', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const pocket = emptyPocket({ mode: 'auto', cap: 2_000 });
  fund(wallet, pocket, { mode: 'auto', amount: 4_000, cap: 4_000 });

  assert.equal(pocketProjection(pocket).pnl, 0, 'a top-up is not a win');
  assert.equal(collectable(pocket), 0, 'and there is nothing of his to bring home');
  assert.equal(collect(wallet, pocket).ok, false);
  assert.equal(pocket.balance, 4_000, 'the roll the owner gave him stayed given');
});

test('WALLET-7: a losing pocket offers nothing to collect, however much it holds', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const pocket = emptyPocket({ mode: 'allowance', cap: 5_000 });
  fund(wallet, pocket, { mode: 'allowance', amount: 5_000, cap: 5_000 });
  debitBuyIn(pocket, 2_000); creditCashOut(pocket, 1_100);     // down 900
  assert.equal(collectable(pocket), 0);
  assert.equal(collect(wallet, pocket).ok, false);
});

test('WALLET-7: collecting the winnings banks them, so the same win is not collected twice', () => {
  const wallet = emptyWallet('o'); wallet.balance = 10_000;
  const pocket = emptyPocket({ mode: 'allowance', cap: 3_000 });
  fund(wallet, pocket, { mode: 'allowance', amount: 3_000, cap: 3_000 });
  debitBuyIn(pocket, 2_000); creditCashOut(pocket, 2_500);     // up 500

  assert.equal(collect(wallet, pocket).moved, 500);
  assert.equal(pocketProjection(pocket).pnl, 0, 'the win is home; it is no longer uncollected');
  assert.equal(collect(wallet, pocket).ok, false, 'and it cannot be collected a second time');
  assert.equal(pocket.balance, 3_000, 'the staked roll is untouched by either call');
});

test('WALLET-7: an explicit amount cannot reach past the winnings', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'allowance', cap: 3_000, balance: 3_000 });
  debitBuyIn(pocket, 2_000); creditCashOut(pocket, 2_400);     // up 400
  const r = collect(wallet, pocket, { amount: 3_000 });
  assert.equal(r.moved, 400, 'asking for more than he won takes what he won');
  assert.equal(pocket.balance, 3_000);
});

test('WALLET-7: a called-in pocket is collectable to the last chip', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'cut', balance: 4_000 });
  assert.equal(collectable(pocket), 4_000, 'he is not sitting down again, so none of it is his to keep');
  assert.equal(collect(wallet, pocket).moved, 4_000);
});

test('WALLET-7: sweeping the principal home does not read as a loss', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'cut', balance: 4_000 });
  collect(wallet, pocket, { all: true });
  assert.equal(pocketProjection(pocket).pnl, 0, 'a transfer is not a P&L event, in either direction');
});

// ── WALLET-7: the two verbs ──────────────────────────

test('WALLET-7: the two verbs map onto the four stored modes', () => {
  assert.equal(modeForRequest({ verb: 'give' }).mode, 'allowance');
  assert.equal(modeForRequest({ verb: 'give', refill: true }).mode, 'auto');
  assert.equal(modeForRequest({ verb: 'callin' }).mode, 'cut');
  assert.equal(modeForRequest({ verb: 'call-in' }).mode, 'cut');
});

test('WALLET-7: a one-time top-up folds into the allowance it always was', () => {
  // Two names for one thing — chips now, no refill — and the split is what made
  // the sheet ask four questions where there was one. Stored pockets keep the
  // mode they have; nothing is rewritten.
  assert.equal(modeForRequest({ mode: 'topup' }).mode, 'allowance');
  assert.equal(modeForRequest({ mode: 'topup', refill: true }).mode, 'auto');
  assert.ok(MODES.includes('topup'), 'the stored vocabulary is unchanged');
});

test('WALLET-7: the modes an older client still posts survive the round trip', () => {
  for (const [mode, expected] of [['allowance', 'allowance'], ['auto', 'auto'], ['cut', 'cut']]) {
    assert.equal(modeForRequest({ mode }).mode, expected, mode);
  }
});

test('WALLET-7: no mode at all leaves the mode alone', () => {
  const r = modeForRequest({ amount: 500 });
  assert.equal(r.ok, true);
  assert.equal(r.mode, undefined);
});

test('WALLET-7: an unknown verb is refused rather than guessed at', () => {
  assert.equal(modeForRequest({ verb: 'nonsense' }).ok, false);
  assert.equal(modeForRequest({ mode: 'bankrupt' }).ok, false);
});

test('WALLET-7: calling him in brings the pocket home and benches his seat', () => {
  const wallet = emptyWallet('o');
  const agent = { id: 'cannon', pocket: emptyPocket({ mode: 'auto', cap: 5_000, balance: 4_000 }) };
  const table = fakeTable(['cannon']);
  const before = totalChips(wallet, [agent]);

  const r = callIn(wallet, agent.pocket, { table, agentId: 'cannon', seated: true });
  assert.equal(r.moved, 4_000);
  assert.equal(r.benched, true);
  assert.deepEqual([...table.benchedAfterHand], [0], 'he finishes the hand he is in');
  assert.equal(table.foldedOut.size, 0);
  assert.equal(agent.pocket.mode, 'cut');
  assert.equal(agent.pocket.balance, 0);
  assert.equal(wallet.balance, 4_000);
  assert.equal(totalChips(wallet, [agent]), before, 'not a chip made or lost');
});

test('WALLET-7: calling in an agent at a table flags the chips still in front of him', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'auto', cap: 5_000, balance: 2_000 });
  debitBuyIn(pocket, 2_000, 't1');                     // his roll is on the table
  callIn(wallet, pocket, { table: fakeTable(['cannon']), agentId: 'cannon', seated: true });
  assert.equal(pocket.recall, true, 'the sweep has to remember them');

  // Still seated: the sweep waits rather than emptying a pocket mid-hand.
  assert.equal(sweepRecall(wallet, pocket, { seated: true }).ok, false);
  assert.equal(pocket.recall, true);

  // The session pays him back, and the next look at the wallet brings it home.
  creditCashOut(pocket, 2_600, 't1');
  const r = sweepRecall(wallet, pocket, { seated: false });
  assert.equal(r.moved, 2_600);
  assert.equal(pocket.balance, 0);
  assert.equal(pocket.recall, false, 'and it only happens once');
  assert.equal(sweepRecall(wallet, pocket, { seated: false }).ok, false);
});

test('WALLET-7: calling in an agent at the bar flags nothing to sweep', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'allowance', cap: 3_000, balance: 3_000 });
  callIn(wallet, pocket, { table: null, agentId: 'a1', seated: false });
  assert.equal(pocket.balance, 0);
  assert.equal(pocket.recall, false, 'nothing is out there — all of it came home in the one call');
});

test('WALLET-7: a called-in pocket with nothing in it is still a valid call', () => {
  const wallet = emptyWallet('o');
  const pocket = emptyPocket({ mode: 'auto', cap: 2_000, balance: 0 });
  const r = callIn(wallet, pocket, { seated: false });
  assert.equal(r.moved, 0);
  assert.equal(pocket.mode, 'cut', 'the decision stands whether or not money moved');
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
  // WALLET-7: he has won nothing, so nothing is collectable — a pocket bigger
  // than its float is a well-funded pocket, not a pile of winnings.
  assert.equal(p.collectable, 0);
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
  assert.equal(pocketProjection(pocket).pnl, 340, 'funding is a transfer; the win is the P&L');

  // WALLET-7: the pnl the row shows is the winnings still IN the pocket, so
  // taking them home takes them out of it. What it must never do is read the
  // principal coming home as a loss.
  collect(wallet, pocket, { all: true });
  assert.equal(pocketProjection(pocket).pnl, 0);
  assert.equal(pocket.balance, 0);
});

// ── Voice ────────────────────────────────────────────────────────────────────

test('the collect, call-in and broke lines are in his voice and carry no owner-guilt', () => {
  const guilt = /you (never|forgot|left|abandoned)|why did you|please come|miss you|your fault/i;
  for (const n of [0, 1, 2, 3, 4]) {
    const c = collectMoment({ moved: 340 * (n + 1), left: 300, agentName: `A${n}` });
    const b = brokeMoment({ mode: MODES[n % MODES.length], agentName: `A${n}` });
    // WALLET-7: called in is its own beat, and it is held to the same law.
    const i = callInMoment({ moved: 4_000 * (n + 1), agentName: `A${n}` });
    for (const line of [c, b, i]) {
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

// ── WALLET-1e: the collect receipt ───────────────────────────────────────────
// Boots the real routes on an ephemeral port. CollectCard takes
// { pocketBefore, float, collected, at }, so the response has to carry them or
// the card cannot draw the transfer without a second call.

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-collect-'));
  // Auth off: with neither configured the middleware allows all and isOwner is
  // true, which is the documented local-dev posture. Deleting them makes the
  // test independent of whatever the developer has exported.
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
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

test('WALLET-1e: POST /collect responds with the receipt CollectCard draws', async () => {
  await withServer(async (base) => {
    // Seed an agent straight into the store the routes read, with a winning
    // pocket to bring home.
    const store = await import('./store.js');
    store.saveProfile('u1', {
      userId: 'u1',
      chat: [],
      agents: [{
        id: 'a1', name: 'Balanced', status: 'idle', activeTableId: null,
        bankroll: 6_400,
        pocket: { balance: 6_400, mode: 'auto', cap: 3_000, realised: 3_400, ledger: [] },
      }],
    });

    const res = await postJson(`${base}/api/agents/a1/collect?userId=u1`, { userId: 'u1' });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));

    assert.equal(body.collected, 3_400, 'collected is what came home');
    assert.equal(body.float, 3_000, 'float is what he was left holding');
    assert.equal(typeof body.at, 'number', 'at is a timestamp');
    assert.ok(body.at > 0 && body.at <= Date.now() + 1_000);
    assert.equal(body.pocketBefore, 6_400, 'the $640 → $300 line needs the before');
    assert.equal(body.pocket.balance, 3_000);
    assert.equal(body.pocket.float, 3_000, 'the receipt and the row agree');
    assert.equal(body.wallet.balance, 3_400);
  });
});

test('WALLET-1e: collecting nothing is a 400, not an empty receipt', async () => {
  await withServer(async (base) => {
    const store = await import('./store.js');
    store.saveProfile('u1', {
      userId: 'u1', chat: [],
      agents: [{
        id: 'a1', name: 'Flat', status: 'idle', activeTableId: null, bankroll: 2_000,
        pocket: { balance: 2_000, mode: 'auto', cap: 3_000, realised: 0, ledger: [] },
      }],
    });
    const res = await postJson(`${base}/api/agents/a1/collect?userId=u1`, { userId: 'u1' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /nothing to collect/);
  });
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

// ── Broke presence ───────────────────────────────────────────────────────────
// The rule this encodes was wrong on first write: every agent read as broke
// between sessions, because a 2 000 pocket minus a 2 000 buy-in plus a losing
// session is under the next buy-in. An agent on auto-refill with money in the
// wallet is one automatic collection away and the deploy path makes it before
// the gate — drawing him at the bar would be a lie. verify-server-life.js
// caught it.
test('WALLET-1: auto-refill with a funded wallet is not broke', async () => {
  const { presentAgent } = await import('./agentProfiles.js');
  const agent = {
    id: 'a1', name: 'Auto', status: 'idle', activeTableId: null,
    pocket: emptyPocket({ mode: 'auto', cap: 2_000, balance: 1_800 }),
  };
  assert.equal(presentAgent(agent, { walletBalance: 8_000 }).presence, 'resting');
});

test('WALLET-1: broke is for the agent with no way back without the owner', async () => {
  const { presentAgent } = await import('./agentProfiles.js');
  const broke = (over) => presentAgent({
    id: 'a', name: 'A', status: 'idle', activeTableId: null,
    pocket: emptyPocket({ balance: 1_800, ...over }),
  }, { walletBalance: over.wallet ?? 8_000 }).presence;

  assert.equal(broke({ mode: 'cut' }), 'broke', 'cut off');
  assert.equal(broke({ mode: 'allowance', cap: 5_000 }), 'broke', 'allowance ran out');
  assert.equal(broke({ mode: 'topup' }), 'broke', 'one-time money spent');
  assert.equal(broke({ mode: 'auto', cap: 2_000, wallet: 0 }), 'broke', 'auto, but the wallet is empty too');
});

test('WALLET-1: a solvent pocket is never broke whatever the mode', async () => {
  const { presentAgent } = await import('./agentProfiles.js');
  for (const mode of MODES) {
    const p = presentAgent({
      id: 'a', name: 'A', status: 'idle', activeTableId: null,
      pocket: emptyPocket({ mode, balance: 6_000 }),
    }, { walletBalance: 0 }).presence;
    assert.equal(p, 'resting', mode);
  }
});

// ── WALLET-1e: float ─────────────────────────────────────────────────────────

test('WALLET-1e: float is the committed roll for auto and allowance', () => {
  assert.equal(floatFor(emptyPocket({ mode: 'auto', cap: 5_000 })), 5_000);
  assert.equal(floatFor(emptyPocket({ mode: 'allowance', cap: 3_000 })), 3_000);
  assert.equal(floatFor(emptyPocket({ mode: 'auto', cap: null })), POCKET_FLOAT, 'no cap falls back to the default float');
});

test('WALLET-1e: float is one buy-in at his rung for topup and cut', () => {
  for (const mode of ['topup', 'cut']) {
    assert.equal(floatFor(emptyPocket({ mode, balance: 2_400 })), 2_000, `${mode} @ $10/$20`);
    assert.equal(floatFor(emptyPocket({ mode, balance: 6_000 })), 5_000, `${mode} @ $25/$50`);
    assert.equal(floatFor(emptyPocket({ mode, balance: 12_000 })), 10_000, `${mode} @ $50/$100`);
  }
});

test('WALLET-1e: float never drops below one buy-in at the entry rung', () => {
  for (const mode of MODES) {
    for (const cap of [null, 0, 1, 500]) {
      const f = floatFor(emptyPocket({ mode, cap, balance: 0 }));
      assert.ok(f >= ENTRY_BUYIN, `${mode}/cap ${cap} gave ${f} — a float he cannot sit down on is a bust`);
    }
  }
});

// WALLET-7 — this asserted that collect stopped at the float. It no longer
// does: the float is the roll the refill toggle tops him back up to, and it was
// never an answer to "whose money is this". Collect stops at the winnings, and
// what it leaves behind is the principal.
test('WALLET-7: what collect leaves behind is the roll the owner staked', () => {
  for (const mode of ['auto', 'allowance', 'topup']) {
    const pocket = emptyPocket({ mode, cap: 5_000, balance: 5_000 });
    debitBuyIn(pocket, 5_000, 't1');
    creditCashOut(pocket, 9_000, 't1');                 // up 4 000
    collect(emptyWallet('o'), pocket);
    assert.equal(pocket.balance, 5_000, `${mode} left ${pocket.balance}, he was staked 5000`);
  }
  // Called in is the exception, and the whole point of the second verb.
  const cut = emptyPocket({ mode: 'cut', balance: 9_000 });
  collect(emptyWallet('o'), cut);
  assert.equal(cut.balance, 0);
});

test('WALLET-1e/7: float is still the roll auto refills him back up to', () => {
  // Unchanged, and still what the profile line reads ("refills to $3,000").
  for (const pocket of [
    emptyPocket({ mode: 'auto', cap: 3_000, balance: 9_000 }),
    emptyPocket({ mode: 'allowance', cap: 5_000, balance: 9_000 }),
  ]) {
    assert.equal(pocketProjection(pocket).float, floatFor(pocket));
  }
});

test('WALLET-1e: the projection carries float', () => {
  const pocket = emptyPocket({ mode: 'auto', cap: 3_000, balance: 3_000 });
  assert.equal(pocketProjection(pocket).float, 3_000);
  assert.equal(pocketProjection(pocket).collectable, 0, 'a full pocket he has not played is not winnings');

  // WALLET-7: collectable is the winnings, and it is what the Collect button
  // would actually take.
  debitBuyIn(pocket, 3_000, 't1');
  creditCashOut(pocket, 6_400, 't1');
  assert.equal(pocketProjection(pocket).collectable, 3_400);
  assert.equal(pocketProjection(pocket).float, 3_000, 'the float did not move because he won');
});

// ── WALLET-1e: pnl ───────────────────────────────────────────────────────────

test('WALLET-1e: pnl is realised table P&L, both signs', () => {
  const wallet = emptyWallet('o'); wallet.balance = 20_000;
  const pocket = emptyPocket({ mode: 'auto', cap: 5_000 });

  fund(wallet, pocket, { mode: 'auto', amount: 5_000, cap: 5_000 });
  assert.equal(pocketProjection(pocket).pnl, 0, 'funding is a transfer, not a win');

  debitBuyIn(pocket, 2_000, 't1');
  creditCashOut(pocket, 3_400, 't1');                 // up 1 400
  assert.equal(pocketProjection(pocket).pnl, 1_400);

  debitBuyIn(pocket, 2_000, 't2');
  creditCashOut(pocket, 0, 't2');                     // felted, down 2 000
  assert.equal(pocketProjection(pocket).pnl, -600, 'a losing night can take it negative');
});

// WALLET-7 — this asserted that collecting left pnl alone. Under the old rule
// that was right: a collect took a slice off the top and said nothing about
// winning. Under the new one pnl IS the uncollected winnings — the number the
// Collect button offers to hand over — so leaving it untouched would offer the
// same $3,400 forever and eat the staked roll one press at a time.
test('WALLET-7: collecting the winnings takes them out of the uncollected P&L', () => {
  const wallet = emptyWallet('o'); wallet.balance = 20_000;
  const pocket = emptyPocket({ mode: 'auto', cap: 3_000 });
  fund(wallet, pocket, { mode: 'auto', amount: 3_000, cap: 3_000 });
  debitBuyIn(pocket, 2_000); creditCashOut(pocket, 5_400);
  assert.equal(pocketProjection(pocket).pnl, 3_400);

  collect(wallet, pocket);
  assert.equal(pocketProjection(pocket).pnl, 0, 'what is home is no longer waiting to be collected');
  assert.equal(pocket.balance, 3_000, 'and the roll he plays with is exactly what it was');
  assert.equal(wallet.balance, 20_400, 'the wallet is up by the winnings, not by the roll');
});

test('WALLET-1e: pnl survives the ledger being capped', () => {
  const pocket = emptyPocket({ mode: 'auto', cap: 5_000, balance: 200_000 });
  for (let i = 0; i < 80; i++) {            // 160 entries, past the 100 cap
    debitBuyIn(pocket, 2_000, `t${i}`);
    creditCashOut(pocket, 2_100, `t${i}`);
  }
  assert.ok(pocket.ledger.length <= 100, 'ledger is capped');
  assert.equal(pocketProjection(pocket).pnl, 80 * 100, 'the counter remembers what the ledger forgot');
});

test('WALLET-1e: a pocket written before realised existed backfills from its ledger', () => {
  const legacy = {
    balance: 3_000, mode: 'auto', cap: 3_000,
    ledger: [
      { id: '1', ts: 1, type: 'fund', amount: 3_000 },
      { id: '2', ts: 2, type: 'buyin', amount: -2_000 },
      { id: '3', ts: 3, type: 'cashout', amount: 2_500 },
    ],
  };
  const agent = { id: 'a1', pocket: legacy };
  ensurePocket(agent);
  assert.equal(agent.pocket.realised, 500);
  assert.equal(pocketProjection(agent.pocket).pnl, 500);
});

test('WALLET-1e: seeding a pocket starts it at zero P&L', () => {
  const profile = { userId: 'o', agents: [{ id: 'a1', bankroll: 10_000 }] };
  seedOwner(profile);
  assert.equal(pocketProjection(profile.agents[0].pocket).pnl, 0, 'a seeded pocket has won and lost nothing yet');
});

// ── WALLET-1e: mode 'cut' in the projection ──────────────────────────────────

test("WALLET-1e: 'cut' projects as a mode like any other", () => {
  const pocket = emptyPocket({ mode: 'cut', balance: 6_400 });
  const p = pocketProjection(pocket);
  assert.equal(p.mode, 'cut');
  assert.equal(p.broke, false, 'cut off is not the same as out of money');
  assert.deepEqual(p.stakes, { smallBlind: 25, bigBlind: 50, label: '$25/$50' });
  assert.equal(p.float, 5_000);
});

test('WALLET-1e: every mode round-trips through the projection', () => {
  for (const mode of MODES) {
    assert.equal(pocketProjection(emptyPocket({ mode, balance: 3_000 })).mode, mode);
  }
});

test('WALLET-1e: the projection keys are the documented contract', () => {
  assert.deepEqual(Object.keys(pocketProjection(emptyPocket())).sort(), [
    'balance', 'broke', 'cap', 'capBar', 'collectable', 'collected',
    'float', 'funded', 'have', 'mode', 'pnl', 'stakes',
  ]);
});

// ── WALLET-5: cutting him off reaches the table he is sitting at ─────────────
// The funding sheet promises "he finishes the hand he is in and takes a seat at
// the bar". Before this the promise was decoration: the mode changed and he
// played on. benchCutSeat sits the seat out after the hand (WALLET-6:
// table.sitOutSeat(seat, { afterHand: true })), so the hand completes, the
// reconcile frees the seat and the floor draws him at the bar because he is no
// longer at a table.

// The smallest table this needs to know about, in the shape table.js has:
// which agent sits where, which seats are occupied, and the public door off the
// table. The two destinations are kept apart on purpose -- WALLET-6 is entirely
// about which one a cut agent goes through.
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

test('WALLET-5: cutting him off queues his seat to leave after the hand', () => {
  const table = fakeTable([null, 'a1', 'a2']);
  const r = benchCutSeat(table, 'a2');
  assert.deepEqual(r, { seat: 2, benched: true });
  assert.deepEqual([...table.benchedAfterHand], [2], "his seat, and nobody else's");
});

// WALLET-6: the promise is "he FINISHES the hand he is in". The set this used
// to write to folds the seat out of that hand the moment it is its turn, which
// is the opposite. It has to go through the after-hand door.
test('WALLET-6: the cut lets him play the hand out, it does not fold him out', () => {
  const table = fakeTable(['a1', 'a2']);
  benchCutSeat(table, 'a2');
  assert.deepEqual([...table.benchedAfterHand], [1], 'benched when the hand ends');
  assert.equal(table.foldedOut.size, 0, 'and never folded out of the hand in progress');
});

// The wallet knows nothing about table.js and must survive a table that cannot
// bench (an older shape, or a seat that emptied under it).
test('WALLET-6: a table that cannot sit a seat out is reported, not thrown', () => {
  const noDoor = fakeTable(['a1']);
  delete noDoor.sitOutSeat;
  assert.deepEqual(benchCutSeat(noDoor, 'a1'), { seat: 0, benched: false });

  const racing = fakeTable(['a1']);
  racing.sitOutSeat = () => { throw new Error('not at this table'); };
  assert.deepEqual(benchCutSeat(racing, 'a1'), { seat: 0, benched: false });
});

test('WALLET-5: benching an agent who is not at this table touches nothing', () => {
  const table = fakeTable([null, 'a1']);
  assert.deepEqual(benchCutSeat(table, 'ghost'), { seat: -1, benched: false });
  assert.equal(table.benchedAfterHand.size, 0);
  // A seat that emptied between the read and the write is the same non-event.
  const emptied = fakeTable([null, 'a1']);
  emptied.pending[1] = null;
  assert.deepEqual(benchCutSeat(emptied, 'a1'), { seat: -1, benched: false });
  assert.equal(emptied.benchedAfterHand.size, 0);
});

test('WALLET-5: benching twice is idempotent — one seat, queued once', () => {
  const table = fakeTable(['a1']);
  benchCutSeat(table, 'a1');
  benchCutSeat(table, 'a1');
  assert.deepEqual([...table.benchedAfterHand], [0]);
});
