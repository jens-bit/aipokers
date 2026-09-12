import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { callInAgent, collectFrom, collectsEverything, fundAgent, money, pocketOf } from '../../lib/wallet.js';
import { useWallet } from '../../hooks/useWallet.js';
import { DeskHomeTable } from './DeskHomeTable.jsx';
import { DeskHome } from './DeskHome.jsx';
import { activityKeys } from '../system/RailMotion.jsx';
import { DesktopTopBar, desktopRoomSummary } from './DesktopTopBar.jsx';
import { useHomeAppearance } from '../home/HomeAppearance.jsx';
import { heroSeatOf } from './DeskTableStage.jsx';
import { DeskCasinoTable } from './DeskCasinoTable.jsx';
import { WatchRail } from './WatchRail.jsx';
import { WatchAccessNotice } from '../WatchScreen.jsx';
import { useAgentThread } from './useAgentThread.js';
import { useTableThread } from '../../hooks/useTableThread.js';
import { FlaggedHandsSheet } from '../floor/FlaggedHandsSheet.jsx';
import { splitFloor, standupLine } from '../floor/agentView.js';
import { BirthCardRail } from './PlayerCardRail.jsx';
import { DeskWalletPanel } from './DeskWalletPanel.jsx';
import { DeskReplayStage } from './DeskReplayStage.jsx';
import { DeskReplayPanel } from './DeskReplayPanel.jsx';
import { PanelHead } from './panelParts.jsx';
import { DeskRoster } from './DeskRoster.jsx';
import { CasinoScreen } from '../../screens/CasinoScreen.jsx';
import { resolveDeepLink } from '../../lib/deeplink.js';
// BUG-156: the desk shell's 72KB sheet belongs to the desk shell. Nothing
// outside this island names .dsk-*, and its few non-dsk rules are --desk
// overrides that only render once this has mounted.
import '../../styles/desktop.css';

