// client/src/components/home/HomeThread.jsx — HOME-1
//
// The thread, as a glass sheet over the lower band of the room.
//
// COLLAPSED IT IS ONE LINE AND A COMPOSER. That is the whole resting state: the
// newest thing anybody said, and somewhere to answer it. It is not a list, it is
// not a preview of a list, and it does not grow with the number of agents — a
// room with four people in it still has one conversation happening in it.
//
// EXPANDED IT IS A SHEET OVER THE ROOM, not a screen instead of it. Same law the
// watch screen's history sheet obeys (WATCH v6): the room keeps playing behind
// the glass, because the moment the room resizes for a sheet, the sheet has
// become a different screen.
//
// The rows come from GET /api/agents/:id/thread (SERVER-3) — the same endpoint
// and the same four registers the watch screen reads, so a line said at the
// casino and a line said at home are the same kind of object. Sending goes
// through POST /api/agents/chat, exactly as the CHATS screen does; no new
// endpoint, and nothing on this screen composes a greeting of its own.
//
// NOTHING ON THIS SCREEN EVER INSERTS A ROW ON HIS BEHALF. Not an answer to a
// want, not a study finishing, and above all not a line in his voice. Every row
// about HIM is one the server wrote and served — which is what makes the thread
// readable back on another device, and what stops the room and the record from
// telling two different stories.
//
// BUGS-A job 11 draws the one line on the other side of that rule. What YOU
// just typed is not a claim about the world that the client might get wrong —
// it is a thing the owner did, in his hand, a moment ago. Holding it back until
// a round trip and a model call have finished meant tapping send and watching
// nothing happen for several seconds, which reads as a broken button; people
// sent it twice. So your own line goes up at once, marked as PENDING, and the
// reload replaces it with the server's copy. If the server never stored it, it
// goes away — because then it was never said.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreadRow } from '../system/ThreadSheet.jsx';
import { GlassLabel } from '../system/Glass.jsx';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { pillName } from '../../lib/names.js';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';

const WHO_BY_KIND = { him: 'HIM', you: 'YOU', table: 'TABLE' };

/** Server thread lines → the row shape ThreadRow renders. */
export function toRows(lines = []) {
  return lines.map((l, i) => ({
    id: l.id ?? i,
    who: WHO_BY_KIND[l.kind] ?? (l.who || 'THEM'),
    text: l.text,
    t: l.ts,
    // HOME-STATE-1: a line said at home rather than at a felt. Carried through
    // so the sheet can mark it; never used to change what the row says.
    source: l.source ?? 'table',
  }));
}

