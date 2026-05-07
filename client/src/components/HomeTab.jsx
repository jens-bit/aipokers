import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';
import '../styles/home.css';

const AGENT_ACCENTS = ['#00D4AA', '#9B7BFF', '#CDB380', '#FF7A8E'];

export function HomeTab({ onDeploy, onWatch, onCreateAgent, onOpenChat, onGoPlay }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);

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
    if (!agent?.activeTableId) return;
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

  const playing = agents.filter((a) => a.status === 'playing' || a.activeTableId);
  const ready = agents.filter((a) => a.status !== 'playing' && !a.activeTableId);
  const activeSession = playing[0] || null;
  const primaryReady = ready[0] || null;

  function handleRun() {
    if (primaryReady) deployAgent(primaryReady);
    else if (activeSession) watchAgent(activeSession);
    else onCreateAgent();
  }

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--home no-scrollbar">
        {playing.length > 0 && <HomeAgentsPill count={playing.length} />}
        <HomeHero
          onRun={handleRun}
          isBusy={!!deployingId}
          playingCount={playing.length}
        />
        <HomePlayRow onGoPlay={onGoPlay} />
        {activeSession && (
          <HomeSession agent={activeSession} onWatch={() => watchAgent(activeSession)} />
        )}
        {agents.length > 0 && (
          <HomeMyAgents
            agents={agents}
            busyId={deployingId}
            onDeploy={deployAgent}
            onWatch={watchAgent}
            // TODO: App.jsx prop change — add onGoAgents prop to navigate to the
            // Agents tab; for now "View all" falls back to onCreateAgent
            onViewAll={onCreateAgent}
          />
        )}
      </div>
    </div>
  );
}

// ── Active-agents pill ────────────────────────────────────────────────────

