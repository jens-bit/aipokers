// WATCH v3 — haptics.
//
// The contract from design-refs/mood-ww-ref.jsx (S2 · haptics and sound), one
// entry per event. Telegram's HapticFeedback is the only haptic API in play;
// outside Telegram every call is a no-op, so callers never have to guard.
//
// Sound is a second layer with a mute toggle (lib/audio.js), which means every
// beat in the table below has to land on haptics alone — the phone is on silent
// in a bar.
//
// THE RULES, and they are enforced here rather than at each call site:
//   · haptics fire on HIS events only — never an opponent's action
//   · never two inside 120ms
//   · nothing while the app is backgrounded
//   · nothing for an unwatched hand (the watch screen is the only caller)
//
// BANNED, and absent by construction: slot-machine reels, coin showers,
// applause, near-miss stings. The owner is not playing the hand and the device
// must never imply that he is.

export const HAPTICS = {
  // CLEAN-1: HAPTIC4 asks for a tap per hero card 90ms apart, and the 120ms
  // floor above makes the second one unreachable. The floor is the older law
  // and the stronger one, so the deal is one tap — on the first card landing,
  // the beat that starts the hand — rather than a second call that is written
  // down and then swallowed.
  cardDealt: { kind: 'impact', style: 'light', note: 'once, as the first card lands' },
  hisAction: { kind: 'impact', style: 'medium', note: 'only his — never an opponent’s' },
  heating: { kind: 'impact', style: 'rigid', note: 'once per hand, never repeated' },
  allin: { kind: 'notification', style: 'warning', note: 'the loudest thing in the product' },
  runoutCard: { kind: 'impact', style: 'soft', note: 'during the hold only' },
  wonPot: { kind: 'notification', style: 'success', note: 'no fanfare, no jingle' },
  lostPot: { kind: 'impact', style: 'soft', note: 'losing is quiet on purpose' },
  readForms: { kind: 'selection', style: null, note: 'the panel animates instead' },
  // CLEAN-1: the three v4b rows, as their own entries. Folding them onto
  // cardDealt or runoutCard would have made the table lie about what the device
  // is reporting, and a row nobody can name is a row nobody can change.
  heroCardWarms: { kind: 'impact', style: 'light', note: 'owner-only — a spectator never feels it' },
  bubbleAppears: { kind: 'impact', style: 'light', note: 'his and theirs alike, the lightest event here' },
  showdownReveal: { kind: 'impact', style: 'medium', note: 'once, when the cards turn over' },
  predictionRight: { kind: 'impact', style: 'light', note: 'the streak number is the reward' },
  collectConfirmed: { kind: 'notification', style: 'success', note: 'a transfer, not a jackpot' },
};

export const MIN_GAP_MS = 120;

let lastFiredAt = 0;

/** Test seam: forget the throttle between cases. */
export function resetHaptics() {
  lastFiredAt = 0;
}

function api() {
  const hf = typeof window !== 'undefined' ? window.Telegram?.WebApp?.HapticFeedback : null;
  return hf && typeof hf === 'object' ? hf : null;
}

function backgrounded() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Fire one event from the table above.
 *
 * Returns true when the device was actually asked to buzz, so a caller that
 * needs to know (a test, or a once-per-hand latch) can tell the difference
 * between "fired" and "swallowed". Never throws: a haptic failing is not worth
 * taking a screen down for.
 */
export function fire(event, now = Date.now()) {
  const spec = HAPTICS[event];
  if (!spec) return false;
  if (backgrounded()) return false;
  if (now - lastFiredAt < MIN_GAP_MS) return false;

  const hf = api();
  if (!hf) return false;

  try {
    if (spec.kind === 'impact' && typeof hf.impactOccurred === 'function') {
      hf.impactOccurred(spec.style);
    } else if (spec.kind === 'notification' && typeof hf.notificationOccurred === 'function') {
      hf.notificationOccurred(spec.style);
    } else if (spec.kind === 'selection' && typeof hf.selectionChanged === 'function') {
      hf.selectionChanged();
    } else {
      return false;
    }
  } catch {
    return false;
  }

  lastFiredAt = now;
  return true;
}
