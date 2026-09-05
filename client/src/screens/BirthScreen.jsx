// NAV-1d — birth/create flow ported from design-refs/mood-birth.jsx.
// FormingGhost · DraftBand · DraftStrip · BirthScreen (chat-first draft)
// MaterializingOccupant — exported for App.jsx to overlay on the CASINO floor.
//
// ATTR-2c — the nature reveal from design-refs/char-birth.jsx.
// VOICE LAW: before birth the drafting voice is the RECRUITER — system
// furniture, neutral border, no mood, no pip. Nobody speaks for the agent
// before he exists, and his first words are his nature. The recruiter may show
// a nature FORMING but never commits: the client never picks one, it only
// renders what the server assigned.

import { useEffect, useId, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { M_TEAL } from '../components/floor/atoms.jsx';
import { MoodBand } from '../components/system/MoodBand.jsx';
import { MoodGhost } from '../components/system/MoodGhost.jsx';
import { AttrCluster } from '../components/system/AttrCluster.jsx';
import { NatureChip, NatureFormingChip } from '../components/system/CharacterAtoms.jsx';
import { NextAction } from '../components/system/NextAction.jsx';
import { SheetFold } from '../components/system/SheetFold.jsx';
import { NatureFormed } from '../components/system/NatureFormed.jsx';
import { normalizeAttrs } from '../lib/attributes.js';

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
const M_SURF    = '#2F2F37';
const M_BORDER_2 = 'rgba(255,255,255,0.18)';

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


// ── DraftBand ─────────────────────────────────────────────────────────────
// MoodBand anatomy with a forming ghost + "NO MOOD YET"/"READY" chip.
function DraftBand({ phase = 0, cause, onSkip, ready }) {
  const border = phase >= 0.98 ? `1px solid ${M_TEAL}55` : `1px dashed ${M_DIM}55`;
  const shadow = phase > 0.4 ? `0 0 14px ${M_TEAL}${phase > 0.8 ? '33' : '1A'}` : 'none';
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 14px 8px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL,
    }}>
      {/* FIX-2a: ghost 42->38 and bottom pad 11->8 put the band at the ww-ref's
          56px: 9 + 38 + 8 + the 1px rule. */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border, boxShadow: shadow,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <FormingGhost size={36} phase={phase} />
      </div>

      {/* Text area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {/* State chip */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 16, padding: '0 6px',
            borderRadius: 3, background: 'rgba(255,255,255,0.04)', border: `1px dashed ${M_DIM}55`,
          }}>
            <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_DIM }}>
              {ready ? 'READY' : 'NO MOOD YET'}
            </span>
          </span>
          {/* Drafting tag */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 16, padding: '0 6px',
            borderRadius: 3, background: 'rgba(255,255,255,0.04)', border: `1px solid ${M_BORDER}`,
          }}>
            <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED }}>
              DRAFTING
            </span>
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: M_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cause || 'nothing decided yet'}
        </div>
      </div>

      {/* Skip / action button — primary when ready */}
      <button
        type="button"
        onClick={onSkip}
        style={{
          height: 30, minHeight: 0, padding: '0 12px', borderRadius: 8, flexShrink: 0,
          border: ready ? 'none' : `1px solid rgba(255,255,255,0.14)`,
          background: ready ? M_TEAL : 'transparent',
          color: ready ? '#0A0A0A' : M_TEXT,
          fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600,
          letterSpacing: '0.10em', cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        {ready ? 'Deal me in' : 'Skip'}
      </button>
    </div>
  );
}


// The phrase the server's isGoSignal() accepts as "I am done briefing" — it is
// what turns the draft into an agent. "Deal him in" is the label; this is the
// wire word behind it.
const GO_SIGNAL = "Let's go";

