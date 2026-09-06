// NAV-1c — full port of YouScreenM from design-refs/mood-screens-d.jsx.
// Balance card · Lifetime 2×2 stats · Replays · Settings
//
// YOU-2 — the money moved out. The wallet block, the pocket rows and the
// funding sheet were assembled here, which made this screen the only place
// money could be worked on: anything else that wanted to open the money had to
// build a second copy of it. They live in MoneySheet now, and what is left here
// is a SUMMARY — the balance, how much of it is out, and one tap to that sheet.
//
// What YOU keeps is the record rather than the controls: the ledger, which the
// wallet has been sending since WUI-1 and which nothing has ever drawn, and the
// settings rows. The split is the point — the sheet is where money MOVES, this
// is where it turns out to have moved.

import { useEffect, useState } from 'react';
import { getTelegramDisplayName, getUserId, getTelegramInitData, getWebLogin, clearWebLogin } from '../lib/telegram.js';
import { fetchWallet, money } from '../lib/wallet.js';
import { fetchNotifyBudget } from '../lib/notifyApi.js';
import { fetchSlots, slotsLine } from '../lib/slots.js';
import { MoneySheet } from '../components/wallet/MoneySheet.jsx';
import { LedgerList } from '../components/wallet/LedgerList.jsx';
import { NotYet } from '../components/ftu/NotYet.jsx';

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

