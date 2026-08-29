// The zoom — tap a ghost, the camera pushes in and the agent turns forward
// to speak its latest moment. Ported from ZoomView in mood-casino.jsx.

import { FloorGhost, MoodChip, StateTag, PotTicker, MOODS, safeMood, accentFor } from './atoms.jsx';
import { moodOf, causeOf, stateOf, lastMomentOf, presenceOf } from './agentView.js';

export function FloorZoom({ agent, index = 0, livePot, onBack, onChat, onWatch }) {
  const mood = moodOf(agent);
  const m = MOODS[safeMood(mood)];
  const accent = accentFor(agent, index);
  const state = stateOf(agent);
  const playing = presenceOf(agent) === 'playing';
  const cause = causeOf(agent);
  const pot = Number.isFinite(livePot) && livePot > 0 ? livePot.toLocaleString() : null;

  return (
    <div className="floor-zoom">
      <div className="floor-zoom__scrim" />

      <button type="button" className="floor-zoom__back" onClick={onBack} aria-label="Back to the floor">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {pot && (
        <div className="floor-zoom__pot">
          <PotTicker x={195} y={0} amount={pot} />
        </div>
      )}

      <div className="floor-zoom__bubble-wrap" style={{ top: pot ? 58 : 30 }}>
        <div className="floor-zoom__bubble" style={{ borderColor: `${m.color}66`, boxShadow: `0 0 22px ${m.color}22` }}>
          “{lastMomentOf(agent)}”
        </div>
      </div>

      <div className="floor-zoom__ghost" style={{ top: pot ? 178 : 152 }}>
        <FloorGhost mood={mood} accent={accent} size={132} speed={5} />
      </div>
      <div
        className="floor-zoom__ghost-shadow"
        style={{
          top: pot ? 356 : 330,
          background: `radial-gradient(ellipse, ${m.color}33, transparent 70%)`,
        }}
      />

      <div className="floor-zoom__panel">
        <div className="floor-zoom__tags">
          <MoodChip mood={mood} />
          <StateTag state={state} compact />
        </div>
        {cause && (
          <div className="floor-zoom__cause" style={{ color: m.color }}>{cause}</div>
        )}
        <div className="floor-zoom__actions">
          {playing ? (
            <>
              <div style={{ flex: 1.3 }}>
                <button type="button" className="floor-btn floor-btn--primary" onClick={onWatch}>
                  Watch the table
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <button type="button" className="floor-btn floor-btn--ghost" onClick={onChat}>
                  Chat
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1 }}>
              <button type="button" className="floor-btn floor-btn--primary" onClick={onChat}>
                Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
