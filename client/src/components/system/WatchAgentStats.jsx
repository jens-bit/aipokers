import { ATTR_KEYS, ATTR_META } from '../../lib/attributes.js';
import '../../styles/watch-agent.css';

// Read the server's values directly. In particular, missing attributes are
// unknown, and STAMINA is a skill rather than a remaining-energy percentage.
export function WatchAgentStats({ agent, seat }) {
  return <div className="watch-agent-stats">
    <div className="watch-agent-stats__stack"><span>Stack at this table</span>
      <strong>{Number.isFinite(seat?.stack) ? `$${seat.stack.toLocaleString()}` : 'Not available yet'}</strong></div>
    <dl>{ATTR_KEYS.map(key => <div key={key}>
      <dt>{key.charAt(0) + key.slice(1).toLowerCase()}<small>{ATTR_META[key].meanShort}</small></dt>
      <dd>{Number.isFinite(agent?.attrs?.[key]) ? `${agent.attrs[key]}/100` : 'Unknown'}</dd>
    </div>)}</dl>
  </div>;
}
