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
import { HomeMoodAvatar } from './HomeMoodAvatar.jsx';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { pillName, shortName } from '../../lib/names.js';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { useHomeThread } from '../../hooks/useHomeThread.js';

const WHO_BY_KIND = { him: 'HIM', you: 'YOU', table: 'TABLE' };

// BUG-184: the wire's from names the speaker; storage agentId only files the
// record. Keep this separate from row.kind, which styles expanded ThreadRow.
function rowActorId(line) {
  const from = line.kind === 'overheard' ? line.lines?.[0]?.from
    : ['him', 'opponent'].includes(line.kind) ? line.from : null;
  return typeof from === 'string' && from && from !== 'owner' && from !== 'all' ? from : null;
}

/** Server thread lines → the row shape ThreadRow renders. */
export function toRows(lines = [], { named = false } = {}) {
  return lines.map((l, i) => ({
    id: l.id ?? i,
    who: named && l.kind !== 'you' ? (l.who || WHO_BY_KIND[l.kind] || 'THEM') : WHO_BY_KIND[l.kind] ?? (l.who || 'THEM'),
    text: l.text ?? (l.kind === 'overheard' ? l.lines?.[0]?.text : null),
    t: l.ts,
    // HOME-STATE-1: a line said at home rather than at a felt. Carried through
    // so the sheet can mark it; never used to change what the row says.
    source: l.source ?? 'table',
    ...(named ? { actorId: rowActorId(l) } : {}),
    ...(l.kind === 'overheard' ? { overheard: l.lines ?? [] } : {}),
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
  return collapsedMessage(agent, rows).text;
}

// BUG-174: choose the speaker from the same source as the displayed sentence.
// A focused agent's recap can outrank another resident's newer room line.
function collapsedMessage(agent, rows = [], roomMode = false) {
  const agentName = agent ? pillName(agent.name) : 'THE ROOM';
  if (agent?.unseenRecap && agent?.sessionRecap?.text) {
    return { who: agentName, text: agent.sessionRecap.text, actorId: agent.id };
  }
  const last = rows.length ? rows[rows.length - 1] : null;
  if (last?.text) return {
    who: !roomMode && last.who === 'HIM' ? agentName : (last.who || agentName),
    text: last.text,
    actorId: last.actorId,
  };
  // BUGS-C job 6: a pending want is the toast's line and his own bubble's
  // already — the server stamps it into `lastMoment` the instant he asks
  // (agentProfiles.js: `kind: 'want'`), and this fell through to it too,
  // which is the same sentence shown a third time. It carries as history
  // here once it is ANSWERED, same as any other moment — the server moves
  // `lastMoment` on then, and this falls through to it exactly as before.
  const text = agent?.lastMoment?.kind === 'want'
    ? agent?.opener ?? ''
    : agent?.lastMoment?.text || agent?.opener || '';
  return { who: agentName, text, actorId: agent?.id };
}

export function HomeThread({
  agent,
  agents = [],
  identities,
  open = false,
  onToggle,
  onSend,
  sending = false,
  toast = null,
  roomMode = false,
  roomLoaded = true,
  nobodyYet = false,
  roomPushed,
  connection = null,
  privateContext = 'AT HOME',
  placeholder = 'Say something to the room…',
}) {
  const privateThread = useThread(agent?.id, { enabled: !!agent && !roomMode });
  const room = useHomeThread({ enabled: roomMode, pushed: roomPushed, connection });
  const rows = roomMode ? toRows(room.lines, { named: true }) : privateThread.rows;
  const loading = roomMode ? room.loading : privateThread.loading;
  const reload = roomMode ? room.reload : privateThread.reload;
  const busy = sending || (roomMode && room.sending);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
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
    if (!text || busy || (!agent && !roomMode)) return;
    setDraft('');
    setError('');
    // Your own line, at once. His is not appended here — the server writes it
    // and the reload serves it, which is the rule in the header.
    const id = `pending-${++pendingIdRef.current}`;
    setPending((prev) => prev.concat([{ id, who: 'YOU', kind: 'you', text, t: Date.now() }]));
    Promise.resolve(roomMode ? room.say(text) : onSend?.(agent, text)).then((body) => {
      // The record has spoken; drop the placeholder whether it is in there or
      // not. Keeping a line the server did not store would be this screen
      // inventing a conversation, which is the one thing it must never do.
      setPending((prev) => prev.filter((r) => r.id !== id));
      if ((roomMode && !body) || body === null) { setDraft(text); setError('Could not send your message. Please try again.'); }
      reload();
    }).catch(() => {
      setPending(prev => prev.filter(r => r.id !== id));
      setDraft(text); setError('Could not send your message. Please try again.');
    });
  };

  if (!agent && !roomMode) return null;
  // Ordered: the record, then whatever you have said since it was read.
  const shown = pending.length ? rows.concat(pending) : rows;
  const message = pending.length ? pending.at(-1) : collapsedMessage(agent, shown, roomMode);
  // F01 is a confirmed empty household, not a roster still loading or all away.
  // Real speech keeps its place; this observation never becomes a thread row.
  const emptySystem = roomMode && roomLoaded && nobodyYet && !message.text;
  const line = message.text || (emptySystem ? 'The room is yours. It is empty.'
    : roomMode ? (roomLoaded ? 'Nobody is home.' : 'Reading the room…') : '');
  const who = message.who;
  const actor = roomMode && message.text && message.actorId != null
    ? agents.find(a => String(a.id) === String(message.actorId)) : null;
  const identity = actor ? identities?.get(String(actor.id)) : null;

  return (
    <div className={`home-thread${roomMode ? ' home-thread--room' : ''}${open ? ' is-open' : ''}`} data-testid="home-thread" data-open={open ? 'true' : 'false'}>
      {toast}

      {open ? (
        <div
          className={`home-thread__sheet${drag.dragging ? ' is-dragging' : ''}`}
          role="dialog"
          aria-label={roomMode ? 'The room conversation' : `${agent.name}'s thread`}
          ref={drag.ref}
          style={drag.style}
          {...drag.handlers}
        >
          <button type="button" className="home-thread__grab" onClick={() => onToggle?.(false)} aria-label="Close the thread">
            <span />
          </button>
          <div className="home-thread__head">
            <GlassLabel>{roomMode ? 'THE ROOM' : pillName(agent.name)}</GlassLabel>
            <span className="home-thread__spacer" />
            <span className="home-thread__state">{loading ? 'LOADING' : privateContext}</span>
          </div>
          <div className="home-thread__body no-scrollbar" data-testid="home-thread-rows">
            {shown.length === 0 && !loading ? (
              <div className="home-thread__empty">Nothing said yet.</div>
            ) : null}
            {shown.map((r) => r.overheard ? <details key={r.id} className="home-thread__night"><summary>OVERHEARD · {r.overheard.length} lines</summary>{r.overheard.map((l, i) => <ThreadRow key={l.id ?? i} row={{ who: l.who || 'THEM', text: l.text, t: l.ts, source: 'home' }}/>)}</details> : <ThreadRow key={r.id} row={r} />)}
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
          aria-label={actor ? `${actor.name} ${line}` : undefined}
        >
          {emptySystem ? <span className="home-thread__text home-thread__text--system">{line}</span> : roomMode ? <>
            {actor && identity && <HomeMoodAvatar agent={actor} identity={identity} className="home-thread__avatar" />}
            <span className="home-thread__sentence">
              <span className="home-thread__who" style={identity ? { color: identity.glow.c } : undefined}>{actor ? shortName(actor.name, actor.nickname) : who}</span>{' '}
              <span className="home-thread__text">{line}</span>
            </span>
          </> : <>
            <span className="home-thread__who">{who}</span>
            <span className="home-thread__text">{line}</span>
          </>}
        </button>
        <form className="home-thread__composer" onSubmit={submit}>
          <input
            className="home-thread__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={roomMode ? 'Say something to the room' : `Say something to ${agent.name}`}
            data-testid="home-thread-input"
            disabled={busy}
          />
          <button type="submit" className="home-thread__send" disabled={!draft.trim() || busy} aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        {error && <div role="alert" className="home-thread__error">{error}</div>}
      </div>
    </div>
  );
}
