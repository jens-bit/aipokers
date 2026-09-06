// SHARE-1 — the card on screen.
//
// Port of ShareCard from design-refs/mood-share.jsx, carrying the hand the
// brief asks for: his face and name, his two cards, the board, what it came to,
// and one line of his own talk. The ref's composition is unchanged — the felt's
// arc as the only ornament, his mood as the light behind him, the mark small
// enough not to look like an ad.
//
// This is what the user sees before they send it. drawShareCard.js paints the
// same model onto a canvas for the file that actually leaves the phone; both
// read buildShareModel and neither decides anything of its own.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { PlayingCard } from '../system/PlayingCard.jsx';
import { BASE } from './drawShareCard.js';

const TEXT = '#EDEDED';
const DIM = '#A1A1A1';
const MUTED = '#6B6B6B';
const INTER = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const OSWALD = "'Oswald', 'Inter', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/**
 * @param {{ model: object, size?: number, ghostRef?: import('react').Ref }} props
 *   ghostRef — the export needs the rendered ghost node to draw his face into
 *   the PNG; it is the one thing canvas cannot paint for itself.
 */
export function ShareCard({ model, size = BASE, ghostRef = null }) {
  const u = (n) => (n * size) / BASE;
  const pad = u(26);

  return (
    <div
      className="share-card"
      data-testid="share-card"
      style={{
        width: size, height: size, position: 'relative', overflow: 'hidden', flexShrink: 0,
        background: 'radial-gradient(ellipse at 50% 40%, #24302C 0%, #171F1D 58%, #0E1413 100%)',
        fontFamily: INTER, borderRadius: u(4),
      }}
    >
      {/* the felt's own arc, as the only ornament */}
      <div style={{
        position: 'absolute', left: '-18%', right: '-18%', top: u(60),
        height: size * 0.62, borderRadius: '50%',
        border: '1px solid rgba(0,212,170,0.12)',
      }} />
      {/* his mood, as the light behind him */}
      <div style={{
        position: 'absolute', left: '50%', top: '30%',
        width: size * 0.84, height: size * 0.84, transform: 'translate(-50%,-50%)',
        background: `radial-gradient(circle, ${model.moodColor}2E, transparent 68%)`,
      }} />

      <div style={{
        position: 'absolute', left: pad, right: pad, top: u(18),
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div ref={ghostRef} style={{ lineHeight: 0 }}>
          <MoodGhost mood={model.mood} heat={model.heat} accent={model.moodColor} size={u(76)} ring={false} />
        </div>
        <div style={{ marginTop: u(6), display: 'flex', alignItems: 'center', gap: u(7) }}>
          <span style={{ fontSize: u(13), color: DIM, fontWeight: 500 }}>{model.name}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: u(18), padding: `0 ${u(6.5)}px`,
            borderRadius: u(3), background: `${model.flag.color}1A`,
            border: `1px solid ${model.flag.color}66`, color: model.flag.color,
            fontFamily: OSWALD, fontSize: u(9), fontWeight: 600, letterSpacing: '0.12em',
          }}>{model.flag.label}</span>
        </div>
      </div>

      {/* his two, then the board — the board sits a shade lower so his read as his */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: u(134),
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: u(15),
      }}>
        {model.holeCards.length > 0 && (
          <div style={{ display: 'flex', gap: u(4) }}>
            {model.holeCards.map((c, i) => (
              <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={u(40)} h={u(55)} />
            ))}
          </div>
        )}
        {model.board.length > 0 && (
          <div style={{ display: 'flex', gap: u(3), marginTop: u(8) }}>
            {model.board.map((c, i) => (
              <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={u(30)} h={u(41)} />
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: pad, right: pad, top: u(202), textAlign: 'center' }}>
        <div style={{
          fontFamily: PLAYFAIR, fontWeight: 600, fontSize: u(24), lineHeight: 1.15,
          color: TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: model.resultColor }}>{model.amount}</span>
          {model.hand ? ` · ${model.hand}` : ''}
        </div>

        {model.talk && (
          <>
            <div style={{
              width: u(40), height: 1, background: 'rgba(255,255,255,0.14)',
              margin: `${u(14)}px auto 0`,
            }} />
            <div style={{
              marginTop: u(11), fontSize: u(13), lineHeight: 1.45,
              color: model.moodColor, fontStyle: 'italic',
            }}>“{model.talk}”</div>
          </>
        )}
      </div>

      <div style={{
        position: 'absolute', left: pad, right: pad, bottom: u(16),
        display: 'flex', alignItems: 'center', gap: u(8),
      }}>
        <span style={{ fontSize: u(13), color: TEXT, lineHeight: 1 }}>♠</span>
        <span style={{
          fontFamily: OSWALD, fontSize: u(10), fontWeight: 600, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: TEXT,
        }}>{model.mark}</span>
        <div style={{ flex: 1 }} />
        {model.stamp && (
          <span style={{
            fontFamily: MONO, fontSize: u(9), color: MUTED, letterSpacing: '0.06em',
          }}>{model.stamp}</span>
        )}
      </div>
    </div>
  );
}
