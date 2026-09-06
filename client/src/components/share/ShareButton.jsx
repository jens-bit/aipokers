// SHARE-1 — the button, and what it opens.
//
// The ref's rule for the gesture: "the affordance costs nothing until it is
// wanted." A ghost button, never a filled one — nothing on the replay header
// or a flagged row should look more important than the hand itself.
//
// Pressing it shows the card first. Nobody should post something they have not
// seen, and the preview is also what the export draws his face from: the PNG
// takes the ghost node this sheet already rendered.

import { useCallback, useRef, useState } from 'react';

import { ShareCard } from './ShareCard.jsx';
import { buildShareModel } from './shareModel.js';
import { renderSharePng } from './drawShareCard.js';
import { shareHand } from './shareHand.js';

const TEAL = '#00D4AA';
const TEXT = '#EDEDED';
const DIM = '#A1A1A1';
const MUTED = '#6B6B6B';
const PANEL = '#232329';
const BORDER = 'rgba(255,255,255,0.12)';
const OSWALD = "'Oswald', 'Inter', sans-serif";

// What actually happened, in one line. The desktop answer is a real answer —
// the card is on disk and the words are on the clipboard — so it is phrased as
// a result and not as a failure.
const OUTCOME = {
  'web-share': 'Shared.',
  'telegram-prepared': 'Sent to Telegram.',
  'telegram-inline': 'Pick a chat in Telegram.',
  download: 'Saved to your downloads — caption copied.',
  copied: 'Caption copied. This browser would not save the image.',
  none: 'Nothing shared.',
};

const ghostButtonStyle = {
  flexShrink: 0,
  height: 28,
  minHeight: 0,
  padding: '0 10px',
  borderRadius: 7,
  background: 'transparent',
  border: `1px solid ${TEAL}66`,
  color: TEAL,
  cursor: 'pointer',
  fontFamily: OSWALD,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

function ActionButton({ children, onClick, primary, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, height: 42, borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
        background: primary ? TEAL : 'transparent',
        border: `1px solid ${primary ? TEAL : BORDER}`,
        color: primary ? '#0A0A0A' : TEXT,
        opacity: disabled ? 0.5 : 1,
        fontFamily: OSWALD, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}
    >{children}</button>
  );
}

/**
 * The sheet. Exported for tests and for anywhere that wants the preview
 * without the button in front of it.
 */
export function ShareSheet({ model, onClose }) {
  const ghostRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const run = useCallback(async (share) => {
    setBusy(true);
    setOutcome(null);
    try {
      const png = await renderSharePng(model, { ghostNode: ghostRef.current?.querySelector('svg') ?? null });
      const via = share
        ? await shareHand({ model, png })
        // "Save image" is the same last route the share falls back to, asked
        // for on purpose rather than arrived at.
        : await shareHand({ model, png, webApp: null, nav: pickerlessNav() });
      setOutcome(OUTCOME[via] ?? OUTCOME.none);
    } catch {
      setOutcome(OUTCOME.none);
    } finally {
      setBusy(false);
    }
  }, [model]);

  return (
    <div
      role="dialog"
      aria-label="Share this hand"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(8,8,10,0.72)',
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
      />
      <div style={{
        position: 'relative', background: PANEL, borderTop: `1px solid ${BORDER}`,
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -18px 40px rgba(0,0,0,0.55)', padding: '9px 14px 22px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 34, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ShareCard model={model} size={296} ghostRef={ghostRef} />
        </div>

        <div style={{
          marginTop: 10, textAlign: 'center', fontSize: 11.5,
          color: outcome ? DIM : MUTED, minHeight: 16,
        }}>
          {outcome ?? 'Exports at 1080×1080.'}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
          <ActionButton onClick={() => run(false)} disabled={busy}>Save image</ActionButton>
          <ActionButton onClick={() => run(true)} disabled={busy} primary>
            {busy ? 'Working…' : 'Share'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// "Save image" must not open a chat picker or an OS share sheet — it is the
// download, asked for by name.
function pickerlessNav() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return nav ? { clipboard: nav.clipboard } : null;
}

/**
 * @param {{ hand: object, agentName?: string, mood?: string, heat?: number, label?: string,
 *           style?: object }} props
 */
export function ShareButton({ hand, agentName, mood, heat, label = 'Share', style }) {
  const [open, setOpen] = useState(false);
  if (!hand) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label="Share this hand"
        style={{ ...ghostButtonStyle, ...style }}
      >{label}</button>
      {open && (
        <ShareSheet
          model={buildShareModel(hand, { agentName, mood, heat })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
