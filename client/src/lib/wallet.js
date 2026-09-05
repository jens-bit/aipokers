// client/src/lib/wallet.js — WALLET-UI-1
//
// The owner wallet and agent pockets. Spec v11 §7.1, mirrored in the header of
// design-refs/mood-wallet.jsx:
//
//   Poker staking, not a shop. The OWNER WALLET is the player's money; each
//   agent carries a POCKET, the roll he plays with. Pocket size sets the stakes
//   he sits at, so the pocket IS the bet and there is no betting menu anywhere.
//   Backer and horse.
//
// Laws carried in:
//   - Items are bought from the WALLET, never from a pocket. A pocket that can
//     buy things is a purchase path into the character system.
//   - Cutting him off is a legitimate state, drawn without a shred of guilt.
//   - No live wager, no token, no real money in this wave.
//
// Backend contract (feature/wallet). Everything here is written for graceful
// absence: the wallet endpoints may not exist yet, and when they do not the
// You screen shows exactly what it shows today.
//
//   GET  /api/wallet                  -> { balance, staked, session, ledger[] }
//   agent.pocket                      -> { balance, mode, cap, broke }
//   POST /api/agents/:id/fund         <- { mode, amount, cap }
//   POST /api/agents/:id/collect

import { getTelegramInitData, getUserId } from './telegram.js';

// ── modes ───────────────────────────────────────────────────────────────────
// Labels, titles and one-line explanations are verbatim from the ref's MODE
// table. Colours are the mood palette's own tokens.
//
// NOTE: the contract lists three modes — 'topup' | 'allowance' | 'auto'. The
// design has a fourth, 'cut', and the funding sheet offers it as a first-class
// choice. It is included here because the sheet cannot be drawn without it.
export const MODES = {
  topup: {
    label: 'TOP-UP',
    title: 'One-time top-up',
    color: '#A1A1A1',
    line: 'one-time. When it is gone, he stops.',
  },
  allowance: {
    label: 'ALLOWANCE',
    title: 'Allowance',
    color: '#00D4AA',
    line: 'a fixed budget. He plays until it runs out.',
  },
  auto: {
    label: 'AUTO',
    title: 'Auto-refill',
    color: '#CDB380',
    line: 'he collects from the wallet when broke, up to a cap.',
  },
  cut: {
    label: 'CUT OFF',
    title: 'Cut him off',
    color: '#6B6B6B',
    line: 'no refill. A legitimate answer, and not a punishment.',
  },
};

export const FUND_MODES = ['topup', 'allowance', 'auto', 'cut'];

export function modeMeta(mode) {
  return MODES[mode] ?? MODES.topup;
}

// ── money ───────────────────────────────────────────────────────────────────
// Deliberately not toLocaleString: that formats by the device's locale, so the
// same balance reads "2,340.50" on one phone and "2 340,50" on another, and a
// test asserting either one is wrong somewhere. The ref shows grouped
// thousands with a comma, and cents only when there are cents.

// Number(null) and Number('') are both 0, which would print a confident "$0"
// for a field the API never sent. Absent is not zero.
function toAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function money(value, { sign = false } = {}) {
  const n = toAmount(value);
  if (n === null) return '—';

  const negative = n < 0;
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const fixed = abs.toFixed(hasCents ? 2 : 0);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `$${grouped}${cents ? `.${cents}` : ''}`;

  // U+2212 MINUS SIGN, not a hyphen — it aligns with the digits.
  if (negative) return `−${body}`;
  return sign ? `+${body}` : body;
}

// A P&L figure: always carries its sign, and an em dash when there is no
// number to show rather than a misleading $0.
export function signedMoney(value) {
  const n = toAmount(value);
  if (n === null) return '—';
  if (n === 0) return '$0';
  return money(n, { sign: true });
}

