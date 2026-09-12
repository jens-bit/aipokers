// client/src/components/wallet/atoms.jsx — WALLET-UI-1
// ModeTag, PocketBar and the two typographic atoms, ported from
// design-refs/mood-wallet.jsx. Structure lives in wallet.css; the ref's
// one-off values stay inline, same convention as the rest of the mood wave.

import { modeMeta, pocketFill } from '../../lib/wallet.js';

const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const MONO = '"JetBrains Mono",ui-monospace,monospace';
const M_MUTED = 'var(--text-muted)';
const M_TEXT = 'var(--text-primary)';

export function Lbl({ children, size = 9.5, color = M_MUTED }) {
  return (
    <span style={{
      fontFamily: OSWALD, fontSize: size, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase', color,
    }}>{children}</span>
  );
}

export function Num({ children, size = 14, weight = 700, color = M_TEXT }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color }}>
      {children}
    </span>
  );
}

// How he gets money, in three letters. Colour carries the mode; the tag never
// carries a judgement — CUT OFF is grey, not red.
export function ModeTag({ mode }) {
  const m = modeMeta(mode);
  const color = ({ topup: 'var(--text-secondary)', allowance: 'var(--accent)', auto: 'var(--gold-reward)', cut: 'var(--text-muted)' })[mode] ?? 'var(--text-secondary)';
  return (
    <span
      className="wal-tag"
      data-mode={mode}
      style={{ color, background: `color-mix(in srgb, ${color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 27%, transparent)` }}
    >
      {m.label}
    </span>
  );
}

// How much of the roll is left, at a glance. Teal is money he has; empty and
// grey when he is broke.
export function PocketBar({ pocket }) {
  const pct = pocketFill(pocket);
  const broke = !!pocket?.broke;
  return (
    <div
      className="wal-bar"
      role="progressbar"
      aria-label="Pocket remaining"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`wal-bar__fill${broke ? ' wal-bar__fill--broke' : ''}`}
        style={{ width: `${broke ? 0 : pct}%` }}
      />
    </div>
  );
}
