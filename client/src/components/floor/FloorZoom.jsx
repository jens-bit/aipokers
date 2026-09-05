// The zoom -- tap a ghost, the camera pushes in and the agent turns forward
// to speak its latest moment. Ported from ZoomView in mood-casino.jsx.

import { FloorGhost, MoodChip, StateTag, PotTicker, MOODS, safeMood, accentFor } from './atoms.jsx';
import { moodOf, causeOf, stateOf, lastMomentOf, presenceOf } from './agentView.js';
import { LiveBar } from '../system/LiveBar.jsx';
import { fatigueOf, FATIGUE, fatigueLineFor } from '../../lib/attributes.js';

// ATTR-2e-2 — ZoomFatigueRow (design-refs/char-play.jsx).
// The strip stays the GAME. Fatigue is a fact about HIM, so it docks directly
// under the strip and reads as its second line. Only ever drawn at 'worn':
// below that there is no cost to name, and naming one would be a lie.
function ZoomFatigueRow({ agent }) {
  const stage = fatigueOf(agent);
  if (stage !== 'worn') return null;
  const f = FATIGUE[stage];
  const hands = agent?.liveGame?.heroSessionHands;
  // The refs put "FOCUS −6" at the end of this row. The server computes that
  // drop in effectiveAttrs() but sends only the stage, so the delta is not on
  // the wire — and his current FOCUS is a stat, not a cost. The sentence
  // already names the cost ("Focus dipping"), so nothing trails it.

  return (
    <div style={{
      marginTop: -4, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 10,
      background: 'rgba(205,179,128,0.05)', border: '1px solid rgba(205,179,128,0.24)',
    }}>
      <div style={{ display: 'flex', gap: 3, width: 40, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 2.5,
            background: i < f.blocks ? '#CDB380' : '#2F2F37',
            boxShadow: i < f.blocks ? '0 0 6px rgba(205,179,128,0.27)' : 'none',
          }} />
        ))}
      </div>
      <span style={{ flex: 1, fontSize: 12.5, color: '#CDB380', lineHeight: 1.4 }}>
        {fatigueLineFor(stage, hands)}
      </span>
    </div>
  );
}

function parseBoard(rawBoard) {
  if (!Array.isArray(rawBoard)) return [];
  return rawBoard.map(function(c) { return (c && c.length >= 2) ? [c[0], c[1]] : null; });
}

export function FloorZoom({ agent, index = 0, livePot, onBack, onChat, onWatch, onProfile, onDeploy }) {
  const mood = moodOf(agent);
  const m = MOODS[safeMood(mood)];
  const accent = accentFor(agent, index);
  const state = stateOf(agent);
  const playing = presenceOf(agent) === 'playing';
  const cause = causeOf(agent);
  const pot = Number.isFinite(livePot) && livePot > 0 ? livePot.toLocaleString() : null;

  const liveGame = agent ? agent.liveGame || null : null;

  // With liveGame: bubble at 30, LiveBar at 118, ghost at 198, shadow at 376.
  // Without liveGame, legacy: bubble at pot ? 58 : 30, ghost at pot ? 178 : 152.
  const bubbleTop = liveGame ? 30 : (pot ? 58 : 30);
  const ghostTop  = liveGame ? 198 : (pot ? 178 : 152);
  const shadowTop = liveGame ? 376 : (pot ? 356 : 330);

  return (
    <div className="floor-zoom">
      <div className="floor-zoom__scrim" />

      <button type="button" className="floor-zoom__back" onClick={onBack} aria-label="Back to the floor">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {!liveGame && pot && (
        <div className="floor-zoom__pot">
          <PotTicker amount={pot} plain />
        </div>
      )}

      <div className="floor-zoom__bubble-wrap" style={{ top: bubbleTop }}>
        <div className="floor-zoom__bubble" style={{ borderColor: m.color + '66', boxShadow: '0 0 22px ' + m.color + '22' }}>
          {'"'}{lastMomentOf(agent)}{'"'}
        </div>
      </div>

      {liveGame && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 118, zIndex: 2 }}>
          <LiveBar
            strip
            table={liveGame.tableId || ''}
            blinds={liveGame.blinds || ''}
            street={liveGame.street || ''}
            pot={liveGame.pot || 0}
            equity={liveGame.equity || null}
            action={liveGame.lastAction || null}
            board={parseBoard(liveGame.board)}
            faceDown={!liveGame.board || liveGame.board.length === 0}
          />
        </div>
      )}

      <div className="floor-zoom__ghost" style={{ top: ghostTop }}>
        <FloorGhost mood={mood} accent={accent} size={132} speed={5} />
      </div>
      <div
        className="floor-zoom__ghost-shadow"
        style={{
          top: shadowTop,
          background: 'radial-gradient(ellipse, ' + m.color + '33, transparent 70%)',
        }}
      />

      <div className="floor-zoom__panel">
        <ZoomFatigueRow agent={agent} />
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
            <>
              <div style={{ flex: 1.3 }}>
                <button type="button" className="floor-btn floor-btn--primary" onClick={onDeploy}>
                  Deal him in
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <button type="button" className="floor-btn floor-btn--ghost" onClick={onChat}>
                  Chat
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <button type="button" className="floor-btn floor-btn--ghost" onClick={onProfile}>
                  Profile
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
