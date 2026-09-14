// src/server/houseBank.js — MONEY-1 job 3
//
// THE CASINO'S OWN CHIPS. One counter, server-wide, and the counterparty for
// every chip that goes onto a felt.
//
// ── Why this has to exist ────────────────────────────────────────────────────
//
// read-me-claude/MONEY_AUDIT.md §6.1: before this, a table stack was a display
// number. `seatAI` wrote `seatStacks[free] = aiBuyIn` and that was the whole of
// where the chips came from, so every House regular who sat down minted a full
// buy-in and every one who left with chips destroyed them. An agent who busted
// the House fourteen times over a hundred hands finished with 30,000 in front
// of him against one 2,000 buy-in, and `finishAgentSession` banked all of it.
//
// The fix is not to stop refilling the felt — a session that ends the moment
// the hero wins is not a session. It is to give the House a bankroll, so that
// the chips it loses are chips it HAD.
//
// ── The model, in four lines ─────────────────────────────────────────────────
//
//   A buy-in moves chips POCKET  -> BANK.     The cage takes his money.
//   A cash-out moves chips BANK  -> POCKET.   The cage pays him out.
//   Everything on the felt is a CLAIM against the bank, not chips of its own.
//   Therefore:  Σ safes + Σ pockets + bank  is constant, always.
//
// That last line is the whole point, and it is what the conservation suite
// asserts. Note what it does NOT contain: table stacks. A stack is a claim the
// bank is holding the chips for — which is exactly what the audit found it
// already was, except that now the claim is backed. Chips moving between two
// stacks inside a hand changes who the bank owes and nothing else, which is
// why the engine needed no changes at all.
//
// A House seat therefore costs the bank nothing when it sits down: its stack is
// notional like every other. The bank only moves when a real owner's chips
// cross the rail. An agent who takes 6,000 off three busted Houses is paid
// 6,000 out of the bank, and the bank is 6,000 lighter — which is what "the
// house lost tonight" means, and it is now a number somebody can read.
//
// ── Two deliberate choices ───────────────────────────────────────────────────
//
// 1. THE FLOAT IS LARGE AND IS NOT A GATE. Play money. A bank that could
//    refuse to pay a winner because it had had a bad night would be a worse
//    bug than the one this replaces, so `pay` is always honoured and a bank
//    that goes below zero SHOUTS rather than blocking. That never happening is
//    an operational property, not a correctness one.
// 2. IT PERSISTS IN `meta`, NOT IN A WALLET ROW. A wallet row would appear in
//    listOwners(), in the admin dashboard's owner counts and in every loop that
//    walks owners — the house is not an owner, and giving it an owner id would
//    have it turn up as a player in a dozen places that have no idea it exists.

import { loadHouseBank, saveHouseBank } from './store.js';

// What the house starts with, the first time a database is asked for a bank.
// Chosen to be far beyond anything play-money traffic can move: if this ever
// binds, something else is wrong and the log line below is the thing to read.
export const HOUSE_FLOAT = 50_000_000;

// Cached like the wallets are, and written through on every move. `null` means
// "not read yet" — distinct from a bank that is genuinely at zero.
let cached = null;
let cachedFor = null;   // the cwd the number was read against (tests chdir)

const int = (n) => (Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 0);

function read() {
  const cwd = process.cwd();
  if (cached !== null && cachedFor === cwd) return cached;
  let stored = null;
  try { stored = loadHouseBank(); } catch (err) {
    console.error('[house] could not read the bank:', err.message);
  }
  if (stored === null) {
    cached = HOUSE_FLOAT;
    cachedFor = cwd;
    write();
    console.log(`[house] bank opened at ${HOUSE_FLOAT.toLocaleString('en-US')}`);
    return cached;
  }
  cached = stored;
  cachedFor = cwd;
  return cached;
}

function write() {
  try { saveHouseBank(cached); } catch (err) {
    console.error('[house] could not save the bank:', err.message);
  }
}

/** What the house is holding right now. */
export function balance() {
  return read();
}

/**
 * Chips cross the rail INTO the cage — a buy-in. Returns the new balance.
 *
 * `why` is logged, never stored: the bank is a counter and a ledger of every
 * buy-in in the building would be a second copy of the pocket ledgers that
 * already hold them, one per owner, where they can be read by the person whose
 * money it is.
 */
export function take(amount, why = '') {
  const moved = Math.max(0, int(amount));
  if (moved === 0) return read();
  cached = read() + moved;
  write();
  return cached;
}

/**
 * Chips cross the rail OUT of the cage — a cash-out. Returns the new balance.
 *
 * Always honoured (see choice 1 above). A bank that goes negative is a real
 * event and gets a real line in the log, because it means the float was set
 * too low for the traffic and somebody has to raise it — it does not mean a
 * winner goes unpaid.
 */
export function pay(amount, why = '') {
  const moved = Math.max(0, int(amount));
  if (moved === 0) return read();
  cached = read() - moved;
  write();
  if (cached < 0) {
    console.error(`[house] BANK IS NEGATIVE: ${cached.toLocaleString('en-US')} after paying ` +
      `${moved.toLocaleString('en-US')}${why ? ` (${why})` : ''}. Raise HOUSE_FLOAT.`);
  }
  return cached;
}

/**
 * Set the bank outright. For tests and for an operator who has decided what the
 * float should be. Nothing in the product calls this: every other movement in
 * this module is a transfer, and a setter that ordinary code could reach is a
 * setter that would eventually be used to paper over a leak.
 */
export function reset(to = HOUSE_FLOAT) {
  cached = int(to);
  cachedFor = process.cwd();
  write();
  return cached;
}

/** Drop the cache without touching storage — a test that chdir'd needs this. */
export function _forgetForTests() {
  cached = null;
  cachedFor = null;
}
