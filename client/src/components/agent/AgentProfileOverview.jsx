// Board 42 C4. The detailed card remains behind His sheet; this is his recent life.
import { useEffect, useRef, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { MoodChip } from '../floor/atoms.jsx';
import { FatigueLine } from '../system/CharacterAtoms.jsx';
import { AttrExplain } from '../system/AttrExplain.jsx';
import { identityOf } from '../../lib/identity.js';
import { normalizeAttrs, recentEntries, ATTR_KEYS } from '../../lib/attributes.js';
import { heatOf, moodOf } from '../floor/agentView.js';
import { money } from '../../lib/wallet.js';
import { getTelegramInitData, getUserId } from '../../lib/telegram.js';
import '../../styles/agent.css';
import '../../styles/agent-profile.css';

export function profileRecent(agent, log, now = Date.now()) {
  const growth = recentEntries(log, 24, now).filter(e => e.to !== e.from).map(e => ({
    key: e.key, label: `${e.to > e.from ? '+' : '−'}${e.key}`, bad: e.to < e.from,
    line: e.cause || `${e.from} → ${e.to}`, at: e._ts, hand: e.handNumber,
  }));
  // A cost is a misjudgment, not an attribute level change. Do not turn it into +growth.
  const costs = (agent.sessionFlagged ?? []).flatMap(hand => (hand.attrCosts ?? [])
    .filter(c => ATTR_KEYS.includes(c.key) && c.line)
    .map(c => ({ key: c.key, label: c.key, bad: true, line: c.line, hand: hand.handNumber, at: hand.at ?? hand.ts ?? null })));
  return [...growth, ...costs].sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0) || (b.hand ?? 0) - (a.hand ?? 0)).slice(0, 8);
}

export function profileSession(agent) {
  const live = agent.liveGame?.tableId ? agent.liveGame : null;
  const session = live ?? agent.sessionLog?.at(-1);
  if (!session) return null;
  return { label: live ? 'THIS SESSION' : 'LAST SESSION', net: Number.isFinite(session.net) ? session.net : null,
    hands: live ? (live.heroSessionHands ?? live.handsThisSession ?? null) : session.hands,
    flagged: Array.isArray(agent.sessionFlagged) ? agent.sessionFlagged.filter(h => h.flagType).length : null };
}

