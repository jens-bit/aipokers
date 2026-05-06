import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

// Status text for the chip on each stable card. Matches design-ref's
// PLAYING NOW / READY / DRAFT / LEARNING vocabulary.
function statusLabel(agent) {
  if (agent.status === 'playing' || agent.activeTableId) return 'Playing now';
  const handsPlayed = agent?.stats?.handsPlayed ?? 0;
  if (handsPlayed > 0 && handsPlayed < 25) return 'Learning';
  if (!agent.strategy || agent.strategy.trim().length < 20) return 'Draft';
  return 'Ready';
}

export function AgentsTab({ onDeploy, onCreateAgent, onOpenChat /* onVsYou intentionally unused — design-ref doesn't expose it from the roster */ }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);

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

  async function remove(agentId) {
    await fetch(`/api/agents/${agentId}?userId=${getUserId()}`, { method: 'DELETE' });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
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
          {agents.map((agent) => {
            const isPlaying = agent.status === 'playing' || agent.activeTableId;
            const busy = deployingId === agent.id;
            const handsPlayed = agent?.stats?.handsPlayed ?? 0;
            const meta = `${agent.style} / ${agent.risk} risk / ${handsPlayed} hand${handsPlayed === 1 ? '' : 's'}`;
            return (
              <section className="dr-stable-card" key={agent.id}>
                <div className="dr-stable-card__main">
                  <AgentAvatar size="md" />
                  <span>
                    <p className="dr-label dr-label--accent">{statusLabel(agent)}</p>
                    <h2>{agent.name}</h2>
                    <small>{meta}</small>
                  </span>
                </div>
                {agent.strategy && <p>{agent.strategy}</p>}
                <div className="dr-stable-card__actions">
                  <button
                    type="button"
                    onClick={() => deploy(agent)}
                    disabled={busy}
                  >
                    {isPlaying ? 'View table' : busy ? 'Deploying…' : 'Deploy'}
                  </button>
                  <button type="button" onClick={() => onOpenChat(agent)}>Chat</button>
                  <button className="is-danger" type="button" onClick={() => remove(agent.id)}>Delete</button>
                </div>
              </section>
            );
          })}
        </div>

        <button className="dr-secondary-wide" type="button" onClick={onCreateAgent}>
          <PlusIcon /> Create another
        </button>
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
