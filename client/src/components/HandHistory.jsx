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

function nameOf(seat, displayNames) {
  return displayNames[seat] ?? `Seat ${seat}`;
}

function describeResult(result, displayNames) {
  if (!result) return null;
  if (result.type === 'uncontested') {
    const w = result.winners[0];
    return `${nameOf(w.seat, displayNames)} wins ${w.amount} uncontested`;
  }
  if (result.type === 'showdown') {
    return result.winners
      .map((w) => `${nameOf(w.seat, displayNames)} wins ${w.amount} — ${w.descr}`)
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
    const name = nameOf(entry.seat, displayNames);
    return (
      <div className="history__entry">
        <span className="who">{(name[0] || '·').toUpperCase()}</span>
        <span>{name} {actionLabel(entry.action)}</span>
      </div>
    );
  }
  if (entry.kind === 'result') {
    return <div className="history__entry result">{describeResult(entry.result, displayNames)}</div>;
  }
  if (entry.kind === 'closed') {
    return <div className="history__entry result">Table closed: {entry.reason}</div>;
  }
  return null;
}
