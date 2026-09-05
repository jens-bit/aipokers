// WATCH v3 — the prediction beat.
//
// A bet ON him, never a control. The verb is his ("he's going to…"), the chips
// lock the moment he acts, and there is nothing to spend. No coins, no streak
// reward — the streak is the whole prize.
//
// Behind a flag and off by default: this is the one part of the wave that could
// turn a manager game into a clicker if it reads wrong, so it ships dark and
// gets turned on deliberately.
//
// Pure except for the flag read and the in-memory streak, both of which have
// test seams.

export const GUESSES = ['Fold', 'Call', 'Raise'];

const FLAG = 'ap_predict';

/** Off unless localStorage says otherwise. A blocked store reads as off. */
export function predictEnabled() {
  try {
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

// The streak lives for as long as the tab does and no longer. Nothing about it
// is written down: a number the owner cannot bank is a number the product
// cannot dangle.
let streak = 0;

export function getStreak() {
  return streak;
}

export function resetPredict() {
  streak = 0;
}

/**
 * Which chip an action settles. Anything that is not a fold or a raise is a
 * call — a check is him calling for nothing, which is what the chip means to
 * someone who is not a poker player.
 */
export function guessFor(action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t === 'fold') return 'Fold';
  if (t === 'raise' || t === 'bet' || t === 'allin' || t === 'all-in') return 'Raise';
  if (t === 'call' || t === 'check') return 'Call';
  return null;
}

/**
 * Settle a pick against what he actually did.
 *
 * Returns { right, streak }. A right guess extends the streak, a wrong one
 * takes it to zero, and an action that maps to no chip leaves both alone —
 * the owner should not lose a streak to a spot the chips could not express.
 */
export function settle(picked, action) {
  const actual = guessFor(action);
  if (!picked || !actual) return { right: null, streak };
  const right = picked === actual;
  streak = right ? streak + 1 : 0;
  return { right, streak };
}
