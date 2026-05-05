import { useEffect, useMemo, useState } from 'react';
import { getTelegramUser } from '../lib/telegram.js';
import './design-ref.css';

const QUICK_PROMPTS = [
  'Balanced heads-up player',
  'Tight, low-risk grinder',
  'Aggressive pressure agent',
];

const INITIAL_CHAT = [
  {
    role: 'assistant',
    content: 'Tell me the playing style you want. I will turn it into your first agent draft.',
  },
];

function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.7 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'dr-icon',
    'aria-hidden': true,
  };

  switch (name) {
    case 'arrow-left':
      return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'home':
      return <svg {...common}><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>;
    case 'spade':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M12 2s-8 7-8 12c0 3 2 5 5 5 1.5 0 2.5-.7 3-1.7.5 1 1.5 1.7 3 1.7 3 0 5-2 5-5 0-5-8-12-8-12zM11 18l-1.5 4h5L13 18z" />
        </svg>
      );
    case 'agent':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="14" rx="3" />
          <path d="M12 3v3" />
          <circle cx="9" cy="13" r="1.2" fill={color} stroke="none" />
          <circle cx="15" cy="13" r="1.2" fill={color} stroke="none" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'history':
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></svg>;
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>;
    case 'trophy':
      return <svg {...common}><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M5 4H3v2a3 3 0 0 0 3 3" /><path d="M19 4h2v2a3 3 0 0 1-3 3" /><path d="M9 17h6v3H9z" /><path d="M8 20h8" /></svg>;
    case 'bar-chart':
      return <svg {...common}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></svg>;
    case 'check':
      return <svg {...common}><path d="M5 12l5 5 9-11" /></svg>;
    case 'chevron-right':
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'send':
      return <svg {...common}><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>;
    case 'chip':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case 'sparkle':
      return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>;
    default:
      return null;
  }
}

function telegramIdentity(user) {
  const params = new URLSearchParams(window.location.search);
  const previewUser = params.get('dr-user');

  if (!user) {
    const devName = previewUser || 'dev-zero-agent';
    return {
      id: `telegram:${devName}`,
      name: 'You',
      handle: '@you',
    };
  }

  const name = user.first_name || user.username || 'Telegram User';
  return {
    id: `telegram:${user.id}`,
    name,
    handle: user.username ? `@${user.username}` : 'Telegram',
  };
}

