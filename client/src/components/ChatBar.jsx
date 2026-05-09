import { useEffect, useRef, useState } from 'react';

export function ChatBar({ messages = [], onSend }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function submit(e) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
  }

  return (
    <div className="chat-bar">
      <div ref={listRef} className="chat-bar__list">
        {messages.length === 0 ? (
          <div className="chat-bar__empty">No messages yet…</div>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.t ?? i}-${i}`}
              className={`chat-bar__msg${m.isAI ? ' chat-bar__msg--ai' : ''}`}
            >
              <span className="chat-bar__name">{m.displayName || `Seat ${m.seat}`}</span>
              <span className="chat-bar__text">{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-bar__form" onSubmit={submit}>
        <input
          className="chat-bar__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          maxLength={280}
          aria-label="Chat message"
        />
        <button className="chat-bar__send" type="submit" disabled={!text.trim()} aria-label="Send">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
