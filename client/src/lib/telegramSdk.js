// BUG-191: load the SDK without blocking the document/first loading frame.
// Its settlement, not a timeout or a guessed launch URL, gates owner selection.
let pending;
export function loadTelegramSdk() {
  // The SDK also exists in ordinary browsers. This only means it has loaded;
  // telegram.js still decides authentication from the real initData afterward.
  if (window.Telegram?.WebApp) return null;
  if (pending) return pending;
  let script = document.querySelector('script[data-railbird-telegram]');
  if (script?.dataset.railbirdTelegram === 'settled') return null;
  const existing = !!script;
  script ??= document.createElement('script');
  pending = new Promise(resolve => {
    const settle = () => {
      script.dataset.railbirdTelegram = 'settled';
      script.removeEventListener('load', settle);
      script.removeEventListener('error', settle);
      resolve();
    };
    script.addEventListener('load', settle);
    script.addEventListener('error', settle);
  });
  if (!existing) {
    script.dataset.railbirdTelegram = 'pending';
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    document.head.appendChild(script);
  }
  return pending;
}