async function loadProfile(userId) {
  const response = await fetch(`/api/agent-profile?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('profile request failed');
  return response.json();
}

async function sendChatTurn(userId, content) {
  const response = await fetch('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, content }),
  });
  if (!response.ok) throw new Error('chat request failed');
  return response.json();
}

async function resetProfile(userId) {
  const response = await fetch(`/api/agent-profile?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('reset request failed');
  return response.json();
}

function inferFallbackAgent(content) {
  const lower = content.toLowerCase();
  const aggressive = /\b(aggro|aggressive|pressure|bluff|attack)\b/.test(lower);
  const tight = /\b(tight|safe|conservative|careful|low risk)\b/.test(lower);
  const style = aggressive ? 'Aggressive' : tight ? 'Tight' : 'Balanced';
  const risk = aggressive ? 'High' : tight ? 'Low' : 'Medium';
  const name = aggressive ? 'Pressure v1' : tight ? 'Sentinel v1' : 'Balanced v1';
  return {
    id: `agent_mock_${Date.now()}`,
    name,
    style,
    risk,
    status: 'ready',
    bankroll: 0,
    bankrollStatus: 'unfunded',
    tablePreference: 'HU NLH / $10-$20',
    deployStatus: 'needs_funding',
    hands: 0,
    winRate: null,
    strategy: aggressive
      ? 'Pressure capped ranges, bluff selectively, and value bet larger in position.'
      : tight
        ? 'Play fewer hands, preserve the stack, and take value-heavy spots.'
        : 'Play tight-aggressive, mix measured bluffs, and keep decisions bankroll-aware.',
    createdAt: new Date().toISOString(),
  };
}

function normalizeAgent(agent) {
  if (!agent) return null;
  const bankroll = Number(agent.bankroll ?? 0);
  const hands = Number(agent.hands ?? 0);
  const isPlaying = agent.status === 'playing' || Boolean(agent.activeTableId);
  const isFunded = bankroll > 0 || agent.bankrollStatus === 'funded';
  return {
    ...agent,
    name: agent.name || 'Agent v1',
    style: agent.style || 'Balanced',
    risk: agent.risk || 'Medium',
    status: isPlaying ? 'playing' : agent.status || 'idle',
    bankroll,
    hands,
    winRate: agent.winRate ?? null,
    bankrollStatus: isFunded ? 'funded' : 'unfunded',
    tablePreference: agent.tablePreference || 'HU NLH / $10-$20',
    deployStatus: isPlaying ? 'playing' : isFunded ? 'ready' : 'needs_funding',
    strategy: agent.strategy || 'You are a balanced poker player who mixes value betting with selective pressure.',
  };
}

function normalizeProfile(profile) {
  const agents = (profile?.agents || []).map(normalizeAgent).filter(Boolean);
  return {
    userId: profile?.userId,
    hasAgents: agents.length > 0,
    agents,
    chat: profile?.chat?.length ? profile.chat : INITIAL_CHAT,
  };
}

function fallbackChat(profile, content) {
  const createdAgent = profile.agents.length === 0 ? inferFallbackAgent(content) : null;
  const chat = [
    ...(profile.chat?.length ? profile.chat : INITIAL_CHAT),
    { role: 'user', content },
    {
      role: 'assistant',
      content: createdAgent
        ? `${createdAgent.name} is ready. I tuned it as a ${createdAgent.style.toLowerCase()} heads-up NLH agent with ${createdAgent.risk.toLowerCase()} risk.`
        : 'I updated the draft. You can deploy it or keep refining the strategy.',
    },
  ];
  const agents = createdAgent ? [normalizeAgent(createdAgent)] : profile.agents.map(normalizeAgent);
  return { ...profile, hasAgents: agents.length > 0, agents, chat, createdAgent: normalizeAgent(createdAgent) };
}

function Suit({ suit, size = 14 }) {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#e84545' : '#1a1a1a';
  const paths = {
    s: <path d="M12 2s-8 7-8 12c0 3 2 5 5 5 1.5 0 2.5-.7 3-1.7.5 1 1.5 1.7 3 1.7 3 0 5-2 5-5 0-5-8-12-8-12zM11 18l-1.5 4h5L13 18z" fill={color} />,
    h: <path d="M12 21s-9-6.5-9-12.5c0-3 2-5 4.5-5 2 0 3.5 1.2 4.5 2.8 1-1.6 2.5-2.8 4.5-2.8 2.5 0 4.5 2 4.5 5C21 14.5 12 21 12 21z" fill={color} />,
    d: <path d="M12 2l9 10-9 10L3 12 12 2z" fill={color} />,
    c: <path d="M12 2a4 4 0 0 0-3.7 5.5A5 5 0 1 0 8.8 12c-.4 1.3-.8 2.5-1.8 5h4l.5-3c.2-1-.1-1.5-.5-2 .3.3.6.5 1 .5s.7-.2 1-.5c-.4.5-.7 1-.5 2l.5 3h4c-1-2.5-1.4-3.7-1.8-5A5 5 0 1 0 15.7 7.5 4 4 0 0 0 12 2zM11 17l-1 5h4l-1-5h-2z" fill={color} />,
  };

  return <svg width={size} height={size} viewBox="0 0 24 24" className="dr-card-suit" aria-hidden>{paths[suit]}</svg>;
}

function PlayingCard({ rank, suit, mini = false }) {
  return (
    <span className={`dr-playing-card${mini ? ' dr-playing-card--mini' : ''}`}>
      <b>{rank}</b>
      <Suit suit={suit} size={mini ? 10 : 16} />
    </span>
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

function Logo() {
  return (
    <div className="dr-logo">
      <Icon name="spade" size={22} color="#00d4aa" />
      <span>AI Poker</span>
    </div>
  );
}

function AppHeader({ identity, agentCount, onCreate }) {
  const agentLabel = agentCount === 0
    ? 'No agents'
    : `${agentCount} agent${agentCount === 1 ? '' : 's'}`;

  return (
    <header className="dr-topbar">
      <Logo />
      <div className="dr-topbar__right">
        <span className="dr-user-pill">
          <b>{identity.name.slice(0, 1).toUpperCase()}</b>
          <small>{agentLabel}</small>
        </span>
        <button className="dr-icon-button" type="button" onClick={onCreate} aria-label="Create agent">
          <Icon name="plus" size={18} />
        </button>
      </div>
    </header>
  );
}

function LoadingState({ identity }) {
  return (
    <div className="dr-screen">
      <AppHeader identity={identity} agentCount={0} onCreate={() => {}} />
      <section className="dr-hero dr-hero--loading">
        <p className="dr-label dr-label--accent">Loading profile</p>
        <h1>Looking for your agents</h1>
        <p>Getting your Telegram profile ready before the app opens.</p>
        <div className="dr-skeleton-grid">
          <i /><i /><i />
        </div>
      </section>
    </div>
  );
}

function EmptyHome({ identity, onCreate }) {
  return (
    <div className="dr-screen">
      <AppHeader identity={identity} agentCount={0} onCreate={onCreate} />
      <section className="dr-hero">
        <p className="dr-label dr-label--accent">New agent</p>
        <h1>Build your first poker agent.</h1>
        <p>You have no agents yet. Start with a playing style and chat will shape version one.</p>
        <button className="dr-primary-btn" type="button" onClick={onCreate}>
          Start in chat
          <Icon name="chevron-right" size={15} />
        </button>
      </section>
      <section className="dr-panel dr-empty-panel">
        <div className="dr-empty-orbit">
          <AgentAvatar size="lg" />
        </div>
        <h2>Start with a style</h2>
        <p>Describe how the agent should play, then review the draft before funding its first table.</p>
        <div className="dr-state-list">
          <span><Icon name="check" size={14} color="#00d4aa" /> Choose a playing style</span>
          <span><Icon name="check" size={14} color="#00d4aa" /> Review the strategy draft</span>
          <span><Icon name="check" size={14} color="#00d4aa" /> Fund and deploy when ready</span>
        </div>
      </section>
      <section className="dr-setup-strip">
        <SetupStep number="1" label="Create" value="Agent style" active />
        <SetupStep number="2" label="Fund" value="Bankroll" />
        <SetupStep number="3" label="Deploy" value="First table" />
      </section>
      <QuickPromptPanel onPick={onCreate} />
    </div>
  );
}

function SetupStep({ number, label, value, active = false, complete = false }) {
  return (
    <span className={`dr-setup-step${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}`}>
      <b>{complete ? <Icon name="check" size={13} /> : number}</b>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function QuickPromptPanel({ onPick }) {
  return (
    <section className="dr-panel">
      <div className="dr-section-head">
        <p className="dr-label">Pick a starting point</p>
      </div>
      <div className="dr-prompt-list">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => onPick(prompt)}>
            <Icon name="sparkle" size={14} color="#cdb380" />
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChatMessage({ message }) {
  return (
    <div className={`dr-chat-message dr-chat-message--${message.role}`}>
      <span>{message.content}</span>
    </div>
  );
}

function CreatedAgentCard({ agent, onOpenAgent, onKeepEditing }) {
  if (!agent) return null;
  return (
    <section className="dr-created-card">
      <div>
        <AgentAvatar size="md" />
        <span>
          <p className="dr-label dr-label--accent">Agent created</p>
          <h2>{agent.name}</h2>
          <small>{agent.style} style / {agent.risk} risk</small>
        </span>
      </div>
      <p>{agent.strategy}</p>
      <div className="dr-readiness-list">
        <span><Icon name="check" size={14} color="#00d4aa" /> Strategy saved</span>
        <span><Icon name="check" size={14} color="#00d4aa" /> Table profile selected</span>
        <span><Icon name="chip" size={14} color="#cdb380" /> Add bankroll before deploy</span>
      </div>
      <div className="dr-card-actions">
        <button className="dr-primary-btn" type="button" onClick={onOpenAgent}>Open agent</button>
        <button className="dr-secondary-btn" type="button" onClick={onKeepEditing}>Keep tuning</button>
      </div>
    </section>
  );
}

function getLastUserPrompt(messages) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content || '';
}

function DraftBlueprint({ messages, agent }) {
  const inferred = agent || inferFallbackAgent(getLastUserPrompt(messages));
  const hasPrompt = messages.some((message) => message.role === 'user');

  return (
    <section className="dr-blueprint-card">
      <div className="dr-section-head">
        <p className="dr-label">{agent ? 'Created blueprint' : 'Draft blueprint'}</p>
        <span>{hasPrompt ? 'Tuned' : 'Waiting'}</span>
      </div>
      <div className="dr-blueprint-grid">
        <BlueprintCell label="Style" value={hasPrompt || agent ? inferred.style : 'Unset'} />
        <BlueprintCell label="Risk" value={hasPrompt || agent ? inferred.risk : 'Unset'} />
        <BlueprintCell label="Table" value="HU NLH" />
      </div>
      <p>{hasPrompt || agent ? inferred.strategy : 'Your first prompt becomes the strategy draft for version one.'}</p>
    </section>
  );
}

function BlueprintCell({ label, value }) {
  return (
    <span>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function CreateAgentScreen({ identity, profile, chatStatus, createdAgent, onBack, onSend, onOpenAgent }) {
  const [draft, setDraft] = useState('');
  const messages = profile.chat?.length ? profile.chat : INITIAL_CHAT;
  const busy = chatStatus === 'thinking';
  const agentSummary = profile.agents.length === 0
    ? 'No agents yet'
    : `${profile.agents.length} agent${profile.agents.length === 1 ? '' : 's'}`;

  function submit(content = draft) {
    const text = content.trim();
    if (!text || busy) return;
    setDraft('');
    onSend(text);
  }

  return (
    <div className="dr-screen dr-screen--chat">
      <header className="dr-chat-header">
        <button className="dr-plain-button" type="button" onClick={onBack} aria-label="Back">
          <Icon name="arrow-left" size={22} />
        </button>
        <div>
          <p className="dr-label dr-label--accent">Create agent</p>
          <h1>Build agent v1</h1>
          <small>{identity.handle} / {agentSummary}</small>
        </div>
      </header>
      <div className="dr-chat-log">
        {messages.map((message, index) => <ChatMessage key={`${message.role}-${index}`} message={message} />)}
        {busy && (
          <div className="dr-chat-message dr-chat-message--assistant">
            <span className="dr-typing"><i /><i /><i /></span>
          </div>
        )}
      </div>
      <DraftBlueprint messages={messages} agent={createdAgent} />
      <CreatedAgentCard agent={createdAgent} onOpenAgent={onOpenAgent} onKeepEditing={() => setDraft('Tune it for 3-bet pots and river discipline')} />
      {!createdAgent && (
        <div className="dr-chat-suggestions">
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" onClick={() => submit(prompt)} disabled={busy}>{prompt}</button>
          ))}
        </div>
      )}
      <form className="dr-chat-input" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Describe the agent you want"
          disabled={busy}
        />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}

function ExistingHome({ identity, agent, onCreate, onOpenAgent }) {
  const needsFunding = agent.deployStatus === 'needs_funding';
  const statusLabel = agent.status === 'playing' ? 'Playing now' : needsFunding ? 'Needs bankroll' : 'Ready to deploy';
  return (
    <div className="dr-screen">
      <AppHeader identity={identity} agentCount={1} onCreate={onCreate} />
      <section className="dr-active-agent-card">
        <div className="dr-active-agent-card__top">
          <span><i /> {statusLabel}</span>
          <button type="button" onClick={onOpenAgent}>View <Icon name="chevron-right" size={12} /></button>
        </div>
        <div className="dr-active-agent-card__main">
          <AgentAvatar size="lg" />
          <div>
            <p className="dr-label dr-label--accent">My first agent</p>
            <h1>{agent.name}</h1>
            <small>{agent.style} style / {agent.risk} risk / {agent.hands} hands</small>
          </div>
        </div>
        <p>{agent.strategy}</p>
        <button className="dr-primary-btn" type="button">{needsFunding ? 'Fund agent' : 'Deploy to table'}</button>
      </section>
      <AgentStats agent={agent} />
      <FirstSessionSetup agent={agent} />
      <RecentActivity agent={agent} />
    </div>
  );
}

function FirstSessionSetup({ agent }) {
  const needsFunding = agent.deployStatus === 'needs_funding';
  return (
    <section className="dr-panel dr-session-setup">
      <div className="dr-section-head">
        <p className="dr-label">First session</p>
        <span>{needsFunding ? 'Not funded' : 'Ready'}</span>
      </div>
      <div className="dr-session-grid">
        <SessionCell label="Bankroll" value={`$${agent.bankroll ?? 0}`} tone="warn" />
        <SessionCell label="Table" value={agent.tablePreference || 'HU NLH / $10-$20'} />
        <SessionCell label="Mode" value="Watch first" />
      </div>
      <button className="dr-secondary-wide" type="button">
        <Icon name="chip" size={16} /> Fund agent
      </button>
    </section>
  );
}

function SessionCell({ label, value, tone }) {
  return (
    <span className={tone ? `is-${tone}` : ''}>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function AgentStats({ agent }) {
  const status = agent.deployStatus === 'needs_funding'
    ? 'draft'
    : agent.status === 'idle'
      ? 'ready'
      : agent.status || 'ready';
  const stats = [
    ['Status', status],
    ['Hands', String(agent.hands ?? 0)],
    ['Win rate', agent.winRate == null ? '--' : `${agent.winRate}%`],
    ['Funds', agent.bankrollStatus === 'unfunded' ? 'Empty' : `$${agent.bankroll ?? 0}`],
  ];
  return (
    <section className="dr-stats">
      {stats.map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <b>{value}</b>
        </span>
      ))}
    </section>
  );
}

function AgentRoster({ agent, onCreate, onOpenAgent }) {
  if (!agent) {
    return (
      <div className="dr-screen">
        <section className="dr-panel dr-empty-panel dr-full-empty">
          <AgentAvatar size="lg" />
          <h2>No agents yet</h2>
          <p>Create your first agent to unlock tuning, funding, and deployment.</p>
          <button className="dr-primary-btn" type="button" onClick={onCreate}>Start in chat</button>
        </section>
      </div>
    );
  }

  return (
    <div className="dr-screen">
      <section className="dr-panel dr-agent-row" onClick={onOpenAgent}>
        <AgentAvatar size="md" />
        <span>
          <p className="dr-label dr-label--accent">Ready</p>
          <h2>{agent.name}</h2>
          <small>{agent.style} / {agent.risk} risk</small>
        </span>
        <Icon name="chevron-right" size={16} color="#6b6b6b" />
      </section>
      <button className="dr-secondary-wide" type="button" onClick={onCreate}>
        <Icon name="plus" size={16} /> Create another
      </button>
    </div>
  );
}

function AgentViewScreen({ agent, onBack }) {
  if (!agent) return null;
  return (
    <div className="dr-screen dr-screen--agent">
      <header className="dr-agent-header">
        <button className="dr-plain-button" type="button" onClick={onBack} aria-label="Back">
          <Icon name="arrow-left" size={22} />
        </button>
        <div className="dr-agent-brand">
          <Icon name="spade" size={16} color="#00d4aa" />
          <b>Agentic Poker</b>
        </div>
        <div className="dr-agent-state">
          <i />
          <span>{agent.status || 'idle'}</span>
        </div>
        <button className="dr-square-button" type="button" aria-label="Settings"><Icon name="settings" size={18} /></button>
      </header>
      <PokerTablePreview agent={agent} />
      <AgentStats agent={agent} />
      <AnalysisPreview agent={agent} />
      <RecentHands />
    </div>
  );
}

function PokerTablePreview({ agent }) {
  return (
    <section className="dr-table-card">
      <div className="dr-table-card__head">
        <b>Heads-up NLH</b>
        <span><small>02:14:38</small><i /></span>
      </div>
      <div className="dr-felt">
        <div className="dr-felt-row">
          <PlayerRow name="Opponent" stack="$1,820" position="BB" />
          <span className="dr-card-pair"><CardBack /><CardBack /></span>
          <ThinkingBadge />
        </div>
        <div className="dr-pot">
          <small>Pot</small>
          <b>$340</b>
        </div>
        <div className="dr-board-cards">
          <PlayingCard rank="A" suit="s" />
          <PlayingCard rank="K" suit="h" />
          <PlayingCard rank="Q" suit="c" />
          <PlayingCard rank="J" suit="d" />
          <PlayingCard rank="10" suit="s" />
        </div>
        <div className="dr-pot-chip">
          <Icon name="chip" size={15} color="#00d4aa" />
          <span>$340</span>
        </div>
        <div className="dr-felt-row dr-felt-row--bottom">
          <PlayerRow name={agent.name} stack="$2,340" position="BTN" />
          <span className="dr-card-pair"><PlayingCard rank="K" suit="s" mini /><PlayingCard rank="Q" suit="h" mini /></span>
          <div className="dr-equity"><small>Equity</small><b>67.3%</b></div>
        </div>
      </div>
    </section>
  );
}

function ThinkingBadge() {
  return (
    <span className="dr-thinking-badge">
      <small>Opponent turn</small>
      <b>Thinking <i /><i /><i /></b>
    </span>
  );
}

function CardBack() {
  return <span className="dr-card-back"><Icon name="spade" size={16} color="#7a8a9a" /></span>;
}

function PlayerRow({ name, stack, position }) {
  return (
    <span className="dr-player-row">
      <AgentAvatar size="xs" />
      <span><b>{name}</b><small>{stack} / {position}</small></span>
    </span>
  );
}

function AnalysisPreview({ agent }) {
  const [activeTab, setActiveTab] = useState('Live');
  const reasons = agent.style === 'Aggressive'
    ? ['Position advantage', 'Fold equity available', 'Board pressure is credible', 'River pressure remains high']
    : agent.style === 'Tight'
      ? ['Value threshold met', 'Risk stays capped', 'Opponent range is wide', 'Avoids marginal bluff catch']
      : ['Top pair, strong kicker', 'Good pot odds', 'Range advantage is stable'];
  const tabs = ['Live', 'Range', 'History', 'Notes'];

  return (
    <section className="dr-analysis">
      <div className="dr-tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            className={activeTab === tab ? 'is-active' : ''}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'Live' ? 'Live analysis' : tab}
          </button>
        ))}
      </div>
      {activeTab === 'Live' && (
        <>
          <div className="dr-analysis-stack">
            <div className="dr-decision-card">
              <div>
                <p className="dr-label">Current decision</p>
                <h2>Call $120</h2>
                <small>EV: <b>+$87.40</b></small>
              </div>
              <ConfidenceRing value={67} />
            </div>
            <div className="dr-reason-card">
              <p className="dr-label">Reasoning</p>
              {reasons.slice(0, 3).map((reason) => <span key={reason}><Icon name="check" size={13} color="#00d4aa" /> {reason}</span>)}
            </div>
          </div>
          <ActionQueue />
        </>
      )}
      {activeTab === 'Range' && <RangeCompare />}
      {activeTab === 'History' && <RecentHands compact />}
      {activeTab === 'Notes' && (
        <div className="dr-note-card">
          <p className="dr-label">Session note</p>
          <b>Balanced v1 is unfunded.</b>
          <small>Review preflop ranges before its first seated hand.</small>
        </div>
      )}
    </section>
  );
}

function ConfidenceRing({ value = 67 }) {
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <span className="dr-confidence-ring">
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} />
        <circle cx="32" cy="32" r={radius} style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
      </svg>
      <b>{value}%</b>
      <small>Confidence</small>
    </span>
  );
}

