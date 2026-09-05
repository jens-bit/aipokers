// AUTH-1 — the second auth door, for browsers that are not the Mini App.
//
// Renders the Telegram Login Widget; Telegram calls back with a signed payload
// which we store and replay as x-telegram-init-data on every request. The
// server verifies it with the widget signature scheme (see src/server/auth.js).
// Once a login is stored, this component is a pass-through to `children`.
//
// FTU-2 — the door is the first screen of the first five minutes, so it is a
// screen rather than a card in the middle of nothing: the room on one side, the
// proposition on the other, and one way in. Port of D5FtuLoginScreenM from
// design-refs/mood-ftu2.jsx. Styles in styles/ftu.css.

import { useEffect, useRef, useState } from 'react';
import { getWebLogin, setWebLogin, clearWebLogin, getTelegramInitData } from '../lib/telegram.js';

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const AUTH_CALLBACK = '__agenticTelegramAuth';

export default function LoginGate({ children }) {
  // 'checking' → asking the server | 'in' → authenticated | 'out' → show widget
  const [phase, setPhase] = useState('checking');
  const [botUsername, setBotUsername] = useState(null);   // null = not loaded yet
  const slotRef = useRef(null);

  // One question answers both cases: does the server accept what this browser
  // already has? A stored login may be expired (auth_date past the server's
  // window) or signed by a rotated bot token; and a dev server with no
  // TELEGRAM_BOT_TOKEN accepts everything, which is how localhost keeps
  // working without a login at all.
  useEffect(() => {
    if (phase !== 'checking') return;
    let cancelled = false;
    const hadLogin = getWebLogin() != null;
    fetch('/api/auth/me', { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) return setPhase('in');
        if (hadLogin) clearWebLogin();          // expired session
        setPhase('out');
      })
      // Network error: keep an existing session rather than logging the user
      // out on a blip; the server is the real gate on every later request.
      .catch(() => { if (!cancelled) setPhase(hadLogin ? 'in' : 'out'); });
    return () => { cancelled = true; };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'out') return;
    let cancelled = false;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : { botUsername: '' }))
      .then((d) => { if (!cancelled) setBotUsername((d?.botUsername || '').replace(/^@/, '')); })
      .catch(() => { if (!cancelled) setBotUsername(''); });
    return () => { cancelled = true; };
  }, [phase]);

  // Inject the widget script. Telegram evaluates data-onauth as an expression,
  // so the callback has to live on window.
  useEffect(() => {
    if (phase !== 'out' || !botUsername || !slotRef.current) return;
    window[AUTH_CALLBACK] = (user) => {
      setWebLogin(user);
      setPhase('in');
    };
    const s = document.createElement('script');
    s.src = WIDGET_SRC;
    s.async = true;
    s.setAttribute('data-telegram-login', botUsername);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-onauth', `${AUTH_CALLBACK}(user)`);
    const slot = slotRef.current;
    slot.appendChild(s);
    return () => { slot.replaceChildren(); };
  }, [phase, botUsername]);

  if (phase === 'in') return children;

  const settling = phase === 'checking' || botUsername === null;

  return (
    <div className="ftu-login">
      {/* The room, before he has anybody in it. Lit, open, and holding a seat —
          the same dashed rim the floor's own stool wears. */}
      <div className="ftu-login__room">
        <div className="ftu-login__glow" />
        <div className="ftu-login__seat">
          <div className="ftu-login__stool" />
          <span className="ftu-login__seat-label">ONE OPEN SEAT</span>
        </div>
      </div>

      <div className="ftu-login__pitch">
        <h1 className="ftu-login__head">There is a room,<br />and an open seat<br />in it.</h1>
        <p className="ftu-login__body">
          You will not be playing. You hire someone, tell him how to play, and he sits
          down without you — tonight, and every night after, whether you are watching
          or not.
        </p>

        <div className="ftu-login__action">
          {/* The widget is the primary action, so it stands where one goes. It
              renders itself; until Telegram has answered, the slot holds its
              place rather than the screen changing shape underneath it. */}
          <div ref={slotRef} style={S.slot} />
          {settling && <div className="ftu-login__foot">One moment…</div>}
          {!settling && botUsername === '' && (
            <div className="ftu-login__error">
              Web login is not configured on this server. Open the Mini App from
              Telegram instead.
            </div>
          )}
        </div>

        <div className="ftu-login__foot">$500 SEEDED ON SIGN-UP</div>
      </div>
    </div>
  );
}

// The widget injects itself into this slot and brings its own styling; all it
// needs is somewhere to stand that does not collapse before it arrives.
const S = { slot: { minHeight: 48 } };
