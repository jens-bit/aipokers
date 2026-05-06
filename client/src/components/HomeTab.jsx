import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

function statusLabel(agent) {
  if (agent.status === 'playing' || agent.activeTableId) return 'Playing now';
  const handsPlayed = agent?.stats?.handsPlayed ?? 0;
  if (handsPlayed > 0 && handsPlayed < 25) return 'Learning';
  if (!agent.strategy || agent.strategy.trim().length < 20) return 'Draft';
  return 'Ready';
}

function fmtWinRate(wr) {
  const n = Number(wr);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '--';
}

function strategyExcerpt(strategy) {
  if (!strategy) return null;
  return strategy.length > 60 ? strategy.slice(0, 60) + '…' : strategy;
}

export function HomeTab({ onCreateAgent, onDeploy, onOpenChat }) {
  const userId = getUserId();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [primaryId, setPrimaryId] = useState(null);
  const [recentHands, setRecentHands] = useState([]);
  const [deployingId, setDeployingId] = useState(null);

  useEffect(() => {
    fetch(`/api/agents?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  // Auto-select primary: agent with most hands played, falling back to first.
  const autoPrimary = agents.reduce(
    (best, a) => (a.stats?.handsPlayed ?? 0) > (best?.stats?.handsPlayed ?? 0) ? a : best,
    agents[0] ?? null,
  );
  const primary = (primaryId ? agents.find((a) => a.id === primaryId) : null) ?? autoPrimary;
  const others = agents.filter((a) => a.id !== primary?.id);

  useEffect(() => {
    if (!primary?.id) { setRecentHands([]); return; }
    fetch(`/api/agents/${encodeURIComponent(primary.id)}/hands?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : { recentHands: [] })
      .then((data) => setRecentHands((data.recentHands || []).slice(0, 3)))
      .catch(() => setRecentHands([]));
  }, [primary?.id, userId]);

  async function handleDeploy() {
    if (!primary || deployingId) return;
    setDeployingId(primary.id);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(primary.id)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) return;
      onDeploy(await res.json());
    } finally {
      setDeployingId(null);
    }
  }

  if (loading) {
    return (
      <div className="dr-app">
        <div className="dr-screen">
          <section className="dr-hero dr-hero--loading">
            <p className="dr-label dr-label--accent">Loading</p>
            <h1>Looking for your agents</h1>
            <div className="dr-skeleton-grid"><i /><i /><i /></div>
          </section>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="dr-app">
        <div className="dr-screen">
          <section className="dr-panel dr-empty-panel dr-full-empty">
            <AgentAvatar size="lg" />
            <h2>No agents yet</h2>
            <p>Create your first agent and send it to a live table.</p>
            <button className="dr-primary-btn" type="button" onClick={onCreateAgent}>
              Build an agent
            </button>
          </section>
        </div>
      </div>
    );
  }

  const isPlaying = !!(primary?.status === 'playing' || primary?.activeTableId);
  const handsPlayed = primary?.stats?.handsPlayed ?? 0;
  const winRate = fmtWinRate(primary?.stats?.winRate);
  const excerpt = strategyExcerpt(primary?.strategy);

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--home">

        {/* ── Primary agent card ── */}
        <section className="dr-stable-card">
          <div className="dr-stable-card__main">
            <AgentAvatar size="md" />
            <span>
              <p className="dr-label dr-label--accent">{statusLabel(primary)}</p>
              <h2>{primary.name}</h2>
              <small>{primary.style} / {primary.risk} risk</small>
            </span>
          </div>

          {excerpt && <p>{excerpt}</p>}

          <section className="dr-stats" style={{ margin: '8px 0' }}>
            <span>
              <small>Win rate</small>
              <b>{winRate}</b>
            </span>
            <span>
              <small>Hands</small>
              <b>{String(handsPlayed)}</b>
            </span>
            <span>
              <small>Style</small>
              <b>{primary.style ?? '--'}</b>
            </span>
            <span>
              <small>Risk</small>
              <b>{primary.risk ?? '--'}</b>
            </span>
          </section>

          <div className="dr-home-actions" style={{ marginTop: 8 }}>
            <button
              className="dr-primary-btn"
              type="button"
              onClick={handleDeploy}
              disabled={isPlaying || deployingId === primary.id}
            >
              {deployingId === primary.id ? 'Deploying…' : isPlaying ? 'Playing' : 'Deploy'}
            </button>
            <button
              className="dr-secondary-btn"
              type="button"
              onClick={() => onOpenChat(primary)}
            >
              Chat
            </button>
          </div>
        </section>

        {/* ── Secondary agent pills ── */}
        {others.length > 0 && (
          <section className="dr-agent-carousel" aria-label="Other agents">
            <div className="dr-section-head">
              <p className="dr-label">Other agents</p>
              <span>{others.length}</span>
            </div>
            <div className="dr-agent-carousel__track">
              {others.map((agent) => {
                const active = agent.status === 'playing' || agent.activeTableId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="dr-agent-mini-card"
                    onClick={() => setPrimaryId(agent.id)}
                  >
                    <span>
                      <AgentAvatar size="xs" />
                      <i className={active ? 'is-live' : ''} />
                    </span>
                    <b>{agent.name}</b>
                    <small>{statusLabel(agent)}</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Recent activity ── */}
        <section className="dr-stable-card">
          <div className="dr-section-head">
            <p className="dr-label">Recent activity</p>
          </div>
          <div className="dr-readiness-list">
            {recentHands.length === 0 ? (
              <span>No hands played yet</span>
            ) : recentHands.map((hand) => (
              <span key={hand.handNumber}>
                <small style={{ minWidth: 64, color: 'var(--dr-secondary)' }}>
                  Hand #{hand.handNumber}
                </small>
                <b style={{
                  fontSize: 11,
                  color: hand.won ? 'var(--dr-accent)' : '#ff6b6d',
                  letterSpacing: '0.06em',
                }}>
                  {hand.won ? 'WON' : 'LOST'}
                </b>
                <small style={{ marginLeft: 'auto', color: 'var(--dr-secondary)' }}>
                  Pot {hand.potSize ?? '--'}
                </small>
              </span>
            ))}
          </div>
        </section>

        {/* ── Create link ── */}
        <div className="dr-practice-row">
          <button type="button" onClick={onCreateAgent}>+ Create new agent</button>
        </div>

      </div>
    </div>
  );
}

function AgentAvatar({ size = 'md', accent = '#00d4aa' }) {
  return (
    <span className={`dr-agent-avatar dr-agent-avatar--${size}`} style={{ '--dr-avatar-accent': accent }}>
      <svg viewBox="0 0 40 40" aria-hidden>
        <path d="M20 4c-8 0-13 6-13 14v14c0 4 3 6 7 6h12c4 0 7-2 7-6V18c0-8-5-14-13-14z" fill="currentColor" opacity="0.38" />
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#080b0d" />
        <circle cx="17" cy="20" r="1" fill={accent} />
        <circle cx="23" cy="20" r="1" fill={accent} />
      </svg>
      <i />
    </span>
  );
}
