import { useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../lib/telegram.js';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { GameTile } from './GameTile.jsx';
import { PStandupCard } from './PStandupCard.jsx';

const POLL_MS = 10_000;

export function DesktopHome({
  game, lastDecision, watchingAgent, isWatching,
  onFocusTable, onWatchAgent, onDeployAgent,
}) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
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

  const liveAgents = agents.filter((a) => a.activeTableId || a.liveGame?.tableId);
  const liveCount = liveAgents.length;

  const handleGhostSelect = useCallback((agent) => {
    setSelectedId(agent ? agent.id : null);
  }, []);

  return (
    <div className="dsk-root">
      <DesktopTopBar liveCount={liveCount} />
      <div className="dsk-body">
        <div className="dsk-stage">
          <CasinoFloor
            desktopMode
            onGhostSelect={handleGhostSelect}
            onChat={() => {}}
            onWatch={onWatchAgent}
            onProfile={() => {}}
            onDeploy={onDeployAgent}
            onCreateAgent={() => {}}
          />
        </div>
        <div className="dsk-right-rail">
          <PStandupCard agents={agents} loading={loading} />
          <div className="dsk-tile-stack">
            {liveAgents.map((agent) => {
              const isWatched = watchingAgent?.id === agent.id && isWatching;
              const highlighted = selectedId === agent.id || isWatched;
              const dimmed = selectedId !== null && selectedId !== agent.id && !isWatched;
              return (
                <GameTile
                  key={agent.id}
                  agentName={agent.name}
                  game={isWatched ? game : null}
                  lastDecision={isWatched ? lastDecision : null}
                  highlighted={highlighted}
                  dimmed={dimmed}
                  onWatch={() => onWatchAgent(agent)}
                  onFocusTable={isWatched ? onFocusTable : null}
                />
              );
            })}
            {!loading && liveAgents.length === 0 && (
              <div className="dsk-quiet-rail">
                <span>No agents at the felt right now.</span>
                <span className="dsk-quiet-rail__dim">Deploy one from the floor.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
