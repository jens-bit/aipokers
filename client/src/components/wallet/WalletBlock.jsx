// client/src/components/wallet/WalletBlock.jsx — WUI-1
// The wallet: one number, and where the rest of it currently is.
// Ported from YouWalletScreenM in design-refs/mood-wallet.jsx.

import { money, signedMoney, pnlTone } from '../../lib/wallet.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEAL = '#00D4AA';
const M_GOLD = '#CDB380';
const M_RED = '#FF4D4F';
const M_MUTED = '#6B6B6B';

export function WalletBlock({ wallet, playingCount = 0, agentCount = 0 }) {
  if (!wallet) return null;

  const tone = pnlTone(wallet.session);
  const sessionColor = tone === 'down' ? M_RED : tone === 'flat' ? M_MUTED : M_TEAL;

  return (
    <div className="wal-block">
      <Lbl size={9.5}>Your wallet</Lbl>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
        <span className="wal-block__amount">{money(wallet.balance)}</span>
      </div>

      <div className="wal-block__split">
        <div className="wal-block__cell">
          <Lbl size={8.5}>In pockets</Lbl>
          <div style={{ marginTop: 2 }}>
            <Num size={13} weight={700} color={M_GOLD}>{money(wallet.staked)}</Num>
          </div>
        </div>
        <div className="wal-block__rule" />
        <div className="wal-block__cell">
          <Lbl size={8.5}>Tonight</Lbl>
          <div style={{ marginTop: 2 }}>
            <Num size={13} weight={700} color={sessionColor}>{signedMoney(wallet.session)}</Num>
          </div>
        </div>
        <div className="wal-block__rule" />
        <div className="wal-block__cell">
          <Lbl size={8.5}>Playing</Lbl>
          <div style={{ marginTop: 2 }}>
            <Num size={13} weight={700}>{playingCount} of {agentCount}</Num>
          </div>
        </div>
      </div>
    </div>
  );
}