// ── DraftStrip ────────────────────────────────────────────────────────────
// One-line profile, dashes when unknown.
//
// F-1: the slots are the four dials PACE-1d puts on the wire — draftProfile is
// all four or none, so this row is never half-filled. The refs label them
// STYLE / RISK / TIGHT / AGGR, which predates that contract; STYLE and RISK are
// words on an agent record, not numbers, so the row names what it is showing.
function DraftStrip({ profile }) {
  const p = profile ?? {};
  const fields = [
    ['TIGHT', p.tightness], ['AGGR', p.aggression],
    ['BLUFF', p.bluffFreq], ['DISC', p.discipline],
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: M_PANEL_2, border: `1px dashed ${M_DIM}44`, borderRadius: 8,
      padding: '7px 11px', gap: 0,
      maxWidth: '100%', minWidth: 0, overflow: 'hidden',
    }}>
      {fields.map(([k, raw], i) => {
        const v = Number.isFinite(raw) ? Math.round(raw) : null;
        return (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
          {i > 0 && <span style={{ width: 1, height: 16, background: M_BORDER, margin: '0 10px', display: 'inline-block', flexShrink: 0 }} />}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.14em', color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{k}</span>
            {v == null
              ? <span style={{ fontFamily: MONO, fontSize: 12, color: M_FAINT }}>—</span>
              : <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: M_TEXT }}>{v}</span>
            }
          </span>
        </span>
        );
      })}
    </div>
  );
}


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


