// client/src/components/wallet/PocketRow.jsx — WUI-1
// One agent's pocket. Ported from PocketRow in design-refs/mood-wallet.jsx.
//
// One primary action per row and never two: Collect when he is carrying money
// home, Fund when he is not. The row states a fact and offers the single thing
// the owner can do about it.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { money, pnlTone, pocketOf, primaryAction, signedMoney, stakesFor } from '../../lib/wallet.js';
import { Lbl, ModeTag, Num, PocketBar } from './atoms.jsx';

const M_TEXT = '#EDEDED';
const M_MUTED = '#6B6B6B';
const M_TEAL = '#00D4AA';
const M_RED = '#FF4D4F';

export function PocketRow({ agent, index = 0, onFund, onCollect }) {
  const pocket = pocketOf(agent);
  if (!pocket) return null;

  const accent = accentFor(agent, index);
  const action = primaryAction(pocket);
  const tone = pnlTone(pocket.pnl);
  const pnlColor = pocket.pnl === null ? M_MUTED : tone === 'down' ? M_RED : tone === 'flat' ? M_MUTED : M_TEAL;

  return (
    <div className={`wal-row${pocket.broke ? ' wal-row--broke' : ''}`} data-agent={agent.id}>
      <div className="wal-row__ghost" style={{ border: `1px solid ${accent}44` }}>
        <MoodGhost mood={moodOf(agent)} accent={accent} size={36} ring={false} />
      </div>

      <div className="wal-row__body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="wal-row__name">{agent.name}</span>
          <ModeTag mode={pocket.mode} />
        </div>

        <div className="wal-row__figures">
          <Num size={13} weight={700} color={pocket.broke ? M_MUTED : M_TEXT}>
            {money(pocket.balance)}
          </Num>
          <Num size={9} color={M_MUTED} weight={500}>{stakesFor(pocket)}</Num>
          <div style={{ flex: 1 }} />
          <Num size={11.5} weight={700} color={pnlColor}>
            {pocket.pnl === null ? '—' : signedMoney(pocket.pnl)}
          </Num>
        </div>

        <div style={{ marginTop: 5 }}>
          <PocketBar pocket={pocket} />
        </div>
      </div>

      {action === 'collect' ? (
        <button
          type="button"
          className="wal-btn wal-btn--outline"
          onClick={() => onCollect?.(agent)}
        >
          Collect
        </button>
      ) : (
        <button
          type="button"
          className="wal-btn wal-btn--primary"
          onClick={() => onFund?.(agent)}
        >
          Fund
        </button>
      )}
    </div>
  );
}

// The pockets list, with the ref's own header line above it.
export function PocketList({ agents, onFund, onCollect }) {
  if (!agents.length) return null;
  return (
    <>
      <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>Pockets</Lbl>
        <span style={{ fontSize: 11, color: M_MUTED }}>pocket size sets his stakes</span>
      </div>
      <div className="wal-pockets">
        {agents.map((agent, i) => (
          <PocketRow
            key={agent.id}
            agent={agent}
            index={i}
            onFund={onFund}
            onCollect={onCollect}
          />
        ))}
      </div>
    </>
  );
}
