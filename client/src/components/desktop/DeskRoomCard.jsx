// "The room", as a rail card. Ported from the Panel half of D4Floor2ScreenM in
// design-refs/mood-casino2.jsx.
//
// Wave 34's fourth rule — a resting room still breathes — says the standup
// names what actually happened rather than passing a verdict on the room. On
// the phone that is one line under the floor. The desk has a rail, so it gets
// the census and then the list the line is drawn from: who has news, and what
// the news is.
//
// Every reading is the floor's own. splitFloor, newsPipFor and grewCount come
// from floor/agentView.js and RestPip from floor/atoms.jsx, so the pip beside
// a name here and the pip at that agent's feet on the floor are the same
// answer to the same question — they cannot disagree.

import { RestPip, accentFor } from '../floor/atoms.jsx';
import { grewCount, moodOf, heatOf, newsPipFor, splitFloor } from '../floor/agentView.js';
import { PHood } from './panelParts.jsx';

export function DeskRoomCard({ agents = [], arrivingId = null, onSelect }) {
  const { playing, resting, lounge } = splitFloor(agents);
  const arriving = arrivingId ? agents.filter((a) => a.id === arrivingId) : [];

  // An arriving body is counted where he is going, not twice — the same
  // one-ghost rule the floor draws by.
  const restingCount = resting.length + lounge.length - arriving.length;

  const census = [
    playing.length > 0 ? `${playing.length} LIVE` : null,
    restingCount > 0 ? `${restingCount} RESTING` : null,
    arriving.length > 0 ? `${arriving.length} ARRIVING` : null,
  ].filter(Boolean).join(' · ') || 'THE ROOM IS OPEN';

  // No news, no row. The card is not a roster — it is the shortlist of things
  // that changed while the owner was not looking.
  const newsRows = agents
    .map((agent, i) => ({ agent, i, pip: newsPipFor(agent) }))
    .filter((r) => r.pip);

  return (
    <div className="dsk-room">
      <div className="dsk-room__head">
        <span className="dsk-label" style={{ fontSize: 9.5 }}>The room</span>
        <span className="dsk-room__census">{census}</span>
      </div>

      {newsRows.length === 0 ? (
        <div className="dsk-apanel__empty">Nothing happened while you were away.</div>
      ) : (
        <div className="dsk-room__rows">
          {newsRows.map(({ agent, i, pip }) => (
            <button
              type="button"
              key={agent.id}
              className="dsk-room__row"
              onClick={() => onSelect?.(agent)}
              disabled={!onSelect}
            >
              <PHood size={20} accent={accentFor(agent, i)} mood={moodOf(agent)} heat={heatOf(agent)} />
              <span className="dsk-room__name">{agent.name}</span>
              <RestPip kind={pip} count={grewCount(agent)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
