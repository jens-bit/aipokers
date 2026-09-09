// Per-viewer mute plus original synthesized effects. Audio starts only after
// a user gesture; silent/blocked browsers do not report a sound as played.
import { playEffect, resetEngine, stopSounds, unlockEngine } from './audioEngine.js';

export const SOUNDS = {
  cardDealt: { file: 'deal-tick', ms: 12, note: 'one per card, 90ms apart' },
  hisAction: { file: 'chip-set-down', ms: 140, note: 'only his' },
  heating: { file: 'low-swell', ms: 400, note: 'once per hand' },
  allin: { file: 'heavy-hit', ms: 700, note: 'heavy hit + room hush' },
  runoutCard: { file: 'deal-tick-up', ms: 12, note: 'pitched up, during the hold' },
  // WATCH-7: the hand end is the result toast, and the toast has a voice.
  // Winning is a short chip CHING — one chip set down on a stack, not a
  // cascade and not a jingle.
  wonPot: { file: 'chip-ching', ms: 220, note: 'a short chip ching under the +$ toast' },
  // W3-3 held that losing is silent, "because a loss sound is the product
  // telling the owner off". The WATCH-7 playtest overrules it: with the WON/LOST
  // ceremony gone from the hand end, a silent loss is not restraint, it is the
  // screen failing to say anything happened. So a loss gets a LOW DESCENDING
  // WOMP — 300ms, falling, no sting and no near-miss — and no guilt with it.
  // It is a sound, not a verdict, and the toggle silences it like everything
  // else here.
  lostPot: { file: 'low-womp', ms: 300, note: 'a low descending womp under the −$ toast' },
  winSwell: { file: 'win_swell', ms: 400, note: 'C8: one low room swell, no cheer' },
  bigWinBursts: { file: 'big_win_bursts', ms: 1200, note: 'C8: three soft reports at 0, 260, 520ms' },
  bustKnock: { file: 'bust_knock', ms: 100, note: 'C8: dry knock at pill landing; room effects duck for 600ms' },
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
  if (muted) stopSounds();
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    // A viewer with site data blocked still gets the toggle for this session.
  }
  for (const fn of listeners) fn(muted);
  return muted;
}

export function toggleMuted() {
  const next=setMuted(!isMuted());
  if(!next)unlockAudio();
  return next;
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
  resetEngine();
}

/** Explicitly called from a user gesture, never from an incoming game frame. */
export function unlockAudio() { return !isMuted() && unlockEngine(); }

export function installAudioUnlock(target=window) {
  const unlock=()=>unlockAudio();
  const hide=()=>{if(document.visibilityState==='hidden')stopSounds();};
  target.addEventListener('pointerdown',unlock,{passive:true});
  target.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',hide);
  return ()=>{target.removeEventListener('pointerdown',unlock);target.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',hide);};
}

/** Returns the scheduled sound, or null if muted, locked, hidden or unavailable. */
export function play(event,options) {
  const sound=SOUNDS[event]??null;
  return sound&&!isMuted()&&playEffect(sound,options)?sound:null;
}

/** Both layers for one event, in the order the ww-ref lists them. */
export function beat(event, fireHaptic) {
  const felt = fireHaptic ? fireHaptic(event) : false;
  const heard = play(event);
  return { felt, heard };
}
