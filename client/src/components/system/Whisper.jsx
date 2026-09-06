// WATCH v6 — chat as a WHISPER.
// Port of design-refs/mood-watch5.jsx `V5Composer` / `V5Whisper`.
//
// "AND THE FELT IS THE SCREEN. Nothing below it but the composer." What you say
// to him is not a chat message in a log — it is a whisper: a pale bubble that
// rises from the bottom edge and is gone in four seconds. His reply is his
// normal bubble, over his head, because he is the one performing.
//
// The composer is also the way into the thread: swipe up from it (or tap his
// face) and the glass sheet comes over the lower felt.
import { useRef, useState } from 'react';
import { Glass } from './Glass.jsx';

// How long a sent whisper lives on the felt. The keyframes in watch.css run for
// exactly this long, so the node is unmounted as it finishes fading rather than
// sitting there invisible.
export const WHISPER_MS = 4000;

// A drag this far up the composer opens the thread. Short enough to be a flick,
// long enough that a tap into the field never triggers it.
const SWIPE_PX = 28;

export function Whisper({ text }) {
  return (
    <div className="watch-whisper" aria-hidden>
      <div className="watch-whisper__box">{text}</div>
    </div>
  );
}

export function WhisperComposer({ onSend, onOpenThread, disabled, agentName }) {
  const [text, setText] = useState('');
  const gesture = useRef(null);

  function submit(e) {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }

  function onPointerDown(e) {
    if (e.target && e.target.tagName === 'INPUT') { gesture.current = null; return; }
    gesture.current = { y: e.clientY, fired: false };
  }
  function onPointerMove(e) {
    const g = gesture.current;
    if (!g || g.fired) return;
    if (g.y - e.clientY > SWIPE_PX) { g.fired = true; if (onOpenThread) onOpenThread(); }
  }
  function onPointerUp() { gesture.current = null; }

  return (
    <div className="watch-composer"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <form onSubmit={submit}>
        <Glass className="watch-composer__pill">
          <input
            className="watch-composer__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Whisper to him…"
            aria-label={agentName ? `Whisper to ${agentName}` : 'Whisper to him'}
            maxLength={280}
            disabled={disabled}
          />
          <button type="button" className="watch-composer__thread" onClick={onOpenThread}
            aria-label="Open the thread">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
          <button type="submit" className="watch-composer__send" disabled={!text.trim() || disabled}
            aria-label="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </Glass>
      </form>
      <div className="watch-composer__hint">SWIPE UP FOR THE THREAD</div>
    </div>
  );
}
