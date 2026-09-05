// NAV-1c — full port of YouScreenM from design-refs/mood-screens-d.jsx.
// Balance card · Lifetime 2×2 stats · Replays · Settings

import { useEffect, useState } from 'react';
import { getTelegramDisplayName, getUserId, getTelegramInitData, getWebLogin, clearWebLogin } from '../lib/telegram.js';

// ── Design tokens ────────────────────────────────────────────────────────
const M_BG      = '#1A1A1E';
const M_PANEL   = '#232329';
const M_PANEL_2 = '#1b1b1b';
const M_BORDER  = 'rgba(255,255,255,0.12)';
const M_TEXT    = '#EDEDED';
const M_DIM     = '#A1A1A1';
const M_MUTED   = '#6B6B6B';
const M_FAINT   = '#3f3f3f';
const M_TEAL    = '#00D4AA';
const M_GOLD    = '#CDB380';
const M_RED     = '#FF4D4F';

const PLAYFAIR = '"Playfair Display",Georgia,serif';
const OSWALD   = '"Oswald","Helvetica Neue",sans-serif';
const MONO     = '"JetBrains Mono",ui-monospace,monospace';

// ── Atoms ────────────────────────────────────────────────────────────────

function Lbl({ children, size = 9, color = M_MUTED }) {
  return (
    <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>
      {children}
    </span>
  );
}

function Num({ children, size = 14, weight = 700, color = M_TEXT }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color }}>
      {children}
    </span>
  );
}

function ChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// icons.jsx has no bell — drawn inline per design-ref comment
function BellGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ChipGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

// ── StatCell (2×2 grid) ──────────────────────────────────────────────────
function StatCell({ label, value, color = M_TEXT }) {
  return (
    <div style={{ background: M_PANEL, padding: '10px 13px' }}>
      <Lbl size={9}>{label}</Lbl>
      <div style={{ marginTop: 3 }}>
        <Num size={16} weight={700} color={color}>{value}</Num>
      </div>
    </div>
  );
}

// ── SettingRow ──────────────────────────────────────────────────────────
function SettingRow({ glyph, label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
      <div style={{ flexShrink: 0 }}>{glyph}</div>
      <span style={{ flex: 1, fontSize: 13, color: M_TEXT }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: M_MUTED }}>{value}</span>}
      <ChevronRight />
    </div>
  );
}

// AUTH-1 — logout, web only. Inside the Mini App there is no session of ours
// to end (Telegram owns it), so the row is not rendered at all there.
function LogoutGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function LogoutRow() {
  const onLogout = () => {
    clearWebLogin();
    window.location.reload();
  };
  return (
    <button
      type="button"
      onClick={onLogout}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
        width: '100%', border: 'none', borderTop: `1px solid ${M_BORDER}`,
        background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit',
      }}
    >
      <div style={{ flexShrink: 0 }}><LogoutGlyph /></div>
      <span style={{ flex: 1, fontSize: 13, color: M_TEXT }}>Log out</span>
      <ChevronRight />
    </button>
  );
}

