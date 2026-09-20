// client/src/components/wallet/PocketRow.jsx — WUI-1, WALLET-5, WALLET-7
// One agent's pocket. Ported from PocketRow in design-refs/mood-wallet.jsx.
//
// WALLET-7: the row speaks the two verbs. "Give him chips" is always there —
// it is the way chips get in and the only way to the refill toggle. Collect
// joins it when he is up, and takes the winnings only. "Call him in" is the
// second action while he is seated, and it is how the roll itself comes home.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { equipmentOf } from '../../../../src/shared/wardrobe.js';
import { identityOf } from '../../lib/identity.js';
import { moodOf, heatOf, presenceOf } from '../floor/agentView.js';
import { accentFor } from '../floor/atoms.jsx';
import { CALL_IN, GIVE, money, pnlTone, pocketOf, pocketResultOf, rowActions, signedMoney, stakesFor } from '../../lib/wallet.js';
import { Lbl, ModeTag, Num, PocketBar } from './atoms.jsx';

const M_TEXT = 'var(--text-primary)';
const M_MUTED = 'var(--text-muted)';
const M_FAINT = 'var(--text-faded)';
const M_TEAL = 'var(--accent)';
const M_RED = 'var(--error)';

// WALLET-5 · what a called-in row says about itself, in the sheet's own
// register. While he is still at a table it is a promise about the next few
// minutes; once he is at the bar it would be a lie, so it stops being said.
function cutLine(agent) {
  return presenceOf(agent) === 'playing'
    ? 'finishes this hand then sits at the bar'
    : 'at the bar · nothing pending';
}

/**
 * SAFE-2 — `only` narrows what the row draws.
 *
 * The safe's three verbs are three questions, and a row that answered all of
 * them under each one would be the pocket GRID the safe replaced, one tap
 * deeper. So GIVE's rows offer giving, TAKE's rows offer bringing home, and
 * neither borrows the other's button. Omitted, the row draws whatever
 * rowActions() offers — which is what the row has always done.
 */
export function PocketRow({ agent, index = 0, only = null, onFund, onCollect, onCallIn, onTake, onTakeAmount, busy = false, onOpenProfile }) {
  const pocket = pocketOf(agent);
  if (!pocket) return null;

  const accent = accentFor(agent, index);
  const identity = identityOf(agent);
  const seated = presenceOf(agent) === 'playing';
  const offered = { ...rowActions(pocket, { seated }), take: !!onTake };
  const actions = only
    ? { fund: false, collect: false, callIn: false, ...Object.fromEntries(only.map((k) => [k, offered[k]])) }
    : offered;
  const isCut = pocket.mode === 'cut';
  const result = pocketResultOf(agent);
  const tone = pnlTone(result.net);
  const pnlColor = result.net === null ? M_MUTED : tone === 'down' ? M_RED : tone === 'flat' ? M_MUTED : M_TEAL;

  // The face is the way into his profile — the same navigation the floor uses.
  // Without a host that owns that navigation it stays a plain, inert frame
  // rather than a button that does nothing.
  const ghost = <MoodGhost mood={moodOf(agent)} heat={heatOf(agent)} accent={accent} hood={identity.hood} glow={identity.glow.c} equipment={equipmentOf(agent)} size={36} ring={false} />;
  const ghostStyle = { border: `1px solid color-mix(in srgb, ${accent} 27%, transparent)` };

  return (
    <div
      className={`wal-row${pocket.broke ? ' wal-row--broke' : ''}${isCut ? ' wal-row--cut' : ''}${actions.take ? ' wal-row--transfers' : ''}`}
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
          <span title={result.label} aria-label={`${result.label}: ${signedMoney(result.net)}`}>
            <Num size={11.5} weight={700} color={pnlColor}>{signedMoney(result.net)}</Num>
          </span>
        </div>

        {isCut && <div className="wal-row__sub">{cutLine(agent)}</div>}
        {actions.take && <div className="wal-row__sub">
          Uncommitted pocket
          {seated && <><br />{Number.isFinite(agent.liveGame?.heroStack)
            ? `At table: ${money(agent.liveGame.heroStack)} stack · committed`
            : 'Chips at the table stay committed'}</>}
        </div>}

        <div style={{ marginTop: 5 }}>
          <PocketBar pocket={pocket} />
        </div>
      </div>

      <div className="wal-row__actions">
        {actions.take && <>
          <button type="button" className="wal-btn wal-btn--primary"
            disabled={busy || pocket.balance <= 0} onClick={() => onTake(agent)}>
            {`Take all — ${money(pocket.balance)}`}
          </button>
          {onTakeAmount && pocket.balance > 0 && <button type="button" className="wal-btn wal-btn--outline"
            disabled={busy} onClick={() => onTakeAmount(agent)}>Choose amount</button>}
        </>}
        {actions.fund && (
          <button
            type="button"
            className="wal-btn wal-btn--primary"
            disabled={busy}
            onClick={() => onFund?.(agent)}
          >
            {GIVE}
          </button>
        )}
        {actions.collect && (
          <button
            type="button"
            className="wal-btn wal-btn--outline"
            disabled={busy}
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
            disabled={busy}
            onClick={() => onCallIn(agent)}
          >
            {CALL_IN}
          </button>
        )}
      </div>
    </div>
  );
}

// The pockets list, with the ref's own header line above it. SAFE-2 lets the
// caller name it: under GIVE it is who you can give to, under TAKE it is who
// has something to bring home, and the header has to say which.
export function PocketList({
  agents, only = null, label = 'Pockets', sub = 'pocket size sets his stakes',
  empty = null, onFund, onCollect, onCallIn, onTake, onTakeAmount, busy = false, onOpenProfile,
}) {
  if (!agents.length) return empty;
  return (
    <>
      <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>{label}</Lbl>
        {sub ? <span style={{ fontSize: 11, color: M_MUTED }}>{sub}</span> : null}
      </div>
      <div className="wal-pockets">
        {agents.map((agent, i) => (
          <PocketRow
            key={agent.id}
            agent={agent}
            index={i}
            only={only}
            onFund={onFund}
            onCollect={onCollect}
            onCallIn={onCallIn}
            onTake={onTake}
            onTakeAmount={onTakeAmount}
            busy={busy}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </>
  );
}