export function useThread(agentId, { enabled = true } = {}) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);

  // Re-armed on EVERY mount, not just the first. StrictMode mounts, unmounts
  // and mounts again, so a ref that is only ever set to false by the cleanup
  // stays false for the life of the real component — and every fetch below
  // then throws its answer away and leaves the sheet reading LOADING forever.
  // The screenshots caught this; the unit tests could not, because Testing
  // Library does not render in StrictMode and the app does.
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!agentId || !enabled) return;
    setLoading(true);
    try {
      const userId = getUserId();
      const initData = getTelegramInitData();
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/thread?userId=${encodeURIComponent(userId)}`,
        { headers: initData ? { 'X-Telegram-Init-Data': initData } : undefined },
      );
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      setLines(Array.isArray(body?.lines) ? body.lines : []);
    } catch {
      // A thread that fails to load is an empty sheet, not an error state: the
      // room behind it is still the screen.
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [agentId, enabled]);

  useEffect(() => { load(); }, [load]);
  return { lines, rows: toRows(lines), loading, reload: load };
}

/**
 * The one line the collapsed band shows.
 *
 * Priority is what he most needs you to hear: an unread recap first (that is the
 * whole reason he is standing by the door), then the newest line in the thread,
 * then his opener — which the server always writes, so this never falls through
 * to a tally the client composed.
 */
export function collapsedLine(agent, rows = []) {
  if (agent?.unseenRecap && agent?.sessionRecap?.text) return agent.sessionRecap.text;
  const last = rows.length ? rows[rows.length - 1] : null;
  if (last?.text) return last.text;
  if (agent?.lastMoment?.text) return agent.lastMoment.text;
  return agent?.opener ?? '';
}

export function HomeThread({
  agent,
  open = false,
  onToggle,
  onSend,
  sending = false,
  toast = null,
}) {
  const { rows, loading, reload } = useThread(agent?.id, { enabled: !!agent });
  const [draft, setDraft] = useState('');
  // BUGS-A job 11: what you have said and the server has not served back yet.
  // Cleared by the reload, whose answer is the truth either way.
  const [pending, setPending] = useState([]);
  const pendingIdRef = useRef(0);
  // BUGS-A job 5: the sheet is pushed back down with a finger, not only by
  // finding its grab bar. Disabled while it is closed so the band underneath
  // keeps every one of its own taps.
  const drag = useSheetDrag(() => onToggle?.(false), { enabled: open });

  useEffect(() => { setDraft(''); setPending([]); }, [agent?.id]);
  useEffect(() => { if (open) reload(); }, [open, reload]);

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !agent) return;
    setDraft('');
    // Your own line, at once. His is not appended here — the server writes it
    // and the reload serves it, which is the rule in the header.
    const id = `pending-${++pendingIdRef.current}`;
    setPending((prev) => prev.concat([{ id, who: 'YOU', kind: 'you', text, t: Date.now() }]));
    Promise.resolve(onSend?.(agent, text)).then(() => {
      // The record has spoken; drop the placeholder whether it is in there or
      // not. Keeping a line the server did not store would be this screen
      // inventing a conversation, which is the one thing it must never do.
      setPending((prev) => prev.filter((r) => r.id !== id));
      reload();
    });
  };

  if (!agent) return null;
  // Ordered: the record, then whatever you have said since it was read.
  const shown = pending.length ? rows.concat(pending) : rows;
  const line = collapsedLine(agent, shown);

  return (
    <div className={`home-thread${open ? ' is-open' : ''}`} data-testid="home-thread" data-open={open ? 'true' : 'false'}>
      {toast}

      {open ? (
        <div
          className={`home-thread__sheet${drag.dragging ? ' is-dragging' : ''}`}
          role="dialog"
          aria-label={`${agent.name}'s thread`}
          ref={drag.ref}
          style={drag.style}
          {...drag.handlers}
        >
          <button type="button" className="home-thread__grab" onClick={() => onToggle?.(false)} aria-label="Close the thread">
            <span />
          </button>
          <div className="home-thread__head">
            <GlassLabel>{pillName(agent.name)}</GlassLabel>
            <span className="home-thread__spacer" />
            <span className="home-thread__state">{loading ? 'LOADING' : 'AT HOME'}</span>
          </div>
          <div className="home-thread__body no-scrollbar" data-testid="home-thread-rows">
            {shown.length === 0 && !loading ? (
              <div className="home-thread__empty">Nothing said yet.</div>
            ) : null}
            {shown.map((r) => <ThreadRow key={r.id} row={r} />)}
          </div>
        </div>
      ) : null}

      <div className="home-thread__band">
        <button
          type="button"
          className="home-thread__line"
          onClick={() => onToggle?.(!open)}
          data-testid="home-thread-line"
          aria-expanded={open}
        >
          <span className="home-thread__who">{pillName(agent.name)}</span>
          <span className="home-thread__text">{line}</span>
        </button>
        <form className="home-thread__composer" onSubmit={submit}>
          <input
            className="home-thread__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something"
            aria-label={`Say something to ${agent.name}`}
            data-testid="home-thread-input"
          />
          <button type="submit" className="home-thread__send" disabled={!draft.trim() || sending} aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
