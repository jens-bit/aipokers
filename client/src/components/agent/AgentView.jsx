// Board 42 C1–C3: the companion above his conversation. Network chat stays in
// AgentThread; money and wants use the same authenticated routes as Home.
import { NotYet } from '../ftu/NotYet.jsx';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { ghostHands, SEAT_GRIP } from '../system/GhostHands.jsx';
import { PlayingCard, parseCard } from '../system/PlayingCard.jsx';
import { NamePill } from '../home/atoms.jsx';
import { MoodChip } from '../floor/atoms.jsx';
import { identityOf } from '../../lib/identity.js';
import { answersFor, answerWant } from '../home/WantToast.jsx';
import { FundSheet } from '../wallet/FundSheet.jsx';
import { fetchWallet, fundAgent, money, pnlTone, pocketOf, signedMoney, stakesFor } from '../../lib/wallet.js';
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
const MENU_TABS = [['chat', 'Chat'], ['stats', 'Stats'], ['wardrobe', 'Wardrobe']];
const menuTab = value => MENU_TABS.some(([key]) => key === value) ? value : 'chat';

function ProposalDetails({proposal,profile}) {
  const deltas=Object.entries(proposal?.suggestedPatch?.profileDelta ?? {}).filter(([,delta])=>Number.isFinite(Number(delta)));
  return <>{proposal?.reasoning || proposal?.text}{deltas.length>0&&<div className="agent-view__proposal-details">{deltas.map(([key,delta])=>{
    const from=Math.round(profile?.[key]??50),to=Math.max(0,Math.min(100,from+Number(delta)));
    return <div key={key}>{proposalLabels[key]||key}: {from}% → {to}%</div>;
  })}<small>Applies on the next deploy.</small></div>}</>;
}

