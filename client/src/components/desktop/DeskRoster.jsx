import { equipmentOf } from '../../../../src/shared/wardrobe.js';
// client/src/components/desktop/DeskRoster.jsx — DESK-3
//
// The left column, permanently. Board 31 wave 58 addendum
// (design-refs/mood-desk59.jsx DkRoster): "who you have, where each one is" —
// a real column, not a mode the panel state toggles it into. It replaces
// FIX-2c's RosterStrip, which only appeared at 68px once a panel had already
// taken the room's place; DESK-3's law is that nothing here slides over
// anything, so the roster is furniture now, on every desktop screen.
//
// C9 uses DkRosterRow's 38px identity and compact condition bars, with the
// mobile roster's actual household location and current/last session result.
import { moodOf, heatOf } from '../floor/agentView.js';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { BodyBars } from '../system/FeltBodyBars.jsx';
import { identityOf } from '../../lib/identity.js';
import { rosterWhereabouts, rosterLive, rosterResult, hasUnread } from '../RosterSheet.jsx';
import { signedMoney } from '../../lib/wallet.js';

const MAX_SEATS = 4;

function DeskRosterRow({agent,active,onClick}) {
  const identity=identityOf(agent), heat=heatOf(agent), live=rosterLive(agent), result=rosterResult(agent);
  const {where,detail}=rosterWhereabouts(agent);
  const line=agent.want?.text || detail;
  return <button type="button" className={`dsk-roster-row dsk-roster-row--home${active?' is-active':''}`} onClick={onClick}>
    <span className="dsk-roster-face"><MoodGhost equipment={equipmentOf(agent)} size={38} ring={false} mood={moodOf(agent)} heat={heat} hood={identity.hood} glow={identity.glow.c} accent={identity.glow.c}/>{hasUnread(agent)&&<i/>}</span>
    <span className="dsk-roster-row__text">
      <span className="dsk-roster-row__name-line"><span className="dsk-roster-row__name">{agent.name}</span><span className={`dsk-roster-place${live?' is-live':''}`}>{where}</span></span>
      <span className="dsk-roster-row__line">{line}{result.value!==null&&<span title={result.label}>{line ? ' · ' : ''}{signedMoney(result.value)}</span>}</span>
      <BodyBars compact fatigue={agent.fatigue} heat={heat} className="dsk-roster-bars"/>
    </span>
  </button>;
}

export function DeskRoster({
  agents = [], loading = false, activeId = null, watchedId = null, onSelect, onDraftAgent,
}) {
  const seatsLeft = Math.max(0, MAX_SEATS - agents.length);
  return (
    <div className="dsk3-roster" data-testid="desk-roster">
      <div className="dsk3-roster__head">
        <span className="dsk-label" style={{ fontSize: 9 }}>Your agents</span>
        <span className="dsk3-roster__count">{loading ? 'Reading the room…' : `${agents.length} of ${MAX_SEATS}`}</span>
      </div>
      <div className="dsk3-roster__rows">
        {agents.map(agent => (
          <DeskRosterRow
            key={agent.id}
            agent={agent}
            active={activeId === agent.id || watchedId === agent.id}
            onClick={() => onSelect?.(agent)}
          />
        ))}
        {!loading && seatsLeft > 0 && onDraftAgent && (
          <button type="button" className="dsk3-roster__draft" onClick={onDraftAgent}>
            <span className="dsk3-roster__draft-plus" aria-hidden>+</span>
            <span>
              <span className="dsk3-roster__draft-title">
                {agents.length === 0 ? 'Draft your first agent' : 'Draft another'}
              </span>
              <span className="dsk3-roster__draft-sub">
                {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
