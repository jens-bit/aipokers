// client/src/components/wallet/FundSheet.jsx — WUI-2, WALLET-7, UI-3 job C
// The sheet's look is ported from FundSheetScreenM in design-refs/mood-wallet.jsx;
// WALLET-7 changed what is inside it, UI-3 job C gave it a second direction.
//
// THREE VERBS NOW, NOT TWO. The old sheet moved money one way (out to him)
// plus one all-or-nothing way back (call him in, which also ends his
// session). What was missing was the plain, small, reversible move: taking
// some of what is in his pocket back without pulling him off a table. That
// is TAKE, and it is genuinely a different thing from "collect winnings" —
// this sheet's own callin already collects winnings and the principal both,
// the moment his session ends. Job C's complaint was that nothing let the
// owner move an arbitrary amount OUT of a pocket that was just sitting
// there, the same way GIVE moves an arbitrary amount in.
//
//   GIVE HIM CHIPS   an amount up to the safe's balance, refill or not
//   TAKE HIS CHIPS   an amount up to his pocket, principal included
//   CALL HIM IN      he finishes the hand and everything comes back
//
// EVERY FIGURE SAYS WHAT IT IS. "Pocket now", "his net" and "the safe" are
// three different numbers that all look like money, and the reason to label
// each one in words is the reason job C exists: a pocket and a safe with six
// digits apiece are not distinguishable by size alone.
//
// The copy law is unchanged: calling him in is a legitimate answer, drawn
// without a shred of guilt. It says what he keeps, never what he loses.

import { useState } from 'react';

import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf, heatOf, presenceOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { CALL_IN, CALL_IN_LINE, GIVE, money, pocketOf, refillLabel, signedMoney, stakesFor } from '../../lib/wallet.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEXT = 'var(--text-primary)';
const M_DIM = 'var(--text-secondary)';
const M_MUTED = 'var(--text-muted)';
const M_GOLD = 'var(--gold-reward)';
const M_BORDER = 'var(--edge)';

// The rungs of the real ladder (STAKES in src/server/wallet.js), offered as
// sizes of roll rather than a keypad: the owner is picking what he can play,
// not typing an exact wager.
const PRESETS = [2_000, 5_000, 10_000];
const DEFAULT_AMOUNT = PRESETS[0];

