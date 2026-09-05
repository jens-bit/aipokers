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
// actually seats him — but the contract carries no stakes field, so the UI
// derives a label to render. Keyed off the cap (the size of the roll the owner
// committed) and falling back to the balance when there is no cap, which is
// what the ref's own rows do: a $500 allowance seats him at $10/$20, a $300
// float at $5/$10.
export function stakesFor(pocket) {
  if (!pocket || pocket.broke) return '—';
  const roll = Number.isFinite(Number(pocket.cap)) && Number(pocket.cap) > 0
    ? Number(pocket.cap)
    : Number(pocket.balance);
  if (!Number.isFinite(roll) || roll <= 0) return '—';
  if (roll >= 500) return '$10/$20';
  if (roll >= 250) return '$5/$10';
  return '$2/$5';
}

// ── pockets ─────────────────────────────────────────────────────────────────
// Normalises whatever the API gave us into the shape the components read, so
// every "is there a pocket at all" question is answered in one place.
export function pocketOf(agent) {
  const p = agent?.pocket;
  if (!p || typeof p !== 'object') return null;
  const balance = Number(p.balance);
  const cap = Number(p.cap);
  return {
    balance: Number.isFinite(balance) ? balance : 0,
    mode: MODES[p.mode] ? p.mode : 'topup',
    cap: Number.isFinite(cap) && cap > 0 ? cap : null,
    // Broke is the server's call, but a zero balance is broke whatever it says.
    broke: p.broke === true || (Number.isFinite(balance) && balance <= 0),
    // Optional. The contract does not carry a per-pocket P&L; when it is absent
    // the row shows an em dash rather than a number nobody computed.
    pnl: toAmount(p.pnl),
  };
}

export function hasPocket(agent) {
  return pocketOf(agent) !== null;
}

// How full the pocket bar draws: money he has against the roll he was given.
// Teal is what is left; the bar is empty and grey when he is broke.
export function pocketFill(pocket) {
  if (!pocket || pocket.broke) return 0;
  const ceiling = pocket.cap ?? pocket.balance;
  if (!ceiling || ceiling <= 0) return 0;
  return Math.max(0, Math.min(100, (pocket.balance / ceiling) * 100));
}

// The one action a pocket row offers. Collect when he is carrying money home,
// Fund when he is not. Never both — one primary action per row.
export function primaryAction(pocket) {
  if (!pocket || pocket.broke || pocket.balance <= 0) return 'fund';
  return 'collect';
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
      staked: Number.isFinite(Number(data.staked)) ? Number(data.staked) : 0,
      session: Number.isFinite(Number(data.session)) ? Number(data.session) : 0,
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

export async function collectFrom(agentId) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/collect`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId: getUserId() }),
  });
  if (!res.ok) throw new Error(`collect failed (${res.status})`);
  return res.json();
}
