import { useEffect, useRef, useState } from 'react';

// Compact in-game chat. Renders a scrollable message list and a single-line
// input. Used by both seated players and spectators.
export function ChatBar({ messages = [], onSend }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  // Auto-scroll to the newest message whenever the list grows.
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
          <div className="chat-bar__empty">Say something to your opponent…</div>
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
        <button className="chat-bar__send" type="submit" disabled={!text.trim()}>
          SEND
        </button>
      </form>
    </div>
  );
}