// ── RecruiterBubble ───────────────────────────────────────────────────────
// Port of RecruiterBubble from char-birth.jsx. System furniture: neutral border,
// no mood, no pip — because there is nobody to have a mood yet. Replaces the
// forming-ghost bubble in create mode, where the speaker is the recruiter.
function RecruiterBubble({ time, children }) {
  return (
    <div style={{ display: 'flex', gap: 9, padding: '0 14px', marginBottom: 9, alignItems: 'flex-end' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: M_SURF, border: `1px solid ${M_BORDER_2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, color: M_MUTED }}>R</span>
      </div>
      <div style={{ maxWidth: 258 }}>
        <div style={{
          background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`,
          borderRadius: 12, borderBottomLeftRadius: 4, padding: '9px 12px',
        }}>
          <div style={{ fontSize: 13.5, color: M_TEXT, lineHeight: 1.5 }}>{children}</div>
        </div>
        {time && (
          <div style={{ marginTop: 3, paddingLeft: 2 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 500, color: M_MUTED }}>RECRUITER · {time}</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ── The nature reveal ─────────────────────────────────────────────────────
// Port of NatureRevealOccupant from char-birth.jsx. Order is the whole beat:
// his line, then the ghost, then the name chip, then the nature chip last — the
// chip is the label the room puts on him, so it cannot arrive before he does.
function NatureReveal({ name, first, nature }) {
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
        <FormingGhost size={54} phase={0.72} />
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
function BirthCardSheet({ name, nature, firstWords, character, onDealIn, first = true }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="birth-card3">
      {/* his place: the header well, half out of the sheet */}
      <div className="birth-card3__well-row">
        <div className="birth-card3__well">
          <MoodGhost mood="neutral" accent={M_TEAL} size={64} ring={false} />
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
export function BirthScreen({ onBack, onBirth, agent }) {
  const userId  = getUserId();
  const isEdit  = !!agent;

  const [chat, setChat]       = useState([]);
  const [draft, setDraft]     = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase]     = useState(isEdit ? 0.72 : 0);
  const [agentName, setAgentName] = useState(isEdit ? agent.name : null);
  const [pendingDiff, setPendingDiff] = useState(null);
  // F-1 (PACE-1d): the draft's own state, straight off the wire. `profile` is
  // all four dials or none, so the strip never shows a half-filled row; once we
  // have them we keep them, because a chip is a decision and the strip must
  // never fall back to dashes after one. `ready` is the server saying there is
  // enough to build him.
  const [draftProfile, setDraftProfile] = useState(null);
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

  const feedRef   = useRef(null);
  const inputRef  = useRef(null);
  const msgIdRef  = useRef(0);
  const mkMsg = (role, content, diff = null) => ({ role, content, diff, at: hhmm(), _id: ++msgIdRef.current });
  const openedAt = useRef(hhmm());

  // Count of AI responses drives phase (each response = +0.25, cap at 0.98 until born)
  const aiCount = useRef(0);


  // FIX-1c: no focus() on mount. Stealing focus opens the iOS keyboard the
  // instant the screen appears, which covers half the draft and hides the
  // content the owner came to read. The field is focused when they tap it.
  //
  // When they do, scroll the composer into view after the keyboard animates in
  // — iOS in Telegram needs the explicit push, because --tg-h shrinks the
  // container but the browser does not always scroll the focused element up.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    function onFocus() { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150); }
    el.addEventListener('focus', onFocus);
    return () => el.removeEventListener('focus', onFocus);
  }, []);

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
  async function revealOrDeal(newborn) {
    let record = null;
    try {
      const res = await fetch(`/api/agents?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      });
      const data = await res.json();
      const roster = data.agents || [];
      record = roster.find((a) => a.id === newborn.id) ?? null;
      setFirstAgent(roster.length <= 1);
    } catch { /* no record — treat him as still forming */ }

    const character = normalizeAttrs(record);
    if (!character.nature) {
      setTimeout(() => onBirth(newborn), 1200);
      return;
    }
    // normalizeAttrs keeps only {name, up, down, line}; ATTR-3's builtFor and
    // firstWords live on the record, so the raw nature rides along too.
    setBorn({
      ...newborn,
      first: record?.firstWords ?? character.nature.line,
      nature: { ...character.nature, builtFor: record?.nature?.builtFor ?? null },
      character,
    });
    setBeat('reveal');
    setTimeout(() => setBeat('card'), 2200);
  }

  async function send(content = draft) {
    const text = content.trim();
    if (!text || loading) return;
    setDraft('');
    setLoading(true);
    setPendingDiff(null);
    setChat((prev) => [...prev, mkMsg('user', text)]);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: text, ...(isEdit ? { agentId: agent.id } : {}) }),
      });
      const data = await res.json();

      // Pick up the AI reply
      const allAi = (data.chat || []).filter((m) => m.role === 'assistant');
      const reply = allAi[allAi.length - 1];
      const diff = data.diff || null;
      if (reply) {
        const m = mkMsg('assistant', reply.content, diff);
        // A nature the recruiter is only guessing at. Server-authored or absent —
        // the chip renders a neutral "Temperament?" when nothing is hinted.
        if (data.natureHint) m.natureHint = data.natureHint;
        setChat((prev) => [...prev, m]);
      }

      // F-1: three surfaces, one source. The dials, the temperament those dials
      // produce, and whether he can be built now all come from this reply.
      if (data.profile) setDraftProfile(data.profile);
      if (data.natureHint) setNatureHint(data.natureHint);
      if (data.ready) { setReady(true); setTalking(false); }

      aiCount.current += 1;
      const newPhase = data.agentId ? 1.0 : Math.min(0.98, isEdit ? 0.72 + aiCount.current * 0.09 : aiCount.current * 0.28);
      setPhase(newPhase);

      if (data.agentId) {
        const name = data.agentName || agentName || 'New agent';
        setAgentName(name);
        revealOrDeal({ id: data.agentId, name, strategy: data.strategy || '' });
      }
    } catch {
      setChat((prev) => [...prev, mkMsg('assistant', 'Something went wrong — try again.')]);
    } finally {
      setLoading(false);
    }
  }

  const isReady  = phase >= 1.0;
  // Only on a create draft, only once the server says he can be built, only
  // while the owner has not asked to keep talking, and never once he exists.
  const showNextAction = !isEdit && ready && !talking && !born;
  const hasTalked = chat.length > 0;

  const suggestions = phase < 0.3
    ? ['Tight and patient', 'Aggressive bluffer', 'Solver-strict']
    : ['Heads-up only', 'Everywhere in position'];

  const openingLine = isEdit
    ? 'Tell me what to change.'
    : 'One open seat. Tell me how it should play — style, risk, how tight, how aggressive.';
  const openingNote = isEdit
    ? null
    : 'Plain words work. "Patient, hates bluffing, folds when it smells wrong."';

  // Voice law: the RECRUITER drafts; the agent speaks only once he exists.
  // Rebuild mode is an existing agent talking, so it keeps his own bubble.
  const Voice = isEdit ? AgentBubble : RecruiterBubble;

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
          {isEdit ? (agent.name || 'Rebuild') : 'New agent'}
        </span>
      </div>

      {/* Band — MoodBand in edit mode, DraftBand for new */}
      {isEdit ? (
        <MoodBand
          accent={agent.accent || M_TEAL}
          mood={agent.mood || 'neutral'}
          state={agent.state || 'resting'}
          cause={agent.cause || 'rebuilding strategy'}
          action="Deploy"
          onAction={onBack}
        />
      ) : (
        <DraftBand
          phase={phase}
          cause={isReady ? (agentName ?? 'ready to deploy') : hasTalked ? 'taking shape…' : 'nothing decided yet'}
          onSkip={onBack}
          ready={isReady}
        />
      )}

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
              <FormingGhost size={132} phase={isEdit ? 0.72 : 0} />
            </div>
            <div style={{ flexShrink: 0, paddingBottom: 4 }}>
              <SysLine>{isEdit ? 'Rebuilding' : 'Drafting'}</SysLine>
              <Voice time={openedAt.current}>
                <>
                  {openingLine}
                  {openingNote && (
                    <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>{openingNote}</div>
                  )}
                </>
              </Voice>
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
              <SysLine>{isEdit ? 'Rebuilding' : 'Drafting'}</SysLine>

              {/* Opening prompt always shown */}
              <Voice time={openedAt.current}>
                <>
                  {openingLine}
                  {openingNote && (
                    <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>{openingNote}</div>
                  )}
                </>
              </Voice>

              {/* Conversation */}
              {chat.map((msg, i) => (
                msg.role === 'user'
                  ? <OwnerBubble key={msg._id}>{msg.content}</OwnerBubble>
                  : (
                    <span key={msg._id}>
                      <Voice time={msg.at}>{msg.content}</Voice>
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
                      {/* DraftStrip after each AI reply while still forming (create mode only) */}
                      {!isEdit && !isReady && i === chat.length - 1 && !msg.diff && (
                        <>
                          <div style={{ padding: '0 14px', marginBottom: 9, maxWidth: '100%', minWidth: 0 }}>
                            <DraftStrip profile={draftProfile} />
                          </div>
                          {/* His temperament is not something you set, and nothing
                              is fixed until he exists — so the chip is a dashed
                              guess with no zero-sum pair. It prints a name only
                              if the server hinted one. */}
                          <div style={{ padding: '0 14px', marginBottom: 9, maxWidth: '100%', overflow: 'hidden' }}>
                            <NatureFormed name={msg.natureHint ?? natureHint} formed={ready} />
                          </div>
                        </>
                      )}
                    </span>
                  )
              ))}

              {loading && (
                <Voice>
                  <span className="dr-typing"><i /><i /><i /></span>
                </Voice>
              )}
            </div>
          </>
        )}
      </div>

      {/* F-1: the composer gives up its place. With a usable brief there is
          exactly one thing to press, and it names the next screen. Talking is
          demoted to the link under it, never removed — one tap brings the
          composer back with the brief intact. */}
      {showNextAction ? (
        <NextAction
          label="Deal him in"
          sub={natureHint ? 'STRATEGY SET · NATURE FORMED' : 'STRATEGY SET'}
          busy={loading}
          onAct={() => send(GO_SIGNAL)}
          onLink={() => {
            setTalking(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        />
      ) : (
      /* Composer */
      <div style={{ flexShrink: 0 }}>
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
            placeholder={isEdit ? `Message ${agent?.name || 'agent'}…` : 'Describe how it should play…'}
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
      )}

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
              <NatureReveal name={born.name} first={born.first} nature={born.character.nature} />
            </div>
          )}
          {beat === 'card' && (
            <BirthCardSheet
              name={born.name}
              nature={born.nature}
              firstWords={born.first}
              character={born.character}
              first={firstAgent}
              onDealIn={() => onBirth({ id: born.id, name: born.name, strategy: born.strategy })}
            />
          )}
        </div>
      )}
    </div>
  );
}
