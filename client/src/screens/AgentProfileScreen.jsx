// NAV PROFILE-1a — agent profile screen.
// Port of AgentProfileScreenM from design-refs/mood-screens-e.jsx.
// Uses real careerStats + sessionLog from presentAgent; activity feed from sessionFlagged.
//
// ATTR-2b — the player card v2 from design-refs/char-profile.jsx sits on top of
// it: identity + nature, the attribute cluster, fatigue in words. Everything
// below the cluster is history; everything in it is the creature. Career and the
// mood arc are demoted, not removed.
//
// PROFILE-2 — the card splits in two. The six bars were drawn as one list, which
// says they are six of the same thing; they are not. STAMINA and HEAT are BODY —
// state that moves inside a single session and that he does not get better at —
// and they now sit in the header with his face, under the name and the nature,
// where they explain the mood standing right above them. What is left below is
// SKILLS: READS, FOCUS, DISCIPLINE, DECEPTION, the four things he trains.
// COMPOSURE is the fifth attribute and it is neither: it is tilt resistance, the
// stat whose live reading IS heat, so it rides on the heat bar as its caption
// rather than as a bar of its own. Nothing the engine tracks left the card.

import { useEffect, useMemo, useState } from 'react';
import { AgentProfileOverview } from '../components/agent/AgentProfileOverview.jsx';
import { canSendVisiting, shareVisitLink } from '../lib/visit.js';
import { MoodBand } from '../components/system/MoodBand.jsx';
import { MoodGhost } from '../components/system/MoodGhost.jsx';
import { AttrCluster } from '../components/system/AttrCluster.jsx';
import { BodyBars } from '../components/system/BodyBars.jsx';
import { FatigueLine, NatureChip, NatureFormingChip } from '../components/system/CharacterAtoms.jsx';
import { AttrExplain } from '../components/system/AttrExplain.jsx';
import { accentFor, MOODS, M_TEAL, M_GOLD, M_RED } from '../components/floor/atoms.jsx';
import { moodOf, heatOf, stateOf, causeOf } from '../components/floor/agentView.js';
import { ATTR_KEYS, normalizeAttrs, seriesFor } from '../lib/attributes.js';
import { callInAgent, collectFrom, collectsEverything, pocketOf, money, stakesFor } from '../lib/wallet.js';
import { setAgentMuted } from '../lib/notifyApi.js';
import { CollectCard, PocketLine } from '../components/wallet/PocketLine.jsx';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';

// ── Design tokens (verbatim from design refs) ─────────────────────────────
const M_BG      = '#1A1A1E';
const M_PANEL   = '#232329';
const M_PANEL_2 = '#1b1b1b';
const M_BORDER  = 'rgba(255,255,255,0.12)';
const M_TEXT    = '#EDEDED';
const M_DIM     = '#A1A1A1';
const M_MUTED   = '#6B6B6B';

// PROFILE-2 — the four he trains, in ATTR_KEYS order. STAMINA and COMPOSURE are
// deliberately absent: one is body, the other is the body's resistance, and both
// are answered in the header. Kept as a filter over the canon six rather than as
// a rival list of attribute names.
const SKILL_KEYS = ['READS', 'FOCUS', 'DISCIPLINE', 'DECEPTION'];

const PLAYFAIR = '"Playfair Display",Georgia,serif';
const OSWALD   = '"Oswald","Helvetica Neue",sans-serif';
const MONO     = '"JetBrains Mono",ui-monospace,monospace';

function Lbl({ size = 9.5, children }) {
  return (
    <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED, textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function Num({ size = 14, weight = 700, color = M_TEXT, children }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color }}>
      {children}
    </span>
  );
}

// ── Mood timeline ──────────────────────────────────────────────────────────
const MOOD_RANK = { confident: 0, neutral: 1, frustrated: 2, tilted: 3, sulking: 4 };

