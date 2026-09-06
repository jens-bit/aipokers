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
import { ShareButton } from '../share/ShareButton.jsx';
import { PlayingCard } from '../system/PlayingCard.jsx';
import { Scrubber } from './Scrubber.jsx';
import { beatAt, buildTimeline, snapshotFor } from './timeline.js';

// The reel advances in real time; 100ms is smooth enough for a 28-second reel
// and cheap enough to run on a phone.
const TICK_MS = 100;

// Where the felt sits in the theatre. The watch screen's sheet drags between
// three detents; a replay has no sheet, so it takes the expanded one and holds
// it — the scrubber owns the space below.
const FELT_FRAC = 306 / 639;

// The header above the stage region, from .replay-theatre__header in replay.css.
const HEADER_H = 40;

function formatWhen(ts) {
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function ReplayTheatre({ hand, agentId, onBack, onOpenHand, autoPlay = true }) {
  const timeline = useMemo(() => buildTimeline(hand), [hand]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const atRef = useRef(0);
  atRef.current = at;
  // FIX-4: the reel's length is read off a ref rather than closed over, so the
  // effect below depends on `playing` and nothing else. `hand` arrives as a
  // fresh object from every caller (ChatsScreen spreads the agent's name onto
  // it), so `timeline` is a new object on every render — a dependency on
  // anything hanging off it is a dependency that can clear a running interval
  // out from under the reel. Playing is a mode, not a value: only entering and
  // leaving it may touch the timer.
  const totalRef = useRef(timeline.total);
  totalRef.current = timeline.total;

  // The reel. Elapsed time, not an accumulator: adding a fixed step per tick
  // drifts on a busy main thread and loses every tick React batches together,
  // so the reel is always "how long since play began" instead. Stops itself at
  // the end rather than looping — a replay that loops is a screensaver, and the
  // point is the one moment it turned.
  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = Date.now() - atRef.current * 1000;
    const id = setInterval(() => {
      const total = totalRef.current;
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed >= total) {
        setAt(total);
        setPlaying(false);
      } else {
        setAt(elapsed);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const seek = useCallback((t) => {
    setPlaying(false);
    setAt(Math.max(0, Math.min(totalRef.current, t)));
  }, []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      // Pressing play at the end starts it over, which is the only way back in.
      if (!p && atRef.current >= totalRef.current) setAt(0);
      return !p;
    });
  }, []);

  const beat = beatAt(timeline, at) ?? timeline.beats[0];
  const snapshot = useMemo(() => snapshotFor(timeline, beat, hand), [timeline, beat, hand]);

  // The felt's own geometry, at the expanded detent.
  //
  // FIX-4: measured off the theatre, not off the stage. .replay-theatre__stage
  // has no height of its own — its only child is the felt, whose height IS
  // `feltGeometry(FELT_FRAC, stagePx).felt`. Observing it fed the felt's height
  // back in as the stage's, so every notification shrank the next one by the
  // same 306/639 and the felt collapsed to nothing within half a second, taking
  // the board and the reveal with it. The theatre's own box is the viewport's
  // (`height: var(--tg-h)`), so it cannot answer with a number it was given.
  const rootRef = useRef(null);
  const [stagePx, setStagePx] = useState(() => (
    typeof window === 'undefined' ? 639 : Math.max(320, window.innerHeight - HEADER_H)
  ));
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h > 0) setStagePx(Math.max(320, h - HEADER_H));
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
    <div className="replay-theatre" ref={rootRef}>
      <div className="replay-theatre__header">
        <button type="button" className="replay-theatre__back" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="replay-theatre__title">Replay</span>
        {/* SHARE-1 — the hand you just watched, as a card someone else can see. */}
        <ShareButton hand={hand} agentId={agentId ?? hand?.agentId} agentName={hand?.agentName} mood={hand?.mood} style={{ marginLeft: 'auto' }} />
      </div>

      <div className="replay-theatre__stage">
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
