import { useEffect, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';

function formatAmount(amount) {
  return amount == null ? '--' : Number(amount).toLocaleString();
}

function formatAction(action = {}) {
  if (!action?.type) return 'unknown';
  if (action.amount == null) return action.type;
  return `${action.type} ${action.amount}`;
}

function HandRow({ hand }) {
  const [expanded, setExpanded] = useState(false);
  const decisions = hand.decisions || [];

  return (
    <div className="hist-hand">
      <button
        className="hist-hand__toggle"
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="hist-hand__num">Hand #{hand.handNumber ?? '--'}</span>
        <span className={`hist-hand__result ${hand.won ? 'hist-hand__result--won' : 'hist-hand__result--lost'}`}>
          {hand.won ? 'WON' : 'LOST'}
        </span>
        <span className="hist-hand__pot">Pot {formatAmount(hand.potSize)}</span>
        {hand.date && (
          <span className="hist-hand__date">
            {new Date(hand.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        <span className="hist-hand__chevron" aria-hidden>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="hist-hand__decisions">
          {decisions.length === 0 ? (
            <div className="hist-hand__no-decisions">No decisions recorded.</div>
          ) : (
            decisions.map((d, i) => (
              <div className="hist-hand__decision" key={`${d.street ?? 'street'}-${i}`}>
                <span className="hist-hand__street">[{String(d.street || 'street').toUpperCase()}]</span>
                <span className="hist-hand__action">{formatAction(d.action)}</span>
                {d.reasoning && <span className="hist-hand__reasoning">"{d.reasoning}"</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AgentSection({ agent }) {
  const [hands, setHands] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${encodeURIComponent(agent.id)}/hands?userId=${encodeURIComponent(getUserId())}`)
      .then((r) => r.json())
      .then((data) => setHands(data.recentHands || []))
      .catch(() => setLoadError(true));
  }, [agent.id]);

  return (
    <section className="hist-agent">
      <div className="hist-agent__header">
        <span className="hist-agent__name">{agent.name}</span>
        {hands !== null && (
          <span className="hist-agent__count">{hands.length} hand{hands.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      {hands === null && !loadError && <div className="hist-agent__loading">Loading…</div>}
      {loadError && <div className="hist-agent__error">Could not load hands.</div>}
      {hands !== null && hands.length === 0 && (
        <div className="hist-agent__empty">No hands played yet.</div>
      )}
      {hands !== null && hands.length > 0 && (
        <div className="hist-agent__hands">
          {hands.map((hand, i) => (
            <HandRow key={`${hand.handNumber ?? i}-${i}`} hand={hand} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HistoryTab() {
  const [agents, setAgents] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`/api/agents?userId=${encodeURIComponent(getUserId())}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => setLoadError(true));
  }, []);

  if (agents === null && !loadError) {
    return (
      <div className="dr-app">
        <div className="dr-screen hist-screen">
          <div className="hist-empty">
            <p className="hist-empty__sub">Loading history…</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dr-app">
        <div className="dr-screen hist-screen">
          <div className="hist-empty">
            <p className="hist-empty__sub">Could not load history. Try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="dr-app">
        <div className="dr-screen hist-screen">
          <div className="hist-empty">
            <ClockIcon />
            <p className="hist-empty__title">No History Yet</p>
            <p className="hist-empty__sub">Deploy an agent to start building your hand history.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dr-app">
      <div className="dr-screen hist-screen">
        <header className="hist-header">
          <h1>Hand History</h1>
          <small>{agents.length} agent{agents.length !== 1 ? 's' : ''}</small>
        </header>
        <div className="hist-list">
          {agents.map((agent) => (
            <AgentSection key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 40 40" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="20" cy="20" r="15" />
      <path d="M20 10v10l6 6" />
    </svg>
  );
}