function MoodTimeline({ sessions }) {
  if (!sessions || sessions.length < 2) {
    return (
      <div style={{ padding: '18px 0', textAlign: 'center' }}>
        <Num size={11} color={M_MUTED}>No session history yet</Num>
      </div>
    );
  }
  const w = 298, h = 62, pad = 8;
  const step = (w - pad * 2) / Math.max(sessions.length - 1, 1);
  const pts = sessions.map((s, i) => {
    const rank = MOOD_RANK[s.mood] ?? 1;
    return [pad + i * step, pad + (rank / 4) * (h - pad * 2)];
  });

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {[0, 1, 2, 3, 4].map((r) => (
          <line key={r} x1={pad} x2={w - pad}
            y1={pad + (r / 4) * (h - pad * 2)} y2={pad + (r / 4) * (h - pad * 2)}
            stroke={M_BORDER} strokeWidth="1" strokeDasharray="2,4" />
        ))}
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={MOODS[sessions[i].mood]?.color ?? M_MUTED} />
        ))}
      </svg>
      <div style={{ display: 'flex', marginTop: 5 }}>
        {sessions.map((s, i) => {
          const net = s.net;
          const fmt = net == null ? '—' : net >= 0 ? `+${net}` : `−${Math.abs(net)}`;
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <Num size={8.5} weight={600} color={net == null ? M_MUTED : net >= 0 ? M_TEAL : M_RED}>{fmt}</Num>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <Num size={9} color={M_MUTED} weight={500}>{sessions.length} SESSIONS AGO</Num>
        <Num size={9} color={M_MUTED} weight={500}>NOW</Num>
      </div>
    </div>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────
function ActivityIcon({ color }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 7,
      background: `${color}1A`, border: `1px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
  );
}

function ActivityRow({ color, label, meta, amount, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${M_BORDER}`,
    }}>
      <ActivityIcon color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ marginTop: 1 }}><Num size={9} color={M_MUTED} weight={500}>{meta}</Num></div>
      </div>
      {amount != null && (
        <Num size={11.5} weight={700} color={String(amount).startsWith('−') ? M_RED : M_TEAL}>{amount}</Num>
      )}
    </div>
  );
}

