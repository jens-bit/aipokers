// WatchScreen -- PORT-2/3, fixed PORT-5.
// Bug fixes (PORT-5):
//   1. Decision feed: append-only list that persists across hands; no re-renders on ticks.
//   2. Chat identity: owner messages render as "You" (isAI:false + seat=mySeat), not the
//      agent name. Distinguishing signal from server: isAI=false for human-typed chat.

import { useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodBand } from './system/MoodBand.jsx';
import { SeatChip } from './system/SeatChip.jsx';
import { PlayingCard, CardBack } from './system/PlayingCard.jsx';
import { moodOf, causeOf, stateOf } from './floor/agentView.js';
import { accentFor } from './floor/atoms.jsx';
import { Streets } from '../lib/protocol.js';

// ---- helpers ---------------------------------------------------------------

function pc(cardStr) {
  if (!cardStr || cardStr.length < 2) return null;
  return [cardStr[0], cardStr[1]];
}

function handActive(game) {
  if (!game) return false;
  const active = [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN];
  return active.includes(game.street);
}

function formatAction(action) {
  if (!action) return '--';
  const t = action.type;
  if (t === 'fold')  return 'FOLD';
  if (t === 'check') return 'CHECK';
  if (t === 'call')  return 'CALL';
  if (t === 'bet')   return 'BET $' + action.amount;
  if (t === 'raise') return 'RAISE $' + action.amount;
  return String(t).toUpperCase();
}

function posLabel(seat, game) {
  if (!game) return '';
  if (game.bigBlindSeat === seat)   return 'BB';
  if (game.smallBlindSeat === seat) return 'SB';
  if (game.dealerSeat === seat)     return 'BTN';
  return '';
}

// ---- DecisionBand ----------------------------------------------------------
// One decision row in the append-only feed. Never re-mounts once rendered.

function DecisionBand({ street, action, equity, reasoning }) {
  const actionLabel = formatAction(action);
  const equityNum   = (typeof equity === 'number') ? equity : parseFloat(equity);
  const hasEquity   = !isNaN(equityNum);

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
          fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em',
          padding: '2px 7px', borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--sys-muted,#6B6B6B)',
          textTransform: 'uppercase', flexShrink: 0,
        }}>{(street || 'PREFLOP').toUpperCase()}</span>

        <span style={{
          padding: '3px 9px', borderRadius: 5,
          background: 'var(--sys-teal,#00D4AA)', color: '#0A0A0A',
          fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', flexShrink: 0,
        }}>{actionLabel}</span>

        <div style={{ flex: 1 }} />

        {hasEquity && (
          <span style={{
            fontFamily: 'var(--sys-font-mono,"JetBrains Mono",monospace)',
            fontSize: 12.5, fontWeight: 700,
            color: 'var(--sys-teal,#00D4AA)',
            fontVariantNumeric: 'tabular-nums',
          }}>{equityNum.toFixed(1)}%</span>
        )}
      </div>

      {hasEquity && (
        <div style={{
          height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.07)', overflow: 'hidden',
          margin: '6px 0 5px',
        }}>
          <div style={{
            width: Math.min(100, equityNum) + '%',
            height: '100%',
            background: 'var(--sys-teal,#00D4AA)',
            borderRadius: 2,
          }} />
        </div>
      )}

      {reasoning && (
        <div style={{
          fontSize: 11.5, color: 'var(--sys-dim,#A1A1A1)', lineHeight: 1.4,
          fontStyle: 'italic',
          marginTop: hasEquity ? 0 : 5,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
          overflow: 'hidden',
        }}>"{reasoning}"</div>
      )}
    </div>
  );
}

// ---- HandDivider -----------------------------------------------------------

function HandDivider({ handNumber }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 14px',
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{
        fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
        fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--sys-muted,#6B6B6B)',
      }}>HAND #{handNumber}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

// ---- LiveAnalysisTab -------------------------------------------------------
// Receives the stable feed array; never clears it.

