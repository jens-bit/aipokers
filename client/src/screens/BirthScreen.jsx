// NAV-1d — birth/create flow ported from design-refs/mood-birth.jsx.
// MaterializingOccupant — exported for App.jsx to overlay on the CASINO floor.
//
// ATTR-2c — the nature reveal from design-refs/char-birth.jsx.
// VOICE LAW: before birth the drafting voice is the RECRUITER — system
// furniture, neutral border, no mood, no pip. Nobody speaks for the agent
// before he exists, and his first words are his nature. The recruiter may show
// a nature FORMING but never commits: the client never picks one, it only
// renders what the server assigned.
//
// ── DRAFT-2 · THE DRAFT IS ON GLASS NOW ──────────────────────────────────
//
// Board 29 frames F02/F03 (wave 56, design-refs/mood-sit.jsx `DraftSheetM`)
// move the CREATE draft off a grey chat screen and onto the board-26 glass
// sheet, risen over the empty room, with him forming in the band above it.
// The frame's caption is the brief: "The room stays behind it, dimmed to almost
// nothing, because he is not in it yet. The sheet covers the lower band only:
// the top is where he forms, and watching him form while you talk about him is
// the point."
//
// WHAT CHANGED IS THE SHELL, NOT THE CONVERSATION. Every wire behaviour below —
// the go signal, AGENTS-2's cap refusal, BIRTH-5's locked seat, the nature
// reveal and the birth card — is untouched, and the two 409s still land as
// recruiter lines in the thread rather than as modals.
//
// TWO THINGS THE SHEET DOES NOT DRAW, and one it now does.
//
// PACE-1d's four dials and the temperament chip they produced are gone from
// this screen. They are still on the wire and the desktop rail panel still
// reads them; what changed is that a readout of numbers has no place over a
// conversation whose whole claim is that you make him by TALKING to him. The
// ref's density is the rule — F02 and F03 put the rows straight onto the foot.
//
// And the pill under the ghost is wired to the name the moment it is given.
// BUGS-B/4 makes the draft ask "what's my name?" exactly once and coins the
// answer server-side; `draftName` carries it back on the very turn the owner
// answers, so F03's frame title — "He has a name" — is true of a man who has
// not been born yet, which is exactly what that frame draws.
//
// REBUILD MODE KEEPS THE OLD CHROME, deliberately. Wave 56's frames are titled
// "The draft opens" and "He has a name": they are about a man who does not
// exist yet, over a room he is not in. Rebuilding an agent who is alive, has a
// voice and is standing in that room is a different screen, and dressing it as
// a birth would be a lie about what is happening. So `isEdit` renders what it
// always did, and the glass is the create path's.

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { M_TEAL } from '../components/floor/atoms.jsx';
import { moodOf, heatOf } from '../components/floor/agentView.js';
import { MoodBand } from '../components/system/MoodBand.jsx';
import { MoodGhost } from '../components/system/MoodGhost.jsx';
import { AttrCluster } from '../components/system/AttrCluster.jsx';
import { NatureChip } from '../components/system/CharacterAtoms.jsx';
import { NextAction } from '../components/system/NextAction.jsx';
import { SheetFold } from '../components/system/SheetFold.jsx';
import { normalizeAttrs } from '../lib/attributes.js';
import { fetchSlots, lockedSeatLine } from '../lib/slots.js';
import { pillName } from '../lib/names.js';
import { identityOf } from '../lib/identity.js';
import { HomeFlat } from '../components/home/HomeFlat.jsx';
import { TableChairs } from '../components/home/HomeGame.jsx';
import { DraftSheet } from '../components/draft/DraftSheet.jsx';
import { FormingGhost as StageGhost, DRAFT_STAGES, draftStage } from '../components/system/FormingGhost.jsx';
import { pendingVisitorName, clearPendingVisitor } from '../lib/visit.js';
import '../styles/draft2.css';

// ── Design tokens (verbatim from design refs) ─────────────────────────────
const M_BG      = '#1A1A1E';
const M_PANEL   = '#232329';
const M_PANEL_2 = '#28282F';
const M_BORDER  = 'rgba(255,255,255,0.12)';
const M_TEXT    = '#EDEDED';
const M_DIM     = '#A1A1A1';
const M_MUTED   = '#6B6B6B';
const M_FAINT   = '#3A3A3F';
const M_GOLD    = '#CDB380';

const PLAYFAIR = '"Playfair Display",Georgia,serif';
const OSWALD   = '"Oswald","Helvetica Neue",sans-serif';
const MONO     = '"JetBrains Mono",ui-monospace,monospace';


