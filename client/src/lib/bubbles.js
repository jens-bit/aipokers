// WATCH v4 — the bubble law.
// design-refs/mood-watch4.jsx, header: "THE BUBBLE LAW (the Hearthstone whisper
// pattern)".
//
//   · one bubble per seat at a time, and at most TWO on the felt at once
//   · 3–4 seconds, then gone. Never a queue, never a stack, never a scrollback
//   · his sits above the hero row; an opponent's sits above their own ghost
//   · a bubble that would be cut off is not shown — the record has it either way
//
// The last clause is why this is a module and not an array in a component: the
// felt is a performance and the TABLE tab is the transcript, and the two must be
// able to disagree. Everything said goes to the record; only what fits, and only
// while it is fresh, goes on the felt.
//
// Pure: no DOM, no timers, no React. The screen supplies `now`.

export const BUBBLE_MS = 3500;   // "3–4 seconds, then gone"
export const MAX_ON_FELT = 2;

// An opponent's bubble is one line by decision — table talk IS one line
// ("Again?", "Call.", "Too rich for me."). His band reserves two.
export const OPP_MAX_CHARS = 42;
export const MINE_MAX_CHARS = 120;

/**
 * Would this bubble be cut off?
 *
 * The refs set opponent bubbles to a fixed 142px single line and reserve a
 * two-line band for his. Rather than measure text in a layout engine that does
 * not exist yet, the length that fits those boxes is the gate — and a line that
 * does not fit is not shown at all, instead of being shown with an ellipsis
 * that hides what he said.
 */
export function fits(text, mine) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return false;
  return t.length <= (mine ? MINE_MAX_CHARS : OPP_MAX_CHARS);
}

/**
 * Which bubbles belong on the felt right now.
 *
 * @param said  utterances, oldest first: { id, seat, text, mine, at }
 * @param now   ms
 * @returns at most MAX_ON_FELT entries, newest last, one per seat
 */
export function onFelt(said, now = Date.now()) {
  const list = Array.isArray(said) ? said : [];

  // One per seat: a seat that speaks twice replaces itself rather than stacking.
  const bySeat = new Map();
  for (const u of list) {
    if (!u || !Number.isFinite(u.at)) continue;
    if (now - u.at >= BUBBLE_MS) continue;          // 3–4s, then gone
    if (!fits(u.text, u.mine)) continue;            // would be cut off: not shown
    bySeat.set(u.seat, u);
  }

  // At most two, and the newest win — a busy table does not queue.
  return [...bySeat.values()]
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_ON_FELT);
}

/**
 * The record: everything said, in order, whoever said it, whether or not it
 * ever reached the felt. This is what the TABLE tab draws.
 */
export function record(said) {
  return (Array.isArray(said) ? said : []).filter((u) => u && typeof u.text === 'string' && u.text.trim());
}
