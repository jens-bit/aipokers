import { useEffect, useRef } from 'react';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { ThreadRow } from './ThreadSheet.jsx';
import { WatchAgentStats } from './WatchAgentStats.jsx';
import { MoodGhost } from './MoodGhost.jsx';
import { identityOf } from '../../lib/identity.js';

export function WatchAgentSheet({ agent, name, seat, chat, pending, view, onView, onClose }) {
  const identity = identityOf(agent);
  const drag = useSheetDrag(onClose);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const feed = useRef(null);
  useEffect(() => {
    const sheet = drag.ref.current;
    const felt = sheet?.closest('.watch-screen')?.querySelector('.watch-felt') || sheet?.closest('.watch-felt');
    const opener = document.activeElement;
    const outside = event => {
      if (sheet.contains(event.target) || event.target.closest?.('button, a, input, textarea, select, [role="button"]')) return;
      closeRef.current();
    };
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      closeRef.current(); opener?.focus?.();
    };
    felt?.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      felt?.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [drag.ref]);
  useEffect(() => {
    const el = feed.current;
    if (view === 'chat' && el) el.scrollTop = el.scrollHeight;
  }, [chat.length, pending, view]);

  return <section className={`thread-sheet watch-agent-sheet${drag.dragging ? ' is-dragging' : ''}`}
    role="dialog" aria-label={`${name} at the table`} ref={drag.ref} style={drag.style} {...drag.handlers}>
    <header className="watch-agent-sheet__head">
      <MoodGhost size={32} ring={false} hood={identity.hood} glow={identity.glow.c}
        mood={seat?.mood?.state ?? agent?.mood?.state ?? 'neutral'} />
      <div><strong>{name}</strong><small>Your agent · Private conversation</small></div>
      <button type="button" onClick={onClose} aria-label="Back to table">Close ×</button>
    </header>
    <div className="watch-agent-sheet__views" aria-label="Agent information">
      {['chat', 'stats'].map(tab => <button key={tab} type="button" aria-pressed={view === tab}
        onClick={() => onView(tab)}>{tab === 'chat' ? 'Conversation' : 'Stats'}</button>)}
    </div>
    <div className="thread-sheet__body" ref={feed}>
      {view === 'stats' ? <WatchAgentStats agent={agent} seat={seat}/> : <>
        {!chat.length && <p className="watch-agent-sheet__empty">{agent ? 'Whisper below to start a conversation.' : 'Loading your conversation…'}</p>}
        {chat.map((message, i) => <ThreadRow key={message._id ?? i} row={{
          kind: message.role === 'user' ? 'you' : 'him', who: message.role === 'user' ? 'YOU' : name,
          text: message.content, t: message.t,
        }}/>) }
        {pending && <p role="status" className="watch-agent-sheet__empty">Waiting for {name}…</p>}
      </>}
    </div>
  </section>;
}
