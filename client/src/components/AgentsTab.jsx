import { useState, useEffect } from 'react';
import { getUserId } from '../lib/telegram.js';

export function AgentsTab({ onDeploy, onVsYou, onCreateAgent, onChatAgent, onChallenge }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
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
    onDeploy(await res.json());
  }

  async function vsYou(agent) {
    const res = await fetch(`/api/agents/${agent.id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    });
    if (!res.ok) return;
    onVsYou(await res.json());
  }

  async function challenge(agent) {
    const res = await fetch(`/api/agents/${agent.id}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    });
    if (!res.ok) return;
    onChallenge(await res.json());
  }

  async function remove(agentId) {
    await fetch(`/api/agents/${agentId}?userId=${getUserId()}`, { method: 'DELETE' });
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
            onVsYou={() => vsYou(agent)}
            onChallenge={() => challenge(agent)}
            onChat={() => onChatAgent(agent)}
            onDelete={() => remove(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, onDeploy, onVsYou, onChallenge, onChat, onDelete }) {
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
        <div className="agent-card__primary-row">
          <button className="agent-card__deploy-btn" onClick={onDeploy} disabled={isLive} title="Watch your agent vs server AI">
            VS AI →
          </button>
          <button className="agent-card__challenge-btn" onClick={onVsYou} disabled={isLive} title="Play against your own agent">
            VS YOU
          </button>
        </div>
        <div className="agent-card__secondary-row">
          <button className="agent-card__chat-btn" onClick={onChat}>
            CHAT
          </button>
          <button className="agent-card__delete-btn" onClick={onDelete}>
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}
