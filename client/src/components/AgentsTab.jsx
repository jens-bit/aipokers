import { useState, useEffect } from 'react';

function getUserId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || 'anon';
}

export function AgentsTab({ onDeploy, onCreateAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    fetch(`/api/agents?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deploy(agent) {
    const res = await fetch(`/api/agents/${agent.id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    });
    if (!res.ok) return;
    const data = await res.json();
    onDeploy(data);
  }

  async function remove(agentId) {
    const userId = getUserId();
    await fetch(`/api/agents/${agentId}?userId=${userId}`, { method: 'DELETE' });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  }

  if (loading) {
    return (
      <div className="agents-tab agents-tab--loading">
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading...</span>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="agents-tab agents-tab--empty">
        <div className="agents-tab__header">
          <div>
            <div className="agents-tab__title">AGENTS</div>
            <div className="agents-tab__subtitle">Your roster</div>
          </div>
          <button className="agents-tab__add-btn" onClick={onCreateAgent} aria-label="Create agent">+</button>
        </div>
        <div className="agents-tab__empty-state">
          <div className="agents-tab__spade">♠</div>
          <div className="agents-tab__empty-title">No agents yet</div>
          <div className="agents-tab__empty-sub">Build your first agent to get started</div>
          <button className="agents-tab__create-btn" onClick={onCreateAgent}>CREATE AGENT</button>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-tab">
      <div className="agents-tab__header">
        <div>
          <div className="agents-tab__title">AGENTS</div>
          <div className="agents-tab__subtitle">Your roster</div>
        </div>
        <button className="agents-tab__add-btn" onClick={onCreateAgent} aria-label="Create agent">+</button>
      </div>
      <div className="agents-tab__list">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onDeploy={() => deploy(agent)}
            onDelete={() => remove(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, onDeploy, onDelete }) {
  const isLive = agent.status === 'playing';
  const strategy = agent.strategy || '';
  const preview = strategy.length > 80 ? strategy.slice(0, 80) + '…' : strategy;

  return (
    <div className="agent-card">
      <div className="agent-card__top">
        <span className="agent-card__name">{agent.name}</span>
        <span className={`agent-card__status${isLive ? ' agent-card__status--live' : ' agent-card__status--idle'}`}>
          {isLive ? 'LIVE' : 'IDLE'}
        </span>
      </div>
      {(agent.style || agent.risk) && (
        <div className="agent-card__tags">
          {agent.style && <span className="agent-card__tag">{agent.style}</span>}
          {agent.risk && <span className="agent-card__tag">{agent.risk} Risk</span>}
        </div>
      )}
      {preview && <div className="agent-card__strategy">{preview}</div>}
      <div className="agent-card__actions">
        <button className="agent-card__deploy-btn" onClick={onDeploy} disabled={isLive}>
          DEPLOY →
        </button>
        <button className="agent-card__delete-btn" onClick={onDelete}>
          DELETE
        </button>
      </div>
    </div>
  );
}
