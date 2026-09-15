// client/src/components/home/WantToast.jsx — HOME-1
//
// He asks for one thing, once. This is the answer.
//
// WANTS-1 is careful about what a want is allowed to be: he asks, and then he
// drops it. "No" is a complete answer that costs him nothing but the line in his
// ledger, and a want that nags is a guilt mechanic wearing a biscuit costume.
// The screen has to hold that line too, which is why:
//
//   * THE TOAST HAS NO DISMISS X. Three chips, all of them answers. There is no
//     way to make it go away that is not an answer, because the alternative —
//     an X — teaches the owner that ignoring him is a move.
//   * IT DOES NOT COUNT DOWN, PULSE OR RE-ANNOUNCE. It sits above the collapsed
//     thread until it is answered. `later` is thirty minutes of quiet and the
//     same want comes back; that is the server's business and it is not drawn.
//   * BUG-56: THE ASK IS SAID ONCE. Jens's playtest cancelled the duplicate
//     room bubble. This compact strip keeps the full sentence and its answers.
//
// `needs` is the half the server cannot do — open the casino, open the wallet,
// open the thread — and it comes back on the yes.

import { useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { shortName } from '../../lib/names.js';
import { HomeMoodAvatar } from './HomeMoodAvatar.jsx';

export const ANSWERS = [
  { id: 'yes', label: 'Yes' },
  { id: 'later', label: 'Later' },
  { id: 'no', label: 'No' },
];

// UI-3 job E: LIFE-2 job 1 gave every want an owner-facing verb —
// `want.actionLabel` ("Sit him out", "Give him chips", "Put him in"…) — so
// the fix for "players did not know what to do" is naming the FIRST pill
// after it instead of leaving it a generic "Yes". Answering 'yes' is still
// exactly what the button does; `needs`/`onNeeds` routes it exactly as
// before. A want with no actionLabel (an old unvoiced ask, or none of the
// five real verbs) keeps the plain "Yes".
export function answersFor(want) {
  if (!want?.actionLabel) return ANSWERS;
  return ANSWERS.map((a) => (a.id === 'yes' ? { ...a, label: want.actionLabel } : a));
}

/** POST the answer. Returns the server's body, or null when it refused. */
export async function answerWant(agentId, answer) {
  const userId = getUserId();
  const initData = getTelegramInitData();
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/want?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
    },
    body: JSON.stringify({ userId, answer }),
  });
  if (!res.ok) return null;
  return res.json();
}

export function WantToast({ agent, identity, onAnswered, onNeeds }) {
  const want = agent?.want ?? null;
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  if (!want) return null;

  const send = async (answer) => {
    if (busy) return;
    setBusy(answer);
    setError('');
    try {
      const body = await answerWant(agent.id, answer);
      // BUG-61: an unsuccessful request is not an answer. Keep the original
      // request and let the owner retry instead of silently discarding it.
      if (!body) throw new Error('Want was not saved');
      if (body.answered !== null && !body.want) onAnswered?.(agent.id, answer, body);
      if (body?.needs) onNeeds?.(body.needs, { agent, room: body.room ?? null });
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`home-want${want.dangerous ? ' is-dangerous' : ''}`}
      role="group"
      aria-label={`${agent.name} is asking for something`}
      data-testid="home-want"
      data-agent={agent.id}
    >
      {/* Full sentence once, small pills below, using F11's panel glass. */}
      <div className="home-want__row">
        <HomeMoodAvatar agent={agent} identity={identity} className="home-want__avatar" />
        <div className="home-want__content">
          <div className="home-want__sentence">
            <span className="home-want__who" style={identity?.glow?.c ? { color: identity.glow.c } : undefined}>{shortName(agent.name, agent.nickname)}</span>{' '}
            <span className="home-want__text">{want.text}</span>
          </div>
          <span className="home-want__chips">
            {answersFor(want).map((a) => (
              <button
                key={a.id}
                type="button"
                className={`home-want__chip home-want__chip--${a.id}`}
                disabled={!!busy}
                onClick={() => send(a.id)}
                data-testid={`home-want-${a.id}`}
              >
                {a.label}
              </button>
            ))}
          </span>
        </div>
      </div>
      {error && <span role="alert" className="home-want__text">{error}</span>}
    </div>
  );
}
