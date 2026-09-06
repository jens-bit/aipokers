// src/server/wallet.js — WALLET-1
//
// Owner wallet + agent pockets (spec v11 §7.1, design-refs/mood-wallet.jsx).
// Design note: docs/WALLET_DESIGN.md.
//
// Two balances, not one. The OWNER WALLET is the player's money — it funds
// agents and (later) buys items. Each AGENT carries a POCKET, the roll he
// actually plays with, and the size of that pocket picks the stakes he sits
// at. The pocket IS the bet; there is no betting menu anywhere.
//
// This module is the money logic and nothing else: it does not read or write
// the database, it does not know about Express, and every function here is
// pure or mutates only the record it was handed. Persistence lives in
// store.js, the seams in agentProfiles.js. That is what lets the whole thing
// be tested offline with no server and no model calls.

import { randomUUID } from 'node:crypto';

// ── Constants ────────────────────────────────────────────────────────────────

// One buy-in at the entry rung. Also the default pocket float: what a
// migrated agent carries, and what `auto` refills him back up to.
export const POCKET_FLOAT = 2_000;

// Buy-in is 100 big blinds, matching the deploy gate that already existed.
export const BUYIN_BB = 100;

// The ladder. Highest rung whose buyIn the pocket covers wins. Ascending.
export const STAKES = Object.freeze([
  { rung: 0, smallBlind: 10, bigBlind: 20,  buyIn: 2_000,  label: '$10/$20' },
  { rung: 1, smallBlind: 25, bigBlind: 50,  buyIn: 5_000,  label: '$25/$50' },
  { rung: 2, smallBlind: 50, bigBlind: 100, buyIn: 10_000, label: '$50/$100' },
]);

export const ENTRY_BUYIN = STAKES[0].buyIn;

// The STORED vocabulary. WALLET-7 replaced the owner-facing four modes with
// two verbs — "give him chips" and "call him in" — but the store still speaks
// these four, so no agents.json anywhere has to be migrated. modeForRequest()
// below is the whole of the translation, and it happens at the route.
export const MODES = Object.freeze(['topup', 'allowance', 'auto', 'cut']);

// WALLET-7 — the two verbs, mapped to the four stored modes at the route.
//
//   give him chips            -> 'allowance'   (a roll, and when it is gone he stops)
//   give him chips + refill   -> 'auto'        (the toggle: refill when he busts, up to the cap)
//   call him in               -> 'cut'         (he finishes the hand and comes home)
//
// 'topup' folds into 'allowance': a one-time top-up and an allowance were the
// same thing wearing two names — chips now, no refill — and the split is what
// made the sheet offer four answers to one question. Pockets already stored as
// 'topup' keep working; nothing rewrites them.
//
// Returns { ok, mode }. `mode: undefined` with ok means "leave the mode alone",
// which is what a bare top-up of an existing pocket does.
export function modeForRequest({ verb, mode, refill } = {}) {
  const want = verb ?? mode;
  if (want === undefined || want === null) return { ok: true, mode: undefined };
  if (want === 'callin' || want === 'call-in' || want === 'cut') return { ok: true, mode: 'cut' };
  if (want === 'give' || want === 'allowance' || want === 'topup') {
    return { ok: true, mode: refill ? 'auto' : 'allowance' };
  }
  if (want === 'auto') return { ok: true, mode: 'auto' };
  return { ok: false, mode: undefined };
}

// Ledgers are append-only and bounded, like the agent ledger they sit beside.
const LEDGER_CAP = 100;

