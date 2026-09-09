import { useCallback, useEffect, useRef, useState } from 'react';
import { faceFor, faceHoldMs } from '../lib/faces.js';

// Reactions are per seat, so the next player acting cannot erase this player's face.
// Only existing sanitized event names and the owner's visible strong peek enter here.
export function useTableReactions({ decision, result, scope, active, heroSeat, strongPeek }) {
  const [faces, setFaces] = useState(() => new Map());
  const [brows, setBrows] = useState(() => new Map());
  const timers = useRef(new Map());
  const clear = useCallback(kind => {
    for (const [key, timer] of timers.current) if (!kind || key.startsWith(kind + ':')) {
      clearTimeout(timer); timers.current.delete(key);
    }
  }, []);
  const flash = useCallback((kind, seat, value, ms) => {
    if (!Number.isInteger(seat) || seat < 0 || !value || !ms) return;
    const key = kind + ':' + seat, setter = kind === 'face' ? setFaces : setBrows;
    clearTimeout(timers.current.get(key));
    setter(previous => new Map(previous).set(seat, value));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      setter(previous => { const next = new Map(previous); next.delete(seat); return next; });
    }, ms));
  }, []);
  useEffect(() => {
    clear(); setFaces(new Map()); setBrows(new Map());
    return () => clear();
  }, [scope, clear]);
  useEffect(() => {
    if (!active || !decision) return;
    const face = faceFor(decision.event);
    flash('face', decision.seat, face, faceHoldMs(face));
    if (decision.event === 'raisedAgainst') flash('brow', decision.seat, 'twitch', 400);
  }, [decision, scope, active, flash]);
  useEffect(() => {
    if (active && strongPeek) flash('brow', heroSeat, 'lift', 700);
  }, [strongPeek, heroSeat, scope, active, flash]);
  useEffect(() => {
    if (!active) { clear('brow'); setBrows(new Map()); }
  }, [active, clear]);

  // STATE repeatedly carries the same settled result. Its content, not its object
  // identity, starts these clocks; the hand/table scope distinguishes equal results.
  const resultKey = result ? JSON.stringify(Object.entries(result.events ?? {}).sort()) : null;
  useEffect(() => {
    if (resultKey === null) return;
    clear('face'); setFaces(new Map());
    for (const [seat, event] of JSON.parse(resultKey)) {
      const face = faceFor(event);
      flash('face', Number(seat), face, faceHoldMs(face));
    }
  }, [resultKey, scope, clear, flash]);
  return {
    face: seat => faces.get(seat) ?? null,
    brow: (seat, heat) => brows.get(seat) ?? (Number.isFinite(heat) && heat >= 55 ? 'knit' : null),
  };
}
