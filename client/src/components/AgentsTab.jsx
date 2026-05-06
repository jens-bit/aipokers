import { useState, useEffect } from 'react';
import { getUserId } from '../lib/telegram.js';

export function AgentsTab({ onDeploy, onVsYou, onCreateAgent, onChatAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // VS AI: enters matchmaking queue — waits for another user's agent.
  async function deploy(agent) {
    const res = await fetch(`/api/agents/${agent.id}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    });
    if (!res.ok) return;
    onDeploy(await res.json());
  }

  // VS YOU: human player vs their own agent.
  async function vsYou(agent) {
    const res = await fetch(`/api/agents/${agent.id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    });
    if (!res.ok) return;
    onVsYou(await res.json());
  }

  async function remove(agentId) {
    await fetch(`/api/agents/${agentId}?userId=${getUserId()}`, { method: 'DELETE' });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    setExpandedHands((prev) => clearAgentKey(prev, agentId));
    setHandsCache((prev) => clearAgentKey(prev, agentId));
    setHandsLoading((prev) => clearAgentKey(prev, agentId));
    setHandsError((prev) => clearAgentKey(prev, agentId));
  }

  async function toggleHands(agentId) {
    const willOpen = !expandedHands[agentId];
    setExpandedHands((prev) => ({ ...prev, [agentId]: willOpen }));

    if (!willOpen || handsCache[agentId] || handsLoading[agentId]) return;

    setHandsLoading((prev) => ({ ...prev, [agentId]: true }));
    setHandsError((prev) => clearAgentKey(prev, agentId));

    try {
      const res = await fetch(agentHandsUrl(agentId));
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
    </div>
  );
}

function AgentCard({ agent, onDeploy, onVsYou, onChat, onDelete, handsExpanded, handsData, handsLoading, handsError, onToggleHands }) {
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
      <AgentStats stats={agent.stats} />
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
      <RecentHandsSection
        expanded={handsExpanded}
        data={handsData}
        loading={handsLoading}
        error={handsError}
        onToggle={onToggleHands}
      />
    </div>
  );
}

function AgentStats({ stats }) {
  if (!stats || Number(stats.handsPlayed) <= 0) return null;

  const totalDecisions = Number(stats.totalDecisions) || 0;
  const aggressiveDecisions = Number(stats.aggressiveDecisions) || 0;
  const aggressiveRate = totalDecisions ? Math.round((aggressiveDecisions / totalDecisions) * 100) : 0;
  const winRate = Number.isFinite(Number(stats.winRate)) ? Math.round(Number(stats.winRate)) : 0;

  return (
    <div className="agent-card__strategy agent-card__stats-row">
      <span>Win rate: {winRate}%</span>
      <span>Hands: {stats.handsPlayed}</span>
      <span>Agg: {aggressiveRate}%</span>
    </div>
  );
}

function RecentHandsSection({ expanded, data, loading, error, onToggle }) {
  const recentHands = (data?.recentHands || []).slice(0, 5);

  return (
    <div className="agent-card__hands">
      <button className="agent-card__hands-toggle" type="button" onClick={onToggle}>
        <span>Recent Hands</span>
        <span>{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="agent-card__recent-hands">
          {loading && <div className="history__entry">Loading recent hands...</div>}
          {error && <div className="history__entry agent-card__hands-error">{error}</div>}
          {!loading && !error && recentHands.length === 0 && (
            <div className="history__entry">No hands recorded yet.</div>
          )}
          {!loading && !error && recentHands.map((hand) => (
            <HandEntry hand={hand} key={`${hand.handNumber}-${hand.timestamp || ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function HandEntry({ hand }) {
  return (
    <div className="agent-card__hand">
      <div className="history__entry result agent-card__hand-result">
        <span>Hand #{hand.handNumber ?? '--'} - </span>
        <span className={hand.won ? 'agent-card__hand-won' : 'agent-card__hand-lost'}>
          {hand.won ? 'WON' : 'LOST'}
        </span>
        <span> - Pot: {formatAmount(hand.potSize)}</span>
      </div>
      {(hand.decisions || []).map((decision, index) => (
        <div className="history__entry agent-card__decision" key={`${decision.street || 'street'}-${index}`}>
          <span>[{String(decision.street || 'street').toUpperCase()}]</span>
          <span>{formatDecisionAction(decision.action)}</span>
          {decision.reasoning && <span>- "{decision.reasoning}"</span>}
        </div>
      ))}
    </div>
  );
}

function formatDecisionAction(action = {}) {
  if (!action?.type) return 'unknown';
  if (action.amount == null) return action.type;
  return `${action.type} ${action.amount}`;
}

function formatAmount(amount) {
  return amount == null ? '--' : amount;
}

function agentHandsUrl(agentId) {
  return `/api/agents/${encodeURIComponent(agentId)}/hands?userId=${encodeURIComponent(getUserId())}`;
}

function clearAgentKey(source, agentId) {
  const next = { ...source };
  delete next[agentId];
  return next;
}
