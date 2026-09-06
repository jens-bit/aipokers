// client/src/hooks/useHomeThread.js — DESK-2
//
// THE ROOM's thread, which is not any one agent's.
//
// THREAD-2 built both ends of this on the server and nothing on the client had
// opened them yet:
//
//   GET  /api/home/thread?userId=   today's thread in the flat, owner-gated
//   POST /api/home/say { userId, text }   say it to the house; everybody in
//                                         answers, each in his own voice
//
// It is deliberately NOT `useThread` with a different id. That hook reads one
// agent's stay at a felt and keys off his id; this one reads a DAY in a room,
// has no agent, and carries entries the felt never produces — the nightly
// `overheard` exchange is a single row with a conversation inside it.
//
// NOTHING HERE EVER INSERTS A ROW. `say` POSTs and reloads, exactly as the
// mobile composer does, because the room and the record must not be able to
// tell two different stories. The reload is what puts your line and their
// answers on screen, in the order the server filed them.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';

function headers() {
  const initData = getTelegramInitData();
  return initData ? { 'X-Telegram-Init-Data': initData } : undefined;
}

export function useHomeThread({ enabled = true } = {}) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const aliveRef = useRef(true);

  // Re-armed on EVERY mount — StrictMode mounts, unmounts and mounts again, and
  // a ref only ever cleared by the teardown stays false for the life of the real
  // component. useThread carries the same note and the same bug behind it.
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const userId = getUserId();
      const res = await fetch(
        `/api/home/thread?userId=${encodeURIComponent(userId)}`,
        { headers: headers() },
      );
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      setLines(Array.isArray(body?.lines) ? body.lines : []);
    } catch {
      // A thread that will not load is an empty rail, not an error state: the
      // room beside it is still the screen.
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const say = useCallback(async (text) => {
    const said = String(text ?? '').trim();
    if (!said || sending) return null;
    setSending(true);
    try {
      const userId = getUserId();
      const res = await fetch('/api/home/say', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers() ?? {}) },
        body: JSON.stringify({ userId, text: said }),
      });
      const body = await res.json().catch(() => null);
      // The answers are one model call per agent at home, so the reload happens
      // after the route returns rather than on a timer.
      await load();
      return body;
    } catch {
      return null;
    } finally {
      if (aliveRef.current) setSending(false);
    }
  }, [load, sending]);

  return { lines, loading, sending, reload: load, say };
}
