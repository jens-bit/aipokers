// NAV-1b — full port of mood-screens-a.jsx (roster) + mood-screens-b.jsx (thread).
// Roster = HomeScreenM. Thread = ThreadScreen. Both in this file.

import { useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodBand } from '../components/system/MoodBand.jsx';
import { LiveBar } from '../components/system/LiveBar.jsx';
import { MoodGhost } from '../components/system/MoodGhost.jsx';
import { GrowthLine, TrainingLine, GrewBadge } from '../components/system/CharacterAtoms.jsx';
import { accentFor, MOODS, M_TEAL, M_GOLD } from '../components/floor/atoms.jsx';
import { moodOf, stateOf, causeOf, lastMomentOf } from '../components/floor/agentView.js';
import { recentEntries, gainsWithin, grewWithin } from '../lib/attributes.js';

// ── Design tokens (verbatim from design refs) ─────────────────────────────
const M_BG      = '#1A1A1E';
const M_PANEL   = '#232329';
const M_PANEL_2 = '#1b1b1b';
const M_BORDER  = 'rgba(255,255,255,0.12)';
const M_TEXT    = '#EDEDED';
const M_DIM     = '#A1A1A1';
const M_MUTED   = '#6B6B6B';
const M_FAINT   = '#3f3f3f';
const M_RED     = '#FF4D4F';

const PLAYFAIR = '"Playfair Display",Georgia,serif';
const OSWALD   = '"Oswald","Helvetica Neue",sans-serif';
const MONO     = '"JetBrains Mono",ui-monospace,monospace';


// ── Roster atoms ─────────────────────────────────────────────────────────

function StandupCollapsed({ hands = '0 hands', net = '—', flagged = '—' }) {
  return (
    <div style={{
      margin: `0 14px`, height: 37, padding: '0 13px',
      background: M_PANEL_2, border: `1px solid ${M_BORDER}`,
      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED }}>STANDUP</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: M_TEAL, fontWeight: 700 }}>{net}</span>
      <span style={{ color: M_FAINT, fontFamily: MONO, fontSize: 10 }}>·</span>
      <span style={{ fontSize: 11.5, color: M_DIM }}>{hands}</span>
      {flagged !== '—' && (
        <>
          <span style={{ color: M_FAINT, fontFamily: MONO, fontSize: 10 }}>·</span>
          <span style={{ fontSize: 11.5, color: M_GOLD }}>{flagged}</span>
        </>
      )}
      <div style={{ flex: 1 }} />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function SectionLbl({ children, right, mt = 13 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', marginBottom: 5, marginTop: mt, flexShrink: 0,
    }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED, textTransform: 'uppercase' }}>{children}</span>
      {right}
    </div>
  );
}

