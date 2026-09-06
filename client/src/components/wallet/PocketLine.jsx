// client/src/components/wallet/PocketLine.jsx — WUI-3
// Ported from PocketLineSpec in design-refs/mood-wallet.jsx.
//
// One row, between the attribute cluster and the career line. It carries money
// and stakes only — no attribute, no band, no mood — because the pocket decides
// which tables he sits at and nothing about how well he plays at them.

import { CALL_IN, GIVE, money, pocketOf, rowActions, stakesFor } from '../../lib/wallet.js';
import { Lbl, ModeTag, Num, PocketBar } from './atoms.jsx';

const M_MUTED = '#6B6B6B';

// "plays $5/$10 · refills to $300" — what the row says about itself, in the
// ref's own register: how he is seated, and how the money behaves.
function noteFor(pocket) {
  if (pocket.broke) {
    return pocket.mode === 'cut' ? 'called in · nothing pending' : 'pocket empty · your call';
  }
  const plays = `plays ${stakesFor(pocket)}`;
  // WALLET-7: the float is the roll the refill toggle tops him back up to, and
  // that is the only sentence it is the honest number for.
  if (pocket.mode === 'auto' && pocket.float) return `${plays} · refills to ${money(pocket.float)}`;
  if (pocket.mode === 'auto' && pocket.cap) return `${plays} · refills up to ${money(pocket.cap)}`;
  if (pocket.mode === 'cut') return `${plays} · called in`;
  if (pocket.cap) return `${plays} · ${money(pocket.cap)} staked`;
  return plays;
}

export function PocketLine({ agent, onFund, onCollect, onCallIn }) {
  const pocket = pocketOf(agent);
  // Graceful absence: no pocket, no row. The profile card is what it is today.
  if (!pocket) return null;

  const actions = rowActions(pocket, { seated: agent?.activeTableId != null || agent?.presence === 'playing' });

  return (
    <>
      <div style={{ padding: '0 14px 5px' }}><Lbl size={9.5}>Pocket</Lbl></div>
      <div className="wal-line">
        <div className="wal-line__top">
          <div style={{ minWidth: 0 }}>
            <Lbl size={8.5}>Pocket</Lbl>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Num size={15} weight={700} color={pocket.broke ? M_MUTED : undefined}>
                {money(pocket.balance)}
              </Num>
              <ModeTag mode={pocket.mode} />
            </div>
          </div>
          <div className="wal-line__rule" />
          <span className="wal-line__note">{noteFor(pocket)}</span>
          {/* An action is only drawn when a host can act on it. The profile
              card is reachable from screens that do not own the funding sheet,
              and a button that does nothing is worse than no button. */}
          {actions.collect && onCollect && (
            <button type="button" className="wal-btn wal-btn--outline" style={{ height: 28 }} onClick={() => onCollect(agent)}>
              Collect
            </button>
          )}
          {actions.callIn && onCallIn && (
            <button type="button" className="wal-btn wal-btn--outline" style={{ height: 28 }} onClick={() => onCallIn(agent)}>
              {CALL_IN}
            </button>
          )}
          {actions.fund && onFund && (
            <button type="button" className="wal-btn wal-btn--primary" style={{ height: 28 }} onClick={() => onFund(agent)}>
              {GIVE}
            </button>
          )}
        </div>
        <div style={{ marginTop: 9 }}>
          <PocketBar pocket={pocket} />
        </div>
      </div>
    </>
  );
}

// ── the collect moment ──────────────────────────────────────────────────────
// He brings it home. The motion is pocket -> wallet, so the receipt is drawn as
// a transfer rather than a reward: no burst, no coin, no sound of a slot
// machine. Ported from CollectCard in design-refs/mood-wallet.jsx.

const M_TEAL = '#00D4AA';

// WALLET-7: `left` is what stayed in his pocket. Under the old rule that was
// always the float; a collect now takes the winnings and leaves the roll, so
// the card reads the balance he was actually left with.
export function CollectCard({ pocketBefore, left, collected, at, onLeaveIn }) {
  return (
    <div className="wal-collect">
      <div className="wal-collect__head">
        <Lbl size={9} color={M_TEAL}>Brought home</Lbl>
        <div className="wal-collect__rule" />
        {at && <Num size={9} color={M_MUTED} weight={500}>{at}</Num>}
      </div>

      <div className="wal-collect__flow">
        <div style={{ flex: 1 }}>
          <Lbl size={8.5}>His pocket</Lbl>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <Num size={15} weight={700} color={M_MUTED}>{money(pocketBefore)}</Num>
            <Num size={9} color={M_MUTED} weight={500}>→ {money(left)}</Num>
          </div>
        </div>

        <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke={M_TEAL} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden>
          <path d="M1 7h20M16 2l5 5-5 5" />
        </svg>

        <div style={{ flex: 1, textAlign: 'right' }}>
          <Lbl size={8.5} color={M_TEAL}>Your wallet</Lbl>
          <div style={{ marginTop: 2 }}>
            <Num size={17} weight={700} color={M_TEAL}>{money(collected, { sign: true })}</Num>
          </div>
        </div>
      </div>

      <div className="wal-collect__foot">
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>
          {money(left)} left in his pocket
        </span>
        {onLeaveIn && (
          <button type="button" className="wal-btn wal-btn--outline" style={{ height: 28 }} onClick={onLeaveIn}>
            Leave it in
          </button>
        )}
      </div>
    </div>
  );
}