// YOU-2 — seats at a table, which is what a slot is: a chair with somebody in
// it. icons.jsx has no such glyph, so it is drawn inline like the bell above.
function SeatGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <path d="M6 19v-3M18 19v-3" />
      <path d="M5 16h14a1 1 0 0 0 1-1v-2a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a1 1 0 0 0 1 1z" />
      <path d="M7 11V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5" />
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
// `openMoney` is an INTENT, not a controlled prop: a host that sent the owner
// here to deal with money (the profile's "Give him chips", the watch screen's
// end-of-session Fund) lands him on the sheet rather than one tap short of it.
// He can still close it, and closing it does not fight the host to stay shut.
export function YouScreen({ onOpenProfile, openMoney = false, onBack = null }) {
  const userId  = getUserId();
  const name    = getTelegramDisplayName() || 'Player';
  const initials = name.slice(0, 2).toUpperCase();
  const webLogin = getWebLogin() != null;   // AUTH-1: only the web build logs out

  const [agents, setAgents]   = useState([]);
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);
  // WUI-1: null until asked, and null again when this deployment has no
  // wallet. Absence is a first-class answer — the screen then shows exactly
  // what it showed before the wallet existed.
  const [wallet, setWallet]   = useState(null);
  // DEEPLINK-1 — how much of today's three the bot has already spent. Null
  // until the answer arrives, and null forever on a deployment with no
  // notifier: the row then reads as it always did rather than quoting a cap
  // nobody is enforcing.
  const [notifyBudget, setNotifyBudget] = useState(null);
  // YOU-2 — seats. Read like the wallet is read: null until the answer arrives,
  // and null forever on a deployment whose server has no /api/slots. The row is
  // then simply not there, rather than inventing a seat count.
  const [slots, setSlots] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchWallet().then((w) => { if (!cancelled) setWallet(w); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchNotifyBudget().then((b) => { if (!cancelled) setNotifyBudget(b); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSlots().then((sl) => { if (!cancelled) setSlots(sl); });
    return () => { cancelled = true; };
  }, []);

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
  // FTU-4: how much history there is to believe. One session of it is not a
  // trend, and a lifetime grid full of em dashes is the screen apologising for
  // arithmetic it has not earned the right to do yet.
  const sessionCount   = agents.reduce((s, a) => s + (a.careerStats?.sessions ?? a.sessionLog?.length ?? 0), 0);
  const thinHistory    = !loading && agentCount > 0 && sessionCount <= 1;
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

  // YOU-2 — the money surface is MoneySheet's now, and so are the three verbs
  // that live on it. What is left here is the re-read the sheet asks for when
  // something has moved, because the summary and the ledger on this screen are
  // reading the same two things the sheet is.
  const [moneyOpen, setMoneyOpen] = useState(openMoney);
  useEffect(() => { if (openMoney) setMoneyOpen(true); }, [openMoney]);

  async function refreshMoney() {
    const [w, res] = await Promise.all([
      fetchWallet(),
      fetch(`/api/agents?userId=${encodeURIComponent(userId)}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    setWallet(w);
    if (res?.agents) setAgents(res.agents);
  }

  // The ledger names the agent an entry was about; the roster is what turns an
  // id into a name. An agent who has since been retired keeps his entry and
  // loses his name, which is the honest outcome — the money still moved.
  const nameOf = (id) => agents.find((a) => a.id === id)?.name ?? null;

  function formatHands(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  // YOU-2: the money takes the whole screen, the way the funding sheet inside
  // it always has. It is a decision, not a popover on top of a scrolling list —
  // and it is the SAME sheet any other surface opens, so there is one place
  // where money is worked on rather than one per screen that wants to.
  if (moneyOpen) {
    return (
      <MoneySheet
        wallet={wallet}
        agents={agents}
        onRefresh={refreshMoney}
        onClose={() => setMoneyOpen(false)}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <div
      className="wal dr-app"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden auto', background: M_BG }}
    >
      {/* ── YOU-2 · the summary ──────────────────────────────────────
          The wallet block and the pocket rows used to be assembled right here,
          which made this screen the only place money could be worked on. It is
          a summary now: who you are, what the balance is, and one tap to the
          money sheet — the same sheet any other surface opens. No second wallet
          UI, so there is one place for a money bug to be fixed. */}
      {/* HOME-2 job 1 · no bottom bar. This screen used to be a tab and had no
          way out of its own; it is reached from the roster sheet's ledger line
          now, and back from anywhere is the room. */}
      {onBack ? (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 14px 0' }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back home"
            style={{
              background: 'none', border: 'none', padding: '4px 4px 4px 0', cursor: 'pointer',
              fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM,
            }}
          >← HOME</button>
        </div>
      ) : null}

      <div style={{ margin: '14px 14px 14px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px' }}>
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
        </div>

        {/* The money line, and the only way in. It reads the same on a
            deployment with no wallet — the stable's chips, which is what this
            screen showed before there was one — so the tap target never
            disappears and never lies about which number it is. */}
        <button
          type="button"
          className="you-money"
          onClick={() => setMoneyOpen(true)}
          aria-label="Money"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 16px 13px', background: 'transparent', cursor: 'pointer',
            border: 'none', borderTop: `1px solid ${M_BORDER}`, textAlign: 'left',
          }}
        >
          <ChipGlyph />
          <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: M_TEXT }}>
            {wallet ? money(wallet.balance) : (stableBankroll > 0 ? stableBankroll.toLocaleString() : '—')}
          </span>
          <div style={{ flex: 1 }} />
          {wallet && wallet.staked > 0 && (
            <Num size={11} color={M_GOLD} weight={600}>{money(wallet.staked)} out</Num>
          )}
          <ChevronRight />
        </button>
      </div>

      {/* FTU-4: one session in, the only honest number on this screen is the
          balance. Saying so is better than four em dashes in a grid. */}
      {thinHistory && (
        <div className="ftu-you-note">
          <NotYet
            fact="ONE SESSION OF HISTORY"
            voice={null}
            fills="A second session gives him a mood line to plot, and a week gives him a win rate worth believing. Until then the only honest number on this screen is the balance."
          />
        </div>
      )}

      {/* ── YOU-2 · the ledger ────────────────────────────────────────
          `wallet.ledger` has been arriving on every read since WUI-1 and going
          straight in the bin. It stays on YOU rather than moving into the money
          sheet, and the split is the point: the sheet is where money MOVES,
          this is where it turns out to have moved. A statement inside the
          wallet you spend from is a statement nobody reads. */}
      <LedgerList entries={wallet?.ledger} nameOf={nameOf} />

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
          // FTU-4: not "NO HANDS YET". A notable hand is one that was worth
          // remembering, and he has not had one — which is a fact about the
          // week rather than a hole in the screen.
          <NotYet
            fact={agentCount === 0 ? 'NOBODY PLAYING FOR YOU YET' : 'NO HAND HAS BEEN WORTH REMEMBERING'}
            voice={null}
            fills={agentCount === 0
              ? 'Hire someone and the hands he thinks were worth showing you collect here.'
              : 'A bluff that gets through, a bad beat, a cooler — the ones he flags arrive here as replays.'}
          />
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
        {/* DEEPLINK-1: the cap is part of the design, not a setting — so this
            row reports it instead of offering a dial. Three a day, owner-wide,
            and what is left of today's is the only number worth showing. The
            per-agent mute lives on his profile, where the rest of what an owner
            does TO an agent already is. */}
        <SettingRow
          glyph={<BellGlyph />}
          label="Notifications"
          value={notifyBudget ? `${notifyBudget.used}/${notifyBudget.max} today` : 'All agents'}
        />
        {/* YOU-2 — seats. Absent entirely until the server grows /api/slots:
            a stable with no seat limit must not be told it has one. */}
        {slots && <SettingRow glyph={<SeatGlyph />} label="Slots" value={slotsLine(slots)} />}
        <SettingRow glyph={<ShieldGlyph />} label="Table limits" value="$10/$20" />
        <SettingRow glyph={<InfoGlyph />} label="Help & rules" last />
        {webLogin && <LogoutRow />}
      </div>
    </div>
  );
}
