import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChipStack, potBand } from './Chips.jsx';
import { settledAwards } from '../../lib/settledAwards.js';

// Engine awards can contain several side pots for the same seat. One journey
// per actual recipient; neither the camera seat nor the result headline pays it.
export function potAwards(game) {
  return settledAwards(game?.result).awards
    .filter(award => game?.seats?.[award.seat] && Number.isFinite(award.amount) && award.amount > 0);
}

export function PotAward({ rootRef, seat, amount, bigBlind }) {
  const originRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current, origin = originRef.current;
    const target = root?.querySelector(`[data-award-seat="${seat}"]`);
    if (!origin || !target) return;
    const a = origin.getBoundingClientRect(), b = target.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    if (!a.width || !r.width || !root.offsetWidth) return;
    // Desktop Watch scales a fixed scene. Screen deltas must return to that
    // scene's CSS coordinates before its transform is applied again.
    const scaleX = r.width / root.offsetWidth, scaleY = r.height / root.offsetHeight;
    origin.style.setProperty('--award-dx', `${(b.x+b.width/2-a.x-a.width/2)/scaleX}px`);
    origin.style.setProperty('--award-dy', `${(b.y+b.height/2-a.y-a.height/2)/scaleY}px`);
    origin.dataset.measured = 'true';
  }, [rootRef, seat]);
  return <div ref={originRef} className="hand-pot-award" data-pot-award={seat}
    data-award-amount={amount} aria-hidden="true">
    <span className="hand-pot-award__chips"><ChipStack band={potBand(amount,bigBlind)} w={20} cap={3}/></span>
  </div>;
}

// A brief result reaction requested by SHOW-4, using the existing speech atom.
// Existing speech takes precedence at the call site. Human seats never acquire
// an invented quote. This is local flavor, not a chat message or model request.
export function useWinnerSpeech(game, watchedKey) {
  const key = watchedKey || null;
  const [expired, setExpired] = useState(null);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => setExpired(key), 2400);
    return () => clearTimeout(timer);
  }, [key]);
  if (!key || expired === key) return null;
  const award = potAwards(game).sort((a,b) => b.amount-a.amount || a.seat-b.seat)[0];
  if (!award || game.seats[award.seat].isAI !== true) return null;
  const name = game.seats[award.seat].displayName ?? '';
  const lines = /granite|grinder/i.test(name) ? ['Patience pays.','Right on time.']
    : /cannon|wild|slick/i.test(name) ? ['Now that was a pot.','Keep them coming.']
    : ['I’ll take it.','Good hand.'];
  return {id:`result:${key}`, seat:award.seat, text:lines[(game.handNumber ?? 0)%lines.length]};
}
