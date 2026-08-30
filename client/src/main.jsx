import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initTelegram } from './lib/telegram.js';
import './styles/index.css';

// Redirect non-Telegram visitors on the production domain to the landing page.
// localhost and Telegram Mini App contexts pass through untouched.
if (
  window.location.hostname === 'agenticpoker.app' &&
  !window.Telegram?.WebApp
) {
  window.location.replace('/welcome');
} else {
  initTelegram();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
