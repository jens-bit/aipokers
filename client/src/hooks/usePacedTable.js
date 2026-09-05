// WATCH-5 — the clock behind lib/pace.js's queue.
//
// lib/pace.js knows the beat and nothing else: it is handed a `now` and asked
// what should be on screen. This is the half that owns the clock — one timer,
// set to the exact moment the next frame is allowed on, rather than a poll.
//
// It sits OUTSIDE WatchScreen on purpose. The screen renders whatever snapshot
// it is given and must keep doing so: that is what makes the felt testable by
// rendering a fixture, and it keeps the pacing a property of the stream rather
// than a behaviour hidden inside a 1500-line component. App.jsx wraps the live
// table in this and hands the paced bundle down.
//
// Owner and spectator both get it. The server-side spectator hold is untouched
// — it staggers what the table SENDS; this staggers what one viewer SEES.

import { useEffect, useRef, useState } from 'react';
import { createQueue, pushFrame, advance, nextWaitMs } from '../lib/pace.js';

/**
 * @param live    { game, lastDecision, paceFrame, chatMessages } off useTable
 * @param options { enabled } — false renders the live stream untouched, which
 *                is what a replay theatre (already paced by its own timeline)
 *                and the desktop rail want.
 * @returns the same four fields, delayed together, plus `behindMs` — how long
 *          the frame now on screen waited before it was shown, which is how far
 *          behind the live table this viewer is. Zero for most of a hand, and
 *          it holds its value between releases rather than only being true at
 *          the instant of a render.
 */
export function usePacedTable(live, options) {
  const enabled = !options || options.enabled !== false;

  const game         = live ? live.game : null;
  const lastDecision = live ? live.lastDecision : null;
  const paceFrame    = live ? live.paceFrame : null;
  const chatMessages = live ? live.chatMessages : null;

  const queueRef = useRef(null);
  const timerRef = useRef(null);
  const [, force] = useState(0);

  // One timer, re-armed each release. `pump` is a ref rather than a callback so
  // the timer it sets can call the same function without either depending on
  // the other's identity.
  const pumpRef = useRef(function () {});
  pumpRef.current = function pump() {
    const q = queueRef.current;
    if (!q) return;
    const now = Date.now();
    const changed = advance(q, now);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const wait = nextWaitMs(q, now);
    if (wait !== null) {
      // A floor of one frame: a zero-dwell step still yields to the browser
      // rather than draining the whole queue inside one task.
      timerRef.current = setTimeout(function () { pumpRef.current(); }, Math.max(16, wait));
    }
    if (changed) force(function (n) { return n + 1; });
  };

  if (queueRef.current === null) {
    queueRef.current = createQueue(
      { game: game, lastDecision: lastDecision, paceFrame: paceFrame, chatMessages: chatMessages },
      Date.now(),
    );
  }

  useEffect(function () {
    if (!enabled) return;
    pushFrame(queueRef.current, {
      game: game, lastDecision: lastDecision, paceFrame: paceFrame, chatMessages: chatMessages,
    }, Date.now());
    pumpRef.current();
  }, [game, lastDecision, paceFrame, chatMessages, enabled]);

  useEffect(function () {
    return function () { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!enabled) {
    return {
      game: game, lastDecision: lastDecision, paceFrame: paceFrame,
      chatMessages: chatMessages, behindMs: 0,
    };
  }

  const shown = queueRef.current.shown || {};
  return {
    game: shown.game != null ? shown.game : null,
    lastDecision: shown.lastDecision != null ? shown.lastDecision : null,
    paceFrame: shown.paceFrame != null ? shown.paceFrame : null,
    chatMessages: shown.chatMessages != null ? shown.chatMessages : null,
    behindMs: queueRef.current.waitedMs,
  };
}
