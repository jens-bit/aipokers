import { Card } from './Card.jsx';
import { Streets } from '../lib/protocol.js';

const STREET_LABEL = {
  [Streets.WAITING]: 'WAITING',
  [Streets.PREFLOP]: 'PREFLOP',
  [Streets.FLOP]: 'FLOP',
  [Streets.TURN]: 'TURN',
  [Streets.RIVER]: 'RIVER',
  [Streets.SHOWDOWN]: 'SHOWDOWN',
  [Streets.COMPLETE]: 'HAND COMPLETE',
};

export function Board({ pot, community, street }) {
  const slots = [...community];
  while (slots.length < 5) slots.push('placeholder');
  return (
    <div className="center">
      <div className="street-tag">{STREET_LABEL[street] || street}</div>
      <div className="pot">
        <div className="pot__label">POT</div>
        <div className="pot__amount">{pot.toLocaleString()}</div>
      </div>
      <div className="community">
        {slots.map((c, i) => <Card key={i} card={c} />)}
      </div>
    </div>
  );
}
