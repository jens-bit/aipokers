// AUTH-1 — the second auth door, for browsers that are not the Mini App.
//
// Renders the Telegram Login Widget; Telegram calls back with a signed payload
// which we store and replay as x-telegram-init-data on every request. The
// server verifies it with the widget signature scheme (see src/server/auth.js).
// Once a login is stored, this component is a pass-through to `children`.

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

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>Agentic Poker</div>
        {phase === 'checking' ? (
          <div style={S.note}>Checking your session…</div>
        ) : botUsername === null ? (
          <div style={S.note}>Loading…</div>
        ) : botUsername === '' ? (
          <div style={S.note}>Web login not configured.</div>
        ) : (
          <>
            <div style={S.lede}>Sign in with Telegram to reach your agents.</div>
            <div ref={slotRef} style={S.slot} />
          </>
        )}
      </div>
    </div>
  );
}

// Marketing palette (tokens.css) — this sits on the same background as the
// landing page, not inside the product UI.
const S = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'radial-gradient(ellipse 70% 50% at 50% 0%, var(--marketing-bg-highlight) 0%, var(--marketing-bg-depth) 34%, var(--marketing-bg) 78%)',
    color: 'var(--marketing-text)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
    textAlign: 'center',
    maxWidth: 360,
  },
  brand: {
    fontFamily: 'var(--font-display)',
    fontSize: 34,
    lineHeight: 1.1,
    color: 'var(--marketing-gold-highlight)',
  },
  lede: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--marketing-text-secondary)',
  },
  note: {
    fontFamily: 'var(--font-label)',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--marketing-text-secondary)',
  },
  slot: { minHeight: 48 },
};
