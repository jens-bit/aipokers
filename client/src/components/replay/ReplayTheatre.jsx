// REPLAY-1 (R-2) — the theatre.
// Port of ReplayTheatreScreenM / ReplayRevealScreenM from
// design-refs/mood-replay.jsx.
//
// "Nothing new is invented — the ALL-IN hold and the showdown reveal are the
// same beats, replayed." So this drives Watch v3's own felt: PaceFelt's pacing
// states, the rope, HeroRow3. The only new furniture is the scrubber and the
// beat panel under it.
//
// Styles in styles/replay.css.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { WatchFelt, feltGeometry } from '../WatchScreen.jsx';
import { PlayingCard } from '../system/PlayingCard.jsx';
import { Scrubber } from './Scrubber.jsx';
import { beatAt, buildTimeline } from './timeline.js';

// The reel advances in real time; 100ms is smooth enough for a 28-second reel
// and cheap enough to run on a phone.
const TICK_MS = 100;

// Where the felt sits in the theatre. The watch screen's sheet drags between
// three detents; a replay has no sheet, so it takes the expanded one and holds
// it — the scrubber owns the space below.
const FELT_FRAC = 306 / 639;

function formatWhen(ts) {
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * One beat, as a table snapshot. The felt does not know it is being replayed —
 * it is handed the same shape the server sends and draws it the same way.
 */
function snapshotFor(timeline, beat, hand) {
  return {
    tableId: hand?.tableId ?? 'replay',
    handNumber: timeline.handNumber ?? 0,
    street: beat.label === 'END' ? 'complete' : String(beat.label).toLowerCase(),
    smallBlind: null,
    bigBlind: null,
    pot: beat.pot,
    community: beat.board,
    currentBet: 0,
    toAct: null,
    pace: beat.pace,
    heroEquity: beat.equity == null ? null : beat.equity / 100,
    seats: [
      {
        playerId: 'hero',
        stack: null,
        holeCards: timeline.holeCards,
        folded: false,
        displayName: hand?.agentName ?? 'Your agent',
      },
      ...timeline.opponentShowdownCards.map((o) => ({
        playerId: `opp-${o.seat}`,
        stack: null,
        holeCards: beat.label === 'END' ? (o.holeCards ?? []) : [],
        folded: false,
        displayName: o.displayName ?? `Seat ${o.seat + 1}`,
      })),
    ],
    result: null,
  };
}

export function ReplayTheatre({ hand, onBack, onOpenHand, autoPlay = true }) {
  const timeline = useMemo(() => buildTimeline(hand), [hand]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const atRef = useRef(0);
  atRef.current = at;

  // The reel. Elapsed time, not an accumulator: adding a fixed step per tick
  // drifts on a busy main thread and loses every tick React batches together,
  // so the reel is always "how long since play began" instead. Stops itself at
  // the end rather than looping — a replay that loops is a screensaver, and the
  // point is the one moment it turned.
  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = Date.now() - atRef.current * 1000;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed >= timeline.total) {
        setAt(timeline.total);
        setPlaying(false);
      } else {
        setAt(elapsed);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, timeline.total]);

  const seek = useCallback((t) => {
    setPlaying(false);
    setAt(Math.max(0, Math.min(timeline.total, t)));
  }, [timeline.total]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      // Pressing play at the end starts it over, which is the only way back in.
      if (!p && atRef.current >= timeline.total) setAt(0);
      return !p;
    });
  }, [timeline.total]);

  const beat = beatAt(timeline, at) ?? timeline.beats[0];
  const snapshot = useMemo(() => snapshotFor(timeline, beat, hand), [timeline, beat, hand]);

  // The felt's own geometry, at the expanded detent.
  const stageRef = useRef(null);
  const [stagePx, setStagePx] = useState(() => (
    typeof window === 'undefined' ? 639 : Math.max(320, window.innerHeight - 260)
  ));
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h > 0) setStagePx(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const geom = feltGeometry(FELT_FRAC, stagePx);

  const when = formatWhen(hand?.flaggedAt);
  const meta = [
    timeline.handNumber != null ? `Hand #${timeline.handNumber}` : null,
    when,
  ].filter(Boolean).join(' · ');

  const showdown = beat.label === 'END' && timeline.opponentShowdownCards.length > 0;

  return (
    <div className="replay-theatre">
      <div className="replay-theatre__header">
        <button type="button" className="replay-theatre__back" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="replay-theatre__title">Replay</span>
      </div>

      <div className="replay-theatre__stage" ref={stageRef}>
        <WatchFelt
          game={snapshot}
          mySeat={0}
          handEquity={null}
          flipped={beat.flip}
          line={beat.line}
          geom={geom}
        />
      </div>

      <Scrubber
        timeline={timeline}
        at={at}
        playing={playing}
        streetLabel={beat.label === 'END' ? 'The end of it' : `The ${String(beat.label).toLowerCase()}`}
        meta={meta}
        onSeek={seek}
        onToggle={toggle}
        onOpenHand={onOpenHand}
      />

      <div className="replay-theatre__panel">
        {/* What he said at this moment, and what it cost him. Both are his — the
            panel never adds a verdict of its own. */}
        {beat.line && <div className="replay-theatre__line">“{beat.line}”</div>}

        {beat.attrCosts.map((cost, i) => (
          <div className="replay-theatre__cost" key={`${cost.key}-${i}`}>
            <span className="replay-theatre__cost-note">{cost.line}</span>
            <span className="replay-theatre__cost-key">{cost.key}</span>
          </div>
        ))}

        {showdown && (
          <div className="replay-theatre__showdown">
            <div className="replay-theatre__cards">
              {timeline.holeCards.map((c, i) => (
                typeof c === 'string' && c.length >= 2
                  ? <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={34} h={47} />
                  : null
              ))}
            </div>
            <div className="replay-theatre__showdown-text">
              {timeline.opponentShowdownCards.map((o) => (
                <div key={o.seat} className="replay-theatre__shown">
                  {(o.displayName ?? `Seat ${o.seat + 1}`)} showed {(o.holeCards ?? []).join(' ')}
                </div>
              ))}
            </div>
            <span className={`replay-theatre__pnl${timeline.won ? '' : ' is-lost'}`}>
              {timeline.won ? '+' : '−'}${timeline.pot.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