// ── BUGS-C job 9 · the cost line, moved here from the chat thread ──────────
// Port of design-refs/mood-birth3.jsx FirstCostLineScreenM, unchanged: the
// sentence is his misjudgment, never a debuff readout, and the attribute
// label beside it is the tap target that opens an explanation the first
// time only. It used to interrupt the conversation as its own card in
// ChatsScreen.jsx; the chat now carries only talk and hand replay cards, and
// this is the record of it instead — a Recent activity entry like any other,
// "+KEY · HAND #N", newest first, with the label still tappable.
function ActivityCostRow({ cost, row, explained, onExplain, last }) {
  const [open, setOpen] = useState(false);
  const canExplain = !explained;

  return (
    <div style={{ padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
      <div className="cost-line" style={{ margin: 0 }}>
        <div className="cost-line__row">
          <span className="cost-line__text">{cost.line}</span>
          {canExplain ? (
            <button
              type="button"
              className="cost-line__key"
              onClick={() => { setOpen(true); onExplain(); }}
              aria-label={`What ${cost.key} means`}
            >
              +{cost.key}
            </button>
          ) : (
            <span className="cost-line__key cost-line__key--plain">+{cost.key}</span>
          )}
        </div>
        <div className="cost-line__meta">
          {cost.handNumber != null ? `HAND #${cost.handNumber}` : 'THIS SESSION'}
          {canExplain ? ' · TAP THE LABEL' : ''}
        </div>
      </div>
      {open && <AttrExplain attrKey={cost.key} row={row} />}
    </div>
  );
}

// ── Flag type → display ───────────────────────────────────────────────────
const FLAG_DISPLAY = {
  biggestPot: { label: 'Session biggest pot',      color: M_TEAL },
  bigBluff:   { label: 'Bluff pulled off',         color: M_GOLD },
  heroCall:   { label: 'Hero call paid off',        color: M_TEAL },
  badBeat:    { label: 'Bad beat at showdown',      color: M_RED  },
  cooler:     { label: 'Cooler — strong hand lost', color: M_GOLD },
};

// BUGS-C job 9: the first time each attribute cost him something, off the
// SAME sessionFlagged records buildActivityRows already reads — no second
// fetch. flaggedHands.js stores `attrCosts` on every entry regardless of
// flagType, and agent.sessionFlagged is pushed oldest-first (this file's own
// `.slice().reverse()` above is what makes its OWN rows newest-first), so
// this scans it in that native order without reversing.
function firstCostsFromSessionFlagged(flagged) {
  const seen = new Set();
  const out = [];
  for (const hand of flagged) {
    for (const c of (Array.isArray(hand.attrCosts) ? hand.attrCosts : [])) {
      if (!c?.key || !c?.line || !ATTR_KEYS.includes(c.key) || seen.has(c.key)) continue;
      seen.add(c.key);
      out.push({ key: c.key, line: c.line, handNumber: hand.handNumber ?? null });
    }
  }
  return out;
}

// Which attributes this owner has already had explained. Per viewer, per
// attribute, once — localStorage throws in private webviews, so every touch
// is guarded and a failure just means the sentence shows again.
const EXPLAINED_KEY = 'agentic_attr_explained';

function readExplained() {
  try {
    const raw = localStorage.getItem(EXPLAINED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch { return new Set(); }
}

function markExplained(key) {
  try {
    const next = readExplained();
    next.add(key);
    localStorage.setItem(EXPLAINED_KEY, JSON.stringify([...next]));
  } catch { /* storage unavailable — it explains itself again next time */ }
}

function buildActivityRows(agent, { firstCosts = [], explained = new Set() } = {}) {
  const rows = [];
  const flagged = Array.isArray(agent.sessionFlagged) ? agent.sessionFlagged : [];

  for (const f of flagged.slice().reverse().slice(0, 6)) {
    const d = FLAG_DISPLAY[f.flagType];
    if (!d) continue;
    const amtRaw = f.pot ?? null;
    const amt = amtRaw != null ? (f.won ? `+${amtRaw}` : `−${amtRaw}`) : null;
    const meta = `HAND #${f.handNumber ?? '?'}`;
    rows.push({
      type: 'flag', color: d.color, label: d.label, meta, amount: amt,
      handNumber: f.handNumber ?? -1,
    });
  }

  for (const c of firstCosts) {
    rows.push({
      type: 'cost', cost: c, explained: explained.has(c.key),
      handNumber: c.handNumber ?? -1,
    });
  }

  // Newest hand first, across both kinds of entry together.
  rows.sort((a, b) => b.handNumber - a.handNumber);
  return rows;
}

// ── Career stat grid ───────────────────────────────────────────────────────
function CareerGrid({ careerStats }) {
  const cs = careerStats ?? {};
  const hands    = cs.hands ?? 0;
  const sessions = cs.sessions ?? 0;
  const winRate  = typeof cs.winRate === 'number' ? `${cs.winRate}%` : '—';
  const bigPot   = cs.biggestPot > 0 ? cs.biggestPot.toLocaleString() : '—';
  // Bankroll is the live chip balance; fall back to net P&L for pre-BANK-1 data.
  const bankrollV = typeof cs.bankroll === 'number'
    ? cs.bankroll.toLocaleString()
    : (cs.net != null ? (cs.net >= 0 ? `+${cs.net.toLocaleString()}` : `−${Math.abs(cs.net).toLocaleString()}`) : '—');
  const bankrollColor = typeof cs.bankroll === 'number'
    ? (cs.bankroll >= 10_000 ? M_TEAL : cs.bankroll > 0 ? M_GOLD : M_RED)
    : (cs.net == null ? M_TEXT : cs.net >= 0 ? M_TEAL : M_RED);

  const cells = [
    { l: 'Hands',       v: hands.toLocaleString(), c: M_TEXT        },
    { l: 'Win rate',    v: winRate,                 c: typeof cs.winRate === 'number' && cs.winRate >= 50 ? M_TEAL : M_RED },
    { l: 'Sessions',    v: sessions.toString(),     c: M_TEXT        },
    { l: 'Biggest pot', v: bigPot,                  c: M_GOLD        },
    { l: 'Bankroll',    v: bankrollV,               c: bankrollColor },
  ];

  return (
    <div style={{
      margin: '0 14px 12px', borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${M_BORDER}`,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 1, background: M_BORDER,
    }}>
      {cells.map((cell, i) => (
        <div key={i} style={{ background: M_PANEL, padding: '8px 11px' }}>
          <Lbl size={8.5}>{cell.l}</Lbl>
          <div style={{ marginTop: 2 }}>
            <Num size={14} weight={700} color={cell.c}>{cell.v}</Num>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Identity: the creature, then the label ────────────────────────────────
// Port of IdentityBlock from char-profile.jsx. The nature badge is beside the
// name, always — and when the server has not assigned one it says so rather
// than guessing: a nature is never invented on the client.
function IdentityBlock({ agent, accent, mood, heat = 45, nature, compact }) {
  const hands = agent.careerStats?.hands ?? agent.stats?.handsPlayed ?? 0;
  const born = hands > 0 ? `${hands.toLocaleString()} HANDS` : 'BORN TODAY · 0 HANDS';
  return (
    <div style={{ padding: compact ? '10px 14px 8px' : '13px 14px 10px', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <div style={{
        width: 54, height: 54, borderRadius: 13, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}44`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} heat={heat} accent={accent} size={52} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>
          {agent.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {nature ? <NatureChip nature={nature} /> : <NatureFormingChip />}
          <Num size={9} color={M_MUTED} weight={500}>{born}</Num>
        </div>
      </div>
    </div>
  );
}

// ── CHAT-2 · the control centre ────────────────────────────────────────────
// The thread stopped being one. Everything an owner does TO an agent lives
// here now, in a row that does not scroll away: the one thing that changes
// where he is, the one thing that changes what he can afford, and — behind an
// overflow, because it is not a neighbour of Deploy — the one that ends him.
//
// "Call him in" is Deploy's opposite and takes its slot rather than sitting
// beside it; only one of the two is ever true.
//
// BUGS-C job 8: "Give him chips" is drawn here ONLY when there is no pocket
// row to carry it (`showFund`) — an agent with no wallet data at all still
// needs a way to be funded. Whenever the pocket row exists it is the only
// place the button lives; before this the two ran side by side, the same
// button twice on one screen. The header always keeps Deploy/Call him in and
// the overflow menu.
function ActionRow({ live, muted, showFund, onPrimary, onFund, onRetire, onToggleMute, onVisit, compact, agent, onSheet, onChat }) {
  const [menu, setMenu] = useState(false);

  return (
    <div
      className={`profile-actions${compact ? ' profile-actions--compact' : ''}`}
      style={{
        flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL,
        ...(compact ? { height:44, padding:'0 12px', gap:6, border:`1px solid ${M_BORDER}`, borderRadius:10, background:'#101A1880', marginBottom:4 } : {}),
      }}
    >
      <button
        type="button"
        className="profile-actions__primary"
        aria-label={live ? 'Call him in' : 'Deploy'}
        onClick={onPrimary}
        style={{
          flex: showFund ? 1.4 : 1, height: 34, minHeight: 0, borderRadius: 9, cursor: 'pointer',
          background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}`, color: M_TEAL,
          fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          ...(compact ? { flex:1.6, height:30, borderRadius:7, fontSize:9.5, borderColor:'#00d4aa59' } : {}),
        }}
      >{live ? 'Call him in' : 'Deploy'}{compact && !live && pocketOf(agent) && <span>{stakesFor(pocketOf(agent)).replace(/\s/g, '')} · {money(pocketOf(agent).balance)}</span>}</button>

      {showFund && (
        <button
          type="button"
          onClick={onFund}
          style={{
            flex: 1, height: 34, minHeight: 0, borderRadius: 9, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${M_BORDER}`, color: M_DIM,
            fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            ...(compact ? { border:0, fontSize:8.5, height:30 } : {}),
          }}
        >Give him chips</button>
      )}

      <button
        type="button"
        aria-label="More actions"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
        style={{
          width: 34, height: 34, minHeight: 0, borderRadius: 9, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', border: `1px solid ${M_BORDER}`, color: M_DIM,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          fontSize: 15, lineHeight: 1,
          ...(compact ? { width:20, height:30, border:0 } : {}),
        }}
      >…</button>

      {/* Tapping anywhere else puts the menu away. Without it the only way out
          of an overflow opened by accident is to hit the same 34px target
          again, which on a phone is how you end up tapping Retire. */}
      {menu && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 4, minHeight: 0,
            background: 'transparent', border: 'none', padding: 0, cursor: 'default',
          }}
        />
      )}

      {menu && (
        <div
          style={{
            position: 'absolute', top: 47, right: 14, zIndex: 5, minWidth: 132,
            borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`,
            boxShadow: '0 10px 26px rgba(0,0,0,0.45)', overflow: 'hidden',
          }}
        >
          {onSheet && <button type="button" onClick={() => { setMenu(false); onSheet(); }} style={{ width:'100%', minHeight:44, padding:'0 13px', textAlign:'left', background:'none', color:M_TEXT, border:0, borderBottom:`1px solid ${M_BORDER}`, fontFamily:OSWALD, fontSize:11 }}>His sheet</button>}
          {onChat && <button type="button" onClick={() => { setMenu(false); onChat(); }} style={{ width:'100%', minHeight:44, padding:'0 13px', textAlign:'left', background:'none', color:M_TEXT, border:0, borderBottom:`1px solid ${M_BORDER}`, fontFamily:OSWALD, fontSize:11 }}>Chat</button>}
          {/* DEEPLINK-1 — his voice when the owner is away. Per agent, because
              that is what the notifier checks (notify.js reads notifyMuted off
              the agent record), and because silencing one must not cost his
              stablemates the budget they share. It sits above Retire and
              behind the same overflow: it is a preference, not an action on
              him, and it is not a neighbour of Deploy either. */}
          <button
            type="button"
            onClick={() => { setMenu(false); onToggleMute?.(); }}
            style={{
              width: '100%', height: 38, minHeight: 0, padding: '0 13px', textAlign: 'left',
              background: 'none', border: 'none', borderBottom: `1px solid ${M_BORDER}`,
              color: muted ? M_TEAL : M_DIM, cursor: 'pointer',
              fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >{muted ? 'Unmute notifications' : 'Mute notifications'}</button>

          {onVisit && <button type="button" onClick={() => { setMenu(false); onVisit(); }} style={{ width:'100%', minHeight:44, padding:'0 13px', textAlign:'left', color:M_TEAL, background:'none', borderBottom:`1px solid ${M_BORDER}`, fontFamily:OSWALD, fontSize:11, letterSpacing:'.12em', textTransform:'uppercase' }}>Send to a friend</button>}

          <button
            type="button"
            onClick={() => { setMenu(false); onRetire?.(); }}
            style={{
              width: '100%', height: 38, minHeight: 0, padding: '0 13px', textAlign: 'left',
              background: 'none', border: 'none', color: M_RED, cursor: 'pointer',
              fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >Retire</button>
        </div>
      )}
    </div>
  );
}


// The confirmation. Retiring is the one action here that cannot be taken back,
// so it is the one that asks — and what it says is what actually happens to
// him, not a warning about data loss.
function RetireSheet({ agent, busy, error, onCancel, onConfirm }) {
  return (
    <div
      className="retire-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Retire ${agent.name}`}
      style={{
        position: 'absolute', inset: 0, zIndex: 20, display: 'flex',
        flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(10,10,12,0.72)',
      }}
    >
      <div style={{
        background: M_PANEL, borderTop: `1px solid ${M_BORDER}`,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT }}>
          Retire {agent.name}?
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: M_DIM, marginTop: 8 }}>
          He finishes the hand, his chips come home, his record is kept.
        </div>
        {error && (
          <div style={{ fontSize: 12, color: M_RED, marginTop: 8 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, height: 40, minHeight: 0, borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${M_BORDER}`, color: M_DIM,
              fontFamily: OSWALD, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1, height: 40, minHeight: 0, borderRadius: 10, cursor: 'pointer',
              background: `${M_RED}1A`, border: `1px solid ${M_RED}`, color: M_RED,
              fontFamily: OSWALD, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >{busy ? 'Retiring…' : 'Retire him'}</button>
        </div>
      </div>
    </div>
  );
}


// DELETE /api/agents/:id is what the server offers today (agentProfiles.js).
// NOTE for the server side: it splices the record out, so of the three
// promises the sheet makes it currently keeps none — he does not finish the
// hand, his pocket is not collected, and the record is gone rather than kept.
// A POST /:id/retire that ends the session, collects, and marks him retired is
// the endpoint this call wants; when it lands, point `retireAgent` at it and
// nothing else on this screen changes.
async function retireAgent(agentId) {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}?userId=${encodeURIComponent(getUserId())}`,
    { method: 'DELETE', headers: { 'x-telegram-init-data': getTelegramInitData() } },
  );
  if (!res.ok) throw new Error(`retire failed (${res.status})`);
  return res.json().catch(() => ({}));
}


// ── Main screen ────────────────────────────────────────────────────────────
export function AgentProfileScreen({ agent, onBack, onOpenChat, onWatch, onFund, onDeploy, onCallIn, onRetired, companion = false }) {
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => { setShowDetails(false); }, [agent?.id]);
  const [visitStatus, setVisitStatus] = useState(null);
  useEffect(() => { setVisitStatus(null); }, [agent?.id]);
  async function handleVisit() {
    const res = await shareVisitLink(agent.id, agent.name);
    setVisitStatus(res.ok ? (res.via === 'clipboard' ? { text: 'Link copied' } : res.via === 'link' ? { text: 'Open the visit link', url: res.url } : null) : { text: 'Could not create a visit link. Please try again.' });
  }
  // WUI-3: the receipt for a collect that just happened. Drawn as a transfer,
  // pocket -> wallet, and only while it is the freshest thing on the card.
  const [collected, setCollected] = useState(null);
  // CHAT-2: the retire flow. `pending` is the confirm sheet; `busy` and
  // `error` belong to the DELETE it fires.
  const [retirePending, setRetirePending] = useState(false);
  const [retireBusy, setRetireBusy] = useState(false);
  const [retireError, setRetireError] = useState(null);
  // DEEPLINK-1: the mute, held locally so the menu redraws on the tap rather
  // than on the next roster refresh. `null` means "ask the record" — the flag
  // rides GET /api/agents, so an agent that has never been muted has no key at
  // all and reads as audible.
  const [mutedLocal, setMutedLocal] = useState(null);
  useEffect(() => { setMutedLocal(null); }, [agent?.id]);
  const isMuted = mutedLocal ?? !!agent?.notifyMuted;

  async function handleToggleMute() {
    if (!agent?.id) return;
    const next = !isMuted;
    setMutedLocal(next);   // optimistic: one tap, one redraw
    try {
      setMutedLocal(await setAgentMuted(agent.id, next));
    } catch {
      setMutedLocal(!next); // the server refused — put the menu back
    }
  }

  async function handleCollect(target) {
    const before = pocketOf(target);
    if (!before) return;
    try {
      // WALLET-7: a called-in pocket hands back all of it; every other collect
      // takes the winnings and leaves the roll the owner staked.
      const all = collectsEverything(before);
      const res = await collectFrom(target.id, { all });
      const amount = Number.isFinite(Number(res?.collected ?? res?.moved))
        ? Number(res.collected ?? res.moved)
        : (before.collectable ?? 0);
      const left = Number.isFinite(Number(res?.pocket?.balance ?? res?.left))
        ? Number(res.pocket?.balance ?? res.left)
        : Math.max(0, before.balance - amount);
      setCollected({ pocketBefore: before.balance, left, amount, at: res?.at ?? null });
    } catch { /* the row stays as it was */ }
  }

  // WALLET-7 — the second verb, from the profile card. He finishes the hand and
  // everything in the pocket comes home; the receipt is the same transfer.
  async function handleCallIn(target) {
    const before = pocketOf(target);
    if (!before) return;
    try {
      const res = await callInAgent(target.id);
      const amount = Number(res?.collected) || 0;
      setCollected({ pocketBefore: before.balance, left: 0, amount, at: Date.now() });
    } catch { /* the row stays as it was */ }
  }

  async function handleRetireConfirm() {
    if (!agent?.id) return;
    setRetireBusy(true);
    setRetireError(null);
    try {
      await retireAgent(agent.id);
      setRetirePending(false);
      onRetired?.(agent);
    } catch {
      setRetireError('Could not retire him. Try again.');
    } finally {
      setRetireBusy(false);
    }
  }

  // Which bar is tapped open. Null = the cluster reads as one silhouette.
  const [expand, setExpand] = useState(null);
  // attrLog is promised on GET /api/agents/:id; the list projection may carry it
  // too. Only reach for the detail endpoint once the engine is actually sending
  // attributes — on main today there is nothing to fetch.
  const [detailLog, setDetailLog] = useState(null);

  const agentId = agent?.id;
  const needsLog = !!agent?.attrs && !Array.isArray(agent?.attrLog);

  useEffect(() => {
    if (!agentId || !needsLog) return;
    let alive = true;
    fetch(`/api/agents/${encodeURIComponent(agentId)}?userId=${encodeURIComponent(getUserId())}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const log = data?.agent?.attrLog ?? data?.attrLog;
        if (alive && Array.isArray(log)) setDetailLog({ agentId, log });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [agentId, needsLog]);

  const character = useMemo(() => normalizeAttrs(agent), [agent]);
  const attrLog = detailLog?.agentId === agentId ? detailLog.log : (Array.isArray(agent?.attrLog) ? agent.attrLog : []);
  const seriesOf = useMemo(() => (key) => seriesFor(attrLog, key), [attrLog]);

  // PROFILE-2 — the split. normalizeAttrs still returns all six in canon order,
  // because the silhouette is canon and every other surface reads it; the card
  // is the only place that sorts them into body and skills. SKILL_KEYS is a
  // filter over that one list rather than a second list, so an attribute cannot
  // be renamed in one place and go missing here.
  const staminaRow = useMemo(
    () => character.rows.find((r) => r.key === 'STAMINA') ?? null,
    [character.rows],
  );
  const composure = useMemo(
    () => character.rows.find((r) => r.key === 'COMPOSURE')?.cur ?? null,
    [character.rows],
  );
  const skillRows = useMemo(
    () => character.rows.filter((r) => SKILL_KEYS.includes(r.key)),
    [character.rows],
  );

  // BUGS-C job 9: which attributes this owner has already had explained.
  // Read once on mount so a re-render cannot resurrect a sentence already
  // answered — same rule ChatsScreen.jsx held before this moved here.
  const [explained, setExplained] = useState(() => readExplained());
  const firstCosts = useMemo(
    () => firstCostsFromSessionFlagged(Array.isArray(agent?.sessionFlagged) ? agent.sessionFlagged : []),
    [agent],
  );

  if (!agent) return null;

  const accent  = accentFor(agent);
  const mood    = moodOf(agent);
  const heat    = heatOf(agent);
  const state   = stateOf(agent);
  const cause   = causeOf(agent);
  const isLive  = state === 'live';
  // BUGS-C job 8: the header's own "Give him chips" is a fallback for when
  // there is no pocket row to carry it (pocketOf returns null for an agent
  // with no wallet data at all — "graceful absence: no pocket, no row",
  // PocketLine.jsx) — not a second copy of a button the pocket row already
  // has.
  const hasPocket = !!pocketOf(agent);

  const sessionLog   = Array.isArray(agent.sessionLog) ? agent.sessionLog : [];
  const activityRows = buildActivityRows(agent, { firstCosts, explained });

  // Fatigue is within-session state: it belongs on the card while he is at a
  // table or has just left one, and whenever it is anything but fresh.
  const showFatigue = isLive || state === 'recap' || character.fatigue !== 'fresh';

  const actionLabel = isLive ? 'Watch' : 'Chat';
  function handleAction() {
    if (isLive) { onWatch?.(agent); }
    else { onOpenChat?.(agent); }
  }

  if (companion && !showDetails) return <AgentProfileOverview key={agent.id} agent={agent} attrLog={attrLog} onBack={onBack} onWatch={onWatch} onOpenChat={onOpenChat}
    explained={explained} onExplain={key => { markExplained(key); setExplained(prev => new Set(prev).add(key)); }}
    actions={({ chatAgent }) => <>
      <ActionRow compact agent={agent} live={isLive} muted={isMuted} showFund onPrimary={() => (isLive ? onCallIn?.(agent) : onDeploy?.(agent))} onFund={() => onFund?.(agent)} onRetire={() => { setRetireError(null); setRetirePending(true); }} onToggleMute={handleToggleMute} onVisit={canSendVisiting(agent) ? handleVisit : undefined} onSheet={() => setShowDetails(true)} onChat={() => onOpenChat?.(chatAgent)}/>
      {visitStatus && <div role="status" className="profile-visit-status">{visitStatus.url ? <a href={visitStatus.url} target="_blank" rel="noreferrer">{visitStatus.text}</a> : visitStatus.text}</div>}
    </>}>
    {retirePending && <RetireSheet agent={agent} busy={retireBusy} error={retireError} onCancel={() => setRetirePending(false)} onConfirm={handleRetireConfirm}/>}
  </AgentProfileOverview>;

  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG, position: 'relative' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px 10px', borderBottom: `1px solid ${M_BORDER}`,
        background: M_PANEL, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={companion ? () => setShowDetails(false) : onBack}
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: M_TEXT, cursor: 'pointer', padding: 0, marginLeft: -8, flexShrink: 0 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span style={{ flex: 1, fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name}
        </span>
      </div>

      {/* MoodBand — how he is, and the one way to go and look at him. */}
      <MoodBand
        accent={accent}
        mood={mood}
        cause={cause}
        state={state}
        action={actionLabel}
        onAction={handleAction}
      />

      {/* CHAT-2 — the fixed action row. It does not scroll: the whole point of
          taking these off the thread was that they are always to hand. */}
      <ActionRow
        live={isLive}
        muted={isMuted}
        showFund={!hasPocket}
        onPrimary={() => (isLive ? onCallIn?.(agent) : onDeploy?.(agent))}
        onFund={() => onFund?.(agent)}
        onRetire={() => { setRetireError(null); setRetirePending(true); }}
        onToggleMute={handleToggleMute}
        onVisit={canSendVisiting(agent) ? handleVisit : undefined}
      />
      {visitStatus && <div role="status" className="profile-visit-status" style={{padding:'8px 14px',fontSize:12,color:M_TEAL}}>{visitStatus.url ? <a href={visitStatus.url} target="_blank" rel="noreferrer">{visitStatus.text}</a> : visitStatus.text}</div>}

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

        {/* PROFILE-2 · BODY — the header frame. His face, his name, his nature,
            and the two readings that are about the state of him rather than the
            size of him. They sit here because the MoodBand is directly above:
            "tilted" is the mood, and heat 82 with stamina 41 is why. */}
        <div className="profile-body">
          <IdentityBlock
            agent={agent}
            accent={accent}
            mood={mood}
            heat={heat}
            nature={character.nature}
            compact={!!expand}
          />

          {/* His nature in one sentence. Hidden while a bar is open: the panel
              is the argument then, and two voices would compete. */}
          {!expand && character.nature?.line && (
            <div style={{
              margin: '0 14px 12px', fontSize: 12.5, lineHeight: 1.5, fontStyle: 'italic',
              color: `color-mix(in oklab, ${M_GOLD} 30%, ${M_DIM})`,
            }}>
              {character.nature.line}
            </div>
          )}

          <div style={{ margin: '0 14px 14px', padding: '12px 13px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
            <BodyBars
              staminaRow={staminaRow}
              heat={heat}
              composure={composure}
              expand={expand}
              onExpand={setExpand}
              seriesFor={seriesOf}
            />
            {showFatigue && (
              <div style={{ marginTop: 13, paddingTop: 11, borderTop: `1px solid ${M_BORDER}` }}>
                <FatigueLine stage={character.fatigue} />
              </div>
            )}
          </div>
        </div>

        {/* PROFILE-2 · SKILLS — the four he trains. Same bars, same canon order,
            same tap-to-expand: what changed is that the list no longer has two
            things in it that are not skills. */}
        <div style={{ padding: '0 14px 5px' }}><Lbl size={9.5}>Skills</Lbl></div>
        <div className="profile-skills" style={{ margin: '0 14px 12px', padding: '13px 13px 14px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <AttrCluster
            rows={skillRows}
            expand={expand}
            onExpand={setExpand}
            seriesFor={seriesOf}
          />
        </div>

        {/* WUI-3 — the pocket line. Money and stakes only: the pocket decides
            which tables he sits at and nothing about how well he plays at
            them, so no attribute, no band and no mood belong on this row. */}
        {collected && (
          <CollectCard
            pocketBefore={collected.pocketBefore}
            left={collected.left}
            collected={collected.amount}
            at={collected.at}
          />
        )}
        <PocketLine agent={agent} onFund={onFund} onCollect={handleCollect} onCallIn={handleCallIn} />

        {/* Career */}
        <div style={{ padding: '11px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Lbl size={9.5}>Career</Lbl>
          <Num size={9.5} color={M_MUTED} weight={500}>
            {agent.style ? `${agent.style.toUpperCase()} · ` : ''}BUILT {agent.id ? agent.id.slice(-5).toUpperCase() : ''}
          </Num>
        </div>
        <CareerGrid careerStats={agent.careerStats} />

        {/* Mood timeline */}
        <div style={{ padding: '0 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Lbl size={9.5}>Mood · last {Math.min(sessionLog.length, 10)} sessions</Lbl>
        </div>
        <div style={{ margin: '0 14px 12px', padding: '10px 12px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <MoodTimeline sessions={sessionLog.slice(-10)} />
        </div>

        {/* Recent activity */}
        {activityRows.length > 0 && (
          <>
            <div style={{ padding: '0 14px 4px' }}><Lbl size={9.5}>Recent activity</Lbl></div>
            <div style={{ margin: '0 14px 12px', padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
              {activityRows.map((row, i) => (row.type === 'cost' ? (
                <ActivityCostRow
                  key={i}
                  cost={row.cost}
                  row={character.rows.find((r) => r.key === row.cost.key) ?? null}
                  explained={row.explained}
                  onExplain={() => {
                    markExplained(row.cost.key);
                    setExplained((prev) => new Set(prev).add(row.cost.key));
                  }}
                  last={i === activityRows.length - 1}
                />
              ) : (
                <ActivityRow
                  key={i}
                  color={row.color}
                  label={row.label}
                  meta={row.meta}
                  amount={row.amount}
                  last={i === activityRows.length - 1}
                />
              )))}
            </div>
          </>
        )}

        {/* Edit strategy */}
        <button
          type="button"
          onClick={() => onOpenChat?.(agent)}
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            margin: '0 14px 16px', padding: '11px 13px',
            borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D`,
            width: 'calc(100% - 28px)', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>Edit strategy</div>
            <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>Aggression, bluff frequency, ranges</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

      </div>

      {retirePending && (
        <RetireSheet
          agent={agent}
          busy={retireBusy}
          error={retireError}
          onCancel={() => setRetirePending(false)}
          onConfirm={handleRetireConfirm}
        />
      )}
    </div>
  );
}
