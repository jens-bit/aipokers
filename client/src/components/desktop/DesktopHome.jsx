import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { callInAgent, collectFrom, collectsEverything, fetchWallet, fundAgent, money, pocketOf } from '../../lib/wallet.js';
import { DeskHome } from './DeskHome.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { StandupPanel } from './StandupPanel.jsx';
import { ThreadPanel } from './ThreadPanel.jsx';
import { DeskTableStage } from './DeskTableStage.jsx';
import { WatchRail } from './WatchRail.jsx';
import { useAgentThread } from './useAgentThread.js';
import { useTableThread } from '../../hooks/useTableThread.js';
import { FlaggedHandsSheet } from '../floor/FlaggedHandsSheet.jsx';
import { splitFloor, standupLine } from '../floor/agentView.js';
import { BirthCardRail } from './PlayerCardRail.jsx';
import { DeskWalletPanel } from './DeskWalletPanel.jsx';
import { DeskReplayStage } from './DeskReplayStage.jsx';
import { DeskReplayPanel } from './DeskReplayPanel.jsx';
import { PanelHead } from './panelParts.jsx';
import { RosterStrip } from './RosterStrip.jsx';
import { CasinoScreen } from '../../screens/CasinoScreen.jsx';

const POLL_MS = 10_000;
const IDLE_KEY = '__standup__';

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  onWatchAgent, onDeployAgent, onCreateAgent, onSitOut,
  // WATCH-8: the socket's own status, so the desk's rail refetches the stored
  // thread when the connection comes back — the same rule the phone's sheet
  // follows, from the same hook.
  connection = null,
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
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // One draft per agent (plus the idle panel's own). Lifted above ThreadPanel
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
  const [wallet, setWallet] = useState(null);
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
  const homeStage = stage !== 'casino';

  useEffect(() => { if (deployAgent) setStage('casino'); }, [deployAgent]);

  useEffect(() => {
    let cancelled = false;
    fetchWallet().then((w) => { if (!cancelled) setWallet(w); });
    return () => { cancelled = true; };
  }, []);

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
  const homeDraftKey = homeStage && homePanel === 'agent' ? homeFocusId : null;
  const draftKey = deskTableId ?? homeDraftKey ?? selectedId ?? IDLE_KEY;
  const setDraft = useCallback((text) => {
    setDrafts((prev) => ({ ...prev, [draftKey]: text }));
  }, [draftKey]);

  const load = useCallback(() => {
    fetch(`/api/agents?userId=${getUserId()}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data.agents) ? data.agents : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // DP-2: after a fund or a collect, re-read both sides of the transfer rather
  // than guessing at either locally.
  const refreshWallet = useCallback(async () => {
    setWallet(await fetchWallet());
    load();
  }, [load]);

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

  // Resolve against the latest poll so the open thread's mood/state stay fresh.
  const selectedIndex = agents.findIndex((a) => a.id === selectedId);
  const selected = selectedIndex >= 0 ? agents[selectedIndex] : null;

  // A selected agent that has been deleted elsewhere must not strand the panel.
  const hadSelection = useRef(false);
  useEffect(() => {
    if (selectedId && !loading && selectedIndex < 0 && hadSelection.current) setSelectedId(null);
    if (selectedIndex >= 0) hadSelection.current = true;
  }, [selectedId, selectedIndex, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (flaggedAgent) { setFlaggedAgent(null); return; }
      if (bornId) { setBornId(null); return; }
      if (deskTableId) { setDeskTableId(null); return; }
      if (walletOpen) { setWalletOpen(false); return; }
      // DESK-2: on the HOME stage Escape backs the rail out to the room, which
      // is the resting panel there the way the standup was on the old floor.
      if (homeStage && homePanel !== 'thread') { setHomePanel('thread'); return; }
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flaggedAgent, deskTableId, bornId, walletOpen, homeStage, homePanel]);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(agents.map((a) => a.id));
    if (knownIds.current === null) { knownIds.current = ids; return; }
    const fresh = agents.find((a) => !knownIds.current.has(a.id));
    knownIds.current = ids;
    if (fresh) { setBornId(fresh.id); setSelectedId(null); }
  }, [agents, loading]);

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
  const topNet = agents.length === 0 ? '—'
    : netTotal < 0 ? `−$${Math.abs(netTotal).toLocaleString()}` : `+$${netTotal.toLocaleString()}`;
  const topFlagged = agents.length === 0 ? '—' : `${flaggedTotal} flagged`;
  const firstFlaggable = agents.find((a) => (a.flaggedCount ?? 0) > 0) ?? null;

  const topBar = (
    <DesktopTopBar
      liveCount={liveCount}
      standupLine={playing.length === 0 ? topLine : null}
      net={topNet}
      flagged={topFlagged}
      // DESK-2: on the HOME stage the standup is a rail panel, so the button
      // that has always been called Standup opens the standup. Elsewhere it
      // keeps CASINO-1's behaviour — straight to the flagged hands.
      onStandup={homeStage
        ? () => { setWalletOpen(false); setBornId(null); setHomePanel('standup'); }
        : (firstFlaggable ? () => setFlaggedAgent(firstFlaggable) : undefined)}
      onWallet={wallet ? () => { setSelectedId(null); setBornId(null); setWalletOpen(true); } : undefined}
      walletLabel={wallet ? money(wallet.balance) : null}
      stage={stage}
      onStage={(next) => {
        if (next === 'floor' && deployAgent) onCancelDeploy?.();
        setStage(next);
      }}
    />
  );

  // DSK2-3: a live tile is one gesture — subscribe if we are not already, and
  // put that table on the stage.
  const openTable = useCallback((agent) => {
    if (watchedId !== agent.id) onWatchAgent(agent);
    setDeskTableId(agent.id);
  }, [watchedId, onWatchAgent]);

  const born = bornId ? agents.find((a) => a.id === bornId) ?? null : null;
  // FIX-2c's rule, still: when a panel takes the roster's place, the collapsed
  // strip gives the who-is-playing glance back at 68px.
  //
  // DESK-2 adds the room's own two exceptions. The ROOM is a roster — every
  // agent is either a body in it or a frame on its wall — so the strip is not
  // drawn while the rail is showing the room's thread; and the STANDUP holds
  // the full roster itself, which is what the strip would be a collapse of.
  const homeRailIsRoster = homeStage && (homePanel === 'thread' || homePanel === 'standup');
  const panelOpen = !!born || !!selected || walletOpen
    || (homeStage && !walletOpen && !born && !homeRailIsRoster);

  const deskIndex = agents.findIndex((a) => a.id === deskTableId);
  const deskAgent = deskIndex >= 0 ? agents[deskIndex] : null;

  // The watched agent left the table (or was retired) — fall back to the floor.
  useEffect(() => {
    if (deskTableId && !loading && deskIndex < 0) setDeskTableId(null);
  }, [deskTableId, deskIndex, loading]);

  if (replay) {
    return (
      <div className="dsk-root">
        {topBar}
        <div className="dsk-body">
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

  if (deskAgent) {
    return (
      <div className="dsk-root">
        {topBar}
        <div className="dsk-body">
          <DeskWatch
            agent={deskAgent}
            game={watchedId === deskAgent.id ? game : null}
            lastDecision={watchedId === deskAgent.id ? lastDecision : null}
            connection={connection}
            draft={drafts[deskAgent.id] ?? ''}
            onDraftChange={setDraft}
            onBack={() => setDeskTableId(null)}
            onSitOut={onSitOut}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dsk-root">
      {topBar}
      <div className="dsk-body">
        {/* FIX-2c: a panel is open, so StandupPanel (which holds the roster) is
            gone. The ref's collapsed rail gives the who-is-playing glance back
            at 68px, which is what keeps 68 + stage + 520 inside 1440. */}
        {panelOpen && (
          <RosterStrip
            agents={agents}
            activeId={homeStage && !walletOpen && !born ? homeFocusId : (selectedId ?? bornId)}
            onSelect={(agent) => {
              setBornId(null);
              setWalletOpen(false);
              // On the HOME stage the thread the strip opens is the rail's, in
              // the room — there is no second panel for it to land in.
              if (homeStage) { setHomeFocusId(agent.id); setHomePanel('agent'); return; }
              setSelectedId(agent.id);
            }}
          />
        )}
        <div className="dsk-stage">
          {flaggedAgent && (
            <div className="dsk-sheet">
              <FlaggedHandsSheet agent={flaggedAgent} onBack={() => setFlaggedAgent(null)} />
            </div>
          )}
          {draft && <div className="dsk-sheet">{draft}</div>}
          {stage === 'casino' ? (
            <CasinoScreen
              desktop
              wsUrl={wsUrl}
              deployAgent={deployAgent}
              onDeployed={onDeployed}
              onSpectate={onSpectate}
              onCancelDeploy={() => { onCancelDeploy?.(); setStage('floor'); }}
            />
          ) : (
            // DESK-2 — the flat, and its rail. DeskHome carries its own 520 rail
            // (the room's thread, or a fixture, or one man), so the HOME stage
            // spans the body and the panels below are not drawn beside it.
            <DeskHome
              wsUrl={wsUrl}
              wallet={wallet}
              game={game}
              lastDecision={lastDecision}
              watchedId={watchedId}
              drafts={drafts}
              onDraftChange={setDraft}
              onRefreshWallet={refreshWallet}
              onWatch={onWatchAgent}
              onDeploy={onDeployAgent}
              onCreateAgent={onCreateAgent}
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
              panel={walletOpen || bornId ? 'none' : homePanel}
              onPanel={setHomePanel}
              focusId={homeFocusId}
              onFocusId={setHomeFocusId}
            />
          )}
        </div>

        {walletOpen ? (
          <DeskWalletPanel
            wallet={wallet}
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
        ) : homeStage ? null : selected ? (
          <ThreadPanel
            key={selected.id}
            agent={selected}
            accentIndex={selectedIndex}
            game={game}
            lastDecision={lastDecision}
            isWatched={watchedId === selected.id}
            draft={drafts[selected.id] ?? ''}
            onDraftChange={setDraft}
            onClose={() => setSelectedId(null)}
            onWatch={onWatchAgent}
            onDeploy={onDeployAgent}
            onFocusTable={() => openTable(selected)}
          />
        ) : (
          <StandupPanel
            agents={agents}
            loading={loading}
            game={game}
            lastDecision={lastDecision}
            selectedId={selectedId}
            watchedId={watchedId}
            draft={drafts[IDLE_KEY] ?? ''}
            onDraftChange={setDraft}
            onSelect={(agent) => setSelectedId(agent.id)}
            onOpenTable={openTable}
            onDraftAgent={onCreateAgent}
            onOpenFlagged={(agent, hand) => {
              // A row names its hand: that one goes to the theatre. VIEW ALL
              // has no hand, so it opens the sheet with the whole list.
              if (hand) setReplay({ agent, hand });
              else setFlaggedAgent(agent);
            }}
          />
        )}
      </div>
    </div>
  );
}

// The table stage plus its analysis rail. Split out so the thread hook only
// mounts while a table is actually on screen.
function DeskWatch({ agent, game, lastDecision, connection, draft, onDraftChange, onBack, onSitOut }) {
  const { chat, sending, send } = useAgentThread(agent);
  const seats = game?.seats || [];
  const named = seats.findIndex((s) => s?.displayName === agent.name);
  const heroSeat = named >= 0 ? named : 0;

  // WATCH-8 job 3: the stored record of this stay. At 1440 the rail is always
  // open, so it is always wanted — where the phone asks for it when the sheet
  // comes up. Same hook, same lines, same server clock.
  const stored = useTableThread({
    agentId: agent?.id,
    sessionId: game?.sessionId ?? null,
    connection,
    want: true,
  });

  return (
    <>
      <DeskTableStage
        game={game}
        agentName={agent.name}
        lastDecision={lastDecision}
        onBack={onBack}
        onSitOut={onSitOut}
      />
      <WatchRail
        agent={agent}
        game={game}
        lastDecision={lastDecision}
        heroSeat={heroSeat}
        hands={agent.recentHands}
        thread={chat}
        stored={stored}
        draft={draft}
        sending={sending}
        onDraftChange={onDraftChange}
        onSend={(text) => { if (text.trim()) { onDraftChange(''); send(text); } }}
        onClose={onBack}
      />
    </>
  );
}
