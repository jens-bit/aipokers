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
import { useEffect, useRef, useState } from 'react';
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
  const openRef = useRef(onOpenThread);
  openRef.current = onOpenThread;

  // WATCH-7: the swipe did not work, on a phone or on a desk.
  //
  // v6 listened for React's onPointerMove on the composer alone. Two things
  // broke it. On touch, the composer had no `touch-action` of its own, so the
  // browser claimed a vertical drag as a page pan and sent `pointercancel`
  // before it had travelled 28px — the gesture was cancelled by the platform,
  // not missed by the code. And on a desk, a drag that left the composer (which
  // 28px upwards very often does — the composer is 44px tall) stopped
  // delivering moves to it at all, because a mouse has no implicit capture.
  //
  // So: the move and the release are tracked on the WINDOW for the life of the
  // drag, both touch and mouse are handled explicitly rather than through the
  // pointer abstraction that was being cancelled, and `touch-action: none` on
  // the composer (watch6.css) stops the platform stealing the gesture in the
  // first place.
  const [dragging, setDragging] = useState(false);

  function submit(e) {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }

  // A drag that starts in the text field is the caret being placed, never a
  // swipe. Everything else on the composer is fair game.
  function begin(y, target) {
    if (target && target.tagName === 'INPUT') { gesture.current = null; return; }
    gesture.current = { y, fired: false };
    setDragging(true);
  }

  function move(y) {
    const g = gesture.current;
    if (!g || g.fired) return;
    if (g.y - y > SWIPE_PX) {
      g.fired = true;
      if (openRef.current) openRef.current();
    }
  }

  function end() {
    gesture.current = null;
    setDragging(false);
  }

  useEffect(() => {
    if (!dragging) return undefined;
    const onMouseMove = (e) => move(e.clientY);
    const onTouchMove = (e) => { if (e.touches && e.touches[0]) move(e.touches[0].clientY); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [dragging]);

  return (
    <div className="watch-composer"
      onMouseDown={(e) => begin(e.clientY, e.target)}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) begin(e.touches[0].clientY, e.target);
      }}
      // The window listeners above own the drag once it starts; these keep the
      // gesture alive for anything that only ever delivers moves to the element
      // it started on.
      onMouseMove={(e) => move(e.clientY)}
      onTouchMove={(e) => { if (e.touches && e.touches[0]) move(e.touches[0].clientY); }}
    >
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

      {/* WATCH-7 made the hint a control instead of a line of dead text.
          BUGS-A job 6 finishes the job by deleting the words.
          "SWIPE UP FOR THE THREAD" was instructions for a gesture, printed
          under the one screen where a swipe up is the platform's own — inside
          Telegram it is what closes the Mini App, so the app was teaching a
          gesture that took the owner out of it. disableVerticalSwipes (see
          lib/telegram.js) stops Telegram claiming it, but a caption telling a
          phone user to swipe is a caption admitting the control is not
          obvious. So the control is all that is left: a chevron, and tapping
          it opens the thread. The swipe still works for anyone who finds it.
          The composer's own send button is untouched — this is beside it, not
          instead of it. */}
      <button type="button" className="watch-composer__hint" onClick={onOpenThread}
        aria-label="Open the thread">
        <svg className="watch-composer__chevron" width="22" height="12" viewBox="0 0 16 9"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden>
          <path d="M2 7l6-5 6 5" />
        </svg>
      </button>
    </div>
  );
}