function LiveDot() {
  return <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 6px ${M_TEAL}`, display: 'inline-block', flexShrink: 0 }} />;
}

function AgentRow({ name, accent, mood, state, msg, pnl, time, unread, proposal, grew, onClick }) {
  const moodColor = MOODS[mood]?.color ?? M_MUTED;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: `10px 14px`,
        width: '100%', background: 'none', border: 'none',
        borderBottom: `1px solid ${M_BORDER}`,
        cursor: 'pointer', textAlign: 'left', flexShrink: 0,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}44`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={accent} size={36} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {grew > 0 && <GrewBadge gain={grew} />}
        </div>
        <div style={{
          fontSize: 12.5, lineHeight: 1.35, fontStyle: 'italic',
          color: `color-mix(in oklab, ${moodColor} 32%, ${M_DIM})`,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{msg}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: String(pnl).startsWith('−') ? M_RED : M_TEAL, fontWeight: 700 }}>{pnl}</span>
        {proposal ? (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}88`, display: 'inline-block', flexShrink: 0, marginTop: 1 }} />
        ) : unread ? (
          <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: M_TEAL, color: M_BG, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
        ) : state === 'recap' ? (
          <span style={{ width: 17, height: 17, borderRadius: 9, background: `${M_GOLD}26`, border: `1px solid ${M_GOLD}77`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-11" /></svg>
          </span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{time}</span>
        )}
      </div>
    </button>
  );
}


// ── Proposal UI ───────────────────────────────────────────────────────────

const PROFILE_LABELS = { tightness: 'Tightness', aggression: 'Aggression', bluffFreq: 'Bluff freq', discipline: 'Discipline' };

function ProposalCard({ proposal, agentProfile, accent, accepting, onAccept, onDiscuss }) {
  const delta = proposal?.suggestedPatch?.profileDelta ?? {};
  const diffRows = Object.entries(delta).map(([k, d]) => {
    const from = Math.round(agentProfile?.[k] ?? 50);
    const to = Math.max(0, Math.min(100, from + Number(d)));
    return { key: k, label: PROFILE_LABELS[k] ?? k, from, to };
  });
  return (
    <div style={{ background: M_PANEL_2, border: `1px solid ${M_GOLD}44`, borderRadius: 12, borderBottomLeftRadius: 4, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(205,179,128,0.06)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD }}>WANTS TO CHANGE ITSELF</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.1em', color: M_MUTED }}>YOUR CALL</span>
      </div>
      <div style={{ padding: '9px 12px 2px', fontSize: 12.5, color: M_TEXT, lineHeight: 1.45 }}>
        {proposal?.text}
      </div>
      {diffRows.length > 0 && (
        <div style={{ padding: '7px 12px 9px' }}>
          {diffRows.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none' }}>
              <span style={{ flex: 1, fontSize: 11, color: M_DIM }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: M_MUTED }}>{r.from}%</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              <span style={{ minWidth: 44, textAlign: 'right', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: accent }}>{r.to}%</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onDiscuss}
          style={{ height: 28, padding: '0 14px', borderRadius: 7, border: `1px solid ${M_BORDER}`, background: 'transparent', color: M_DIM, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer' }}
        >
          DISCUSS
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          style={{ height: 28, padding: '0 14px', borderRadius: 7, border: 'none', background: M_GOLD, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', cursor: accepting ? 'default' : 'pointer', opacity: accepting ? 0.6 : 1 }}
        >
          {accepting ? 'ACCEPTING…' : 'ACCEPT'}
        </button>
      </div>
    </div>
  );
}

function AgentCardMsg({ mood, accent, children }) {
  return (
    <div style={{ display: 'flex', gap: 9, padding: '0 14px', marginBottom: 9, alignItems: 'flex-end' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        <MoodGhost mood={mood} accent={accent} size={27} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function AcceptedLine() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', marginBottom: 9 }}>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 10px', borderRadius: 10, background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44` }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-11" /></svg>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL }}>CHANGE ACCEPTED</span>
      </div>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
    </div>
  );
}

