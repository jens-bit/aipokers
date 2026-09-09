// Board 42 C1–C3: the companion above his conversation. Network chat stays in
// AgentThread; money and wants use the same authenticated routes as Home.
import { useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { ghostHands, SEAT_GRIP } from '../system/GhostHands.jsx';
import { NamePill } from '../home/atoms.jsx';
import { MoodChip } from '../floor/atoms.jsx';
import { identityOf } from '../../lib/identity.js';
import { ANSWERS, answerWant } from '../home/WantToast.jsx';
import { FundSheet } from '../wallet/FundSheet.jsx';
import { fetchWallet, fundAgent, money, pocketOf, stakesFor } from '../../lib/wallet.js';
import { ReplayCard } from '../replay/ReplayCard.jsx';
import { FridgeSheet } from '../home/FridgeSheet.jsx';
import { getTelegramInitData, getUserId } from '../../lib/telegram.js';
import '../../styles/agent.css';

const paths = {
  chips: <><ellipse cx="12" cy="8" rx="7" ry="3.2"/><path d="M5 8v5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V8M5 13v3.5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V13"/></>,
  carry: <path d="M8 21V10a4 4 0 0 1 8 0v11M5 21h14M12 6V3"/>,
  profile: <><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></>,
};
const Icon = ({ name }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
const proposalLabels = {tightness:'Tightness',aggression:'Aggression',bluffFreq:'Bluff frequency',discipline:'Discipline'};

function ProposalDetails({proposal,profile}) {
  const deltas=Object.entries(proposal?.suggestedPatch?.profileDelta ?? {}).filter(([,delta])=>Number.isFinite(Number(delta)));
  return <>{proposal?.reasoning || proposal?.text}{deltas.length>0&&<div className="agent-view__proposal-details">{deltas.map(([key,delta])=>{
    const from=Math.round(profile?.[key]??50),to=Math.max(0,Math.min(100,from+Number(delta)));
    return <div key={key}>{proposalLabels[key]||key}: {from}% → {to}%</div>;
  })}<small>Applies on the next deploy.</small></div>}</>;
}

export function AgentView({ agent, mood, heat, chat, loading, draft, setDraft, send, inputRef, feedRef, onBack, onOpenProfile, onDeploy, onWatch, onCarry, onReplay, onAccept, accepting, desktop = false, externalError = '' }) {
  const identity = identityOf(agent);
  const bodySize = desktop ? 132 : 178;
  const [want, setWant] = useState(agent.want ?? null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [funding, setFunding] = useState(false);
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [pocketOverride, setPocketOverride] = useState(null);
  const currentAgent = pocketOverride ? { ...agent, pocket: pocketOverride } : agent;
  const pocket = pocketOf(currentAgent);
  const live = !!(agent.activeTableId || agent.location?.tableId || agent.liveGame?.tableId);
  const atHome = !agent.location?.where || agent.location.where === 'home';
  const lastLine = (desktop || chat.some(m => m.role === 'user')) ? [...chat].reverse().find(m => m.role === 'assistant' && !m.error)?.content : null;
  const face = size => <MoodGhost mood={mood} heat={heat} size={size} ring={false} hood={identity.hood} glow={identity.glow.c} accent={identity.glow.c} />;

  async function openFunds() {
    setError('');
    setFunding(true);
    setWallet(await fetchWallet());
  }
  async function fund(decision) {
    setError('');
    try {
      const result = await fundAgent(agent.id, decision);
      if (result.pocket) setPocketOverride(result.pocket);
      else if (result.agent?.pocket) setPocketOverride(result.agent.pocket);
      setFunding(false);
    } catch { setError('Could not move the chips. Please try again.'); }
  }
  async function answer(value) {
    if (busy) return;
    setBusy(value); setError('');
    try {
      const result = await answerWant(agent.id, value);
      if (!result) throw new Error('Want was not saved');
      setWant(result.answered === null ? (result.want ?? want) : null);
      if (result.needs === 'deploy') onDeploy?.(currentAgent);
      else if (result.needs === 'fund') openFunds();
      else if (result.needs === 'stock') setFridgeOpen(true);
      else if (result.needs === 'thread') inputRef.current?.focus();
    } catch { setError('Could not save your answer. Please try again.'); }
    finally { setBusy(null); }
  }

  async function afterStocked() {
    setFridgeOpen(false);
    // Stocking a shelf is not giving an item. Read the updated request and
    // let the owner answer it; only the server decides what he needs.
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}?userId=${encodeURIComponent(getUserId())}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } });
      if (!res.ok) return;
      const body = await res.json();
      const view = body.agent ?? body;
      if (Object.hasOwn(view, 'want')) setWant(view.want);
    } catch { /* Keep the last confirmed request until it can be read again. */ }
  }

  return <section className={`agent-view${desktop ? ' agent-view--desktop' : ''}`} aria-label={`${agent.name}'s room`}>
    <header className="agent-view__header">
      {!desktop && <button className="agent-view__back" type="button" aria-label="Back" onClick={onBack}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 18l-6-6 6-6"/></svg></button>}
      <span className="agent-view__name">{agent.name}</span><MoodChip mood={mood} small />
      {live && onWatch && <button type="button" className="agent-view__live" aria-label="Watch live game" onClick={() => onWatch(currentAgent)}>● LIVE</button>}
      {desktop && <button type="button" className="agent-view__close" aria-label="Close panel" onClick={onBack}>×</button>}
    </header>
    <div className="agent-view__stage" data-testid="agent-stage">
      <div className="agent-view__glow" style={{ background: `radial-gradient(ellipse at 50% 74%, ${identity.glow.c}14, transparent 68%)` }} />
      <div className="agent-view__shadow" />
      <div className="agent-view__body"><NamePill name={agent.name} nickname={agent.nickname} fatigue={agent.fatigue} heat={heat} accent="#EDEDED"/><div className="agent-view__breath">{face(bodySize)}<svg className="agent-view__hands" width={bodySize} height={bodySize} viewBox="0 0 80 80" aria-hidden>{ghostHands({ pose: 'rest', size: bodySize, grip: SEAT_GRIP })}</svg></div></div>
      {agent.drinking === true && <div className="agent-view__bottle" aria-label="Drinking"><i/><b/><span/></div>}
      {(want || lastLine) && <div className="agent-view__speech">
        <div className={`agent-view__bubble${want ? ' is-want' : ''}`}>{want?.text || lastLine}</div>
        {want && <div className="agent-view__answers">{ANSWERS.map(a => <button key={a.id} type="button" disabled={!!busy} onClick={() => answer(a.id)}>{a.label}</button>)}</div>}
      </div>}
    </div>
    <div className="agent-view__actions">
      <button type="button" className="agent-view__deploy" disabled={!onDeploy || live} onClick={() => onDeploy(currentAgent)}><b>DEPLOY</b><span>{stakesFor(pocket).replaceAll('$', '')} · {money(pocket?.balance)}</span></button>
      <button type="button" aria-label="Give chips" onClick={openFunds}><Icon name="chips"/><span>GIVE CHIPS</span></button>
      <button type="button" aria-label="Carry" disabled={!atHome || !onCarry} onClick={() => onCarry(currentAgent)}><Icon name="carry"/><span>CARRY</span></button>
      <button type="button" aria-label="Profile" onClick={() => onOpenProfile?.(currentAgent)}><Icon name="profile"/><span>PROFILE</span></button>
    </div>
    {(error || externalError) && !funding && <div className="agent-view__error" role="alert">{error || externalError}</div>}
    <div ref={feedRef} className="agent-view__thread">
      <span className="agent-view__thread-space" />
      {chat.map(msg => {
        if (msg.role === 'replay') return <div className="agent-view__hand" key={msg._id}><ReplayCard compact hand={msg.hand} onOpen={() => onReplay(msg.hand)}/></div>;
        if (msg.role === 'growth') return <div className="agent-view__note" key={msg._id}>{msg.tick.cause}</div>;
        if (msg.role === 'noflags') return <div className="agent-view__note" key={msg._id}>No big bluffs, no bad beats. It was a quiet shift.</div>;
        if (msg.role === 'accepted') return <div className="agent-view__note" key={msg._id}>Change accepted.</div>;
        const mine = msg.role === 'user';
        return <div key={msg._id} className={`agent-view__line${mine ? ' is-mine' : ''}`}>
          {!mine && <div className="agent-view__head">{face(26)}</div>}
          <div className="agent-view__text">{msg.role === 'proposal' ? <><ProposalDetails proposal={msg.proposal} profile={agent.profile}/><div className="agent-view__proposal"><button type="button" disabled={accepting} onClick={() => onAccept(msg._id)}>Accept change</button><button type="button" onClick={() => inputRef.current?.focus()}>Discuss</button></div></> : msg.content}</div>
        </div>;
      })}
      {loading && <div className="agent-view__line"><div className="agent-view__head">{face(26)}</div><div className="agent-view__text" role="status" aria-label="Thinking"><span className="dr-typing"><i/><i/><i/></span></div></div>}
    </div>
    <form className="agent-view__composer" onSubmit={e => { e.preventDefault(); send(); }}>
      <div><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Whisper to him…" disabled={loading}/><button type="submit" aria-label="Send" disabled={loading || !draft.trim()}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>
    </form>
    {funding && <div className="agent-view__fund"><FundSheet agent={currentAgent} wallet={wallet} onCancel={() => { setFunding(false); setError(''); }} onConfirm={fund}/>{error && <div className="agent-view__error" role="alert">{error}</div>}</div>}
    {fridgeOpen && <FridgeSheet onClose={() => setFridgeOpen(false)} onStocked={afterStocked}/>}
  </section>;
}
