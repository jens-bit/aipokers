// REPLAY-1 (R-2) — the scrubber.
// Port of Scrubber from design-refs/mood-replay.jsx.
//
// The flag, where you are in the reel, a tick per beat, and one control. The
// track is the whole point: a replay you cannot scrub is a video, and the
// reason to build this rather than link a video is that the owner wants to go
// back to the moment it turned.
//
// Styles in styles/replay.css.

function PlayIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden>
      <path d="M2 1.5v11l9.5-5.5z" fill="#0A0A0A" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden>
      <rect x="1" y="1" width="3.4" height="11" rx="1" fill="#0A0A0A" />
      <rect x="7.6" y="1" width="3.4" height="11" rx="1" fill="#0A0A0A" />
    </svg>
  );
}

export function Scrubber({ timeline, at, playing, streetLabel, meta, onSeek, onToggle, onOpenHand }) {
  const total = timeline.total || 1;
  const pct = Math.max(0, Math.min(100, (at / total) * 100));

  return (
    <div className="replay-scrub">
      <div className="replay-scrub__head">
        <span className={`replay-flag replay-flag--${timeline.flag.tone}`}>{timeline.flag.label}</span>
        <span className="replay-scrub__meta">{meta}</span>
        <span className="replay-scrub__clock">{Math.round(at)}s / {Math.round(total)}s</span>
      </div>

      <div className="replay-scrub__track">
        <div className="replay-scrub__rail" />
        <div className="replay-scrub__fill" style={{ width: `${pct}%` }} />

        {timeline.beats.map((beat) => {
          const left = `${(beat.at / total) * 100}%`;
          const passed = beat.at <= at;
          return (
            <div key={beat.key} className={`replay-scrub__tick${passed ? ' is-passed' : ''}`} style={{ left }}>
              <div className="replay-scrub__tick-line" />
              <span className="replay-scrub__tick-label">{beat.label}</span>
            </div>
          );
        })}

        <div className="replay-scrub__thumb" style={{ left: `calc(${pct}% - 6px)` }} />

        {/* The range input is the actual control — invisible, on top, and the
            only thing here a keyboard or a screen reader can drive. */}
        <input
          className="replay-scrub__input"
          type="range"
          min={0}
          max={total}
          step={0.1}
          value={at}
          aria-label="Scrub the replay"
          onChange={(e) => onSeek?.(Number(e.target.value))}
        />
      </div>

      <div className="replay-scrub__controls">
        <button
          type="button"
          className="replay-scrub__play"
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="replay-scrub__where">
          <span className="replay-scrub__where-lbl">Street</span>
          <div className="replay-scrub__where-text">{streetLabel}</div>
        </div>
        {onOpenHand && (
          <button type="button" className="replay-scrub__open" onClick={onOpenHand}>Open hand</button>
        )}
      </div>
    </div>
  );
}
