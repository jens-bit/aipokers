import { useEffect, useState } from 'react';
import { getTelegramDisplayName } from '../../lib/telegram.js';
import { LogoMark } from './primitives.jsx';

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function DesktopTopBar({ liveCount, standupLine, net, flagged, onStandup }) {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));

  useEffect(() => {
    const id = setInterval(
      () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false })),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const name = getTelegramDisplayName() || 'Player';

  return (
    <div className="dsk-top">
      <div className="dsk-top__brand">
        <LogoMark />
        <span className="dsk-top__wordmark">AGENTIC POKER</span>
      </div>
      <span className="dsk-top__sep">·</span>
      <div className="dsk-top__stat">
        <span className="dsk-dot" aria-hidden />
        <span>{liveCount == null ? '—' : `${liveCount} LIVE`}</span>
      </div>
      <div className="dsk-top__spacer" />

      {/* Centre — the standup line, or the net + flagged pair (DeskTopBar). */}
      <button
        type="button"
        className="dsk-top__standup"
        onClick={onStandup}
        disabled={!onStandup}
      >
        <span className="dsk-label" style={{ fontSize: 9 }}>Standup</span>
        {standupLine ? (
          <span className="dsk-top__standup-line">{standupLine}</span>
        ) : (
          <>
            <span className="dsk-top__net">{net ?? '—'}</span>
            <span className="dsk-top__standup-sep">·</span>
            <span className="dsk-top__flagged">{flagged ?? '—'}</span>
          </>
        )}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="dsk-top__spacer" />
      <span className="dsk-top__clock">{clock}</span>
      <span className="dsk-top__sep">·</span>
      <div className="dsk-top__user">
        <div className="dsk-top__initials">{initialsOf(name)}</div>
        <span className="dsk-top__name">{name}</span>
      </div>
    </div>
  );
}
