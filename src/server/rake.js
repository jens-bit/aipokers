// src/server/rake.js — MONEY-2 job 3
//
// THE HOUSE'S CUT.
//
// MONEY-1 gave the casino a bankroll and made every chip on a felt a claim
// against it, so that `Σ safes + Σ pockets + bank` stopped moving. That fixed
// conservation and left the economy with no drain at all: a population of
// agents playing against House regulars takes chips off the bank on every
// winning night and gives none back except by losing, and the only sink in the
// product is the fridge. Total chips in owner hands climb.
//
// A rake is the drain, and it is the one every cardroom in the world uses
// because a player already understands it.
//
// ── The rules, and only these ────────────────────────────────────────────────
//
//   A percentage of the pot, capped at some number of big blinds.
//   Casino tables only. Never the kitchen table.
//   It is taken from the winner's stack the moment the pot is awarded.
//   It is VISIBLE: named on the result line, and a line in the safe ledger.
//
// Both numbers are env-configurable (`RAKE_PERCENT`, `RAKE_CAP_BB`) and are
// read at call time rather than at import, so the simulation can sweep them in
// one process and an operator can change one without a deploy.
//
// ── Where the chips actually go ──────────────────────────────────────────────
//
// Nowhere, at the moment they are taken — and that is not a dodge, it is the
// direct consequence of MONEY-1's model. A stack is a CLAIM against the bank;
// the chips behind it are already inside `houseBank`. Shrinking the claim by
// the rake means the bank owes that much less, so the bank keeps it at
// settlement without a single write at the moment of the rake. Taking the rake
// AND calling `houseBank.take()` would count it twice and mint chips — the
// conservation suite fails on exactly that if anybody tries.
//
// The bank therefore earns the rake at the rail, when the man stands up, which
// is also where it becomes legible: `finishAgentSession` pays out the GROSS and
// takes the rake back in the same breath, so the safe shows both lines and the
// pocket ledger still sums to the pocket balance (`scripts/audit-chips.js`).
//
// A rake on a pot a HOUSE regular wins is a no-op in the books, and correctly
// so: a House stack is notional and never settles, so there is nothing to keep.
// The drain is on chips owners take home, which is the number that was climbing.

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// The tuned defaults. `scripts/simulate-economy.js --sweep` chose them and
// read-me-claude/MONEY_AUDIT.md §18 is the measurement; re-run it before moving
// either number.
//
// ONE PERCENT IS SMALL ON PURPOSE, and the reason is the thing the simulation
// actually found: with MONEY-1's house bank in place there is no longer a climb
// to cancel. Ten runs of ~1,500 hands with the rake off put a twelve-agent
// population at -0.3% — flat, inside its own noise. So the rake is not a brake
// on a runaway number any more. It is the structural guarantee that the number
// CANNOT run away, and it has to be small enough not to become the thing that
// empties people's safes.
//
// Measured, per thousand hands, against a 120,000-chip population:
//
//     1%   1,170 raked    drift -1.9%   ~= the rake itself
//     2%   2,620 raked    drift -6.5%   ~= twice the rake
//     3%   4,000 raked    drift -13.5%
//
// The drift running ahead of the rake from 2% upwards is the compounding: a
// shaved stack busts sooner, a bust costs a whole buy-in, and the safe drains
// faster than the cut alone explains. At 1% it has not started.
//
// And the error to prefer is the small one. Too little rake means the number
// creeps up and somebody raises `RAKE_PERCENT` — no deploy, no code change.
// Too much means people lose bankrolls they will not get back, and there is no
// setting that gives those back.
//
// The cap is three big blinds and it barely binds at the entry rung — 2bb and
// 3bb came back within 1.1% of each other there, because the percentage is what
// binds. It earns its keep upstairs, where one percent of a 20,000 pot is 200:
// three big blinds is 60 on the floor, 150 upstairs and 300 in the back room.
export const DEFAULT_RAKE_PERCENT = 1;
export const DEFAULT_RAKE_CAP_BB = 3;

/**
 * What the house takes, as configured right now.
 *
 * Read per call. `RAKE_PERCENT=0` switches the rake off entirely, which is the
 * way back from a bad setting without a deploy — the same shape COST-1's
 * `DECISION_ROUTER=off` has, and for the same reason.
 */
export function rakeSettings() {
  const percent = Math.max(0, Math.min(100, num(process.env.RAKE_PERCENT, DEFAULT_RAKE_PERCENT)));
  const capBb = Math.max(0, num(process.env.RAKE_CAP_BB, DEFAULT_RAKE_CAP_BB));
  return { percent, capBb };
}

/**
 * The rake on one pot. Whole chips, floored — the house never rounds up.
 *
 * Returns 0 for a pot of nothing, a percent of nothing, or a cap of nothing, so
 * every one of those is a complete switch-off on its own.
 */
export function rakeFor(pot, bigBlind, settings = rakeSettings()) {
  const chips = Math.max(0, Math.floor(num(pot, 0)));
  const bb = Math.max(0, Math.floor(num(bigBlind, 0)));
  const { percent, capBb } = settings;
  if (chips <= 0 || percent <= 0 || capBb <= 0 || bb <= 0) return 0;
  const cap = Math.floor(capBb * bb);
  return Math.min(Math.floor((chips * percent) / 100), cap, chips);
}

/**
 * Split one pot's rake across the seats that won it, in proportion to what each
 * took — a split pot is two winners and one rake, not two rakes.
 *
 * The remainder from the flooring goes to the biggest winner, and to the lowest
 * seat among equals, so the split is deterministic and the total is exactly
 * `total`. Returns a Map of seat → chips, with zero-shares left out.
 */
export function splitRake(total, winners) {
  const owed = Math.max(0, Math.floor(num(total, 0)));
  const rows = (Array.isArray(winners) ? winners : [])
    .map((w) => ({ seat: w?.seat, amount: Math.max(0, Math.floor(num(w?.amount, 0))) }))
    .filter((w) => Number.isInteger(w.seat) && w.amount > 0);
  const out = new Map();
  if (owed <= 0 || rows.length === 0) return out;

  const won = rows.reduce((n, w) => n + w.amount, 0);
  let handed = 0;
  for (const row of rows) {
    const share = Math.floor((owed * row.amount) / won);
    if (share > 0) out.set(row.seat, share);
    handed += share;
  }

  let remainder = owed - handed;
  if (remainder > 0) {
    const biggest = [...rows].sort((a, b) => b.amount - a.amount || a.seat - b.seat)[0];
    out.set(biggest.seat, (out.get(biggest.seat) ?? 0) + remainder);
    remainder = 0;
  }
  return out;
}

/**
 * The phrase the result line and the thread use. One shape, one place, so the
 * felt and the history cannot describe the same cut two different ways.
 */
export function rakeLine(amount) {
  const chips = Math.max(0, Math.floor(num(amount, 0)));
  return chips > 0 ? `${chips.toLocaleString('en-US')} to the house` : '';
}
