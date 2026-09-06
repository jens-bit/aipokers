// Analysis, as rail panels rather than tabs under the felt.
// Ported from design-refs/mood-desktop3.jsx AnalysisPanel / ARow / WatchRail
// (screens D3WatchScreenM, D3WatchBetweenScreenM).
//
// Between hands the panel goes quiet with the stage: the live reads (equity,
// fold equity, pot odds, solver line) are replaced by session numbers, because
// there is no hand to have a read on.
import { PanelHead, RailBody, PComposer } from './panelParts.jsx';
import { equityPct, phaseOf } from './DeskTableStage.jsx';
import { RiverAttrPanel } from '../AnalysisPanel.jsx';
import { ThreadRow } from '../system/ThreadSheet.jsx';
import { mergeThread } from '../../lib/thread.js';

export function AnalysisPanel({ title, action, onAction, children }) {
  return (
    <div className="dsk-apanel">
      <div className="dsk-apanel__head">
        <span className="dsk-label" style={{ fontSize: 9.5 }}>{title}</span>
        {action && (
          <button type="button" className="dsk-apanel__action" onClick={onAction}>{action}</button>
        )}
      </div>
      <div className="dsk-apanel__body">{children}</div>
    </div>
  );
}

export function ARow({ label, value, tone, bar, note, first }) {
  return (
    <div className={`dsk-arow${first ? ' is-first' : ''}`}>
      <span className="dsk-arow__label">{label}</span>
      {bar != null && (
        <div className="dsk-arow__track">
          <div className={`dsk-arow__fill${tone ? ` is-${tone}` : ''}`} style={{ width: `${bar}%` }} />
        </div>
      )}
      {note && <span className="dsk-arow__note">{note}</span>}
      <span className={`dsk-arow__value${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </div>
  );
}

function fmtMoney(n) {
  if (!Number.isFinite(n) || n === 0) return '—';
  return n < 0 ? `−$${Math.abs(n).toLocaleString()}` : `+$${n.toLocaleString()}`;
}

export function WatchRail({
  agent, game, lastDecision, heroSeat, hands, thread,
  // WATCH-8 job 3: the STORED half of the record — this stay's lines, with the
  // server's timestamps. The rail used to hold only what the socket happened to
  // be awake for, so a reconnect emptied it exactly as it emptied the phone's.
  stored = [],
  draft, onDraftChange, onSend, sending, onClose,
}) {
  const between = phaseOf(game) === 'between';
  const heroDecision = lastDecision?.seat === heroSeat ? lastDecision : null;

  const eq = heroDecision ? equityPct(heroDecision.equity) : null;
  const pot = game?.pot ?? 0;
  const toCall = game?.currentBet != null
    ? Math.max(0, game.currentBet - (game.seats?.[heroSeat]?.committed ?? 0))
    : 0;
  const odds = toCall > 0 && pot > 0 ? (pot / toCall).toFixed(1) : null;

  const stats = agent?.careerStats;
  const lastHand = Array.isArray(hands) && hands.length ? hands[0] : null;

  // HIM / YOU / TABLE, in the order it happened — the same four registers the
  // phone's sheet draws, from the same component, so the two cannot disagree
  // about who said what.
  const liveRows = [
    ...(heroDecision?.reasoning
      ? [{ id: 'live', kind: 'him', who: 'HIM', text: heroDecision.reasoning, t: Date.now() }]
      : []),
    ...(Array.isArray(thread) ? thread : []).map((m, i) => {
      const you = m.role === 'user';
      return {
        id: m._id ?? `t${i}`,
        kind: you ? 'you' : 'him',
        who: you ? 'YOU' : 'HIM',
        text: m.content,
        t: m.t ?? null,
      };
    }),
  ];

  // The record and what is being said now, in one order — by id, stored copy
  // wins. The same merge the phone's sheet runs, from the same module.
  const tableRows = mergeThread(Array.isArray(stored) ? stored : [], liveRows);

  return (
    <div className="dsk-panel dsk-panel--watch">
      <PanelHead
        title={agent?.name || 'At the table'}
        sub={between ? 'BETWEEN HANDS' : 'AT THE TABLE'}
        onClose={onClose}
      />
      <RailBody>
        {/* WATCH-6, board 31: the rail leads with THE TABLE — everything said
            here, in order, whoever said it. On the phone this is a sheet you
            pull up; at 1440 there is room for it to be always open, which is
            what the ref says on it. */}
        <AnalysisPanel title="The table">
          {tableRows.length === 0
            ? <div className="dsk-apanel__empty">Nothing said at this table yet.</div>
            : tableRows.map((r) => <ThreadRow key={r.id} row={r} />)}
        </AnalysisPanel>

        <AnalysisPanel title="Live analysis">
          {heroDecision?.reasoning && !between && (
            <div className="dsk-apanel__voice">“{heroDecision.reasoning}”</div>
          )}
          {between ? (
            <>
              <ARow first label="This session" value={fmtMoney(stats?.net)} tone="teal"
                note={stats?.hands ? `${stats.hands} hands` : 'no hands yet'} />
              <ARow label="Biggest pot" value={stats?.biggestPot ? `$${stats.biggestPot.toLocaleString()}` : '—'} tone="gold" />
              <ARow label="Win rate" value={stats?.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'} />
            </>
          ) : (
            <>
              <ARow first label="Equity" value={eq === null ? '—' : `${eq.toFixed(1)}%`}
                tone="teal" bar={eq === null ? null : eq} />
              {/* Fold equity and the solver line have no server-side source
                  yet (skill-engine trees). The rows hold their place rather
                  than being swapped for something else. */}
              <ARow label="Fold equity" value="—" tone="gold" note="not modelled yet" />
              <ARow label="Pot odds" value={odds ? `${odds} : 1` : '—'}
                note={toCall > 0 ? `calling ${toCall} into ${pot}` : 'nothing to call'} />
              <ARow label="Solver line" value={heroDecision?.action?.type
                ? String(heroDecision.action.type).toUpperCase()
                : '—'} tone="teal" note="his action" />
            </>
          )}
        </AnalysisPanel>

        {between && lastHand && <RiverAttrPanel agent={agent} hand={lastHand} />}

        <AnalysisPanel title="History">
          {hands?.length ? hands.slice(0, 4).map((h, i) => (
            <ARow
              key={h.handNumber ?? i}
              first={i === 0}
              label={`Hand #${h.handNumber ?? '—'}`}
              value={fmtMoney(h.net ?? h.amount)}
              tone={(h.net ?? h.amount ?? 0) < 0 ? 'red' : 'teal'}
              note={h.summary || (h.won ? 'won' : 'lost')}
            />
          )) : (
            <div className="dsk-apanel__empty">No finished hands this session yet.</div>
          )}
        </AnalysisPanel>

      </RailBody>

      <PComposer
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        busy={sending}
        placeholder="Whisper to him…"
        onCommand={(cmd) => onDraftChange(`${cmd} `)}
      />
    </div>
  );
}
