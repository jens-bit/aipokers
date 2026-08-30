// NAV-1d — birth/create flow ported from design-refs/mood-birth.jsx.
// FormingGhost · DraftBand · DraftStrip · BirthScreen (chat-first draft)
// MaterializingOccupant — exported for App.jsx to overlay on the CASINO floor.

import { useEffect, useId, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { M_TEAL } from '../components/floor/atoms.jsx';
import { MoodBand } from '../components/system/MoodBand.jsx';

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


// ── DraftBand ─────────────────────────────────────────────────────────────
// MoodBand anatomy with a forming ghost + "NO MOOD YET"/"READY" chip.
function DraftBand({ phase = 0, cause, onSkip, ready }) {
  const border = phase >= 0.98 ? `1px solid ${M_TEAL}55` : `1px dashed ${M_DIM}55`;
  const shadow = phase > 0.4 ? `0 0 14px ${M_TEAL}${phase > 0.8 ? '33' : '1A'}` : 'none';
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL,
    }}>
      {/* Forming ghost well */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border, boxShadow: shadow,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <FormingGhost size={40} phase={phase} />
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
          height: 30, padding: '0 12px', borderRadius: 8, flexShrink: 0,
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


// ── DraftStrip ────────────────────────────────────────────────────────────
// One-line profile: STYLE / RISK / TIGHT / AGGR — dashes when unknown.
function DraftStrip({ style, risk, tight, aggr }) {
  const fields = [['STYLE', style], ['RISK', risk], ['TIGHT', tight], ['AGGR', aggr]];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: M_PANEL_2, border: `1px dashed ${M_DIM}44`, borderRadius: 8,
      padding: '7px 11px', gap: 0,
    }}>
      {fields.map(([k, v], i) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {i > 0 && <span style={{ width: 1, height: 16, background: M_BORDER, margin: '0 10px', display: 'inline-block' }} />}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.14em', color: M_MUTED }}>{k}</span>
            {v == null
              ? <span style={{ fontFamily: MONO, fontSize: 12, color: M_FAINT }}>—</span>
              : <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: M_TEXT }}>{v}</span>
            }
          </span>
        </span>
      ))}
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

  const feedRef   = useRef(null);
  const inputRef  = useRef(null);
  const msgIdRef  = useRef(0);
  const mkMsg = (role, content, diff = null) => ({ role, content, diff, _id: ++msgIdRef.current });

  // Count of AI responses drives phase (each response = +0.25, cap at 0.98 until born)
  const aiCount = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
      if (reply) setChat((prev) => [...prev, mkMsg('assistant', reply.content, diff)]);

      aiCount.current += 1;
      const newPhase = data.agentId ? 1.0 : Math.min(0.98, isEdit ? 0.72 + aiCount.current * 0.09 : aiCount.current * 0.28);
      setPhase(newPhase);

      if (data.agentId) {
        const name = data.agentName || agentName || 'New agent';
        setAgentName(name);
        setTimeout(() => onBirth({ id: data.agentId, name, strategy: data.strategy || '' }), 1200);
      }
    } catch {
      setChat((prev) => [...prev, mkMsg('assistant', 'Something went wrong — try again.')]);
    } finally {
      setLoading(false);
    }
  }

  const isReady  = phase >= 1.0;
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

  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>
      <style>{`
        @keyframes drift {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* Back header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px 10px', borderBottom: `1px solid ${M_BORDER}`,
        background: M_PANEL, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: M_TEXT, cursor: 'pointer', padding: 0, marginLeft: -8, flexShrink: 0 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>

        {!hasTalked ? (
          /* Entry state: ghost fills center, opening message pinned to bottom */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
              <FormingGhost size={132} phase={isEdit ? 0.72 : 0} />
            </div>
            <div style={{ flexShrink: 0, paddingBottom: 4 }}>
              <SysLine>{isEdit ? 'Rebuilding' : 'Drafting'}</SysLine>
              <AgentBubble>
                <>
                  {openingLine}
                  {openingNote && (
                    <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>{openingNote}</div>
                  )}
                </>
              </AgentBubble>
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

              {/* Opening AI prompt always shown */}
              <AgentBubble>
                <>
                  {openingLine}
                  {openingNote && (
                    <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>{openingNote}</div>
                  )}
                </>
              </AgentBubble>

              {/* Conversation */}
              {chat.map((msg, i) => (
                msg.role === 'user'
                  ? <OwnerBubble key={msg._id}>{msg.content}</OwnerBubble>
                  : (
                    <span key={msg._id}>
                      <AgentBubble>{msg.content}</AgentBubble>
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
                        <div style={{ padding: '0 14px', marginBottom: 9 }}>
                          <DraftStrip />
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

      {/* Composer */}
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
    </div>
  );
}
