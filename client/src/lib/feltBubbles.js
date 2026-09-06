// client/src/lib/feltBubbles.js — WATCH-10 job 2
//
// WHERE TABLE TALK GOES, AND WHEN IT DOES NOT GO ANYWHERE.
//
// lib/bubbles.js decides WHICH bubbles are live: one per seat, at most two, a
// few seconds each, and nothing that would be cut off. It has never decided
// WHERE they go — watch.css did, with one fixed corner per slot:
//
//   tl  left: 6px      tc  centred      tr  right: 6px
//
// A bubble is up to 150px wide on a 390px felt, so tl ran to 156 and tc began
// at 120: any two of the three top seats speaking at once put one man's words
// across another's. The rule that fixes it already exists — FIX-6 job 3 wrote
// it for the flat, and lib/bubblePlace.js now holds the part of it that is not
// about a particular stylesheet. This file is the felt's geometry for it.
//
// A bubble opens LEFT or RIGHT of the seat that said it, in the band that slot
// speaks in, and it takes the first side that is clear of the felt's edge, of
// every name pill, and of every bubble already placed. If neither side is
// clear it is NOT SHOWN — which is lib/bubbles.js's own last clause ("a bubble
// that would be cut off is not shown; the record has it either way") applied to
// being cut off by a neighbour rather than by the edge. The felt does not queue.
// A hand is a performance that cannot be paused, and the thread has every word.
//
// THE BOXES ARE MODELLED, NOT MEASURED (see lib/bubblePlace.js's header), off
// watch.css and system/SeatGhost.jsx, and every one of them rounds UP.

import { place } from './bubblePlace.js';
import { SEAT_BODY, SEAT_GAP, SEAT_PILL } from '../components/system/SeatGhost.jsx';
import { pillName } from './names.js';

/** The Mini App's own width, and the narrowest the felt is ever drawn at. */
export const FELT_W = 390;
/** watch.css's fallback for --wv-pot, in px. */
export const POT_TOP = 209;
/** No box comes closer than this to the felt's edge. */
export const EDGE = 6;

// ── the seats, from watch.css ───────────────────────────────────────────────
// `.watch-felt__seat--*` — the left is a percentage so the composition survives
// a wider stage, and the top is a constant except on the rails, which ride
// above the pot.
export const SEAT_X = { tl: 0.19, tc: 0.5, tr: 0.81, ml: 0.125, mr: 0.875 };
const SEAT_TOP = { tl: 12, tc: 8, tr: 12 };

/** Where the top of this slot's seat is. The rails ride above the pot. */
export function seatTop(slot, potTop = POT_TOP) {
  if (slot === 'ml' || slot === 'mr') return Math.max(48, potTop - 26);
  return SEAT_TOP[slot] ?? 12;
}

/** Where this slot's seat is centred, in px. */
export function seatX(slot, width = FELT_W) {
  return (SEAT_X[slot] ?? 0.5) * width;
}

// ── the name pill ───────────────────────────────────────────────────────────
// `.seat-ghost__chip` is 18px tall with 7px of padding a side and a border, and
// since WATCH-10 it holds the name and nothing else. 9.5px at weight 500 is
// about 5.6px a character; rounded up, and never narrower than the two body
// bars along its bottom edge need.
const PILL_PAD = 16;
const PILL_MIN_W = 46;
const NAME_CHAR_W = 6.0;

export function pillWidth(name) {
  return Math.max(PILL_MIN_W, PILL_PAD + pillName(name).length * NAME_CHAR_W);
}

/** The name pill's box for a seat in this slot. */
export function pillRect({ slot, name }, { width = FELT_W, potTop = POT_TOP } = {}) {
  const x = seatX(slot, width);
  const w = pillWidth(name);
  const top = seatTop(slot, potTop) + SEAT_BODY + SEAT_GAP;
  return { left: x - w / 2, right: x + w / 2, top, bottom: top + SEAT_PILL };
}

