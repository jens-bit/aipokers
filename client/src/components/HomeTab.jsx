import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

export function HomeTab({ onDeploy, onWatch, onCreateAgent, onOpenChat, onGoPlay }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      onDeploy(await res.json());
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
    } catch { /* fall through */ }
    onWatch({
      tableId: agent.activeTableId,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      memoryContext,
    });
    setWatching(false);
  }

  if (loading) {
    return (
      <div className="dr-app">
        <div className="dr-screen">
          <section className="dr-hero dr-hero--loading">
            <p className="dr-label dr-label--accent">Loading profile</p>
            <h1>Looking for your agents</h1>
            <div className="dr-skeleton-grid"><i /><i /><i /></div>
          </section>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return <EmptyHome onCreate={onCreateAgent} onGoPlay={onGoPlay} />;
  }

  return (
    <ExistingHome
      agents={agents}
      busyId={deployingId}
      onCreate={onCreateAgent}
      onOpenChat={onOpenChat}
      onDeploy={deployAgent}
      onWatch={watchAgent}
      onGoPlay={onGoPlay}
    />
  );
}

// ── Home variants ──────────────────────────────────────────────────────────

function EmptyHome({ onCreate, onGoPlay }) {
  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--home">
        <section className="dr-home-stage dr-home-stage--empty">
          <div className="dr-home-stage__top">
            <span><i /> No agent</span>
            <small>First run</small>
          </div>
          <div className="dr-home-stage__main">
            <AgentAvatar size="lg" />
            <div>
              <p className="dr-label dr-label--accent">Chat first</p>
              <h1>Build your first poker agent.</h1>
              <p>Tell it how to play. Chat turns that into a saved strategy profile.</p>
            </div>
          </div>
          <button className="dr-primary-btn" type="button" onClick={onCreate}>
            Start in chat <ChevronRight />
          </button>
        </section>

        <div className="dr-practice-row">
          <button type="button" onClick={onGoPlay}>Play yourself</button>
        </div>
      </div>
    </div>
  );
}

function ExistingHome({ agents, busyId, onCreate, onOpenChat, onDeploy, onWatch, onGoPlay }) {
  const playing = agents.filter((a) => a.status === 'playing' || a.activeTableId);
  const ready = agents.filter((a) => a.status !== 'playing' && !a.activeTableId);
  const primary = playing[0] || ready[0] || agents[0];
  const hasPlaying = playing.length > 0;

  const status = hasPlaying
    ? (playing.length > 1 ? `${playing.length} agents playing` : 'Playing now')
    : ready.length > 1 ? `${ready.length} ready in stable` : 'Ready to deploy';

  const primaryLabel = hasPlaying
    ? 'Open table'
    : busyId === primary.id ? 'Deploying…' : 'Deploy agent';

  function handlePrimaryAction() {
    if (hasPlaying) onWatch(primary);
    else onDeploy(primary);
  }

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--home">
        <section className="dr-home-stage">
          <div className="dr-home-stage__top">
            <span><i className={hasPlaying ? 'is-live' : ''} /> {status}</span>
          </div>
          <div className="dr-home-stage__main">
            <AgentAvatar size="lg" />
            <div>
              <p className="dr-label dr-label--accent">Primary agent</p>
              <h1>{primary.name}</h1>
              <small>
                {primary.style} style / {primary.risk} risk
                {primary.stats?.handsPlayed ? ` / ${primary.stats.handsPlayed} hand${primary.stats.handsPlayed === 1 ? '' : 's'}` : ''}
              </small>
            </div>
          </div>

          {hasPlaying ? <HomeTableSnapshot agent={primary} /> : <HomeDeployRunway agent={primary} />}

          <div className="dr-home-actions">
            <button
              className="dr-primary-btn"
              type="button"
              onClick={handlePrimaryAction}
              disabled={busyId === primary.id}
            >
              {primaryLabel} <ChevronRight />
            </button>
            <button className="dr-secondary-btn dr-home-chat-btn" type="button" onClick={() => onOpenChat(primary)}>
              <SendIcon /> Chat to tune
            </button>
          </div>
        </section>

        <section className="dr-deploy-prompt dr-deploy-prompt--compact">
          <span><PlusIcon color="#00d4aa" /></span>
          <div>
            <p className="dr-label">Stable</p>
            <small>Add another agent to your roster.</small>
          </div>
          <button type="button" onClick={onCreate}>+ Create new</button>
        </section>

        {agents.length > 1 && (
          <AgentCarousel agents={agents} busyId={busyId} onDeploy={onDeploy} />
        )}

        <AgentStats agent={primary} />

        <div className="dr-practice-row">
          <button type="button" onClick={onGoPlay}>Play yourself</button>
        </div>
      </div>
    </div>
  );
}

