import { handResult, seatName } from '../../lib/handResult.js';
import { money } from '../../lib/wallet.js';
import { paceOf, stagedCount } from '../../lib/pace.js';
import '../../styles/action-narrator.css';

// Match the felt's visible settlement, including its local reveal fallback.
// A terminal STATE can already contain a river that the viewer has not seen.
export function narrationSettled(game, flipped) {
  const visible = flipped ?? stagedCount(game?.paceFrame);
  return game?.street === 'complete' && !!game.result && paceOf(game) !== 'allin'
    && !(visible != null && visible < (game.community?.length ?? 0));
}

export function actionNarration(game, { mySeat = -1, flipped } = {}) {
  if (!game) return null;
  const action = game.lastAction?.handNumber === game.handNumber ? game.lastAction : null;
  if (narrationSettled(game, flipped)) {
    const result = handResult(game.result, { seats:game.seats, community:game.community, money });
    if (!result) return null;
    if (result.amount != null && game.result.type === 'uncontested' && action?.type === 'fold') {
      return `${seatName(action.seat, game.seats)} folds. ${result.amount} to ${result.who}.`;
    }
    return `${result.line}.`;
  }
  if (!action || !Number.isInteger(action.seat) || !game.seats?.[action.seat]) return null;
  const name = seatName(action.seat, game.seats);
  const hand = game.heroHand;
  // mySeat is the authenticated viewpoint, never a desktop camera position.
  const ownHolding = mySeat >= 0 && mySeat === action.seat && hand?.seat === mySeat
    && hand.seq === action.seq && hand.handNumber === game.handNumber && hand.street === action.street
    && typeof hand.label === 'string' && hand.label.trim() ? hand.label.trim() : null;
  if (action.allIn && ['call', 'bet', 'raise'].includes(action.type)) {
    const verb = action.type === 'call' ? 'calls all in' : 'shoves';
    return `${name} ${verb}${ownHolding ? ` with ${ownHolding}` : ` ${money(action.chips)}`}.`;
  }
  switch(action.type) {
    case 'fold': return `${name} folds.`;
    case 'check': return `${name} checks.`;
    case 'call': return `${name} calls ${money(action.amount)}.`;
    case 'bet': return `${name} bets ${money(action.amount)}.`;
    case 'raise': return `${name} raises to ${money(action.amount)}.`;
    default: return null;
  }
}

// TABLE-1 job A: this sits between the felt (flex:1) and the composer, so its
// own height is the felt's height — returning null here used to mean "no
// box at all" between a quiet table and one with something to say, and the
// felt (and everything positioned by percentage inside it: the hero strip,
// the stamina/heat dots, the pot, the board) resized and shifted by the
// difference every time a hand settled. The box is mounted always now, at its
// one reserved height, and only its CONTENTS — the status role and the line —
// come and go.
export function ActionNarrator({ game, mySeat = -1, flipped }) {
  const line = actionNarration(game, { mySeat, flipped });
  if (!line) return <div className="action-narrator" aria-hidden="true" />;
  const key = `${game.tableId}:${game.handNumber}:${narrationSettled(game, flipped) ? 'result' : game.lastAction?.seq}`;
  return <div className="action-narrator" role="status" aria-live="polite" aria-atomic="true">
    <span key={key} data-action-line={key}>{line}</span>
  </div>;
}
