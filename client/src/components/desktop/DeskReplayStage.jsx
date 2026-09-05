// A replay on the desk stage. Ported from D3ReplayScreenM in
// design-refs/mood-replay.jsx.
//
// "Nothing new is invented — the ALL-IN hold and the showdown reveal are the
// same beats, replayed." The mobile theatre makes that true by handing its own
// felt the same shape the server sends; this does the same with the desk felt.
// DeskTableStage does not know it is being replayed, which is why the pacing
// ladder and the rope DP-1 gave it work here for free.
//
// Reused as they are: buildTimeline and beatAt (replay/timeline.js) own the
// reel, and Scrubber (replay/Scrubber.jsx) owns the transport. Nothing about
// either is reimplemented for the desk.
//
// The one adapter below — a beat, as a table snapshot — is the same mapping
// ReplayTheatre does privately. That function is not exported from
// ReplayTheatre.jsx and replay/ is outside this branch's fence, so it lives
// here for now; it belongs in replay/timeline.js beside buildTimeline, and
// should move there the next time that file is in scope.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DeskTableStage } from './DeskTableStage.jsx';
import { Scrubber } from '../replay/Scrubber.jsx';
import { beatAt, buildTimeline } from '../replay/timeline.js';

// The reel advances in real time; 100ms is smooth enough and cheap enough,
// the same cadence the mobile theatre runs at.
const TICK_MS = 100;

// `beat.label` is a display string — 'PRE', not 'preflop' — so lowercasing it
// hands the stage a street it does not recognise, and the whole felt reads as
// between-hands. `beat.key` carries the real street, which is what the stage
// switches on.
function streetOf(beat) {
  if (beat.label === 'END') return 'complete';
  return String(beat.key ?? '').split('-')[0] || 'preflop';
}

function snapshotFor(timeline, beat, hand, agentName) {
  return {
    tableId: hand?.tableId ?? 'replay',
    handNumber: timeline.handNumber ?? 0,
    street: streetOf(beat),
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
        displayName: agentName ?? hand?.agentName ?? 'Your agent',
      },
      ...timeline.opponentShowdownCards.map((o) => ({
        playerId: `opp-${o.seat}`,
        stack: null,
        // The villain's hand is public only once it was actually turned over.
        holeCards: beat.label === 'END' ? (o.holeCards ?? []) : [],
        folded: false,
        displayName: o.displayName ?? `Seat ${o.seat + 1}`,
      })),
    ],
    result: null,
  };
}

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

  const game = snapshotFor(timeline, beat, hand, agentName);

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
