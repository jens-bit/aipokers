// SIT-1 — the four verbs, where the whisper row sits.
//
// Ported from `ActionRow` and `BetPanel` in design-refs/mood-home2.jsx (board
// 29, frames 52·Y1–Y4). When the owner is the one in the seat there is nobody
// to whisper to — he is IN the hand — so the composer's slot at the foot of the
// watch screen carries the hand instead.
//
// Three rules the shape comes from, and all three are the board's:
//
//   1. THREE OF THE FOUR VERBS ARE A TAP; BET IS THE ONE THAT NEEDS A NUMBER,
//      so it is the one that opens a panel. It rises from the bottom edge and
//      THE FELT ABOVE IT DOES NOT MOVE — same geometry, same cards, same ring.
//      That is why the panel replaces the strip in the same slot rather than
//      stacking on top of it: a slot that grows would push the felt up and make
//      52·Y4 a different screen from 52·Y3.
//   2. THE AMOUNTS ARE NAMED IN POKER'S OWN WORDS with the figure under each,
//      because "half" is the decision and "240" is only its size. The free
//      field underneath is for the one owner in twenty who wants 137.
//   3. IT IS GLASS. V5GLASS, the same material as the thread sheet and the hero
//      strip — not the flat grey the legacy ActionBar wears. Two materials
//      meeting at a hard line is what made the old lower half look cheap next
//      to the felt (see Glass.jsx).
//
// THE STRIP NEVER LIES ABOUT WHOSE TURN IT IS. Off turn the four verbs are
// present and disabled — the ref draws them at 52·Y1, before the action is on
// him — and the YOUR TURN line is absent. A verb that is not legal in the spot
// is disabled even on his turn, because the server would refuse it and a button
// that produces an error is worse than one that says it cannot be pressed.

import { useEffect, useState } from 'react';
import { Actions } from '../../lib/protocol.js';
import { Glass } from './Glass.jsx';

/** The four sizes the panel names, in the ref's own words and order. */
export const BET_FRACTIONS = Object.freeze([
  { key: 'A THIRD', fraction: 1 / 3 },
  { key: 'HALF', fraction: 1 / 2 },
  { key: 'POT', fraction: 1 },
]);

function findLegal(legal, type) {
  return (legal ?? []).find((a) => a && a.type === type) ?? null;
}

/** Grouped by hand — lib/wallet's rule: toLocaleString groups differently per locale. */
export function figure(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The panel's four buttons, as totals the engine would accept.
 *
 * The engine takes a TOTAL, not an increment, so a raise is priced from the
 * current bet up: call first, then a fraction of the pot that call has made.
 * Same arithmetic the legacy ActionBar has always used — one sizing rule in the
 * product, so the drawer and the panel can never offer two different halves.
 *
 * Every option is clamped into [min, max], which is why ALL IN is simply `max`
 * and why a short stack sees four buttons that quietly collapse onto the jam
 * rather than four buttons that would be refused.
 */
export function betOptions({ pot = 0, currentBet = 0, callAmount = 0, min = 0, max = 0, isRaise = false }) {
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v)));
  const potAfterCall = (Number(pot) || 0) + (Number(callAmount) || 0);
  const sized = BET_FRACTIONS.map(({ key, fraction }) => ({
    key,
    amount: clamp(isRaise
      ? (Number(currentBet) || 0) + potAfterCall * fraction
      : (Number(pot) || 0) * fraction),
  }));
  return sized.concat([{ key: 'ALL IN', amount: clamp(max), all: true }]);
}

/**
 * @param game          the live game (NOT the paced one — a player must never
 *                      wait to see his own seat; see App's note on usePacedTable)
 * @param mySeat        the seat the owner is actually in
 * @param legalActions  what the server says is legal for him right now
 * @param onAct         send it
 */
