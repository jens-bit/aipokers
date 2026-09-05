// Panel furniture ported from design-refs/mood-desktop.jsx (PanelHead) and
// design-refs/mood-desktop2.jsx (PComposer, PRosterRow) and
// design-refs/mood-desktop3.jsx (RailBody, DraftPanel).
import { useEffect, useRef } from 'react';
import { FloorGhost, StateTag, MOODS, safeMood } from '../floor/atoms.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { GrewBadge, NatureFormingChip } from '../system/CharacterAtoms.jsx';
import { NatureFormed } from '../system/NatureFormed.jsx';
import { AttrTrack } from '../system/AttrBar.jsx';
import { NavIcon } from './primitives.jsx';

// 46px fixed head with an optional close affordance.
export function PanelHead({ title, sub, onClose }) {
  return (
    <div className="dsk-panel-head">
      <span className="dsk-panel-head__title">{title}</span>
      {sub && <span className="dsk-panel-head__sub">{sub}</span>}
      <div className="dsk-panel-head__spacer" />
      {onClose && (
        <button
          type="button"
          className="dsk-panel-head__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// The one scrolling region of the panel — head and composer stay put.
export function RailBody({ children, pad = 14, bodyRef }) {
  return (
    <div className="dsk-rail-body" ref={bodyRef} style={{ padding: pad }}>
      <div className="dsk-rail-body__col">{children}</div>
    </div>
  );
}

// Small hood avatar — the mobile MoodGhost atom in a 6px-radius tile.
export function PHood({ size = 22, accent = '#00D4AA', mood = 'confident' }) {
  return (
    <div className="dsk-phood" style={{ width: size, height: size, borderColor: `${accent}44` }}>
      <MoodGhost mood={safeMood(mood)} accent={accent} size={size - 1} ring={false} />
    </div>
  );
}

const SLASH_COMMANDS = [
  { cmd: '/deploy', desc: 'send agent to a table' },
  { cmd: '/build', desc: 'create new agent' },
  { cmd: '/replay', desc: 'pull a hand' },
  { cmd: '/analyze', desc: 'review last session' },
  { cmd: '/sit-out', desc: 'pause an agent' },
];

// The composer is controlled from above so a draft survives switching agents.
export function PComposer({ value = '', onChange, onSend, placeholder, busy, onCommand }) {
  const ref = useRef(null);
  const slash = value.trim().startsWith('/');

  // Autosize is deliberate: 2 rows at rest, grows to 5 while typing a long note.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  }, [value]);

  function keyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSend?.(value);
    }
  }

  return (
    <div className="dsk-composer">
      {slash ? (
        <div className="dsk-composer__cmds">
          {SLASH_COMMANDS.map((c) => {
            const on = c.cmd.startsWith(value.trim());
            return (
              <button
                key={c.cmd}
                type="button"
                className={`dsk-composer__cmd${on ? ' is-on' : ''}`}
                onClick={() => onCommand?.(c.cmd)}
              >
                <span className="dsk-composer__cmd-name">{c.cmd}</span>
                <span className="dsk-composer__cmd-desc">{c.desc}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dsk-composer__hint">
          <span className="dsk-composer__slash">/</span>
          <span>for commands</span>
        </div>
      )}

      <div className={`dsk-composer__box${slash ? ' is-slash' : ''}`}>
        <span className="dsk-composer__sparkle"><NavIcon name="sparkle" size={16} /></span>
        <textarea
          ref={ref}
          className="dsk-composer__input"
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={keyDown}
        />
        <div className="dsk-composer__actions">
          <span className="dsk-composer__kbd">⌘↵</span>
          <button
            type="button"
            className="dsk-composer__send"
            onClick={() => onSend?.(value)}
            disabled={busy || !value.trim()}
            aria-label="Send message"
          >
            <NavIcon name="send" size={14} />
          </button>
        </div>
      </div>

      <div className="dsk-composer__foot">
        <span>Synced with Telegram</span>
        <span className="dsk-dot" style={{ width: 5, height: 5 }} aria-hidden />
        <div className="dsk-composer__foot-spacer" />
        <span>⌘K commands · ⌘↵ send</span>
      </div>
    </div>
  );
}

export function PRosterRow({ name, accent, mood, state, line, pnl, grew, active, onClick }) {
  const m = safeMood(mood);
  const down = typeof pnl === 'string' && (pnl.startsWith('−') || pnl.startsWith('-'));
  return (
    <button
      type="button"
      className={`dsk-roster-row${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <PHood size={34} accent={accent} mood={m} />
      <div className="dsk-roster-row__text">
        <div className="dsk-roster-row__name-line">
          <span className="dsk-roster-row__name">{name}</span>
          <StateTag state={state} compact />
          {grew > 0 && <GrewBadge gain={grew} />}
        </div>
        <div
          className="dsk-roster-row__line"
          style={{ color: `color-mix(in oklab, ${MOODS[m].color} 32%, var(--dsk-dim))` }}
        >
          {line}
        </div>
      </div>
      <span className={`dsk-roster-row__pnl${down ? ' is-down' : ''}`}>{pnl}</span>
    </button>
  );
}

// The empty-rail invitation. Its button is the ONLY creation entry on desktop —
// it opens BirthScreen (BIR-2: one creation path). There is no second form.
// DP-4 — the draft panel, from D4FlowScreenM in design-refs/mood-flow2.jsx.
//
// Two states, and the difference between them is whether a draft is actually
// under way. With no draft this is the invitation it has always been. With one
// it becomes the ref's "Taking shape" panel: how defined he is, the nature the
// brief implies, and what the button will do.
//
// NatureFormed is the mobile component (F-1), reading the same natureHint the
// phone reads. A nature is never invented here — with nothing hinted it draws
// the neutral forming chip, which is what this panel already did.
//
// SEAM: App.jsx replaces the whole screen with BirthScreen while a draft is
// running, so on desktop today nothing is mounted to pass `draft` in. When the
// desk keeps its shell during a draft, this is the panel that reads it.
export function DraftPanel({ first, onDraft, draft = null }) {
  if (draft) return <TakingShapePanel draft={draft} onDraft={onDraft} />;

  return (
    <div className="dsk-draft">
      <div className="dsk-draft__ghost">
        <FloorGhost mood="neutral" accent="#00D4AA" size={62} speed={7} />
      </div>
      <div className="dsk-draft__title">{first ? 'Draft your first agent' : 'Draft another agent'}</div>
      <div className="dsk-draft__forming"><NatureFormingChip /></div>
      <div className="dsk-draft__body">
        {first
          ? 'Describe how you want him to play. He takes a seat, plays his own hands, and reports back here.'
          : 'Four seats maximum. You have room for one more.'}
      </div>
      <button type="button" className="dsk-btn dsk-btn--primary" onClick={onDraft}>
        {first ? 'Draft an agent' : 'Draft'}
      </button>
    </div>
  );
}

const DIALS = [
  ['Style', 'style'],
  ['Risk', 'risk'],
  ['Tightness', 'tightness'],
  ['Aggression', 'aggression'],
];

function TakingShapePanel({ draft, onDraft }) {
  const phase = Math.max(0, Math.min(1, Number(draft.phase) || 0));
  const defined = Math.round(phase * 100);
  // The ref calls a draft usable at 86%; below that the nature is still a
  // guess and the chip says so rather than committing to a name.
  const ready = !!draft.ready || phase >= 0.86;

  return (
    <div className="dsk-shape">
      <div className="dsk-shape__head">
        <span className="dsk-label" style={{ fontSize: 9.5 }}>Taking shape</span>
        <span className="dsk-shape__pct">{defined}% DEFINED</span>
      </div>

      <div className="dsk-shape__meter" role="progressbar"
        aria-label="How defined the draft is"
        aria-valuenow={defined} aria-valuemin={0} aria-valuemax={100}>
        <div className="dsk-shape__fill" style={{ width: `${defined}%` }} />
      </div>

      <div className="dsk-shape__nature">
        <NatureFormed name={draft.natureHint ?? null} formed={ready} />
      </div>

      {DIALS.some(([, k]) => Number.isFinite(draft[k])) && (
        <div className="dsk-shape__dials">
          {DIALS.filter(([, k]) => Number.isFinite(draft[k])).map(([label, k]) => (
            <div key={k} className="dsk-shape__dial">
              <span className="dsk-shape__dial-label">{label}</span>
              <AttrTrack cur={draft[k]} />
              <span className="dsk-shape__dial-val">{Math.round(draft[k])}</span>
            </div>
          ))}
        </div>
      )}

      {/* The one thing the owner has to know before he presses it. */}
      <div className="dsk-shape__note">
        <span className="dsk-label dsk-label--teal" style={{ fontSize: 9.5 }}>
          What happens on the button
        </span>
        <p>
          He is born, names himself, and walks onto the floor. His temperament is
          read from this conversation and <b>cannot be changed afterwards</b>.
        </p>
      </div>

      {onDraft && (
        <button
          type="button"
          className="dsk-btn dsk-btn--primary dsk-shape__deal"
          onClick={onDraft}
          disabled={!ready}
        >
          {ready ? 'Deal him in' : 'Keep describing him'}
        </button>
      )}
    </div>
  );
}
