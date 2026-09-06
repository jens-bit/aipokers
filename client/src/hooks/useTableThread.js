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
//   · AND PUSHED FROM THERE (WATCH-9). The fetch is a snapshot: a sheet left
//     open used to go quiet while the table carried on talking, and the only
//     cure was to close it and open it again. THREAD_LINE (protocol.js) is the
//     server saying what it has just written, and `pushed` is that stream. The
//     fetch is still what a reconnect and a first open use — the push only
//     covers what has been said since this socket opened — so the two are
//     merged by ID rather than one replacing the other.
//   · A NEW STAY IS A NEW THREAD. It is his stay that ended; carrying the last
//     one's lines into the next would be the sheet inventing a conversation.
//   · BEST-EFFORT. A thread that can break the felt is worse than no thread, so
//     a failed request leaves the live lines exactly as they were and a slow
//     answer can never overwrite a newer one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
import { isReconnect, mergeThread, rowsFromThread, threadUrl } from '../lib/thread.js';

const NONE = [];

export function useTableThread({ agentId, sessionId, connection = null, want = true, pushed = NONE } = {}) {
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

  // WATCH-9: the fetched record and what has been pushed since, as one list.
  //
  // Both halves are STORED lines with the server's own ids, so mergeThread's
  // rule — one row per id, oldest first — is the whole reconciliation. A line
  // that arrives both ways (pushed while the sheet was open, then refetched on
  // a reconnect) is one line, not two, without either side having to know the
  // other exists.
  //
  // Pushed lines are filtered to THIS stay: the socket can outlive a session,
  // and a line from the last one is not part of this thread.
  return useMemo(() => {
    const live = (Array.isArray(pushed) ? pushed : [])
      .filter((l) => l && (l.sessionId == null || !sessionId || l.sessionId === sessionId))
      .map(rowFromPushed)
      .filter(Boolean);
    if (live.length === 0) return rows;
    return mergeThread(rows, live);
  }, [rows, pushed, sessionId]);
}

// A pushed line is the same shape a fetched one is, so it goes through the same
// reader — which is what keeps `cost` (WATCH-9's gold register) and the closed
// `kind` behaving identically no matter which door the line came through.
function rowFromPushed(line) {
  return rowsFromThread({ lines: [line] })[0] ?? null;
}
