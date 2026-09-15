// client/src/hooks/useHorizontalSwipe.js — CASINO-2 job 5 (JOB 5, swipe the floors)
//
// A ROOM IS DISMISSED DOWN; A ROOM IS CHANGED SIDEWAYS.
//
// FloorView already drags down to leave (useSheetDrag) — that gesture is Y
// only and, since BUG-200, only ever arms once the finger has actually
// travelled past a slop in Y. A left/right swipe stays under that slop in Y
// for its whole length, so the two gestures never fight over the same touch:
// this hook watches X the same way useSheetDrag watches Y, and both can sit
// on the same element.
//
// Same three rules as useSheetDrag, restated for the other axis:
//
//   1. A DRAG THAT STARTS IN A FIELD OR A BUTTON IS NOT A SWIPE. Tapping a
//      table, the back arrow or the roster button must not also be read as
//      the first pixel of a room change.
//   2. A TAP STAYS A TAP. Nothing changes (no state, no class) until the
//      finger clears the slop — BUG-200's fix, on this axis too.
//   3. THE WINDOW OWNS IT ONCE IT STARTS, for the same reason a sheet does:
//      a swipe that travels off the element it started on must still be
//      tracked to release.

import { useRef, useState } from 'react';

/** How far the finger has to travel before letting go changes the room. */
export const SWIPE_PX = 56;

const SWIPE_SLOP_PX = 10;

const INTERACTIVE = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A']);

function isInteractiveTarget(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (INTERACTIVE.has(node.tagName)) return true;
    node = node.parentNode;
  }
  return false;
}

/**
 * Swipe left/right for one room strip.
 *
 * @param {Function} onSwipeLeft   called once, past threshold, moving right
 * @param {Function} onSwipeRight  called once, past threshold, moving left
 *   (named for the DIRECTION THE ROOM MOVES, not the finger: a left swipe —
 *   finger moving left, content following it left — brings the NEXT room in
 *   from the right, which is `onSwipeLeft`. Same convention any carousel uses.)
 * @param {object}   opts
 * @param {boolean}  opts.enabled  off at either end of the room list
 * @returns {{ ref, dx, swiping, handlers, style }}
 */
export function useHorizontalSwipe(onSwipeLeft, onSwipeRight, { enabled = true } = {}) {
  const ref = useRef(null);
  const gesture = useRef(null);
  const listeners = useRef(null);
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);

  function attach() {
    if (listeners.current) return;
    const onMove = (e) => move('touches' in e ? e.touches[0]?.clientX : e.clientX);
    const onEnd = () => end();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    listeners.current = { onMove, onEnd };
  }

  function detach() {
    const l = listeners.current;
    if (!l) return;
    window.removeEventListener('mousemove', l.onMove);
    window.removeEventListener('mouseup', l.onEnd);
    window.removeEventListener('touchmove', l.onMove);
    window.removeEventListener('touchend', l.onEnd);
    window.removeEventListener('touchcancel', l.onEnd);
    listeners.current = null;
  }

  function begin(x, target) {
    if (!enabled || x == null) return;
    if (isInteractiveTarget(target)) return;
    gesture.current = { x0: x, dx: 0, started: false };
    attach();
  }

  function move(x) {
    const g = gesture.current;
    if (!g || x == null) return;
    const travelled = x - g.x0;
    g.dx = travelled;
    if (!g.started) {
      if (Math.abs(travelled) <= SWIPE_SLOP_PX) return;
      g.started = true;
      setSwiping(true);
    }
    setDx(travelled);
  }

  function end() {
    const g = gesture.current;
    gesture.current = null;
    detach();
    if (!g?.started) return; // a tap, or a mostly-vertical drag — not ours
    setSwiping(false);
    setDx(0);
    if (g.dx <= -SWIPE_PX) onSwipeLeft?.();
    else if (g.dx >= SWIPE_PX) onSwipeRight?.();
  }

  return {
    ref,
    dx,
    swiping,
    handlers: {
      onMouseDown: (e) => begin(e.clientX, e.target),
      onTouchStart: (e) => begin(e.touches?.[0]?.clientX, e.target),
    },
    style: {
      transform: dx ? `translateX(${dx}px)` : undefined,
      transition: swiping ? 'none' : undefined,
    },
  };
}
