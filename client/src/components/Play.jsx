import { useEffect, useState } from 'react';
import { getTelegramDisplayName, isInTelegram, getUserId } from '../lib/telegram.js';
import { CreateAgent } from './CreateAgent.jsx';

// PLAY tab ÔÇö always starts at the 2├ù2 mode-picker grid.
// The command-center home (ExistingHome / EmptyHome) lives in HomeTab.jsx.
export function Play({ onConnect, onWatch, onDone, initialStep = 'play-mode', agentName = null, existingAgent = null }) {
  const [step, setStep] = useState(initialStep);    // 'play-mode' | 'form' | 'create-agent'
  const [mode, setMode] = useState(null);           // 'ai' | 'human'
  const [displayName, setDisplayName] = useState(() => getTelegramDisplayName());
  const [tableId, setTableId] = useState(() => 'table-' + Math.random().toString(16).slice(2, 8));
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);
  const [watching, setWatching] = useState(false);
  const inTelegram = isInTelegram();

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function connectVsAI() {
    onConnect({
      tableId: 'vsai-' + Date.now().toString(36),
      displayName: getTelegramDisplayName() || 'You',
      buyIn: 1000,
      smallBlind: 10,
      bigBlind: 20,
      wantAI: true,
      agentDisplayName: 'House',
    });
  }

  function pickHumanMode() {
    setTableId('table-' + Math.random().toString(16).slice(2, 8));
    setMode('human');
    setStep('form');
  }

  function submitHumanForm(e) {
    e.preventDefault();
    onConnect({
      tableId: (tableId || '').trim() || 'table-' + Math.random().toString(16).slice(2, 8),
      displayName: (displayName || '').trim() || 'Anon',
      buyIn: 1000,
      smallBlind: 10,
      bigBlind: 20,
      wantAI: false,
    });
  }

  async function deployAgent(agent) {
    if (deployingId) return;
    setDeployingId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      });
      if (!res.ok) return;
      onWatch(await res.json());
    } finally {
      setDeployingId(null);
    }
  }

  async function watchAgent(agent) {
    if (watching || !agent?.activeTableId) return;
    setWatching(true);
    let memoryContext = '';
    try {
      const res = await fetch(`/api/agents/${agent.id}/memory?userId=${getUserId()}`);
      if (res.ok) memoryContext = (await res.json()).memoryContext || '';
    } catch { /* fall through with empty context */ }
    onWatch({
      tableId: agent.activeTableId,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      memoryContext,
    });
    setWatching(false);
  }

  if (step === 'create-agent') {
    return (
      <CreateAgent
        onBack={() => setStep('play-mode')}
        agentName={agentName || existingAgent?.name}
        existingAgent={existingAgent}
        onDone={onDone}
        onDeploy={deployAgent}
      />
    );
  }

  if (step === 'form') {
    const hint = inTelegram
      ? 'Share the bot link with a friend to fill the second seat.'
      : 'Open this page in two browser tabs to play heads-up.';

    return (
      <div className="dr-app">
        <div className="dr-screen dr-screen--form">
          <header className="dr-chat-header">
            <button className="dr-plain-button" type="button" onClick={() => setStep('play-mode')} aria-label="Back">
              <ArrowLeft />
            </button>
            <div>
              <p className="dr-label dr-label--accent">Vs human</p>
              <h1>Take a seat</h1>
              <small>{hint}</small>
            </div>
          </header>

          <form className="dr-blueprint-card" onSubmit={submitHumanForm}>
            <div className="dr-section-head">
              <p className="dr-label">Session</p>
            </div>
            <label className="dr-form-field">
              <span>Your name</span>
              <input
                autoFocus={!inTelegram}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Name"
              />
            </label>
            <label className="dr-form-field">
              <span>Table id</span>
              <input value={tableId} onChange={(e) => setTableId(e.target.value)} />
            </label>
            <div className="dr-card-actions">
              <button className="dr-primary-btn" type="submit">Take seat</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // step === 'play-mode' ÔÇö 2├ù2 mode grid.
  const activeAgent = agents.find((a) => a.activeTableId);
  const deployTarget = agents.find((a) => !a.activeTableId) || agents[0] || null;

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--play">
        <section className="dr-play-hero">
          <p className="dr-label dr-label--accent">Play</p>
          <h1>Pick a mode</h1>
          <p>Deploy an agent, watch a live table, or sit down yourself.</p>
        </section>

        <div className={`dr-play-grid${activeAgent ? ' dr-play-grid--with-watch' : ''}`}>
          <button
            className="dr-play-card is-accent"
            type="button"
            onClick={() => {
              if (!deployTarget) setStep('create-agent');
              else deployAgent(deployTarget);
            }}
            disabled={loading || deployingId != null}
          >
            <span><RocketIcon /></span>
            <b>{deployingId ? 'DeployingÔÇª' : deployTarget ? 'Deploy agent' : 'Create agent'}</b>
            <small>
              {deployTarget
                ? `Send ${deployTarget.name} to a heads-up table.`
                : 'Build your first agent in chat.'}
            </small>
          </button>

          {activeAgent && (
            <button
              className="dr-play-card"
              type="button"
              onClick={() => watchAgent(activeAgent)}
              disabled={watching}
            >
              <span><EyeIcon /></span>
              <b>{watching ? 'ConnectingÔÇª' : 'Watch active table'}</b>
              <small>{activeAgent.name} is playing now.</small>
            </button>
          )}

          <button className="dr-play-card" type="button" onClick={pickHumanMode}>
            <span><UsersIcon /></span>
            <b>Play vs human</b>
            <small>Heads-up against a friend.</small>
          </button>

          <button className="dr-play-card" type="button" onClick={connectVsAI}>
            <span><BotIcon /></span>
            <b>Play vs AI</b>
            <small>Sit down with a built-in opponent.</small>
          </button>
        </div>

        <div className="dr-practice-row">
          <button type="button" onClick={() => setStep('create-agent')}>+ Create new agent</button>
        </div>
      </div>
    </div>
  );
}

// ÔöÇÔöÇ Icons ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

function ArrowLeft() {
  return (
    <svg className="dr-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 6c4 0 6 2 6 6 0 .5 0 1-.1 1.4L14 19l-2-2-3 3-2-2 3-3-2-2L13.6 6.1A8 8 0 0 1 14 6z" />
      <path d="M9 15l-3 3" />
      <circle cx="15" cy="9" r="1.4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M9 17h6" />
    </svg>
  );
}
