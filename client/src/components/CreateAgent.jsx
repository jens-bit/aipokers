import { useState, useEffect, useRef } from 'react';

const QUICK_CHIPS = [
  'Play tight and safe',
  'Bluff a lot',
  'Exploit weak players',
  'Balanced strategy',
];

export function CreateAgent({ onBack, onDeploy }) {
  const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || 'anon';

  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`/api/agent-profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        setChat(data.chat || []);
        if (data.agents?.length > 0) setCreatedAgent(data.agents[data.agents.length - 1]);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setChat((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: msg }),
      });
      const data = await res.json();
      setChat(data.chat || []);
      if (data.createdAgent) setCreatedAgent(data.createdAgent);
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  const showChips = ready && !loading && chat.length <= 1;

  return (
    <div className="create-agent">
      <div className="create-agent__header">
        <button type="button" className="play__back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <span className="create-agent__title">Agent Creator</span>
      </div>

      <div className="create-agent__chat">
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

        {showChips && (
          <div className="create-agent__chips">
            {QUICK_CHIPS.map((chip) => (
              <button key={chip} type="button" className="create-agent__chip" onClick={() => send(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="create-agent__footer">
        {createdAgent && (
          <div className="create-agent__deploy-wrap">
            <div className="create-agent__agent-name">{createdAgent.name}</div>
            <button type="button" className="create-agent__deploy-btn" onClick={() => onDeploy(createdAgent)}>
              Deploy
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}

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