export function FundSheet({ agent, wallet, onCancel, onConfirm, index = 0, onOpenProfile, disabled = false }) {
  const pocket = pocketOf(agent);
  const seated = presenceOf(agent) === 'playing';

  // The sheet opens on where he actually stands: the size he was last set at,
  // and whether the wallet is backing his next bust. A decision the owner took
  // is not a state the UI gets to forget.
  const [amount, setAmount] = useState(pocket?.cap ?? DEFAULT_AMOUNT);
  const [refill, setRefill] = useState(pocket?.mode === 'auto');
  const pocketBalance = pocket?.balance ?? 0;
  // UI-3 job C: the second direction. Opens on his whole pocket — "take it
  // all" is as legitimate a first read as any smaller amount — and from
  // there is free text the same way GIVE's amount is (`?? ''` when cleared,
  // never silently snapping back to the ceiling mid-edit).
  const [takeAmount, setTakeAmount] = useState(pocketBalance);
  const [busy, setBusy] = useState(false);

  const accent = accentFor(agent, index);

  // What the amount buys, in the ref's own words.
  const impliedStakes = stakesFor({ balance: amount ?? 0, cap: amount, broke: false });

  // Job C: GIVE is a real transfer out of the safe, so it cannot ask for more
  // than the safe holds — the safe's balance is GIVE's own ceiling, the same
  // way his pocket is TAKE's.
  const overSafe = wallet && Number.isFinite(amount) && amount > wallet.balance;

  // Calling him in is only a thing to offer when there is something to call in:
  // a seat at a table, or chips in the pocket.
  const canCallIn = seated || pocketBalance > 0;
  const takeCeiling = pocketBalance;
  const canTake = pocketBalance > 0;

  async function send(decision) {
    if (busy || disabled) return;
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
          borderRadius: 12, background: 'var(--bg-tertiary)', border: `1px solid color-mix(in srgb, ${accent} 24%, transparent)`, marginBottom: 14,
        }}>
          {/* WALLET-5: his face opens his profile here too, the same
              navigation the floor uses. Inert when no host owns it. */}
          {(() => {
            const frame = {
              width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'var(--bg-tertiary)',
              border: `1px solid color-mix(in srgb, ${accent} 27%, transparent)`, display: 'flex', alignItems: 'flex-end',
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
            <Lbl size={8.5}>His pocket now</Lbl>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
              <Num size={19} weight={700}>{money(pocket?.balance ?? 0)}</Num>
              {pocket && !pocket.broke && (
                <Num size={9} color={M_MUTED} weight={500}>PLAYS {stakesFor(pocket)}</Num>
              )}
            </div>
            {/* UI-3 job C: his NET, not just his stack — what he has actually
                made, separate from what is sitting in the pocket right now. A
                $64,000 pocket and a +$1,200 net are two different facts, and
                the sheet used to state only the one that looks like the
                other. */}
            {pocket && Number.isFinite(pocket.pnl) && (
              <div style={{ marginTop: 3 }}>
                <Num size={10.5} weight={600} color={pocket.pnl >= 0 ? 'var(--success)' : 'var(--error)'}>
                  {signedMoney(pocket.pnl)}
                </Num>
                <span style={{ fontSize: 9, color: M_MUTED, marginLeft: 4 }}>his net</span>
              </div>
            )}
          </div>
          {wallet && (
            <div style={{ textAlign: 'right' }}>
              <Lbl size={8.5}>The safe</Lbl>
              <div><Num size={13} weight={700} color="var(--accent)">{money(wallet.balance)}</Num></div>
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
              disabled={disabled}
              onClick={() => setAmount(preset)}
            >
              {money(preset)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <label>
            <Lbl size={8.5}>{wallet ? `Amount — up to the safe's ${money(wallet.balance)}` : 'Amount'}</Lbl>
            <div style={{ marginTop: 5 }}>
              <input
                className="wal-cap"
                aria-label="Amount to give"
                type="number"
                inputMode="numeric"
                min="0"
                step="10"
                disabled={disabled}
                value={amount ?? ''}
                onChange={(e) => setAmount(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
            {overSafe && (
              <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--error)' }}>
                The safe only holds {money(wallet.balance)}.
              </p>
            )}
          </label>
        </div>

        {/* The one toggle. Auto-refill was a mode of its own and is now a
            property of the chips being given: same roll, backed or not. */}
        <label className="wal-toggle">
          <input
            type="checkbox"
            checked={refill}
            disabled={disabled}
            onChange={(e) => setRefill(e.target.checked)}
          />
          <span className="wal-toggle__text">{refillLabel(amount ?? 0)}</span>
        </label>

        {/* Bigger pocket, bigger stakes — stated, never buried. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, background: `color-mix(in srgb, ${M_GOLD} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${M_GOLD} 20%, transparent)`,
          marginTop: 12, marginBottom: 14,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>
            A {money(amount)} pocket seats him at <b style={{ color: M_TEXT }}>{impliedStakes}</b>. Bigger pocket, bigger stakes.
          </span>
        </div>

        {/* ── verb two: take his chips (UI-3 job C) ──────────────────── */}
        {canTake && (
          <div className="wal-take">
            <Lbl size={9.5}>Or take his chips</Lbl>
            <p className="wal-callin__line">
              Any amount up to what he is actually holding — {money(pocketBalance)} — comes back
              to the safe. He keeps his seat; this is not calling him in.
            </p>
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <label>
                <Lbl size={8.5}>{`Amount — up to his pocket's ${money(pocketBalance)}`}</Lbl>
                <div style={{ marginTop: 5 }}>
                  <input
                    className="wal-cap"
                    aria-label="Amount to take"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={takeCeiling}
                    step="10"
                    disabled={disabled}
                    value={takeAmount ?? ''}
                    onChange={(e) => setTakeAmount(e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>
                {Number.isFinite(takeAmount) && takeAmount > takeCeiling && (
                  <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--error)' }}>
                    His pocket only holds {money(takeCeiling)}.
                  </p>
                )}
              </label>
            </div>
            <button
              type="button"
              className="wal-btn wal-btn--ghost"
              style={{ height: 40, width: '100%' }}
              disabled={busy || disabled || !(takeAmount > 0) || takeAmount > takeCeiling}
              onClick={() => send({ verb: 'take', amount: takeAmount })}
            >
              {!(takeAmount > 0) ? 'Take his chips'
                : takeAmount >= takeCeiling ? `Take all of it — ${money(takeCeiling)}` : `Take ${money(takeAmount)}`}
            </button>
          </div>
        )}

        {/* ── verb three: call him in ─────────────────────────────────── */}
        {canCallIn && (
          <div className="wal-callin">
            <Lbl size={9.5}>Or call him in</Lbl>
            <p className="wal-callin__line">{CALL_IN_LINE}</p>
            <button
              type="button"
              className="wal-btn wal-btn--ghost"
              style={{ height: 40, width: '100%' }}
              disabled={busy || disabled}
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
            disabled={busy || disabled || !(amount > 0) || overSafe}
            onClick={() => send({ verb: 'give', amount, cap: amount, refill })}
          >
            {GIVE}
          </button>
        </div>
      </div>
    </div>
  );
}
