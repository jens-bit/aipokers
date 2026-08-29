import { Hood, NavIcon } from './primitives.jsx';

// Command Center is the only section with a desktop implementation. The rest
// render disabled rather than as dead buttons that look clickable.
const NAV_ITEMS = [
  { key: 'home', icon: 'home', label: 'Command Center', ready: true },
  { key: 'agents', icon: 'agent', label: 'Agents' },
  { key: 'play', icon: 'spade', label: 'Tables' },
  { key: 'history', icon: 'history', label: 'Replays' },
  { key: 'profile', icon: 'profile', label: 'Account' },
];

function isPlaying(agent) {
  return !!agent?.activeTableId;
}

function statusLine(agent) {
  if (isPlaying(agent)) return 'Playing now';
  if (agent?.status && agent.status !== 'idle') return String(agent.status);
  return 'Idle · ready to deploy';
}

// stats.winRate is stored as a whole percentage (0-100).
function winRateOf(agent) {
  const rate = agent?.stats?.winRate;
  if (rate == null || !agent?.stats?.handsPlayed) return null;
  return `${Number(rate).toFixed(0)}%`;
}

export function DesktopRail({
  agents, loading, activeTab, activeAgentId,
  onNavigate, onSelectAgent, onDeployAgent, onDraftAgent,
}) {
  const liveCount = agents.filter(isPlaying).length;

  return (
    <div className="dsk-rail">
      <div className="dsk-rail__nav-block">
        <span className="dsk-label dsk-label--sm">NAVIGATE</span>
        <div className="dsk-rail__nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.ready}
              aria-disabled={!item.ready}
              className={`dsk-nav${activeTab === item.key && item.ready ? ' is-active' : ''}${item.ready ? '' : ' is-soon'}`}
              onClick={item.ready ? () => onNavigate(item.key) : undefined}
            >
              <NavIcon name={item.icon} />
              <span className="dsk-nav__label">{item.label}</span>
              {item.ready
                ? item.key === 'agents' && agents.length > 0 && (
                    <span className="dsk-nav__badge">{agents.length}</span>
                  )
                : <span className="dsk-nav__soon">SOON</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="dsk-rail__section">
        <span className="dsk-label dsk-label--sm">CONVERSATIONS</span>
        {liveCount > 0 && (
          <div className="dsk-rail__live">
            <span className="dsk-dot" aria-hidden />
            <span>{liveCount} LIVE</span>
          </div>
        )}
      </div>

      <div className="dsk-rail__list">
        <div className="dsk-rail__divider">
          <span>YOUR AGENTS</span>
          <i />
        </div>

        {loading && <p className="dsk-rail__empty">Loading roster…</p>}
        {!loading && agents.length === 0 && (
          <p className="dsk-rail__empty">No agents yet. Draft one to get started.</p>
        )}

        {agents.map((agent) => {
          const playing = isPlaying(agent);
          const winRate = winRateOf(agent);
          return (
            <div
              key={agent.id}
              className={`dsk-thread${activeAgentId === agent.id ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="dsk-thread__main"
                onClick={() => onSelectAgent(agent)}
              >
                <div className="dsk-thread__avatar">
                  <Hood size={34} dim={!playing} />
                  {playing && <span className="dsk-thread__live-dot" aria-hidden />}
                </div>
                <div className="dsk-thread__body">
                  <div className="dsk-thread__top">
                    <span className="dsk-thread__name">{agent.name}</span>
                    <span className="dsk-thread__time">{playing ? 'live' : 'idle'}</span>
                  </div>
                  <div className="dsk-thread__bottom">
                    <span className="dsk-thread__preview">{statusLine(agent)}</span>
                    {winRate && <span className="dsk-thread__stat">{winRate}</span>}
                  </div>
                </div>
              </button>
              {!playing && (
                <button
                  type="button"
                  className="dsk-thread__deploy"
                  onClick={() => onDeployAgent(agent)}
                  title={`Deploy ${agent.name}`}
                >
                  DEPLOY
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="dsk-rail__footer">
        <button type="button" className="dsk-rail__draft" onClick={onDraftAgent}>
          <NavIcon name="plus" size={12} />
          DRAFT AGENT
        </button>
      </div>
    </div>
  );
}
