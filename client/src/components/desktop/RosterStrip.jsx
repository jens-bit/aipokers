// FIX-2c — the collapsed roster.
// Port of design-refs/mood-desktop3.jsx RosterStrip, the `collapsed` form of
// ThreadRosterRail.
//
// The ref's finding: 1440 does not fit 340 roster + stage + 520 panel. Its
// chosen answer is to collapse the roster to a 68px avatar strip the moment a
// panel opens — same rows, same order, name / state tag / last line dropped,
// mood rim and live dot kept. Losing the stage instead was rejected, because
// "the room going away when you open a card is exactly the modal behaviour the
// desktop layout was built to avoid".
//
// In this shell the roster lives inside StandupPanel, so opening a thread
// replaced it outright — the who-is-playing glance was not merely narrowed, it
// was gone. The strip gives it back at 68px: 68 + stage + 520 = 1440 exactly.
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, heatOf, stateOf } from '../floor/agentView.js';
import { PHood } from './panelParts.jsx';

export function RosterStrip({ agents = [], activeId, onSelect }) {
  if (!agents.length) return null;

  return (
    <div className="dsk-strip">
      <div className="dsk-strip__head">
        <span className="dsk-strip__count">{agents.length}</span>
      </div>
      <div className="dsk-strip__rows">
        {agents.map((agent, i) => {
          const state = stateOf(agent);
          return (
            <button
              key={agent.id}
              type="button"
              title={agent.name}
              aria-label={agent.name}
              aria-current={activeId === agent.id ? 'true' : undefined}
              className={`dsk-strip__row${activeId === agent.id ? ' is-active' : ''}`}
              onClick={() => onSelect?.(agent)}
            >
              <PHood size={34} accent={accentFor(agent, i)} mood={moodOf(agent)} heat={heatOf(agent)} />
              {state === 'live' && <span className="dsk-strip__dot dsk-dot" aria-hidden />}
              {state === 'recap' && <span className="dsk-strip__dot dsk-strip__dot--recap" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
