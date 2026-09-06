// client/src/components/guest/ClaimWall.jsx — GUEST-1 job 4 (G4)
//
// "Keep him."
//
// The one screen a guest is ever asked anything by. It rises once, after his
// first casino session ends, and again whenever the server refuses something
// with `claim: true` — the room composer, the whisper, a second agent, a
// second night. One wall for all of them, because they all have the same
// answer and a product that asks the same question five different ways is a
// product that reads as five different nag screens.
//
// ── WHAT IS ON IT, AND WHY IN THIS ORDER ────────────────────────────────────
//
//   1. HIS FACE AND HIS NAME, first and biggest. The thing being kept is a
//      character, not an account, and the ask only works if he is on it.
//   2. WHAT HE JUST DID. The session line — what he won or lost, over how many
//      hands. It is the evidence for the ask, and it is real: it comes off the
//      SESSION_END that raised the wall.
//   3. THE THREE LIMITS, as three lines, said plainly. Not "upgrade for more"
//      — the actual shape of what he has: one agent, one night a day, and he
//      cannot be spoken to. A limit stated honestly is an argument; a limit
//      implied is a dark pattern.
//   4. AND HE IS FORGOTTEN AFTER 30 DAYS. The real cost of not deciding, said
//      once, without dressing it up.
//   5. The two ways to keep him, and the way out.
//
// THE WAY OUT IS ALWAYS THERE. "keep playing as a guest" is a real button that
// really closes the wall, on every route into it. A wall with no way past it
// is not a wall, it is a paywall, and the whole point of this tree is that the
// landing IS the game.
//
// GOOGLE IS NOT BUILT. The button is drawn, disabled, and says "soon" — the
// brief's instruction, and the honest way to show that the choice is coming
// without pretending it is here.
//
// Ported against design-refs/mood-birth3.jsx and mood-sit.jsx's sheet glass —
// the same risen-panel language every other sheet in the product uses. There
// is no guest board in design-refs (the refs stop at wave 56 / board 40), so
// nothing here is a redrawing of one: it is assembled from the existing atoms.

import { useEffect, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { guestDeepLink, claimGuest } from '../../lib/guest.js';
import { getTelegramInitData, isMiniAppSession } from '../../lib/telegram.js';
import '../../styles/guest.css';

/** "+$1,240" / "-$310" — the same signed money the room's arrival line uses. */
export function signedMoney(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '+';
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`;
}

/**
 * The one sentence about the night that just happened, or null.
 *
 * Null rather than a placeholder: the wall can be raised by a refusal, with no
 * session behind it, and inventing "he played 0 hands" for that would be a
 * fact the screen made up.
 */
export function resultLine(arrival) {
  if (!arrival) return null;
  const hands = Number(arrival.hands) || 0;
  if (hands <= 0) return signedMoney(arrival.net);
  return `${signedMoney(arrival.net)} over ${hands} hand${hands === 1 ? '' : 's'}`;
}

const LIMITS = [
  'One agent.',
  'One night at the casino a day.',
  'And you cannot talk to him.',
];

export function ClaimWall({ agent, arrival, reason = 'claim', onClose, onClaimed }) {
  const [link, setLink] = useState(undefined);   // undefined = still asking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The deep link is built server-side (the page cannot read the httpOnly
  // token). Asked once, when the wall opens.
  useEffect(() => {
    let cancelled = false;
    guestDeepLink().then((url) => { if (!cancelled) setLink(url); });
    return () => { cancelled = true; };
  }, []);

  // Inside Telegram the claim needs no link at all — the credential is already
  // in the page, so the button IS the claim.
  const insideTelegram = isMiniAppSession();

  async function keepHim() {
    if (busy) return;
    if (!insideTelegram) {
      if (link) window.location.href = link;
      return;
    }
    setBusy(true);
    setError(null);
    const out = await claimGuest(getTelegramInitData());
    setBusy(false);
    if (out.ok) onClaimed?.(out);
    else setError('That did not go through. Try again.');
  }

  const line = resultLine(arrival);
  const name = agent?.name || 'He';

  return (
    <div className="claim-wall" role="dialog" aria-modal="true" aria-label="Keep him">
      <div className="claim-wall__sheet">
        <h2 className="claim-wall__head">Keep him</h2>

        <div className="claim-wall__face">
          <MoodGhost
            mood={moodOf(agent)}
            heat={heatOf(agent)}
            size={92}
            ring={false}
          />
        </div>
        <div className="claim-wall__name">{name}</div>
        {line && <div className="claim-wall__result">{line}</div>}

        <ul className="claim-wall__limits">
          {LIMITS.map((text) => <li key={text} className="claim-wall__limit">{text}</li>)}
        </ul>
        <p className="claim-wall__forgotten">And he is forgotten after 30 days.</p>

        <div className="claim-wall__actions">
          <button
            type="button"
            className="claim-wall__btn claim-wall__btn--primary"
            onClick={keepHim}
            disabled={busy || (!insideTelegram && link === null)}
          >
            {busy ? 'KEEPING HIM…' : 'CONTINUE IN TELEGRAM'}
          </button>

          {/* Drawn, disabled, and honest about it. */}
          <button type="button" className="claim-wall__btn" disabled>
            CONTINUE WITH GOOGLE
            <span className="claim-wall__soon">soon</span>
          </button>

          {error && <p className="claim-wall__error">{error}</p>}
          {!insideTelegram && link === null && (
            <p className="claim-wall__error">
              Keeping him is not set up on this server yet.
            </p>
          )}
        </div>

        <button type="button" className="claim-wall__out" onClick={onClose}>
          keep playing as a guest
        </button>
      </div>
      {/* The reason is not printed — every route into this wall gets the same
          screen, deliberately — but it rides the DOM so the tests and any
          later analytics can tell them apart. */}
      <span hidden data-claim-reason={reason} />
    </div>
  );
}

export default ClaimWall;
