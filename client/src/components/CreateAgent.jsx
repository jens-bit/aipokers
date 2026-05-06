import { useEffect, useRef, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

const QUICK_PROMPTS = [
  'Balanced heads-up player',
  'Tight, low-risk grinder',
  'Aggressive pressure agent',
];

function inferDraft(prompt) {
  const lower = (prompt || '').toLowerCase();
  const aggressive = /\b(aggro|aggressive|pressure|bluff|attack)\b/.test(lower);
  const tight = /\b(tight|safe|conservative|careful|low risk|low-risk)\b/.test(lower);
  if (aggressive) return { name: 'Pressure v1', style: 'Aggressive', risk: 'High' };
  if (tight)      return { name: 'Sentinel v1', style: 'Tight',      risk: 'Low' };
  return                  { name: 'Balanced v1', style: 'Balanced',   risk: 'Medium' };
}

function lastUser(chat) {
  return [...chat].reverse().find((m) => m.role === 'user')?.content || '';
}

export function CreateAgent({ onBack, onDone, onDeploy, agentName = null, existingAgent = null }) {
  const userId = getUserId();

  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [localAgent, setLocalAgent] = useState(existingAgent);
  const logRef = useRef(null);

  const userTurns = chat.filter((m) => m.role === 'user').length;
  const canCreateDraft = !createdAgent && !loading && !building && userTurns >= 2;
  const activeAgentId = localAgent?.id ?? null;
  const subtitle = agentName || localAgent?.name || createdAgent?.name || 'Build agent v1';

  // Reset server chat history on mount so we don't pick up stale turns from a
  // previous session, then either prime an edit context or load the live chat.
  useEffect(() => {
    fetch('/api/agents/chat/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(() => {
        if (existingAgent) {
          setChat([{
            role: 'assistant',
            content: `You're editing ${existingAgent.name}. Currently: ${existingAgent.style}, ${existingAgent.risk} risk. Tell me what you'd like to change.`,
          }]);
          return null;
        }
        return fetch(`/api/agent-profile?userId=${encodeURIComponent(userId)}`)
          .then((r) => r.json())
          .then((data) => setChat(data.chat || []));
      })
      .catch(() => {
        if (existingAgent) {
          setChat([{ role: 'assistant', content: `You're editing ${existingAgent.name}. What would you like to change?` }]);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, loading, createdAgent]);

  async function send(content = draft) {
    const text = content.trim();
    if (!text || loading || building) return;
    setDraft('');
    setLoading(true);
    setChat((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: text, existingAgentId: activeAgentId }),
      });
      const data = await res.json();
      const serverChat = data.chat || [];
      // In edit mode the user wants the original "you're editing X" bubble
      // preserved at the top, so only append the latest assistant reply.
      if (existingAgent || localAgent) {
        const newAi = serverChat.filter((m) => m.role === 'assistant').pop();
        if (newAi) setChat((prev) => [...prev, newAi]);
      } else {
        setChat(serverChat);
      }
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function build() {
    if (building || loading) return;
    setBuilding(true);
    try {
      const res = await fetch('/api/agents/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, existingAgentId: activeAgentId }),
      });
      const data = await res.json();
      if (data.createdAgent) setCreatedAgent(data.createdAgent);
    } catch {
      // user can retry
    } finally {
      setBuilding(false);
    }
  }

  function keepTuning() {
    if (!createdAgent) return;
    setLocalAgent(createdAgent);
    setChat((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `${createdAgent.name} updated. Currently: ${createdAgent.style}, ${createdAgent.risk} risk. Keep going — what else would you change?`,
      },
    ]);
    setCreatedAgent(null);
  }

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--chat">
        <header className="dr-chat-header">
          <button className="dr-plain-button" type="button" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </button>
          <div>
            <p className="dr-label dr-label--accent">Create agent</p>
            <h1>{subtitle}</h1>
            <small>Chat to shape the strategy. We save it as version one once you're happy.</small>
          </div>
        </header>

        <div className="dr-chat-log" ref={logRef}>
          {chat.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={`dr-chat-message dr-chat-message--${msg.role}`}>
              <span>{msg.content}</span>
            </div>
          ))}
          {loading && (
            <div className="dr-chat-message dr-chat-message--assistant">
              <span className="dr-typing"><i /><i /><i /></span>
            </div>
          )}
        </div>

        {createdAgent && (
          <CreatedAgentCard
            agent={createdAgent}
            deploying={deploying}
            onDeploy={async () => {
              if (deploying) return;
              setDeploying(true);
              try {
                if (onDeploy) await onDeploy(createdAgent);
                else if (onDone) onDone();
              } finally {
                setDeploying(false);
              }
            }}
            onKeepTuning={keepTuning}
          />
        )}

        {!createdAgent && canCreateDraft && (
          <DraftReadyCard
            inferred={inferDraft(lastUser(chat))}
            onCreate={build}
            onKeepTuning={() => setDraft('Tune the agent for bankroll discipline and river decisions')}
            building={building}
          />
        )}

        {!createdAgent && !canCreateDraft && !loading && (
          <div className="dr-chat-suggestions">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)} disabled={loading || building}>
                {prompt}
              </button>
            ))}
          </div>
        )}

        {!createdAgent && (
          <form
            className="dr-chat-input"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Describe the agent you want"
              disabled={loading || building}
            />
            <button type="submit" disabled={!draft.trim() || loading || building} aria-label="Send">
              <SendIcon />
            </button>
          </form>
        )}
      </div>
    </div>
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

function CreatedAgentCard({ agent, deploying, onDeploy, onKeepTuning }) {
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
      <div className="dr-blueprint-grid">
        <BlueprintCell label="Style" value={agent.style || 'Balanced'} />
        <BlueprintCell label="Risk" value={agent.risk || 'Medium'} />
        <BlueprintCell label="Table" value="HU NLH" />
      </div>
      {agent.strategy && <p>{agent.strategy}</p>}
      <div className="dr-readiness-list">
        <span><CheckIcon color="#00d4aa" /> Strategy saved</span>
        <span><CheckIcon color="#00d4aa" /> Table profile selected</span>
      </div>
      <div className="dr-card-actions">
        <button
          className="dr-primary-btn"
          type="button"
          onClick={onDeploy}
          disabled={deploying}
        >
          {deploying ? 'Deploying…' : 'Deploy now'}
        </button>
        <button className="dr-secondary-btn" type="button" onClick={onKeepTuning} disabled={deploying}>
          Keep tuning
        </button>
      </div>
    </section>
  );
}

function DraftReadyCard({ inferred, onCreate, onKeepTuning, building }) {
  return (
    <section className="dr-draft-ready-card">
      <div>
        <span><SparkleIcon /></span>
        <div>
          <p className="dr-label dr-label--accent">Draft ready</p>
          <h2>{inferred.name}</h2>
          <small>{inferred.style} style / {inferred.risk} risk</small>
        </div>
      </div>
      <p>I have enough to save this as version one. You can still tune it after creation.</p>
      <div className="dr-card-actions">
        <button className="dr-primary-btn" type="button" onClick={onCreate} disabled={building}>
          {building ? 'Saving…' : 'Create this agent'}
        </button>
        <button className="dr-secondary-btn" type="button" onClick={onKeepTuning} disabled={building}>
          Keep tuning
        </button>
      </div>
    </section>
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

function ArrowLeft() {
  return (
    <svg className="dr-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="dr-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function CheckIcon({ color = 'currentColor' }) {
  return (
    <svg className="dr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="dr-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    </svg>
  );
}
