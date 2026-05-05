import { useState, useEffect } from 'react';
import { getTelegramDisplayName, isInTelegram, getUserId } from '../lib/telegram.js';
import { CreateAgent } from './CreateAgent.jsx';

export function Play({ onConnect, onWatch, onDone, initialStep = 'pick', agentName = null }) {
  const [step, setStep] = useState(initialStep);    // 'pick' | 'form' | 'create-agent' | 'picker'
  const [mode, setMode] = useState(null);           // 'ai' | 'human'
  const [displayName, setDisplayName] = useState(() => getTelegramDisplayName());
  const [tableId, setTableId] = useState(() => 'table-' + Math.random().toString(16).slice(2, 8));
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [deploying, setDeploying] = useState(null); // agentId being deployed
  const inTelegram = isInTelegram();

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  function pickMode(m) { setMode(m); setStep('form'); }

  function submit(e) {
    e.preventDefault();
    onConnect({
      tableId: (tableId || '').trim() || 'table-' + Math.random().toString(16).slice(2, 8),
      displayName: (displayName || '').trim() || 'Anon',
      buyIn: 1000,
      smallBlind: 10,
      bigBlind: 20,
      wantAI: mode === 'ai',
    });
  }

  async function deployAgent(agent) {
    setDeploying(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      });
      const data = await res.json();
      onWatch(data);
    } finally {
      setDeploying(null);
    }
  }

  if (step === 'create-agent') {
    return (
      <CreateAgent
        onBack={() => setStep('pick')}
        agentName={agentName}
        onDone={onDone}
      />
    );
  }

  if (step === 'picker') {
    return (
      <div className="play">
        <button type="button" className="play__back" onClick={() => setStep('pick')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <p className="play__mode-label">Choose an agent to deploy</p>
        <div className="play__picker-list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="play__picker-card"
              disabled={!!deploying || agent.status === 'playing'}
              onClick={() => deployAgent(agent)}
            >
              <span className="play__picker-name">{agent.name}</span>
              <span className="play__picker-meta">{agent.style} · {agent.risk} risk</span>
              {deploying === agent.id && <span className="play__picker-loading">…</span>}
            </button>
          ))}
        </div>
        <button type="button" className="play__human-btn" style={{ marginTop: '8px', width: '100%' }} onClick={() => setStep('create-agent')}>
          + Create new agent
        </button>
      </div>
    );
  }

  if (step === 'pick') {
    const hasAgents = agents.length > 0;
    return (
      <div className="play">
        {/* ── Deploy Agent hero card ── */}
        <div className="play__ai-card">
          {hasAgents ? (
            <>
              <div className="play__ai-eyebrow">Deploy Agent</div>
              <div className="play__ai-title">Send in your agent.</div>
              <p className="play__ai-sub">Pick an agent · watch it play · sit back</p>
              <button type="button" className="play__ai-btn" disabled={agentsLoading} onClick={() => setStep('picker')}>
                DEPLOY AGENT
                <ArrowRight />
              </button>
            </>
          ) : (
            <>
              <div className="play__ai-eyebrow">Build Agent</div>
              <div className="play__ai-title">Create your agent.</div>
              <p className="play__ai-sub">Design an AI that plays for you</p>
              <button type="button" className="play__ai-btn" disabled={agentsLoading} onClick={() => setStep('create-agent')}>
                {agentsLoading ? '…' : 'CREATE AGENT'}
                {!agentsLoading && <ArrowRight />}
              </button>
            </>
          )}
        </div>

        {/* ── Play Yourself card ── */}
        <div className="play__human-card">
          <div className="play__human-header">
            <div className="play__human-icon" aria-hidden>
              <PersonIcon />
            </div>
            <div>
              <div className="play__human-title">Play Yourself</div>
              <div className="play__human-sub">Jump in and play a hand.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="play__human-btn" style={{ flex: 1 }} onClick={() => pickMode('ai')}>
              vs AI
              <ArrowRight />
            </button>
            <button type="button" className="play__human-btn" style={{ flex: 1 }} onClick={() => pickMode('human')}>
              vs Human
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hintText = mode === 'ai'
    ? 'Your AI opponent joins automatically.'
    : inTelegram
      ? 'Share the bot link with a friend to fill the second seat.'
      : 'Open this page in two browser tabs to play heads-up.';

  return (
    <div className="play__form-wrap">
      <button type="button" className="play__back" onClick={() => setStep('pick')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back
      </button>

      <p className="play__mode-label">
        {mode === 'ai' ? 'Playing vs AI' : 'Playing vs Human'}
      </p>

      <form className="play__form-card" onSubmit={submit}>
        <div className="play__field">
          <span className="label">Your name</span>
          <input
            autoFocus={!inTelegram}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Name"
          />
        </div>
        <div className="play__field">
          <span className="label">Table</span>
          <input
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          />
        </div>
        <button className="play__submit" type="submit">Take Seat</button>
      </form>

      <p className="play__hint">{hintText}</p>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
