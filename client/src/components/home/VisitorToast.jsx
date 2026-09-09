// client/src/components/home/VisitorToast.jsx — VISIT-1
//
// Somebody is at the door. Same visual language as WantToast (WANTS-1's own
// law applies here too: no dismiss X, no countdown, no re-announcing — a
// yes/no is the only way it goes away) but a different question: this is not
// one of the owner's own agents asking for something, it is a STRANGER asking
// to come in, and the two chips are an accept and a decline rather than a
// yes/later/no.

import { useEffect, useRef, useState } from 'react';
import { answerVisit, visitErrorText } from '../../lib/visit.js';

export function VisitorToast({ visitor, onAnswered }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const request = useRef({ busy:false });
  useEffect(() => {
    const current = { busy:false, alive:true };
    request.current = current;
    setBusy(null); setError(null);
    return () => { current.alive = false; };
  }, [visitor?.id]);
  if (!visitor) return null;

  const send = async (accept) => {
    const current = request.current;
    if (current.busy) return;
    current.busy = true;
    setError(null);
    setBusy(accept ? 'accept' : 'decline');
    try {
      const res = await answerVisit(visitor.id, accept);
      if (!current.alive) return;
      if (res.ok) onAnswered?.(visitor.id, accept, res.body);
      else setError(visitErrorText(res));
    } finally {
      current.busy = false;
      if (current.alive) setBusy(null);
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
      {error && <span role="alert" className="home-want__text" style={{ flexBasis:'100%' }}>{error}</span>}
    </div>
  );
}

// Reuse the door's existing message language for an invitation that could not
// reach it. It stays readable until dismissed; failures never fake a visitor.
export function VisitNotice({ notice, onDismiss }) {
  if (!notice) return null;
  return <div className="home-want" data-testid="visit-link-notice" style={{ position:'fixed', bottom:84, left:'50%', right:'auto', transform:'translateX(-50%)', animation:'none', width:'calc(100% - 28px)', maxWidth:430, zIndex:70, boxSizing:'border-box' }}>
    <span role={notice.error ? 'alert' : 'status'} className="home-want__text">{notice.text}</span>
    {!notice.busy && <span className="home-want__chips">
      {notice.retry && <button type="button" className="home-want__chip home-want__chip--yes" onClick={notice.retry}>Try again</button>}
      <button type="button" className="home-want__chip" onClick={onDismiss}>Got it</button>
    </span>}
  </div>;
}