function LiveAnalysisTab({ feed }) {
  if (feed.length === 0) {
    return (
      <div className="watch-panel__empty">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.4" strokeLinecap="round" aria-hidden
          style={{ marginBottom: 8, opacity: 0.4 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Waiting for first action...
      </div>
    );
  }

  return (
    <div>
      {feed.map(function(item) {
        if (item.type === 'hand') {
          return <HandDivider key={item.id} handNumber={item.handNumber} />;
        }
        return (
          <DecisionBand
            key={item.id}
            street={item.street}
            action={item.action}
            equity={item.equity}
            potOdds={item.potOdds}
            reasoning={item.reasoning}
          />
        );
      })}
    </div>
  );
}

// ---- ChatTab ---------------------------------------------------------------
// PORT-6: owner↔agent private thread. Messages route through /api/agents/chat
// so the agent replies in-voice. AI table-speech (trash talk from the WS) appears
// as ambient rows, visually distinct from the DM thread.

function ChatTab({ agentThread, tableSpeech, onSend, loading, agentName }) {
  var [text, setText] = useState('');
  var listRef = useRef(null);

  // Merge thread messages and ambient table speech sorted by timestamp.
  var merged = agentThread.map(function(m) { return Object.assign({}, m, { _type: 'thread' }); })
    .concat(tableSpeech.map(function(m) { return Object.assign({}, m, { _type: 'ambient' }); }))
    .sort(function(a, b) { return (a.t || 0) - (b.t || 0); });

  useEffect(function() {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [merged.length, loading]);

  function submit(e) {
    if (e) e.preventDefault();
    var t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }

  var isEmpty = merged.length === 0 && !loading;

  return (
    <div className="dr-chat-tab">
      <div ref={listRef} className="dr-chat-tab__list">
        {isEmpty && (
          <div className="dr-chat-tab__empty">
            Talk to {agentName || 'your agent'} mid-game...
          </div>
        )}
        {merged.map(function(m, i) {
          if (m._type === 'ambient') {
            return (
              <div key={'ambient-' + i} style={{
                padding: '4px 14px',
                display: 'flex', alignItems: 'baseline', gap: 6,
              }}>
                <span style={{
                  fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
                  fontSize: 8, fontWeight: 600, letterSpacing: '0.12em',
                  color: 'var(--sys-muted,#6B6B6B)', textTransform: 'uppercase', flexShrink: 0,
                }}>TABLE</span>
                <span style={{
                  fontSize: 11.5, color: 'var(--sys-dim,#A1A1A1)',
                  fontStyle: 'italic', lineHeight: 1.4,
                }}>{m.text}</span>
              </div>
            );
          }
          var isUser = m.role === 'user';
          if (isUser) {
            return (
              <div key={'msg-' + i} style={{
                display: 'flex', justifyContent: 'flex-end',
                padding: '0 14px', marginBottom: 9,
              }}>
                <div style={{ maxWidth: '72%' }}>
                  <div style={{
                    background: 'rgba(0,212,170,0.10)',
                    border: '1px solid rgba(0,212,170,0.28)',
                    borderRadius: 12, borderBottomRightRadius: 4,
                    padding: '9px 12px',
                    fontSize: 13, color: 'var(--sys-text,#EDEDED)', lineHeight: 1.5,
                  }}>{m.content}</div>
                  <div style={{
                    marginTop: 3, textAlign: 'right',
                    fontFamily: 'var(--sys-font-mono,"JetBrains Mono",monospace)',
                    fontSize: 9.5, color: 'var(--sys-muted,#6B6B6B)',
                  }}>You</div>
                </div>
              </div>
            );
          }
          return (
            <div key={'msg-' + i} className="dr-chat-tab__row" style={{ marginBottom: 9 }}>
              <span className="dr-chat-tab__name">
                {agentName || 'Agent'}
                <span className="dr-chat-tab__ai-pill">AI</span>
              </span>
              <span className="dr-chat-tab__bubble">{m.content}</span>
            </div>
          );
        })}
        {loading && (
          <div className="dr-chat-tab__row" style={{ marginBottom: 9 }}>
            <span className="dr-chat-tab__name">{agentName || 'Agent'}</span>
            <span className="dr-chat-tab__bubble">
              <span className="dr-typing"><i /><i /><i /></span>
            </span>
          </div>
        )}
      </div>
      <form className="dr-chat-tab__form" onSubmit={submit}>
        <input className="dr-chat-tab__input" value={text}
          onChange={function(e) { setText(e.target.value); }}
          placeholder={'Message ' + (agentName || 'your agent') + '...'}
          maxLength={280} disabled={loading} aria-label="Chat message" />
        <button className="dr-chat-tab__send" type="submit" disabled={!text.trim() || loading}>SEND</button>
      </form>
    </div>
  );
}


// ---- seat ring -------------------------------------------------------------
// MST-4: up to five opponents around the felt, hero anchored at the bottom.
// The design language puts the first two in the top corners; beyond that the
// ring fills outward -- top centre, then the two side rails -- so the board and
// the pot ticker in the middle are never covered.
var SEAT_SLOTS = {
  1: ['tl'],
  2: ['tl', 'tr'],
  3: ['tl', 'tc', 'tr'],
  4: ['ml', 'tl', 'tr', 'mr'],
  5: ['ml', 'tl', 'tc', 'tr', 'mr'],
};

function slotsFor(count) {
  return SEAT_SLOTS[Math.max(1, Math.min(5, count))] || SEAT_SLOTS[2];
}

// ---- WatchFelt -------------------------------------------------------------

function WatchFelt({ game, mySeat, lastDecision }) {
  var between   = !handActive(game);
  var street    = game ? (game.street || '').toUpperCase() : '';
  var pot       = game ? (game.pot || 0) : 0;
  var community = game ? (game.community || []) : [];

  var heroSeat  = Number.isInteger(mySeat) ? mySeat : 0;
  var seatCount = Math.max((game && game.seats) ? game.seats.length : 2, 2);
  var heroData  = game && game.seats ? game.seats[heroSeat] : null;

  var heroHole  = (heroData && heroData.holeCards)
    ? heroData.holeCards.map(pc).filter(Boolean)
    : null;

  var boardSlots = community.map(pc);
  while (boardSlots.length < 5) boardSlots.push(null);

  var hasEquity   = lastDecision && lastDecision.equity != null && !between;
  var equityVal   = hasEquity ? lastDecision.equity : null;
  var actionLabel = lastDecision && lastDecision.action
    ? formatAction(lastDecision.action)
    : (game && game.toAct === heroSeat && !between ? 'TO ACT' : null);

  // Opponents in seat order clockwise from the hero, so the ring on screen
  // matches the order the action actually moves in.
  var opponentSeats = [];
  for (var step = 1; step < seatCount; step++) {
    var si = (heroSeat + step) % seatCount;
    var s = game && game.seats ? game.seats[si] : null;
    if (!s) continue;
    opponentSeats.push({
      name: s.displayName || ('Seat ' + (si + 1)),
      stack: s.stack ? s.stack.toLocaleString() : '0',
      pos: posLabel(si, game),
      acting: game.toAct === si,
      folded: s.folded,
    });
  }
  var slots = slotsFor(opponentSeats.length);
  var dense = opponentSeats.length >= 3;

  return (
    <div className="watch-felt">
      <div className="watch-felt__arc" />

      {opponentSeats.slice(0, slots.length).map(function(o, i) {
        var slot = slots[i];
        return (
          <div key={i} className={'watch-felt__seat watch-felt__seat--' + slot + (dense ? ' is-dense' : '')}>
            <SeatChip name={o.name} stack={o.stack} pos={o.pos}
              acting={o.acting} folded={o.folded}
              cards={!between}
              dense={dense}
              align={(slot === 'tr' || slot === 'mr') ? 'right' : 'left'} />
          </div>
        );
      })}

      <div className="watch-felt__pot">
        <span className="watch-felt__pot-label">POT</span>
        <span className="watch-felt__pot-amt">
          {between ? '--' : ('$' + pot.toLocaleString())}
        </span>
      </div>

      <div className="watch-felt__board">
        {boardSlots.map(function(c, i) {
          return (c && !between)
            ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64} />
            : <CardBack key={i} w={46} h={64} branded />;
        })}
      </div>

      <div className="watch-felt__street">
        {between
          ? ('#' + (game && game.tableId ? game.tableId : '--') + ' · ' + seatCount + '-HANDED · SHUFFLING')
          : ('#' + (game && game.tableId ? game.tableId : '--') + ' · ' + (game && game.blinds ? game.blinds : '') + ' · ' + seatCount + '-HANDED · ' + street)}
      </div>

      <div className={'watch-felt__hero' + (actionLabel ? ' is-active' : '')}>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {(heroHole || [null, null]).map(function(c, i) {
            return (
              <div key={i} style={{
                transform: 'rotate(' + (i ? 3 : -3) + 'deg)',
                filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))',
              }}>
                {(c && !between)
                  ? <PlayingCard rank={c[0]} suit={c[1]} w={40} h={56} />
                  : <CardBack w={40} h={56} branded />}
              </div>
            );
          })}
        </div>
        <div className="watch-felt__hero-divider" />

        <div>
          <span className="watch-felt__hero-lbl">Stack</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="watch-felt__hero-num">
              {'$' + (heroData && heroData.stack != null ? heroData.stack.toLocaleString() : '--')}
            </span>
            <span className="watch-felt__hero-pos">{posLabel(heroSeat, game)}</span>
          </div>
        </div>
        <div className="watch-felt__hero-divider" />

        <div>
          <span className={'watch-felt__hero-lbl' + (hasEquity ? ' is-live' : '')}>Equity</span>
          <div>
            <span className={'watch-felt__hero-num' + (hasEquity ? ' is-live' : ' is-muted')}>
              {equityVal != null ? (equityVal + '%') : '--'}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {actionLabel
          ? <span className="watch-felt__action-chip">{actionLabel}</span>
          : <span className="watch-felt__waiting">waiting for the deal</span>}
      </div>
    </div>
  );
}

