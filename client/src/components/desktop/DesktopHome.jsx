import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { StandupPanel } from './StandupPanel.jsx';
import { ThreadPanel } from './ThreadPanel.jsx';

const POLL_MS = 10_000;
const IDLE_KEY = '__standup__';

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  onFocusTable, onWatchAgent, onDeployAgent, onCreateAgent,
}) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // One draft per agent (plus the idle panel's own). Lifted above ThreadPanel
  // so a half-typed message survives switching agents — the panel remounts,
  // this map does not.
  const [drafts, setDrafts] = useState({});
  const draftKey = selectedId ?? IDLE_KEY;
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
            onFocusTable={onFocusTable}
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
            onWatch={onWatchAgent}
            onFocusTable={onFocusTable}
            onDraftAgent={onCreateAgent}
          />
        )}
      </div>
    </div>
  );
}
