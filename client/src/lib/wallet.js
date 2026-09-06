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
//   POST /api/agents/:id/fund         <- { verb, amount, cap, refill }
//   POST /api/agents/:id/collect      <- { all? }
//
// WALLET-7 — two verbs, not four modes:
//
//   GIVE HIM CHIPS   an amount, and one toggle for whether it refills.
//   CALL HIM IN      he finishes the hand and everything comes back.
//
// The store still holds the four modes it always did and the route maps
// between them, so nothing here has to know what a 'topup' was.

import { getTelegramInitData, getUserId } from './telegram.js';

// ── how the money behaves ───────────────────────────────────────────────────
// The four stored modes still arrive on every pocket, because the store was not
// migrated. What the owner reads is no longer four answers to one question —
// it is what the two verbs left behind:
//
//   'topup' | 'allowance' -> STAKED     he has a roll; when it is gone he stops
//   'auto'                -> REFILLS    the toggle is on
//   'cut'                 -> CALLED IN  he is at the bar, and nothing is pending
//
// 'topup' and 'allowance' were the same thing wearing two names, so they wear
// one now. Colours stay the mood palette's own tokens; CALLED IN is grey, never
// red, and the copy carries no guilt anywhere.
export const MODES = {
  topup: {
    label: 'STAKED',
    title: 'Staked',
    color: '#A1A1A1',
    line: 'a roll to play with. When it is gone, he stops.',
  },
  allowance: {
    label: 'STAKED',
    title: 'Staked',
    color: '#00D4AA',
    line: 'a roll to play with. When it is gone, he stops.',
  },
  auto: {
    label: 'REFILLS',
    title: 'Refills when he busts',
    color: '#CDB380',
    line: 'he refills from the wallet when he busts, up to a cap.',
  },
  cut: {
    label: 'CALLED IN',
    title: 'Called in',
    color: '#6B6B6B',
    line: 'he is at the bar. A legitimate answer, and not a punishment.',
  },
};

export function modeMeta(mode) {
  return MODES[mode] ?? MODES.topup;
}

// WALLET-7 — the two verbs, in the words the owner reads on every surface.
export const GIVE = 'Give him chips';
export const CALL_IN = 'Call him in';

// The refill toggle, and the promise it makes. One toggle, one sentence.
export function refillLabel(cap) {
  return `Refill from the wallet when he busts (cap ${money(cap)})`;
}

// What "call him in" does, in his own register: a promise about the next few
// minutes, and a list of what he keeps rather than what he loses.
export const CALL_IN_LINE =
  'He finishes the hand he is in and takes a seat at the bar, and everything in '
  + 'his pocket comes back to your wallet. Nothing is lost — his attributes, his '
  + 'read book and his grudges all keep.';

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

  // The roll he is kept at: what the refill toggle tops him back up to. The
  // projection sends it directly. WALLET-7 stopped deriving it from
  // `collectable` — collectable is now the winnings, and balance minus the
  // winnings is not a float, it is just the principal.
  const float = toAmount(p.float);

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
    // What a Collect would actually take: the winnings, or the whole pocket
    // once he has been called in.
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

// WALLET-7 — what a pocket row offers. Three possible actions, one of them
// always there, and each one answers a different question.
//
//   GIVE HIM CHIPS is unconditional. It is how chips get in AND the only way
//   to the refill toggle, so a row that hides it leaves the owner with no way
//   to change his mind.
//
//   COLLECT is the winnings, and only when there are any (pnl > 0). Money the
//   owner put in is money he already gave; the old "everything above the
//   float" rule read a $4,000 top-up as $2,000 of winnings and offered to take
//   the owner's own chips back out of the pocket he had just filled.
//
//   CALL HIM IN is the way the principal comes home, and it is only offered
//   while he is at a table — off the table, calling him in is the same call as
//   collecting the lot, and one button for it is enough.
//
// All three can stand on one row. None at all is not a row.
export function rowActions(pocket, { seated = false } = {}) {
  if (!pocket) return { fund: true, collect: false, callIn: false };
  const calledIn = pocket.mode === 'cut';
  // Called in and still holding chips: the sweep has not caught up with him
  // yet, so Collect is how the rest of it comes home.
  if (calledIn) {
    return { fund: true, collect: pocket.balance > 0, callIn: false };
  }
  if (pocket.balance <= 0) return { fund: true, collect: false, callIn: false };
  // The projection says what a collect would take; without it, any balance
  // counts. Winnings still have to be there for Collect to mean anything.
  const offered = pocket.collectable === null || pocket.collectable === undefined
    ? true
    : pocket.collectable > 0;
  return { fund: true, collect: offered && (pocket.pnl ?? 0) > 0, callIn: !!seated };
}

// A called-in pocket hands back all of it, principal included — he is not
// sitting down again. Every other collect takes the winnings and no more.
export function collectsEverything(pocket) {
  return pocket?.mode === 'cut';
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

// Both verbs go to /fund: one moves money out to him, the other brings it
// back, and both are the same decision about how he is backed. The route maps
// the verb onto the mode the store holds.
export async function fundAgent(agentId, { verb = 'give', amount = null, cap = null, refill = false } = {}) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/fund`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId: getUserId(), verb, amount, cap, refill }),
  });
  if (!res.ok) throw new Error(`fund failed (${res.status})`);
  return res.json();
}

export function callInAgent(agentId) {
  return fundAgent(agentId, { verb: 'callin', amount: null, cap: null, refill: false });
}

export async function collectFrom(agentId, { all = false } = {}) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/collect`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId: getUserId(), all }),
  });
  if (!res.ok) throw new Error(`collect failed (${res.status})`);
  return res.json();
}