export function pnlTone(value) {
  const n = toAmount(value);
  if (n === null || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

// ── stakes ──────────────────────────────────────────────────────────────────
// "Pocket size sets his stakes" is the product law, and the server is what
// actually seats him. src/server/wallet.js owns the ladder and sends the rung
// it picked as pocket.stakes = { smallBlind, bigBlind, label }, so that label
// is the answer whenever it is there — a second ladder in the client would
// eventually disagree with the one that decides where he really sits.
//
// The fallback below only runs against a projection that predates the ladder.
// It keys off the float (the roll he is kept at), then the balance.
export function stakesFor(pocket) {
  if (!pocket) return '—';
  if (pocket.stakesLabel) return pocket.stakesLabel;
  if (pocket.broke) return '—';
  const roll = pocket.float ?? pocket.cap ?? pocket.balance;
  if (!Number.isFinite(roll) || roll <= 0) return '—';
  if (roll >= 10_000) return '$50/$100';
  if (roll >= 5_000) return '$25/$50';
  if (roll >= 2_000) return '$10/$20';
  return '—';
}

// ── pockets ─────────────────────────────────────────────────────────────────
// Normalises whatever the API gave us into the shape the components read, so
// every "is there a pocket at all" question is answered in one place.
export function pocketOf(agent) {
  const p = agent?.pocket;
  if (!p || typeof p !== 'object') return null;
  const balance = toAmount(p.balance) ?? 0;
  const cap = toAmount(p.cap);
  const collectable = toAmount(p.collectable);

  // What collect leaves behind and what auto refills back up to. The
  // projection sends `collectable` (balance - float) rather than the float
  // itself, so derive it; a `float` sent directly is used as-is.
  const float = toAmount(p.float)
    ?? (collectable !== null ? Math.max(0, balance - collectable) : null);

  return {
    balance,
    mode: MODES[p.mode] ? p.mode : 'topup',
    cap: cap !== null && cap > 0 ? cap : null,
    float,
    // Broke is the server's call — it means "cannot cover the entry buy-in",
    // which is a bigger number than zero. A zero balance is broke regardless.
    broke: p.broke === true || balance <= 0,
    // The rung the server actually seated him at.
    stakesLabel: typeof p.stakes?.label === 'string' ? p.stakes.label : null,
    // How much he is carrying home if the owner says so.
    collectable: collectable !== null ? Math.max(0, collectable) : null,
    // What the bar fills against: the cap when there is one, otherwise the
    // next rung up, so a growing pocket still reads as progress.
    have: toAmount(p.have) ?? balance,
    capBar: toAmount(p.capBar) ?? cap,
    // Absent on an older projection — the row then shows an em dash rather
    // than a number nobody computed.
    pnl: toAmount(p.pnl),
  };
}

export function hasPocket(agent) {
  return pocketOf(agent) !== null;
}

// How full the pocket bar draws: money he has against the roll he was given.
// Teal is what is left; the bar is empty and grey when he is broke.
export function pocketFill(pocket) {
  if (!pocket) return 0;
  const have = pocket.have ?? pocket.balance;
  const ceiling = pocket.capBar ?? pocket.cap ?? have;
  if (!ceiling || ceiling <= 0 || have <= 0) return 0;
  return Math.max(0, Math.min(100, (have / ceiling) * 100));
}

// WALLET-5 — what a pocket row offers, and it is not one button.
//
// FUND IS ALWAYS THERE. It is not only how chips are added: it is the only way
// into the mode, so a row that hides it leaves the owner with no way to change
// his mind. The old rule drew exactly one action and let Collect win, which is
// how funding Loose Cannon to $4,000 made Fund disappear.
//
// COLLECT IS THE SECOND ACTION, and it is only honest when there is money worth
// bringing home:
//
//   - he is up at the tables (pnl > 0), or
//   - he is cut off and still holding a roll — he is not going to play it.
//
// "Balance above the float" is NOT enough on its own. A seeded pocket carries
// an auto cap of one buy-in, so a $4,000 top-up sits $2,000 "above the float"
// without his having won a chip; reading that as winnings to collect is what
// flipped the row. Both actions can be present at once.
export function rowActions(pocket) {
  if (!pocket || pocket.balance <= 0) return { fund: true, collect: false };
  // Cut off with chips in hand: all of it is the owner's to take back, and the
  // float he would normally be left to sit down with buys him nothing.
  if (pocket.mode === 'cut') return { fund: true, collect: true };
  // The projection says how much is above the float; without it, any balance
  // counts. Winnings still have to be there for Collect to mean anything.
  const surplus = pocket.collectable === null || pocket.collectable === undefined
    ? true
    : pocket.collectable > 0;
  return { fund: true, collect: surplus && (pocket.pnl ?? 0) > 0 };
}

// Collecting from a cut pocket takes all of it. Every other mode leaves the
// float behind, so collecting is never the thing that stops him sitting down.
export function collectLeavesFloat(pocket) {
  return pocket?.mode !== 'cut';
}

// ── api ─────────────────────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  return { 'x-telegram-init-data': getTelegramInitData(), ...extra };
}

// Returns the wallet, or null when this deployment has no wallet yet. Null is
// a first-class answer: every surface falls back to what it shows today rather
// than rendering an empty money UI.
export async function fetchWallet() {
  try {
    const res = await fetch(`/api/wallet?userId=${encodeURIComponent(getUserId())}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    if (!Number.isFinite(Number(data.balance))) return null;
    return {
      balance: Number(data.balance),
      staked: toAmount(data.staked) ?? 0,
      session: toAmount(data.session) ?? 0,
      // The server counts who is actually at a table; the client should not
      // second-guess it from presence.
      playing: data.playing && Number.isFinite(Number(data.playing.live))
        ? { live: Number(data.playing.live), total: Number(data.playing.total) }
        : null,
      ledger: Array.isArray(data.ledger) ? data.ledger : [],
    };
  } catch {
    return null;
  }
}

export async function fundAgent(agentId, { mode, amount = null, cap = null }) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/fund`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId: getUserId(), mode, amount, cap }),
  });
  if (!res.ok) throw new Error(`fund failed (${res.status})`);
  return res.json();
}

export async function collectFrom(agentId, { leaveFloat = true } = {}) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/collect`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId: getUserId(), leaveFloat }),
  });
  if (!res.ok) throw new Error(`collect failed (${res.status})`);
  return res.json();
}
