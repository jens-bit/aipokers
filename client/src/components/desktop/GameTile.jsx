import { Hood, MiniCard } from './primitives.jsx';
import { Streets } from '../../lib/protocol.js';
import { group } from '../../lib/wallet.js';

function formatAction(action) {
  if (!action?.type) return 'THINKING';
  const type = String(action.type).toUpperCase();
  return action.amount == null ? type : `${type} ${action.amount}`;
}

// UI-3 job B — THE OTHER MONITORS ARE NOT STILLS.
//
// `game`/`lastDecision` are the rich per-table WATCH subscription (model
// reasoning, equity), and they only ever exist for the one table the owner
// is actually watching. Every other live agent's tile used to get `game:
// null` and drew a silhouette — a hood, blank cards, POT 0 — for a table
// that is really being played right now.
//
// Every live agent already carries his own `liveGame` on the roster push
// (AGE-37 — the same compact, owner-scoped projection AwayWall's frames and
// the home television already play from): real seats, the board as far as
// it has run, the pot, and `toAct`. This file's only job is to stop
// discarding it. `normalizeTile` folds whichever of the two shapes is
// present into one the felt below can draw from without caring which.
export function normalizeTile(game, liveGame, lastDecision, agentName) {
  if (game) {
    // The watched table: match the hero seat by name, because both seats can
    // emit DECISION messages and the client cannot trust "the last one to
    // decide" to still be him.
    const seats = game.seats || [];
    const named = seats.findIndex((s) => s?.displayName === agentName);
    const heroIndex = named >= 0 ? named : 0;
    const oppIndex = seats.length ? (heroIndex + 1) % seats.length : 1;
    const heroDecision = lastDecision?.seat === heroIndex ? lastDecision : null;
    const equity = heroDecision?.equity;
    const board = [...(game.community || [])];
    while (board.length < 5) board.push(null);
    return {
      hero: seats[heroIndex] ?? null,
      opp: seats[oppIndex] ?? null,
      board,
      pot: game.pot ?? 0,
      handNumber: game.handNumber ?? 0,
      street: game.street,
      actionLabel: formatAction(heroDecision?.action),
      thought: heroDecision?.reasoning ? `"${heroDecision.reasoning}"` : 'Waiting for the next decision…',
      equityPct: Number.isFinite(equity) ? `${(equity * 100).toFixed(1)}%` : null,
    };
  }
  if (liveGame) {
    // A live agent nobody is watching. Real seats, real board, real pot —
    // AGE-37's own compact projection, owner-scoped so heroHole is his.
    const heroIndex = Number.isInteger(liveGame.heroSeat) ? liveGame.heroSeat : 0;
    const seats = liveGame.seats || [];
    const oppIndex = seats.length ? (heroIndex + 1) % seats.length : 1;
    const board = [...(liveGame.board || [])];
    while (board.length < 5) board.push(null);
    const toAct = liveGame.toAct;
    return {
      hero: seats[heroIndex]
        ? { ...seats[heroIndex], holeCards: liveGame.heroHole ?? null } : null,
      opp: seats[oppIndex] ?? null,
      board,
      pot: liveGame.pot ?? 0,
      handNumber: liveGame.handNumber ?? 0,
      street: liveGame.street,
      // No decision reasoning rides the roster push — that is the per-table
      // WATCH subscription's alone — so this says whose turn it actually is
      // and nothing it cannot back up.
      actionLabel: toAct === heroIndex ? 'HIS TURN' : toAct === oppIndex ? "OPPONENT'S TURN" : 'THINKING',
      thought: null,
      equityPct: null,
    };
  }
  return { hero: null, opp: null, board: [null, null, null, null, null], pot: 0, handNumber: 0, street: null, actionLabel: 'THINKING', thought: 'Waiting for the next decision…', equityPct: null };
}

// The watched agent is seated under its own display name; an unwatched one
// is placed by the seat AGE-37 already says is his.
export function GameTile({ game, liveGame, agentName, lastDecision, highlighted, dimmed, onWatch, onFocusTable }) {
  const { hero, opp, board, pot, handNumber, street, actionLabel, thought, equityPct } =
    normalizeTile(game, liveGame, lastDecision, agentName);
  const oppName = opp?.displayName || 'Opponent';
  const streetLabel = street && street !== Streets.WAITING ? String(street).toUpperCase() : 'WAITING';

  return (
    <div className={`dsk-tile${highlighted ? ' dsk-tile--hl' : ''}${dimmed ? ' dsk-tile--dim' : ''}`}>
      <div className="dsk-tile__head">
        <Hood size={22} />
        <div className="dsk-tile__head-text">
          <div className="dsk-tile__name-row">
            <span className="dsk-tile__name">{agentName || 'Agent'}</span>
            <span className="dsk-dot" style={{ width: 5, height: 5 }} aria-hidden />
          </div>
          <div className="dsk-tile__meta">
            HEADS-UP NLH · {handNumber ? `HAND #${handNumber}` : streetLabel}
          </div>
        </div>
        <span className="dsk-tile__live">LIVE</span>
      </div>

      <div className="dsk-tile__felt">
        <div className="dsk-tile__oval" aria-hidden />

        <div className="dsk-tile__opp">
          <div className="dsk-tile__opp-avatar">{oppName.slice(0, 2).toUpperCase()}</div>
          <div className="dsk-tile__cards">
            <MiniCard card={null} size="mini" />
            <MiniCard card={null} size="mini" />
          </div>
          <div className="dsk-tile__opp-name">
            {oppName} · {group(opp?.stack ?? 0)}
          </div>
        </div>

        <div className="dsk-tile__center">
          <div className="dsk-tile__pot">
            <small>POT</small>
            <b>{group(pot)}</b>
          </div>
          <div className="dsk-tile__cards">
            {board.map((card, i) => <MiniCard key={i} card={card} />)}
          </div>
        </div>

        <div className="dsk-tile__hero">
          <div className="dsk-tile__cards">
            <MiniCard card={hero?.holeCards?.[0]} size="hero" />
            <MiniCard card={hero?.holeCards?.[1]} size="hero" />
          </div>
          <div className="dsk-tile__hero-badge">
            <Hood size={18} />
            {equityPct && <span className="dsk-tile__equity">{equityPct}</span>}
            <span className="dsk-tile__stack">{group(hero?.stack ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="dsk-tile__foot">
        <span className="dsk-tile__action">{actionLabel}</span>
        <span className="dsk-tile__thought">{thought}</span>
        {onFocusTable
          ? <button type="button" className="dsk-tile__watch" onClick={onFocusTable}>FOCUS TABLE →</button>
          : <button type="button" className="dsk-tile__watch" onClick={onWatch}>WATCH →</button>
        }
      </div>
    </div>
  );
}