// ---- SitOutStrip / SitOutSheet ---------------------------------------------

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

function SitOutSheet({ game, onConfirm, onCancel }) {
  var tableNum  = (game && game.tableId) ? game.tableId : '--';
  var handCount = (game && game.handNumber) ? game.handNumber : 0;
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
            <span className="watch-sitout-sheet__session-hands">
              {handCount + ' hand' + (handCount !== 1 ? 's' : '')}
            </span>
          </div>
        )}
        <div className="watch-sitout-sheet__btns">
          <button type="button" className="watch-btn watch-btn--ghost" onClick={onCancel}>
            Keep playing
          </button>
          <button type="button" className="watch-btn watch-btn--primary" onClick={onConfirm}>
            Sit out
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- WatchTabs -------------------------------------------------------------

var TABS = ['Live analysis', 'Range', 'History', 'Chat'];

function WatchTabs({ active, onSelect }) {
  return (
    <div className="watch-tabs">
      {TABS.map(function(t, i) {
        return (
          <div key={t}
            className={'watch-tabs__tab' + (active === i ? ' is-active' : '')}
            onClick={function() { onSelect(i); }}>
            {t}
          </div>
        );
      })}
    </div>
  );
}

// ---- EmptyTab --------------------------------------------------------------

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

// ---- WatchScreen (export) --------------------------------------------------