// First-run "Start here" draft card
function DraftCard({ onCreateAgent }) {
  return (
    <div style={{ margin: `0 14px`, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
      <button
        type="button"
        onClick={onCreateAgent}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={M_TEAL} aria-hidden>
            <path d="M12 3C6.5 3 2 7.5 2 13s4.5 10 10 10 10-4.5 10-10S17.5 3 12 3z" opacity="0.3"/>
            <path d="M12 2a5 5 0 100 10A5 5 0 0012 2zM3 22c0-5 4-9 9-9s9 4 9 9" fill="none" stroke={M_TEAL} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap' }}>Draft your first agent</div>
          <div style={{ marginTop: 2 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_TEAL }}>TAP TO START THE CONVERSATION</span>
          </div>
        </div>
        <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: M_TEAL, color: M_BG, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
      </button>
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
          </div>
          <div style={{ background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 13px', fontSize: 13, color: M_TEXT, lineHeight: 1.5 }}>
            Describe a player. I'll build them.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 37 }}>
          {['Tight and patient', 'Bluffs too much', 'Like Phil Ivey'].map((s) => (
            <span key={s} style={{ height: 26, padding: '0 10px', borderRadius: 13, background: `${M_TEAL}12`, border: `1px solid ${M_TEAL}44`, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, color: M_TEAL }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ChatsRoster (HomeScreenM port) ────────────────────────────────────────
// Points gained in the last 24 hours, for the roster's GREW badge. Absent
// attrLog (main today, and the list projection may not carry it) → no badge.
function grewToday(agent) {
  if (!grewWithin(agent?.attrLog)) return 0;
  return gainsWithin(agent.attrLog).reduce((n, g) => n + g.gain, 0);
}

function ChatsRoster({ agents, loading, onSelectAgent, onCreateAgent }) {
  if (loading) {
    return (
      <div className="dr-app" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: M_MUTED, letterSpacing: '0.12em', fontFamily: OSWALD }}>LOADING…</span>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden auto' }}>
        <SectionLbl mt={18}>Start here</SectionLbl>
        <DraftCard onCreateAgent={onCreateAgent} />
      </div>
    );
  }

  const live    = agents.filter((a) => stateOf(a) === 'live');
  const resting = agents.filter((a) => stateOf(a) !== 'live');
  const totalHands = agents.reduce((sum, a) => sum + (a.stats?.handsPlayed || 0), 0);

  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden auto' }}>
      {live.length > 0 && (
        <>
          <SectionLbl right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <LiveDot />
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL, fontWeight: 600 }}>{live.length} PLAYING</span>
            </span>
          }>
            At the tables
          </SectionLbl>
          {live.map((agent) => {
            const accent = accentFor(agent);
            const mood   = moodOf(agent);
            return (
              <AgentRow
                key={agent.id}
                name={agent.name}
                accent={accent}
                mood={mood}
                state="live"
                grew={grewToday(agent)}
                msg={lastMomentOf(agent)}
                pnl={agent.stats?.netWon != null ? (agent.stats.netWon >= 0 ? `+${agent.stats.netWon}` : `−${Math.abs(agent.stats.netWon)}`) : '—'}
                proposal={!!agent.proposal}
                onClick={() => onSelectAgent(agent)}
              />
            );
          })}
        </>
      )}

      {resting.length > 0 && (
        <>
          <SectionLbl
            mt={live.length > 0 ? 13 : 18}
            right={
              resting.some((a) => stateOf(a) === 'recap') ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-11" /></svg>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD, fontWeight: 600 }}>
                    {resting.filter((a) => stateOf(a) === 'recap').length} RECAP
                  </span>
                </span>
              ) : null
            }
          >
            {live.length > 0 ? 'Resting' : 'Your agents'}
          </SectionLbl>
          {resting.map((agent) => {
            const accent = accentFor(agent);
            const mood   = moodOf(agent);
            const state  = stateOf(agent);
            return (
              <AgentRow
                key={agent.id}
                name={agent.name}
                accent={accent}
                mood={mood}
                state={state}
                grew={grewToday(agent)}
                msg={lastMomentOf(agent)}
                pnl={agent.stats?.netWon != null ? (agent.stats.netWon >= 0 ? `+${agent.stats.netWon}` : `−${Math.abs(agent.stats.netWon)}`) : '—'}
                time="—"
                proposal={!!agent.proposal}
                onClick={() => onSelectAgent(agent)}
              />
            );
          })}
        </>
      )}

      <div style={{ flexShrink: 0, padding: '14px 14px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCreateAgent}
          style={{
            height: 28, padding: '0 12px', borderRadius: 7,
            border: `1px solid ${M_TEAL}44`, background: 'transparent',
            color: M_TEAL, fontFamily: OSWALD, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          + New agent
        </button>
      </div>
    </div>
  );
}


// ── Thread atoms (mood-screens-b.jsx port) ────────────────────────────────

function AgentBubble({ mood, accent, training, children }) {
  const moodColor = MOODS[mood]?.color ?? M_MUTED;
  return (
    <div style={{ display: 'flex', gap: 9, padding: `0 14px`, marginBottom: 9, alignItems: 'flex-end' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        <MoodGhost mood={mood} accent={accent} size={27} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: M_PANEL_2, border: `1px solid ${moodColor}33`,
          borderLeft: `2px solid ${moodColor}`,
          borderRadius: 12, borderBottomLeftRadius: 4,
          padding: '10px 13px', fontSize: 13, color: M_TEXT, lineHeight: 1.5,
          minWidth: 0, overflowWrap: 'anywhere',
        }}>
          {children}
          <TrainingLine items={training} />
        </div>
      </div>
    </div>
  );
}

function OwnerBubble({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 14px`, marginBottom: 9 }}>
      <div style={{ maxWidth: 264 }}>
        <div style={{ background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44`, borderRadius: 12, borderBottomRightRadius: 4, padding: '10px 13px', fontSize: 13, color: M_TEXT, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
      </div>
    </div>
  );
}

function SysLine({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: `0 14px`, marginBottom: 9 }}>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: M_BORDER }} />
    </div>
  );
}


// attrLog is promised on GET /api/agents/:id and rides the list projection too.
// Only reach for the detail endpoint when the engine is already sending
// attributes but no log — on main today this never fires.
async function loadAttrLog(agent, userId) {
  if (Array.isArray(agent?.attrLog)) return agent.attrLog;
  if (!agent?.attrs || !agent?.id) return [];
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}?userId=${encodeURIComponent(userId)}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } });
    if (!res.ok) return [];
    const data = await res.json();
    const log = data?.agent?.attrLog ?? data?.attrLog;
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}

