import { Hood, MiniCard } from './primitives.jsx';
import { Streets } from '../../lib/protocol.js';

function formatAction(action) {
  if (!action?.type) return 'THINKING';
  const type = String(action.type).toUpperCase();
  return action.amount == null ? type : `${type} ${action.amount}`;
}

// The watched agent is seated under its own display name. Both seats can emit
// DECISION messages, so match by name rather than trusting the last decider.
export function GameTile({ game, agentName, lastDecision, onWatch }) {
  const seats = game?.seats || [];
  const named = seats.findIndex((s) => s?.displayName === agentName);
  const heroIndex = named >= 0 ? named : 0;
  const oppIndex = seats.length ? (heroIndex + 1) % seats.length : 1;
  const heroDecision = lastDecision?.seat === heroIndex ? lastDecision : null;

  const hero = seats[heroIndex];
  const opp = seats[oppIndex];
  const oppName = opp?.displayName || 'Opponent';

  const board = [...(game?.community || [])];
  while (board.length < 5) board.push(null);

  // Server broadcasts equity as a 0..1 fraction.
  const equity = heroDecision?.equity;
  const equityPct = Number.isFinite(equity) ? `${(equity * 100).toFixed(1)}%` : null;

  const street = game?.street;
  const streetLabel = street && street !== Streets.WAITING ? String(street).toUpperCase() : 'WAITING';

  return (
    <div className="dsk-tile">
      <div className="dsk-tile__head">
        <Hood size={22} />
        <div className="dsk-tile__head-text">
          <div className="dsk-tile__name-row">
            <span className="dsk-tile__name">{agentName || 'Agent'}</span>
            <span className="dsk-dot" style={{ width: 5, height: 5 }} aria-hidden />
          </div>
          <div className="dsk-tile__meta">
            HEADS-UP NLH · {game?.handNumber ? `HAND #${game.handNumber}` : streetLabel}
          </div>
        </div>
        <span className="dsk-tile__live">LIVE</span>
      </div>

      <div className="dsk-tile__felt">
        <div className="dsk-tile__oval" aria-hidden />

        <div className="dsk-tile__opp">
          <div className="dsk-tile__opp-avatar">{oppName.slice(0, 2).toUpperCase()}</div>
          <div className="dsk-tile__cards">
            <MiniCard card={null} />
            <MiniCard card={null} />
          </div>
          <div className="dsk-tile__opp-name">
            {oppName} · {(opp?.stack ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="dsk-tile__center">
          <div className="dsk-tile__pot">
            <small>POT</small>
            <b>{(game?.pot ?? 0).toLocaleString()}</b>
          </div>
          <div className="dsk-tile__cards">
            {board.map((card, i) => <MiniCard key={i} card={card} />)}
          </div>
        </div>

        <div className="dsk-tile__hero">
          <div className="dsk-tile__cards">
            <MiniCard card={hero?.holeCards?.[0]} hero />
            <MiniCard card={hero?.holeCards?.[1]} hero />
          </div>
          <div className="dsk-tile__hero-badge">
            <Hood size={18} />
            {equityPct && <span className="dsk-tile__equity">{equityPct}</span>}
            <span className="dsk-tile__stack">{(hero?.stack ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="dsk-tile__foot">
        <span className="dsk-tile__action">{formatAction(heroDecision?.action)}</span>
        <span className="dsk-tile__thought">
          {heroDecision?.reasoning ? `"${heroDecision.reasoning}"` : 'Waiting for the next decision…'}
        </span>
        <button type="button" className="dsk-tile__watch" onClick={onWatch}>WATCH →</button>
      </div>
    </div>
  );
}
