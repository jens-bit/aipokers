// A replay on the desk stage. Ported from D3ReplayScreenM in
// design-refs/mood-replay.jsx.
//
// "Nothing new is invented — the ALL-IN hold and the showdown reveal are the
// same beats, replayed." The mobile theatre makes that true by handing its own
// felt the same shape the server sends; this does the same with the desk felt.
// The same felt carries the pacing ladder and rope. Its replay flag keeps
// recorded completion separate from a live table waiting for another deal.
//
// Reused as they are: buildTimeline and beatAt (replay/timeline.js) own the
// reel, and Scrubber (replay/Scrubber.jsx) owns the transport. Nothing about
// either is reimplemented for the desk.
//
// Phone and desktop share the recorded-beat snapshot adapter. Missing historical
// fields stay absent, and opponent cards appear only at the recorded reveal.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DeskTableStage } from './DeskTableStage.jsx';
import { Scrubber } from '../replay/Scrubber.jsx';
import { beatAt, buildTimeline, snapshotFor } from '../replay/timeline.js';

// The reel advances in real time; 100ms is smooth enough and cheap enough,
// the same cadence the mobile theatre runs at.
const TICK_MS = 100;

export function DeskReplayStage({ hand, agentName, onBack, onOpenHand, autoPlay = true }) {
  const timeline = useMemo(() => buildTimeline(hand), [hand]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;
    rafRef.current = setInterval(() => {
      setAt((t) => {
        const next = t + TICK_MS / 1000;
        if (next >= timeline.total) { setPlaying(false); return timeline.total; }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(rafRef.current);
  }, [playing, timeline.total]);

  // A new hand starts its own reel rather than resuming somebody else's.
  useEffect(() => { setAt(0); setPlaying(autoPlay); }, [timeline, autoPlay]);

  const beat = beatAt(timeline, at);
  const seek = useCallback((t) => { setPlaying(false); setAt(t); }, []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const game = snapshotFor(timeline, beat, { ...hand, agentName: agentName ?? hand?.agentName });

  // His line at this moment, handed to the stage the way a live decision is.
  // `beat.action` is the flagged entry's own string ("raise 120"), not the
  // { type, amount } a live decision carries, so it is left off rather than
  // handed to a formatter that would quietly drop it.
  const lastDecision = beat.line
    ? { seat: 0, action: null, reasoning: beat.line, equity: beat.equity == null ? null : beat.equity / 100 }
    : null;

  return (
    <div className="dsk-replay">
      <div className="dsk-replay__stage">
        <DeskTableStage
          replay
          game={game}
          agentName={agentName}
          lastDecision={lastDecision}
          onBack={onBack}
        />
      </div>
      <div className="dsk-replay__scrub">
        <Scrubber
          timeline={timeline}
          at={at}
          playing={playing}
          streetLabel={beat.label === 'END' ? 'The end of it' : `The ${String(beat.label).toLowerCase()}`}
          meta={timeline.handNumber != null ? `HAND #${timeline.handNumber}` : null}
          onSeek={seek}
          onToggle={toggle}
          onOpenHand={onOpenHand}
        />
      </div>
    </div>
  );
}