function RangeCompare() {
  return (
    <div className="dr-range-compare">
      <RangeMatrix title="Agent range" variant="agent" />
      <RangeMatrix title="Opponent range" variant="opponent" />
    </div>
  );
}

function RangeMatrix({ title, variant = 'opponent' }) {
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  function intensity(row, column) {
    if (variant === 'agent') {
      if (row === column) return Math.max(0, 0.9 - row * 0.045);
      if (row < column) return Math.max(0, 0.72 - (column - row) * 0.08 - row * 0.025);
      return Math.max(0, 0.48 - (row - column) * 0.08 - column * 0.03);
    }
    if (row === column) return Math.max(0, 0.95 - row * 0.06);
    if (row < column) return Math.max(0, 0.85 - (column - row) * 0.11 - row * 0.035);
    return Math.max(0, 0.55 - (row - column) * 0.09 - column * 0.035);
  }

  return (
    <div className="dr-range-card">
      <p className="dr-label">{title}</p>
      <div className="dr-range-axis dr-range-axis--top">
        {ranks.map((rank) => <small key={rank}>{rank}</small>)}
      </div>
      <div className="dr-range-body">
        <div className="dr-range-axis dr-range-axis--side">
          {ranks.map((rank) => <small key={rank}>{rank}</small>)}
        </div>
        <div className="dr-range-grid">
          {ranks.flatMap((_, row) => ranks.map((__, column) => (
            <i
              key={`${row}-${column}`}
              style={{ '--dr-range-alpha': intensity(row, column).toFixed(2) }}
            />
          )))}
        </div>
      </div>
      <div className="dr-range-legend">
        <span><i /> Likely</span>
        <span><i /> Possible</span>
        <span><i /> Unlikely</span>
      </div>
    </div>
  );
}

