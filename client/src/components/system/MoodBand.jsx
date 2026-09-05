// Port of MoodBand from design-refs/mood-atoms.jsx.
// FIX-2a: the ww-ref header budget puts this band at 56px, not 64 — ghost
// 42->38, bottom pad 11->8, cause line unchanged at 11.5px.
// Thread context band — sits under the global header, carries mood + state + action.
// Props: accent, mood, cause, state, action (label for the right button)

import { MoodGhost } from './MoodGhost.jsx';
import { MoodChip, StateTag } from '../floor/atoms.jsx';

export function MoodBand({ accent = '#00D4AA', mood = 'neutral', cause, state = 'resting', action, onAction }) {
  const moodColors = {
    confident: '#00D4AA',
    neutral:   '#888888',
    frustrated:'#CDB380',
    tilted:    '#FF4D4F',
    sulking:   '#6B6B6B',
  };
  const mColor = moodColors[mood] || moodColors.neutral;

  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.12)',
      background: '#232329',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}55`,
        boxShadow: `0 0 14px ${mColor}33`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={accent} size={36} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MoodChip mood={mood} small />
          <StateTag state={state} compact />
        </div>
        {cause && (
          <div style={{
            fontSize: 11.5, color: mColor, marginTop: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--sys-font-body, "Inter", system-ui, sans-serif)',
          }}>{cause}</div>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            /* FIX-1d: base.css floors buttons at --tap (44px), which grew this
               row past the design's 63px. The ref sizes it at 30. */
            height: 30, minHeight: 0, padding: '0 13px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: `1px solid ${state === 'live' ? 'rgba(255,255,255,0.10)' : '#00D4AA'}`,
            color: state === 'live' ? '#A1A1A1' : '#00D4AA',
            fontFamily: 'var(--sys-font-label, "Oswald", sans-serif)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >{action}</button>
      )}
    </div>
  );
}
