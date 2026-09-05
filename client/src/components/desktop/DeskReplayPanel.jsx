// The replay's rail panel. Ported from the Panel half of D3ReplayScreenM in
// design-refs/mood-replay.jsx: the poster, then his line street by street.
//
// ReplayCard is the mobile component, unchanged. The beat list below it reads
// the same timeline the stage is playing, so the rail and the felt can never
// disagree about what he said.

import { useMemo } from 'react';

import { ReplayCard } from '../replay/ReplayCard.jsx';
import { FLAGS, buildTimeline } from '../replay/timeline.js';
import { PanelHead, RailBody } from './panelParts.jsx';

export function DeskReplayPanel({ hand, onOpenHand, onClose }) {
  const timeline = useMemo(() => buildTimeline(hand), [hand]);
  const flag = FLAGS[timeline.flag] ?? null;

  const spoken = timeline.beats.filter((b) => b.line);

  const sub = [
    timeline.handNumber != null ? `HAND #${timeline.handNumber}` : null,
    flag?.label,
  ].filter(Boolean).join(' · ');

  return (
    <div className="dsk-panel">
      <PanelHead title="Replay" sub={sub || 'REPLAY'} onClose={onClose} />
      <RailBody>
        <ReplayCard hand={hand} onOpen={onOpenHand} />

        <div className="dsk-apanel">
          <div className="dsk-apanel__head">
            <span className="dsk-label" style={{ fontSize: 9.5 }}>His line, street by street</span>
          </div>
          <div className="dsk-apanel__body">
            {spoken.length === 0 ? (
              <div className="dsk-apanel__empty">He did not say anything this hand.</div>
            ) : spoken.map((b, i) => (
              <div key={`${b.label}-${i}`} className="dsk-beat" data-loud={b.pace === 'allin' || undefined}>
                <span className="dsk-beat__label">{b.label}</span>
                <span className="dsk-beat__line">{b.line}</span>
              </div>
            ))}
          </div>
        </div>
      </RailBody>
    </div>
  );
}