function HomeAgentsPill({ count }) {
  return (
    <div className="dr-home-pill-row">
      <div className="dr-home-agents-pill">
        <span className="dr-home-agents-pill__dot" aria-hidden />
        <span className="dr-home-agents-pill__label">
          {count} agent{count !== 1 ? 's' : ''} active now
        </span>
        <ChevronRightSvg size={11} color="#00D4AA" />
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────

function HomeHero({ onRun, isBusy, playingCount }) {
  return (
    <div className="dr-home-hero">
      <div className="dr-home-hero__glow" aria-hidden />
      <div className="dr-home-hero__silhouette" aria-hidden>
        <svg width="170" height="200" viewBox="0 0 170 200">
          <defs>
            <linearGradient id="dr-heroHood" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#1a3a3a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#0a1518" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M85 10 C50 10 30 35 30 70 L30 200 L140 200 L140 70 C140 35 120 10 85 10 Z" fill="url(#dr-heroHood)" />
          <ellipse cx="85" cy="80" rx="28" ry="36" fill="#0a0a0a" />
          <circle cx="75" cy="74" r="3" fill="#00D4AA" opacity="0.8" />
          <circle cx="95" cy="74" r="3" fill="#00D4AA" opacity="0.8" />
        </svg>
      </div>

      <div className="dr-home-hero__content">
        <div className="dr-home-hero__eyebrow">READY TO RUN</div>
        <div className="dr-home-hero__headline">
          Deploy your agent.<br />
          <span className="dr-home-hero__headline--accent">Sit back and watch.</span>
        </div>
        <div className="dr-home-hero__sub">Your AI plays for you, 24/7.</div>
        <button
          className="dr-home-hero__run-btn"
          type="button"
          onClick={onRun}
          disabled={isBusy}
        >
          {isBusy ? 'DEPLOYING…' : 'RUN AGENT'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="dr-home-hero__ticker">
        <div className="dr-home-hero__ticker-left">
          <SparkleSvg />
          <span>
            <span className="dr-home-hero__ticker-bold">
              {playingCount} agent{playingCount !== 1 ? 's' : ''}
            </span>{' '}
            playing now
          </span>
        </div>
        <div className="dr-home-hero__ticker-right">
          {/* TODO: App.jsx prop change — pass todayProfit prop to HomeTab */}
          <span>Today's profit</span>
          <span className="dr-home-hero__ticker-profit">+$0</span>
        </div>
      </div>
    </div>
  );
}

// ── Play yourself row ─────────────────────────────────────────────────────

function HomePlayRow({ onGoPlay }) {
  return (
    <button className="dr-home-play-row" type="button" onClick={onGoPlay}>
      <div className="dr-home-play-row__icon">
        <ProfileSvg />
      </div>
      <div className="dr-home-play-row__body">
        <div className="dr-home-play-row__title">Play yourself</div>
        <div className="dr-home-play-row__sub">
          <span className="dr-home-play-row__sub--accent">12 tables</span> active · join in seconds
        </div>
      </div>
      <ChevronRightSvg size={16} color="#6B6B6B" />
    </button>
  );
}

// ── Live session card ─────────────────────────────────────────────────────

function HomeSession({ agent, onWatch }) {
  const gameType = agent.tablePreference || 'HU NLH';
  const tableId = agent.activeTableId || '—';
  return (
    <div
      className="dr-home-session"
      role="button"
      tabIndex={0}
      onClick={onWatch}
      onKeyDown={(e) => e.key === 'Enter' && onWatch()}
    >
      <div className="dr-home-session__header">
        <div className="dr-home-session__live">
          <span className="dr-home-session__dot" aria-hidden />
          <span className="dr-label dr-label--accent">LIVE SESSION</span>
        </div>
        <ChevronRightSvg size={14} color="#6B6B6B" />
      </div>
      <div className="dr-home-session__body">
        <AgentAvatar size="md" />
        <div className="dr-home-session__info">
          <div className="dr-home-session__name">
            <span className="dr-home-session__agent-name">{agent.name}</span>
            <span className="dr-home-session__badge">{gameType}</span>
          </div>
          <div className="dr-home-session__table">Table #{tableId} · Blinds $10/$20</div>
        </div>
        <div className="dr-home-session__cards">
          {/* TODO: replace with real hole cards if API exposes them per session */}
          <HoleCard rank="A" suit="s" />
          <HoleCard rank="K" suit="h" />
        </div>
        <button
          className="dr-home-session__watch-btn"
          type="button"
          onClick={(e) => { e.stopPropagation(); onWatch(); }}
        >
          WATCH
        </button>
      </div>
    </div>
  );
}

// ── My agents ─────────────────────────────────────────────────────────────

function HomeMyAgents({ agents, busyId, onDeploy, onWatch, onViewAll }) {
  return (
    <div className="dr-home-my-agents">
      <div className="dr-home-my-agents__header">
        <span className="dr-label">MY AGENTS</span>
        <button className="dr-home-my-agents__view-all" type="button" onClick={onViewAll}>
          View all <ChevronRightSvg size={11} color="#00D4AA" />
        </button>
      </div>
      <div className="dr-home-my-agents__track no-scrollbar">
        {agents.map((agent, i) => {
          const isPlaying = agent.status === 'playing' || !!agent.activeTableId;
          const accent = AGENT_ACCENTS[i % AGENT_ACCENTS.length];
          const stats = agent.stats || {};
          const winRate = Number.isFinite(Number(stats.winRate))
            ? `${Number(stats.winRate).toFixed(1)}%`
            : '--';
          const hands = stats.handsPlayed
            ? Number(stats.handsPlayed).toLocaleString()
            : '0';
          return (
            <HomeAgentCard
              key={agent.id}
              rank={i + 1}
              name={agent.name}
              winRate={winRate}
              hands={hands}
              accent={accent}
              isPlaying={isPlaying}
              isBusy={busyId === agent.id}
              onClick={() => (isPlaying ? onWatch(agent) : onDeploy(agent))}
            />
          );
        })}
      </div>
    </div>
  );
}

function HomeAgentCard({ rank, name, winRate, hands, accent, isPlaying, isBusy, onClick }) {
  return (
    <button
      className="dr-home-agent-card"
      type="button"
      onClick={onClick}
      disabled={isBusy}
    >
      <div className="dr-home-agent-card__top">
        <span
          className="dr-home-agent-card__rank"
          style={{ background: `${accent}26`, color: accent }}
        >
          #{rank}
        </span>
        {isPlaying && <span className="dr-home-agent-card__live-dot" aria-label="Playing now" />}
      </div>
      {/* dynamic portrait gradient uses accent — stays inline */}
      <div
        className="dr-home-agent-card__portrait"
        style={{ background: `radial-gradient(ellipse at center bottom, ${accent}22, transparent 70%), #0e1418` }}
      >
        <svg width="60" height="62" viewBox="0 0 60 62" aria-hidden>
          <defs>
            <linearGradient id={`dr-hood-${rank}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity="0.5" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M30 4 C16 4 8 14 8 28 L8 62 L52 62 L52 28 C52 14 44 4 30 4 Z" fill={`url(#dr-hood-${rank})`} />
          <ellipse cx="30" cy="32" rx="11" ry="14" fill="#0a0a0a" />
          <circle cx="26" cy="29" r="1.4" fill={accent} />
          <circle cx="34" cy="29" r="1.4" fill={accent} />
        </svg>
      </div>
      <div className="dr-home-agent-card__name">{name}</div>
      <div className="dr-home-agent-card__stats">
        <div>
          <div className="dr-home-agent-card__winrate-label">WIN RATE</div>
          {/* dynamic accent color stays inline */}
          <div className="dr-home-agent-card__winrate-value" style={{ color: accent }}>{winRate}</div>
        </div>
        <div className="dr-home-agent-card__hands">
          <BarChartSvg />
          {hands}
        </div>
      </div>
    </button>
  );
}

// ── Hole card (placeholder cards in live session) ─────────────────────────

function HoleCard({ rank, suit }) {
  const isRed = suit === 'h' || suit === 'd';
  const suitColor = isRed ? '#e84545' : '#1a1a1a';
  const suitPaths = {
    s: <path d="M12 2s-8 7-8 12c0 3 2 5 5 5 1.5 0 2.5-.7 3-1.7.5 1 1.5 1.7 3 1.7 3 0 5-2 5-5 0-5-8-12-8-12zM11 18l-1.5 4h5L13 18z" fill={suitColor} />,
    h: <path d="M12 21s-9-6.5-9-12.5c0-3 2-5 4.5-5 2 0 3.5 1.2 4.5 2.8 1-1.6 2.5-2.8 4.5-2.8 2.5 0 4.5 2 4.5 5C21 14.5 12 21 12 21z" fill={suitColor} />,
    d: <path d="M12 2l9 10-9 10L3 12 12 2z" fill={suitColor} />,
    c: <path d="M12 2a4 4 0 0 0-3.7 5.5A5 5 0 1 0 8.8 12c-.4 1.3-.8 2.5-1.8 5h4l.5-3c.2-1-.1-1.5-.5-2 .3.3.6.5 1 .5s.7-.2 1-.5c-.4.5-.7 1-.5 2l.5 3h4c-1-2.5-1.4-3.7-1.8-5A5 5 0 1 0 15.7 7.5 4 4 0 0 0 12 2z" fill={suitColor} />,
  };
  return (
    <span className="dr-home-hole-card">
      <span className="dr-home-hole-card__rank" style={{ color: suitColor }}>{rank}</span>
      <svg width="8" height="8" viewBox="0 0 24 24" aria-hidden>{suitPaths[suit]}</svg>
    </span>
  );
}

// ── AgentAvatar (retained from previous version) ──────────────────────────

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

// ── SVG icon helpers ──────────────────────────────────────────────────────

function ChevronRightSvg({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ProfileSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SparkleSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CDB380" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function BarChartSvg() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}
