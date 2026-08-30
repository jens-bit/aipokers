// WatchScreen — WATCH restyled per design-refs/mood-watch.jsx.
// Replaces the spectator layout in App.jsx.
// PORT-2: MoodBand header, felt/seat/board anatomy, restyled analysis tabs.
// PORT-3: equity rendered from lastDecision.equity.

import { useEffect, useRef, useState } from 'react';
import { getUserId } from '../lib/telegram.js';
import { MoodBand } from './system/MoodBand.jsx';
import { SeatChip } from './system/SeatChip.jsx';
import { PlayingCard, CardBack } from './system/PlayingCard.jsx';
import { moodOf, causeOf, stateOf } from './floor/agentView.js';
import { accentFor } from './floor/atoms.jsx';
import { Streets } from '../lib/protocol.js';

// ── helper: parse 'As' → ['A','s'] ────────────────────────────────────────
function pc(cardStr) {
  if (!cardStr || cardStr.length < 2) return null;
  return [cardStr[0], cardStr[1]];
}

// ── helper: is the hand currently in play? ─────────────────────────────────
function handActive(game) {
  if (!game) return false;
  const active = [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN];
  return active.includes(game.street);
}

// ── WatchFelt ───────────────────────────────────────────────────────────────
function WatchFelt({ game, mySeat, lastDecision, children }) {
  const between = !handActive(game);
  const street  = game?.street?.toUpperCase() || '';
  const pot     = game?.pot ?? 0;
  const community = game?.community ?? [];

  const heroSeat  = Number.isInteger(mySeat) ? mySeat : 0;
  const seatCount = Math.max(game?.seats?.length || 2, 2);
  const heroData  = game?.seats?.[heroSeat];

  const heroHole = heroData?.holeCards
    ? heroData.holeCards.map(pc).filter(Boolean)
    : null;

  // Board: fill to 5 with null
  const boardSlots = [...community.map(pc)];
  while (boardSlots.length < 5) boardSlots.push(null);

  // Show equity from lastDecision if it belongs to our agent's seat
  const hasEquity   = lastDecision?.equity != null && !between;
  const equityVal   = hasEquity ? lastDecision.equity : null;
  const timerVal    = game?.toAct === heroSeat && !between ? 12 : null;
  const actionLabel = lastDecision?.action
    ? formatAction(lastDecision.action)
    : (game?.toAct === heroSeat && !between ? 'TO ACT' : null);

  // Opponent seats for the corner chips
  const opponentSeats = [];
  for (let i = 0; i < seatCount; i++) {
    if (i !== heroSeat && game?.seats?.[i]) {
      const s = game.seats[i];
      opponentSeats.push({
        name: s.displayName || `Seat ${i + 1}`,
        stack: s.stack?.toLocaleString() || '0',
        pos: posLabel(i, game),
        acting: game?.toAct === i,
        folded: s.folded,
      });
    }
  }

  return (
    <div className="watch-felt">
      {/* oval rim */}
      <div className="watch-felt__arc" />

      {/* opponent chips in top corners */}
      {opponentSeats[0] && (
        <div className="watch-felt__seat watch-felt__seat--left">
          <SeatChip {...opponentSeats[0]} />
        </div>
      )}
      {opponentSeats[1] && (
        <div className="watch-felt__seat watch-felt__seat--right">
          <SeatChip {...opponentSeats[1]} align="right" />
        </div>
      )}

      {/* pot */}
      <div className="watch-felt__pot">
        <span className="watch-felt__pot-label">POT</span>
        <span className="watch-felt__pot-amt">{between ? '—' : `$${pot.toLocaleString()}`}</span>
      </div>

      {/* board */}
      <div className="watch-felt__board">
        {boardSlots.map((c, i) => (
          c && !between
            ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64} />
            : <CardBack key={i} w={46} h={64} branded />
        ))}
      </div>

      {/* street label */}
      <div className="watch-felt__street">
        {between
          ? `#${game?.tableId || '—'} · SHUFFLING`
          : `#${game?.tableId || '—'} · ${game?.blinds || ''} · ${street}`}
      </div>

      {/* hero readout */}
      <div className={`watch-felt__hero${actionLabel ? ' is-active' : ''}`}>
        {/* cards */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {(heroHole || [[null],[null]]).map((c, i) => (
            <div key={i} style={{ transform: `rotate(${i ? 3 : -3}deg)`, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
              {c && !between
                ? <PlayingCard rank={c[0]} suit={c[1]} w={40} h={56} />
                : <CardBack w={40} h={56} branded />}
            </div>
          ))}
        </div>
        <div className="watch-felt__hero-divider" />

        {/* stack */}
        <div>
          <span className="watch-felt__hero-lbl">Stack</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="watch-felt__hero-num">${heroData?.stack?.toLocaleString() || '—'}</span>
            <span className="watch-felt__hero-pos">{posLabel(heroSeat, game)}</span>
          </div>
        </div>
        <div className="watch-felt__hero-divider" />

        {/* equity — PORT-3 */}
        <div>
          <span className={`watch-felt__hero-lbl${hasEquity ? ' is-live' : ''}`}>Equity</span>
          <div>
            <span className={`watch-felt__hero-num${hasEquity ? ' is-live' : ' is-muted'}`}>
              {equityVal != null ? `${equityVal}%` : '—'}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {/* action chip or waiting text */}
        {actionLabel ? (
          <span className="watch-felt__action-chip">{actionLabel}</span>
        ) : (
          <span className="watch-felt__waiting">waiting for the deal</span>
        )}
      </div>

      {children}
    </div>
  );
}

// ── SitOutStrip ─────────────────────────────────────────────────────────────
function SitOutStrip({ onRequest }) {
  return (
    <div className="watch-sitout-strip">
      <div>
        <div className="watch-sitout-strip__title">Between hands</div>
        <div className="watch-sitout-strip__meta">READY FOR NEXT DEAL</div>
      </div>
      <div style={{ flex: 1 }} />
      <button type="button" className="watch-sitout-strip__btn" onClick={onRequest}>
        Sit out after this hand
      </button>
    </div>
  );
}

// ── SitOutSheet ─────────────────────────────────────────────────────────────
function SitOutSheet({ game, onConfirm, onCancel }) {
  const tableNum = game?.tableId || '—';
  const handCount = game?.handNumber || 0;
  return (
    <div className="watch-sitout-sheet-scrim">
      <div className="watch-sitout-sheet">
        <div className="watch-sitout-sheet__handle" />
        <div className="watch-sitout-sheet__title">Sit out after this hand?</div>
        <div className="watch-sitout-sheet__body">
          They finish the hand in progress, leave table #{tableNum}, and take a seat at the bar.
          Deploy them again whenever you like.
        </div>
        {handCount > 0 && (
          <div className="watch-sitout-sheet__session">
            <span className="watch-sitout-sheet__session-lbl">Session</span>
            <span className="watch-sitout-sheet__session-hands">{handCount} hand{handCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="watch-sitout-sheet__btns">
          <button type="button" className="watch-btn watch-btn--ghost" onClick={onCancel}>Keep playing</button>
          <button type="button" className="watch-btn watch-btn--primary" onClick={onConfirm}>Sit out</button>
        </div>
      </div>
    </div>
  );
}

// ── WatchTabs ───────────────────────────────────────────────────────────────
const TABS = ['Live analysis', 'Range', 'History', 'Chat'];

function WatchTabs({ active, onSelect }) {
  return (
    <div className="watch-tabs">
      {TABS.map((t, i) => (
        <div
          key={t}
          className={`watch-tabs__tab${active === i ? ' is-active' : ''}`}
          onClick={() => onSelect(i)}
        >{t}</div>
      ))}
    </div>
  );
}

// ── AnalysisRow ──────────────────────────────────────────────────────────────
function AnalysisRow({ label, value, color, bar, note }) {
  return (
    <div className="watch-analysis-row">
      <span className="watch-analysis-row__label">{label}</span>
      {bar != null && (
        <div className="watch-analysis-row__bar-track">
          <div className="watch-analysis-row__bar-fill" style={{ width: `${bar}%`, background: color || '#EDEDED' }} />
        </div>
      )}
      {note && <span className="watch-analysis-row__note">{note}</span>}
      <span className="watch-analysis-row__value" style={color ? { color } : {}}>{value}</span>
    </div>
  );
}

// ── Chat tab ─────────────────────────────────────────────────────────────────
function ChatTab({ messages, onSend, mySeat, displayNames }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);
  function submit(e) {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }
  return (
    <div className="dr-chat-tab">
      <div ref={listRef} className="dr-chat-tab__list">
        {messages.length === 0
          ? <div className="dr-chat-tab__empty">No messages yet…</div>
          : messages.map((m, i) => {
              const self = mySeat != null && m.seat === mySeat;
              return (
                <div key={`${m.t ?? i}-${i}`} className={`dr-chat-tab__row${self ? ' dr-chat-tab__row--self' : ''}`}>
                  <span className="dr-chat-tab__name">
                    {displayNames[m.seat] || m.displayName || `Seat ${m.seat}`}
                    {m.isAI && <span className="dr-chat-tab__ai-pill">AI</span>}
                  </span>
                  <span className="dr-chat-tab__bubble">{m.text}</span>
                </div>
              );
            })}
      </div>
      <form className="dr-chat-tab__form" onSubmit={submit}>
        <input className="dr-chat-tab__input" value={text} onChange={e => setText(e.target.value)}
          placeholder="Say something…" maxLength={280} aria-label="Chat message" />
        <button className="dr-chat-tab__send" type="submit" disabled={!text.trim()}>SEND</button>
      </form>
    </div>
  );
}

// ── WatchScreen (public) ────────────────────────────────────────────────────
export function WatchScreen({
  game, mySeat, lastDecision, chatMessages = [], sendChat = () => {}, displayNames = {},
  onLeave, onSitOut, config,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [sitOutPending, setSitOutPending] = useState(false);

  // Fetch agent for MoodBand — polls every 10s while watching
  const [agent, setAgent] = useState(null);
  const agentId = config?.agentId;
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    const load = () =>
      fetch(`/api/agents?userId=${getUserId()}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const found = (data.agents || []).find(a => a.id === agentId);
          if (found) setAgent(found);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [agentId]);

  const mood   = agent ? moodOf(agent) : 'neutral';
  const cause  = agent ? causeOf(agent) : null;
  const state  = agent ? stateOf(agent) : 'live';
  const accent = agent ? accentFor(agent) : '#00D4AA';

  const between = !handActive(game);

  function handleSitOutConfirm() {
    setSitOutPending(false);
    onSitOut?.();
    onLeave?.();
  }

  return (
    <div className="watch-screen">
      {/* back + band */}
      <div className="watch-screen__header">
        <button type="button" className="watch-screen__back" onClick={onLeave} aria-label="Leave table">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="watch-screen__title">{config?.displayName || 'Watching'}</span>
      </div>

      <MoodBand
        accent={accent}
        mood={mood}
        cause={cause || (state === 'live' ? 'at the table' : 'resting')}
        state={state}
        action="Chat"
        onAction={() => setActiveTab(3)}
      />

      {/* felt */}
      <WatchFelt game={game} mySeat={mySeat} lastDecision={lastDecision} />

      {/* sit-out strip between hands */}
      {between && (
        <SitOutStrip onRequest={() => setSitOutPending(true)} />
      )}

      {/* tabs */}
      <WatchTabs active={activeTab} onSelect={setActiveTab} />

      {/* tab content */}
      <div className="watch-panel">
        {activeTab === 0 && <LiveAnalysisTab lastDecision={lastDecision} />}
        {activeTab === 1 && <EmptyTab text="Range analysis coming soon." />}
        {activeTab === 2 && <EmptyTab text="No hands played yet." />}
        {activeTab === 3 && (
          <ChatTab
            messages={chatMessages}
            onSend={sendChat}
            mySeat={mySeat}
            displayNames={displayNames}
          />
        )}
      </div>

      {/* sit-out confirmation sheet */}
      {sitOutPending && (
        <SitOutSheet
          game={game}
          onConfirm={handleSitOutConfirm}
          onCancel={() => setSitOutPending(false)}
        />
      )}
    </div>
  );
}

// ── Live analysis tab ────────────────────────────────────────────────────────
function LiveAnalysisTab({ lastDecision }) {
  if (!lastDecision) {
    return (
      <div className="watch-panel__empty">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.4" strokeLinecap="round" aria-hidden style={{ marginBottom: 8, opacity: 0.4 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Waiting for first action…
      </div>
    );
  }

  const { action, reasoning, equity, potOdds } = lastDecision;
  const actionLabel = formatAction(action);
  const bullets = reasoning
    ? reasoning.split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 5)
    : ['Analyzing…'];

  const equityNum = typeof equity === 'number' ? equity : parseFloat(equity);
  const potOddsStr = potOdds
    ? (typeof potOdds === 'string' ? potOdds : `${potOdds.toFixed(1)} : 1`)
    : null;

  return (
    <div className="watch-panel__live">
      <div className="watch-panel__voice">"{reasoning || 'Making a decision…'}"</div>

      {/* PORT-3: equity row */}
      {!isNaN(equityNum) && (
        <AnalysisRow
          label="Equity"
          value={`${equityNum.toFixed(1)}%`}
          color="#00D4AA"
          bar={Math.round(equityNum)}
        />
      )}

      {potOddsStr && (
        <AnalysisRow label="Pot odds" value={potOddsStr} />
      )}

      <AnalysisRow label="Decision" value={actionLabel} color="#00D4AA" />

      {bullets.length > 0 && (
        <div className="watch-panel__bullets">
          {bullets.map((b, i) => (
            <div key={i} className="watch-panel__bullet">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="#00D4AA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden style={{ flexShrink: 0 }}>
                <path d="M5 12l5 5 9-11" />
              </svg>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyTab({ text }) {
  return (
    <div className="watch-panel__empty">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" aria-hidden style={{ marginBottom: 8, opacity: 0.4 }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {text}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatAction(action) {
  if (!action) return '—';
  const { type, amount } = action;
  if (type === 'fold')  return 'FOLD';
  if (type === 'check') return 'CHECK';
  if (type === 'call')  return 'CALL';
  if (type === 'bet')   return `BET $${amount}`;
  if (type === 'raise') return `RAISE $${amount}`;
  return String(type).toUpperCase();
}

function posLabel(seat, game) {
  if (!game) return '';
  if (game.bigBlindSeat === seat)   return 'BB';
  if (game.smallBlindSeat === seat) return 'SB';
  if (game.dealerSeat === seat)     return 'BTN';
  return '';
}