// ── the bubble ──────────────────────────────────────────────────────────────
// `.bubble__box`: 10px of padding a side and a border (22), one line of 11.5px
// at line-height 1.4 inside 7px of padding and a border (32.1), and a 150px
// ceiling from `.watch-felt__bubble`'s max-width. Italic 11.5px runs about
// 6.0px a character; 6.4 is what this rounds up to, and the two quotation marks
// the component adds are counted.
export const BUBBLE_MAX_W = 150;
export const BUBBLE_H = 34;
const BUBBLE_PAD = 22;
const BUBBLE_CHAR_W = 6.4;

/** How wide this bubble draws, near enough and never under. */
export function bubbleWidth(text) {
  const len = String(text ?? '').length + 2;
  return Math.min(BUBBLE_MAX_W, BUBBLE_PAD + len * BUBBLE_CHAR_W);
}

// THE TAIL POINTS AT WHOEVER SAID IT — "that is the entire mechanism by which
// you know who is speaking" (mood-watch4.jsx). So a bubble does not start
// beside its seat, it starts a tail's width BEFORE it: the near edge sits at
// x − 14 opening right, at x + 14 opening left, and the tail is drawn 14px in
// from that edge, which puts its point on the seat's own centre either way.
export const TAIL_IN = 14;

// The two bands the felt speaks in. The top row speaks BELOW itself — there is
// nothing above a seat that starts 8px from the top of the felt — under the
// seat and under the pile it banks. The rails speak ABOVE themselves, where
// there is only felt, because below them is the board.
export const TOP_BAND = 94;
const RAIL_LIFT = 6;

/** The top edge of this slot's speaking band. */
export function bandTop(slot, potTop = POT_TOP) {
  if (slot === 'ml' || slot === 'mr') {
    return Math.max(EDGE, seatTop(slot, potTop) - RAIL_LIFT - BUBBLE_H);
  }
  return TOP_BAND;
}

/**
 * The bubble's box for one side, or null when the felt's edge would cut it.
 *
 * A clipped bubble is cut silently — `.watch-felt` is overflow: hidden — so
 * this is checked before anything else, exactly as the room checks flat.js's
 * own edge rule first.
 */
export function bubbleRect(speaker, side, { width = FELT_W, potTop = POT_TOP } = {}) {
  const x = seatX(speaker.slot, width);
  const w = bubbleWidth(speaker.text);
  const left = side === 'right' ? x - TAIL_IN : x + TAIL_IN - w;
  const right = left + w;
  if (left < EDGE || right > width - EDGE) return null;
  const top = bandTop(speaker.slot, potTop);
  return { left, right, top, bottom: top + BUBBLE_H };
}

/** Away from the nearer edge first, which is the side with more room in it. */
export function sidesFor(speaker, width = FELT_W) {
  return seatX(speaker.slot, width) < width / 2 ? ['right', 'left'] : ['left', 'right'];
}

/**
 * Which of these bubbles the felt can actually draw, and which way each opens.
 *
 * @param speakers  live bubbles, PRIORITY FIRST — lib/bubbles.js's law is that
 *                  the newest win, so the caller hands them over newest first
 * @param seats     every seat on the felt, `{ slot, name }`, for their pills
 * @returns the ones that fit, each carrying the `side` it took. Anything not in
 *          the list is not drawn; the thread still has it.
 */
export function placeOnFelt(speakers = [], seats = [], { width = FELT_W, potTop = POT_TOP, max = 2 } = {}) {
  return place(speakers, {
    max,
    sides: (s) => sidesFor(s, width),
    rect: (s, side) => bubbleRect(s, side, { width, potTop }),
    blockers: seats.filter(Boolean).map((s) => pillRect(s, { width, potTop })),
  });
}

/**
 * The sides, by bubble id — what a component actually wants, because it renders
 * in its own order and only needs to know "does this one draw, and which way".
 */
export function sidesById(speakers = [], seats = [], opts = {}) {
  const out = new Map();
  for (const s of placeOnFelt(speakers, seats, opts)) out.set(s.id, s.side);
  return out;
}
