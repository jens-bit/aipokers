import { Streets, Actions } from '../lib/protocol.js';

const STREET_LABEL = {
  [Streets.PREFLOP]: 'PREFLOP',
  [Streets.FLOP]: 'FLOP',
  [Streets.TURN]: 'TURN',
  [Streets.RIVER]: 'RIVER',
  [Streets.SHOWDOWN]: 'SHOWDOWN',
  [Streets.COMPLETE]: 'COMPLETE',
};

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

// Remove adjacent duplicate action entries (same player, same action type, same amount).
function dedupEntries(entries) {
  return entries.reduce((acc, entry) => {
    if (entry.kind !== 'action') return [...acc, entry];
    const prev = acc[acc.length - 1];
    if (
      prev?.kind === 'action' &&
      prev.seat === entry.seat &&
      prev.action?.type === entry.action?.type &&
      prev.action?.amount === entry.action?.amount
    ) return acc;
    return [...acc, entry];
  }, []);
}

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

// ── Panel mode helpers ──

function panelMarker(actionType) {
  switch (actionType) {
    case Actions.FOLD: return { label: 'F', cls: 'fold' };
    case Actions.CHECK: return { label: '·', cls: 'check' };
    case Actions.CALL: return { label: 'C', cls: 'call' };
    case Actions.BET: return { label: 'B', cls: 'bet' };
    case Actions.RAISE: return { label: 'R', cls: 'raise' };
    default: return { label: '?', cls: 'check' };
  }
}

function panelActionVerb(action) {
  switch (action.type) {
    case Actions.FOLD: return { verb: 'folds', amount: '—' };
    case Actions.CHECK: return { verb: 'checks', amount: '—' };
    case Actions.CALL: return { verb: 'calls', amount: action.amount?.toLocaleString() ?? '—' };
    case Actions.BET: return { verb: 'bets', amount: action.amount?.toLocaleString() ?? '—' };
    case Actions.RAISE: return { verb: 'raises', amount: action.amount?.toLocaleString() ?? '—' };
    default: return { verb: action.type, amount: '—' };
  }
}

// ── Public component ──

export function HandHistory({ history, displayNames, variant = 'simple' }) {
  if (variant === 'panel') {
    return <PanelHistory history={history} displayNames={displayNames} />;
  }

  return (
    <div className="history">
      {history.length === 0 && (
        <div className="muted">No hands played yet.</div>
      )}
      <div className="history__list">
        {history.map((hand, idx) => (
          <div key={`${hand.handNumber}-${idx}`} className="history__hand">
            <div className="history__hand-title">HAND #{hand.handNumber || '—'}</div>
            {dedupEntries(hand.entries).map((e, j) => (
              <SimpleEntry key={j} entry={e} displayNames={displayNames} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Simple (mobile/drawer) entries ──

function SimpleEntry({ entry, displayNames }) {
  if (entry.kind === 'street') {
    return (
      <div className="history__entry street">
        — {STREET_LABEL[entry.street] || entry.street} {entry.community?.length > 0 ? `(${entry.community.join(' ')})` : ''}
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

// ── Panel (desktop sidebar) entries ──

function PanelHistory({ history, displayNames }) {
  if (history.length === 0) {
    return <div className="muted" style={{ padding: '16px 24px' }}>No hands played yet.</div>;
  }
  return (
    <>
      {history.map((hand, idx) => (
        <PanelHand key={`${hand.handNumber}-${idx}`} hand={hand} displayNames={displayNames} />
      ))}
    </>
  );
}

function PanelHand({ hand, displayNames }) {
  const lastStreetEntry = [...hand.entries].reverse().find((e) => e.kind === 'street');
  const streetTag = lastStreetEntry ? (STREET_LABEL[lastStreetEntry.street] || lastStreetEntry.street) : 'PREFLOP';
  const entries = dedupEntries(hand.entries);

  return (
    <div className="hand-section">
      <div className="hand-section-header">
        <span className="hand-num">Hand {hand.handNumber ?? '—'}</span>
        <span className="street-tag">{streetTag}</span>
      </div>
      {entries.map((e, i) => (
        <PanelEntry key={i} entry={e} displayNames={displayNames} />
      ))}
    </div>
  );
}

function PanelEntry({ entry, displayNames }) {
  if (entry.kind === 'street') {
    return (
      <div className="history-row history-row--street">
        <div className="action-marker check">—</div>
        <div className="history-text history-text--street">
          {STREET_LABEL[entry.street] || entry.street}
          {entry.community?.length > 0 && ` · ${entry.community.join(' ')}`}
        </div>
        <div className="history-amount"></div>
      </div>
    );
  }

  if (entry.kind === 'action') {
    const name = nameOf(entry.seat, displayNames);
    const { label: markerLabel, cls: markerCls } = panelMarker(entry.action.type);
    const { verb, amount } = panelActionVerb(entry.action);
    return (
      <div className="history-row">
        <div className={`action-marker ${markerCls}`}>{markerLabel}</div>
        <div className="history-text">
          <span className="who">{name}</span> {verb}
        </div>
        <div className="history-amount">{amount}</div>
      </div>
    );
  }

  if (entry.kind === 'result') {
    const text = describeResult(entry.result, displayNames);
    return (
      <div className="history-row">
        <div className="action-marker win">W</div>
        <div className="history-text history-text--result">{text}</div>
        <div className="history-amount"></div>
      </div>
    );
  }

  if (entry.kind === 'closed') {
    return (
      <div className="history-row">
        <div className="action-marker fold">!</div>
        <div className="history-text">Table closed: {entry.reason}</div>
        <div className="history-amount"></div>
      </div>
    );
  }

  return null;
}