export function WatchScreen({
  game, mySeat, lastDecision, chatMessages, sendChat, displayNames,
  onLeave, onSitOut, config,
}) {
  if (!chatMessages)  chatMessages  = [];
  if (!sendChat)      sendChat      = function() {};
  if (!displayNames)  displayNames  = {};

  var [activeTab,     setActiveTab]     = useState(0);
  var [sitOutPending, setSitOutPending] = useState(false);
  var [agent,         setAgent]         = useState(null);

  // ---- Owner↔agent DM thread (PORT-6) ----
  var [agentThread,   setAgentThread]   = useState([]);
  var [agentLoading,  setAgentLoading]  = useState(false);

  // ---- Agent mood polling (for MoodBand) ----
  var agentId = config ? config.agentId : null;
  useEffect(function() {
    if (!agentId) return;
    var cancelled = false;
    function load() {
      fetch('/api/agents?userId=' + getUserId())
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (cancelled) return;
          var found = (data.agents || []).find(function(a) { return a.id === agentId; });
          if (found) setAgent(found);
        })
        .catch(function() {});
    }
    load();
    var id = setInterval(load, 10000);
    return function() { cancelled = true; clearInterval(id); };
  }, [agentId]);

  var mood   = agent ? moodOf(agent)   : 'neutral';
  var cause  = agent ? causeOf(agent)  : null;
  var state  = agent ? stateOf(agent)  : 'live';
  var accent = agent ? accentFor(agent) : '#00D4AA';

  // ---- Append-only decision feed (Bug-5 fix) ----
  var [decisionFeed, setDecisionFeed] = useState([]);
  var feedIdRef      = useRef(0);
  var handNumberRef  = useRef(null);
  var streetRef      = useRef('');

  // Track current street so we can stamp each decision band with it.
  // Runs every render — always up-to-date before the decision effect fires.
  useEffect(function() {
    if (game && game.street) streetRef.current = game.street;
  });

  // New hand -> prepend a divider (skip the very first hand so feed starts clean).
  useEffect(function() {
    var hn = game ? game.handNumber : null;
    if (!hn) return;
    if (handNumberRef.current === hn) return;
    var hadPrev = handNumberRef.current !== null;
    handNumberRef.current = hn;
    if (hadPrev) {
      var entry = { id: ++feedIdRef.current, type: 'hand', handNumber: hn };
      setDecisionFeed(function(prev) { return [entry].concat(prev); });
    }
  }, [game && game.handNumber]);

  // New decision -> prepend a band.
  useEffect(function() {
    if (!lastDecision) return;
    var band = {
      id: ++feedIdRef.current,
      type: 'decision',
      street: streetRef.current || 'preflop',
      action: lastDecision.action,
      equity: lastDecision.equity,
      potOdds: lastDecision.potOdds,
      reasoning: lastDecision.reasoning,
    };
    setDecisionFeed(function(prev) { return [band].concat(prev); });
  }, [lastDecision]);

  // AI trash-talk from the WS — shown as ambient rows in the agent DM thread.
  var tableSpeech = chatMessages.filter(function(m) { return m.isAI; })
    .map(function(m) { return { text: m.text, t: m.t || 0 }; });

  function sendToAgent(text) {
    if (!agentId || agentLoading) return;
    var now = Date.now();
    setAgentThread(function(prev) { return prev.concat([{ role: 'user', content: text, t: now }]); });
    setAgentLoading(true);
    fetch('/api/agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
      body: JSON.stringify({ userId: getUserId(), content: text, existingAgentId: agentId }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var serverChat = data.chat || [];
        var newAi = null;
        for (var j = serverChat.length - 1; j >= 0; j--) {
          if (serverChat[j].role === 'assistant') { newAi = serverChat[j]; break; }
        }
        if (newAi) {
          setAgentThread(function(prev) {
            return prev.concat([{ role: 'assistant', content: newAi.content, t: Date.now() }]);
          });
        }
      })
      .catch(function() {
        setAgentThread(function(prev) {
          return prev.concat([{ role: 'assistant', content: 'Something went wrong — try again.', t: Date.now() }]);
        });
      })
      .finally(function() { setAgentLoading(false); });
  }

  var between = !handActive(game);

  function handleSitOutConfirm() {
    setSitOutPending(false);
    if (onSitOut) onSitOut();
    if (onLeave)  onLeave();
  }

  return (
    <div className="watch-screen">

      <div className="watch-screen__header">
        <button type="button" className="watch-screen__back" onClick={onLeave} aria-label="Leave table">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="watch-screen__title">
          {config ? (config.displayName || 'Watching') : 'Watching'}
        </span>
      </div>

      <MoodBand
        accent={accent}
        mood={mood}
        cause={cause || (state === 'live' ? 'at the table' : 'resting')}
        state={state}
        action="Chat"
        onAction={function() { setActiveTab(3); }}
      />

      <WatchFelt game={game} mySeat={mySeat} lastDecision={lastDecision} />

      {between && (
        <SitOutStrip onRequest={function() { setSitOutPending(true); }} />
      )}

      <WatchTabs active={activeTab} onSelect={setActiveTab} />

      <div className="watch-panel">
        {activeTab === 0 && <LiveAnalysisTab feed={decisionFeed} />}
        {activeTab === 1 && <EmptyTab text="Range analysis coming soon." />}
        {activeTab === 2 && <EmptyTab text="No hands played yet." />}
        {activeTab === 3 && (
          <ChatTab
            agentThread={agentThread}
            tableSpeech={tableSpeech}
            onSend={sendToAgent}
            loading={agentLoading}
            agentName={config ? config.displayName : null}
          />
        )}
      </div>

      {sitOutPending && (
        <SitOutSheet
          game={game}
          onConfirm={handleSitOutConfirm}
          onCancel={function() { setSitOutPending(false); }}
        />
      )}
    </div>
  );
}
