// client/src/components/wallet/PocketRow.jsx — WUI-1, WALLET-5, WALLET-7
// One agent's pocket. Ported from PocketRow in design-refs/mood-wallet.jsx.
//
// WALLET-7: the row speaks the two verbs. "Give him chips" is always there —
// it is the way chips get in and the only way to the refill toggle. Collect
// joins it when he is up, and takes the winnings only. "Call him in" is the
// second action while he is seated, and it is how the roll itself comes home.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { moodOf, presenceOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { CALL_IN, GIVE, money, pnlTone, pocketOf, rowActions, signedMoney, stakesFor } from '../../lib/wallet.js';
import { Lbl, ModeTag, Num, PocketBar } from './atoms.jsx';

const M_TEXT = '#EDEDED';
const M_MUTED = '#6B6B6B';
const M_FAINT = '#3F3F3F';
const M_TEAL = '#00D4AA';
const M_RED = '#FF4D4F';

// WALLET-5 · what a called-in row says about itself, in the sheet's own
// register. While he is still at a table it is a promise about the next few
// minutes; once he is at the bar it would be a lie, so it stops being said.
function cutLine(agent) {
  return presenceOf(agent) === 'playing'
    ? 'finishes this hand then sits at the bar'
    : 'at the bar · nothing pending';
}

export function PocketRow({ agent, index = 0, onFund, onCollect, onCallIn, onOpenProfile }) {
  const pocket = pocketOf(agent);
  if (!pocket) return null;

  const accent = accentFor(agent, index);
  const seated = presenceOf(agent) === 'playing';
  const actions = rowActions(pocket, { seated });
  const isCut = pocket.mode === 'cut';
  const tone = pnlTone(pocket.pnl);
  const pnlColor = pocket.pnl === null ? M_MUTED : tone === 'down' ? M_RED : tone === 'flat' ? M_MUTED : M_TEAL;

  // The face is the way into his profile — the same navigation the floor uses.
  // Without a host that owns that navigation it stays a plain, inert frame
  // rather than a button that does nothing.
  const ghost = <MoodGhost mood={moodOf(agent)} accent={accent} size={36} ring={false} />;
  const ghostStyle = { border: `1px solid ${accent}44` };

  return (
    <div
      className={`wal-row${pocket.broke ? ' wal-row--broke' : ''}${isCut ? ' wal-row--cut' : ''}`}
      data-agent={agent.id}
    >
      {onOpenProfile ? (
        <button
          type="button"
          className="wal-row__ghost wal-row__ghost--tap"
          style={ghostStyle}
          onClick={() => onOpenProfile(agent)}
          aria-label={`Open ${agent.name}'s profile`}
        >
          {ghost}
        </button>
      ) : (
        <div className="wal-row__ghost" style={ghostStyle}>{ghost}</div>
      )}

      <div className="wal-row__body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="wal-row__name">{agent.name}</span>
          <ModeTag mode={pocket.mode} />
        </div>

        <div className="wal-row__figures">
          <Num size={13} weight={700} color={pocket.broke ? M_MUTED : M_TEXT}>
            {money(pocket.balance)}
          </Num>
          {/* Cut off buys no stakes: the rung he could afford is greyed rather
              than removed, so the row still says what the money would seat. */}
          <span className={`wal-row__stakes${isCut ? ' is-greyed' : ''}`}>
            <Num size={9} color={isCut ? M_FAINT : M_MUTED} weight={500}>{stakesFor(pocket)}</Num>
          </span>
          <div style={{ flex: 1 }} />
          <Num size={11.5} weight={700} color={pnlColor}>
            {pocket.pnl === null ? '—' : signedMoney(pocket.pnl)}
          </Num>
        </div>

        {isCut && <div className="wal-row__sub">{cutLine(agent)}</div>}

        <div style={{ marginTop: 5 }}>
          <PocketBar pocket={pocket} />
        </div>
      </div>

      <div className="wal-row__actions">
        {actions.fund && (
          <button
            type="button"
            className="wal-btn wal-btn--primary"
            onClick={() => onFund?.(agent)}
          >
            {GIVE}
          </button>
        )}
        {actions.collect && (
          <button
            type="button"
            className="wal-btn wal-btn--outline"
            onClick={() => onCollect?.(agent)}
          >
            Collect
          </button>
        )}
        {/* Only where a host owns the call. A button that does nothing is
            worse than no button, and this one moves the whole roll. */}
        {actions.callIn && onCallIn && (
          <button
            type="button"
            className="wal-btn wal-btn--outline"
            onClick={() => onCallIn(agent)}
          >
            {CALL_IN}
          </button>
        )}
      </div>
    </div>
  );
}

// The pockets list, with the ref's own header line above it.
export function PocketList({ agents, onFund, onCollect, onCallIn, onOpenProfile }) {
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
            onCallIn={onCallIn}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </>
  );
}
