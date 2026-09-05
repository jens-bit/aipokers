// scripts/verify-wallet.js — WALLET-1
// The owner economy end to end, offline: fund → deploy → play → collect,
// broke, auto-refill, cut-off, and chip conservation across wallet + pockets
// + chips sitting at live tables. No server process, no model calls — the
// agent handler falls back to check/fold without a key, and this script never
// gets that far anyway: it drives the money paths directly.
// Run: node scripts/verify-wallet.js

import {
  POCKET_FLOAT, ENTRY_BUYIN, STAKES, MODES,
  emptyWallet, emptyPocket,
  stakesFor, isBroke, canAffordTable,
  fund, collect, autoRefill, debitBuyIn, creditCashOut,
  seedOwner, walletProjection, pocketProjection,
  collectMoment, brokeMoment,
} from '../src/server/wallet.js';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── The world ────────────────────────────────────────────────────────────────
// One owner, four agents, plus a ledger of chips currently sitting at tables.
// `atTable` is what a buy-in becomes between deploy and cash-out; it is part
// of the conservation sum, which is the whole point of tracking it here.

function makeWorld() {
  const profile = {
    userId: 'verify-owner',
    agents: [
      { id: 'a1', name: 'Balanced',   bankroll: 10_000 },
      { id: 'a2', name: 'Aggressive', bankroll: 6_000 },
      { id: 'a3', name: 'Bluffer',    bankroll: 2_500 },
      { id: 'a4', name: 'Value Bot',  bankroll: 800 },
    ],
  };
  const granted = profile.agents.reduce((n, a) => n + a.bankroll, 0);
  const { wallet } = seedOwner(profile);
  return { profile, wallet, granted, atTable: new Map() };
}

// THE invariant. Every assertion in this file ends up leaning on it.
function totalChips(w) {
  const inPockets = w.profile.agents.reduce((n, a) => n + a.pocket.balance, 0);
  const onFelt = [...w.atTable.values()].reduce((n, v) => n + v, 0);
  return w.wallet.balance + inPockets + onFelt;
}

// wallet + pockets + chips on the felt === everything granted, plus everything
// won from (or lost to) other players. This is the invariant the whole file
// leans on; every scenario re-checks it after every move.
function conserved(w, label) {
  check(`${label} — chips conserved`, totalChips(w) === w.granted,
    `${totalChips(w)} != ${w.granted} (wallet ${w.wallet.balance}, pockets ` +
    `${w.profile.agents.map((a) => a.pocket.balance).join('/')}, felt ` +
    `${[...w.atTable.values()].join('/') || 0})`);
}

const byId = (w, id) => w.profile.agents.find((a) => a.id === id);

// The deploy path's money, mirroring agentProfiles.js: refill if he is short,
// refuse if he is still broke or cut off, otherwise take the buy-in.
function deploy(w, agentId) {
  const agent = byId(w, agentId);
  const pocket = agent.pocket;
  if (pocket.mode === 'cut') return { ok: false, reason: 'cut' };
  if (isBroke(pocket.balance)) autoRefill(w.wallet, pocket);
  if (isBroke(pocket.balance)) return { ok: false, reason: 'broke' };
  const stakes = stakesFor(pocket.balance);
  const r = debitBuyIn(pocket, stakes.buyIn, `t-${agentId}`);
  if (!r.ok) return { ok: false, reason: 'buyin refused' };
  w.atTable.set(agentId, (w.atTable.get(agentId) ?? 0) + stakes.buyIn);
  return { ok: true, stakes };
}

// Session over: the whole final stack comes back to the pocket.
//
// Poker is not a closed system for one owner: chips won come from the other
// players at the table and chips lost go to them. So the baseline this script
// conserves against moves by the realised P&L in BOTH directions — `granted`
// is "everything this owner was ever given, plus everything his agents took
// off other players". Only accounting for losses (the first version of this
// harness) makes every winning session look like minted chips.
function endSession(w, agentId, pnl) {
  const agent = byId(w, agentId);
  const onFelt = w.atTable.get(agentId) ?? 0;
  // He cannot lose more than the stack he sat down with.
  const finalStack = Math.max(0, onFelt + pnl);
  const realised = finalStack - onFelt;
  w.atTable.delete(agentId);
  creditCashOut(agent.pocket, finalStack);
  w.granted += realised;
  return finalStack;
}

console.log('\n[verify] 1) seeding — SEED-1 conserves every chip');
{
  const w = makeWorld();
  assert('four pockets seeded', w.profile.agents.every((a) => a.pocket), true);
  assert('pocket = min(bankroll, float)', w.profile.agents.map((a) => a.pocket.balance),
    [POCKET_FLOAT, POCKET_FLOAT, POCKET_FLOAT, 800]);
  assert('wallet took the surplus', w.wallet.balance, (10_000 - 2_000) + (6_000 - 2_000) + (2_500 - 2_000));
  assert('default mode is auto', [...new Set(w.profile.agents.map((a) => a.pocket.mode))], ['auto']);
  conserved(w, 'after seeding');
}