// ── FormingGhost ─────────────────────────────────────────────────────────
// Verbatim port from mood-birth.jsx: exact path + eye geometry.
// phase 0 = dashed outline, no fill, no eyes.  phase 1 = finished neutral ghost.
function FormingGhost({ size = 40, phase = 0.5, accent = M_TEAL, drift = true }) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const fill   = 0.10 + phase * 0.30;
  const stroke = 0.30 + phase * 0.55;
  const dash   = phase >= 0.98 ? 'none' : `${1.5 + phase * 4} ${4 - phase * 2.6}`;
  const eyes   = Math.max(0, (phase - 0.42) / 0.58);
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96"
      style={{ display: 'block', animation: drift ? 'drift 4.6s ease-in-out infinite' : 'none' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`fg${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity={fill} />
          <stop offset="1" stopColor={accent} stopOpacity={fill * 0.15} />
        </linearGradient>
      </defs>
      {phase > 0.5 && (
        <ellipse cx="40" cy="52" rx={30 * phase} ry={34 * phase}
          fill={accent} opacity={(phase - 0.5) * 0.10} />
      )}
      <path
        d="M40 8 C24 8 15 22 15 42 L15 74 Q15 82 22 82 Q28 82 30 76 Q32 82 40 82 Q48 82 50 76 Q52 82 58 82 Q65 82 65 74 L65 42 C65 22 56 8 40 8 Z"
        fill={`url(#fg${uid})`}
        stroke={accent} strokeOpacity={stroke}
        strokeWidth={1.1} strokeDasharray={dash} strokeLinejoin="round"
      />
      {eyes > 0 && (
        <g opacity={eyes}>
          <ellipse cx="31" cy="44" rx="3.4" ry={2.2 + eyes * 0.6} fill={accent}
            style={{ filter: `drop-shadow(0 0 ${3 + eyes * 4}px ${accent})` }} />
          <ellipse cx="49" cy="44" rx="3.4" ry={2.2 + eyes * 0.6} fill={accent}
            style={{ filter: `drop-shadow(0 0 ${3 + eyes * 4}px ${accent})` }} />
        </g>
      )}
    </svg>
  );
}


// The phrase the server's isGoSignal() accepts as "I am done briefing" — it is
// what turns the draft into an agent. "Deal him in" is the label; this is the
// wire word behind it.
const GO_SIGNAL = "Let's go";

const DRAFT_STEPS = new Set(['briefing', 'naming', 'ready', 'created']);
const draftStorageKey = userId => `railbird:draft:${userId}`;
function readDraftSession(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftStorageKey(userId)) || 'null');
    return typeof saved?.draftId === 'string' ? saved : {};
  } catch { return {}; }
}
function writeDraftSession(userId, value) {
  try {
    if (value?.draftId) sessionStorage.setItem(draftStorageKey(userId), JSON.stringify(value));
    else sessionStorage.removeItem(draftStorageKey(userId));
  } catch { /* A private browser can still finish this mounted draft. */ }
}
const creationAttempt = () => globalThis.crypto?.randomUUID?.() ?? `birth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const chatLines = value => Array.isArray(value) ? value.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string') : [];

// ── DiffCard ─────────────────────────────────────────────────────────────
// Proposal-diff pattern from mood-birth.jsx BirthEditScreenM.
// Shown when the agent proposes a strategy rebuild.
function DiffCard({ accent = M_GOLD, origin, quote, from, to, rows, est, primary = 'Save', secondary = 'Keep talking', onPrimary, onSecondary }) {
  return (
    <div style={{
      background: M_PANEL_2, border: `1px solid ${M_GOLD}44`,
      borderRadius: 12, borderBottomLeftRadius: 4, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
        borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(205,179,128,0.06)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD, flex: 1 }}>{origin}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, fontWeight: 500 }}>{from}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_GOLD, fontWeight: 700 }}>{to}</span>
        </span>
      </div>
      {quote && (
        <div style={{ padding: '9px 12px 2px', fontSize: 12.5, color: M_TEXT, lineHeight: 1.45 }}>{quote}</div>
      )}
      <div style={{ padding: '7px 12px 9px' }}>
        {(rows || []).map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0',
            borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none',
          }}>
            <span style={{ flex: 1, fontSize: 12, color: M_DIM }}>{r.k}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: M_MUTED }}>{r.from}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span style={{ minWidth: 44, textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: accent }}>{r.to}</span>
          </div>
        ))}
      </div>
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${M_BORDER}`,
        background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, fontWeight: 500 }}>{est}</span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onSecondary} style={{
          height: 28, padding: '0 10px', borderRadius: 6, border: 'none',
          background: 'transparent', color: M_DIM, fontFamily: OSWALD,
          fontSize: 9, fontWeight: 600, letterSpacing: '0.10em', cursor: 'pointer',
          textTransform: 'uppercase',
        }}>{secondary}</button>
        <button type="button" onClick={onPrimary} style={{
          height: 28, padding: '0 12px', borderRadius: 6, border: 'none',
          background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', cursor: 'pointer',
          textTransform: 'uppercase',
        }}>{primary}</button>
      </div>
    </div>
  );
}


// ── Bubble atoms (shared with ChatsScreen, re-declared here to keep birth self-contained) ──
function AgentBubble({ children }) {
  return (
    <div style={{ display: 'flex', gap: 9, padding: '0 14px', marginBottom: 9, alignItems: 'flex-end' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${M_TEAL}44`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <FormingGhost size={27} phase={0.3} drift={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: M_PANEL_2, border: `1px solid rgba(136,136,136,0.20)`,
          borderLeft: `2px solid rgba(136,136,136,0.55)`,
          borderRadius: 12, borderBottomLeftRadius: 4,
          padding: '10px 13px', fontSize: 13, color: M_TEXT, lineHeight: 1.5,
        }}>{children}</div>
      </div>
    </div>
  );
}

function OwnerBubble({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 14px', marginBottom: 9 }}>
      <div style={{ maxWidth: 264 }}>
        <div style={{ background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44`, borderRadius: 12, borderBottomRightRadius: 4, padding: '10px 13px', fontSize: 13, color: M_TEXT, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SysLine({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', marginBottom: 9 }}>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
    </div>
  );
}

// Clock label for the recruiter's meta line and the birth card's timestamp.
function hhmm(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}


// ── The nature reveal ─────────────────────────────────────────────────────
// Port of NatureRevealOccupant from char-birth.jsx. Order is the whole beat:
// his line, then the ghost, then the name chip, then the nature chip last — the
// chip is the label the room puts on him, so it cannot arrive before he does.
function NatureReveal({ name, first, nature, identity, mood = 'neutral', heat = 45 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {first && (
        <div style={{
          width: 218, marginBottom: 2,
          background: 'rgba(17,23,32,0.94)', border: `1px solid ${M_TEAL}55`,
          borderRadius: 10, borderBottomLeftRadius: 3, padding: '8px 11px',
          boxShadow: `0 0 18px ${M_TEAL}22`, animation: 'birth-rise 0.5s ease-out both',
        }}>
          <div style={{ fontSize: 12, color: M_TEXT, lineHeight: 1.45 }}>{first}</div>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '48%', width: 64, height: 64,
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
          animation: 'birth-fadein 0.8s ease-out both',
        }} />
        <MoodGhost size={54} mood={mood} heat={heat} hood={identity?.hood} glow={identity?.glow?.c} ring={false} />
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 17, padding: '0 7px', borderRadius: 4,
        background: 'rgba(19,19,22,0.7)', border: `1px dashed ${M_TEAL}66`,
        opacity: 0.75, animation: 'birth-fadein 1.6s ease-out both',
      }}>
        <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }} />
        <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{name}</span>
      </div>
      <div style={{ animation: 'birth-rise 0.6s ease-out 0.2s both', marginTop: 2 }}>
        <NatureChip nature={nature} />
      </div>
    </div>
  );
}


