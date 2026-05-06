import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

// Status chip text mapped from the agent's lifecycle. The backend exposes
// agent.status === 'playing' | 'idle' (see agentProfiles.js) plus implicit
// states from agent.stats. We mirror the design's chip vocabulary on top.
function chipFor(agent) {
  if (agent.status === 'playing' || agent.activeTableId) return { label: 'Seated', tone: 'live' };
  const handsPlayed = agent?.stats?.handsPlayed ?? 0;
  if (handsPlayed > 0 && handsPlayed < 25) return { label: 'Learning', tone: 'gold' };
  if (!agent.strategy || agent.strategy.trim().length < 20) return { label: 'Draft', tone: 'gold' };
  return { label: 'Ready', tone: 'accent' };
}

export function AgentsTab({ onDeploy, onVsYou, onCreateAgent, onChatAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);
  const [expandedHands, setExpandedHands] = useState({});
  const [handsCache, setHandsCache] = useState({});
  const [handsLoading, setHandsLoading] = useState({});
  const [handsError, setHandsError] = useState({});

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deploy(agent) {
    if (deployingId) return;
    setDeployingId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      });
      if (!res.ok) return;
      onDeploy(await res.json());
    } finally {
      setDeployingId(null);
    }
  }

  async function vsYou(agent) {
    if (deployingId) return;
    setDeployingId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      });
      if (!res.ok) return;
      onVsYou(await res.json());
    } finally {
      setDeployingId(null);
    }
  }

  async function remove(agentId) {
    await fetch(`/api/agents/${agentId}?userId=${getUserId()}`, { method: 'DELETE' });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    setExpandedHands((prev) => clearKey(prev, agentId));
    setHandsCache((prev) => clearKey(prev, agentId));
    setHandsLoading((prev) => clearKey(prev, agentId));
    setHandsError((prev) => clearKey(prev, agentId));
  }

  async function toggleHands(agentId) {
    const willOpen = !expandedHands[agentId];
    setExpandedHands((prev) => ({ ...prev, [agentId]: willOpen }));
    if (!willOpen || handsCache[agentId] || handsLoading[agentId]) return;

    setHandsLoading((prev) => ({ ...prev, [agentId]: true }));
    setHandsError((prev) => clearKey(prev, agentId));
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/hands?userId=${encodeURIComponent(getUserId())}`);
      if (!res.ok) throw new Error('hands request failed');
      const data = await res.json();
      setHandsCache((prev) => ({ ...prev, [agentId]: data }));
    } catch {
      setHandsError((prev) => ({ ...prev, [agentId]: 'Could not load recent hands' }));
    } finally {
      setHandsLoading((prev) => ({ ...prev, [agentId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="dr-app">
        <div className="dr-screen">
          <section className="dr-hero dr-hero--loading">
            <p className="dr-label dr-label--accent">Loading roster</p>
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
            <p>Create your first agent to unlock tuning, funding, and deployment.</p>
            <button className="dr-primary-btn" type="button" onClick={onCreateAgent}>Start in chat</button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--stable">
        <section className="dr-stable-head">
          <p className="dr-label dr-label--accent">Stable</p>
          <h1>Your agents</h1>
          <small>{agents.length} agent{agents.length === 1 ? '' : 's'} ready to tune, chat, or deploy.</small>
        </section>

        <div className="dr-stable-list">
          {agents.map((agent) => (
            <StableCard
              key={agent.id}
              agent={agent}
              busy={deployingId === agent.id}
              chip={chipFor(agent)}
              onDeploy={() => deploy(agent)}
              onVsYou={() => vsYou(agent)}
              onChat={() => onChatAgent(agent)}
              onDelete={() => remove(agent.id)}
              handsExpanded={!!expandedHands[agent.id]}
              handsData={handsCache[agent.id]}
              handsLoading={!!handsLoading[agent.id]}
              handsError={handsError[agent.id]}
              onToggleHands={() => toggleHands(agent.id)}
            />
          ))}
        </div>

        <button className="dr-secondary-wide" type="button" onClick={onCreateAgent}>
          <PlusIcon /> Create another
        </button>
      </div>
    </div>
  );
}

function StableCard({
  agent, busy, chip, onDeploy, onVsYou, onChat, onDelete,
  handsExpanded, handsData, handsLoading, handsError, onToggleHands,
}) {
  const isLive = agent.status === 'playing';
  const stats = agent.stats || {};
  const hasStats = (stats.handsPlayed ?? 0) > 0;
  const winRate = Number.isFinite(Number(stats.winRate)) ? Math.round(Number(stats.winRate)) : null;

  return (
    <section className="dr-stable-card">
      <div className="dr-stable-card__main">
        <AgentAvatar size="md" />
        <span>
          <p className={`dr-label dr-label--${chip.tone}`}>{chip.label}</p>
          <h2>{agent.name}</h2>
          <small>{agent.style} / {agent.risk} risk{hasStats ? ` / ${stats.handsPlayed} hand${stats.handsPlayed === 1 ? '' : 's'}` : ''}</small>
        </span>
      </div>

      {agent.strategy && <p>{agent.strategy}</p>}

      {hasStats && (
        <div className="dr-stable-card__stats">
          <span><small>Win rate</small><b>{winRate == null ? '--' : `${winRate}%`}</b></span>
          <span><small>Hands</small><b>{stats.handsPlayed}</b></span>
          <span><small>Aggression</small><b>{stats.totalDecisions ? Math.round((stats.aggressiveDecisions / stats.totalDecisions) * 100) : 0}%</b></span>
        </div>
      )}

      <div className="dr-stable-card__actions">
        <button type="button" onClick={onDeploy} disabled={isLive || busy} title="Watch your agent vs another agent">
          {isLive ? 'Seated' : busy ? 'Deploying…' : 'Deploy'}
        </button>
        <button type="button" onClick={onVsYou} disabled={isLive || busy} title="Play against your own agent">
          Vs you
        </button>
        <button type="button" onClick={onChat}>Chat</button>
        <button className="is-danger" type="button" onClick={onDelete}>Delete</button>
      </div>

      <button className="dr-stable-card__hands-toggle" type="button" onClick={onToggleHands}>
        <span>Recent hands</span>
        <span>{handsExpanded ? 'Hide' : 'Show'}</span>
      </button>

      {handsExpanded && (
        <div className="dr-stable-card__hands">
          {handsLoading && <p className="dr-muted-copy">Loading recent hands…</p>}
          {handsError && <p className="dr-muted-copy" style={{ color: 'var(--dr-error)' }}>{handsError}</p>}
          {!handsLoading && !handsError && (handsData?.recentHands || []).length === 0 && (
            <p className="dr-muted-copy">No hands recorded yet.</p>
          )}
          {!handsLoading && !handsError && (handsData?.recentHands || []).slice(0, 5).map((hand) => (
            <HandRow hand={hand} key={`${hand.handNumber}-${hand.timestamp || ''}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function HandRow({ hand }) {
  const wonClass = hand.won ? 'dr-hand-row__won' : 'dr-hand-row__lost';
  return (
    <div className="dr-hand-row dr-hand-row--card">
      <b>Hand #{hand.handNumber ?? '--'}</b>
      <small className={wonClass}>{hand.won ? 'WON' : 'LOST'} · pot {hand.potSize ?? 0}</small>
      {(hand.decisions || []).map((decision, i) => (
        <span key={`${decision.street}-${i}`} className="dr-hand-row__decision">
          [{String(decision.street || 'street').toUpperCase()}] {formatAction(decision.action)}
          {decision.reasoning && <em> — "{decision.reasoning}"</em>}
        </span>
      ))}
    </div>
  );
}

function formatAction(action = {}) {
  if (!action?.type) return 'unknown';
  if (action.amount == null) return action.type;
  return `${action.type} ${action.amount}`;
}

function clearKey(source, key) {
  const next = { ...source };
  delete next[key];
  return next;
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