function ActionQueue() {
  return (
    <div className="dr-action-queue">
      <span>
        <p className="dr-label">Action queue</p>
        <b>If called <small>{'->'}</small> Bet 65% pot</b>
        <em>On safe turn cards</em>
      </span>
      <button type="button">
        <b>Take action now</b>
        <small>Override agent decision</small>
      </button>
      <span className="dr-autoplay">
        <p className="dr-label">Autoplay</p>
        <i><b /></i>
        <em>Agent acts in 12s</em>
      </span>
    </div>
  );
}

function RecentActivity({ agent = null }) {
  const needsFunding = agent?.deployStatus === 'needs_funding';
  return (
    <section className="dr-panel">
      <div className="dr-section-head">
        <p className="dr-label">Recent activity</p>
      </div>
      {agent ? (
        <>
          <ActivityRow icon="sparkle" iconColor="#cdb380" title="Agent draft saved" subtitle={`${agent.style} style / ${agent.risk} risk`} amount="v1" />
          <ActivityRow
            icon={needsFunding ? 'chip' : 'agent'}
            iconColor={needsFunding ? '#cdb380' : '#00d4aa'}
            title={needsFunding ? 'Bankroll needed' : 'Ready for first table'}
            subtitle={needsFunding ? 'Add funds before deployment' : 'No hands played yet'}
          />
        </>
      ) : (
        <p className="dr-muted-copy">No activity until your first agent exists.</p>
      )}
    </section>
  );
}

