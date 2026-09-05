// WatchScreen -- PORT-2/3, fixed PORT-5.
// Bug fixes (PORT-5):
//   1. Decision feed: append-only list that persists across hands; no re-renders on ticks.
//   2. Chat identity: owner messages render as "You" (isAI:false + seat=mySeat), not the
//      agent name. Distinguishing signal from server: isAI=false for human-typed chat.

import { useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodBand } from './system/MoodBand.jsx';
import { SeatChip, SeatChipSm, BetPill, SeatCardBacks } from './system/SeatChip.jsx';
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

// WV2-5: a hand that has finished but not yet been cleared by the next deal.
// The engine's result -- winners, the pot, and every contestant's revealed hole
// cards -- rides along on the terminal STATE, so the felt can hold the showdown
// on screen for the whole pause between hands instead of blanking the instant
// the hand ends.
function handSettled(game) {
  return !!game && game.street === Streets.COMPLETE && !!game.result;
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

// WV2-2: the wire carries equity as a 0..1 FRACTION. estimateEquity returns
// (wins + ties) / iterations and table.js puts that straight on the DECISION
// message, so the hero readout showed "0.674375%" where it meant 67.4%.
// Every equity render in this screen goes through here.
//
// A value above 1 cannot be a fraction — the flagged-hands API stores integer
// percents — so it is passed through rather than multiplied into nonsense.
function equityPct(equity) {
  var n = (typeof equity === 'number') ? equity : parseFloat(equity);
  if (!isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function formatEquity(equity) {
  var pct = equityPct(equity);
  return pct === null ? null : pct.toFixed(1) + '%';
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
  const equityNum   = equityPct(equity);
  const hasEquity   = equityNum !== null;

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
          fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em',
          padding: '2px 7px', borderRadius: 4,
          background: 'rgba(255,255,255,0.12)',
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
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <span style={{
        fontFamily: 'var(--sys-font-label,"Oswald",sans-serif)',
        fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--sys-muted,#6B6B6B)',
      }}>HAND #{handNumber}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  );
}

// ---- LiveAnalysisTab -------------------------------------------------------
// Receives the stable feed array; never clears it.

function LiveAnalysisTab({ feed, between }) {
  if (feed.length === 0) {
    return (
      <div className="watch-panel__empty">
        {!between && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" aria-hidden
            style={{ marginBottom: 6, opacity: 0.35 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        )}
        <span style={{ opacity: between ? 0.4 : 1, fontSize: between ? 11 : 12 }}>
          {between ? 'Watching…' : 'Waiting for first action…'}
        </span>
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
  var listRef    = useRef(null);
  var chatInputRef = useRef(null);

  useEffect(function() {
    var el = chatInputRef.current;
    if (!el) return;
    function onFocus() { setTimeout(function() { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 150); }
    el.addEventListener('focus', onFocus);
    return function() { el.removeEventListener('focus', onFocus); };
  }, []);

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
    // FIX-1e: --fill, so the between-hands strip above cannot squeeze the list
    // and the composer out of the sheet.
    <div className="dr-chat-tab dr-chat-tab--fill">
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
        <input ref={chatInputRef} className="dr-chat-tab__input" value={text}
          onChange={function(e) { setText(e.target.value); }}
          placeholder={'Message ' + (agentName || 'your agent') + '...'}
          maxLength={280} disabled={loading} aria-label="Chat message" />
        <button className="dr-chat-tab__send" type="submit" disabled={!text.trim() || loading}>SEND</button>
      </form>
    </div>
  );
}


// ---- the sheet: three detents of one screen ---------------------------------
// WV2-3, ported from design-refs/mood-watch2.jsx (PART 1 · THE SHEET).
//
// The analysis tab bar is the grab handle. The screen has three vertical
// states and the felt scales fluidly between them as the sheet is dragged.

// SHEET_LAY, verbatim from the ref: the felt's height at each detent, and the
// absolute tops of the pot ticker, the board and the meta line inside it.
var SHEET_LAY = {
  expanded: { felt: 306, pot: 60,  board: 108, meta: 184 },
  peek:     { felt: 508, pot: 128, board: 196, meta: 286 },
  hidden:   { felt: 620, pot: 168, board: 244, meta: 336 },
};

var DETENTS = ['expanded', 'peek', 'hidden'];

// The ref's HIDDEN detent leaves exactly the thin grab handle below the felt
// (7 + 4 + 7 of padding and bar, plus the 1px border), so the region those
// three felt heights are measured against is 620 + 19 = 639. Reading them as
// fractions of that is what lets a 390x844 mock scale to a real phone --
// and it lands on the brief's own numbers: PEEK's felt is 508/639 = 79.5%.
var SHEET_REGION = SHEET_LAY.hidden.felt + 19;

// Felt height at each detent, as a fraction of the stage.
var FELT_FRAC = DETENTS.map(function(d) { return SHEET_LAY[d].felt / SHEET_REGION; });

// The three interior tops as fractions of the felt's own height, so they hold
// their proportions on a stage taller or shorter than the ref's. At the ref's
// region these reproduce SHEET_LAY exactly.
var INNER_FRAC = DETENTS.map(function(d) {
  var L = SHEET_LAY[d];
  return { pot: L.pot / L.felt, board: L.board / L.felt, meta: L.meta / L.felt };
});

function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
function lerp(a, b, t) { return a + (b - a) * t; }

// Where a continuous felt fraction sits on the 0(expanded)..2(hidden) scale.
function detentPos(frac) {
  if (frac <= FELT_FRAC[0]) return 0;
  if (frac >= FELT_FRAC[2]) return 2;
  var i = frac <= FELT_FRAC[1] ? 0 : 1;
  return i + (frac - FELT_FRAC[i]) / (FELT_FRAC[i + 1] - FELT_FRAC[i]);
}

// The hero readout is 74px tall and sits 16px off the bottom, so the felt's
// last 90px belong to it. These three keep the stack clear of it on a phone
// shorter than the ref's: the meta line above the readout, the board above the
// meta line, the pot above the board. Inert at every SHEET_LAY detent -- they
// only bite below roughly 250px of felt.
var HERO_BAND = 90;   // readout height + its bottom offset
var META_H    = 19;   // meta line plus its breathing room
var BOARD_H   = 70;   // a 64px card plus its gap
var POT_H     = 36;   // the pot pill plus its gap
var SEAT_BAND = 44;   // the seat chips own the top of the felt

// The felt's height and interior tops for a stage of `stagePx` at position `p`.
function feltGeometry(frac, stagePx) {
  var p    = detentPos(frac);
  var i    = clamp(Math.floor(p), 0, 1);
  var t    = clamp(p - i, 0, 1);
  var felt = Math.round(frac * stagePx);
  var a = INNER_FRAC[i], b = INNER_FRAC[i + 1];

  var meta  = lerp(a.meta,  b.meta,  t) * felt;
  var board = lerp(a.board, b.board, t) * felt;
  var pot   = lerp(a.pot,   b.pot,   t) * felt;

  // A felt too short to hold the stack squeezes it rather than letting the
  // meta line slide under the hero readout: the three keep their spacing
  // ratios and are rescaled into the band between the seat chips and the
  // readout. On any stage the ref's own detents fit, this is a no-op.
  var floor   = SEAT_BAND;
  var ceiling = felt - HERO_BAND - META_H;
  if (meta > ceiling && meta > floor) {
    var k = (ceiling - floor) / (meta - floor);
    pot   = floor + (pot - floor) * k;
    board = floor + (board - floor) * k;
    meta  = ceiling;
  }

  return {
    felt:  felt,
    pot:   Math.round(Math.max(floor, pot)),
    board: Math.round(Math.max(floor, board)),
    meta:  Math.round(Math.max(floor, meta)),
  };
}

// ---- SheetHandle -----------------------------------------------------------

function SheetHandle({ thin }) {
  return (
    <div className={'watch-sheet__handle' + (thin ? ' is-thin' : '')}>
      <i />
    </div>
  );
}

// ---- seat ring -------------------------------------------------------------
// WV2-4, per design-refs/mood-watch2.jsx (PART 2 · MULTIWAY). The engine seats
// 2..6, so the ring holds one to five opponents with the hero anchored at the
// bottom. Slots come into play in the order the brief sets -- top corners,
// then top centre, then the side rails -- and each row below lists them in
// ring order (up the left, across the top, down the right) so the opponent
// sitting in each is the one the action actually reaches next.
var SEAT_SLOTS = {
  1: ['tl'],
  2: ['tl', 'tr'],
  3: ['tl', 'tc', 'tr'],
  4: ['ml', 'tl', 'tc', 'tr'],
  5: ['ml', 'tl', 'tc', 'tr', 'mr'],
};

function slotsFor(count) {
  return SEAT_SLOTS[Math.max(1, Math.min(5, count))] || SEAT_SLOTS[2];
}

function alignFor(slot) {
  return (slot === 'tr' || slot === 'mr') ? 'right' : 'left';
}

// "Full SeatChip through 4-handed; the rails and 6-handed use SeatChipSm."
// A rail seat is always compact; at six-handed every seat is.
function compactFor(slot, opponentCount) {
  return slot === 'ml' || slot === 'mr' || opponentCount >= 5;
}

// ---- WatchFelt -------------------------------------------------------------

function WatchFelt({ game, mySeat, lastDecision, geom }) {
  // WV2-5: three phases, not two. `settled` is a finished hand still on
  // screen -- board, reveals and the pot going to its winner -- and it holds
  // until the next deal clears it.
  var live      = handActive(game);
  var settled   = !live && handSettled(game);
  var between   = !live && !settled;
  var street    = game ? (game.street || '').toUpperCase() : '';
  var pot       = game ? (game.pot || 0) : 0;
  var community = game ? (game.community || []) : [];
  var result    = settled ? game.result : null;

  // Which seats showed, and what they showed. Everyone else mucked.
  var revealed = {};
  if (result && result.showdown) {
    result.showdown.forEach(function(sd) { revealed[sd.seat] = sd.holeCards || []; });
  }
  var winner = (result && result.winners && result.winners.length) ? result.winners[0] : null;

  var heroSeat  = Number.isInteger(mySeat) ? mySeat : 0;
  var seatCount = Math.max((game && game.seats) ? game.seats.length : 2, 2);
  var heroData  = game && game.seats ? game.seats[heroSeat] : null;

  var heroHole  = (heroData && heroData.holeCards)
    ? heroData.holeCards.map(pc).filter(Boolean)
    : null;

  var boardSlots = community.map(pc);
  while (boardSlots.length < 5) boardSlots.push(null);

  // Equity is a live read on a hand in progress. At showdown the cards are on
  // the table, so the ref's readout shows an em dash there -- as it does
  // between hands.
  var equityText  = live ? formatEquity(lastDecision && lastDecision.equity) : null;
  var hasEquity   = equityText !== null;
  // At showdown the readout stops reporting the hero's last action and says
  // how the hand ended -- the ref's `note` slot.
  var actionLabel = settled ? null : (lastDecision && lastDecision.action
    ? formatAction(lastDecision.action)
    : (game && game.toAct === heroSeat && live ? 'TO ACT' : null));

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
      folded: !!s.folded,
      dealer: game.dealerSeat === si,
      // WV2-4: what this seat has put in on the current street, shown in front
      // of it. Zero and between hands both mean no pill.
      bet: (live && s.contribThisStreet > 0) ? s.contribThisStreet.toLocaleString() : null,
      // WV2-5: at showdown a seat either shows its hand or it does not. A seat
      // that FOLDED and did not show is mucked -- face down and dim, because
      // folds keep their secrets. A seat that won uncontested never had to
      // show either, but it did not muck, so its backs stay at full strength.
      reveal: (settled && revealed[si] && revealed[si].length)
        ? revealed[si].map(pc).filter(Boolean)
        : null,
      mucked: settled && !revealed[si] && !!s.folded,
    });
  }
  var slots = slotsFor(opponentSeats.length);

  var heroWon    = !!(winner && winner.seat === heroSeat);
  var heroShowed = !!(result && revealed[heroSeat]);
  var heroNote   = !settled ? 'waiting for the deal'
    : heroWon    ? (winner.descr || 'won the pot')
    : heroShowed ? 'lost at showdown'
    : 'folded';

  var winnerName = (winner && game.seats && game.seats[winner.seat])
    ? (game.seats[winner.seat].displayName || ('Seat ' + (winner.seat + 1)))
    : null;

  // WV2-5: the street and what the hero is being asked for, on the meta line.
  var blinds = (game && game.smallBlind != null && game.bigBlind != null)
    ? ('$' + game.smallBlind + '/$' + game.bigBlind)
    : '';
  var toCall = (live && heroData && game.currentBet != null)
    ? Math.max(0, game.currentBet - (heroData.contribThisStreet || 0))
    : 0;
  var tableLabel = '#' + (game && game.tableId ? game.tableId : '--');
  var metaLine = between
    ? [tableLabel, blinds, 'SHUFFLING'].filter(Boolean).join(' · ')
    : [tableLabel, blinds, street, seatCount + '-HANDED']
        .concat(toCall > 0 ? ['TO CALL $' + toCall.toLocaleString()] : [])
        .filter(Boolean).join(' · ');

  // WV2-3: the felt's height and its three interior tops come from the sheet's
  // current detent, so it grows and shrinks with the drag.
  var feltStyle = geom ? {
    height: geom.felt + 'px',
    '--wv-pot':   geom.pot + 'px',
    '--wv-board': geom.board + 'px',
    '--wv-meta':  geom.meta + 'px',
  } : undefined;

  return (
    <div className="watch-felt" style={feltStyle}>
      <div className="watch-felt__arc" />

      {opponentSeats.slice(0, slots.length).map(function(o, i) {
        var slot    = slots[i];
        var align   = alignFor(slot);
        var compact = compactFor(slot, opponentSeats.length);
        var showCards = !!o.reveal;
        var showBacks = live ? !o.folded : (settled && !showCards);
        return (
          <div key={i} className={'watch-felt__seat watch-felt__seat--' + slot}>
            {compact
              ? <SeatChipSm name={o.name} stack={o.stack} acting={o.acting}
                  folded={o.folded} dealer={o.dealer} />
              : <SeatChip name={o.name} stack={o.stack} pos={o.pos} acting={o.acting}
                  folded={o.folded} align={align} dealer={o.dealer} />}
            {(showBacks || showCards || o.bet) && (
              <div className="watch-felt__seat-row">
                {showCards && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {o.reveal.map(function(c, k) {
                      return <PlayingCard key={k} rank={c[0]} suit={c[1]} w={22} h={31} />;
                    })}
                  </div>
                )}
                {showBacks && <SeatCardBacks mucked={o.mucked} />}
                {o.bet && <BetPill amount={o.bet} />}
              </div>
            )}
          </div>
        );
      })}

      {/* The pot ticker is an outer positioning row with the pill inside it --
          without the inner element the pill spanned the whole felt. At
          showdown the pot has already moved, so it steps aside for the
          winner pill below the board. */}
      {!settled && (
        <div className="watch-felt__pot">
          <div className="watch-felt__pot-pill">
            <span className="watch-felt__pot-label">POT</span>
            <span className={'watch-felt__pot-amt' + (between ? ' is-between' : '')}>
              {between ? '—' : ('$' + pot.toLocaleString())}
            </span>
          </div>
        </div>
      )}

      <div className={'watch-felt__board' + (between ? ' is-between' : '')}>
        {boardSlots.map(function(c, i) {
          return c
            ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64} />
            : <CardBack key={i} w={46} h={64} branded />;
        })}
      </div>

      {settled ? (
        <>
          <div className="watch-felt__pot-trail" />
          <div className="watch-felt__won">
            <div className="watch-felt__won-pill">
              <span className="watch-felt__won-amt">
                {'$' + (result.pot || 0).toLocaleString()}
              </span>
              {winnerName && <span className="watch-felt__won-to">{'→ ' + winnerName}</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="watch-felt__street">{metaLine}</div>
      )}

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
              {equityText || '--'}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {actionLabel
          ? <span className="watch-felt__action-chip">{actionLabel}</span>
          : <span className="watch-felt__waiting">{heroNote}</span>}
      </div>
    </div>
  );
}

// ---- SitOutStrip / SitOutSheet ---------------------------------------------

function SitOutStrip({ visible, onRequest }) {
  return (
    <div className={'watch-sitout-strip' + (visible ? '' : ' is-hidden')} aria-hidden={!visible}>
      <div>
        <div className="watch-sitout-strip__title">Between hands</div>
        <div className="watch-sitout-strip__meta">READY FOR NEXT DEAL</div>
      </div>
      <div style={{ flex: 1 }} />
      <button type="button" className="watch-sitout-strip__btn" onClick={onRequest} tabIndex={visible ? 0 : -1}>
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

// WV2-3: the tab bar is the sheet's grab handle, so it no longer binds its own
// click. Selection and dragging are one gesture, resolved by the sheet: a tap
// that lands on a tab selects it, a drag moves the sheet.
function WatchTabs({ active }) {
  return (
    <div className="watch-tabs">
      {TABS.map(function(t, i) {
        return (
          <div key={t}
            data-watch-tab={i}
            className={'watch-tabs__tab' + (active === i ? ' is-active' : '')}>
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

// ---- useSheetDrag ----------------------------------------------------------
// One gesture on the grab surface (handle + tab bar) does everything the ref
// asks of it: drag moves the sheet fluidly, release snaps to the nearest
// detent, and a tap either selects the tab under the finger or -- on the
// handle itself -- cycles EXPANDED -> PEEK -> HIDDEN -> EXPANDED.
var TAP_SLOP_PX = 6;
var TAP_MAX_MS  = 400;

function useSheetDrag({ onSelectTab }) {
  // Measured height of the stage the felt and the sheet share.
  var [stagePx, setStagePx] = useState(function() {
    return typeof window === 'undefined' ? SHEET_REGION : Math.max(320, window.innerHeight - 170);
  });
  var [frac,     setFrac]     = useState(FELT_FRAC[0]);
  var [dragging, setDragging] = useState(false);

  var stageRef = useRef(null);
  var gesture  = useRef(null);

  useEffect(function() {
    var el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    var ro = new ResizeObserver(function(entries) {
      var h = entries[0] && entries[0].contentRect ? entries[0].contentRect.height : 0;
      if (h > 0) setStagePx(h);
    });
    ro.observe(el);
    return function() { ro.disconnect(); };
  }, []);

  function snap(nextFrac) {
    var best = 0;
    for (var i = 1; i < FELT_FRAC.length; i++) {
      if (Math.abs(FELT_FRAC[i] - nextFrac) < Math.abs(FELT_FRAC[best] - nextFrac)) best = i;
    }
    setFrac(FELT_FRAC[best]);
  }

  function goTo(index) {
    setFrac(FELT_FRAC[clamp(index, 0, FELT_FRAC.length - 1)]);
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    var tabAttr = e.target && e.target.closest ? e.target.closest('[data-watch-tab]') : null;
    gesture.current = {
      id: e.pointerId,
      y: e.clientY,
      frac: frac,
      t: Date.now(),
      moved: false,
      tab: tabAttr ? Number(tabAttr.getAttribute('data-watch-tab')) : null,
    };
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* not captureable */ }
    }
    setDragging(true);
  }

  function onPointerMove(e) {
    var g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    var dy = e.clientY - g.y;
    if (Math.abs(dy) > TAP_SLOP_PX) g.moved = true;
    // Dragging DOWN shrinks the sheet, which grows the felt.
    setFrac(clamp(g.frac + dy / Math.max(1, stagePx), FELT_FRAC[0], FELT_FRAC[FELT_FRAC.length - 1]));
  }

  function onPointerUp(e) {
    var g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    var isTap = !g.moved && (Date.now() - g.t) < TAP_MAX_MS;
    if (!isTap) { snap(frac); return; }
    setFrac(g.frac);
    if (g.tab !== null && !isNaN(g.tab)) {
      // A tap on a tab selects it, and opens the sheet if it was not open.
      onSelectTab(g.tab);
      if (g.frac !== FELT_FRAC[0]) goTo(0);
      return;
    }
    // A tap on the handle cycles the detents.
    goTo((DETENTS.indexOf(detentName(g.frac)) + 1) % DETENTS.length);
  }

  function onPointerCancel() {
    if (!gesture.current) return;
    gesture.current = null;
    setDragging(false);
    snap(frac);
  }

  return {
    stageRef: stageRef,
    dragging: dragging,
    detent: detentName(frac),
    geom: feltGeometry(frac, stagePx),
    handlers: {
      onPointerDown: onPointerDown,
      onPointerMove: onPointerMove,
      onPointerUp: onPointerUp,
      onPointerCancel: onPointerCancel,
    },
  };
}

// The detent a felt fraction reads as -- the nearest one, so a sheet mid-drag
// still reports something the render tree can key off.
function detentName(frac) {
  var best = 0;
  for (var i = 1; i < FELT_FRAC.length; i++) {
    if (Math.abs(FELT_FRAC[i] - frac) < Math.abs(FELT_FRAC[best] - frac)) best = i;
  }
  return DETENTS[best];
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
      fetch('/api/agents?userId=' + getUserId(), { headers: { 'x-telegram-init-data': getTelegramInitData() } })
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

  // WV2-3: the sheet owns the vertical layout of the whole screen.
  var sheet     = useSheetDrag({ onSelectTab: setActiveTab });

  // Belt-and-braces: non-passive touchmove on the sheet container so that a
  // drag starting on the grab handle cannot bubble up to Telegram's webview
  // and trigger the native "minimize Mini App" gesture. disableVerticalSwipes()
  // in initTelegram() is the primary fix; this is the fallback.
  var sheetElRef = useRef(null);
  useEffect(function() {
    var el = sheetElRef.current;
    if (!el) return;
    function block(e) { if (e.cancelable) e.preventDefault(); }
    el.addEventListener('touchmove', block, { passive: false });
    return function() { el.removeEventListener('touchmove', block); };
  }, []);
  var hidden    = sheet.detent === 'hidden';
  // PEEK shows the latest one-line voice row -- the newest decision's reasoning
  // and its equity, the same pair the expanded body leads with.
  var latest    = decisionFeed.find(function(item) { return item.type === 'decision'; }) || null;
  var peekLine  = latest && latest.reasoning ? '“' + latest.reasoning + '”' : null;
  var peekEquity = latest ? formatEquity(latest.equity) : null;

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

      <div className={'watch-stage' + (sheet.dragging ? ' is-dragging' : '')}
        ref={sheet.stageRef}>

        <WatchFelt game={game} mySeat={mySeat} lastDecision={lastDecision} geom={sheet.geom} />

        {/* THE SHEET -- the tab bar is the grab handle. Both grab surfaces are
            always mounted (the tab one merely hidden at HIDDEN) so a drag that
            crosses a detent never loses its pointer capture mid-gesture. */}
        <div className="watch-sheet" data-detent={sheet.detent} ref={sheetElRef}>
          <div key="grab-handle" className="watch-sheet__grab" {...sheet.handlers}>
            <SheetHandle thin={hidden} />
          </div>

          <SitOutStrip
            key="sitout"
            visible={between && sheet.detent === 'expanded'}
            onRequest={function() { setSitOutPending(true); }}
          />

          <div key="grab-tabs" className="watch-sheet__grab" hidden={hidden} {...sheet.handlers}>
            <WatchTabs active={activeTab} />
          </div>

          {sheet.detent === 'peek' && (
            <div className="watch-sheet__peek">
              <span className="watch-sheet__peek-line">
                {peekLine || 'Waiting for first action...'}
              </span>
              {peekEquity && <span className="watch-sheet__peek-eq">{peekEquity}</span>}
            </div>
          )}

          {sheet.detent === 'expanded' && (
            <div className="watch-panel">
              {activeTab === 0 && <LiveAnalysisTab feed={decisionFeed} between={between} />}
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
          )}
        </div>
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
