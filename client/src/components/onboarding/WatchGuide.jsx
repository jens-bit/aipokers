import { useEffect, useMemo } from 'react';
import { ContextHint } from './ContextHint.jsx';
import { useFirstRunGuide } from './FirstRunGuide.jsx';
import { isGuest } from '../../lib/guest.js';

const order = ['live', 'live-chat', 'live-agent', 'live-opponent'];
const isAI = seat => seat?.isAI === true || /^(agent_|house_|ai_)/.test(seat?.playerId ?? '');

// STATE uses the stable playerId assigned by Table.seatAI. The public floor
// snapshot can also carry agentId. Neither a display name nor camera position
// establishes ownership, particularly while a seat is being replaced.
const seatOf = (seats, id) => id == null ? -1 : seats.findIndex(seat => seat &&
  (String(seat.agentId ?? '') === String(id) || seat.playerId === `agent_${id}`));

export function WatchGuide({ rootRef, game, heroSeat, ownedAgent = null, privateChat = false, chatRef = null, blocked = false }) {
  const guide = useFirstRunGuide();
  const seats = game?.seats ?? [];
  const ownedSeat = seatOf(seats, ownedAgent?.id);
  const owned = privateChat && ownedAgent && !ownedAgent.guest && !ownedAgent.visiting
    && String(ownedAgent.id) === String(guide.agentId) && ownedSeat >= 0 && ownedSeat === heroSeat;
  const opponentSeat = seats.findIndex((seat, index) => seat && index !== heroSeat);
  // The desktop's actual composer lives in the adjacent rail. A live getter
  // follows its ref without a document-wide search or moving/focusing it.
  const externalRoot = useMemo(() => ({ get current() { return chatRef?.current?.parentElement ?? null; } }), [chatRef]);
  const chatRoot = chatRef ? externalRoot : rootRef;
  const specs = {
    live: { root: rootRef, selector: '[data-watch-status]', text: owned
      ? 'You are watching. Your AI agent is playing.'
      : `You are watching. The ${seats.some(isAI) ? 'AI players' : 'players'} make their own decisions.` },
    'live-chat': owned ? { root: chatRoot, selector: chatRef ? 'input, textarea' : '.watch-composer__input', text: isGuest() ? 'Sign in to talk to your agent here.' : 'Talk to your agent here.' } : null,
    'live-agent': owned ? { root: rootRef, selector: `.watch-felt[data-watch-hero-seat="${ownedSeat}"] .watch-hero__body > .mood-ghost`, text: `This is ${ownedAgent.name || 'your agent'}. Tap to talk.` } : null,
    'live-opponent': opponentSeat >= 0 ? { root: rootRef, selector: `.watch-felt__seat[data-watch-seat="${opponentSeat}"] .seat-ghost`, text: 'An opponent. Tap to see what is known about them.' } : null,
  };
  const index = order.indexOf(guide.stage);
  const stage = index < 0 ? null : order.slice(index).find(key => specs[key]) ?? null;
  const ready = !!game && seats.some(Boolean) && !blocked;

  useEffect(() => {
    if (!ready || index < 0 || stage === guide.stage) return;
    if (stage) guide.advance(stage); else guide.dismiss();
  }, [ready, index, stage, guide.stage, guide.advance, guide.dismiss]);

  if (!ready || !stage) return null;
  const spec = specs[stage];
  const next = () => {
    const following = order.slice(order.indexOf(stage) + 1).find(key => {
      const step = specs[key];
      const node = step?.root.current?.querySelector(step.selector);
      if (!node?.isConnected || node.hidden) return false;
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    if (following) guide.advance(following); else guide.dismiss();
  };
  return <ContextHint rootRef={spec.root} selector={spec.selector} text={spec.text}
    nextLabel="OK" onNext={next} onDismiss={guide.dismiss}/>;
}