function ActivityRow({ icon, iconColor, title, subtitle, amount }) {
  return (
    <div className="dr-activity-row">
      <span className="dr-tile-icon"><Icon name={icon} size={14} color={iconColor} /></span>
      <span><b>{title}</b><small>{subtitle}</small></span>
      {amount && <strong>{amount}</strong>}
    </div>
  );
}

function RecentHands({ compact = false }) {
  const hands = [
    ['Won vs Balanced v2.1', '+$340.00', '#00d4aa'],
    ['Won vs Bluff Master', '+$180.00', '#00d4aa'],
    ['Lost vs Value Bot', '-$120.00', '#ff4d4f'],
  ];
  return (
    <section className={compact ? 'dr-panel dr-panel--compact' : 'dr-panel'}>
      <div className="dr-section-head">
        <p className="dr-label">Recent hands</p>
      </div>
      {hands.map(([title, amount, color]) => (
        <div className="dr-hand-row" key={title}>
          <Icon name="spade" size={14} color="#a1a1a1" />
          <b>{title}</b>
          <span className="dr-card-pair"><PlayingCard rank="A" suit="s" mini /><PlayingCard rank="K" suit="h" mini /></span>
          <strong style={{ color }}>{amount}</strong>
        </div>
      ))}
    </section>
  );
}

