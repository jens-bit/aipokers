// Board 42 C9: the companion occupies the right column; the room stays on stage.
import { useEffect, useRef, useState } from 'react';
import { AgentView } from '../agent/AgentView.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { PanelHead } from './panelParts.jsx';
import { PlayerCardRail } from './PlayerCardRail.jsx';
import { useAgentThread } from './useAgentThread.js';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';

export function ThreadPanel({
  agent, accentIndex, draft, onDraftChange, onClose, onWatch, onDeploy, onCarry, onReplay,
}) {
  const { chat, sending, accepting, send, acceptProposal, error, moodOverride } = useAgentThread(agent);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const [view, setView] = useState('thread');
  const [hand, setHand] = useState(null);

  useEffect(() => {
    let alive = true;
    setHand(null);
    fetch(`/api/agents/${encodeURIComponent(agent.id)}/flagged?userId=${encodeURIComponent(getUserId())}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive) setHand(data?.flaggedHands?.[0] ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [agent.id]);

  useEffect(() => {
    const el = feedRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [chat, sending, hand]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    onDraftChange('');
    if (!await send(text)) onDraftChange(text);
  }

  return <div className="dsk-panel dsk-panel--agent">
    {view === 'card' ? <>
      <PanelHead title="Player card" sub={agent.name.toUpperCase()} onClose={() => setView('thread')} />
      <PlayerCardRail agent={agent} accentIndex={accentIndex} />
      <button type="button" className="dsk-agent-back" onClick={() => setView('thread')}>Back to conversation</button>
    </> : <AgentView desktop agent={agent} mood={moodOverride ?? moodOf(agent)} heat={heatOf(agent)}
      chat={hand && onReplay ? [...chat,{role:'replay',hand,_id:'latest-hand'}] : chat}
      loading={sending} draft={draft} setDraft={onDraftChange} send={handleSend}
      inputRef={inputRef} feedRef={feedRef} onBack={onClose} onOpenProfile={() => setView('card')}
      onDeploy={onDeploy} onWatch={onWatch} onCarry={onCarry}
      onReplay={hand => onReplay?.(agent,hand)} onAccept={acceptProposal} accepting={accepting} externalError={error} />}
  </div>;
}
