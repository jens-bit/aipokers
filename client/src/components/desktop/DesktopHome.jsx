import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { collectFrom, fetchWallet, fundAgent, money } from '../../lib/wallet.js';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { StandupPanel } from './StandupPanel.jsx';
import { ThreadPanel } from './ThreadPanel.jsx';
import { DeskTableStage } from './DeskTableStage.jsx';
import { WatchRail } from './WatchRail.jsx';
import { useAgentThread } from './useAgentThread.js';
import { FlaggedHandsSheet } from '../floor/FlaggedHandsSheet.jsx';
import { splitFloor, standupLine } from '../floor/agentView.js';
import { BirthCardRail } from './PlayerCardRail.jsx';
import { DeskWalletPanel } from './DeskWalletPanel.jsx';
import { DeskReplayStage } from './DeskReplayStage.jsx';
import { DeskReplayPanel } from './DeskReplayPanel.jsx';
import { PanelHead } from './panelParts.jsx';
import { RosterStrip } from './RosterStrip.jsx';

const POLL_MS = 10_000;
const IDLE_KEY = '__standup__';

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  onWatchAgent, onDeployAgent, onCreateAgent, onSitOut,
  // DP-4: the draft, when one is under way. It runs on the stage as a sheet so
  // the shell around it — top bar, roster, open panel — stays mounted; App
  // returning it on its own would take the desk down for the duration.
  draft = null,
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
  const draftKey = deskTableId ?? selectedId ?? IDLE_KEY;
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
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flaggedAgent, deskTableId, bornId]);

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
      onStandup={firstFlaggable ? () => setFlaggedAgent(firstFlaggable) : undefined}
      onWallet={wallet ? () => { setSelectedId(null); setBornId(null); setWalletOpen(true); } : undefined}
      walletLabel={wallet ? money(wallet.balance) : null}
    />
  );

  // DSK2-3: a live tile is one gesture — subscribe if we are not already, and
  // put that table on the stage.
  const openTable = useCallback((agent) => {
    if (watchedId !== agent.id) onWatchAgent(agent);
    setDeskTableId(agent.id);
  }, [watchedId, onWatchAgent]);

  const born = bornId ? agents.find((a) => a.id === bornId) ?? null : null;
  const panelOpen = !!born || !!selected || walletOpen;

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
            activeId={selectedId ?? bornId}
            onSelect={(agent) => { setBornId(null); setWalletOpen(false); setSelectedId(agent.id); }}
          />
        )}
        <div className="dsk-stage">
          {flaggedAgent && (
            <div className="dsk-sheet">
              <FlaggedHandsSheet agent={flaggedAgent} onBack={() => setFlaggedAgent(null)} />
            </div>
          )}
          {draft && <div className="dsk-sheet">{draft}</div>}
          <CasinoFloor
            desktopMode
            selectedAgentId={selectedId}
            onGhostSelect={(agent) => setSelectedId(agent ? agent.id : null)}
            onChat={(agent) => setSelectedId(agent.id)}
            onWatch={onWatchAgent}
            onProfile={() => {}}
            onDeploy={onDeployAgent}
            onCreateAgent={onCreateAgent}
          />
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
              try { await collectFrom(agent.id); await refreshWallet(); }
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
        ) : selected ? (
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
function DeskWatch({ agent, game, lastDecision, draft, onDraftChange, onBack, onSitOut }) {
  const { sending, send } = useAgentThread(agent);
  const seats = game?.seats || [];
  const named = seats.findIndex((s) => s?.displayName === agent.name);
  const heroSeat = named >= 0 ? named : 0;

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
        draft={draft}
        sending={sending}
        onDraftChange={onDraftChange}
        onSend={(text) => { if (text.trim()) { onDraftChange(''); send(text); } }}
        onClose={onBack}
      />
    </>
  );
}