// ── MiniCard ────────────────────────────────────────────────────────────
const SUIT_SYMS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_RED  = new Set(['h', 'd']);
function MiniCard({ rank, suit }) {
  const isRed = SUIT_RED.has(suit);
  return (
    <div style={{
      width: 26, height: 34, borderRadius: 4,
      background: '#1E1E1E', border: `1px solid rgba(255,255,255,0.10)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: isRed ? '#FF6B6B' : M_TEXT, lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: 10, color: isRed ? '#FF6B6B' : M_DIM, lineHeight: 1 }}>{SUIT_SYMS[suit] ?? suit}</span>
    </div>
  );
}

// ── ReplayRow ────────────────────────────────────────────────────────────
function ReplayRow({ cards, label, meta, amount, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <MiniCard rank={cards[0][0]} suit={cards[0][1]} />
        <MiniCard rank={cards[1][0]} suit={cards[1][1]} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ marginTop: 1 }}>
          <Num size={9.5} color={M_MUTED} weight={500}>{meta}</Num>
        </div>
      </div>
      <Num size={12} weight={700} color={color}>{amount}</Num>
      <ShareGlyph />
    </div>
  );
}

// ── YouScreen ────────────────────────────────────────────────────────────
export function YouScreen() {
  const userId  = getUserId();
  const name    = getTelegramDisplayName() || 'Player';
  const initials = name.slice(0, 2).toUpperCase();
  const webLogin = getWebLogin() != null;   // AUTH-1: only the web build logs out

  const [agents, setAgents]   = useState([]);
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents?userId=${encodeURIComponent(userId)}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then((r) => r.json())
      .then(async (data) => {
        const list = data.agents || [];
        setAgents(list);

        // Fetch the latest notable hands across agents (first two for speed)
        const hands = [];
        for (const ag of list.slice(0, 4)) {
          try {
            const r = await fetch(`/api/agents/${encodeURIComponent(ag.id)}/hands?userId=${encodeURIComponent(userId)}`);
            if (!r.ok) continue;
            const d = await r.json();
            (d.recentHands || []).forEach((h) => hands.push({ ...h, agentName: ag.name }));
          } catch { /* skip */ }
        }
        // Sort by pot descending for "notable" feel
        hands.sort((a, b) => (b.pot || 0) - (a.pot || 0));
        setReplays(hands.slice(0, 3));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalHands     = agents.reduce((s, a) => s + (a.stats?.handsPlayed || 0), 0);
  const agentCount     = agents.length;
  const stableBankroll = agents.reduce((s, a) => s + (a.careerStats?.bankroll ?? a.bankroll ?? 0), 0);

  // Derived stats
  const winRatePct = (() => {
    const wonTotal  = agents.reduce((s, a) => s + (a.stats?.handsWon  || 0), 0);
    if (!totalHands) return null;
    return ((wonTotal / totalHands) * 100).toFixed(1);
  })();

  const biggestPot = (() => {
    let max = 0;
    agents.forEach((a) => {
      (a.stats?.biggestPot != null) && (max = Math.max(max, a.stats.biggestPot));
    });
    return max > 0 ? max : null;
  })();

  function formatHands(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  return (
    <div
      className="dr-app"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden auto', background: M_BG }}
    >
      {/* ── Balance card ─────────────────────────────────────────── */}
      <div style={{ margin: '14px 14px 14px', padding: '14px 16px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0A0A0A', fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ marginTop: 1 }}>
              <Num size={10} color={M_MUTED} weight={500}>
                {agentCount} AGENT{agentCount !== 1 ? 'S' : ''}
              </Num>
            </div>
          </div>
          <button
            type="button"
            style={{
              height: 28, padding: '0 11px', borderRadius: 7, flexShrink: 0,
              border: `1px solid rgba(255,255,255,0.14)`, background: 'transparent',
              color: M_TEXT, fontSize: 12, fontFamily: 'Inter,-apple-system,sans-serif',
              cursor: 'pointer',
            }}
          >
            Add chips
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
          <ChipGlyph />
          <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: M_TEXT }}>
            {stableBankroll > 0 ? stableBankroll.toLocaleString() : '—'}
          </span>
          <div style={{ flex: 1 }} />
          <Lbl size={9}>Balance</Lbl>
        </div>
      </div>

      {/* ── Lifetime stats ────────────────────────────────────────── */}
      <div style={{ padding: '0 14px', marginBottom: 7, flexShrink: 0 }}>
        <Lbl size={9.5}>Lifetime</Lbl>
      </div>
      <div style={{ margin: '0 14px 14px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${M_BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: M_BORDER, flexShrink: 0 }}>
        <StatCell label="Hands played" value={loading ? '—' : formatHands(totalHands)} />
        <StatCell label="Win rate" value={loading ? '—' : winRatePct ? `${winRatePct}%` : '—'} color={M_TEAL} />
        <StatCell label="Biggest pot" value={loading ? '—' : biggestPot ? `$${biggestPot}` : '—'} color={M_GOLD} />
        <StatCell label="Agents built" value={loading ? '—' : String(agentCount)} />
      </div>

      {/* ── Replays ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', marginBottom: 7, flexShrink: 0 }}>
        <Lbl size={9.5}>Replays · notable hands</Lbl>
        {replays.length > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL, fontWeight: 600 }}>
            ALL {replays.length}
          </span>
        )}
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
        {loading ? null : replays.length === 0 ? (
          <div style={{ padding: '14px 0', textAlign: 'center' }}>
            <span style={{ fontFamily: OSWALD, fontSize: 9, letterSpacing: '0.12em', color: M_MUTED }}>NO HANDS YET — DEPLOY AN AGENT TO PLAY</span>
          </div>
        ) : replays.map((h, i) => {
          const hole = h.hole || [['?', 's'], ['?', 's']];
          const wonAmt = h.won ? (h.pot || 0) : -(h.bet || 0);
          return (
            <ReplayRow
              key={i}
              cards={[[hole[0]?.[0] ?? '?', hole[0]?.[1] ?? 's'], [hole[1]?.[0] ?? '?', hole[1]?.[1] ?? 's']]}
              label={h.won ? `Won pot vs table` : `Contested pot on the river`}
              meta={`${h.agentName?.toUpperCase()} · HAND #${h.handNumber || i + 1}`}
              amount={wonAmt >= 0 ? `+$${wonAmt}` : `−$${Math.abs(wonAmt)}`}
              color={wonAmt >= 0 ? M_TEAL : M_RED}
            />
          );
        })}
      </div>

      {/* ── Settings ──────────────────────────────────────────────── */}
      <div style={{ padding: '0 14px', marginTop: 15, marginBottom: 7, flexShrink: 0 }}>
        <Lbl size={9.5}>Settings</Lbl>
      </div>
      <div style={{ margin: '0 14px 24px', borderRadius: 12, overflow: 'hidden', background: M_PANEL_2, border: `1px solid ${M_BORDER}`, flexShrink: 0 }}>
        <SettingRow glyph={<BellGlyph />} label="Notifications" value="All agents" />
        <SettingRow glyph={<ShieldGlyph />} label="Table limits" value="$10/$20" />
        <SettingRow glyph={<InfoGlyph />} label="Help & rules" last />
        {webLogin && <LogoutRow />}
      </div>
    </div>
  );
}
