import { useState } from 'react';
import { getTelegramDisplayName, isInTelegram } from '../lib/telegram.js';
import { CreateAgent } from './CreateAgent.jsx';

export function Play({ onConnect }) {
  const [step, setStep] = useState('pick');         // 'pick' | 'form' | 'create-agent'
  const [mode, setMode] = useState(null);           // 'ai' | 'human'
  const [displayName, setDisplayName] = useState(() => getTelegramDisplayName());
  const [tableId, setTableId] = useState(() => 'table-' + Math.random().toString(16).slice(2, 8));
  const inTelegram = isInTelegram();

  function pickMode(m) {
    setMode(m);
    setStep('form');
  }

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

  if (step === 'create-agent') {
    return (
      <CreateAgent
        onBack={() => setStep('pick')}
        onDeploy={(agent) => {
          onConnect({
            tableId: 'table-' + Math.random().toString(16).slice(2, 8),
            displayName: getTelegramDisplayName() || 'Anon',
            buyIn: 1000,
            smallBlind: 10,
            bigBlind: 20,
            wantAI: true,
            agentStrategy: agent.strategy,
          });
        }}
      />
    );
  }

  if (step === 'pick') {
    return (
      <div className="play">
        {/* ── Deploy Agent hero card ── */}
        <div className="play__ai-card">
          <div className="play__ai-eyebrow">Deploy Agent</div>
          <div className="play__ai-title">Deploy your agent.</div>
          <p className="play__ai-sub">Your AI plays for you · sit back and watch</p>
          <button type="button" className="play__ai-btn" onClick={() => setStep('create-agent')}>
            DEPLOY AGENT
            <ArrowRight />
          </button>
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
