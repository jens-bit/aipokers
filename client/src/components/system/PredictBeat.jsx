// WATCH v3 — the prediction beat.
// Port of PredictBeat from design-refs/mood-watch3.jsx.
//
// A bet ON him, never a control: the verb is his, the chips lock the moment he
// acts, and there is nothing to spend. The streak number is the whole reward —
// no coins, no confetti, nothing to bank.
//
// Styles in styles/watch.css.

import { GUESSES } from '../../lib/predict.js';

export function PredictBeat({ picked, locked, right, streak = 0, onPick }) {
  const heading = locked
    ? (right ? 'You called it' : 'Not this time')
    : 'He’s going to…';

  return (
    <div className={'predict' + (locked ? ' predict--locked' : '')}>
      <div className="predict__head">
        <span className={'predict__lbl' + (locked ? ' is-locked' : '')}>{heading}</span>
        <div className="predict__rule" />
        <span className="predict__streak">{streak} IN A ROW</span>
      </div>

      <div className="predict__chips">
        {GUESSES.map((guess) => {
          const on = picked === guess;
          const won = locked && right && on;
          const lost = locked && right === false && on;
          const cls = [
            'predict__chip',
            on ? 'is-picked' : '',
            won ? 'is-won' : '',
            lost ? 'is-lost' : '',
            locked && !on ? 'is-dimmed' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={guess}
              type="button"
              className={cls}
              disabled={locked}
              aria-pressed={on}
              onClick={locked ? undefined : () => onPick?.(guess)}
            >
              {guess}
            </button>
          );
        })}
      </div>
    </div>
  );
}
