import { useState, useEffect, useRef } from 'react';
import { getUserId } from '../lib/telegram.js';

const QUICK_CHIPS = [
  'Play tight and safe',
  'Bluff a lot',
  'Exploit weak players',
  'Balanced strategy',
];

// Extract 2-3 contextual reply chips from an assistant message.
// Looks for "A, B, or C" / "A or B" patterns; falls back to generic options.
function extractChips(text) {
  if (!text) return ['More aggressive', 'More conservative'];
  const triple = text.match(/\b([\w][^,?!]{1,22}),\s*([\w][^,?!]{1,22}),?\s+or\s+([\w][^?!.]{1,22})/i);
  if (triple) {
    return [triple[1].trim(), triple[2].trim(), triple[3].replace(/[?!.\s]+$/, '').trim()]
      .filter((s) => s.length >= 2 && s.length <= 30);
  }
  const pair = text.match(/\b([\w][^?!,]{1,22})\s+or\s+([\w][^?!.]{1,22})/i);
  if (pair) {
    return [pair[1].trim(), pair[2].replace(/[?!.\s]+$/, '').trim()]
      .filter((s) => s.length >= 2 && s.length <= 30);
  }
  return ['More aggressive', 'More conservative'];
}

export function CreateAgent({ onBack, onDone, agentName = null, existingAgent = null }) {
  const userId = getUserId();

  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [chips, setChips] = useState(QUICK_CHIPS);
  const chatRef = useRef(null);

  useEffect(() => {
    // Always reset server-side chat first.
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
        } else {
          return fetch(`/api/agent-profile?userId=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then((data) => setChat(data.chat || []));
        }
      })
      .catch(() => {
        if (existingAgent) {
          setChat([{
            role: 'assistant',
            content: `You're editing ${existingAgent.name}. What would you like to change?`,
          }]);
        }
      });
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, loading]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setChips([]);
    setChat((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: msg, existingAgentId: existingAgent?.id ?? null }),
      });
      const data = await res.json();
      const serverChat = data.chat || [];

      if (existingAgent) {
        // Edit mode: append only the new AI reply — don't replace the context bubble.
        const newAiMsg = serverChat.filter((m) => m.role === 'assistant').pop();
        if (newAiMsg) setChat((prev) => [...prev, newAiMsg]);
      } else {
        setChat(serverChat);
      }

      if (data.createdAgent) {
        setCreatedAgent(data.createdAgent);
        setChips([]);
      } else {
        const lastAi = serverChat.filter((m) => m.role === 'assistant').pop();
        setChips(lastAi ? extractChips(lastAi.content) : QUICK_CHIPS);
      }
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }]);
      setChips(QUICK_CHIPS);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  const displayName = agentName || existingAgent?.name || null;

  return (
    <div className="create-agent">
      <div className="create-agent__header">
        <button type="button" className="play__back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <span className="create-agent__title">
          AGENT CREATOR
          {displayName && <span className="create-agent__agent-label"> · {displayName}</span>}
        </span>
      </div>

      <div className="create-agent__chat" ref={chatRef}>
        {chat.map((msg, i) => (
          <div key={i} className={`create-agent__msg create-agent__msg--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="create-agent__avatar" aria-hidden>
                <SpadeIcon />
              </div>
            )}
            <div className="create-agent__bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="create-agent__msg create-agent__msg--assistant">
            <div className="create-agent__avatar" aria-hidden>
              <SpadeIcon />
            </div>
            <div className="create-agent__bubble create-agent__bubble--loading">
              <span className="create-agent__dots"><span /><span /><span /></span>
            </div>
          </div>
        )}
      </div>

      {chips.length > 0 && !createdAgent && !loading && (
        <div className="create-agent__chips-bar">
          {chips.map((chip) => (
            <button key={chip} type="button" className="create-agent__chip" onClick={() => send(chip)}>
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="create-agent__footer">
        {createdAgent && (
          <div className="create-agent__deploy-wrap">
            <div className="create-agent__agent-name">{createdAgent.name} is ready</div>
            <button type="button" className="create-agent__deploy-btn" onClick={() => onDone()}>
              Go to Agents
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}

        {!createdAgent && (
          <form className="create-agent__input-row" onSubmit={handleSubmit}>
            <input
              className="create-agent__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your playstyle…"
              disabled={loading}
            />
            <button type="submit" className="create-agent__send" disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SpadeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 100 100" fill="var(--accent)" stroke="none" aria-hidden>
      <path d="M50 5 C50 5, 10 38, 10 58 C10 72 20 80 35 78 C32 85 27 90 20 93 L80 93 C73 90 68 85 65 78 C80 80 90 72 90 58 C90 38 50 5 50 5Z" />
    </svg>
  );
}
