// Board 42 C9: the companion occupies the right column; the room stays on stage.
import { useEffect, useRef, useState } from 'react';
import { AgentView } from '../agent/AgentView.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { AgentProfileScreen } from '../../screens/AgentProfileScreen.jsx';
import { FundSheet } from '../wallet/FundSheet.jsx';
import { callInAgent, fetchWallet, fundAgent } from '../../lib/wallet.js';
import { useAgentThread } from './useAgentThread.js';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';

export function ThreadPanel({
  agent, accentIndex, draft, onDraftChange, onClose, onWatch, onDeploy, onCarry, onReplay,
  initialView = 'thread',
  onBackToThread,
}) {
  const { chat, hasHands, sending, accepting, send, acceptProposal, error, moodOverride } = useAgentThread(agent);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const [view, setView] = useState(initialView);
  const [hand, setHand] = useState(null);
  const [flagsKnown,setFlagsKnown]=useState(false);
  const [funding, setFunding] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [pocketOverride, setPocketOverride] = useState(null);
  const [profileError, setProfileError] = useState('');
  const currentAgent = pocketOverride ? { ...agent, pocket: pocketOverride } : agent;
  const backToThread = () => { setView('thread'); onBackToThread?.(); };

  useEffect(() => {
    setView(initialView);
  }, [agent.id, initialView]);
  useEffect(() => {
    setFunding(false); setPocketOverride(null); setProfileError('');
  }, [agent.id]);

  async function profileWhisper(text) {
    let response;
    if (!await send(text, { onResult: data => { response = data; } })) throw new Error('Whisper refused');
    return response;
  }
  async function openFunds() {
    setProfileError(''); setFunding(true);
    const loadedWallet = await fetchWallet();
    setWallet(loadedWallet);
    if (!loadedWallet) setProfileError('Could not read the wallet. Please try again.');
  }
  async function fund(decision) {
    setProfileError('');
    try {
      const result = await fundAgent(agent.id, decision);
      if (result.pocket ?? result.agent?.pocket) setPocketOverride(result.pocket ?? result.agent.pocket);
      setFunding(false);
    } catch { setProfileError('Could not move the chips. Please try again.'); }
  }
  async function callIn() {
    setProfileError('');
    try { await callInAgent(agent.id); onClose?.(); }
    catch { setProfileError('Could not call him in. Please try again.'); }
  }

  useEffect(() => {
    let alive = true;
    setHand(null); setFlagsKnown(false);
    fetch(`/api/agents/${encodeURIComponent(agent.id)}/flagged?userId=${encodeURIComponent(getUserId())}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive) { setHand(data?.flaggedHands?.[0] ?? null); setFlagsKnown(Array.isArray(data?.flaggedHands)); } })
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
    {view === 'card' ? <AgentProfileScreen companion agent={currentAgent}
      onBack={backToThread} onOpenChat={backToThread}
      onWatch={onWatch} onDeploy={onDeploy} onCallIn={callIn} onFund={openFunds}
      onRetired={onClose} sendWhisper={profileWhisper} /> : <AgentView desktop agent={currentAgent} mood={moodOverride ?? moodOf(agent)} heat={heatOf(agent)}
      chat={hand && onReplay ? [...chat,{role:'replay',hand,_id:'latest-hand'}] : flagsKnown && !hand && hasHands ? [...chat,{role:'noflags',_id:'quiet-shift'}] : chat}
      loading={sending} draft={draft} setDraft={onDraftChange} send={handleSend}
      inputRef={inputRef} feedRef={feedRef} onBack={onClose} onOpenProfile={() => setView('card')}
      onDeploy={onDeploy} onWatch={onWatch} onCarry={onCarry}
      onReplay={hand => onReplay?.(agent,hand)} onAccept={acceptProposal} accepting={accepting} externalError={error} />}
    {funding && <div className="agent-view__fund"><FundSheet agent={currentAgent} wallet={wallet} onCancel={() => { setFunding(false); setProfileError(''); }} onConfirm={fund}/>{profileError && <div className="agent-view__error" role="alert">{profileError}</div>}</div>}
    {!funding && profileError && <div className="agent-view__error" role="alert">{profileError}</div>}
  </div>;
}
