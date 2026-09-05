// WatchScreen -- PORT-2/3, fixed PORT-5.
// Bug fixes (PORT-5):
//   1. Decision feed: append-only list that persists across hands; no re-renders on ticks.
//   2. Chat identity: owner messages render as "You" (isAI:false + seat=mySeat), not the
//      agent name. Distinguishing signal from server: isAI=false for human-typed chat.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodChip, StateTag } from './floor/atoms.jsx';
import { SeatChip, SeatChipSm, BetPill, SeatCardBacks } from './system/SeatChip.jsx';
import { PlayingCard, CardBack } from './system/PlayingCard.jsx';
import { moodOf, causeOf, stateOf } from './floor/agentView.js';
import { Streets } from '../lib/protocol.js';
import { RiverAttrPanel } from './AnalysisPanel.jsx';
import { TugBar } from './system/TugBar.jsx';
import { ReadPanel } from './system/ReadPanel.jsx';
import { SeatGhost } from './system/SeatGhost.jsx';
import { ReadSheet } from './system/ReadSheet.jsx';
import { Bubble } from './system/Bubble.jsx';
import { onFelt, record, BUBBLE_MS } from '../lib/bubbles.js';
import { fire as fireHaptic } from '../lib/haptics.js';
import { beat, isMuted, toggleMuted } from '../lib/audio.js';
import { PredictBeat } from './system/PredictBeat.jsx';
import { predictEnabled, settle, getStreak } from '../lib/predict.js';
import { paceOf, paceMeta, heroEquityOf, landedCount, stagedCount, FLIP_MS } from '../lib/pace.js';
import { dealBeat, isWarm, isNewDeal, DEAL_TOTAL_MS, CARD_GAP_MS, BACKS_DELAY_MS } from '../lib/deal.js';
import { pickOpponent } from '../lib/reads.js';

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

// ---- ReadTab ---------------------------------------------------------------
// W3-2: the READ tab. His picture of the opponent, plus — between hands only —
// the attribute panel ATTR-2e put on the hand just played. Nothing here says
// "waiting for the first action": before there is evidence he says so himself.

function ReadTab({ game, between, agent, lastHand, predict }) {
  return (
    <div className="watch-panel__read">
      <ReadPanel reads={game ? game.reads : null} game={game} />
      {predict}
      {between && agent && lastHand && <RiverAttrPanel agent={agent} hand={lastHand} />}
      <MuteToggle />
    </div>
  );
}

// ---- MuteToggle ------------------------------------------------------------
// W3-3: sound is a second layer to the haptics, and it has to be switchable —
// the phone is on silent in a bar, and every beat is built to land on haptics
// alone. The sounds themselves ship later; the switch ships now.