function HistoryState({ agent, onCreate }) {
  return (
    <div className="dr-screen">
      <section className="dr-panel dr-empty-panel dr-full-empty">
        <Icon name="history" size={32} color={agent ? '#00d4aa' : '#6b6b6b'} />
        <h2>{agent ? 'No hands yet' : 'No history yet'}</h2>
        <p>{agent ? 'Deploy your agent to start recording hand history.' : 'Create an agent before there are sessions to review.'}</p>
        {!agent && <button className="dr-primary-btn" type="button" onClick={onCreate}>Create agent</button>}
      </section>
    </div>
  );
}

function ProfileState({ identity, agentCount, onReset }) {
  return (
    <div className="dr-screen">
      <section className="dr-panel dr-profile-card">
        <span className="dr-profile-avatar">{identity.name.slice(0, 1).toUpperCase()}</span>
        <p className="dr-label dr-label--accent">Telegram account</p>
        <h1>{identity.name}</h1>
        <small>{identity.handle}</small>
        <div className="dr-state-list">
          <span><Icon name="check" size={14} color="#00d4aa" /> Connected for this session</span>
          <span><Icon name="agent" size={14} color="#00d4aa" /> {agentCount} agent{agentCount === 1 ? '' : 's'} created</span>
          <span><Icon name="history" size={14} color="#cdb380" /> Reset preview to test first run</span>
        </div>
        <button className="dr-secondary-wide" type="button" onClick={onReset}>
          Reset first-run flow
        </button>
      </section>
    </div>
  );
}

