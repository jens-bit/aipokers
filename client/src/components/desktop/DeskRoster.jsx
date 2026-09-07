// client/src/components/desktop/DeskRoster.jsx — DESK-3
//
// The left column, permanently. Board 31 wave 58 addendum
// (design-refs/mood-desk59.jsx DkRoster): "who you have, where each one is" —
// a real column, not a mode the panel state toggles it into. It replaces
// FIX-2c's RosterStrip, which only appeared at 68px once a panel had already
// taken the room's place; DESK-3's law is that nothing here slides over
// anything, so the roster is furniture now, on every desktop screen.
//
// It reuses PRosterRow — the same row StandupPanel already draws inside the
// rail — rather than a second row component, so a man cannot look like two
// different people depending on which column he is standing in.
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, heatOf, stateOf, lastMomentOf } from '../floor/agentView.js';
import { PRosterRow } from './panelParts.jsx';
import { gainsWithin, grewWithin } from '../../lib/attributes.js';

const MAX_SEATS = 4;

function fmtNet(net) {
  if (!Number.isFinite(net) || net === 0) return '—';
  return net < 0 ? `−$${Math.abs(net).toLocaleString()}` : `+$${net.toLocaleString()}`;
}

export function DeskRoster({
  agents = [], activeId = null, watchedId = null, onSelect, onDraftAgent,
}) {
  const seatsLeft = Math.max(0, MAX_SEATS - agents.length);
  return (
    <div className="dsk3-roster" data-testid="desk-roster">
      <div className="dsk3-roster__head">
        <span className="dsk-label" style={{ fontSize: 9 }}>Your agents</span>
        <span className="dsk3-roster__count">{agents.length} of {MAX_SEATS}</span>
      </div>
      <div className="dsk3-roster__rows">
        {agents.map((agent, i) => (
          <PRosterRow
            key={agent.id}
            name={agent.name}
            accent={accentFor(agent, i)}
            mood={moodOf(agent)}
            heat={heatOf(agent)}
            state={stateOf(agent)}
            line={lastMomentOf(agent)}
            pnl={fmtNet(agent.careerStats?.net)}
            grew={grewWithin(agent.attrLog)
              ? gainsWithin(agent.attrLog).reduce((n, g) => n + g.gain, 0)
              : 0}
            active={activeId === agent.id || watchedId === agent.id}
            onClick={() => onSelect?.(agent)}
          />
        ))}
        {seatsLeft > 0 && onDraftAgent && (
          <button type="button" className="dsk3-roster__draft" onClick={onDraftAgent}>
            <span className="dsk3-roster__draft-plus" aria-hidden>+</span>
            <span>
              <span className="dsk3-roster__draft-title">
                {agents.length === 0 ? 'Draft your first agent' : 'Draft another'}
              </span>
              <span className="dsk3-roster__draft-sub">
                {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
