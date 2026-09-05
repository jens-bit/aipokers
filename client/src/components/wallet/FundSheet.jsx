// client/src/components/wallet/FundSheet.jsx — WUI-2
// Ported from FundSheetScreenM in design-refs/mood-wallet.jsx.
//
// Four ways he gets money, and cutting him off is one of them — drawn as a
// choice with the same weight as the others, because it is. The copy for that
// option says what he keeps, not what he loses: "He finishes the hand he is in
// and takes a seat at the bar. Nothing is lost — his attributes, his read book
// and his grudges all keep." No plea, no scolding, no guilt anywhere.

import { useState } from 'react';

import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { FUND_MODES, modeMeta, money, pocketOf, stakesFor } from '../../lib/wallet.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';
const M_GOLD = '#CDB380';
const M_BORDER = 'rgba(255,255,255,0.12)';

// The ref's own defaults. Presets, not a keypad: the owner is picking a size of
// roll, not typing an exact wager.
const DEFAULT_AMOUNT = { topup: 300, allowance: 500, auto: 1000, cut: null };

// The cut-off copy, verbatim from the ref.
const CUT_LINE =
  'He finishes the hand he is in and takes a seat at the bar. Nothing is lost — '
  + 'his attributes, his read book and his grudges all keep.';

function amountLabel(mode, value) {
  if (mode === 'cut') return null;
  if (mode === 'auto') return `cap ${money(value)}`;
  return money(value);
}

function FundOption({ mode, amount, selected, onSelect }) {
  const m = modeMeta(mode);
  return (
    <button
      type="button"
      className="wal-option"
      aria-pressed={selected}
      onClick={() => onSelect(mode)}
      style={{
        background: selected ? `${m.color}0D` : undefined,
        borderColor: selected ? m.color : undefined,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          className="wal-option__radio"
          style={{
            borderColor: selected ? m.color : undefined,
            background: selected ? m.color : 'transparent',
          }}
        >
          {selected && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" aria-hidden>
              <path d="M5 12l5 5 9-11" />
            </svg>
          )}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selected ? M_TEXT : M_DIM }}>
          {m.title}
        </span>
        {amount && <Num size={13} weight={700} color={selected ? m.color : M_MUTED}>{amount}</Num>}
      </span>
      <span className="wal-option__line" style={{ display: 'block' }}>
        {mode === 'cut' ? CUT_LINE : m.line}
      </span>
    </button>
  );
}

export function FundSheet({ agent, wallet, onCancel, onConfirm, index = 0 }) {
  const pocket = pocketOf(agent);
  const [mode, setMode] = useState(pocket?.mode && pocket.mode !== 'cut' ? pocket.mode : 'allowance');
  const [amounts, setAmounts] = useState({ ...DEFAULT_AMOUNT, ...(pocket?.cap ? { [pocket.mode]: pocket.cap } : {}) });
  const [busy, setBusy] = useState(false);

  const accent = accentFor(agent, index);
  const amount = amounts[mode];
  const m = modeMeta(mode);
  const isCut = mode === 'cut';

  // What the choice buys, in the ref's own words. Cutting him off buys no
  // stakes, so the strip says what happens instead of pretending otherwise.
  const impliedStakes = stakesFor({ balance: amount ?? 0, cap: amount, broke: false });

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm({
        mode,
        amount: isCut ? null : amount,
        cap: mode === 'auto' ? amount : null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wal-sheet" role="dialog" aria-label={`Fund ${agent.name}`}>
      <div className="wal-sheet__head">
        <button type="button" className="wal-sheet__back" onClick={onCancel} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="wal-sheet__title">Fund {agent.name}</span>
      </div>

      <div className="wal-sheet__body">
        {/* where he stands now, and what you have to give */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px',
          borderRadius: 12, background: '#1b1b1b', border: `1px solid ${accent}3D`, marginBottom: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#0A0F17',
            border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', overflow: 'hidden',
          }}>
            <MoodGhost mood={moodOf(agent)} accent={accent} size={42} ring={false} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Lbl size={8.5}>Pocket now</Lbl>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <Num size={19} weight={700}>{money(pocket?.balance ?? 0)}</Num>
              {pocket && !pocket.broke && (
                <Num size={9} color={M_MUTED} weight={500}>PLAYS {stakesFor(pocket)}</Num>
              )}
            </div>
          </div>
          {wallet && (
            <div style={{ textAlign: 'right' }}>
              <Lbl size={8.5}>Wallet</Lbl>
              <div><Num size={13} weight={700} color="#00D4AA">{money(wallet.balance)}</Num></div>
            </div>
          )}
        </div>

        <Lbl size={9.5}>How he gets money</Lbl>
        <div style={{ height: 8 }} />

        {FUND_MODES.map((key) => (
          <FundOption
            key={key}
            mode={key}
            amount={amountLabel(key, amounts[key])}
            selected={mode === key}
            onSelect={setMode}
          />
        ))}

        {/* The cap. One field, and only for the mode that has one to set. */}
        {!isCut && (
          <div style={{ marginTop: 4, marginBottom: 10 }}>
            <label>
              <Lbl size={8.5}>{mode === 'auto' ? 'Cap' : 'Amount'}</Lbl>
              <div style={{ marginTop: 5 }}>
                <input
                  className="wal-cap"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  value={amount ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [mode]: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </div>
            </label>
          </div>
        )}

        {/* Bigger pocket, bigger stakes — stated, never buried. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33`,
          marginTop: 4, marginBottom: 14,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>
            {isCut
              ? 'He keeps his seat at the bar until you say otherwise. Nothing expires.'
              : <>A {money(amount)} {m.title.toLowerCase()} seats him at <b style={{ color: M_TEXT }}>{impliedStakes}</b>. Bigger pocket, bigger stakes.</>}
          </span>
        </div>
      </div>

      <div className="wal-sheet__foot">
        <div style={{ flex: 1 }}>
          <button type="button" className="wal-btn wal-btn--ghost" style={{ height: 46, width: '100%' }} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div style={{ flex: 1.4 }}>
          <button
            type="button"
            className="wal-btn wal-btn--primary"
            style={{ height: 46, width: '100%' }}
            disabled={busy || (!isCut && !(amount > 0))}
            onClick={confirm}
          >
            {isCut ? 'Cut him off' : `Set ${m.title.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