function HomeTableSnapshot({ agent }) {
  return (
    <div className="dr-home-table">
      <div className="dr-home-table__felt">
        <span className="dr-home-table__seat dr-home-table__seat--top">
          <AgentAvatar size="xs" />
          <b>Opponent</b>
        </span>
        <div className="dr-home-table__pot">
          <small>Live now</small>
          <b>HU NLH</b>
        </div>
        <div className="dr-home-table__cards">
          <Pip rank="A" suit="s" />
          <Pip rank="K" suit="h" />
          <Pip rank="Q" suit="c" />
        </div>
        <span className="dr-home-table__seat dr-home-table__seat--bottom">
          <AgentAvatar size="xs" />
          <b>{agent.name}</b>
        </span>
      </div>
    </div>
  );
}

function HomeDeployRunway({ agent }) {
  return (
    <div className="dr-deploy-runway">
      <div className="dr-deploy-runway__lane">
        <span className="dr-deploy-runway__seat">
          <AgentAvatar size="md" />
          <i />
        </span>
        <div>
          <p className="dr-label dr-label--accent">Ready on bench</p>
          <b>{agent.tablePreference || 'HU NLH / $10-$20'}</b>
          <small>No table yet. Deploy this agent to start watching live hands.</small>
        </div>
      </div>
      <div className="dr-deploy-runway__steps">
        <span><CheckIcon color="#00d4aa" /> Strategy saved</span>
        <span><ChipIcon color="#cdb380" /> Choose table</span>
        <span><ChevronRight color="#00d4aa" /> Deploy</span>
      </div>
    </div>
  );
}

function AgentCarousel({ agents, busyId, onDeploy }) {
  return (
    <section className="dr-agent-carousel" aria-label="Agent stable">
      <div className="dr-section-head">
        <p className="dr-label">Stable</p>
        <span>{agents.length} agents</span>
      </div>
      <div className="dr-agent-carousel__track">
        {agents.map((agent) => {
          const isPlaying = agent.status === 'playing' || agent.activeTableId;
          const busy = busyId === agent.id;
          return (
            <button
              type="button"
              key={agent.id}
              className="dr-agent-mini-card"
              onClick={() => onDeploy(agent)}
              disabled={isPlaying || busy}
            >
              <span><AgentAvatar size="xs" /><i className={isPlaying ? 'is-live' : ''} /></span>
              <b>{agent.name}</b>
              <small>{isPlaying ? 'Playing now' : busy ? 'Deploying…' : `${agent.style} / ${agent.risk}`}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AgentStats({ agent }) {
  const stats = agent.stats || {};
  const handsPlayed = stats.handsPlayed ?? 0;
  const winRate = Number.isFinite(Number(stats.winRate)) ? `${Math.round(Number(stats.winRate))}%` : '--';
  const status = agent.status === 'playing' ? 'Playing' : 'Ready';
  const aggression = stats.totalDecisions
    ? `${Math.round((stats.aggressiveDecisions / stats.totalDecisions) * 100)}%`
    : '--';
  const cells = [
    ['Status', status],
    ['Hands', String(handsPlayed)],
    ['Win rate', winRate],
    ['Aggression', aggression],
  ];
  return (
    <section className="dr-stats">
      {cells.map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <b>{value}</b>
        </span>
      ))}
    </section>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────

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

function Pip({ rank, suit }) {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#e84545' : '#1a1a1a';
  const paths = {
    s: <path d="M12 2s-8 7-8 12c0 3 2 5 5 5 1.5 0 2.5-.7 3-1.7.5 1 1.5 1.7 3 1.7 3 0 5-2 5-5 0-5-8-12-8-12zM11 18l-1.5 4h5L13 18z" fill={color} />,
    h: <path d="M12 21s-9-6.5-9-12.5c0-3 2-5 4.5-5 2 0 3.5 1.2 4.5 2.8 1-1.6 2.5-2.8 4.5-2.8 2.5 0 4.5 2 4.5 5C21 14.5 12 21 12 21z" fill={color} />,
    d: <path d="M12 2l9 10-9 10L3 12 12 2z" fill={color} />,
    c: <path d="M12 2a4 4 0 0 0-3.7 5.5A5 5 0 1 0 8.8 12c-.4 1.3-.8 2.5-1.8 5h4l.5-3c.2-1-.1-1.5-.5-2 .3.3.6.5 1 .5s.7-.2 1-.5c-.4.5-.7 1-.5 2l.5 3h4c-1-2.5-1.4-3.7-1.8-5A5 5 0 1 0 15.7 7.5 4 4 0 0 0 12 2z" fill={color} />,
  };
  return (
    <span className="dr-playing-card dr-playing-card--mini">
      <b>{rank}</b>
      <svg width="10" height="10" viewBox="0 0 24 24" className="dr-card-suit" aria-hidden>{paths[suit]}</svg>
    </span>
  );
}

function ChevronRight({ color = 'currentColor' }) {
  return (
    <svg className="dr-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ color = 'currentColor' }) {
  return (
    <svg className="dr-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function PlusIcon({ color = 'currentColor' }) {
  return (
    <svg className="dr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChipIcon({ color = 'currentColor' }) {
  return (
    <svg className="dr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="dr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
