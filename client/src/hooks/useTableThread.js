// client/src/hooks/useTableThread.js — WATCH-8, jobs 1 and 3.
//
// The stored half of the table thread, for whichever surface is showing it.
//
// The phone pulls it up as a glass sheet and the desk keeps it open in a rail,
// but it is the same record: SERVER-3's stored lines for one STAY, with the
// server's own timestamps. Both surfaces mount this rather than each keeping
// its own copy — the two must not be able to disagree about what was said at a
// table the owner watched on one and reopened on the other.
//
//   · FETCHED WHEN IT IS ASKED FOR (`want`), and again whenever the connection
//     comes back. The record the table wrote while the owner was disconnected
//     is exactly the part he cannot have heard.
//   · A NEW STAY IS A NEW THREAD. It is his stay that ended; carrying the last
//     one's lines into the next would be the sheet inventing a conversation.
//   · BEST-EFFORT. A thread that can break the felt is worse than no thread, so
//     a failed request leaves the live lines exactly as they were and a slow
//     answer can never overwrite a newer one.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
import { isReconnect, rowsFromThread, threadUrl } from '../lib/thread.js';

const NONE = [];

export function useTableThread({ agentId, sessionId, connection = null, want = true } = {}) {
  const [rows, setRows] = useState(NONE);
  const seqRef = useRef(0);

  const load = useCallback(() => {
    const url = threadUrl({ agentId, sessionId, userId: getUserId() });
    if (!url) return;
    const seq = ++seqRef.current;
    fetch(url, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // A slower earlier request must not overwrite a newer answer.
        if (!data || seq !== seqRef.current) return;
        setRows(rowsFromThread(data));
      })
      .catch(() => {});
  }, [agentId, sessionId]);

  // A new stay is a new thread.
  const stayRef = useRef(sessionId);
  useEffect(() => {
    if (stayRef.current === sessionId) return;
    stayRef.current = sessionId;
    setRows(NONE);
  }, [sessionId]);

  // Asked for — the sheet opening, or a rail that is always open.
  useEffect(() => {
    if (want) load();
  }, [want, load]);

  // And on the way back up.
  const connRef = useRef(connection);
  useEffect(() => {
    const prev = connRef.current;
    connRef.current = connection;
    if (isReconnect(prev, connection)) load();
  }, [connection, load]);

  return rows;
}