// Clock label on a growth line, from the tick's own timestamp.
function tickTime(tick) {
  const ts = tick?._ts ?? tick?.ts;
  if (ts == null) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}


// ── AgentThread — the actual DM screen ───────────────────────────────────
function AgentThread({ agent, onBack, onDeploy, onWatch, onOpenProfile }) {
  const userId   = getUserId();
  const accent   = accentFor(agent);
  const agState  = stateOf(agent);
  const isLive   = agState === 'live';

  const [localMood, setLocalMood]   = useState(() => moodOf(agent));
  const [localCause, setLocalCause] = useState(() => causeOf(agent));
  const [chat, setChat]             = useState([]);
  const [draft, setDraft]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [proposalAccepting, setProposalAccepting] = useState(false);
  const feedRef   = useRef(null);
  const inputRef  = useRef(null);
  const msgIdRef  = useRef(0);
  const mkMsg = (role, content) => ({ role, content, _id: ++msgIdRef.current });

  // FIX-1c: no focus() on mount. Stealing focus opens the iOS keyboard the
  // instant the screen appears, which covers half the thread and hides the
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
    Promise.all([
      fetch(`/api/agents/${encodeURIComponent(agent.id)}/hands?userId=${encodeURIComponent(userId)}`).then((r) => r.json()),
      loadAttrLog(agent, userId),
    ])
      .then(([data, attrLog]) => {
        const hands = data.recentHands || [];
        const msgs = [];
        if (hands.length > 0) {
          const won  = hands.filter((h) => h.won).length;
          const lost = hands.length - won;
          msgs.push(mkMsg('assistant', `Hey — I just finished ${hands.length} hand${hands.length === 1 ? '' : 's'}. Won ${won}, lost ${lost}. Want to review any hands or adjust my strategy?`));
        } else {
          msgs.push(mkMsg('assistant', 'Ready to play. Describe any changes to my strategy, or deploy me to start.'));
        }
        // What he trained tonight rides inside the recap bubble; each tick then
        // gets its own quiet line, in his voice, with the cause behind it.
        // Nothing here fires without an attrLog entry to draw it from.
        const ticks = recentEntries(attrLog);
        if (ticks.length > 0) {
          msgs[0].training = gainsWithin(attrLog);
          for (const t of ticks) {
            msgs.push({ role: 'growth', tick: t, _id: ++msgIdRef.current });
          }
        }
        if (agent.proposal) {
          msgs.push({ role: 'proposal', proposal: agent.proposal, _id: ++msgIdRef.current });
        }
        setChat(msgs);
      })
      .catch(() => {
        const msgs = [mkMsg('assistant', 'Ready to play. Describe any changes to my strategy, or deploy me to start.')];
        if (agent.proposal) msgs.push({ role: 'proposal', proposal: agent.proposal, _id: ++msgIdRef.current });
        setChat(msgs);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

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
    setChat((prev) => [...prev, mkMsg('user', text)]);
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: text, existingAgentId: agent.id }),
      });
      const data = await res.json();
      const newAi = (data.chat || []).filter((m) => m.role === 'assistant').pop();
      if (newAi) setChat((prev) => [...prev, mkMsg('assistant', newAi.content)]);
      if (data.pepTalk?.soothed && data.pepTalk.newState) {
        setLocalMood(data.pepTalk.newState);
        setLocalCause('feeling better');
      }
    } catch {
      setChat((prev) => [...prev, mkMsg('assistant', 'Something went wrong — please try again.')]);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscuss() {
    inputRef.current?.focus();
  }

  async function handleAccept(proposalMsgId) {
    setProposalAccepting(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/proposal/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('accept failed');
      setChat((prev) => prev.map((m) => m._id === proposalMsgId ? { ...m, role: 'accepted' } : m));
      const chatRes = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: 'My proposed change was just accepted.', existingAgentId: agent.id }),
      });
      const chatData = await chatRes.json();
      const newAi = (chatData.chat || []).filter((m) => m.role === 'assistant').pop();
      if (newAi) setChat((prev) => [...prev, mkMsg('assistant', newAi.content)]);
    } catch {
      // silent fail — card stays visible
    } finally {
      setProposalAccepting(false);
    }
  }

  const actionLabel = isLive ? 'Watch' : 'Deploy';
  function handleAction() {
    if (isLive) { onWatch?.(agent); }
    else { onDeploy?.(agent); }
  }

  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>

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
        <button
          type="button"
          onClick={() => onOpenProfile?.(agent)}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onOpenProfile ? 'pointer' : 'default', minWidth: 0 }}
        >
          <span style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {agent.name}
          </span>
        </button>
      </div>

      {/* MoodBand — uses local mood updated live by pepTalk */}
      <MoodBand
        accent={accent}
        mood={localMood}
        cause={localCause || lastMomentOf(agent)}
        state={agState}
        action={actionLabel}
        onAction={handleAction}
      />

      {/* LiveBar — faceDown when live (no game data available from this context) */}
      {isLive && agent.activeTableId && (
        <LiveBar
          table={agent.activeTableId.slice(-5)}
          blinds="—/—"
          street="—"
          pot="—"
          equity={null}
          faceDown
          board={[]}
        />
      )}

      {/* Chat feed */}
      {/* FIX-1a: `overflow: hidden auto`, never a bare overflowY — a box that
          declares one axis has the other computed from `visible` to `auto`,
          which made the thread draggable sideways on any long token. */}
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden auto', paddingTop: 10 }}>
        {chat.map((msg) => {
          if (msg.role === 'proposal') {
            return (
              <AgentCardMsg key={msg._id} mood={localMood} accent={accent}>
                <ProposalCard
                  proposal={msg.proposal}
                  agentProfile={agent.profile}
                  accent={accent}
                  accepting={proposalAccepting}
                  onAccept={() => handleAccept(msg._id)}
                  onDiscuss={handleDiscuss}
                />
              </AgentCardMsg>
            );
          }
          if (msg.role === 'accepted') {
            return <AcceptedLine key={msg._id} />;
          }
          if (msg.role === 'growth') {
            return (
              <GrowthLine
                key={msg._id}
                attr={msg.tick.key}
                from={msg.tick.from}
                to={msg.tick.to}
                line={msg.tick.cause}
                time={tickTime(msg.tick)}
              />
            );
          }
          if (msg.role === 'assistant') {
            return (
              <AgentBubble key={msg._id} mood={localMood} accent={accent} training={msg.training}>
                {msg.content}
              </AgentBubble>
            );
          }
          return <OwnerBubble key={msg._id}>{msg.content}</OwnerBubble>;
        })}
        {loading && (
          <AgentBubble mood={localMood} accent={accent}>
            <span className="dr-typing"><i /><i /><i /></span>
          </AgentBubble>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 14px', borderTop: `1px solid ${M_BORDER}`,
          background: M_PANEL, paddingBottom: `calc(9px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${agent.name}…`}
          disabled={loading}
          style={{
            flex: 1, height: 38, padding: '0 12px', borderRadius: 10,
            border: `1px solid rgba(255,255,255,0.10)`, background: M_PANEL_2,
            color: M_TEXT, fontSize: 16, outline: 'none',
            fontFamily: 'Inter,-apple-system,sans-serif',
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || loading}
          aria-label="Send"
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
            background: draft.trim() && !loading ? M_TEAL : 'rgba(255,255,255,0.12)',
            color: draft.trim() && !loading ? M_BG : M_MUTED,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: draft.trim() && !loading ? 'pointer' : 'default', padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}


// ── Main export ───────────────────────────────────────────────────────────
export function ChatsScreen({ selectedAgent, onSelectAgent, onBack, onCreateAgent, onDeploy, onWatch, onOpenProfile }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (selectedAgent) {
    return (
      <AgentThread
        agent={selectedAgent}
        onBack={onBack}
        onDeploy={onDeploy}
        onWatch={onWatch}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <ChatsRoster
      agents={agents}
      loading={loading}
      onSelectAgent={onSelectAgent}
      onCreateAgent={onCreateAgent}
    />
  );
}
