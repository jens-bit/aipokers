// client/src/hooks/useThrottledFrame.js — BUGS-A job 8
//
// A LIVE PICTURE THAT COSTS WHAT A PICTURE SHOULD COST.
//
// The away frames on the wall are live windows onto real tables, and HOME_STATE
// pushes whenever anything anywhere in the household changes. Four frames each
// re-rendering on every push is four miniature felts repainting several times a
// second, in the corner of a screen whose subject is the room — and a phone
// pays for all of it whether the frame is on screen or not.
//
// Two rules, and they are the whole module:
//
//   1. ONE REPAINT PER SECOND. A pot moving and a card landing are events a
//      person reads at a glance; nothing about a 46px felt is better for being
//      redrawn at 60Hz. The newest value always wins — this is a throttle, not
//      a debounce, so a frame is never more than a second behind and never
//      skips the last state of a hand.
//   2. WHAT IS NOT ON SCREEN DOES NOT PAINT. A frame scrolled out of the room,
//      or a Mini App the owner has swiped away from, is frozen at whatever it
//      last showed. It catches up the moment it comes back, because coming back
//      is the moment the value matters again.

import { useEffect, useRef, useState } from 'react';

/** The beat an away frame repaints on. */
export const FRAME_MS = 1000;

/**
 * `value`, but changing at most once every `ms` — and frozen while `active` is
 * false.
 *
 * Coming back from frozen shows the newest value at once rather than waiting
 * out a beat: the owner has just looked at it.
 */
export function useThrottled(value, ms = FRAME_MS, { active = true } = {}) {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const lastAt = useRef(0);
  const timer = useRef(null);
  latest.current = value;

  useEffect(() => {
    if (!active) return undefined;
    const now = Date.now();
    const wait = lastAt.current + ms - now;
    if (wait <= 0) {
      lastAt.current = now;
      setShown(latest.current);
      return undefined;
    }
    // A beat is already booked; it will pick up whatever `latest` holds then.
    if (timer.current) return undefined;
    timer.current = setTimeout(() => {
      timer.current = null;
      lastAt.current = Date.now();
      setShown(latest.current);
    }, wait);
    return undefined;
  }, [value, active, ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return shown;
}

/**
 * Is this node worth painting right now — on screen, and in a tab somebody is
 * actually looking at?
 *
 * Answers TRUE where it cannot tell. jsdom has no IntersectionObserver and
 * neither do the oldest webviews the Mini App runs in, and a frame that goes
 * blank because the browser is old is a worse failure than one that repaints
 * when it did not have to.
 */
export function useOnScreen(ref, { rootMargin = '64px' } = {}) {
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVis = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) setInView(e.isIntersecting); },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView && pageVisible;
}
