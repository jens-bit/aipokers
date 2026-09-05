// REPLAY-1 (R-3) — the entry.
// Port of ReplayCard from design-refs/mood-replay.jsx.
//
// "A poster, not a link: the flag, the board, the pot, and one line. Tapping it
// opens the theatre. This is the only new furniture the replay adds to the
// thread."
//
// Styles in styles/replay.css.

import { PlayingCard, CardBack } from '../system/PlayingCard.jsx';
import { TugBar } from '../system/TugBar.jsx';
import { buildTimeline } from './timeline.js';

// The last thing he said in the hand, which is the line worth putting on a
// poster. Never composed here — if he said nothing, the card says nothing.
function posterLine(hand) {
  const streets = Array.isArray(hand?.streets) ? hand.streets : [];
  for (let i = streets.length - 1; i >= 0; i--) {
    const line = streets[i]?.reasoning;
    if (typeof line === 'string' && line.trim()) return line;
  }
  return null;
}

export function ReplayCard({ hand, onOpen }) {
  const timeline = buildTimeline(hand);
  const board = timeline.beats[timeline.beats.length - 1].board ?? [];
  const slots = [...board];
  while (slots.length < 5) slots.push(null);

  const line = posterLine(hand);
  const tone = timeline.flag.tone;

  return (
    <button
      type="button"
      className={`replay-card replay-card--${tone}`}
      onClick={onOpen}
      aria-label={`Replay ${timeline.flag.label.toLowerCase()}${timeline.handNumber != null ? `, hand ${timeline.handNumber}` : ''}`}
    >
      <div className="replay-card__poster">
        <div className="replay-card__board">
          {slots.map((c, i) => (
            typeof c === 'string' && c.length >= 2
              ? <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={32} h={44} />
              : <CardBack key={i} w={32} h={44} branded />
          ))}
        </div>

        {/* The rope, at where it ended: the whole hand in one bar. */}
        <div className="replay-card__tug">
          <TugBar equity={timeline.won ? 100 : 0} />
        </div>

        <span className="replay-card__play">
          <svg width="11" height="12" viewBox="0 0 13 14" aria-hidden>
            <path d="M2 1.5v11l9.5-5.5z" fill="currentColor" />
          </svg>
        </span>
      </div>

      <div className="replay-card__foot">
        <span className={`replay-flag replay-flag--${tone}`}>{timeline.flag.label}</span>
        {line && <span className="replay-card__line">{line}</span>}
        <span className={`replay-card__pot${timeline.won ? '' : ' is-lost'}`}>
          {timeline.won ? '+' : '−'}${timeline.pot.toLocaleString()}
        </span>
      </div>
    </button>
  );
}
