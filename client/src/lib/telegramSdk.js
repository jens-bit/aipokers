// BUG-191: load the SDK without blocking the document/first loading frame.
// Its settlement, not a timeout or a guessed launch URL, gates owner selection.
//
// BUG-191/187: the tag now lives in client/index.html so the request starts at
// parse time, behind a preconnect, rather than after this module has been
// downloaded and evaluated — on a cold entry almost the whole cost of the SDK
// is DNS + TCP + TLS to a third party, and that handshake now overlaps the
// rest of the load. Two consequences for the code below:
//
//   · The script may have ALREADY settled before this runs, which could not
//     happen while the tag was created here. Its inline handlers stamp
//     'settled' for exactly that case; adopting a finished script and waiting
//     for a load event that has already fired would wait forever.
//   · This function still creates the tag when there isn't one, so the dev
//     server, the unit suite and any host that serves its own HTML behave as
//     they did.
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