export function AgentView({ agent, mood, heat, chat, loading, draft, setDraft, send, inputRef, feedRef, onBack, onOpenProfile, onDeploy, onWatch, onCarry, onReplay, onAccept, accepting, desktop = false, externalError = '', initialTab = 'chat', statsContent, wardrobeContent, onAppearanceSaved, onTabChange }) {
  const [tab, setTab] = useState(() => menuTab(initialTab));
  const [moreOpen, setMoreOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savedAppearance, setSavedAppearance] = useState(null);
  const tabId = useId();
  const moreButton = useRef(null);
  const scope = `${getUserId()}\0${getTelegramInitData()}\0${agent.id}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const servedAppearance = JSON.stringify(agent.identity ?? null);
  const savedIdentity = savedAppearance?.scope === scope && savedAppearance.base === servedAppearance ? savedAppearance.identity : null;
  useEffect(() => { setTab(menuTab(initialTab)); setMoreOpen(false); }, [scope, initialTab]);
  useEffect(() => { setPreview(null); setSavedAppearance(null); }, [scope]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = event => { if (event.key === 'Escape') { event.stopPropagation(); setMoreOpen(false); moreButton.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [moreOpen]);
  const onPreview = useCallback(appearance => {
    if (currentScope.current === scope) setPreview(appearance ? { scope, identity: appearance } : null);
  }, [scope]);
  const onSaved = useCallback(nextAgent => {
    if (currentScope.current !== scope || String(nextAgent?.id) !== String(agent.id) || !nextAgent?.identity) return;
    setSavedAppearance({ scope, base: servedAppearance, identity: nextAgent.identity });
    setPreview(null);
    onAppearanceSaved?.(nextAgent);
  }, [scope, agent.id, servedAppearance, onAppearanceSaved]);
  const bodySize = desktop ? 132 : 178;
  // TABLE-1 job F: this is the one place the room hands the owner his own
  // agent, mid-hand, with nothing of the felt in view — the figure was
  // already drawn here, and what he is holding was not. liveGame.heroHole
  // rides the same `/api/agents` call this view already reads (table.js's
  // liveGameView gates it on `includeHole`, which presentAgent only sets true
  // for the owner), so this is not a new subscription or a new endpoint —
  // it is a field this call already carries that nothing here had drawn.
  const heroHole = Array.isArray(agent.liveGame?.heroHole) && agent.liveGame.heroHole.length === 2
    ? agent.liveGame.heroHole.map(parseCard)
    : null;
  const [want, setWant] = useState(agent.want ?? null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [funding, setFunding] = useState(false);
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [pocketOverride, setPocketOverride] = useState(null);
  useEffect(() => { setWant(agent.want ?? null); }, [agent.want]);
  useEffect(() => { setPocketOverride(null); }, [agent.pocket]);
  const currentAgent = pocketOverride || savedIdentity ? { ...agent, ...(pocketOverride ? { pocket: pocketOverride } : {}), ...(savedIdentity ? { identity: savedIdentity } : {}) } : agent;
  const identity = identityOf(currentAgent);
  const stageIdentity = tab === 'wardrobe' && preview?.scope === scope ? identityOf({ ...currentAgent, identity: preview.identity }) : identity;
  const pocket = pocketOf(currentAgent);
  const live = !!(agent.activeTableId || agent.location?.tableId || agent.liveGame?.tableId);
  // A buy-in leaves the pocket while its chips remain in the live seat.
  // Only the table's session net measures what that seat has won or lost.
  const displayedNet = live ? agent.liveGame?.net : pocket?.pnl;
  const blinds = agent.liveGame?.blinds ?? agent.location?.blinds;
  const smallBlind = agent.liveGame?.smallBlind ?? blinds?.small;
  const bigBlind = agent.liveGame?.bigBlind ?? blinds?.big;
  const liveStakes = Number.isFinite(smallBlind) && Number.isFinite(bigBlind) ? `${smallBlind}/${bigBlind}`
    : typeof blinds === 'string' && /^\$?\d+\/\$?\d+$/.test(blinds) ? blinds.replaceAll('$', '') : 'Live game';
  const atHome = !agent.location?.where || agent.location.where === 'home';
  const lastLine = (desktop || chat.some(m => m.role === 'user')) ? [...chat].reverse().find(m => m.role === 'assistant' && !m.error)?.content : null;
  const face = (size, look = identity) => <MoodGhost mood={mood} heat={heat} size={size} ring={false} hood={look.hood} glow={look.glow.c} accent={look.glow.c} />;

  function selectTab(next) { setTab(next); setMoreOpen(false); onTabChange?.(next); }
  function navigateTabs(event) {
    const index = MENU_TABS.findIndex(([key]) => key === tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % MENU_TABS.length
      : event.key === 'ArrowLeft' ? (index + MENU_TABS.length - 1) % MENU_TABS.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? MENU_TABS.length - 1 : null;
    if (next == null) return;
    event.preventDefault();
    const key = MENU_TABS[next][0];
    selectTab(key);
    document.getElementById(`${tabId}-${key}`)?.focus();
  }

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
      else if (result.needs === 'thread') { selectTab('chat'); requestAnimationFrame(() => inputRef.current?.focus()); }
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
      <button ref={moreButton} className="agent-view__more" type="button" aria-label="More actions" aria-expanded={moreOpen} aria-controls={`${tabId}-actions`} onClick={() => setMoreOpen(!moreOpen)}>···</button>
      {desktop && <button type="button" className="agent-view__close" aria-label="Close panel" onClick={onBack}>×</button>}
    </header>
    {moreOpen && <><button className="agent-view__menu-dismiss" aria-label="Close actions" onClick={() => setMoreOpen(false)}/><div className="agent-view__menu" id={`${tabId}-actions`} aria-label="Agent actions">
      <button type="button" disabled={!atHome || !onCarry} onClick={() => { setMoreOpen(false); onCarry(currentAgent); }}><Icon name="carry"/>Carry</button>
      {onOpenProfile && <button type="button" onClick={() => { setMoreOpen(false); onOpenProfile(currentAgent); }}><Icon name="profile"/>His sheet</button>}
    </div></>}
    <div className="agent-view__stage" data-testid="agent-stage">
      <div className="agent-view__glow" style={{ background: `radial-gradient(ellipse at 50% 74%, ${stageIdentity.glow.c}14, transparent 68%)` }} />
      <div className="agent-view__shadow" />
      <div className="agent-view__body"><NamePill name={agent.name} nickname={agent.nickname} fatigue={agent.fatigue} heat={heat} accent="#EDEDED"/><div className="agent-view__breath">{face(bodySize, stageIdentity)}<svg className="agent-view__hands" width={bodySize} height={bodySize} viewBox="0 0 80 80" aria-hidden>{ghostHands({ pose: 'rest', size: bodySize, grip: SEAT_GRIP })}</svg>
        {/* TABLE-1 job F: his own two cards, face up — the server only sends
            heroHole to the authenticated owner, so a card drawn here is
            always one this viewer is entitled to (WatchHero's own rule). */}
        {heroHole && <span className="agent-view__hole" data-testid="agent-view-hole" aria-label="His cards">
          {heroHole.map((c, i) => <span key={i} className="agent-view__hole-card" style={{ transform: `rotate(${i ? 6 : -6}deg)` }}>
            <PlayingCard rank={c.rank} suit={c.suit} w={desktop ? 36 : 44} h={desktop ? 50 : 61} />
          </span>)}
        </span>}
      </div></div>
      {agent.drinking === true && <div className="agent-view__bottle" aria-label="Drinking"><i/><b/><span/></div>}
      {(want || lastLine) && <div className="agent-view__speech">
        <div className={`agent-view__bubble${want ? ' is-want' : ''}`}>{want?.text || lastLine}</div>
        {want && <div className="agent-view__answers">{answersFor(want).map(a => <button key={a.id} type="button" disabled={!!busy} onClick={() => answer(a.id)}>{a.label}</button>)}</div>}
      </div>}
    </div>
    <div className="agent-view__actions">
      <button type="button" className="agent-view__deploy" disabled={live ? !onWatch : !onDeploy} onClick={() => live ? onWatch(currentAgent) : onDeploy(currentAgent)}>
        <b>{live ? 'WATCH' : 'DEPLOY'}</b>
        <span>
          {live ? liveStakes : <>{stakesFor(pocket).replaceAll('$', '')} · {money(pocket?.balance)}</>}
          {/* UI-3 job C: his NET, not just his stack — a pocket and what he
              has actually made are two different numbers. A `title` alone is
              invisible on a phone (nothing to hover), so the word itself has
              to sit on the button, same as FundSheet's "his net" line. */}
          {Number.isFinite(displayedNet) && (
            <>
              {live ? ' · ' : null}
              <b className={`agent-view__net agent-view__net--${pnlTone(displayedNet)}`}> {signedMoney(displayedNet)}</b>
              <small className="agent-view__net-label"> net</small>
            </>
          )}
        </span>
      </button>
      <button type="button" aria-label="Give chips" onClick={openFunds}><Icon name="chips"/><span>GIVE CHIPS</span></button>
    </div>
    <nav className="agent-view__tabs" role="tablist" aria-label="Character sections" onKeyDown={navigateTabs}>{MENU_TABS.map(([key, label]) => <button key={key} id={`${tabId}-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`${tabId}-${key}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)}>{label}</button>)}</nav>
    {(error || externalError) && !funding && <div className="agent-view__error" role="alert">{error || externalError}</div>}
    <div className="agent-view__pane agent-view__pane--chat" id={`${tabId}-chat-panel`} role="tabpanel" aria-labelledby={`${tabId}-chat`} hidden={tab !== 'chat'}>
    <div ref={feedRef} className="agent-view__thread">
      <span className="agent-view__thread-space" />
      {chat.map(msg => {
        if (msg.role === 'replay') return <div className="agent-view__hand" key={msg._id}><ReplayCard compact hand={msg.hand} onOpen={() => onReplay(msg.hand)}/></div>;
        if (msg.role === 'growth') return <div className="agent-view__note" key={msg._id}>{msg.tick.cause}</div>;
        if (msg.role === 'noflags') return <div className="ftu-thread-note" key={msg._id}><NotYet fact="NOTHING WORTH FLAGGING" voice="No big bluffs, no bad beats. It was a quiet shift." fills="When a hand is worth watching, it arrives here as a replay you can scrub."/></div>;
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
    </div>
    <div className="agent-view__pane agent-view__pane--stats" id={`${tabId}-stats-panel`} role="tabpanel" aria-labelledby={`${tabId}-stats`} hidden={tab !== 'stats'}>{statsContent ?? <p className="agent-view__unavailable">His statistics are not available yet.</p>}</div>
    <div className="agent-view__pane agent-view__pane--wardrobe" id={`${tabId}-wardrobe-panel`} role="tabpanel" aria-labelledby={`${tabId}-wardrobe`} hidden={tab !== 'wardrobe'}>{typeof wardrobeContent === 'function' ? wardrobeContent({ onPreview, onSaved }) : wardrobeContent ?? <p className="agent-view__unavailable">His wardrobe is not available yet.</p>}</div>
    {funding && <div className="agent-view__fund"><FundSheet agent={currentAgent} wallet={wallet} onCancel={() => { setFunding(false); setError(''); }} onConfirm={fund}/>{error && <div className="agent-view__error" role="alert">{error}</div>}</div>}
    {fridgeOpen && <FridgeSheet onClose={() => setFridgeOpen(false)} onStocked={afterStocked}/>}
  </section>;
}
