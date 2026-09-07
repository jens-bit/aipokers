// client/src/components/home/VisitorToast.jsx — VISIT-1
//
// Somebody is at the door. Same visual language as WantToast (WANTS-1's own
// law applies here too: no dismiss X, no countdown, no re-announcing — a
// yes/no is the only way it goes away) but a different question: this is not
// one of the owner's own agents asking for something, it is a STRANGER asking
// to come in, and the two chips are an accept and a decline rather than a
// yes/later/no.

import { useState } from 'react';
import { answerVisit } from '../../lib/visit.js';

export function VisitorToast({ visitor, onAnswered }) {
  const [busy, setBusy] = useState(null);
  if (!visitor) return null;

  const send = async (accept) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline');
    try {
      const res = await answerVisit(visitor.id, accept);
      onAnswered?.(visitor.id, accept, res.body);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="home-want"
      role="group"
      aria-label={`${visitor.agentName} is at the door, wants a game`}
      data-testid="home-visitor"
      data-visit={visitor.id}
    >
      <span className="home-want__who">{visitor.agentName}</span>
      <span className="home-want__text">is at the door, wants a game</span>
      <span className="home-want__chips">
        <button
          type="button"
          className="home-want__chip home-want__chip--yes"
          disabled={!!busy}
          onClick={() => send(true)}
          data-testid="home-visitor-accept"
        >
          Let him in
        </button>
        <button
          type="button"
          className="home-want__chip home-want__chip--no"
          disabled={!!busy}
          onClick={() => send(false)}
          data-testid="home-visitor-decline"
        >
          Not tonight
        </button>
      </span>
    </div>
  );
}