console.log('\n[verify] 2) stakes follow the pocket');
{
  const w = makeWorld();
  const a1 = byId(w, 'a1');
  assert('a 2 000 pocket sits at the entry rung', stakesFor(a1.pocket.balance).label, '$10/$20');

  fund(w.wallet, a1.pocket, { mode: 'auto', amount: 3_000, cap: 5_000 });
  assert('5 000 moves him up a rung', stakesFor(a1.pocket.balance).label, '$25/$50');
  conserved(w, 'after funding up a rung');

  fund(w.wallet, a1.pocket, { mode: 'auto', amount: 5_000, cap: 10_000 });
  assert('10 000 reaches the top rung', stakesFor(a1.pocket.balance).label, '$50/$100');
  assert('and the top rung is the ceiling', stakesFor(999_999).label, '$50/$100');
  conserved(w, 'after funding to the top');

  check('he cannot join a table above his rung',
    canAffordTable(2_000, 100) === false && canAffordTable(10_000, 100) === true);
  assert('the ladder is the documented three', STAKES.map((s) => s.label),
    ['$10/$20', '$25/$50', '$50/$100']);
}

console.log('\n[verify] 3) a winning night — deploy, play, collect');
{
  const w = makeWorld();
  const d = deploy(w, 'a1');
  assert('deployed at his rung', d.stakes.label, '$10/$20');
  assert('buy-in left the pocket', byId(w, 'a1').pocket.balance, 0);
  conserved(w, 'mid-session (chips on the felt)');

  const finalStack = endSession(w, 'a1', 3_400);
  assert('the whole final stack came home', byId(w, 'a1').pocket.balance, finalStack);
  assert('and it stays in the pocket until collected', byId(w, 'a1').pocket.balance, 5_400);
  conserved(w, 'after the session');

  const walletBefore = w.wallet.balance;
  const r = collect(w.wallet, byId(w, 'a1').pocket);
  check('collect moved the surplus', r.ok && r.moved > 0, `moved ${r.moved}`);
  assert('wallet grew by exactly that', w.wallet.balance - walletBefore, r.moved);
  check('and he can still sit down', !isBroke(byId(w, 'a1').pocket.balance));
  conserved(w, 'after collecting');

  const line = collectMoment({ moved: r.moved, left: byId(w, 'a1').pocket.balance, agentName: 'Balanced' });
  check('the collect line is in his voice', typeof line === 'string' && line.length > 0, line);
  check('and carries no owner-guilt', !/your fault|you never|you forgot|miss you/i.test(line), line);
}

console.log('\n[verify] 4) auto-refill — he collects from the wallet when broke');
{
  const w = makeWorld();
  const before = w.wallet.balance;
  deploy(w, 'a2');
  endSession(w, 'a2', -2_000);                       // felted
  assert('pocket is empty', byId(w, 'a2').pocket.balance, 0);
  check('and he reads broke', isBroke(byId(w, 'a2').pocket.balance));

  const d = deploy(w, 'a2');
  check('auto put him back in a seat', d.ok, d.reason);
  assert('refilled to his cap', byId(w, 'a2').pocket.balance + (w.atTable.get('a2') ?? 0), POCKET_FLOAT);
  check('the wallet paid for it', w.wallet.balance < before, `${w.wallet.balance} vs ${before}`);
  conserved(w, 'after auto-refill');
}

console.log('\n[verify] 5) allowance and top-up run out and stay out');
{
  for (const mode of ['allowance', 'topup']) {
    const w = makeWorld();
    const agent = byId(w, 'a3');
    fund(w.wallet, agent.pocket, { mode, cap: 5_000 });
    deploy(w, 'a3');
    endSession(w, 'a3', -2_000);

    const walletBefore = w.wallet.balance;
    const d = deploy(w, 'a3');
    check(`${mode}: he stays out`, !d.ok && d.reason === 'broke', `got ${d.reason}`);
    assert(`${mode}: the wallet was not touched`, w.wallet.balance, walletBefore);
    conserved(w, `after ${mode} ran out`);

    const line = brokeMoment({ mode, agentName: 'Bluffer' });
    check(`${mode}: the broke line does not plead`,
      !/please|beg|sorry|your fault|you never/i.test(line), line);
  }
}

console.log('\n[verify] 6) cutting him off is legitimate and costs him nothing');
{
  const w = makeWorld();
  const agent = byId(w, 'a1');
  const held = agent.pocket.balance;
  fund(w.wallet, agent.pocket, { mode: 'cut' });

  assert('he keeps the roll he had', agent.pocket.balance, held);
  assert('cap is cleared', agent.pocket.cap, null);
  const d = deploy(w, 'a1');
  check('and he does not deploy', !d.ok && d.reason === 'cut', `got ${d.reason}`);
  conserved(w, 'after cutting him off');

  const line = brokeMoment({ mode: 'cut', agentName: 'Balanced' });
  check('the cut-off line is not a punishment', !/punish|deserve|bad|fault/i.test(line), line);
}