// ── BirthCardSheet · v3 ───────────────────────────────────────────────────
// Port of design-refs/mood-birth3.jsx BirthCard3.
//
// F-2: the card led with six attribute bars, and READS / FOCUS / DISCIPLINE
// mean nothing to someone who has owned an agent for four seconds. It is now
// about HIM — his name, his nature, his first words, one line of what he is
// built for — and the sheet lives behind a fold that says so. On the owner's
// first agent the fold is never open.
//
// F-2 also gives the ghost a PLACE. The well sits half out of the sheet's top
// edge and the card rises from it, so there is exactly one ghost on screen at
// any moment rather than a reveal ghost being covered by a card ghost.
function BirthCardSheet({ name, nature, firstWords, character, identity, mood = 'neutral', heat = 45, onDealIn, first = true }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="birth-card3">
      {/* BIRTH-4: his place is a full slot INSIDE the sheet. The well used to
          hang half out of the top edge, which the sheet's own overflow then cut
          straight through his head. He gets the whole 96px and the glow around
          it; the sheet's top padding is what makes room. */}
      <div className="birth-card3__well-row">
        <div className="birth-card3__well">
          <MoodGhost mood={mood} heat={heat} accent={M_TEAL} hood={identity?.hood} glow={identity?.glow?.c} size={96} ring={false} />
        </div>
      </div>

      <div className="birth-card3__head">
        <div className="birth-card3__name">{name}</div>
        {nature?.name && (
          <div className="birth-card3__nature"><NatureChip nature={nature} size="l" /></div>
        )}
      </div>

      {/* His first words. Server-authored (ATTR-3 firstWords) or the nature's
          own line — the client never writes them. */}
      {firstWords && <div className="birth-card3__first">&ldquo;{firstWords}&rdquo;</div>}

      {/* One line of what he is for. The struggle half stays on the profile
          card: this screen is four seconds old and owes him a welcome, not a
          balance sheet. */}
      {nature?.builtFor && (
        <div className="birth-card3__built">
          <span className="birth-card3__built-label">BUILT FOR</span>
          <span className="birth-card3__built-text">{nature.builtFor}</span>
        </div>
      )}

      <div className="birth-card3__fold">
        <SheetFold open={open} onToggle={() => setOpen((v) => !v)} />
        {open && (
          <div className="birth-card3__sheet">
            <AttrCluster rows={character.rows} />
            <div className="birth-card3__sheet-note">
              Every number is exact. The gold band is <b>how good he might get</b>
              {' '}— it narrows as he plays. Nothing here is bought.
            </div>
          </div>
        )}
      </div>

      <button type="button" className="birth-card3__deal" onClick={onDealIn}>
        Deal him in
      </button>

      {first && !open && (
        <div className="birth-card3__later">
          YOU CAN READ THE NUMBERS LATER · HE EXPLAINS THEM AS THEY MATTER
        </div>
      )}
    </div>
  );
}


// ── MaterializingOccupant ─────────────────────────────────────────────────
// Exported: rendered as an absolute overlay on the CASINO floor after birth.
export function MaterializingOccupant({ name, phase = 0.72, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 5000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', left: '22%', bottom: 148,
      transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes birth-rise    { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        @keyframes birth-fadein  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {/* speech bubble */}
        <div style={{
          maxWidth: 168, marginBottom: 2,
          background: 'rgba(10,15,23,0.92)', border: `1px solid ${M_TEAL}55`,
          borderRadius: 10, borderBottomLeftRadius: 3, padding: '7px 10px',
          boxShadow: `0 0 18px ${M_TEAL}22`,
          animation: 'birth-rise 0.5s ease-out both',
        }}>
          <div style={{ fontSize: 12, color: M_TEXT, lineHeight: 1.4 }}>Deal me in whenever you're ready.</div>
        </div>

        {/* forming ghost + glow */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '50%', top: '48%', width: 64, height: 64,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none',
            background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
            animation: 'birth-fadein 0.8s ease-out both',
          }} />
          <FormingGhost size={54} phase={phase} />
        </div>

        {/* name chip — arrives late */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          height: 17, padding: '0 7px', borderRadius: 4,
          background: 'rgba(10,10,10,0.70)', border: `1px dashed ${M_TEAL}66`,
          opacity: 0.6, animation: 'birth-fadein 1.9s ease-out both',
        }}>
          <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }} />
          <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{name}</span>
        </div>
      </div>
    </div>
  );
}


