// The right panel, when a ghost is selected. Anatomy ported from
// design-refs/mood-desktop2.jsx D2LiveScreenM / D2RestingScreenM:
// PanelHead(close) → MoodBand → pinned GameTile while live → feed → PComposer.
//
// The camera never moves: selecting a ghost swaps THIS panel, not the stage.
import { useEffect, useRef, useState } from 'react';
import { MoodBand } from '../system/MoodBand.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { accentFor, MOODS } from '../floor/atoms.jsx';
import { moodOf, causeOf, stateOf } from '../floor/agentView.js';
import { GameTile } from './GameTile.jsx';
import { PanelHead, PComposer } from './panelParts.jsx';
import { PlayerCardRail } from './PlayerCardRail.jsx';
import { useAgentThread } from './useAgentThread.js';

const PROFILE_LABELS = {
  tightness: 'Tightness', aggression: 'Aggression',
  bluffFreq: 'Bluff freq', discipline: 'Discipline',
};

function MsgAvatar({ mood, accent }) {
  return (
    <div className="dsk-msg__avatar" style={{ borderColor: `${accent}44` }}>
      <MoodGhost mood={mood} accent={accent} size={27} ring={false} />
    </div>
  );
}

function AgentBubble({ mood, accent, children }) {
  const moodColor = MOODS[mood]?.color ?? 'var(--dsk-muted)';
  return (
    <div className="dsk-msg">
      <MsgAvatar mood={mood} accent={accent} />
      <div className="dsk-msg__body">
        <div
          className="dsk-msg__bubble"
          style={{ borderColor: `${moodColor}33`, borderLeft: `2px solid ${moodColor}` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function OwnerBubble({ children }) {
  return (
    <div className="dsk-msg dsk-msg--own">
      <div className="dsk-msg__bubble dsk-msg__bubble--own">{children}</div>
    </div>
  );
}

function TypingBubble({ mood, accent }) {
  const moodColor = MOODS[mood]?.color ?? 'var(--dsk-muted)';
  return (
    <div className="dsk-msg">
      <MsgAvatar mood={mood} accent={accent} />
      <div className="dsk-msg__body">
        <div
          className="dsk-msg__bubble dsk-msg__bubble--typing"
          style={{ borderColor: `${moodColor}33`, borderLeft: `2px solid ${moodColor}` }}
        >
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function AcceptedLine() {
  return (
    <div className="dsk-accepted">
      <div className="dsk-accepted__rule" />
      <span className="dsk-accepted__pill">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5 9-11" />
        </svg>
        CHANGE ACCEPTED
      </span>
      <div className="dsk-accepted__rule" />
    </div>
  );
}

function ProposalCard({ proposal, profile, accent, accepting, onAccept, onDiscuss }) {
  const delta = proposal?.suggestedPatch?.profileDelta ?? {};
  const rows = Object.entries(delta).map(([k, d]) => {
    const from = Math.round(profile?.[k] ?? 50);
    return { key: k, label: PROFILE_LABELS[k] ?? k, from, to: Math.max(0, Math.min(100, from + Number(d))) };
  });
  return (
    <div className="dsk-proposal">
      <div className="dsk-proposal__head">
        <span className="dsk-proposal__tag">Proposed change</span>
        <div className="dsk-proposal__spacer" />
        <span className="dsk-proposal__his">HIS IDEA</span>
      </div>
      {proposal?.text && <div className="dsk-proposal__text">{proposal.text}</div>}
      {rows.length > 0 && (
        <div className="dsk-proposal__rows">
          {rows.map((r, i) => (
            <div key={r.key} className="dsk-proposal__row" style={i > 0 ? undefined : { borderTop: 'none' }}>
              <span className="dsk-proposal__label">{r.label}</span>
              <span className="dsk-proposal__from">{r.from}%</span>
              <svg width="16" height="12" viewBox="0 0 24 18" fill="none" stroke="var(--dsk-teal)"
                strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 9h16M14 4l5 5-5 5" /></svg>
              <span className="dsk-proposal__to" style={{ color: accent }}>{r.to}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="dsk-proposal__note">Applies on the next deploy. Everything else stays as configured.</div>
      <div className="dsk-proposal__actions">
        <button type="button" className="dsk-btn dsk-btn--primary" onClick={onAccept} disabled={accepting}>
          {accepting ? 'Accepting…' : 'Accept'}
        </button>
        <button type="button" className="dsk-btn dsk-btn--ghost" onClick={onDiscuss}>Discuss</button>
      </div>
    </div>
  );
}

export function ThreadPanel({
  agent, accentIndex, game, lastDecision, isWatched,
  draft, onDraftChange, onClose, onWatch, onDeploy, onFocusTable,
}) {
  const { chat, sending, accepting, send, acceptProposal, moodOverride, causeOverride } = useAgentThread(agent);
  const feedRef = useRef(null);
  // D3ThreadCardScreenM puts the player card in a panel of its own beside the
  // thread. This shell has one 520 panel, not two, so the card is a view of it
  // — reachable only while a thread is open, which is the ref's condition.
  const [view, setView] = useState('thread');

  const accent = accentFor(agent, accentIndex);
  const mood = moodOverride ?? moodOf(agent);
  const cause = causeOverride ?? causeOf(agent);
  const state = stateOf(agent);
  const isLive = state === 'live';

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [chat, sending]);

  function handleSend(text) {
    if (!text.trim() || sending) return;
    onDraftChange('');
    send(text);
  }

  return (
    <div className="dsk-panel">
      <PanelHead
        title={view === 'card' ? 'Player card' : agent.name}
        sub={view === 'card'
          ? agent.name.toUpperCase()
          : isLive ? 'AT THE TABLE' : state === 'recap' ? 'SESSION DONE' : 'RESTING'}
        onClose={onClose}
      />
      <div className="dsk-panel__views" role="tablist">
        {[['thread', 'Thread'], ['card', 'Player card']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`dsk-panel__view${view === key ? ' is-on' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'card' ? (
        <PlayerCardRail agent={agent} accentIndex={accentIndex} />
      ) : (
      <>
      <MoodBand
        accent={accent}
        mood={mood}
        cause={cause}
        state={state}
        action={isLive ? 'Watch' : 'Deploy'}
        onAction={() => (isLive ? onWatch?.(agent) : onDeploy?.(agent))}
      />

      {isLive && (
        <div className="dsk-panel__pinned">
          <GameTile
            agentName={agent.name}
            game={isWatched ? game : null}
            lastDecision={isWatched ? lastDecision : null}
            highlighted
            onWatch={() => onWatch?.(agent)}
            onFocusTable={isWatched ? onFocusTable : null}
          />
        </div>
      )}

      <div className="dsk-rail-body dsk-rail-body--feed" ref={feedRef}>
        {chat.map((m) => {
          if (m.role === 'user') return <OwnerBubble key={m._id}>{m.content}</OwnerBubble>;
          if (m.role === 'accepted') return <AcceptedLine key={m._id} />;
          if (m.role === 'proposal') {
            return (
              <div className="dsk-msg" key={m._id}>
                <MsgAvatar mood={mood} accent={accent} />
                <div className="dsk-msg__body">
                  <ProposalCard
                    proposal={m.proposal}
                    profile={agent.profile}
                    accent={accent}
                    accepting={accepting}
                    onAccept={() => acceptProposal(m._id)}
                    onDiscuss={() => onDraftChange(draft || '')}
                  />
                </div>
              </div>
            );
          }
          return <AgentBubble key={m._id} mood={mood} accent={accent}>{m.content}</AgentBubble>;
        })}
        {sending && <TypingBubble mood={mood} accent={accent} />}
      </div>

      </>
      )}

      <PComposer
        value={draft}
        onChange={onDraftChange}
        onSend={handleSend}
        busy={sending}
        placeholder={`Message ${agent.name}…`}
        onCommand={(cmd) => onDraftChange(`${cmd} `)}
      />
    </div>
  );
}
