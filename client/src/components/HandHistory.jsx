import { Streets, Actions } from '../lib/protocol.js';

const STREET_LABEL = {
  [Streets.FLOP]: 'FLOP',
  [Streets.TURN]: 'TURN',
  [Streets.RIVER]: 'RIVER',
};

function actionLabel(action) {
  switch (action.type) {
    case Actions.FOLD: return 'folds';
    case Actions.CHECK: return 'checks';
    case Actions.CALL: return 'calls';
    case Actions.BET: return `bets ${action.amount}`;
    case Actions.RAISE: return `raises to ${action.amount}`;
    default: return action.type;
  }
}

function describeResult(result, displayNames) {
  if (!result) return null;
  if (result.type === 'uncontested') {
    const w = result.winners[0];
    const name = displayNames[w.seat] ?? `Seat ${w.seat}`;
    return `${name} wins ${w.amount} uncontested`;
  }
  if (result.type === 'showdown') {
    return result.winners
      .map((w) => `${displayNames[w.seat] ?? `Seat ${w.seat}`} wins ${w.amount} — ${w.descr}`)
      .join(' · ');
  }
  return null;
}

export function HandHistory({ history, displayNames }) {
  return (
    <div className="history">
      <h3>HAND HISTORY</h3>
      {history.length === 0 && (
        <div className="muted">No hands played yet.</div>
      )}
      <div className="history__list">
        {history.map((hand, idx) => (
          <div key={`${hand.handNumber}-${idx}`} className="history__hand">
            <div className="history__hand-title">HAND #{hand.handNumber || '—'}</div>
            {hand.entries.map((e, j) => (
              <Entry key={j} entry={e} displayNames={displayNames} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Entry({ entry, displayNames }) {
  if (entry.kind === 'street') {
    return (
      <div className="history__entry street">
        — {STREET_LABEL[entry.street]} {entry.community.length > 0 ? `(${entry.community.join(' ')})` : ''}
      </div>
    );
  }
  if (entry.kind === 'action') {
    const name = displayNames[entry.seat] ?? `Seat ${entry.seat}`;
    return (
      <div className="history__entry">
        <span className="who">{name[0]}</span>
        <span>{name} {actionLabel(entry.action)}</span>
      </div>
    );
  }
  if (entry.kind === 'result') {
    const text = describeResult(entry.result, displayNames);
    return (
      <div className="history__entry result">{text}</div>
    );
  }
  if (entry.kind === 'closed') {
    return <div className="history__entry result">Table closed: {entry.reason}</div>;
  }
  return null;
}
