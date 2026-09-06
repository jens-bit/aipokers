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
//   * THE ASK IS ALSO HIS BUBBLE, in the room, over his own head. The toast is
//     where you answer; the bubble is who is asking. Two places, one want, and
//     the bubble is the one that carries his voice.
//
// `needs` is the half the server cannot do — open the casino, open the wallet,
// open the thread — and it comes back on the yes.

import { useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { pillName } from '../../lib/names.js';

export const ANSWERS = [
  { id: 'yes', label: 'Yes' },
  { id: 'later', label: 'Later' },
  { id: 'no', label: 'No' },
];

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

export function WantToast({ agent, onAnswered, onNeeds }) {
  const want = agent?.want ?? null;
  const [busy, setBusy] = useState(null);
  if (!want) return null;

  const send = async (answer) => {
    if (busy) return;
    setBusy(answer);
    try {
      const body = await answerWant(agent.id, answer);
      // The want is cleared optimistically either way: a failed POST that left
      // the toast up would read as him asking twice.
      onAnswered?.(agent.id, answer, body);
      if (body?.needs) onNeeds?.(body.needs, { agent, room: body.room ?? null });
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
      <span className="home-want__who">{pillName(agent.name)}</span>
      <span className="home-want__text">{want.text}</span>
      <span className="home-want__chips">
        {ANSWERS.map((a) => (
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
  );
}
