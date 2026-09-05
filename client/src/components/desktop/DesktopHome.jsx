import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { StandupPanel } from './StandupPanel.jsx';
import { ThreadPanel } from './ThreadPanel.jsx';
import { DeskTableStage } from './DeskTableStage.jsx';
import { WatchRail } from './WatchRail.jsx';
import { useAgentThread } from './useAgentThread.js';

const POLL_MS = 10_000;
const IDLE_KEY = '__standup__';

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  onWatchAgent, onDeployAgent, onCreateAgent, onSitOut,
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

  const liveCount = agents.filter((a) => a.activeTableId || a.liveGame?.tableId).length;
  const watchedId = isWatching ? watchingAgent?.id ?? null : null;

  // DSK2-3: a live tile is one gesture — subscribe if we are not already, and
  // put that table on the stage.
  const openTable = useCallback((agent) => {
    if (watchedId !== agent.id) onWatchAgent(agent);
    setDeskTableId(agent.id);
  }, [watchedId, onWatchAgent]);

  const deskIndex = agents.findIndex((a) => a.id === deskTableId);
  const deskAgent = deskIndex >= 0 ? agents[deskIndex] : null;

  // The watched agent left the table (or was retired) — fall back to the floor.
  useEffect(() => {
    if (deskTableId && !loading && deskIndex < 0) setDeskTableId(null);
  }, [deskTableId, deskIndex, loading]);

  if (deskAgent) {
    return (
      <div className="dsk-root">
        <DesktopTopBar liveCount={liveCount} />
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
      <DesktopTopBar liveCount={liveCount} />
      <div className="dsk-body">
        <div className="dsk-stage">
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

        {selected ? (
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