function MuteToggle() {
  var [muted, setMuted] = useState(function() { return isMuted(); });
  return (
    <button
      type="button"
      className={'watch-mute' + (muted ? ' is-muted' : '')}
      aria-pressed={muted}
      onClick={function() { setMuted(toggleMuted()); }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {muted
          ? <path d="M23 9l-6 6M17 9l6 6" />
          : <path d="M15.5 8.5a5 5 0 010 7" />}
      </svg>
      <span>{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
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
// FIX-3a: the band under the board is now the rope, not the one-line meta text
// W3-1 deleted, and the hero row shrank when it became HeroRow3 (36x50 cards in
// 8px padding, not 40x56 in 9px). Both constants follow those changes.
var HERO_BAND = 78;   // HeroRow3's height (66) plus its 12px bottom offset
var TUG_H     = 30;   // the rope: 9px track + 4px gap + its legend
var BOARD_H   = 70;   // a 64px card plus its gap
var POT_H     = 36;   // the pot pill plus its gap
var SEAT_BAND = 44;   // the seat chips own the top of the felt
var LINE_H    = 19;   // his line at 13px/1.4
var LINE_GAP  = 8;    // and the air it needs on each side

// The felt's height and interior tops for a stage of `stagePx` at position `p`.
export function feltGeometry(frac, stagePx) {
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
  var ceiling = felt - HERO_BAND - TUG_H;
  if (meta > ceiling && meta > floor) {
    var k = (ceiling - floor) / (meta - floor);
    pot   = floor + (pot - floor) * k;
    board = floor + (board - floor) * k;
    meta  = ceiling;
  }

  pot   = Math.round(Math.max(floor, pot));
  board = Math.round(Math.max(floor, board));
  meta  = Math.round(Math.max(floor, meta));


  // FIX-3a: the line and the rope shared no arithmetic, so on a short felt the
  // bottom-anchored line was drawn straight through the top-anchored rope. They
  // are now one stack with one source of truth: the rope keeps its slot under
  // the board — that is the law finding 2 exists for — and his line takes the
  // gap ABOVE it, but only when the gap is genuinely big enough to hold it.
  //
  // At the expanded detent it is not: 64px of board ends at `board + 64` and
  // the rope starts at `meta`, twelve pixels later. Rather than overlap, or
  // shove the board around and lose the detent geometry this file exists to
  // preserve, the line is simply not drawn there — it is still in the sheet's
  // peek row and in the thread, which is where long voice lives anyway.
  // The squeeze scales the three tops toward the floor independently, so on some
  // stages it pulled the rope's slot ABOVE the board's bottom edge — the board
  // drawn straight through the rope. Whatever the squeeze decided, the rope sits
  // under the board; if that leaves it inside the hero row, the board and the
  // pot give way, because the rope's position is the law and theirs is not.
  var tug = Math.max(meta, board + 64 + LINE_GAP);
  var overflow = (tug + TUG_H) - (felt - HERO_BAND);
  if (overflow > 0) {
    // On a felt this short the seat band is the least load-bearing thing on it,
    // so the board is allowed to climb past it rather than let the rope run
    // into the hero row. Below roughly 210px of felt there is no arrangement
    // that fits, and this is the one that degrades most quietly.
    var lift = Math.min(overflow, Math.max(0, board));
    board -= lift;
    pot = Math.max(0, pot - lift);
    tug -= lift;
  }

  var boardBottom = board + 64;
  var room = tug - boardBottom;
  var line = room >= LINE_H + LINE_GAP * 2 ? Math.round(boardBottom + LINE_GAP) : null;

  return {
    felt:  felt,
    pot:   Math.round(pot),
    board: Math.round(board),
    tug:   Math.round(tug),
    line:  line,
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

// W3-1: PaceFelt. The felt is now told which of the four pacing states it is in
// and dresses itself accordingly — warm ground and a fat ticker while a pot is
// heating, a breathing red glow on an all-in, the ticker sliding away on a
// showdown. CALM is the felt that shipped, unchanged.
// R-2 exports this: the replay theatre plays the same felt, driven by an
// authored timeline instead of by the server. Reuse, not a second felt — the
// pacing states, the rope and the hero row are all here already.
export function WatchFelt({ game, mySeat, lastDecision, handEquity, flipped, line, geom, selectedSeat, onSelectSeat, bubbles = [] }) {
  var pace = paceOf(game);
  var pMeta = paceMeta(game);
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

  // ── W4-1 · the DEAL beat ─────────────────────────────────────────────────
  // The hand is dealt, not shown. His two cards land 90ms apart, each with its
  // own light tap, then the table's backs sweep out as one gesture with no
  // haptic — their cards are not his event.
  //
  // Keyed on the hand number, so a re-render, a reconnect or a late snapshot
  // cannot re-deal a hand that is already on the table.
  var handNo = game ? game.handNumber : null;
  var dealRef = useRef({ hand: null, t0: 0 });
  var [dealT, setDealT] = useState(DEAL_TOTAL_MS);

  useEffect(function() {
    if (!live || !isNewDeal(handNo, dealRef.current.hand)) return undefined;
    dealRef.current = { hand: handNo, t0: Date.now() };
    setDealT(0);

    var timers = [
      setTimeout(function() { setDealT(CARD_GAP_MS); fireHaptic('cardDealt'); }, CARD_GAP_MS),
      setTimeout(function() { setDealT(CARD_GAP_MS * 2); fireHaptic('cardDealt'); }, CARD_GAP_MS * 2),
      setTimeout(function() { setDealT(DEAL_TOTAL_MS); }, BACKS_DELAY_MS),
    ];
    return function() { timers.forEach(clearTimeout); };
  }, [handNo, live]);

  var beat = live ? dealBeat(dealT) : { landed: 2, backs: true };
  var heroLanded = between ? 2 : beat.landed;
  // Owner-only by construction: warming needs heroHole, which the server only
  // ships to a viewer who proved ownership. A spectator gets no glow, no tap.
  var warm = live && isWarm(heroHole, heroEquityOf(game, handEquity, heroSeat));

  var boardSlots = community.map(pc);
  while (boardSlots.length < 5) boardSlots.push(null);

  // How many board cards are face up right now. (`flipped`, not `revealed` —
  // that name already belongs to the showdown's per-seat reveal map below.)
  var landed = landedCount(game, flipped);

  // The rope's far end is labelled with whoever is still contesting the pot;
  // with more than one live opponent it stays unlabelled rather than picking a
  // favourite. The owner is watching his agent, not refereeing.
  var liveOpponents = (game && game.seats ? game.seats : [])
    .map(function(seat, i) { return { seat: seat, i: i }; })
    .filter(function(x) { return x.i !== heroSeat && x.seat && !x.seat.folded; });
  var villainName = liveOpponents.length === 1
    ? (liveOpponents[0].seat.displayName || ('Seat ' + (liveOpponents[0].i + 1)))
    : null;

  // FIX-1g held the last decision's equity so the readout never dashed while he
  // was on the clock. W3-1 adds the better source in front of it: feature/pace
  // puts hero equity on every snapshot, which is what finding 2 needs for the
  // rope to move on every street rather than only when he acts.
  var heroEquity  = between ? null : heroEquityOf(game, handEquity, heroSeat);
  var hasEquity   = heroEquity !== null;
  // At showdown the readout stops reporting the hero's last action and says
  // how the hand ended -- the ref's `note` slot.
  // FIX-1f moved the price out of the deleted meta line and into the action
  // chip. W3-1 gives it its own column in the hero row (HeroRow3), which is
  // where the ref puts it, so the chip goes back to naming the action alone.
  var toCall = (live && heroData && game.currentBet != null)
    ? Math.max(0, game.currentBet - (heroData.contribThisStreet || 0))
    : 0;
  var toActLabel = (game && game.toAct === heroSeat && live) ? 'TO ACT' : null;
  var actionLabel = settled ? null : (lastDecision && lastDecision.action
    ? formatAction(lastDecision.action)
    : toActLabel);

  // Opponents in seat order clockwise from the hero, so the ring on screen
  // matches the order the action actually moves in.
  var opponentSeats = [];
  for (var step = 1; step < seatCount; step++) {
    var si = (heroSeat + step) % seatCount;
    var s = game && game.seats ? game.seats[si] : null;
    if (!s) continue;
    opponentSeats.push({
      seat: si,
      // accentColor is served per seat; mood is NOT on the wire yet, so every
      // opponent stands neutral until it is. The posture slot is here so the
      // day it ships nothing else has to move.
      accent: s.accentColor || '#00D4AA',
      mood: s.mood || 'neutral',
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

  var blinds = (game && game.smallBlind != null && game.bigBlind != null)
    ? ('$' + game.smallBlind + '/$' + game.bigBlind)
    : '';
  var tableLabel = '#' + (game && game.tableId ? game.tableId : '--');
  // FIX-1f: the felt no longer carries a meta line during a hand. It had grown
  // to "#tbl · $10/$20 · PREFLOP · 2-HANDED · TO CALL $40" — five facts, four of
  // them already on screen: the board shows the street, the seat ring shows how
  // many are in, and the amount belongs in the readout. Between hands the line
  // stays, because that is the ref's calm state and there is no board to read.
  var metaLine = between
    ? [tableLabel, blinds, 'SHUFFLING'].filter(Boolean).join(' · ')
    : null;

  // WV2-3: the felt's height and its three interior tops come from the sheet's
  // current detent, so it grows and shrinks with the drag.
  var feltStyle = geom ? {
    height: geom.felt + 'px',
    '--wv-pot':   geom.pot + 'px',
    '--wv-board': geom.board + 'px',
    // FIX-3a: one stack, one source of truth. The rope's top, and his line's
    // top when the geometry says there is room for one.
    '--wv-tug':   geom.tug + 'px',
    '--wv-line':  (geom.line == null ? 0 : geom.line) + 'px',
    '--wv-hero-band': HERO_BAND + 'px',
  } : undefined;

  return (
    <div className={'watch-felt' + (metaLine ? ' watch-felt--metaline' : '')}
      style={feltStyle} data-pace={pace}>
      {pMeta.glow > 0 && <div className="watch-felt__glow" />}
      <div className="watch-felt__arc" />

      {opponentSeats.slice(0, slots.length).map(function(o, i) {
        var slot    = slots[i];
        var align   = alignFor(slot);
        var compact = compactFor(slot, opponentSeats.length);
        var showCards = !!o.reveal;
        var showBacks = live ? !o.folded : (settled && !showCards);
        return (
          <div key={i} className={'watch-felt__seat watch-felt__seat--' + slot}>
            {/* W4-2: he is somebody sitting there, not a chip with a number on
                it. Same FloorGhost the casino floor draws, same accent, so a
                House regular looks the same at the felt as in the room. */}
            <SeatGhost
              name={o.name}
              stack={o.stack}
              accent={o.accent}
              mood={o.mood}
              folded={o.folded}
              acting={o.acting}
              selected={selectedSeat === o.seat}
              dealt={beat.backs}
              reveal={!!o.reveal}
              show={o.reveal}
              side={slot === 'left' || slot === 'right'}
              order={i}
              size={compact ? 30 : 34}
              onSelect={function() { onSelectSeat(o.seat); }}
            />
            {o.bet && (
              <div className="watch-felt__seat-row">
                <BetPill amount={o.bet} />
              </div>
            )}
          </div>
        );
      })}

      {/* W4-3 · speech. At most two on the felt, one per seat, and a bubble
          that would be cut off is not shown at all — the record has it either
          way. His is centred in the band above the hero row; an opponent's
          sits over their own ghost, and its tail points back at them. */}
      {bubbles.map(function(b) {
        if (b.mine) {
          return (
            <div key={b.id} className="watch-felt__band">
              <Bubble mine flow text={b.text} />
            </div>
          );
        }
        var idx = opponentSeats.findIndex(function(o) { return o.seat === b.seat; });
        if (idx < 0) return null;
        return (
          <div key={b.id} className={'watch-felt__bubble watch-felt__bubble--' + slots[idx]}>
            <Bubble text={b.text} at={0} w={142} flow />
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

      {/* W3-1: `landed` is how many cards have been turned over. Off a showdown
          that is simply how many the server has dealt; on one the parent walks
          it up a card at a time and the newest slot animates in. */}
      <div className={'watch-felt__board' + (between ? ' is-between' : '')}>
        {boardSlots.map(function(c, i) {
          var isLanding = pace === 'showdown' && i === landed - 1;
          var cls = 'watch-felt__card' + (isLanding ? ' watch-felt__card--landing' : '');
          return (
            <div key={i} className={cls}>
              {(c && i < landed)
                ? <PlayingCard rank={c[0]} suit={c[1]} w={46} h={64} />
                : <CardBack w={46} h={64} branded />}
            </div>
          );
        })}
      </div>

      {/* The rope — finding 2. It takes the slot the table-id meta line used to
          hold, which is exactly "directly under the board". */}
      <div className="watch-felt__tug">
        <TugBar equity={heroEquity} villain={villainName} big={pMeta.heat} dead={!hasEquity} />
      </div>

      {/* W4-3: there is no line under the board any more. The felt is where
          speech happens — as bubbles over whoever is speaking — and the TABLE
          tab is where speech is kept. The height that line held goes back to
          the felt. */}

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
        metaLine && <div className="watch-felt__street">{metaLine}</div>
      )}

      <div className={'watch-felt__hero' + (actionLabel ? ' is-active' : '') + (warm ? ' is-warm' : '')}>
        <div className="watch-felt__hero-cards">
          {(heroHole || [null, null]).map(function(c, i) {
            // W4-1: each card slides in from the right and lands. `landed` is
            // the beat's own count, so card two is never on the felt before
            // card one — "never simultaneous" is a layout fact, not a timing hope.
            var down = i < heroLanded;
            return (
              <div
                key={i}
                className={'watch-felt__hero-card' + (down ? ' is-down' : '')}
                data-landed={down ? 'yes' : 'no'}
                style={{ transform: 'rotate(' + (i ? 3 : -3) + 'deg) translateX(' + (down ? 0 : 34) + 'px)' }}
              >
                {(c && !between)
                  ? <PlayingCard rank={c[0]} suit={c[1]} w={36} h={50} />
                  : <CardBack w={36} h={50} branded />}
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

        {/* W3-1 HeroRow3: equity has moved to the rope under the board, so this
            column now carries the two facts the removed meta line was holding —
            the street, or the price when there is one to pay. */}
        <div>
          <span className="watch-felt__hero-lbl">{toCall > 0 ? 'To call' : 'Street'}</span>
          <div>
            <span className={'watch-felt__hero-num ' + (toCall > 0 ? 'is-gold' : 'is-dim')}>
              {toCall > 0 ? '$' + toCall.toLocaleString() : (street || '—')}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {warm && !actionLabel && <span className="watch-felt__premium">PREMIUM</span>}
        {actionLabel
          ? <span className="watch-felt__action-chip">{actionLabel}</span>
          : (!warm && <span className="watch-felt__waiting">{heroNote}</span>)}
        {pace === 'allin' && !settled && (
          <span className="watch-felt__hero-tag">HOLDING</span>
        )}
      </div>
    </div>
  );
}

// ---- SitOutStrip / SitOutSheet ---------------------------------------------

function SitOutStrip({ visible, onRequest, cause }) {
  return (
    <div className={'watch-sitout-strip' + (visible ? '' : ' is-hidden')} aria-hidden={!visible}>
      <div className="watch-sitout-strip__text">
        <div className="watch-sitout-strip__title">Between hands</div>
        {/* FIX-3c: the collapsed header has no room for his cause line, and
            between hands is when there is time to read it anyway. */}
        <div className="watch-sitout-strip__meta">{cause || 'READY FOR NEXT DEAL'}</div>
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
// W3-2 (Tabs3): four tabs were three too many. LIVE ANALYSIS, RANGE and HISTORY
// are gone — the first was the solver speaking over him, the other two never
// had content — and READ and CHAT remain.

// W4-2: READ is gone. A read was never a tab — it is about ONE person, and the
// way you ask for it is to tap them. The rows moved into ReadSheet, which opens
// over the felt on a seat tap. CHAT stays, and W4-4 renames it TABLE.
var TABS = ['Chat'];
var TAB_CHAT = 0;

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

// W4-2: one seat's read out of the served `state.reads` array, and the facts
// the sheet's header needs about that seat. Both return null rather than guess,
// so a seat the server has no read for opens a sheet that says so.
function readFor(game, seat) {
  var list = (game && Array.isArray(game.reads)) ? game.reads : null;
  if (!list) return null;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].seat === seat) return list[i];
  }
  return null;
}

function seatSummary(game, seat) {
  var s = (game && game.seats) ? game.seats[seat] : null;
  if (!s) return null;
  return {
    name: s.displayName || ('Seat ' + (seat + 1)),
    stack: s.stack != null ? s.stack.toLocaleString() : null,
    accent: s.accentColor || '#00D4AA',
    mood: s.mood || 'neutral',
  };
}

// ---- WatchScreen (export) --------------------------------------------------

export function WatchScreen({
  game, mySeat, lastDecision, chatMessages, sendChat, displayNames,
  onLeave, onSitOut, config,
  // W4-5: where "Chat" goes. When the shell can route to his thread it hands
  // this in and the control leaves the watch screen entirely; without it the
  // conversation stays in the sheet, which is the only behaviour that existed
  // before. Optional on purpose — WatchScreen is mounted from more than one
  // place and must not require a router.
  onOpenThread,
  // W3-5/W3-6: the newest PACE frame, { pace, potBb, board?, card? }. During a
  // spectator-only all-in hold the server stages the runout card by card;
  // without it the flip falls back to the client's own timer.
  paceFrame,
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

  // ---- Agent mood polling (for the collapsed header) ----
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

  // ---- Append-only decision feed (Bug-5 fix) ----
  var [decisionFeed, setDecisionFeed] = useState([]);
  var feedIdRef      = useRef(0);
  var handNumberRef  = useRef(null);
  var streetRef      = useRef('');

  // FIX-1g: the hero's last known equity for the hand in progress. Decisions
  // arrive one at a time and the readout has to say something in between, so
  // the newest number is held until the next deal replaces it. Derived from
  // props on every render and idempotent, so it is safe to keep in a ref.
  var handEquityRef = useRef({ hand: null, equity: null });
  var currentHand   = game ? game.handNumber : null;
  if (handEquityRef.current.hand !== currentHand) {
    handEquityRef.current = { hand: currentHand, equity: null };
  }
  if (lastDecision && equityPct(lastDecision.equity) !== null) {
    handEquityRef.current.equity = lastDecision.equity;
  }
  var handEquity = handEquityRef.current.equity;

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
  // W4-3 keeps the seat: it is what puts the bubble over the right ghost.
  var tableSpeech = chatMessages.filter(function(m) { return m.isAI; })
    .map(function(m) { return { text: m.text, t: m.t || 0, seat: m.seat }; });

  // ── W4-3 · everything said at this table, in order ──────────────────────
  // One stream, two consumers: the felt takes what fits and is still fresh,
  // the TABLE tab takes all of it. They are allowed to disagree — that is the
  // last clause of the bubble law.
  var [said, setSaid] = useState([]);
  var saidIdRef = useRef(0);

  // His decision line. DECISION carries the seat it came from, so a table where
  // both seats think out loud cannot attribute one to the other.
  useEffect(function() {
    if (!lastDecision || !lastDecision.reasoning) return;
    var seat = Number.isInteger(lastDecision.seat) ? lastDecision.seat : mySeat;
    setSaid(function(prev) {
      var last = prev[prev.length - 1];
      if (last && last.mine && last.text === lastDecision.reasoning) return prev;
      return prev.concat([{
        id: 'd' + (++saidIdRef.current),
        seat: seat,
        text: lastDecision.reasoning,
        mine: seat === mySeat,
        at: Date.now(),
      }]);
    });
  }, [lastDecision, mySeat]);

  // Table talk. chatMessages is append-only, so the count is the cursor.
  var talkSeenRef = useRef(0);
  useEffect(function() {
    var fresh = tableSpeech.slice(talkSeenRef.current);
    if (fresh.length === 0) return;
    talkSeenRef.current = tableSpeech.length;
    setSaid(function(prev) {
      return prev.concat(fresh.map(function(m) {
        return {
          id: 't' + (++saidIdRef.current),
          seat: Number.isInteger(m.seat) ? m.seat : null,
          text: m.text,
          mine: Number.isInteger(m.seat) && m.seat === mySeat,
          at: m.t || Date.now(),
        };
      }));
    });
  }, [tableSpeech.length]);

  // A bubble is 3–4 seconds, so the felt has to re-read the clock even when
  // nothing new is said — otherwise the last one would sit there for ever.
  var [bubbleTick, setBubbleTick] = useState(0);
  useEffect(function() {
    if (said.length === 0) return undefined;
    var id = setInterval(function() { setBubbleTick(function(n) { return n + 1; }); }, 500);
    return function() { clearInterval(id); };
  }, [said.length]);

  var bubbles = onFelt(said, Date.now());
  var tableRecord = record(said);

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
  var pace = paceOf(game);

  // The showdown runout, one card at a time.
  //
  // W3-5: the server stages it. During a spectator-only all-in hold each PACE
  // message carries the board as it stands, so the frame — not a local clock —
  // says what is face up, and every watcher sees the same card at the same
  // moment. The timer below is the fallback for a server that is not staging,
  // and it is not started when a frame is present.
  // W3-6: an explicit prop wins; otherwise useTable has merged the frame onto
  // the view model, so the felt follows the server without every container in
  // between forwarding a prop.
  var frame = paceFrame || (game ? game.paceFrame : null);
  var staged = stagedCount(frame);
  var [flipped, setFlipped] = useState(null);
  var dealtCount = (game && game.community) ? game.community.length : 0;
  useEffect(function() {
    if (staged != null) return undefined;               // the server is driving
    if (pace !== 'showdown') { setFlipped(null); return undefined; }
    setFlipped(0);
    var n = 0;
    var id = setInterval(function() {
      n += 1;
      setFlipped(n);
      if (n >= dealtCount) clearInterval(id);
    }, FLIP_MS);
    return function() { clearInterval(id); };
  }, [staged != null, pace, dealtCount, game && game.handNumber]);

  var faceUp = staged != null ? staged : flipped;

  // His one line on the felt: the newest decision's reasoning, in his voice.
  // Finding 3 — long voice lives in the thread, the felt gets one sentence.
  var feltLine = (lastDecision && lastDecision.reasoning) ? lastDecision.reasoning : null;

  // ---- W3-3: the beats -----------------------------------------------------
  // One entry per row of the ww-ref's haptics table, fired from the state the
  // server put us in. Every rule the table sets — his events only, never two
  // inside 120ms, nothing while backgrounded — is enforced inside lib/haptics,
  // so these are plain "this happened" calls.

  // Climbing the ladder. Latched per hand: HEATING taps once and never repeats,
  // and stepping back down (a new hand) re-arms it.
  var paceSeenRef = useRef({ hand: null, seen: {} });
  useEffect(function() {
    var hand = game ? game.handNumber : null;
    if (paceSeenRef.current.hand !== hand) paceSeenRef.current = { hand: hand, seen: {} };
    if (pace === 'calm' || paceSeenRef.current.seen[pace]) return;
    paceSeenRef.current.seen[pace] = true;
    if (pace === 'heating') beat('heating', fireHaptic);
    else if (pace === 'allin') beat('allin', fireHaptic);
  }, [pace, game && game.handNumber]);

  // His action posting. Only ever his: lastDecision is the hero's decision, and
  // an opponent's action must never reach the device.
  useEffect(function() {
    if (!lastDecision) return;
    beat('hisAction', fireHaptic);
  }, [lastDecision]);

  // Each card of the runout, during the hold.
  useEffect(function() {
    if (pace !== 'showdown' || !faceUp) return;
    beat('runoutCard', fireHaptic);
  }, [pace, faceUp]);

  // The pot, once it is settled. Winning is a notification; losing is quiet.
  var resultSeenRef = useRef(null);
  useEffect(function() {
    var result = game && game.result ? game.result : null;
    var hand = game ? game.handNumber : null;
    if (!result || resultSeenRef.current === hand) return;
    resultSeenRef.current = hand;
    var heroSeat = Number.isInteger(mySeat) ? mySeat : 0;
    var won = !!(result.winners || []).some(function(w) { return w.seat === heroSeat; });
    beat(won ? 'wonPot' : 'lostPot', fireHaptic);
  }, [game && game.handNumber, game && game.result, mySeat]);

  // ---- W3-4: the prediction beat -------------------------------------------
  // Off unless the ap_predict flag says otherwise. The pick locks the moment he
  // acts and settles against what he actually did; the streak lives in memory
  // for as long as the tab does and is never written down.
  var predictOn = predictEnabled();
  var [pick, setPick] = useState(null);
  var settledForRef = useRef(null);

  useEffect(function() {
    if (!predictOn || !lastDecision) return;
    if (settledForRef.current === lastDecision) return;
    settledForRef.current = lastDecision;
    if (!pick || pick.locked) return;
    var outcome = settle(pick.guess, lastDecision.action);
    if (outcome.right === null) return;      // a spot the chips could not express
    setPick({ guess: pick.guess, locked: true, right: outcome.right, streak: outcome.streak });
    if (outcome.right) beat('predictionRight', fireHaptic);
  }, [predictOn, lastDecision, pick]);

  // A new hand clears the board for the next guess.
  useEffect(function() {
    if (predictOn) setPick(null);
  }, [predictOn, game && game.handNumber]);

  // A read forming. The panel animates; the device only nudges.
  //
  // W3-5: there is no `forming` flag on the wire — the server stops sending a
  // READ once nothing has changed — so the event is this opponent's `formed`
  // going true, which is what the panel watches for too.
  var formedRef = useRef(new Map());
  var shownRead = pickOpponent(game && game.reads, game);
  var shownWho = shownRead ? shownRead.playerId : null;
  var shownFormed = !!(shownRead && shownRead.formed);
  useEffect(function() {
    if (!shownWho) return;
    var before = formedRef.current.get(shownWho);
    formedRef.current.set(shownWho, shownFormed);
    if (before === false && shownFormed) beat('readForms', fireHaptic);
  }, [shownWho, shownFormed]);

  // WV2-3: the sheet owns the vertical layout of the whole screen.
  // W4-5: one decision, both entry points. The header button and the sheet's
  // own CHAT tab are the same control and must not disagree about where
  // talking to him happens.
  var openChat = useCallback(function() {
    if (onOpenThread) { onOpenThread(); return; }
    setActiveTab(TAB_CHAT);
  }, [onOpenThread]);

  // W4-2: which seat's read is open, by seat index. Null is the felt with
  // nothing over it.
  var [selectedSeat, setSelectedSeat] = useState(null);
  var toggleSeat = useCallback(function(seat) {
    setSelectedSeat(function(prev) {
      if (prev !== seat) fireHaptic('readForms');
      return prev === seat ? null : seat;
    });
  }, []);

  var sheet     = useSheetDrag({
    onSelectTab: function(i) {
      if (i === TAB_CHAT) { openChat(); return; }
      setActiveTab(i);
    },
  });

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

      {/* FIX-3c: on the watch screen the mood band collapses into the header —
          one 40px row carrying back, his name, his mood, whether he is at a
          table, and the way into the chat. The band's ghost and its 56px are
          the felt's now. His cause line is not lost: it moves to the
          between-hands strip, which is the moment there is room to read it. */}
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
        <MoodChip mood={mood} small />
        <StateTag state={state} compact />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="watch-screen__chat"
          onClick={openChat}
        >Chat</button>
      </div>

      <div className={'watch-stage' + (sheet.dragging ? ' is-dragging' : '')}
        ref={sheet.stageRef}>
        {selectedSeat != null && (
          <ReadSheet
            entry={readFor(game, selectedSeat)}
            seat={seatSummary(game, selectedSeat)}
            onClose={function() { setSelectedSeat(null); }}
          />
        )}

        <WatchFelt selectedSeat={selectedSeat} onSelectSeat={toggleSeat}
          game={game} mySeat={mySeat} lastDecision={lastDecision}
          handEquity={handEquity} flipped={faceUp} line={feltLine} geom={sheet.geom}
          bubbles={bubbles} />

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
            cause={cause}
            onRequest={function() { setSitOutPending(true); }}
          />

          <div key="grab-tabs" className="watch-sheet__grab" hidden={hidden} {...sheet.handlers}>
            <WatchTabs active={activeTab} />
          </div>

          {sheet.detent === 'peek' && (
            <div className="watch-sheet__peek">
              {/* W3-2: no "waiting for first action" anywhere. The peek either
                  has his line or it has nothing to say and stays quiet. */}
              {peekLine && <span className="watch-sheet__peek-line">{peekLine}</span>}
              {peekEquity && <span className="watch-sheet__peek-eq">{peekEquity}</span>}
            </div>
          )}

          {sheet.detent === 'expanded' && (
            <div className="watch-panel">
              {/* W4-2: the READ tab is gone — a read is about one person and you
                  ask for it by tapping them, so the rows live in ReadSheet now.
                  These three were only ever sharing that tab with the reads and
                  are not reads themselves, so they stay in the panel rather than
                  being deleted with it. v4 gives none of them a home of its own;
                  they want a decision, not a silent removal. */}
              {predictOn && (
                <PredictBeat
                  picked={pick ? pick.guess : null}
                  locked={!!(pick && pick.locked)}
                  right={pick ? pick.right : undefined}
                  streak={pick && pick.locked ? pick.streak : getStreak()}
                  onPick={function(guess) { setPick({ guess: guess, locked: false }); }}
                />
              )}
              {between && agent && agent.recentHands && agent.recentHands[0] && (
                <RiverAttrPanel agent={agent} hand={agent.recentHands[0]} />
              )}
              <MuteToggle />
              {activeTab === TAB_CHAT && (
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