function NavTabBar({ active, onChange, agentCount }) {
  const tabs = [
    ['home', 'home', 'Home'],
    ['create', 'plus', 'Create'],
    ['agents', 'agent', 'Agents'],
    ['history', 'history', 'History'],
    ['profile', 'profile', 'Profile'],
  ];

  return (
    <nav className="dr-nav">
      {tabs.map(([id, icon, label]) => (
        <button key={id} type="button" className={active === id ? 'is-active' : ''} onClick={() => onChange(id)}>
          <Icon name={icon} size={20} />
          <span>{label}</span>
          {id === 'agents' && agentCount > 0 && <i />}
        </button>
      ))}
    </nav>
  );
}

export default function DesignRefApp() {
  const identity = useMemo(() => telegramIdentity(getTelegramUser()), []);
  const [tab, setTab] = useState('home');
  const [profileStatus, setProfileStatus] = useState('loading');
  const [chatStatus, setChatStatus] = useState('idle');
  const [createdAgent, setCreatedAgent] = useState(null);
  const [profile, setProfile] = useState({
    userId: identity.id,
    hasAgents: false,
    agents: [],
    chat: INITIAL_CHAT,
  });

  const activeAgent = profile.agents[0] || null;

  useEffect(() => {
    let cancelled = false;
    setProfileStatus('loading');
    loadProfile(identity.id)
      .then((nextProfile) => {
        if (cancelled) return;
        const normalized = normalizeProfile(nextProfile);
        setProfile(normalized);
        setCreatedAgent(normalized.agents[0] || null);
        setProfileStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setProfileStatus('ready');
      });
    return () => { cancelled = true; };
  }, [identity.id]);

  async function handleSend(content) {
    const optimistic = {
      ...profile,
      chat: [...(profile.chat?.length ? profile.chat : INITIAL_CHAT), { role: 'user', content }],
    };
    setProfile(optimistic);
    setChatStatus('thinking');
    setTab('create');

    try {
      const nextProfile = await sendChatTurn(identity.id, content);
      const normalized = normalizeProfile(nextProfile);
      const nextAgent = normalizeAgent(nextProfile.createdAgent) || normalized.agents[0] || null;
      setProfile(normalized);
      if (nextAgent) setCreatedAgent(nextAgent);
    } catch {
      const nextProfile = fallbackChat(profile, content);
      setProfile(nextProfile);
      if (nextProfile.createdAgent) setCreatedAgent(nextProfile.createdAgent);
    } finally {
      setChatStatus('idle');
    }
  }

  async function handleReset() {
    try {
      const nextProfile = await resetProfile(identity.id);
      setProfile(normalizeProfile(nextProfile));
    } catch {
      setProfile({
        userId: identity.id,
        hasAgents: false,
        agents: [],
        chat: INITIAL_CHAT,
      });
    }
    setCreatedAgent(null);
    setChatStatus('idle');
    setTab('home');
  }

  function openCreate(seedPrompt) {
    setTab('create');
    if (typeof seedPrompt === 'string') handleSend(seedPrompt);
  }

  let screen;
  if (profileStatus === 'loading') screen = <LoadingState identity={identity} />;
  else if (tab === 'create') {
    screen = (
      <CreateAgentScreen
        identity={identity}
        profile={profile}
        chatStatus={chatStatus}
        createdAgent={createdAgent}
        onBack={() => setTab(activeAgent ? 'agents' : 'home')}
        onSend={handleSend}
        onOpenAgent={() => setTab('agents')}
      />
    );
  } else if (tab === 'agents') {
    screen = activeAgent
      ? <AgentViewScreen agent={activeAgent} onBack={() => setTab('home')} />
      : <AgentRoster onCreate={() => openCreate()} />;
  } else if (tab === 'history') screen = <HistoryState agent={activeAgent} onCreate={() => openCreate()} />;
  else if (tab === 'profile') screen = <ProfileState identity={identity} agentCount={profile.agents.length} onReset={handleReset} />;
  else {
    screen = activeAgent
      ? <ExistingHome identity={identity} agent={activeAgent} onCreate={() => openCreate()} onOpenAgent={() => setTab('agents')} />
      : <EmptyHome identity={identity} onCreate={openCreate} />;
  }

  return (
    <main className="dr-app" data-design-ref>
      <div className="dr-miniapp">
        <div className="dr-content">{screen}</div>
        <NavTabBar active={tab} onChange={setTab} agentCount={profile.agents.length} />
      </div>
    </main>
  );
}