const POLL_MS = 10_000;
const IDLE_KEY = '__standup__';

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  tableConfig = null, tableError = null, chatMessages = [], mySeat = null, legalActions = [], onAct, onLeave, onSitAtTable,
  sessionEnd = null, onRebuy,
  onWatchAgent, onDeployAgent, onCreateAgent, onSitOut,
  onPractice, practiceReturn = null, birthHandledId = null,
  // WATCH-8: the socket's own status, so the desk's rail refetches the stored
  // thread when the connection comes back — the same rule the phone's sheet
  // follows, from the same hook.
  connection = null,
  // WATCH-9: the thread lines this socket has been pushed. Only meaningful for
  // the agent actually being watched — see the guard where DeskWatch takes it.
  threadLines = null,
  // CASINO-1: the casino is the same screen on the desk, in the stage, per
  // board 31's frame — top bar across, rail on the right, only the stage
  // swapped. An agent handed to `deployAgent` puts it there on its own,
  // because being handed one IS the walk into the building.
  wsUrl = null, deployAgent = null, onDeployed = null, onSpectate = null, onCancelDeploy = null,
  // DP-4: the draft, when one is under way. It runs on the stage as a sheet so
  // the shell around it — top bar, roster, open panel — stays mounted; App
  // returning it on its own would take the desk down for the duration.
  draft = null,
  // BIRTH-5: an INTENT, the way YouScreen's `openMoney` is one. The draft above
  // can be turned away by a locked slot, and the one thing it can offer then is
  // a look at the table — which on the desk is a rail panel this component owns
  // rather than a sheet the shell could raise on its own.
  openHomeTable = false,
}) {
  const { theme } = useHomeAppearance();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [casinoHeaderHost, setCasinoHeaderHost] = useState(null);
  const [homeTableSession, setHomeTableSession] = useState(null);
  const [publicTableId, setPublicTableId] = useState(null);
  const [casinoReturnRoomId, setCasinoReturnRoomId] = useState(null);

  // One draft per agent (plus the idle panel's own). Lifted above the panels
  // so a half-typed message survives switching agents — the panel remounts,
  // this map does not.
  const [drafts, setDrafts] = useState({});
  // Focusing a live table swaps the stage AND the rail, without leaving the
  // desktop shell (DSK2-3). Null means the floor is on stage.
  const [deskTableId, setDeskTableId] = useState(null);
  const [flaggedAgent, setFlaggedAgent] = useState(null);
  // DP-2: the wallet is a rail panel, reached from the net figure in the top
  // bar — the same number it is about.
  const [walletOpen, setWalletOpen] = useState(false);
  // DP-3: a flagged hand opens on the stage, with its beats in the rail —
  // D3ReplayScreenM's own split.
  const [replay, setReplay] = useState(null);
  const { wallet, status: walletStatus, refresh: readWallet } = useWallet();
  // CASINO-1: 'floor' (today's room) or 'casino' (the building). Local to the
  // desk because the desktop shell has no tab bar to hold it.
  //
  // DESK-2: 'floor' is now HOME — the flat, which is what the HOME tab shows on
  // the phone and what the top bar has always called this stage. The old
  // CasinoFloor is not drawn on the desk any more: it answered "who is playing",
  // the room answers "where is everybody", and two rooms is the one thing board
  // 31 says desktop must not have.
  const [stage, setStage] = useState('floor');
  // DESK-2: which panel the HOME rail is showing. It lives here because two of
  // the things that move it are the shell's — the top bar's Standup button, and
  // Escape — and because the shell has to be able to take the rail away
  // entirely when it puts one of its OWN panels beside the room.
  const [homePanel, setHomePanel] = useState('thread');
  // Which man the HOME rail is pointed at. Up here for the same reason the panel
  // is: the collapsed roster strip is one of the ways it changes, and the strip
  // is the shell's, not the room's.
  const [homeFocusId, setHomeFocusId] = useState(null);
  useEffect(() => {
    if (!practiceReturn) return;
    setStage(practiceReturn.kind === 'casino' ? 'casino' : 'floor');
    if (practiceReturn.kind === 'chat') {
      setHomeFocusId(practiceReturn.agentId);
      setHomePanel('agent');
    }
  }, [practiceReturn]);
  const homeStage = stage !== 'casino';

  useEffect(() => { if (deployAgent) setStage('casino'); }, [deployAgent]);

  // ATTR-2e-1: the card he was born with. App owns BirthScreen and is out of
  // this slice's scope, so the arrival is observed here instead — an id that
  // was not in the previous roster is a newborn, and it is shown once.
  const [bornId, setBornId] = useState(null);
  const knownIds = useRef(null);
  // BIRTH-5: the birth screen's refusal points at the table, and on the desk the
  // table is this rail. The shell's own panels (the wallet, a birth card) hold
  // the 520 when they are open, so they stand down first — otherwise the panel
  // would be set and nothing would appear.
  useEffect(() => {
    if (!openHomeTable) return;
    setWalletOpen(false);
    setBornId(null);
    setHomePanel('table');
  }, [openHomeTable]);

  // Whose composer is on screen. DESK-2: on the HOME stage the open thread is
  // the rail's, so the key follows the rail's focus — and only while the rail is
  // actually showing a man, because the standup's own composer is the idle one.
  const homeDraftKey = homeStage && ['agent', 'profile'].includes(homePanel) ? homeFocusId : null;
  const draftKey = deskTableId ?? homeDraftKey ?? IDLE_KEY;
  const setDraft = useCallback((text) => {
    setDrafts((prev) => ({ ...prev, [draftKey]: text }));
  }, [draftKey]);

  const rosterRead = useRef(0);
  const load = useCallback(() => {
    const request = ++rosterRead.current;
    fetch(`/api/agents?userId=${getUserId()}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (request !== rosterRead.current || !Array.isArray(data?.agents)) return;
        setAgents(data.agents);
        setLoading(false);
      })
      .catch(() => {});
  }, []);

  // The queue response can precede the table's creation, so its roster read
  // still says Home. Refresh as soon as STATE proves this owner is seated;
  // later hands at the same table do not create more roster requests.
  const confirmedWatch = isWatching && watchingAgent?.id && game?.tableId
    && game.tableId === tableConfig?.tableId
    && game.seats?.some(seat => seat.playerId === `agent_${watchingAgent.id}`)
    ? `${watchingAgent.id}:${game.tableId}` : null;
  useEffect(() => { if (confirmedWatch) load(); }, [confirmedWatch, load]);

  // DP-2: after a fund or a collect, re-read both sides of the transfer rather
  // than guessing at either locally.
  const refreshWallet = useCallback(async () => {
    await readWallet();
    load();
  }, [load, readWallet]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  useEffect(() => {
    if (!birthHandledId) return;
    load();
    setBornId(id => id === birthHandledId ? null : id);
  }, [birthHandledId, load]);

  // DESK-2: an agent the room's rail is pointed at who has been deleted
  // elsewhere must not strand the panel. This is the old selectedId guard,
  // following the rail's focus now that the rail is where a thread opens.
  const focusIndex = agents.findIndex((a) => a.id === homeFocusId);
  const hadFocus = useRef(false);
  useEffect(() => {
    if (homeFocusId && !loading && focusIndex < 0 && hadFocus.current) {
      setHomeFocusId(null);
      setHomePanel('thread');
    }
    if (focusIndex >= 0) hadFocus.current = true;
  }, [homeFocusId, focusIndex, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (flaggedAgent) { setFlaggedAgent(null); return; }
      if (bornId) { setBornId(null); return; }
      if (publicTableId) { setPublicTableId(null); onLeave?.(); return; }
      if (homeTableSession) { setHomeTableSession(null); onLeave?.(); return; }
      if (deskTableId) { setDeskTableId(null); onLeave?.(); return; }
      if (walletOpen) { setWalletOpen(false); return; }
      // DESK-2: on the HOME stage Escape backs the rail out to the room, which
      // is the resting panel there the way the standup was on the old floor.
      if (homeStage && homePanel !== 'thread') { setHomePanel('thread'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flaggedAgent, deskTableId, publicTableId, homeTableSession, onLeave, bornId, walletOpen, homeStage, homePanel]);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(agents.map((a) => a.id));
    if (knownIds.current === null) { knownIds.current = ids; return; }
    const fresh = agents.find((a) => !knownIds.current.has(a.id));
    knownIds.current = ids;
    // The draft already presents its own birth card. Only an arrival from
    // elsewhere needs this rail; a delayed poll after completion is covered too.
    if (fresh && !draft && fresh.id !== birthHandledId) {
      setBornId(fresh.id);
      setHomeFocusId(null);
      setHomePanel('thread');
    }
  }, [agents, loading, draft, birthHandledId]);

  const liveCount = agents.filter((a) => a.activeTableId || a.liveGame?.tableId).length;
  const watchedId = isWatching ? watchingAgent?.id ?? null : null;

  // The floor's own posture split: playing at the felt, resting at the bar,
  // sulking and tilted alone in the lounge corner.
  const { playing, resting, lounge } = splitFloor(agents);
  const topLine = loading ? 'Reading the room…' : standupLine({
    playing, resting, lounge, total: agents.length,
  });
  const netTotal = agents.reduce((sum, a) => sum + (a.careerStats?.net ?? 0), 0);
  const flaggedTotal = agents.reduce((sum, a) => sum + (a.flaggedCount ?? 0), 0);
  const topNet = agents.length === 0 ? '—' : money(netTotal, { sign: true });
  const topFlagged = agents.length === 0 ? '—' : `${flaggedTotal} flagged`;
  const firstFlaggable = agents.find((a) => (a.flaggedCount ?? 0) > 0) ?? null;

  const watchedAgent=agents.find(a=>a.id===deskTableId);
  const watchBlinds=Number.isFinite(game?.smallBlind)&&Number.isFinite(game?.bigBlind) ? game.smallBlind+'/'+game.bigBlind : null;
  const refusedBeforeSnapshot = !!tableError && !!tableConfig && !game && !publicTableId && !homeTableSession;
  const goHome=()=>{
    if(deskTableId||publicTableId||homeTableSession||refusedBeforeSnapshot)onLeave?.();
    setDeskTableId(null);setPublicTableId(null);setHomeTableSession(null);
    onCancelDeploy?.();setStage('floor');
  };

  const topBar = (
    <><DesktopTopBar news={loading ? null : activityKeys(agents)}
      homeAppearance={homeStage && !deskTableId && !publicTableId && !homeTableSession && !replay}
      roomPortalRef={!homeStage && !deskTableId && !replay && !homeTableSession && !publicTableId ? setCasinoHeaderHost : null}
      room={deskTableId || publicTableId ? {title:watchBlinds?'The table · '+watchBlinds:'The table',subtitle:watchedAgent?.name || 'Watching the table'} : homeTableSession ? {title:'The kitchen table',subtitle:homeTableSession.seated?'You are in the game · play money':'Watching the home game'} : !deskTableId && !replay ? { title: homeStage ? 'The flat' : 'The casino', subtitle: desktopRoomSummary(agents, loading) } : null}
      onHome={!homeStage || deskTableId || publicTableId || homeTableSession ? goHome : null}
      liveCount={liveCount}
      standupLine={playing.length === 0 ? topLine : null}
      net={topNet}
      flagged={topFlagged}
      // DESK-2: on the HOME stage the standup is a rail panel, so the button
      // that has always been called Standup opens the standup. Elsewhere it
      // keeps CASINO-1's behaviour — straight to the flagged hands.
      onStandup={deskTableId || homeTableSession || publicTableId ? undefined : homeStage
        ? () => { setWalletOpen(false); setBornId(null); setHomePanel('standup'); }
        : (firstFlaggable ? () => setFlaggedAgent(firstFlaggable) : undefined)}
      onWallet={wallet && !deskTableId && !homeTableSession && !publicTableId ? () => { setBornId(null); setWalletOpen(true); } : undefined}
      walletLabel={wallet ? money(wallet.balance) : null}
      stage={stage}
      onStage={(next) => {
        if (next === 'floor' && deployAgent) onCancelDeploy?.();
        setStage(next);
      }}
    />
    {refusedBeforeSnapshot && <WatchAccessNotice message={tableError} onBack={goHome}/>}</>
  );

  // DSK2-3: a live tile is one gesture — subscribe if we are not already, and
  // put that table on the stage.
  const openTable = useCallback((agent) => {
    if (watchedId !== agent.id) onWatchAgent(agent);
    setDeskTableId(agent.id);
  }, [watchedId, onWatchAgent]);

  // DESK-3: the roster is a permanent column now, on every stage — there is no
  // "collapsed" or "hidden" form of it any more (that was FIX-2c's strip, and
  // it existed only because the roster used to be a mode the panel toggled
  // away). A row's own click keeps the strip's old meaning exactly — his
  // thread, on the room — from whichever stage or table it is clicked from;
  // watching him play is still the felt's own gesture (a tile, a body, a
  // doorway), not the roster's.
  const rosterSelect = useCallback((agent) => {
    if (deskTableId || publicTableId || homeTableSession) onLeave?.();
    setPublicTableId(null);
    setHomeTableSession(null);
    setWalletOpen(false);
    setBornId(null);
    setDeskTableId(null);
    setReplay(null);
    setStage('floor');
    setHomeFocusId(agent.id);
    setHomePanel('agent');
  }, [onLeave, deskTableId, publicTableId, homeTableSession]);

  // Open the same companion card as the rail's Profile button. Room guests
  // are public projections; only an ID in the owner's roster opens this panel.
  const openProfile = useCallback((agent) => {
    const owned = !agent?.guest && agents.find(a => a.id === agent?.id && !a.guest);
    if (!owned) return;
    rosterSelect(owned);
    setHomePanel('profile');
  }, [agents, rosterSelect]);

  // The board and shared hand links resolve through the same owner-only lookup.
  // Keep the desktop theatre inside this shell so Back restores the casino.
  const replayCasinoEvent = useCallback(async row => {
    for (const agentId of row?.agentIds ?? []) {
      let opened;
      try { opened = await resolveDeepLink({ kind: 'hand', agentId: String(agentId), handId: row.handNumber }); }
      catch { continue; }
      if (opened?.kind === 'hand') { setReplay({ agent: opened.agent, hand: opened.hand }); return; }
      if (opened?.kind === 'agent') { rosterSelect(opened.agent); return; }
    }
  }, [rosterSelect]);

  const born = bornId ? agents.find((a) => a.id === bornId) ?? null : null;
  // Wave 61: the first draft also lives beside the actual empty room.
  const railHostsDraft = !!draft && homeStage && !walletOpen && !bornId;

  const deskIndex = agents.findIndex((a) => a.id === deskTableId);
  const deskAgent = deskIndex >= 0 ? agents[deskIndex] : null;

  // The watched agent left the table (or was retired) — fall back to the floor.
  useEffect(() => {
    if (deskTableId && !loading && deskIndex < 0) { setDeskTableId(null); onLeave?.(); }
  }, [deskTableId, deskIndex, loading, onLeave]);

  if (publicTableId) {
    const liveGame=tableConfig?.tableId===publicTableId && game?.tableId===publicTableId ? game : null;
    const rows=chatMessages.map((m,i)=>({id:'public-'+i,kind:'table',who:m.displayName || 'Table',text:m.text,t:m.timestamp ?? null}));
    const leave=()=>{setPublicTableId(null);onLeave?.();};
    const notice=tableError || (connection==='reconnecting' ? 'Reconnecting…' : !liveGame ? 'Opening the table…' : null);
    return <div className="dsk-root">{topBar}<div className="dsk-body">
      <DeskRoster agents={agents} loading={loading} activeId={null} watchedId={null} onSelect={rosterSelect} onDraftAgent={()=>{leave();setStage('floor');onCreateAgent?.();}}/>
      <div className="dsk-stage dsk-stage--felt"><DeskCasinoTable game={liveGame} mySeat={mySeat} notice={notice} onBack={leave}/></div>
      <WatchRail conversationOnly readOnly game={liveGame} stored={rows} onClose={leave}/>
    </div></div>;
  }

  if (homeTableSession) {
    const ready = String(tableConfig?.tableId) === String(homeTableSession.tableId);
    const liveGame = ready && String(game?.tableId) === String(homeTableSession.tableId) ? game : null;
    return <div className="dsk-root">{topBar}<div className="dsk-body">
      <DeskRoster agents={agents} loading={loading} activeId={null} watchedId={null}
        onSelect={rosterSelect} onDraftAgent={()=>{setHomeTableSession(null);onLeave?.();onCreateAgent?.();}}/>
      <DeskHomeTable game={liveGame} mySeat={mySeat} seated={homeTableSession.seated}
        legalActions={ready && tableConfig?.sitting ? legalActions : []} onAct={onAct} lastDecision={lastDecision} agents={agents} connection={connection}
        sessionEnd={homeTableSession.seated ? sessionEnd : null} onRebuy={onRebuy} buyIn={tableConfig?.buyIn}
        onBack={()=>{setHomeTableSession(null);onLeave?.();}}/>
    </div></div>;
  }

  if (replay) {
    return (
      <div className="dsk-root">
        {topBar}
        <div className="dsk-body">
          <DeskRoster
            loading={loading}
            agents={agents}
            activeId={replay.agent?.id ?? null}
            watchedId={watchedId}
            onSelect={rosterSelect}
            onDraftAgent={onCreateAgent}
          />
          <div className="dsk-stage">
            <DeskReplayStage
              hand={replay.hand}
              agentName={replay.agent?.name}
              onBack={() => setReplay(null)}
            />
          </div>
          <DeskReplayPanel
            hand={replay.hand}
            onClose={() => setReplay(null)}
          />
        </div>
      </div>
    );
  }

  if (deskAgent && !refusedBeforeSnapshot) {
    return (
      <div className="dsk-root">
        {topBar}
        <div className="dsk-body">
          <DeskRoster
            loading={loading}
            agents={agents}
            activeId={deskAgent.id}
            watchedId={watchedId}
            onSelect={rosterSelect}
            onDraftAgent={()=>{setDeskTableId(null);onLeave?.();setStage('floor');onCreateAgent?.();}}
          />
          <DeskWatch
            agent={deskAgent}
            mySeat={mySeat}
            game={watchedId === deskAgent.id ? game : null}
            lastDecision={watchedId === deskAgent.id ? lastDecision : null}
            connection={connection}
            threadLines={watchedId === deskAgent.id ? threadLines : null}
            draft={drafts[deskAgent.id] ?? ''}
            onDraftChange={setDraft}
            onBack={() => { setDeskTableId(null); onLeave?.(); }}
            onSitOut={onSitOut}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dsk-root" data-home-theme={homeStage ? theme : undefined}>
      {topBar}
      <div className="dsk-body">
        {/* DESK-3: three columns, always — the roster is furniture, not a mode
            a panel toggles it into. Same column on the room, the casino
            doors, and the room a doorway opens. */}
        <DeskRoster
          loading={loading}
          agents={agents}
          activeId={born ? born.id : homeFocusId}
          watchedId={watchedId}
          onSelect={rosterSelect}
          onDraftAgent={onCreateAgent}
        />
        <div className="dsk-stage">
          {flaggedAgent && (
            <div className="dsk-sheet">
              <FlaggedHandsSheet agent={flaggedAgent} onBack={() => setFlaggedAgent(null)} />
            </div>
          )}
          {/* DRAFT-2: on the HOME stage the draft is a RAIL PANEL beside the
              room, not a sheet over it — board 31's rule for every panel, and
              the reason the room is still there while he forms.
              Other stages use the full-stage sheet. Wave 61 gives the first
              draft the same right column beside the empty room. */}
          {draft && !railHostsDraft && <div className="dsk-sheet">{draft}</div>}
          {stage === 'casino' ? (
            <CasinoScreen
              desktop
              shellHeader
              headerTarget={casinoHeaderHost}
              initialRoomId={casinoReturnRoomId}
              wsUrl={wsUrl}
              deployAgent={deployAgent}
              onDeployed={(payload,agent,room)=>{
                setCasinoReturnRoomId(room?.id ?? null);
                setDeskTableId(agent.id);
                load();
                onDeployed?.(payload,agent,room);
              }}
              onSpectate={(tableId,context)=>{
                setCasinoReturnRoomId(context?.roomId ?? null);
                const owner=agents.find(a=>(a.activeTableId || a.liveGame?.tableId)===tableId);
                if(owner) openTable(owner);
                else {setPublicTableId(tableId);onSpectate?.(tableId);}
              }}
              onReplay={replayCasinoEvent}
              onCancelDeploy={() => { onCancelDeploy?.(); setStage('floor'); }}
            />
          ) : (
            // DESK-2 — the flat, and its rail. DeskHome carries its own 520 rail
            // (the room's thread, or a fixture, or one man), so the HOME stage
            // spans the body and the panels below are not drawn beside it.
            <DeskHome
              onCasino={() => setStage('casino')}
              onWatchTable={tableId=>{setHomeTableSession({tableId,seated:false});onSpectate?.(tableId);}}
              onSitAtTable={tableId=>{setHomeTableSession({tableId,seated:true});onSitAtTable?.(tableId);}}
              wsUrl={wsUrl}
              wallet={wallet}
              walletStatus={walletStatus}
              game={game}
              lastDecision={lastDecision}
              watchedId={watchedId}
              drafts={drafts}
              onDraftChange={setDraft}
              onRefreshWallet={refreshWallet}
              onWatch={openTable}
              onProfile={openProfile}
              onDeploy={onDeployAgent}
              onCreateAgent={onCreateAgent}
              // A live newborn may reach Home before his birth card is
              // acknowledged. Finish that introduction before leaving for practice.
              onPractice={draft || born ? null : onPractice}
              onFocusTable={openTable}
              onOpenFlagged={(agent, hand) => {
                // A row names its hand: that one goes to the theatre. VIEW ALL
                // has no hand, so it opens the sheet with the whole list.
                if (hand) setReplay({ agent, hand });
                else setFlaggedAgent(agent);
              }}
              // One rail at a time: the shell's own panel (the wallet, a birth
              // card) takes the 520 and the room's rail stands down, because
              // 520 + 520 + a 523-wide room does not fit in 1440.
              draft={railHostsDraft ? draft : null}
              panel={walletOpen || bornId ? 'none' : (railHostsDraft ? 'draft' : homePanel)}
              onPanel={setHomePanel}
              focusId={homeFocusId}
              onFocusId={setHomeFocusId}
            />
          )}
        </div>

        {walletOpen ? (
          <DeskWalletPanel
            wallet={wallet}
            walletStatus={walletStatus}
            onRetry={readWallet}
            agents={agents}
            onClose={() => setWalletOpen(false)}
            onFund={async (agent, decision) => {
              try { await fundAgent(agent.id, decision); await refreshWallet(); }
              catch { /* the panel stays where it is */ }
            }}
            onCollect={async (agent) => {
              // WALLET-7: the winnings, unless he has already been called in.
              const all = collectsEverything(pocketOf(agent));
              try { await collectFrom(agent.id, { all }); await refreshWallet(); }
              catch { /* the row stays as it was */ }
            }}
            onCallIn={async (agent) => {
              try { await callInAgent(agent.id); await refreshWallet(); }
              catch { /* the row stays as it was */ }
            }}
          />
        ) : born ? (
          <div className="dsk-panel">
            <PanelHead
              title="The card he was born with"
              sub={born.name.toUpperCase()}
              onClose={() => setBornId(null)}
            />
            <BirthCardRail agent={born} onDealIn={() => { setBornId(null); onDeployAgent(born); }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// The table stage plus its analysis rail. Split out so the thread hook only
// mounts while a table is actually on screen.
function DeskWatch({ agent, game, mySeat, lastDecision, connection, threadLines, draft, onDraftChange, onBack, onSitOut }) {
  const { chat, sending, send, error } = useAgentThread(agent);
  const composerRef=useRef(null);
  const heroSeat = heroSeatOf(game,agent.name,mySeat);

  // WATCH-8 job 3: the stored record of this stay. At 1440 the rail is always
  // open, so it is always wanted — where the phone asks for it when the sheet
  // comes up. Same hook, same lines, same server clock.
  // WATCH-9: and pushed from there. The rail is always open at 1440, which is
  // exactly the surface a fetch-on-open leaves stalest.
  const stored = useTableThread({
    agentId: agent?.id,
    sessionId: game?.sessionId ?? null,
    connection,
    want: true,
    pushed: threadLines,
  });

  return (
    <>
      {/* DESK-3, job 4: the felt caps at 900 — past that the rope and the hero
          row drift apart — and centres in whatever the roster and the rail
          leave it, rather than stretching full-bleed the way DESK-2 drew it. */}
      <div className="dsk-stage dsk-stage--felt">
        <DeskCasinoTable
          onTapHero={()=>composerRef.current?.focus()}
          game={game}
          agent={agent}
          mySeat={mySeat}
          lastDecision={lastDecision}
          onBack={onBack}
          onSitOut={onSitOut}
        />
      </div>
      <WatchRail
        composerRef={composerRef}
        conversationOnly
        agent={agent}
        game={game}
        lastDecision={lastDecision}
        heroSeat={heroSeat}
        hands={agent.recentHands}
        thread={chat}
        error={error}
        stored={stored}
        draft={draft}
        sending={sending}
        onDraftChange={onDraftChange}
        onSend={async text => { if (text.trim()) { onDraftChange(''); if (!await send(text)) onDraftChange(text); } }}
        onClose={onBack}
      />
    </>
  );
}