function RecentRow({ entry, row, explained, onExplain }) {
  const [open, setOpen] = useState(false);
  const age = Number.isFinite(entry.at) ? Math.max(0, Math.floor((Date.now() - entry.at) / 60000)) : null;
  return <div className="profile-overview__recent-item">
    <div className="profile-overview__recent-row">
      <button type="button" className={entry.bad ? 'is-loss' : ''} disabled={explained && !open} aria-label={`What ${entry.key} means`} aria-expanded={open} onClick={() => { setOpen(!open); onExplain?.(entry.key); }}>{entry.label}</button>
      {entry.hand != null && <small>hand #{entry.hand}</small>}
      <span>{entry.line}</span>{age != null && <time>{age < 60 ? `${age}m` : `${Math.floor(age / 60)}h`}</time>}
    </div>
    {open && <AttrExplain attrKey={entry.key} row={row} />}
  </div>;
}

export function AgentProfileOverview({ agent, attrLog, actions, onBack, onWatch, onOpenChat, explained, onExplain, children }) {
  const identity = identityOf(agent);
  const character = normalizeAttrs(agent);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [localMood, setLocalMood] = useState(null);
  const alive = useRef(true);
  const sending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const mood = localMood?.state ?? moodOf(agent);
  const heat = localMood?.heat ?? heatOf(agent);
  const stamina = { fresh: 100, settled: 62, worn: 25 }[character.fatigue];
  const born = agent.bornAt ?? agent.createdAt;
  const bornDate = born != null ? new Date(born) : null;
  const recent = profileRecent(agent, attrLog);
  const session = profileSession(agent);
  async function whisper(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending.current) return;
    sending.current = true; setBusy(true); setError(''); setDraft('');
    try {
      const res = await fetch('/api/agents/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() }, body: JSON.stringify({ userId: getUserId(), content: text, existingAgentId: agent.id }) });
      if (!res.ok) throw new Error('Whisper refused');
      const data = await res.json();
      if (!alive.current) return;
      setReply(data.chat?.filter(m => m.role === 'assistant').at(-1)?.content ?? null);
      if (Array.isArray(data.chat)) setConversation(data.chat);
      setLocalMood({ state: data.pepTalk?.newState ?? data.mood?.state ?? mood, heat: Number.isFinite(data.mood?.heat) ? data.mood.heat : heat });
    } catch {
      if (alive.current) { setDraft(text); setError('Could not send your whisper. Please try again.'); }
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return <section className="agent-view profile-overview" aria-label={`${agent.name}'s profile`}>
    <header className="agent-view__header">
      <button type="button" className="agent-view__back" aria-label="Back" onClick={onBack}>‹</button>
      <span className="agent-view__name">{agent.name}</span><MoodChip mood={mood} small />
      {agent.liveGame?.tableId && onWatch && <button type="button" className="agent-view__live" aria-label="Watch live game" onClick={() => onWatch(agent)}>● LIVE</button>}
    </header>
    <div className="profile-overview__scroll">
      <div className="profile-overview__identity">
        <MoodGhost mood={mood} heat={heat} size={62} ring={false} hood={identity.hood} glow={identity.glow.c} accent={identity.glow.c}/>
        <div><div className="profile-overview__nature"><b>{character.nature?.name ?? 'Still forming'}</b>{bornDate && !Number.isNaN(bornDate.valueOf()) && <span>born {bornDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</div>
          <div className="profile-overview__resource" title={`Stamina: ${character.fatigue}`}><b>STAMINA</b><i><em style={{ width: `${stamina}%` }}/></i><span>{character.fatigue}</span></div>
          <div className="profile-overview__resource is-heat"><b>HEAT</b><i><em style={{ width: `${heat}%` }}/></i><span>{Number.isFinite(agent.mood?.heat) || localMood ? Math.round(heat) : '—'}</span></div>
        </div>
      </div>
      {typeof actions === 'function' ? actions({ chatAgent: { ...agent, chatHistory: conversation ?? agent.chatHistory, mood: { ...agent.mood, ...localMood } } }) : actions}
      <FatigueLine stage={character.fatigue}/>
      <div className="profile-overview__recent-heading"><b>RECENT</b><span>what changed in him</span></div>
      <div aria-label="Recent changes">{recent.length ? recent.map((e, i) => <RecentRow key={`${e.key}-${e.at}-${i}`} entry={e} row={character.rows.find(r => r.key === e.key)} explained={explained?.has(e.key)} onExplain={onExplain}/>) : <p className="profile-overview__empty">Nothing recorded yet. It comes with play.</p>}</div>
      {session && <div className="profile-overview__session"><b>{session.label}</b><strong className={session.net < 0 ? 'is-loss' : ''}>{session.net == null ? '—' : `${session.net > 0 ? '+' : session.net < 0 ? '−' : ''}${money(Math.abs(session.net))}`}</strong><span>{session.hands != null && `${session.hands} hands`}{session.flagged != null && ` · ${session.flagged} flagged`}</span></div>}
    </div>
    {reply && <div className="profile-overview__reply"><span>{reply}</span><button type="button" onClick={() => onOpenChat?.({ ...agent, chatHistory: conversation ?? agent.chatHistory, mood: { ...agent.mood, ...localMood } })}>Open conversation</button></div>}
    {error && <div className="agent-view__error" role="alert">{error}</div>}
    <form className="agent-view__composer" onSubmit={whisper}><div><input aria-label="Whisper to him" placeholder="Whisper to him" value={draft} disabled={busy} onChange={e => setDraft(e.target.value)}/><button type="submit" disabled={busy || !draft.trim()} aria-label="Send whisper"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="m21 3-7 18-4-7-7-4 18-7ZM21 3 10 14"/></svg></button></div></form>
    {children}
  </section>;
}
