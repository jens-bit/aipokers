import { MuteToggle } from '../WatchScreen.jsx';
import { useEffect, useState } from 'react';
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
import { WatchAgentStats } from '../system/WatchAgentStats.jsx';

export function AnalysisPanel({ title, action, onAction, children }) {
  return (
    <div className="dsk-apanel">
      {(title || action) && <div className="dsk-apanel__head">
        <span className="dsk-label" style={{ fontSize: 9.5 }}>{title}</span>
        {action && (
          <button type="button" className="dsk-apanel__action" onClick={onAction}>{action}</button>
        )}
      </div>}
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
  stored = [], readOnly = false, conversationOnly = false,
  draft, onDraftChange, onSend, sending, onClose, composerRef, error = '',
  view, onViewChange, agentReturn = null,
}) {
  const [localView, setLocalView] = useState('chat');
  useEffect(() => setLocalView('chat'), [agent?.id, game?.sessionId, game?.tableId]);
  const canShowStats = conversationOnly && !readOnly && !!agent;
  const requestedView = view ?? localView;
  const activeView = requestedView === 'hand-log' ? 'hand-log'
    : requestedView === 'stats' && canShowStats ? 'stats' : 'chat';
  const handLog = activeView === 'hand-log', showStats = activeView === 'stats';
  const privateChat = canShowStats && activeView === 'chat';
  const changeView = next => { setLocalView(next); onViewChange?.(next); };
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

  // Only saved private messages and this conversation's pending turn belong
  // in owner Chat. Table speech can share a category or ID with these lines;
  // neither makes it part of the private conversation.
  const privateRows = (Array.isArray(thread) ? thread : [])
    .filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
    .map((m, i) => {
      const you = m.role === 'user';
      return {
        id: m._id ?? `t${i}`,
        kind: you ? 'you' : 'him',
        category: 'chat',
        who: you ? 'YOU' : 'HIM',
        text: m.content,
        t: m.t ?? null,
      };
    });
  const liveRows = [
    ...(heroDecision?.reasoning
      ? [{ id: 'live', kind: 'him', category: 'decision', who: 'HIM', text: heroDecision.reasoning, t: Date.now() }]
      : []),
    ...privateRows,
  ];

  // The record and what is being said now, in one order — by id, stored copy
  // wins. The same merge the phone's sheet runs, from the same module.
  const tableRows = mergeThread(Array.isArray(stored) ? stored : [], liveRows);
  // Public Chat keeps speech, results and unknown events. The complete table
  // record remains available in Hand log for both viewers.
  const visibleRows = privateChat ? privateRows : conversationOnly && !handLog
    ? tableRows.filter(row => row.cost || !['action', 'decision'].includes(row.category))
    : tableRows;

  return (
    <div className={"dsk-panel dsk-panel--watch"+(conversationOnly?" is-conversation":"")}>
      <PanelHead
        title={agent?.name || 'At the table'}
        sub={agent?.name ? (between ? 'BETWEEN HANDS' : 'AT THE TABLE') : null}
        actions={<MuteToggle compact/>}
        onClose={showStats ? () => changeView('chat') : onClose}
      />
      {conversationOnly && <div style={{ padding: '8px 14px', flexShrink: 0, borderBottom: '1px solid var(--sys-border, #303034)' }}>
        <div style={{ fontSize: 11, color: 'var(--sys-muted, #B8B8BF)', marginBottom: 8 }}>
          {agent && !readOnly ? 'Watching your agent' : 'Watching this table'}
        </div>
        <div role="group" aria-label="Table conversation view" style={{ display: 'flex', gap: 6 }}>
          {[['Chat', 'chat'], ['Hand log', 'hand-log'], ...(canShowStats ? [['Stats', 'stats']] : [])].map(([label, tab]) => <button
            key={label} type="button" aria-pressed={activeView === tab} onClick={() => changeView(tab)}
            style={{ minHeight: 32, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: 12,
              border: '1px solid var(--sys-border, #303034)', color: 'var(--sys-text, #EDEDED)',
              background: activeView === tab ? 'var(--sys-panel-2, #24242B)' : 'transparent' }}
          >{label}</button>)}
        </div>
      </div>}
      {agentReturn?.visible && <div className="dsk-watch-return">
        <button type="button" disabled={agentReturn.disabled} onClick={agentReturn.request}>{agentReturn.label}</button>
        <p role={agentReturn.error ? 'alert' : 'status'}>{agentReturn.detail}</p>
      </div>}
      <RailBody>
        {/* WATCH-6, board 31: the rail leads with THE TABLE — everything said
            here, in order, whoever said it. On the phone this is a sheet you
            pull up; at 1440 there is room for it to be always open, which is
            what the ref says on it. */}
        {showStats ? <>
          <AnalysisPanel action="Back to chat" onAction={() => changeView('chat')}>
            <WatchAgentStats agent={agent} seat={game?.seats?.[heroSeat]} />
          </AnalysisPanel>
        </> : <AnalysisPanel title={conversationOnly ? null : "The table"}>
          {visibleRows.length === 0
            ? <div className="dsk-apanel__empty">{privateChat ? 'No private messages yet.' : conversationOnly && !handLog && tableRows.length
              ? 'No conversation yet. Follow each action in Hand log.' : 'Nothing said at this table yet.'}</div>
            : visibleRows.map((r) => <ThreadRow key={r.id} row={r} />)}
        </AnalysisPanel>}

        {!readOnly && !conversationOnly && <><AnalysisPanel title="Live analysis">
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

        </>}
      </RailBody>

      {!readOnly && error && <div className="agent-view__error" role="alert">{error}</div>}
      {!readOnly && <PComposer
        compact={conversationOnly}
        inputRef={composerRef}
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        busy={sending}
        placeholder="Whisper to him…"
        onCommand={(cmd) => onDraftChange(`${cmd} `)}
      />}
    </div>
  );
}