// ── BirthScreen ──────────────────────────────────────────────────────────
// Full draft conversation with FormingGhost gaining definition as you talk.
// Calls onBirth(agent) when the server confirms agent creation.
// Pass `agent` prop (existing agent object) to open in edit/rebuild mode.
export function BirthScreen({ onBack, onBirth, agent, onSeeTable, scrollOnFocus = true, formingTarget = null }) {
  const userId  = getUserId();
  const isEdit  = !!agent;
  const [visitorAtDoor] = useState(() => !isEdit ? pendingVisitorName() : null);

  const [chat, setChat]       = useState([]);
  const [draft, setDraft]     = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase]     = useState(isEdit ? 0.72 : 0);
  const [agentName, setAgentName] = useState(isEdit ? agent.name : null);
  const [pendingDiff, setPendingDiff] = useState(null);
  // `ready` is the server saying there is enough of a brief to build him: it is
  // what puts the one gold button in the composer's place. The dials behind it
  // (PACE-1d's four numbers) are no longer state, because the sheet no longer
  // draws them — see the note on the sheet's `above` slot.
  const [ready, setReady] = useState(false);
  const [natureHint, setNatureHint] = useState(null);
  // The owner asked to keep talking, so the composer comes back with the brief
  // intact. Talking is never taken away.
  const [talking, setTalking] = useState(false);
  // The nature reveal. `born` holds the newborn once the server has assigned
  // him a nature; `beat` walks the two moments — the reveal on the floor, then
  // the card he was born with. Both stay null when the server sends no nature,
  // and the flow falls back to the shipped straight-to-floor birth.
  const [born, setBorn] = useState(null);
  // F-2: on the owner's first agent the card carries the reassurance line under
  // the button. The fold itself starts closed for everyone.
  const [firstAgent, setFirstAgent] = useState(true);
  const [beat, setBeat] = useState(null);
  const [draftStep, setDraftStep] = useState('briefing');
  const [sessionReady, setSessionReady] = useState(isEdit);
  const [modernDraft, setModernDraft] = useState(false);
  // BUG-198: what the recruiter is asking for RIGHT NOW, and the words that
  // answer it. Both come from the server rather than being decided here,
  // because the server is the thing that has to understand the answer — a
  // client that drew its own chips could offer one the recruiter has never
  // heard of, which is the bug this repair exists to make impossible.
  const [askStage, setAskStage] = useState('style');
  const [scriptedDraft, setScriptedDraft] = useState(false);
  const [draftChips, setDraftChips] = useState([]);
  const [suggestedName, setSuggestedName] = useState('');
  const [acceptedTurns, setAcceptedTurns] = useState(0);
  const [problem, setProblem] = useState(null);
  const [createdPending, setCreatedPending] = useState(false);
  const [formingStage, setFormingStage] = useState(1);
  const sessionRef = useRef(readDraftSession(userId));
  const sendingRef = useRef(false);
  const openingRef = useRef(!isEdit);
  const alive = useRef(true);
  const operation = useRef(0);
  const createdRef = useRef(null);
  const visitOutcomeRef = useRef(null);
  const handedOff = useRef(false);
  const timers = useRef(new Set());
  const birthCallback = useRef(onBirth);
  birthCallback.current = onBirth;

  const feedRef   = useRef(null);
  const inputRef  = useRef(null);
  const msgIdRef  = useRef(0);
  const mkMsg = (role, content, diff = null) => ({ role, content, diff, at: hhmm(), _id: ++msgIdRef.current });
  const openedAt = useRef(hhmm());

  // Count of AI responses drives phase (each response = +0.25, cap at 0.98 until born)
  const aiCount = useRef(0);
  const targetStage = modernDraft
    ? draftStep === 'ready' || draftStep === 'created' ? 4 : draftStep === 'naming' ? 3 : acceptedTurns ? 2 : 1
    : draftStage(aiCount.current);
  useEffect(() => {
    if (!modernDraft || formingStage === targetStage) return;
    if (formingStage > targetStage) { setFormingStage(targetStage); return; }
    // A concise brief may satisfy several recruiter questions. Still show the
    // authored hood and eyes in order, without making up extra questions.
    const timer = setTimeout(() => setFormingStage(value => Math.min(targetStage, value + 1)), formingStage === 1 ? 0 : 650);
    return () => clearTimeout(timer);
  }, [modernDraft, targetStage, formingStage]);

  function later(fn, delay) {
    const id = setTimeout(() => { timers.current.delete(id); if (alive.current) fn(); }, delay);
    timers.current.add(id);
  }
  function finishBirth(newborn) {
    if (!alive.current || handedOff.current) return;
    handedOff.current = true;
    if (!isEdit) writeDraftSession(userId, null);
    // Creating him succeeded even if the separate guest invitation could not
    // arrive. Keep the card and identity, then explain the visit in Home.
    if (visitOutcomeRef.current) birthCallback.current?.(newborn, visitOutcomeRef.current);
    else birthCallback.current?.(newborn);
  }
  function absorbDraft(data, replaceChat = false) {
    if (data.draftId) {
      sessionRef.current = { ...(sessionRef.current.draftId === data.draftId ? sessionRef.current : {}), draftId: data.draftId };
      writeDraftSession(userId, sessionRef.current);
    }
    if (DRAFT_STEPS.has(data.draftStep)) { setModernDraft(true); setDraftStep(data.draftStep); }
    if (Object.hasOwn(data, 'draftName')) setAgentName(data.draftName || null);
    if (Object.hasOwn(data, 'natureHint')) setNatureHint(data.natureHint || null);
    if (typeof data.ready === 'boolean') setReady(data.ready);
    if (Object.hasOwn(data, 'draftScripted')) setScriptedDraft(!!data.draftScripted);
    if (Object.hasOwn(data, 'draftStage')) setAskStage(data.draftStage || 'style');
    if (Object.hasOwn(data, 'draftChips')) setDraftChips(Array.isArray(data.draftChips) ? data.draftChips : []);
    if (Object.hasOwn(data, 'suggestedName')) setSuggestedName(data.suggestedName || '');
    if (replaceChat) {
      const lines = chatLines(data.chat);
      setChat(lines.map(m => mkMsg(m.role, m.content)));
      setAcceptedTurns(lines.filter(m => m.role === 'user').length);
    }
  }
  async function openSession(fresh = false) {
    const token = ++operation.current;
    openingRef.current = true; setSessionReady(false); setProblem(null);
    if (fresh) { sessionRef.current = {}; writeDraftSession(userId, null); }
    try {
      const res = await fetch('/api/agents/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, ...(sessionRef.current.draftId ? { draftId: sessionRef.current.draftId } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!alive.current || operation.current !== token) return;
      // Existing deployments can still speak the original creation protocol.
      if (res.status === 404) { openingRef.current = false; setSessionReady(true); return; }
      if (res.status === 409 && data?.error === 'draftExpired') {
        setProblem({ kind: 'expired', text: 'This draft is no longer available. Start a new draft when you are ready.' }); return;
      }
      if (!res.ok || typeof data?.draftId !== 'string' || !DRAFT_STEPS.has(data.draftStep)) throw new Error('Draft unavailable');
      absorbDraft(data, true);
      if (data.agentId || data.createdAgent?.id) await revealOrDeal(data);
      if (!alive.current || operation.current !== token) return;
      openingRef.current = false; setSessionReady(true);
    } catch {
      if (alive.current && operation.current === token) setProblem({ kind: 'open', text: 'Could not open your draft. Please try again.' });
    }
  }
  useEffect(() => {
    alive.current = true;
    if (!isEdit) openSession();
    return () => {
      alive.current = false; operation.current += 1;
      timers.current.forEach(clearTimeout); timers.current.clear();
    };
  }, []);


  // FIX-1c: no focus() on mount. Stealing focus opens the iOS keyboard the
  // instant the screen appears, which covers half the draft and hides the
  // content the owner came to read. The field is focused when they tap it.
  //
  // When they do, scroll the composer into view after the keyboard animates in
  // — iOS in Telegram needs the explicit push, because --tg-h shrinks the
  // container but the browser does not always scroll the focused element up.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !scrollOnFocus) return;
    let timer;
    function onFocus() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const bounds = el.getBoundingClientRect();
        const height = window.visualViewport?.height ?? window.innerHeight;
        // BUG-93: a field already visible must not interrupt the landing's
        // scroll to the room. Only a keyboard-obscured composer needs a push.
        if (bounds.top < 0 || bounds.bottom > height) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
    el.addEventListener('focus', onFocus);
    return () => { clearTimeout(timer); el.removeEventListener('focus', onFocus); };
  }, [scrollOnFocus]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [chat, loading]);

  // He exists. If the server gave him a nature, play the two beats from
  // char-birth.jsx — the reveal, then the card he was born with — and hand off
  // when the owner deals him in. If it did not, the nature is still forming and
  // there is nothing to announce: go straight to the floor, as before. A nature
  // is never invented here.
  async function revealOrDeal(data) {
    if (createdRef.current) return;
    const newborn = { id: data.agentId ?? data.createdAgent?.id ?? data.id, name: data.agentName ?? data.createdAgent?.name ?? data.name ?? 'New agent', strategy: data.strategy ?? data.createdAgent?.strategy ?? '' };
    createdRef.current = newborn;
    visitOutcomeRef.current = data.visitOutcome ?? null;
    setCreatedPending(true); setAgentName(newborn.name); setPhase(1);
    let record = data.createdAgent?.id === newborn.id ? data.createdAgent : null;
    if (typeof data.firstAgent === 'boolean') setFirstAgent(data.firstAgent);
    if (!record) try {
      const res = await fetch(`/api/agents?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      });
      if (!res.ok) throw new Error('Record unavailable');
      const payload = await res.json();
      const roster = payload.agents || [];
      record = roster.find((a) => a.id === newborn.id) ?? null;
      if (alive.current) setFirstAgent(roster.length <= 1);
    } catch { /* no record — treat him as still forming */ }
    if (!alive.current) return;
    const character = normalizeAttrs(record);
    if (!character.nature) {
      later(() => finishBirth(newborn), 1200);
      return;
    }
    // normalizeAttrs keeps only {name, up, down, line}; ATTR-3's builtFor and
    // firstWords live on the record, so the raw nature rides along too.
    const revealed = {
      ...newborn,
      identity: identityOf(record ?? newborn),
      // BIRTH-4: his face on the card is the served face. A newborn's mood is
      // whatever the server gave him a second ago — read, never invented here.
      mood: moodOf(record),
      heat: heatOf(record),
      first: record?.firstWords ?? character.nature.line,
      nature: { ...character.nature, builtFor: record?.nature?.builtFor ?? null },
      character,
    };
    const showReveal = () => {
      setBorn(revealed); setBeat('reveal');
      later(() => setBeat('card'), 2200);
    };
    // Choosing a name for him can create directly from the naming question.
    // Let his last authored forming beat land before replacing it with him.
    if (modernDraft && formingStage < 4) later(showReveal, (4 - formingStage) * 650 + 100);
    else showReveal();
  }

  // AGENTS-2: four is the roster, and the way past it is to retire someone —
  // never to delete him. The line says which action to take, in the recruiter's
  // own register, because it is the recruiter who is turning the seat down.
  const CAP_LINE = (cap) =>
    `You already have ${cap || 4} agents. Retire one to make room, and I'll finish this one.`;

  // BIRTH-5 / SLOTS-1: the other 409, and it is not the same refusal. The cap
  // is a wall; a locked slot is a price, and a price the owner is ON HIS WAY to
  // — so the line says the number, says what he has against it, and says that
  // the draft is not lost. It used to say nothing at all: the body has no
  // `chat`, so the reply picker below found none, and "lets go" simply did
  // nothing forever.
  //
  // The refusal body carries the price and the earnings but not WHICH seat this
  // is, so the ordinal comes from /api/slots — one extra GET, on a path that is
  // already a dead stop, and the sentence degrades to "next seat" if it fails.
  async function slotLockedLine(body) {
    let index = null;
    try { index = (await fetchSlots())?.next?.index ?? null; } catch { /* "next seat" */ }
    const line = lockedSeatLine({ ...body, index });
    if (!line) return null;
    return `${line[0].toUpperCase()}${line.slice(1)}. Win the rest at the casino and I'll finish him — your draft keeps.`;
  }

  async function send(content = draft, requestedIntent) {
    const text = content.trim();
    if (!text || sendingRef.current || openingRef.current || createdRef.current) return;
    const intent = requestedIntent ?? (modernDraft && draftStep === 'naming' && !talking ? 'name' : 'brief');
    const token = ++operation.current;
    const ownerLine = mkMsg('user', text);
    sendingRef.current = true;
    if (modernDraft && intent === 'create' && !sessionRef.current.attemptId) {
      sessionRef.current = { ...sessionRef.current, attemptId: creationAttempt() };
      writeDraftSession(userId, sessionRef.current);
    }
    setDraft('');
    setLoading(true);
    setProblem(null);
    setPendingDiff(null);
    setChat((prev) => [...prev, ownerLine]);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: text, ...(isEdit ? { existingAgentId: agent.id } : {}),
          ...(modernDraft ? { draftId: sessionRef.current.draftId, draftIntent: intent,
            ...(intent === 'create' ? { attemptId: sessionRef.current.attemptId } : {}) } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!alive.current || operation.current !== token) return;

      if (res.status === 409 && data?.error === 'draftExpired') {
        openingRef.current = true; setSessionReady(false);
        setChat(prev => prev.filter(m => m._id !== ownerLine._id));
        setProblem({ kind: 'expired', text: 'This draft is no longer available. Start a new draft when you are ready.' });
        return;
      }

      // AGENTS-2: the roster is full. The draft is untouched on the server, so
      // this is the whole message — make room and say "lets go" again.
      if (res.status === 409 && data?.error === 'agentCap') {
        setChat((prev) => [...prev, mkMsg('assistant', CAP_LINE(data.cap))]);
        return;
      }

      // BIRTH-5: the slot exists and has not been won yet. Same shape as the
      // cap above — one recruiter line, draft untouched — plus the one action
      // there is, which is to go and look at the table.
      if (res.status === 409 && data?.error === 'slotLocked') {
        const line = await slotLockedLine(data);
        if (!alive.current || operation.current !== token) return;
        setChat((prev) => [...prev, {
          // A refusal with no readable price still has to say SOMETHING, and
          // what it says is the true part: the seat is not open yet.
          ...mkMsg('assistant', line
            ?? 'That seat is not open yet — it is won at the casino, not bought. Your draft keeps.'),
          seeTable: !!onSeeTable,
        }]);
        return;
      }

      if (!res.ok || !data || (modernDraft && !DRAFT_STEPS.has(data.draftStep))) throw new Error('Draft request failed');

      // Pick up the AI reply
      const allAi = chatLines(data.chat).filter((m) => m.role === 'assistant');
      const reply = allAi[allAi.length - 1];
      const diff = data.diff || null;
      if (modernDraft) {
        absorbDraft(data, true);
        if (intent !== 'create') {
          sessionRef.current = { draftId: sessionRef.current.draftId };
          writeDraftSession(userId, sessionRef.current);
        }
        setTalking(false);
      } else if (reply) {
        setChat((prev) => [...prev, mkMsg('assistant', reply.content, diff)]);
      }

      // DRAFT-2: he is named the turn the owner names him, not at birth. The
      // server coins it (agentProfiles' `draftName`, the same coinName call the
      // build makes), so the pill over the room shows the name he will actually
      // walk in with rather than a guess that changes underneath it.
      //
      // Kept once given: a later turn that carries no name has not un-named
      // him. A name is a decision, and a decision does not un-happen.
      if (data.draftName) setAgentName(data.draftName);
      if (data.natureHint) setNatureHint(data.natureHint);
      if (data.ready) { setReady(true); setTalking(false); }

      aiCount.current += 1;
      const newPhase = data.agentId ? 1.0 : Math.min(0.98, isEdit ? 0.72 + aiCount.current * 0.09 : aiCount.current * 0.28);
      setPhase(newPhase);

      if (data.agentId || data.createdAgent?.id) {
        await revealOrDeal(data);
      }
    } catch {
      if (!alive.current || operation.current !== token) return;
      setChat(prev => prev.filter(m => m._id !== ownerLine._id));
      if (intent !== 'create') setDraft(text);
      setProblem({ kind: 'send', text: intent === 'create'
        ? 'Could not confirm his arrival. Try again — your draft is saved.'
        : 'Could not send that. Your words are still here — try again.' });
    } finally {
      sendingRef.current = false;
      if (alive.current && operation.current === token) setLoading(false);
    }
  }

  const isReady  = phase >= 1.0;
  // Only once the server says he can be built, only while the owner has not
  // asked to keep talking, and never once he exists. Read by the create shell
  // alone — a rebuild has no birth to press towards.
  // Board 29's gold action follows the name, not merely a usable playing style.
  // Old servers retain their original ready contract during a rolling deploy.
  const showNextAction = (modernDraft ? draftStep === 'ready' : ready) && !talking && !born;
  // BUG-198: the fourth stage is a field with a name already in it. It is
  // pre-filled ONCE, on arrival, and never again — re-filling it on every
  // render would overwrite a name somebody is halfway through typing.
  // Scripted only. An owner's fourth stage stays the composer and Send it has
  // always been — the model asks him for a name in its own words, and there is
  // no suggestion to pre-fill because nothing computed his character.
  const namingStage = scriptedDraft && modernDraft && askStage === 'name' && draftStep === 'naming' && !talking && !born;
  const prefilled = useRef(null);
  useEffect(() => {
    if (!namingStage || !suggestedName) { if (!namingStage) prefilled.current = null; return; }
    if (prefilled.current === suggestedName) return;
    prefilled.current = suggestedName;
    setDraft((current) => (current.trim() ? current : suggestedName));
  }, [namingStage, suggestedName, setDraft]);

  // One tap ends the draft: the name in the field, then the birth. Two requests
  // because the server keeps naming and building as separate intents, but ONE
  // gesture, because "four taps" is the requirement and a second button between
  // a finished character and his arrival is the thing that made it five.
  async function dealHimIn() {
    if (sendingRef.current || createdRef.current) return;
    const chosen = (draft.trim() || suggestedName || '').trim();
    if (chosen) await send(chosen, 'name');
    if (createdRef.current) return;
    await send(GO_SIGNAL, 'create');
  }
  const naming = modernDraft && draftStep === 'naming' && !talking;
  const hasTalked = chat.some(m => m.role === 'user');

  const suggestions = phase < 0.3
    ? ['Tight and patient', 'Aggressive bluffer', 'Solver-strict']
    : ['Heads-up only', 'Everywhere in position'];

  // BUG-198: the server's chips when it sends any. A SCRIPTED draft (a guest's)
  // always does, at every stage — that is the repair. An owner's draft sends
  // none, and falls back to the three openers this screen has always offered
  // before the first answer, because those are complete briefs a model can
  // build from and the script's single words are not. Same fallback covers an
  // older server during a rolling deploy.
  const stageChips = draftChips.length ? draftChips : (!hasTalked ? suggestions : []);

  // The create draft's opening line is the sheet's first row; the rebuild's is
  // the first thing the agent says. The footnote that used to ride under it on
  // the create side ("Plain words work…") went with the grey chat shell: a
  // sheet row is a thing somebody said, and nothing in this conversation says a
  // footnote. The suggestion chips are what tells an owner with no words ready
  // where to start now.
  // VISIT-1 job 6: a stranger who scrolled down off "<name> is at your door"
  // is not drafting for its own sake — read once, so the recruiter's very
  // first line says so rather than repeating the hero a beat later. Cleared
  // immediately: a rebuild reached from anywhere else in the app must never
  // pick up a stale knock from an earlier tab.
  useEffect(() => { if (visitorAtDoor) clearPendingVisitor(); }, [visitorAtDoor]);
  const openingLine = isEdit
    ? 'Tell me what to change.'
    : visitorAtDoor
      ? `${visitorAtDoor} is waiting at the door. Tell me how yours should play, and you can let him in.`
      : 'One open seat. Tell me how it should play — style, risk, how tight, how aggressive.';

  // The nature reveal and the birth card. Shared by both shells: he is born the
  // same way whichever screen drafted him.
  const bornOverlay = (
    <>
        {/* The nature reveal — two beats, then he is the owner's to deal in.
            BirthNatureFloorScreenM: his line, the ghost, the name chip, the badge.
            BirthCardScreenM: the room dims and the card he was born with rises. */}
        {born && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: beat === 'card' ? 'rgba(8,8,10,0.62)' : 'rgba(8,8,10,0.32)',
              transition: 'background 0.4s ease-out',
            }} />
            {beat !== 'card' && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: '22%',
                display: 'flex', justifyContent: 'center',
                transition: 'top 0.45s ease-out', pointerEvents: 'none',
              }}>
                <NatureReveal name={born.name} first={born.first} nature={born.character.nature} identity={born.identity} mood={born.mood} heat={born.heat} />
              </div>
            )}
            {beat === 'card' && (
              <BirthCardSheet
                name={born.name}
                nature={born.nature}
                mood={born.mood}
                heat={born.heat}
                firstWords={born.first}
                character={born.character}
                identity={born.identity}
                first={firstAgent}
                onDealIn={() => finishBirth({ id: born.id, name: born.name, strategy: born.strategy })}
              />
            )}
          </div>
        )}
    </>
  );


  // ── The draft, on glass ────────────────────────────────────────────────
  // Board 29 F02/F03. The room, him forming over it, and the sheet.
  if (!isEdit) {
    // Every turn so far as the sheet's two registers. The opening line is the
    // recruiter's first question, so it is a row like any other rather than a
    // header — the sheet is a conversation from its first frame.
    const rows = [
      ...(visitorAtDoor || !chat.length || chat[0].role === 'user' ? [{ id: 'open', who: 'sys', text: openingLine }] : []),
      ...chat.filter((m, i) => !(visitorAtDoor && i === 0 && m.role === 'assistant' && m.content === 'Tell me how he should play.'))
        .map((m) => ({ id: m._id, who: m.role === 'user' ? 'you' : 'sys', text: m.content })),
    ];

    // The four authored appearances track accepted draft milestones. Repeated
    // off-topic answers or an HTTP failure cannot finish him by counting up.
    const stage = modernDraft ? formingStage : targetStage;
    const named = !!agentName;
    // ≤6 characters is not this client's rule to invent — names.js owns how a
    // name is written on a small surface and gives its reasoning (BUGS-A job 1:
    // a first word is only a name when the name is one word long). The pill
    // therefore asks pillName for the caption's width rather than slicing.
    const cap = named
      ? `${pillName(agentName)}${natureHint ? ` · a ${natureHint}` : ''}`
      : DRAFT_STAGES[stage - 1].cap;

    // BIRTH-5's refusal, and the one action it has. It is the last recruiter
    // line that carries it, so the price sits under the action rather than
    // becoming a row of its own.
    const locked = chat.length ? chat[chat.length - 1]?.seeTable : false;
    const forming = (
      <div className={`draft2__forming${formingTarget ? ' draft2__forming--in-room' : ''}`}>
        <StageGhost key={stage} stage={stage} size={formingTarget ? 150 : 104} />
        <span className="draft2__cap" data-named={named ? 'true' : 'false'} data-testid="draft-cap">{cap}</span>
      </div>
    );

    return (
      // The clip is declared inline as well as in draft2.css: the back
      // chevron hangs 8px outside its box for optical alignment, and
      // FIX-1a's audit — which can only read inline style — has to be able
      // to SEE the ancestor that clips it. It is the same clip .dr-app
      // always carried here.
      <div className="dr-app draft2" data-testid="draft-screen" style={{ overflow: 'hidden' }}>
        <div className="draft2__header" style={{
          alignItems: 'center', gap: 9,
          padding: '2px 14px 9px', background: M_PANEL, flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{ width: 36, height: 29, minHeight: 0, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: M_TEXT, cursor: 'pointer', padding: 0, marginLeft: -8, flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT, lineHeight: 1.1 }}>
              The draft
            </span>
            <span style={{ display: 'block', fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>
              {named ? 'drafting · he has a name' : 'drafting · nobody in the room yet'}
            </span>
          </span>
        </div>

        <div className="draft2__stage">
          {/* the room, dimmed to almost nothing: he is not in it yet */}
          <div className="draft2__room">
            <div className="draft2__room-scale">
              <HomeFlat lit={false}><TableChairs taken={0} of={1} /></HomeFlat>
            </div>
          </div>
          <div className="draft2__veil" />

          {/* him, forming over the table */}
          {!born && <>
          {formingTarget ? createPortal(forming, formingTarget) : forming}

          <DraftSheet
            rows={rows}
            stage={stage}
            stageLabel={modernDraft ? naming ? 'Name' : draftStep === 'ready' ? 'Ready' : 'Style' : null}
            pending={loading}
            draft={draft}
            onDraft={setDraft}
            onSend={(text) => send(text)}
            busy={loading || createdPending}
            sendDisabled={!sessionReady}
            inputRef={inputRef}
            // The shipped copy, at every stage. The ref's frames change it
            // per question ("answer him…", "his name…"), but the placeholder is
            // also the only thing naming what this box is FOR, and two refusals
            // (AGENTS-2's cap, BIRTH-5's locked seat) are tested by finding the
            // composer still standing with the draft intact after them.
            placeholder={naming ? 'His name…' : 'Describe how it should play…'}
            feedback={problem ? (
              <div className="draft-row draft-row--sys" role="alert">
                <div className="draft-row__bubble">
                  {problem.text}
                  {problem.kind === 'open' || problem.kind === 'expired' ? <button
                    type="button" className="draft-sheet__price-act"
                    onClick={() => openSession(problem.kind === 'expired')}
                  >{problem.kind === 'expired' ? 'Start a new draft' : 'Try again'}</button> : null}
                </div>
              </div>
            ) : !sessionReady || createdPending ? (
              <div className="draft-row draft-row--sys" role="status"><div className="draft-row__bubble">
                {createdPending ? 'Opening his card…' : 'Opening your draft…'}
              </div></div>
            ) : null}
            /* NOTHING RIDES BETWEEN THE ROWS AND THE COMPOSER once the draft
               is under way. Board 29's sheet is a conversation and a way to
               answer it, and the ref's density is the rule: F02 and F03 draw
               the rows straight onto the foot.

               What used to sit here were PACE-1d's four dials and the
               temperament chip they produced — a readout of numbers over a
               screen whose whole claim is that you make him by TALKING to him.
               They said the same thing the sheet already says (the recruiter
               names the shape back to you in words) and said it in the one
               register the draft does not use. The wire still carries
               `profile` and `natureHint`; the temperament still lands, on the
               pill under the ghost, where the ref puts it — "GRANITE · A ROCK".

               The suggestion chips stay, and only before the first answer: an
               owner with no words ready needs somewhere to start, and a chip
               sends exactly as a typed line does. */
            /* BUG-198: chips at EVERY stage, not only before the first answer.
               The words come from the server, which is the thing that has to
               understand them — the old list lived here, said "Tight and
               patient", and the matcher on the other end had never heard of
               "Loose". Requirement 4 of the queue is that an owner talking to
               the real recruiter gets these too, as shortcuts; he does,
               because the server sends them to both. */
            above={stageChips.length ? (
              <div className="draft-sheet__chips" data-testid="draft-chips">
                {stageChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="draft-sheet__chip"
                    disabled={loading || !sessionReady || createdPending}
                    onClick={() => send(chip, 'brief')}
                  >{chip}</button>
                ))}
              </div>
            ) : null}
            action={namingStage ? (
              /* The fourth stage takes the composer's place, exactly as the
                 gold action does — but with a FIELD in it, because here the
                 question is the name and the answer is already written. One
                 row: his name, and the only thing left to press. */
              <form
                className="draft-sheet__composer draft-sheet__name"
                data-testid="draft-name-row"
                onSubmit={(e) => { e.preventDefault(); dealHimIn(); }}
              >
                <input
                  ref={inputRef}
                  className="draft-sheet__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="His name…"
                  aria-label="His name"
                  data-testid="draft-input"
                  disabled={loading || createdPending}
                />
                <button
                  type="submit"
                  className="draft-sheet__deal"
                  disabled={loading || !sessionReady || createdPending}
                >{loading || createdPending ? 'Dealing him in…' : 'Deal him in'}</button>
              </form>
            ) : showNextAction ? (
              <NextAction
                label={createdPending ? 'Opening his card…' : loading ? 'Creating…' : 'Deal him in'}
                sub={natureHint ? 'STRATEGY SET · NATURE FORMED' : 'STRATEGY SET'}
                busy={loading || !sessionReady || createdPending || (modernDraft && stage < 4)}
                onAct={() => send(GO_SIGNAL, 'create')}
                onLink={() => {
                  if (sendingRef.current || createdRef.current) return;
                  setTalking(true);
                  later(() => inputRef.current?.focus(), 0);
                }}
              />
            ) : null}
            foot={locked ? (
              <button
                type="button"
                className="draft-sheet__price-act"
                data-testid="birth-see-table"
                onClick={() => onSeeTable?.()}
              >
                See the table
              </button>
            ) : naming ? <button type="button" className="draft-sheet__price-act"
              disabled={loading || !sessionReady || createdPending}
              onClick={() => send(GO_SIGNAL, 'create')}>Choose a name for me</button> : null}
          />
          </>}
        </div>

        {bornOverlay}
      </div>
    );
  }


  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG, position: 'relative' }}>
      <style>{`
        @keyframes birth-rise   { from { opacity: 0; transform: translateY(7px); }  to { opacity: 1; transform: none; } }
        @keyframes birth-fadein { from { opacity: 0; }                              to { opacity: 1; } }
        @keyframes birth-sheetup{ from { opacity: 0; transform: translateY(38px); } to { opacity: 1; transform: none; } }
        @keyframes drift {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* Back header */}
      {/* FIX-2a: the ww-ref header budget — 40px, from 2px/9px padding around
          a 29px control row and no bottom rule. (The ref's note reads "padding
          2/8", which totals 39; its own table says 40. The table is the number
          the port has to hit, so the extra pixel goes on the bottom pad.) The back control needs an explicit
          minHeight because base.css floors every button at --tap (44px), which
          is what was inflating this row and the band below it. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '2px 14px 9px',
        background: M_PANEL, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{ width: 36, height: 29, minHeight: 0, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: M_TEXT, cursor: 'pointer', padding: 0, marginLeft: -8, flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span style={{ flex: 1, fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>
          {agent.name || 'Rebuild'}
        </span>
      </div>

      {/* The band. He exists and has a mood, which is the whole difference
          between this screen and the draft. */}
      <MoodBand
        accent={agent.accent || M_TEAL}
        mood={agent.mood || 'neutral'}
        state={agent.state || 'resting'}
        cause={agent.cause || 'rebuilding strategy'}
        action="Deploy"
        onAction={onBack}
      />

      {/* Feed */}
      {/* FIX-1a: `overflow: hidden auto`, never a bare overflowY. A box that
          declares only one axis has the other computed from `visible` to
          `auto`, which turns every feed into a horizontal scroller — that is
          what let the draft screen be dragged sideways off the ghost
          watermark's 14px overhang. */}
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden auto', position: 'relative' }}>

        {!hasTalked ? (
          /* Entry state: ghost fills center, opening message pinned to bottom */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
              <FormingGhost size={132} phase={0.72} />
            </div>
            <div style={{ flexShrink: 0, paddingBottom: 4 }}>
              <SysLine>Rebuilding</SysLine>
              <AgentBubble time={openedAt.current}>{openingLine}</AgentBubble>
            </div>
          </div>
        ) : (
          /* Mid-draft: ghost watermark behind conversation */
          <>
            {phase > 0 && phase < 1 && (
              <div style={{ position: 'absolute', right: -14, top: 26, opacity: 0.13, pointerEvents: 'none', zIndex: 0 }}>
                <FormingGhost size={168} phase={phase} />
              </div>
            )}

            <div style={{ position: 'relative', zIndex: 1, paddingTop: 10 }}>
              <SysLine>Rebuilding</SysLine>

              {/* Opening prompt always shown */}
              <AgentBubble time={openedAt.current}>{openingLine}</AgentBubble>

              {/* Conversation */}
              {chat.map((msg, i) => (
                msg.role === 'user'
                  ? <OwnerBubble key={msg._id}>{msg.content}</OwnerBubble>
                  : (
                    <span key={msg._id}>
                      <AgentBubble time={msg.at}>{msg.content}</AgentBubble>
                      {/* DiffCard after agent message if a rebuild proposal is present */}
                      {msg.diff && (
                        <div style={{ padding: '0 14px', marginBottom: 9 }}>
                          <DiffCard
                            accent={agent?.accent || M_TEAL}
                            origin={msg.diff.origin}
                            quote={msg.diff.quote}
                            from={msg.diff.from}
                            to={msg.diff.to}
                            rows={msg.diff.rows}
                            est={msg.diff.est}
                            primary={msg.diff.primary || 'Save'}
                            secondary={msg.diff.secondary || 'Keep talking'}
                            onPrimary={() => send('Save')}
                            onSecondary={() => {}}
                          />
                        </div>
                      )}
                      {/* BIRTH-5: the locked slot's one action. Not a button in
                          the composer and not a modal — the refusal is a line in
                          the conversation, so what to do about it belongs under
                          that line. */}
                      {msg.seeTable && (
                        <div style={{ padding: '0 14px 9px 51px' }}>
                          <button
                            type="button"
                            data-testid="birth-see-table"
                            onClick={() => onSeeTable?.()}
                            style={{
                              fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
                              color: M_GOLD, border: `1px solid ${M_GOLD}66`, background: `${M_GOLD}14`,
                              borderRadius: 11, padding: '6px 13px', cursor: 'pointer',
                            }}
                          >
                            SEE THE TABLE
                          </button>
                        </div>
                      )}
                    </span>
                  )
              ))}

              {loading && (
                <AgentBubble>
                  <span className="dr-typing"><i /><i /><i /></span>
                </AgentBubble>
              )}
            </div>
          </>
        )}
      </div>

      {/* Composer. F-1's one gold button belongs to the DRAFT — a rebuild has
          no birth to press towards, so there is nothing here to give the
          composer's place to. */}
      <div style={{ flexShrink: 0 }}>
        {problem && <div role="alert"><AgentBubble>{problem.text}</AgentBubble></div>}
        {/* Suggestion chips */}
        {!hasTalked && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px 0', flexWrap: 'wrap' }}>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                style={{
                  height: 28, padding: '0 11px', borderRadius: 14,
                  border: `1px solid ${M_TEAL}44`, background: `${M_TEAL}0D`,
                  color: M_TEAL, fontSize: 12.5, cursor: 'pointer',
                  fontFamily: 'Inter,-apple-system,sans-serif',
                }}
              >{s}</button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 14px', borderTop: `1px solid ${M_BORDER}`,
            background: M_PANEL, paddingBottom: `calc(9px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${agent?.name || 'agent'}…`}
            disabled={loading || isReady}
            style={{
              flex: 1, height: 38, padding: '0 12px', borderRadius: 10,
              border: `1px solid rgba(255,255,255,0.10)`, background: M_PANEL_2,
              color: M_TEXT, fontSize: 16, outline: 'none',
              fontFamily: 'Inter,-apple-system,sans-serif',
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading || isReady}
            aria-label="Send"
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
              background: draft.trim() && !loading && !isReady ? M_TEAL : 'rgba(255,255,255,0.12)',
              color: draft.trim() && !loading && !isReady ? M_BG : M_MUTED,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: draft.trim() && !loading && !isReady ? 'pointer' : 'default', padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </div>

      {bornOverlay}
    </div>
  );
}
