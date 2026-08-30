// NAV PROFILE-1a — agent profile screen.
// Port of AgentProfileScreenM from design-refs/mood-screens-e.jsx.
// Uses real careerStats + sessionLog from presentAgent; activity feed from sessionFlagged.

import { MoodBand } from '../components/system/MoodBand.jsx';
import { accentFor, MOODS, M_TEAL, M_GOLD, M_RED } from '../components/floor/atoms.jsx';
import { moodOf, stateOf, causeOf } from '../components/floor/agentView.js';

// ── Design tokens (verbatim from design refs) ─────────────────────────────
const M_BG      = '#0A0A0A';
const M_PANEL   = '#141414';
const M_PANEL_2 = '#1b1b1b';
const M_BORDER  = 'rgba(255,255,255,0.06)';
const M_TEXT    = '#EDEDED';
const M_DIM     = '#A1A1A1';
const M_MUTED   = '#6B6B6B';

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

// ── Flag type → display ───────────────────────────────────────────────────
const FLAG_DISPLAY = {
  biggestPot: { label: 'Session biggest pot',      color: M_TEAL },
  bigBluff:   { label: 'Bluff pulled off',         color: M_GOLD },
  heroCall:   { label: 'Hero call paid off',        color: M_TEAL },
  badBeat:    { label: 'Bad beat at showdown',      color: M_RED  },
  cooler:     { label: 'Cooler — strong hand lost', color: M_GOLD },
};

function buildActivityRows(agent) {
  const rows = [];
  const flagged = Array.isArray(agent.sessionFlagged) ? agent.sessionFlagged : [];

  for (const f of flagged.slice().reverse().slice(0, 6)) {
    const d = FLAG_DISPLAY[f.flagType];
    if (!d) continue;
    const amtRaw = f.pot ?? null;
    const amt = amtRaw != null ? (f.won ? `+${amtRaw}` : `−${amtRaw}`) : null;
    const meta = `HAND #${f.handNumber ?? '?'}`;
    rows.push({ color: d.color, label: d.label, meta, amount: amt });
  }

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

// ── Main screen ────────────────────────────────────────────────────────────
export function AgentProfileScreen({ agent, onBack, onOpenChat, onWatch }) {
  if (!agent) return null;

  const accent  = accentFor(agent);
  const mood    = moodOf(agent);
  const state   = stateOf(agent);
  const cause   = causeOf(agent);
  const isLive  = state === 'live';

  const sessionLog   = Array.isArray(agent.sessionLog) ? agent.sessionLog : [];
  const activityRows = buildActivityRows(agent);

  const actionLabel = isLive ? 'Watch' : 'Chat';
  function handleAction() {
    if (isLive) { onWatch?.(agent); }
    else { onOpenChat?.(agent); }
  }

  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>

      {/* Header */}
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
        <span style={{ flex: 1, fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name}
        </span>
      </div>

      {/* MoodBand */}
      <MoodBand
        accent={accent}
        mood={mood}
        cause={cause}
        state={state}
        action={actionLabel}
        onAction={handleAction}
      />

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

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
              {activityRows.map((row, i) => (
                <ActivityRow
                  key={i}
                  color={row.color}
                  label={row.label}
                  meta={row.meta}
                  amount={row.amount}
                  last={i === activityRows.length - 1}
                />
              ))}
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
    </div>
  );
}
