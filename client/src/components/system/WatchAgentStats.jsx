import { ATTR_KEYS, ATTR_META } from '../../lib/attributes.js';
import { money } from '../../lib/wallet.js';
import '../../styles/watch-agent.css';

// Read the server's values directly. In particular, missing attributes are
// unknown, and STAMINA is a skill rather than a remaining-energy percentage.
export function WatchAgentStats({ agent, seat }) {
  return <div className="watch-agent-stats">
    <div className="watch-agent-stats__stack"><span>Stack at this table</span>
      {/* BUG-207: toLocaleString grouped this by the device's locale ("$1 234"
          on this environment's ICU data instead of "$1,234"), the exact drift
          money()'s own doc comment in lib/wallet.js warns about. Every other
          amount in the app already goes through money(); this one should too. */}
      <strong>{Number.isFinite(seat?.stack) ? money(seat.stack) : 'Not available yet'}</strong></div>
    <dl>{ATTR_KEYS.map(key => <div key={key}>
      <dt>{key.charAt(0) + key.slice(1).toLowerCase()}<small>{ATTR_META[key].meanShort}</small></dt>
      <dd>{Number.isFinite(agent?.attrs?.[key]) ? `${agent.attrs[key]}/100` : 'Unknown'}</dd>
    </div>)}</dl>
  </div>;
}