console.log('\n[verify] 7) the wallet cannot be overdrawn, ever');
{
  const w = makeWorld();
  const agent = byId(w, 'a4');
  const r = fund(w.wallet, agent.pocket, { mode: 'topup', amount: w.wallet.balance + 1 });
  check('funding past the wallet is refused', !r.ok, r.reason);
  conserved(w, 'after a refused fund');

  // Drain it legitimately, then try again.
  fund(w.wallet, agent.pocket, { mode: 'auto', amount: w.wallet.balance, cap: POCKET_FLOAT });
  assert('wallet is empty', w.wallet.balance, 0);
  const r2 = autoRefill(w.wallet, agent.pocket);
  check('auto-refill on an empty wallet moves nothing', !r2.ok, r2.reason);
  check('and the wallet never goes negative', w.wallet.balance >= 0, `${w.wallet.balance}`);
  conserved(w, 'with an empty wallet');
}

console.log('\n[verify] 8) a long night — many sessions, conservation holds throughout');
{
  const w = makeWorld();
  const swings = [+1_200, -2_000, +400, -900, +3_100, -2_000, +250, -2_000, +5_000, -1_100];
  let sessions = 0;
  for (let i = 0; i < swings.length; i++) {
    const id = ['a1', 'a2', 'a3', 'a4'][i % 4];
    const d = deploy(w, id);
    if (!d.ok) continue;
    sessions++;
    endSession(w, id, swings[i]);
    conserved(w, `session ${sessions} (${id} ${swings[i] >= 0 ? '+' : ''}${swings[i]})`);
  }
  check('sessions actually ran', sessions >= 6, `only ${sessions}`);

  // Collect from everyone who has something above their float, then re-check.
  for (const a of w.profile.agents) collect(w.wallet, a.pocket);
  conserved(w, 'after collecting from everyone');
}

console.log('\n[verify] 9) projections carry what the UI reads and nothing else');
{
  const w = makeWorld();
  const proj = walletProjection(w.wallet, w.profile.agents, { sessionNet: 486 });
  assert('wallet projection keys', Object.keys(proj).sort(),
    ['balance', 'ledger', 'playing', 'session', 'staked']);
  assert('staked is the sum of the pockets', proj.staked,
    w.profile.agents.reduce((n, a) => n + a.pocket.balance, 0));

  const p = pocketProjection(byId(w, 'a1').pocket);
  for (const k of ['balance', 'mode', 'cap', 'have', 'capBar', 'stakes', 'broke', 'collectable', 'pnl']) {
    check(`pocket projection has ${k}`, k in p);
  }
  for (const k of ['attrs', 'mood', 'band', 'strategy', 'nature']) {
    check(`pocket projection does NOT carry ${k}`, !(k in p));
  }
  const brokePocket = pocketProjection(emptyPocket({ balance: 0 }));
  assert('a broke pocket has no stakes', brokePocket.stakes, null);
  assert('and says so', brokePocket.broke, true);
}

console.log('\n[verify] 10) ledgers reconcile — every transfer has two sides');
{
  const w = makeWorld();
  const agent = byId(w, 'a1');
  fund(w.wallet, agent.pocket, { mode: 'auto', amount: 3_000, cap: 5_000 });
  collect(w.wallet, agent.pocket, { amount: 1_000, leaveFloat: false });

  const walletMoves = w.wallet.ledger.filter((e) => e.type === 'fund' || e.type === 'collect');
  const pocketMoves = agent.pocket.ledger.filter((e) => e.type === 'fund' || e.type === 'collect');
  assert('same number of transfer entries on both sides', walletMoves.length, pocketMoves.length);
  check('every entry carries a unique id',
    new Set([...w.wallet.ledger, ...agent.pocket.ledger].map((e) => e.id)).size ===
    w.wallet.ledger.length + agent.pocket.ledger.length);
  check('and every transfer nets to zero across the two ledgers',
    walletMoves.reduce((n, e) => n + e.amount, 0) + pocketMoves.reduce((n, e) => n + e.amount, 0) === 0);
  conserved(w, 'after reconciling ledgers');
}

console.log('\n[verify] 11) modes are exactly the four the design ref draws');
{
  assert('modes', [...MODES].sort(), ['allowance', 'auto', 'cut', 'topup']);
  assert('entry buy-in', ENTRY_BUYIN, 2_000);
  assert('pocket float', POCKET_FLOAT, 2_000);
}

console.log(`\n${passed + failed} check(s): ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