export function SitStrip({ game = null, mySeat = null, legalActions = [], onAct, secs = null }) {
  const [betOpen, setBetOpen] = useState(false);

  const street = game ? game.street : null;
  const handNo = game ? game.handNumber : null;
  // A new street or a new hand is a new decision, so the panel closes itself —
  // the same rule the legacy drawer keeps, and the reason the owner never
  // arrives on the turn with the flop's sizes still on screen.
  useEffect(() => { setBetOpen(false); }, [street, handNo]);

  const yourTurn = !!(game && Number.isInteger(mySeat) && game.toAct === mySeat);
  const fold = yourTurn ? findLegal(legalActions, Actions.FOLD) : null;
  const check = yourTurn ? findLegal(legalActions, Actions.CHECK) : null;
  const call = yourTurn ? findLegal(legalActions, Actions.CALL) : null;
  const raise = yourTurn ? findLegal(legalActions, Actions.RAISE) : null;
  const bet = yourTurn ? findLegal(legalActions, Actions.BET) : null;
  const aggressive = raise ?? bet;
  const heroSeat = (game && game.seats && Number.isInteger(mySeat)) ? game.seats[mySeat] : null;
  const heroStack = heroSeat && Number.isFinite(heroSeat.stack) ? heroSeat.stack : 0;

  // The panel cannot outlive the spot that opened it.
  useEffect(() => { if (!aggressive) setBetOpen(false); }, [!!aggressive]);

  if (betOpen && aggressive) {
    return (
      <BetPanel
        game={game}
        offer={aggressive}
        stack={heroStack}
        callAmount={call ? call.amount : 0}
        onCancel={() => setBetOpen(false)}
        onBet={(amount) => { setBetOpen(false); onAct?.({ type: aggressive.type, amount }); }}
      />
    );
  }

  return (
    <div className="sit-strip" data-testid="sit-strip" data-turn={yourTurn ? 'yes' : 'no'}>
      <Glass up={yourTurn} className="sit-strip__glass">
        {yourTurn && (
          <div className="sit-strip__head">
            <span className="sit-strip__turn">YOUR TURN</span>
            {Number.isFinite(secs) && (
              <span className="sit-strip__sub">{`${Math.max(0, Math.round(secs))}s · timeout checks for you`}</span>
            )}
          </div>
        )}
        <div className="sit-strip__row">
          <Verb name="FOLD" tone="fold" enabled={!!fold}
            onClick={() => onAct?.({ type: Actions.FOLD })} />
          <Verb name="CHECK" tone="check" enabled={!!check}
            onClick={() => onAct?.({ type: Actions.CHECK })} />
          <Verb name="CALL" tone="call" enabled={!!call}
            note={call && call.amount > 0 ? figure(call.amount) : null}
            onClick={() => onAct?.({ type: Actions.CALL, amount: call ? call.amount : undefined })} />
          <Verb name="BET" tone="bet" enabled={!!aggressive}
            onClick={() => setBetOpen(true)} />
        </div>
      </Glass>
    </div>
  );
}

function Verb({ name, tone, enabled, note, onClick }) {
  return (
    <button
      type="button"
      className={`sit-verb sit-verb--${tone}`}
      disabled={!enabled}
      onClick={onClick}
    >
      <span className="sit-verb__name">{name}</span>
      {note ? <span className="sit-verb__note">{note}</span> : null}
    </button>
  );
}

/**
 * BET, priced. Rises from the bottom edge into the strip's own slot, so the
 * felt above it is untouched — 52·Y4's one hard requirement.
 *
 * CANCEL is a word, not an X (the ref says so explicitly), and it is the only
 * way out that does not send chips.
 */
export function BetPanel({ game, offer, stack = 0, callAmount = 0, onCancel, onBet }) {
  const min = Number.isFinite(offer?.min) ? offer.min : 0;
  const max = Number.isFinite(offer?.max) ? offer.max : 0;
  const isRaise = offer?.type === Actions.RAISE;
  const pot = game ? (game.pot || 0) : 0;

  const options = betOptions({
    pot,
    currentBet: game ? (game.currentBet || 0) : 0,
    callAmount,
    min,
    max,
    isRaise,
  });

  const [amount, setAmount] = useState(min);
  useEffect(() => { setAmount(min); }, [min, max]);

  const typed = Number(amount);
  const valid = Number.isFinite(typed) && typed >= min && typed <= max;

  return (
    <div className="sit-bet" data-testid="sit-bet-panel">
      <Glass up className="sit-bet__glass">
        <div className="sit-bet__head">
          <span className="sit-bet__label">{isRaise ? 'RAISE' : 'BET'}</span>
          <span className="sit-bet__meta">{`pot is ${figure(pot)} · you have ${figure(stack)}`}</span>
          <button type="button" className="sit-bet__cancel" onClick={onCancel}>CANCEL</button>
        </div>

        <div className="sit-bet__sizes">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`sit-size${o.all ? ' is-all' : ''}`}
              onClick={() => onBet?.(o.amount)}
            >
              <span className="sit-size__key">{o.key}</span>
              <span className="sit-size__amt">{figure(o.amount)}</span>
            </button>
          ))}
        </div>

        {/* The one owner in twenty who wants 137. */}
        <div className="sit-bet__any">
          <input
            className="sit-bet__input"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={amount}
            placeholder="any amount"
            aria-label={`any amount; min ${min} max ${max}`}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            type="button"
            className="sit-bet__go"
            disabled={!valid}
            onClick={() => onBet?.(Math.round(typed))}
          >{isRaise ? 'RAISE' : 'BET'}</button>
        </div>
      </Glass>
    </div>
  );
}
