// client/src/hooks/useSheetDrag.js — BUGS-A job 5
//
// A SHEET IS DISMISSED WITH A FINGER, not only by finding its handle.
//
// Every sheet in this app came up over something the owner was already looking
// at — the room, the felt — and every one of them could only be put away by
// hitting a 34×3px grab bar or a ✕ in a corner. That is a target you aim at.
// The gesture a phone has taught everybody is: push the sheet back down. It
// works anywhere on the sheet, it needs no aim, and it is reversible — let go
// short of the threshold and the sheet comes back.
//
// THE THREE RULES THAT KEEP IT FROM FIGHTING THE SHEET'S OWN CONTENT:
//
//   1. A DRAG THAT STARTS IN A FIELD IS THE CARET. Same rule WhisperComposer
//      already follows: touching an input is placing a cursor, never a swipe.
//   2. A DRAG THAT STARTS IN A SCROLLED LIST IS THE LIST. If anything between
//      the finger and the sheet has scrolled at all, the sheet does not move —
//      the owner is reading, and pulling the whole sheet out from under a
//      half-read thread is the worst possible reading of that gesture. At the
//      very top of the list there is nothing left to scroll to, and the drag
//      is the sheet's. This is what iOS does and what a hand expects.
//   3. THE WINDOW OWNS THE DRAG ONCE IT STARTS. A mouse has no implicit
//      capture and a sheet that travels 200px leaves its own start point, so
//      the move and the release are tracked on the window — the same fix
//      WATCH-7 had to make for the composer's swipe.
//
// Down only. A sheet that can be dragged UP is a sheet with a second size, and
// none of these have one.

import { useEffect, useRef, useState } from 'react';

/** How far down the sheet has to travel before letting go dismisses it. */
export const DISMISS_PX = 88;

// BUG-206: a plain tap on a button inside the sheet (an agent row, the ✕) was
// entering "dragging" on touchstart before the finger had moved at all — that
// state flip (is-dragging class, transition:none) mid-gesture is what makes a
// phone browser withhold the synthesized click for that touch, so the first
// tap did nothing and it took two or three tries to land. A tap now stays a
// tap — "dragging" only starts once the finger has actually travelled past
// this many px, so a touch that never moves never touches React state and the
// click fires normally.
const TAP_SLOP_PX = 10;

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Rule 1: a drag that starts in a field is the caret being placed. */
export function isFieldTarget(el) {
  return !!el && (FIELDS.has(el.tagName) || el.isContentEditable === true);
}

/**
 * Rule 2: is anything between this node and `root` scrolled away from its top?
 *
 * Deliberately `scrollTop > 0` rather than "is scrollable": a list sitting at
 * its top has nothing above to reveal, so a downward drag there is not a
 * scroll and the sheet may take it.
 */
export function inScrolledRegion(el, root) {
  let node = el;
  while (node && node !== root?.parentNode) {
    if (node.scrollTop > 0) return true;
    node = node.parentNode;
  }
  return false;
}

/**
 * Drag-down-to-dismiss for one sheet.
 *
 * @param {Function} onDismiss  called once, when the release is past threshold
 * @param {object}   opts
 * @param {number}   opts.threshold  px of travel that counts as "put it away"
 * @param {boolean}  opts.enabled    off for a sheet that must be answered
 * @returns {{ ref, dy, dragging, handlers, style }}
 *   `ref` goes on the panel (it bounds rule 2), `handlers` spread onto it, and
 *   `style` is the transform — merge it into whatever style the panel has.
 */
export function useSheetDrag(onDismiss, { threshold = DISMISS_PX, enabled = true } = {}) {
  const ref = useRef(null);
  const gesture = useRef(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Registered imperatively from begin(), not through an effect keyed on the
  // `dragging` state — attaching them has to cause no re-render, or a plain
  // tap would trip the same state flip this fix removes below.
  const listeners = useRef(null);

  function attach() {
    if (listeners.current) return;
    const onMouseMove = (e) => move(e.clientY);
    const onTouchMove = (e) => { if (e.touches && e.touches[0]) move(e.touches[0].clientY); };
    const onEnd = () => end();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    listeners.current = { onMouseMove, onEnd, onTouchMove };
  }

  function detach() {
    const l = listeners.current;
    if (!l) return;
    window.removeEventListener('mousemove', l.onMouseMove);
    window.removeEventListener('mouseup', l.onEnd);
    window.removeEventListener('touchmove', l.onTouchMove);
    window.removeEventListener('touchend', l.onEnd);
    window.removeEventListener('touchcancel', l.onEnd);
    listeners.current = null;
  }

  function begin(y, target) {
    if (!enabled) return;
    if (isFieldTarget(target)) return;
    if (inScrolledRegion(target, ref.current)) return;
    // Recorded, but not yet a drag — no state change (and so no re-render of
    // whatever the finger just went down on) until move() confirms the finger
    // actually travelled (see TAP_SLOP_PX above).
    gesture.current = { y0: y, dy: 0, dragStarted: false };
    attach();
  }

  function move(y) {
    const g = gesture.current;
    if (!g) return;
    const travelled = Math.max(0, y - g.y0);
    g.dy = travelled;
    if (!g.dragStarted) {
      if (travelled <= TAP_SLOP_PX) return;
      g.dragStarted = true;
      setDragging(true);
    }
    setDy(travelled);
  }

  function end() {
    const g = gesture.current;
    gesture.current = null;
    detach();
    if (!g?.dragStarted) return; // a tap that never moved — leave it to onClick
    setDragging(false);
    setDy(0);
    // Past the threshold it goes away; short of it, it springs back — which is
    // what makes the gesture safe to try.
    if (g.dy > threshold) dismissRef.current?.();
  }

  useEffect(() => detach, []);

  return {
    ref,
    dy,
    dragging,
    handlers: {
      onMouseDown: (e) => begin(e.clientY, e.target),
      onTouchStart: (e) => { if (e.touches && e.touches[0]) begin(e.touches[0].clientY, e.target); },
      // The window listeners own the drag; these keep it alive for anything
      // that only ever delivers moves to the element the gesture started on.
      onMouseMove: (e) => move(e.clientY),
      onTouchMove: (e) => { if (e.touches && e.touches[0]) move(e.touches[0].clientY); },
    },
    style: {
      transform: dy ? `translateY(${dy}px)` : undefined,
      // While a finger is on it the sheet tracks the finger exactly; let go and
      // the class's own animation carries it back.
      transition: dragging ? 'none' : undefined,
    },
  };
}
