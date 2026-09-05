// WATCH v3 — the sound layer, as a stub.
//
// The sounds themselves are not shipped in this wave; the hooks are, so the
// call sites land now and the files drop in later without touching the screens.
// Every entry is the sound column of the ww-ref's haptics table.
//
// Muting is the point of the layer existing separately from haptics: the phone
// is on silent in a bar, so every beat has to survive with the sound off. The
// preference is per-device and per-viewer, which is exactly what localStorage
// is for; it is read defensively because a private window throws on access.

export const SOUNDS = {
  cardDealt: { file: 'deal-tick', ms: 12, note: 'one per card, 90ms apart' },
  hisAction: { file: 'chip-set-down', ms: 140, note: 'only his' },
  heating: { file: 'low-swell', ms: 400, note: 'once per hand' },
  allin: { file: 'heavy-hit', ms: 700, note: 'heavy hit + room hush' },
  runoutCard: { file: 'deal-tick-up', ms: 12, note: 'pitched up, during the hold' },
  wonPot: { file: 'chips-sliding', ms: 700, note: 'no fanfare, no jingle' },
  // Losing is quiet on purpose. A loss sound is the product telling the owner
  // off, and there is no guilt in this design.
  lostPot: null,
  readForms: null,
  predictionRight: null,
  collectConfirmed: { file: 'soft-note', ms: 300, note: 'a transfer, not a jackpot' },
};

const KEY = 'ap_muted';

let muted = null;      // lazily read, then cached
const listeners = new Set();

function readStored() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted() {
  if (muted === null) muted = readStored();
  return muted;
}

export function setMuted(next) {
  muted = !!next;
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    // A viewer with site data blocked still gets the toggle for this session.
  }
  for (const fn of listeners) fn(muted);
  return muted;
}

export function toggleMuted() {
  return setMuted(!isMuted());
}

/** Subscribe to mute changes; returns the unsubscribe. */
export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test seam: forget the cached preference and every listener. */
export function resetAudio() {
  muted = null;
  listeners.clear();
}

/**
 * Play one beat. A stub: it resolves what *would* be played and returns it, so
 * the wiring is testable today and the only change when the files arrive is
 * inside this function.
 *
 * Returns the sound that played, or null when there is nothing to play — muted,
 * or an event that is deliberately silent.
 */
export function play(event) {
  const sound = SOUNDS[event] ?? null;
  if (!sound) return null;
  if (isMuted()) return null;
  // TODO(W3-3): the audio files are not in the bundle yet. When they land, this
  // is the one place that changes — an AudioContext primed on the first user
  // gesture, then a buffer per file.
  return sound;
}

/** Both layers for one event, in the order the ww-ref lists them. */
export function beat(event, fireHaptic) {
  const felt = fireHaptic ? fireHaptic(event) : false;
  const heard = play(event);
  return { felt, heard };
}
