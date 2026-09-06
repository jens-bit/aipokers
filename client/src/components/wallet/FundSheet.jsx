// client/src/components/wallet/FundSheet.jsx — WUI-2, WALLET-7
// The sheet's look is ported from FundSheetScreenM in design-refs/mood-wallet.jsx;
// WALLET-7 changed what is inside it.
//
// TWO VERBS, NOT FOUR MODES. The old sheet asked the owner to pick between a
// one-time top-up, an allowance, auto-refill and cutting him off — four answers
// to one question, and two of them ("top-up" and "allowance") were the same
// thing wearing different names. What is left is what a backer actually does:
//
//   GIVE HIM CHIPS   an amount, and one toggle for whether it refills
//   CALL HIM IN      he finishes the hand and comes home with the money
//
// The copy law is unchanged: calling him in is a legitimate answer, drawn
// without a shred of guilt. It says what he keeps, never what he loses.

import { useState } from 'react';

import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf, heatOf, presenceOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { CALL_IN, CALL_IN_LINE, GIVE, money, pocketOf, refillLabel, stakesFor } from '../../lib/wallet.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';
const M_GOLD = '#CDB380';
const M_BORDER = 'rgba(255,255,255,0.12)';

// The rungs of the real ladder (STAKES in src/server/wallet.js), offered as
// sizes of roll rather than a keypad: the owner is picking what he can play,
// not typing an exact wager.
const PRESETS = [2_000, 5_000, 10_000];
const DEFAULT_AMOUNT = PRESETS[0];

export function FundSheet({ agent, wallet, onCancel, onConfirm, index = 0, onOpenProfile }) {
  const pocket = pocketOf(agent);
  const seated = presenceOf(agent) === 'playing';

  // The sheet opens on where he actually stands: the size he was last set at,
  // and whether the wallet is backing his next bust. A decision the owner took
  // is not a state the UI gets to forget.
  const [amount, setAmount] = useState(pocket?.cap ?? DEFAULT_AMOUNT);
  const [refill, setRefill] = useState(pocket?.mode === 'auto');
  const [busy, setBusy] = useState(false);

  const accent = accentFor(agent, index);

  // What the amount buys, in the ref's own words.
  const impliedStakes = stakesFor({ balance: amount ?? 0, cap: amount, broke: false });

  // Calling him in is only a thing to offer when there is something to call in:
  // a seat at a table, or chips in the pocket.
  const canCallIn = seated || (pocket?.balance ?? 0) > 0;

  async function send(decision) {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(decision);
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
          {/* WALLET-5: his face opens his profile here too, the same
              navigation the floor uses. Inert when no host owns it. */}
          {(() => {
            const frame = {
              width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#0A0F17',
              border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end',
              justifyContent: 'center', overflow: 'hidden',
            };
            const face = <MoodGhost mood={moodOf(agent)} heat={heatOf(agent)} accent={accent} size={42} ring={false} />;
            return onOpenProfile ? (
              <button
                type="button"
                style={{ ...frame, padding: 0, cursor: 'pointer' }}
                onClick={() => onOpenProfile(agent)}
                aria-label={`Open ${agent.name}'s profile`}
              >
                {face}
              </button>
            ) : <div style={frame}>{face}</div>;
          })()}
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

        {/* ── verb one: give him chips ───────────────────────────────── */}
        <Lbl size={9.5}>{GIVE}</Lbl>
        <div style={{ height: 8 }} />

        <div className="wal-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="wal-preset"
              aria-pressed={amount === preset}
              onClick={() => setAmount(preset)}
            >
              {money(preset)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <label>
            <Lbl size={8.5}>Amount</Lbl>
            <div style={{ marginTop: 5 }}>
              <input
                className="wal-cap"
                type="number"
                inputMode="numeric"
                min="0"
                step="10"
                value={amount ?? ''}
                onChange={(e) => setAmount(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </label>
        </div>

        {/* The one toggle. Auto-refill was a mode of its own and is now a
            property of the chips being given: same roll, backed or not. */}
        <label className="wal-toggle">
          <input
            type="checkbox"
            checked={refill}
            onChange={(e) => setRefill(e.target.checked)}
          />
          <span className="wal-toggle__text">{refillLabel(amount ?? 0)}</span>
        </label>

        {/* Bigger pocket, bigger stakes — stated, never buried. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33`,
          marginTop: 12, marginBottom: 14,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>
            A {money(amount)} pocket seats him at <b style={{ color: M_TEXT }}>{impliedStakes}</b>. Bigger pocket, bigger stakes.
          </span>
        </div>

        {/* ── verb two: call him in ──────────────────────────────────── */}
        {canCallIn && (
          <div className="wal-callin">
            <Lbl size={9.5}>Or call him in</Lbl>
            <p className="wal-callin__line">{CALL_IN_LINE}</p>
            <button
              type="button"
              className="wal-btn wal-btn--ghost"
              style={{ height: 40, width: '100%' }}
              disabled={busy}
              onClick={() => send({ verb: 'callin', amount: null, cap: null, refill: false })}
            >
              {CALL_IN}
            </button>
          </div>
        )}
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
            disabled={busy || !(amount > 0)}
            onClick={() => send({ verb: 'give', amount, cap: amount, refill })}
          >
            {GIVE}
          </button>
        </div>
      </div>
    </div>
  );
}
