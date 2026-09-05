import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LoginGate from './components/LoginGate.jsx';
import { initTelegram, isMiniAppSession, getWebLogin } from './lib/telegram.js';
import './styles/index.css';

// AUTH-1 — two ways in: the Telegram Mini App (initData) and the web Login
// Widget (LoginGate). On the production domain a visitor with neither still
// lands on the marketing page, unless they arrived via its "log in" link
// (/?login=1), which is what asks for the widget.
const hasStoredLogin = getWebLogin() != null;
const wantsLogin = new URLSearchParams(window.location.search).has('login');

if (
  window.location.hostname === 'agenticpoker.app' &&
  !window.Telegram?.WebApp?.initData &&
  !hasStoredLogin &&
  !wantsLogin
) {
  window.location.replace('/welcome');
} else {
  initTelegram();
  const tree = isMiniAppSession() ? <App /> : <LoginGate><App /></LoginGate>;
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {tree}
    </StrictMode>
  );
}