const isMode = (m) => MODES.includes(m);
const chips = (n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

// ── Records ──────────────────────────────────────────────────────────────────

export function emptyWallet(ownerId) {
  return { ownerId: String(ownerId), balance: 0, ledger: [] };
}

export function emptyPocket({ mode = 'topup', cap = null, balance = 0 } = {}) {
  return {
    balance: chips(balance),
    mode: isMode(mode) ? mode : 'topup',
    cap: cap === null || cap === undefined ? null : chips(cap),
    // WALLET-1e: realised P&L for this pocket — what he has actually won or
    // lost at tables, both signs. A running counter rather than a fold over
    // the ledger, because the ledger is capped at 100 entries and a pocket
    // that outlives 50 sessions would start quietly forgetting its own record.
    // Funding and collecting are transfers and never touch it.
    realised: 0,
    // WALLET-7: he has been called in and some of his chips are still on the
    // table. Set by callIn(), cleared by sweepRecall() once he is off it —
    // which is what stops the owner having to collect the same roll twice.
    recall: false,
    ledger: [],
  };
}

// Every entry carries a unique id: §7.1 wants the ledger server-authoritative
// with unique ids so tokenising later is a bolt-on, not a rearchitecture.
export function appendEntry(ledger, entry) {
  const list = Array.isArray(ledger) ? ledger : [];
  list.push({ id: randomUUID(), ts: Date.now(), ...entry });
  return list.length > LEDGER_CAP ? list.slice(-LEDGER_CAP) : list;
}

// Backfill a pocket on an agent that predates this feature. Idempotent, and
// deliberately does NOT invent chips — seeding from the old bankroll is the
// migration's job (seedOwner), which is the only place money moves.
export function ensurePocket(agent) {
  if (agent.pocket && typeof agent.pocket === 'object' && Number.isFinite(agent.pocket.balance)) {
    if (!Array.isArray(agent.pocket.ledger)) agent.pocket.ledger = [];
    if (!isMode(agent.pocket.mode)) agent.pocket.mode = 'topup';
    // WALLET-1e backfill: pockets written before realised existed rebuild it
    // from whatever table entries their ledger still holds. Approximate for a
    // long-lived pocket, exact for every pocket written since.
    if (!Number.isFinite(agent.pocket.realised)) agent.pocket.realised = realisedFromLedger(agent.pocket.ledger);
    if (typeof agent.pocket.recall !== 'boolean') agent.pocket.recall = false;
    return agent.pocket;
  }
  agent.pocket = emptyPocket();
  return agent.pocket;
}

// ── Stakes ───────────────────────────────────────────────────────────────────

// The highest rung this pocket can buy into, or null when it cannot afford
// even the entry rung — which is the definition of broke.
export function stakesFor(pocketBalance) {
  const bal = chips(pocketBalance);
  let found = null;
  for (const s of STAKES) if (bal >= s.buyIn) found = s;
  return found;
}

export function isBroke(pocketBalance) {
  return chips(pocketBalance) < ENTRY_BUYIN;
}

// Can this agent sit at a table already running at these blinds? Only if his
// pocket covers its buy-in, which is what keeps a table at the lowest rung any
// seated agent could afford.
export function canAffordTable(pocketBalance, bigBlind) {
  const bb = Number.isFinite(bigBlind) ? bigBlind : STAKES[0].bigBlind;
  return chips(pocketBalance) >= bb * BUYIN_BB;
}

export function buyInFor(bigBlind) {
  const bb = Number.isFinite(bigBlind) ? bigBlind : STAKES[0].bigBlind;
  return bb * BUYIN_BB;
}

// ── Transfers ────────────────────────────────────────────────────────────────
// Every one of these moves chips between exactly two places and writes both
// sides in the same call, so the two ledgers reconcile against each other.
// None of them can create or destroy a chip; the tests assert that.

// Owner funds an agent. `mode` and `cap` are set even when amount is 0, so
// "change him to an allowance" and "cut him off" are the same call.
// Returns { ok, moved, reason }.
export function fund(wallet, pocket, { mode, amount = 0, cap = null } = {}) {
  if (mode !== undefined && mode !== null && !isMode(mode)) {
    return { ok: false, moved: 0, reason: `unknown mode "${mode}"` };
  }
  const want = chips(amount);
  if (want > wallet.balance) {
    return { ok: false, moved: 0, reason: 'wallet does not cover that', available: wallet.balance };
  }

  if (mode) pocket.mode = mode;
  if (cap !== undefined) pocket.cap = cap === null ? null : chips(cap);
  // Cutting him off is a legitimate move, not a punishment: the pocket keeps
  // whatever is in it and he simply stops being deployed.
  if (pocket.mode === 'cut') pocket.cap = null;

  if (want > 0) {
    wallet.balance -= want;
    pocket.balance += want;
    wallet.ledger = appendEntry(wallet.ledger, { type: 'fund', amount: -want, agentId: pocket.agentId ?? null });
    pocket.ledger = appendEntry(pocket.ledger, { type: 'fund', amount: want });
  }
  return { ok: true, moved: want };
}

// WALLET-7 — what is his to be taken back, and when.
//
//   The winnings are the owner's at any time. The principal comes home when
//   he leaves the table.
//
// So the ceiling on a collect is the realised P&L, and only while it is
// positive: money the owner put in is money he already gave, and taking it out
// from under a seated agent is the thing the old "everything above the float"
// rule did by accident. A pocket topped up to $4,000 and never played sat
// $2,000 "above its float" and offered a Collect that took back the top-up —
// which is exactly the one-time-top-up symptom this tree is named after.
//
// Called in ('cut') is the other half of the rule: he is not sitting down
// again, so the whole pocket is collectable, principal included.
export function collectable(pocket) {
  const bal = chips(pocket?.balance);
  if (pocket?.mode === 'cut') return bal;
  const won = Number.isFinite(pocket?.realised) ? pocket.realised : 0;
  return Math.max(0, Math.min(won, bal));
}

// He brings it home. `all` is the call-him-in path and takes the principal too;
// everything else is capped at the winnings, so collecting can never be the
// thing that leaves him unable to sit down at the stake he was staked for.
export function collect(wallet, pocket, { amount = null, all = false } = {}) {
  const ceiling = all ? chips(pocket.balance) : collectable(pocket);
  const want = amount === null || amount === undefined ? ceiling : Math.min(chips(amount), ceiling);
  const moved = Math.min(want, chips(pocket.balance));
  if (moved <= 0) return { ok: false, moved: 0, reason: 'nothing to collect' };

  pocket.balance -= moved;
  wallet.balance += moved;
  // Winnings that came home stop being uncollected P&L. Without this the row
  // would offer the same $340 every time it was drawn, and each Collect would
  // eat a slice of the roll the owner staked. Only the winnings part is
  // banked: sweeping the principal out of a called-in pocket is a transfer and
  // must not read as a loss.
  const banked = Math.min(moved, Math.max(0, pocket.realised ?? 0));
  if (banked > 0) pocket.realised = (pocket.realised ?? 0) - banked;
  pocket.ledger = appendEntry(pocket.ledger, { type: 'collect', amount: -moved });
  wallet.ledger = appendEntry(wallet.ledger, { type: 'collect', amount: moved, agentId: pocket.agentId ?? null });
  return { ok: true, moved };
}

// WALLET-7 — "Call him in", the second verb, and the only cut-off there is.
//
// He finishes the hand he is in and takes a seat at the bar, and everything in
// the pocket comes back to the wallet. The seat is asked to sit out AFTER the
// hand (benchCutSeat), so the promise the sheet makes is the promise the table
// keeps.
//
// Chips still on the table cannot come home in this call — they are not in the
// pocket, they are in front of him. `recall` is what remembers to sweep them
// the moment the session pays them back, so calling him in is one decision the
// owner takes once rather than a collect he has to remember to repeat.
export function callIn(wallet, pocket, { table = null, agentId = null, seated = false } = {}) {
  pocket.mode = 'cut';
  pocket.cap = null;
  const bench = table ? benchCutSeat(table, agentId) : { seat: -1, benched: false };
  const home = collect(wallet, pocket, { all: true });
  pocket.recall = !!seated;
  return { moved: home.moved, benched: bench.benched, seat: bench.seat };
}

// The other half of callIn: the sweep that runs once he is off the table. A
// no-op while he is still seated, and it clears the flag either way as soon as
// he is not — an empty pocket is home too.
export function sweepRecall(wallet, pocket, { seated = false } = {}) {
  if (!pocket?.recall) return { ok: false, moved: 0, reason: 'nothing recalled' };
  if (seated) return { ok: false, moved: 0, reason: 'still at the table' };
  const r = collect(wallet, pocket, { all: true });
  pocket.recall = false;
  return r.ok ? r : { ok: false, moved: 0, reason: r.reason };
}

// WALLET-1e / WALLET-7: the float is the roll he is kept at — what the refill
// toggle tops him back up to when he busts. It used to double as the line
// collect stopped at; WALLET-7 took that job off it, because the winnings are
// what a collect takes and the principal is not the float's business.
//
//   auto | allowance : the roll the owner committed (the cap)
//   topup | cut      : one buy-in at the rung he is playing — nobody has
//                      promised him more, so the float is just enough to sit
//                      down again at the stake he is already at.
//
// Never below one buy-in at the entry rung: a float that leaves him unable to
// take a seat is not a float, it is a bust.
export function floatFor(pocket) {
  const mode = pocket?.mode ?? 'topup';
  if (mode === 'auto' || mode === 'allowance') {
    const cap = Number.isFinite(pocket?.cap) ? pocket.cap : POCKET_FLOAT;
    return Math.max(ENTRY_BUYIN, Math.min(cap, POCKET_FLOAT * 5));
  }
  const rung = stakesFor(pocket?.balance);
  return rung ? rung.buyIn : ENTRY_BUYIN;
}

// Auto-refill: he comes to the wallet and collects, up to the cap. Only
// `auto` does this — an allowance is a budget that runs out, and that is the
// point of it. Returns { ok, moved, reason }.
export function autoRefill(wallet, pocket) {
  if (pocket.mode !== 'auto') return { ok: false, moved: 0, reason: 'not on auto-refill' };
  const target = floatFor(pocket);
  const need = target - pocket.balance;
  if (need <= 0) return { ok: false, moved: 0, reason: 'pocket already at its float' };
  const moved = Math.min(need, wallet.balance);
  if (moved <= 0) return { ok: false, moved: 0, reason: 'wallet is empty' };

  wallet.balance -= moved;
  pocket.balance += moved;
  wallet.ledger = appendEntry(wallet.ledger, { type: 'refill', amount: -moved, agentId: pocket.agentId ?? null });
  pocket.ledger = appendEntry(pocket.ledger, { type: 'refill', amount: moved });
  return { ok: true, moved };
}

// Table money. Buy-in leaves the pocket on deploy; the whole final stack comes
// back at session end, so between the two the chips are "at the table" and the
// open buyin entry is what accounts for them.
export function debitBuyIn(pocket, amount, tableId = null) {
  const want = chips(amount);
  if (want > pocket.balance) return { ok: false, moved: 0, reason: 'pocket does not cover the buy-in' };
  pocket.balance -= want;
  pocket.realised = (pocket.realised ?? 0) - want;
  pocket.ledger = appendEntry(pocket.ledger, { type: 'buyin', amount: -want, tableId });
  return { ok: true, moved: want };
}

export function creditCashOut(pocket, amount, tableId = null) {
  const back = chips(amount);
  pocket.balance += back;
  pocket.realised = (pocket.realised ?? 0) + back;
  pocket.ledger = appendEntry(pocket.ledger, { type: 'cashout', amount: back, tableId });
  return { ok: true, moved: back };
}

// Buy-in out, cash-out in — the net of the two is the realised P&L. Transfers
// (fund, refill, collect, seed) are the owner moving his own money and are
// deliberately excluded.
function realisedFromLedger(ledger) {
  if (!Array.isArray(ledger)) return 0;
  let n = 0;
  for (const e of ledger) {
    if (e?.type === 'buyin' || e?.type === 'cashout') n += Number(e.amount) || 0;
  }
  return n;
}

// ── WALLET-5: cutting him off, at a table already running ────────────────────
//
// 'cut' is the one mode with a consequence that cannot wait for the next
// deploy. He is playing on a roll the owner has just stopped backing, so the
// funding sheet's own promise has to come true: "He finishes the hand he is in
// and takes a seat at the bar."
//
// This is the only function in this file that touches anything but a wallet and
// a pocket, and it does the smallest possible thing: it asks the table to sit
// the seat out AFTER the hand. The hand in progress completes, the
// between-hands reconcile frees the seat, the session is reported, and the
// floor draws him at the bar because he is no longer at a table. One
// mechanism, not two.
//
// WALLET-6: it used to reach into table._pendingSitOut directly, which is the
// wrong set - that one makes the seat FOLD as soon as it is its turn, so the
// promise "he finishes the hand he is in" was broken by the very line meant to
// keep it. table.sitOutSeat(seat, { afterHand: true }) is the public door, and
// it lets him play the hand out.
//
// The table is duck-typed on purpose — this module still knows nothing about
// table.js, and the test drives it with a plain object.
export function benchCutSeat(table, agentId) {
  const seats = table?.agentIds;
  const seat = Array.isArray(seats) ? seats.indexOf(agentId) : -1;
  if (seat < 0 || !table?.pending?.[seat]) return { seat: -1, benched: false };
  if (typeof table?.sitOutSeat !== 'function') return { seat, benched: false };
  try {
    table.sitOutSeat(seat, { afterHand: true });
  } catch {
    // A seat that emptied between the read and the write is a non-event, not a
    // failed cut: the mode change has already been persisted by the caller.
    return { seat, benched: false };
  }
  return { seat, benched: true };
}

// ── Migration (SEED-1) ───────────────────────────────────────────────────────

// Seed one owner's wallet and every pocket from today's per-agent bankrolls.
// The rule, and why, is docs/WALLET_DESIGN.md § "The seeding rule":
//
//   pocket = min(max(0, bankroll), POCKET_FLOAT)     mode 'auto', cap POCKET_FLOAT
//   wallet = Σ (max(0, bankroll) − pocket)
//
// Not a chip is created or destroyed, and `auto` at that cap reproduces the
// pre-wallet runway exactly: the same number of buy-ins, just visible.
// Idempotent — an agent that already has a pocket is left alone.
export function seedOwner(profile, { float = POCKET_FLOAT } = {}) {
  const wallet = emptyWallet(profile?.userId ?? 'anon');
  const agents = Array.isArray(profile?.agents) ? profile.agents : [];
  let swept = 0;
  let seeded = 0;

  for (const agent of agents) {
    if (agent.pocket && Number.isFinite(agent.pocket.balance)) continue;  // already seeded
    const bankroll = chips(agent.bankroll);
    const keep = Math.min(bankroll, float);
    agent.pocket = emptyPocket({ mode: 'auto', cap: float, balance: keep });
    agent.pocket.ledger = appendEntry(agent.pocket.ledger, { type: 'seed', amount: keep });
    swept += bankroll - keep;
    seeded++;
  }

  if (swept > 0) {
    wallet.balance = swept;
    wallet.ledger = appendEntry(wallet.ledger, { type: 'seed', amount: swept, agentId: null });
  }
  return { wallet, seeded, swept };
}

// ── Projections ──────────────────────────────────────────────────────────────
// The shapes the client reads. Kept here, next to the rules that produce them,
// so the UI contract and the money logic cannot drift apart.

// What GET /api/wallet returns. Mirrors WALLET in design-refs/mood-wallet.jsx
// ({ balance, staked, session }) plus the "Playing" tile beside them.
export function walletProjection(wallet, agents, { sessionNet = 0 } = {}) {
  const list = Array.isArray(agents) ? agents : [];
  let staked = 0;
  let live = 0;
  for (const a of list) {
    staked += chips(a?.pocket?.balance);
    if (a?.status === 'playing' || a?.activeTableId) live++;
  }
  return {
    balance: wallet?.balance ?? 0,
    staked,
    session: Number.isFinite(sessionNet) ? sessionNet : 0,
    playing: { live, total: list.length },
    ledger: Array.isArray(wallet?.ledger) ? wallet.ledger.slice(-20).reverse() : [],
  };
}

// The `pocket` block that rides the agent list projection. Everything the
// PocketRow, PocketBar, FundSheet and the profile's pocket line need, and
// nothing about how well he plays — the pocket picks which tables he sits at,
// never how he does at them.
export function pocketProjection(pocket) {
  const p = pocket && Number.isFinite(pocket.balance) ? pocket : emptyPocket();
  const stakes = stakesFor(p.balance);
  const broke = isBroke(p.balance);
  const float = floatFor(p);
  const ledger = Array.isArray(p.ledger) ? p.ledger : [];
  let funded = 0;
  let collected = 0;
  for (const e of ledger) {
    if (e.type === 'fund' || e.type === 'refill' || e.type === 'seed') funded += chips(e.amount);
    if (e.type === 'collect') collected += chips(-e.amount);
  }
  return {
    balance: p.balance,
    // 'topup' | 'allowance' | 'auto' | 'cut'. `cut` is a mode like the others:
    // he keeps the roll he has and simply stops being deployed. Not a
    // punishment, and the UI draws it without a shred of guilt.
    mode: p.mode,
    cap: p.cap,
    // WALLET-1e: what stays in the pocket when the owner collects, and what
    // `auto` refills back up to. The refill float for auto/allowance; one
    // buy-in at his current rung for topup/cut. collect() uses this exact
    // number, so the receipt and the row can never disagree.
    float,
    // PocketBar draws have/capBar. With no cap set the bar fills against the
    // rung above, so a growing pocket still reads as progress toward something.
    have: p.balance,
    capBar: p.cap ?? nextRungBuyIn(p.balance),
    stakes: stakes ? { smallBlind: stakes.smallBlind, bigBlind: stakes.bigBlind, label: stakes.label } : null,
    broke,
    // WALLET-7: what a Collect would actually take — the winnings, or the whole
    // pocket once he has been called in. Not "everything above the float": that
    // read a top-up as money to bring home.
    collectable: collectable(p),
    funded,
    collected,
    // WALLET-1e: realised P&L at tables, both signs — buy-ins out against
    // cash-outs in. Funding and collecting are the owner moving his own money
    // between two of his own pockets and are deliberately not P&L; counting
    // them would make a top-up read as a win.
    pnl: Number.isFinite(p.realised) ? p.realised : realisedFromLedger(ledger),
  };
}

function nextRungBuyIn(balance) {
  for (const s of STAKES) if (chips(balance) < s.buyIn) return s.buyIn;
  return STAKES[STAKES.length - 1].buyIn;
}

// ── Voice ────────────────────────────────────────────────────────────────────
// Moment lines for the two beats that belong to the owner economy. Both go
// through the same lastMoment/sessionRecap machinery every other beat uses.
//
// The law from §7.1 and the Mood Design Law: he reacts in his own voice, and
// never with owner-guilt. He does not plead, the copy does not scold, and
// nothing is lost when he is cut off.

export function collectMoment({ moved, left, agentName = 'He' } = {}) {
  const lines = [
    `${moved} of it is yours. I kept ${left} to sit down with.`,
    `Brought home ${moved}. Float's still ${left}.`,
    `That's ${moved} back to you. I'll go again on ${left}.`,
  ];
  return lines[Math.abs(hash(`${agentName}:${moved}:${left}`)) % lines.length];
}

// WALLET-7: he has been called in. The pocket is empty because the owner asked
// for it back, which is a different beat from busting — no plea, no apology,
// and the read book keeps either way.
export function callInMoment({ moved, agentName = 'He' } = {}) {
  const lines = [
    `All ${moved} of it is back with you. I'll be at the bar.`,
    `Cashed out — ${moved} home. I keep the read book.`,
    `That's me done for now. ${moved} back to you.`,
  ];
  return lines[Math.abs(hash(`${agentName}:callin:${moved}`)) % lines.length];
}

export function brokeMoment({ mode = 'topup', agentName = 'He' } = {}) {
  const lines = mode === 'cut'
    ? [
        `I'm out, and I know the answer. I'll be at the bar.`,
        `Pocket's empty. Not asking.`,
      ]
    : [
        `I'm out. Your call.`,
        `Pocket's empty — I'll be at the bar. My read book keeps either way.`,
        `That's the roll gone. Nothing else is lost.`,
      ];
  return lines[Math.abs(hash(`${agentName}:${mode}`)) % lines.length];
}

// Small deterministic string hash so the same agent does not get a different
// line every render — the moment is stored, not re-rolled.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
