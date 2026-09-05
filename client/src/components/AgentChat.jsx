import { useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { openerFor } from './desktop/useAgentThread.js';

export function AgentChat({ agent, onBack, onDeploy, onReady }) {
  const userId = getUserId();
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    fetch(`/api/agents/${encodeURIComponent(agent.id)}/hands?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then(() => {
        // WIRE-1 / RAISE-2: his opener, written by the server. The hands are
        // fetched for the review sheet, never to compose a greeting out of.
        setChat([{ role: 'assistant', content: openerFor(agent) }]);
      })
      .catch(() => {
        setChat([{ role: 'assistant', content: openerFor(agent) }]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, loading]);

  async function send(content = draft) {
    const text = content.trim();
    if (!text || loading) return;
    setDraft('');
    setLoading(true);
    setChat((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: text, existingAgentId: agent.id }),
      });
      const data = await res.json();
      const serverChat = data.chat || [];
      const newAi = serverChat.filter((m) => m.role === 'assistant').pop();
      if (newAi) setChat((prev) => [...prev, newAi]);
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  // Lets a host surface (the desktop composer) send into this conversation.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    onReady?.((text) => sendRef.current(text));
    return () => onReady?.(null);
  }, [onReady]);

  // WIRE-1: sniffing the greeting for a prefix only worked while the client
  // wrote it. What the affordance actually means is "he has just played", which
  // the record says outright.
  const hasSessionRecap = chat.length === 1 && chat[0].role === 'assistant' &&
    (!!agent?.opener || !!agent?.sessionRecap);

  return (
    <div className="dr-app">
      <div className="dr-screen dr-screen--chat">
        <header className="dr-agent-header">
          <button className="dr-plain-button" type="button" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </button>
          <div>
            <p className="dr-label dr-label--accent">Chat</p>
            <h1>{agent.name}</h1>
          </div>
          <span />
          <button
            className="dr-primary-btn"
            type="button"
            onClick={() => onDeploy(agent)}
            style={{ fontSize: 12, padding: '6px 10px', minHeight: 32 }}
          >
            Deal him in
          </button>
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

        {hasSessionRecap && !loading && (
          <div className="dr-chat-suggestions">
            <button type="button" onClick={() => send('Review last session')} disabled={loading}>
              Review last session
            </button>
            <button type="button" onClick={() => send('Adjust strategy')} disabled={loading}>
              Adjust strategy
            </button>
          </div>
        )}

        <form
          className="dr-chat-input"
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message your agent"
            disabled={loading}
          />
          <button type="submit" disabled={!draft.trim() || loading} aria-label="Send">
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
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
