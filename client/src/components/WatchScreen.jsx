// WatchScreen — WATCH v6.
// Ported from design-refs/mood-watch5.jsx (layout), design-refs/mood-watch4c.jsx
// (glass material and the ceremony) and design-refs/mood-atoms.jsx (GLASS
// tokens, the faces and the hands).
//
// What changed, and why:
//   1. HE IS SEATED AT THE BOTTOM. v4b put him in a hero row — a strip of chrome
//      at the foot of the felt — which made the one character you own the least
//      present thing on his own table. He now faces the viewer at the bottom
//      edge at twice an opponent's size, cards face up in front of him, bubble
//      above his head, rope and strip directly under him.
//   2. THE FELT IS THE SCREEN. Header → felt → composer, and nothing else. The
//      TABLE tab, the transcript strip and the three-detent sheet are gone; the
//      felt never resizes, because resizing was the tell that a sheet was a
//      different screen rather than a layer.
//   3. CHAT IS A WHISPER. What you send rises from the bottom edge as a pale
//      bubble and fades in four seconds. His reply is his normal bubble.
//   4. HISTORY IS A LAYER. The thread — and an opponent's read — come over the
//      lower 70% of the felt in the same glass, with the game still running
//      behind them.
//
// WATCH-5's pacing queue, fold toss and ceremony timing are untouched; only
// their markup is replaced.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodChip, StateTag } from './floor/atoms.jsx';
import { BetPill } from './system/SeatChip.jsx';
import { PlayingCard, CardBack } from './system/PlayingCard.jsx';
import { moodOf, causeOf, stateOf } from './floor/agentView.js';
import { Streets } from '../lib/protocol.js';
import { TugBar } from './system/TugBar.jsx';
import { SeatGhost } from './system/SeatGhost.jsx';
import { ReadSheet } from './system/ReadSheet.jsx';
import { Bubble } from './system/Bubble.jsx';
import { MoodGhost } from './system/MoodGhost.jsx';
import { WatchHero, heroPose, betBand } from './system/WatchHero.jsx';
import { ThreadSheet } from './system/ThreadSheet.jsx';
import { Whisper, WhisperComposer, WHISPER_MS } from './system/Whisper.jsx';
import { onFelt, record } from '../lib/bubbles.js';
import { fire as fireHaptic } from '../lib/haptics.js';
import { beat, isMuted, toggleMuted } from '../lib/audio.js';
import { PredictBeat } from './system/PredictBeat.jsx';
import { predictEnabled, settle, getStreak } from '../lib/predict.js';
import {
  paceOf, paceMeta, heroEquityOf, landedCount, stagedCount, FLIP_MS,
  SHOWDOWN_HOLD_MS, CEREMONY_MS,
} from '../lib/pace.js';
import { dealBeat, isWarm, isNewDeal, DEAL_TOTAL_MS, CARD_GAP_MS, BACKS_DELAY_MS } from '../lib/deal.js';
import { pickOpponent } from '../lib/reads.js';
import { attrCostOf } from '../lib/attributes.js';

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

function posLabel(seat, game) {
  if (!game) return '';
  if (game.bigBlindSeat === seat)   return 'BB';
  if (game.smallBlindSeat === seat) return 'SB';
  if (game.dealerSeat === seat)     return 'BTN';
  return '';
}

// ---- MuteToggle ------------------------------------------------------------
// W3-3: sound is a second layer to the haptics, and it has to be switchable —
// the phone is on silent in a bar, and every beat is built to land on haptics
// alone.
//
// WATCH-6: the felt is the screen, so the switch moved into the thread sheet's
// head. It is still one tap from anywhere on the watch screen, and it is no
// longer a grey row on a green table.

export function MuteToggle() {
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

// ---- the felt's fixed geometry (the replay theatre's seam) ------------------
// WATCH-6 deletes the three-detent sheet from the watch screen: the felt fills
// header→composer and never resizes. The REPLAY THEATRE still draws a felt of a
// measured height, with a scrubber and a panel below it, so the geometry the
// sheet used to drive lives on here for that one caller. Nothing on the watch
// screen reads it any more.
//
// SHEET_LAY, verbatim from design-refs/mood-watch2.jsx: the felt's height at
// each detent, and the absolute tops of the pot ticker, the board and the meta
// line inside it.
var SHEET_LAY = {
  expanded: { felt: 306, pot: 60,  board: 108, meta: 184 },
  peek:     { felt: 508, pot: 128, board: 196, meta: 286 },
  hidden:   { felt: 620, pot: 168, board: 244, meta: 336 },
};

var DETENTS = ['expanded', 'peek', 'hidden'];

var SHEET_REGION = SHEET_LAY.hidden.felt + 19;

var FELT_FRAC = DETENTS.map(function(d) { return SHEET_LAY[d].felt / SHEET_REGION; });

var INNER_FRAC = DETENTS.map(function(d) {
  var L = SHEET_LAY[d];
  return { pot: L.pot / L.felt, board: L.board / L.felt, meta: L.meta / L.felt };
});

function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
function lerp(a, b, t) { return a + (b - a) * t; }

function detentPos(frac) {
  if (frac <= FELT_FRAC[0]) return 0;
  if (frac >= FELT_FRAC[2]) return 2;
  var i = frac <= FELT_FRAC[1] ? 0 : 1;
  return i + (frac - FELT_FRAC[i]) / (FELT_FRAC[i + 1] - FELT_FRAC[i]);
}

var HERO_BAND = 78;   // the compact hero row's height plus its 12px bottom offset
var TUG_H     = 30;   // the rope: 9px track + 4px gap + its legend
var SEAT_BAND = 44;   // the seat chips own the top of the felt
var LINE_H    = 19;   // his line at 13px/1.4
var LINE_GAP  = 8;    // and the air it needs on each side

export function feltGeometry(frac, stagePx) {
  var p    = detentPos(frac);
  var i    = clamp(Math.floor(p), 0, 1);
  var t    = clamp(p - i, 0, 1);
  var felt = Math.round(frac * stagePx);
  var a = INNER_FRAC[i], b = INNER_FRAC[i + 1];

  var meta  = lerp(a.meta,  b.meta,  t) * felt;
  var board = lerp(a.board, b.board, t) * felt;
  var pot   = lerp(a.pot,   b.pot,   t) * felt;

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

  var tug = Math.max(meta, board + 64 + LINE_GAP);
  var overflow = (tug + TUG_H) - (felt - HERO_BAND);
  if (overflow > 0) {
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

// ---- seat ring -------------------------------------------------------------
// WV2-4, per design-refs/mood-watch2.jsx (PART 2 · MULTIWAY). The engine seats
// 2..6, so the ring holds one to five opponents with the hero anchored at the
// bottom. Slots come into play in the order the brief sets -- top corners,
// then top centre, then the side rails.
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

function compactFor(slot, opponentCount) {
  return slot === 'ml' || slot === 'mr' || opponentCount >= 5;
}

// ---- W5-2 · the muck -------------------------------------------------------
// "folds don't feel like anything." They didn't: a seat's backs were rendered
// on `!folded`, so the instant the server said folded the cards ceased to have
// existed and the ghost dimmed. Nobody threw anything away.
//
// An opponent's cards are thrown at the muck — one fixed spot beside the pot,
// per OppMuckStripM in design-refs/mood-watch5.jsx, so a table of six folds
// resolves to one pile instead of six directions — and the seat dims only once
// they have landed. His own toss keeps the 350ms hero arc.

export var MUCK_MS = 350;

var NO_MUCK = {};

export function useMuck(game) {
  var handNo = game ? game.handNumber : null;
  var seats  = (game && game.seats) ? game.seats : [];
  var foldKey = seats.map(function (s) { return (s && s.folded) ? '1' : '0'; }).join('');

  var [mucking, setMucking] = useState(NO_MUCK);
  var prevRef   = useRef({ hand: null, key: '' });
  var timersRef = useRef([]);

  useEffect(function () {
    var prev = prevRef.current;
    prevRef.current = { hand: handNo, key: foldKey };

    if (prev.hand !== handNo) { setMucking(NO_MUCK); return undefined; }

    var fresh = [];
    for (var i = 0; i < foldKey.length; i++) {
      if (foldKey[i] === '1' && prev.key[i] !== '1') fresh.push(i);
    }
    if (fresh.length === 0) return undefined;

    setMucking(function (m) {
      var next = Object.assign({}, m);
      fresh.forEach(function (i) { next[i] = true; });
      return next;
    });
    var t = setTimeout(function () {
      setMucking(function (m) {
        var next = Object.assign({}, m);
        fresh.forEach(function (i) { delete next[i]; });
        return next;
      });
    }, MUCK_MS);
    timersRef.current.push(t);
    return undefined;
  }, [handNo, foldKey]);

  useEffect(function () {
    return function () {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  return mucking;
}

// ---- the hand-end ceremony -------------------------------------------------
// W5-3 called the hand; WATCH-6 gives it the ref's own block (V5Ceremony).
//
// "Granite took $1,250" tells the owner what happened to the pot; it does not
// tell him what happened to his guy. So the ceremony leads with the DELTA and
// where he now stands, and offers the two things there are to do: deal him in
// now (the next hand is coming in three seconds anyway, so this only makes it
// now), or talk to him about the hand.
//
// WHEN it runs is still lib/pace.js's business — SHOWDOWN_HOLD_MS then
// CEREMONY_MS — which WATCH-5 settled and this wave does not touch.
export function HandCeremony({
  won, agentName, amount, winnerName, delta, stack, mood, heat, accent,
  onTalk, talkLabel, onDeal, nextInS,
}) {
  var hot = Number.isFinite(heat) && heat > 66;
  var money = function (n) {
    var sign = n < 0 ? '−' : '+';
    return sign + '$' + Math.abs(n).toLocaleString();
  };
  var deltaText = Number.isFinite(delta)
    ? money(delta)
    : (won ? '+$' + (amount || 0).toLocaleString() : '−$' + (amount || 0).toLocaleString());

  return (
    <div className="watch-ceremony" data-outcome={won ? 'won' : 'lost'}
      data-heat={hot ? 'hot' : 'calm'} role="status">
      <div className="watch-ceremony__block">
        <div className="watch-ceremony__name">{(agentName || 'YOUR AGENT').toUpperCase()}</div>
        <div className="watch-ceremony__head">{won ? 'WON' : 'LOST'}</div>

        {/* THE DELTA AND WHERE HE STANDS. */}
        <div className="watch-ceremony__delta">
          <span className={'watch-ceremony__delta-amt' + (won ? ' is-won' : ' is-lost')}>{deltaText}</span>
          <span className="watch-ceremony__dot">·</span>
          <span className="watch-ceremony__stack-lbl">stack</span>
          <span className="watch-ceremony__stack">
            {'$' + (Number.isFinite(stack) ? stack.toLocaleString() : '—')}
          </span>
        </div>
        {!won && winnerName && (
          <div className="watch-ceremony__took">{winnerName.toUpperCase() + ' TOOK THE POT'}</div>
        )}

        <div className="watch-ceremony__ghost">
          <span className="watch-ceremony__aura" aria-hidden />
          <MoodGhost mood={mood || (won ? 'confident' : 'frustrated')}
            accent={accent || '#00D4AA'} size={76} heat={Number.isFinite(heat) ? heat : 45}
            event={won ? 'smug' : 'stunned'} hands="cover" won={won} ring={false} />
        </div>

        <div className="watch-ceremony__acts">
          <button type="button" className="watch-btn watch-btn--primary" onClick={onDeal}>
            Deal him in
          </button>
          {onTalk && (
            <button type="button" className="watch-btn watch-btn--ghost watch-ceremony__talk" onClick={onTalk}>
              {talkLabel}
            </button>
          )}
          <div className="watch-ceremony__next">
            {'NEXT HAND IN ' + (Number.isFinite(nextInS) ? nextInS : 3) + 's'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- the compact hero row (replay theatre only) ----------------------------
// The seated hero is a column ~200px tall. The replay theatre draws a 306px felt
// with a scrubber and a panel under it, so it keeps the row v4b used. It is
// reached only through `geom`, which nothing on the watch screen passes.
function HeroRow({ hole, landed, between, mucking, stack, pos, street, toCall, action, warm, note, tag }) {
  return (
    <div className={'watch-felt__hero is-row' + (action ? ' is-active' : '') + (warm ? ' is-warm' : '')}>
      <div className="watch-felt__hero-cards">
        {(hole || [null, null]).map(function(c, i) {
          var down = i < landed;
          return (
            <div key={i}
              className={'watch-felt__hero-card' + (down ? ' is-down' : '') + (mucking ? ' is-mucking' : '')}
              data-landed={down ? 'yes' : 'no'} data-mucking={mucking ? 'yes' : 'no'}
              style={{
                transform: 'rotate(' + (i ? 3 : -3) + 'deg) translateX(' + (down ? 0 : 34) + 'px)',
                '--muck-base': 'rotate(' + (i ? 3 : -3) + 'deg)',
                '--muck-turn': (i ? 22 : -18) + 'deg',
              }}
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
          <span className="watch-felt__hero-num">{stack}</span>
          <span className="watch-felt__hero-pos">{pos}</span>
        </div>
      </div>
      <div className="watch-felt__hero-divider" />
      <div>
        <span className="watch-felt__hero-lbl">{toCall > 0 ? 'To call' : 'Street'}</span>
        <div>
          <span className={'watch-felt__hero-num ' + (toCall > 0 ? 'is-gold' : 'is-dim')}>
            {toCall > 0 ? '$' + toCall.toLocaleString() : (street || '—')}
          </span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {warm && !action && <span className="watch-felt__premium">PREMIUM</span>}
      {action
        ? <span className="watch-felt__action-chip">{action}</span>
        : (!warm && <span className="watch-felt__waiting">{note}</span>)}
      {tag && <span className="watch-felt__hero-tag">{tag}</span>}
    </div>
  );
}

// ---- WatchFelt -------------------------------------------------------------
//
// W3-1: the felt is told which of the four pacing states it is in and dresses
// itself accordingly. WATCH-6 changes what is drawn on it, not that.
//
// `geom` is the replay theatre's seam: with it the felt takes a measured height
// and the interior tops the sheet used to drive. Without it — the watch screen —
// the felt FILLS its parent and the interior tops are proportions of it, because
// the felt never resizes any more.
export function WatchFelt({
  game, mySeat, lastDecision, handEquity, flipped, line, geom, selectedSeat, onSelectSeat,
  bubbles = [], ceremony = null, cost = null, overlay = null, whispers = [], onTapHero,
  agentMood, agentHeat, agentAccent,
}) {
  var pace = paceOf(game);
  var pMeta = paceMeta(game);
  var live      = handActive(game);
  var settled   = !live && handSettled(game);
  var between   = !live && !settled;
  var street    = game ? (game.street || '').toUpperCase() : '';
  var pot       = game ? (game.pot || 0) : 0;
  var community = game ? (game.community || []) : [];
  var result    = settled ? game.result : null;

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
  // The hand is dealt, not shown. His two cards land 90ms apart and the table's
  // backs then sweep out as one gesture with no haptic — their cards are not
  // his event. Keyed on the hand number, so a re-render, a reconnect or a late
  // snapshot cannot re-deal a hand that is already on the table.
  var handNo = game ? game.handNumber : null;
  var dealRef = useRef({ hand: null, t0: 0 });
  var [dealT, setDealT] = useState(DEAL_TOTAL_MS);

  useEffect(function() {
    if (!live || !isNewDeal(handNo, dealRef.current.hand)) return undefined;
    dealRef.current = { hand: handNo, t0: Date.now() };
    setDealT(0);

    var timers = [
      setTimeout(function() { setDealT(CARD_GAP_MS); fireHaptic('cardDealt'); }, CARD_GAP_MS),
      setTimeout(function() { setDealT(CARD_GAP_MS * 2); }, CARD_GAP_MS * 2),
      setTimeout(function() { setDealT(DEAL_TOTAL_MS); }, BACKS_DELAY_MS),
    ];
    // Torn down mid-deal, the beat gives the hand back. Without this the ref
    // outlived the timers it was guarding: React's development double-invoke
    // cancelled the run, the second pass saw a hand it had already claimed and
    // skipped it, and his cards stayed at `landed: 0` — face down, at opacity
    // zero, for the whole hand. Playwright, 390x844: no hole cards on the felt.
    return function() {
      timers.forEach(clearTimeout);
      dealRef.current = { hand: null, t0: 0 };
    };
  }, [handNo, live]);

  var mucking = useMuck(game);

  var beatNow = live ? dealBeat(dealT) : { landed: 2, backs: true };
  var heroLanded = between ? 2 : beatNow.landed;
  var warm = live && isWarm(heroHole, heroEquityOf(game, handEquity, heroSeat));

  var boardSlots = community.map(pc);
  while (boardSlots.length < 5) boardSlots.push(null);

  var landed = landedCount(game, flipped);

  var liveOpponents = (game && game.seats ? game.seats : [])
    .map(function(seat, i) { return { seat: seat, i: i }; })
    .filter(function(x) { return x.i !== heroSeat && x.seat && !x.seat.folded; });
  var villainName = liveOpponents.length === 1
    ? (liveOpponents[0].seat.displayName || ('Seat ' + (liveOpponents[0].i + 1)))
    : null;

  var heroEquity  = between ? null : heroEquityOf(game, handEquity, heroSeat);
  var hasEquity   = heroEquity !== null;
  var toCall = (live && heroData && game.currentBet != null)
    ? Math.max(0, game.currentBet - (heroData.contribThisStreet || 0))
    : 0;
  var toActLabel = (game && game.toAct === heroSeat && live) ? 'TO ACT' : null;
  var actionLabel = settled ? null : (lastDecision && lastDecision.action
    ? formatAction(lastDecision.action)
    : toActLabel);

  var opponentSeats = [];
  for (var step = 1; step < seatCount; step++) {
    var si = (heroSeat + step) % seatCount;
    var s = game && game.seats ? game.seats[si] : null;
    if (!s) continue;
    opponentSeats.push({
      seat: si,
      accent: s.accentColor || '#00D4AA',
      mood: moodStateOf(s),
      heat: moodHeatOf(s),
      name: s.displayName || ('Seat ' + (si + 1)),
      stack: s.stack ? s.stack.toLocaleString() : '0',
      pos: posLabel(si, game),
      acting: game.toAct === si,
      folded: !!s.folded,
      dealer: game.dealerSeat === si,
      bet: (live && s.contribThisStreet > 0) ? s.contribThisStreet.toLocaleString() : null,
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
  var metaLine = between
    ? [tableLabel, blinds, 'SHUFFLING'].filter(Boolean).join(' · ')
    : null;

  // With `geom` the felt is a measured box (the replay theatre). Without it the
  // felt fills the stage and its interior tops are the ref's own proportions of
  // V5_FELT_H: the pot at 196/648 and the board at 243/648.
  var feltStyle = geom ? {
    height: geom.felt + 'px',
    '--wv-pot':   geom.pot + 'px',
    '--wv-board': geom.board + 'px',
    '--wv-tug':   geom.tug + 'px',
    '--wv-line':  (geom.line == null ? 0 : geom.line) + 'px',
    '--wv-hero-band': HERO_BAND + 'px',
  } : undefined;

  var heroStack = '$' + (heroData && heroData.stack != null ? heroData.stack.toLocaleString() : '--');
  var heroMuck  = !!mucking[heroSeat];
  var mine = bubbles.filter(function(b) { return b.mine; });
  var heroSays = mine.length ? mine[mine.length - 1].text : null;

  return (
    <div className={'watch-felt' + (geom ? ' watch-felt--boxed' : ' watch-felt--fill')
        + (metaLine ? ' watch-felt--metaline' : '')}
      style={feltStyle} data-pace={pace}>
      {pMeta.glow > 0 && <div className="watch-felt__glow" />}
      <div className="watch-felt__arc" />

      {opponentSeats.slice(0, slots.length).map(function(o, i) {
        var slot    = slots[i];
        var compact = compactFor(slot, opponentSeats.length);
        return (
          <div key={i} className={'watch-felt__seat watch-felt__seat--' + slot}
            data-align={alignFor(slot)}>
            <SeatGhost
              name={o.name}
              stack={o.stack}
              accent={o.accent}
              mood={o.mood}
              folded={o.folded}
              acting={o.acting}
              selected={selectedSeat === o.seat}
              mucking={!!mucking[o.seat]}
              dealt={beatNow.backs}
              reveal={!!o.reveal}
              show={o.reveal}
              side={slot === 'ml' || slot === 'mr'}
              order={i}
              size={compact ? 30 : 34}
              onSelect={function() { if (onSelectSeat) onSelectSeat(o.seat); }}
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
          way. HIS is now part of the hero column below (above his head, so it
          moves him rather than landing on him); an opponent's sits over their
          own ghost and its tail points back at them. */}
      {bubbles.filter(function(b) { return !b.mine; }).map(function(b) {
        var idx = opponentSeats.findIndex(function(o) { return o.seat === b.seat; });
        if (idx < 0) return null;
        return (
          <div key={b.id} className={'watch-felt__bubble watch-felt__bubble--' + slots[idx]}>
            <Bubble text={b.text} at={0} w={142} flow />
          </div>
        );
      })}

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
          var isLanding = pace === 'showdown' && i === landed - 1;
          var cls = 'watch-felt__card' + (isLanding ? ' watch-felt__card--landing' : '');
          return (
            <div key={i} className={cls}>
              {(c && i < landed)
                ? <PlayingCard rank={c[0]} suit={c[1]} w={geom ? 46 : 44} h={geom ? 64 : 61} />
                : <CardBack w={geom ? 46 : 44} h={geom ? 64 : 61} branded />}
            </div>
          );
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
        metaLine && <div className="watch-felt__street">{metaLine}</div>
      )}

      {geom ? (
        <>
          {/* The rope keeps its own slot on a boxed felt, because the compact
              hero row has nowhere to carry it. */}
          <div className="watch-felt__tug">
            <TugBar equity={heroEquity} villain={villainName} big={pMeta.heat} dead={!hasEquity} />
          </div>
          {/* W4-3: no line under the board. The felt is where speech happens —
              as bubbles over whoever is speaking — and the thread is where
              speech is kept. `line` is still accepted so the replay theatre's
              call site does not have to change; it draws it in its own panel. */}
          <HeroRow
            hole={heroHole} landed={heroLanded} between={between} mucking={heroMuck}
            stack={heroStack} pos={posLabel(heroSeat, game)} street={street}
            toCall={toCall} action={actionLabel} warm={warm} note={heroNote}
            tag={pace === 'allin' && !settled ? 'HOLDING' : null}
          />
        </>
      ) : (
        <WatchHero
          says={heroSays}
          mood={agentMood || 'neutral'}
          accent={agentAccent || '#00D4AA'}
          heat={Number.isFinite(agentHeat) ? agentHeat : 45}
          pose={heroPose({
            between: between,
            action: lastDecision ? lastDecision.action : null,
            pace: pace,
            heat: agentHeat,
            mucking: heroMuck,
          })}
          bet={betBand(lastDecision && lastDecision.action ? lastDecision.action.amount : null, pot)}
          hole={heroHole}
          landed={heroLanded}
          mucking={heroMuck}
          between={between}
          equity={heroEquity}
          villain={villainName}
          bigRope={pMeta.heat}
          deadRope={!hasEquity}
          stack={heroStack}
          pos={posLabel(heroSeat, game)}
          street={street}
          toCall={toCall}
          action={actionLabel}
          tag={pace === 'allin' && !settled ? 'HOLDING' : null}
          warm={warm}
          // "waiting for the deal" is a between-hands line. On the v4b row it
          // was small and off to one side; in his strip it is the loudest thing
          // he owns, and printing it over a live preflop hand reads as him not
          // being in it. While the hand is live the strip says nothing there —
          // TO ACT and his action chip are the live registers.
          note={live ? null : heroNote}
          cost={cost}
          onTapFace={onTapHero}
        />
      )}

      {/* A sent whisper: pale, small, rising from the bottom edge, gone in 4s. */}
      {whispers.map(function(w) { return <Whisper key={w.id} text={w.text} />; })}

      {/* The thread, or an opponent's read — the same glass over the lower 70%,
          with the hand still playing behind it. The felt does not resize. */}
      {overlay}

      {/* W5-3: the hand is called. Last in the felt so it is over everything. */}
      {ceremony}
    </div>
  );
}

// ---- SitOutSheet -----------------------------------------------------------

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

// ---- SitOutStrip -----------------------------------------------------------
// WATCH-6: the strip is no longer a grey row under the felt — there is nothing
// under the felt. It is the thread sheet's footer, which is where the owner
// already is when he is between hands and thinking about pulling him out.

function SitOutStrip({ visible, onRequest, cause }) {
  return (
    <div className={'watch-sitout-strip' + (visible ? '' : ' is-hidden')} aria-hidden={!visible}>
      <div className="watch-sitout-strip__text">
        <div className="watch-sitout-strip__title">Between hands</div>
        <div className="watch-sitout-strip__meta">{cause || 'READY FOR NEXT DEAL'}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button type="button" className="watch-sitout-strip__btn" onClick={onRequest} tabIndex={visible ? 0 : -1}>
        Sit out after this hand
      </button>
    </div>
  );
}

// CLEAN-1 (HAPTIC4): the reveal's own interval — "one per revealing seat, in
// seat order, 140ms apart". It is the one number in the table deliberately set
// above the 120ms floor, so it is what the reveal tap waits for.
var REVEAL_TAP_MS = 140;

// W4-2: one seat's read out of the served `state.reads` array, and the facts
// the sheet's header needs about that seat.
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
    mood: moodStateOf(s),
    heat: moodHeatOf(s),
  };
}

// SEAT-1a: the server sends `mood: { state, heat }`. Both readers go through
// here so there is one place that knows the shape — and one place that keeps
// accepting the bare string the field used to be.
function moodStateOf(seat) {
  var m = seat && seat.mood;
  if (typeof m === 'string') return m || 'neutral';
  return (m && m.state) || 'neutral';
}

function moodHeatOf(seat) {
  var m = seat && seat.mood;
  return (m && typeof m === 'object' && Number.isFinite(m.heat)) ? m.heat : null;
}

// ---- WatchScreen (export) --------------------------------------------------

export function WatchScreen({
  game, mySeat, lastDecision, chatMessages, sendChat, displayNames,
  onLeave, onSitOut, config,
  onOpenThread,
  paceFrame,
  paceLag,
}) {
  if (!chatMessages)  chatMessages  = [];
  if (!sendChat)      sendChat      = function() {};
  if (!displayNames)  displayNames  = {};

  var [sitOutPending, setSitOutPending] = useState(false);
  var [agent,         setAgent]         = useState(null);

  // ---- Owner↔agent DM thread (PORT-6) ----
  var [agentThread,   setAgentThread]   = useState([]);
  var [agentLoading,  setAgentLoading]  = useState(false);

  // ---- Agent mood polling (the header chip, and now his face on the felt) ----
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
  // His own seat carries the mood the server computed for this table; the agent
  // record is the fallback for the moment before the first snapshot lands.
  var heroSeatIdx = Number.isInteger(mySeat) ? mySeat : 0;
  var heroSeatRow = (game && game.seats) ? game.seats[heroSeatIdx] : null;
  var heroMood = heroSeatRow ? moodStateOf(heroSeatRow) : mood;
  var heroHeat = heroSeatRow && Number.isFinite(moodHeatOf(heroSeatRow))
    ? moodHeatOf(heroSeatRow) : 45;
  var heroAccent = (heroSeatRow && heroSeatRow.accentColor) || '#00D4AA';

  // FIX-1g: the hero's last known equity for the hand in progress.
  var handEquityRef = useRef({ hand: null, equity: null });
  var currentHand   = game ? game.handNumber : null;
  if (handEquityRef.current.hand !== currentHand) {
    handEquityRef.current = { hand: currentHand, equity: null };
  }
  if (lastDecision && equityPct(lastDecision.equity) !== null) {
    handEquityRef.current.equity = lastDecision.equity;
  }
  var handEquity = handEquityRef.current.equity;

  // AI trash-talk from the WS — the felt takes what fits, the thread takes all.
  var tableSpeech = chatMessages.filter(function(m) { return m.isAI; })
    .map(function(m) { return { text: m.text, t: m.t || 0, seat: m.seat }; });

  // ── W4-3 · everything said at this table, in order ──────────────────────
  var [said, setSaid] = useState([]);
  var saidIdRef = useRef(0);

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
  // nothing new is said.
  var [bubbleTick, setBubbleTick] = useState(0);
  useEffect(function() {
    if (said.length === 0) return undefined;
    var id = setInterval(function() { setBubbleTick(function(n) { return n + 1; }); }, 500);
    return function() { clearInterval(id); };
  }, [said.length]);

  var bubbles = onFelt(said, Date.now());
  var tableRecord = record(said);

  // ── WATCH-6 · the whisper ───────────────────────────────────────────────
  // What you send him is not a row in a log. It rises from the bottom edge as a
  // pale bubble and is gone in four seconds; his reply is his own bubble, over
  // his head. Both are still kept, in the thread.
  var [whispers, setWhispers] = useState([]);
  var whisperIdRef = useRef(0);
  var whisperTimers = useRef([]);
  useEffect(function() {
    return function() { whisperTimers.current.forEach(clearTimeout); };
  }, []);

  function sendToAgent(text) {
    var now = Date.now();
    var id = 'w' + (++whisperIdRef.current);
    setWhispers(function(prev) { return prev.concat([{ id: id, text: text }]); });
    whisperTimers.current.push(setTimeout(function() {
      setWhispers(function(prev) { return prev.filter(function(w) { return w.id !== id; }); });
    }, WHISPER_MS));

    if (!agentId || agentLoading) return;
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

  // ── W5-3 · the hand-end ceremony ────────────────────────────────────────
  // The showdown is held for SHOWDOWN_HOLD_MS so the reveal can be read, then
  // the hand is called for CEREMONY_MS. Latched per hand.
  var [ceremonyHand, setCeremonyHand] = useState(null);
  var ceremonySeenRef = useRef(null);
  var settledNow = handSettled(game);
  var settledHand = game ? game.handNumber : null;
  useEffect(function () {
    if (!settledNow) { setCeremonyHand(null); return undefined; }
    if (ceremonySeenRef.current === settledHand) return undefined;
    ceremonySeenRef.current = settledHand;
    var open  = setTimeout(function () { setCeremonyHand(settledHand); }, SHOWDOWN_HOLD_MS);
    var close = setTimeout(function () { setCeremonyHand(null); }, SHOWDOWN_HOLD_MS + CEREMONY_MS);
    return function () { clearTimeout(open); clearTimeout(close); };
  }, [settledNow, settledHand]);

  // WATCH-6: what the hand did to HIM. The wire carries the pot and who took it,
  // never a per-hand net for a seat, so the delta is the one thing the screen has
  // to work out for itself: his stack when the hand was dealt against his stack
  // now. Without a baseline (joining mid-hand) the ceremony falls back to the pot.
  var heroStackNow = heroSeatRow && Number.isFinite(heroSeatRow.stack) ? heroSeatRow.stack : null;
  var stackAtDealRef = useRef({ hand: null, stack: null });
  if (!settledNow && currentHand != null && stackAtDealRef.current.hand !== currentHand) {
    stackAtDealRef.current = { hand: currentHand, stack: heroStackNow };
  }
  var handDelta = (stackAtDealRef.current.hand === currentHand
    && Number.isFinite(stackAtDealRef.current.stack) && Number.isFinite(heroStackNow))
    ? heroStackNow - stackAtDealRef.current.stack
    : null;

  // ── W5-4 · "why the hand went wrong", pinned ────────────────────────────
  // Pinned under his strip: it survives the next deal and only stands down when
  // that hand reaches its flop, which is the first moment the owner is properly
  // watching something else. Then it becomes a TABLE entry in the thread.
  var lastPlayedHand = (agent && Array.isArray(agent.recentHands)) ? agent.recentHands[0] : null;
  var [attrPin, setAttrPin] = useState(null);          // { hand, atHand, at }
  var [attrRecord, setAttrRecord] = useState([]);      // collapsed, for the thread
  var attrIdRef = useRef(0);
  var liveHandNo = game ? game.handNumber : null;
  var liveHandRef = useRef(liveHandNo);
  liveHandRef.current = liveHandNo;

  useEffect(function () {
    if (!lastPlayedHand || !attrCostOf(lastPlayedHand)) return;
    setAttrPin(function (p) {
      if (p && p.hand === lastPlayedHand) return p;
      return { hand: lastPlayedHand, atHand: liveHandRef.current, at: Date.now() };
    });
  }, [lastPlayedHand]);

  var boardLen = (game && Array.isArray(game.community)) ? game.community.length : 0;
  useEffect(function () {
    if (!attrPin || attrPin.atHand == null || liveHandNo == null) return;
    if (liveHandNo <= attrPin.atHand || boardLen < 3) return;
    var cost = attrCostOf(attrPin.hand);
    setAttrRecord(function (r) {
      return r.concat([{
        id: 'a' + (++attrIdRef.current),
        handNumber: attrPin.atHand,
        key: cost ? cost.key : null,
        street: cost ? cost.street : null,
        line: cost ? cost.line : null,
        t: attrPin.at,
      }]);
    });
    setAttrPin(null);
  }, [attrPin, liveHandNo, boardLen]);

  var pinnedCost = attrPin ? attrCostOf(attrPin.hand) : null;

  // The showdown runout, one card at a time.
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

  var feltLine = (lastDecision && lastDecision.reasoning) ? lastDecision.reasoning : null;

  // ---- W3-3: the beats -----------------------------------------------------

  var paceSeenRef = useRef({ hand: null, seen: {} });
  useEffect(function() {
    var hand = game ? game.handNumber : null;
    if (paceSeenRef.current.hand !== hand) paceSeenRef.current = { hand: hand, seen: {} };
    if (pace === 'calm' || paceSeenRef.current.seen[pace]) return;
    paceSeenRef.current.seen[pace] = true;
    if (pace === 'heating') beat('heating', fireHaptic);
    else if (pace === 'allin') beat('allin', fireHaptic);
  }, [pace, game && game.handNumber]);

  useEffect(function() {
    if (!lastDecision) return;
    beat('hisAction', fireHaptic);
  }, [lastDecision]);

  useEffect(function() {
    if (pace !== 'showdown' || !faceUp) return;
    beat('runoutCard', fireHaptic);
  }, [pace, faceUp]);

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

  var heroSeatNo = Number.isInteger(mySeat) ? mySeat : 0;
  var heroSeatData = game && game.seats ? game.seats[heroSeatNo] : null;
  var heroHoleCards = (heroSeatData && heroSeatData.holeCards)
    ? heroSeatData.holeCards.map(pc).filter(Boolean)
    : null;
  var isWarmNow = !between && isWarm(heroHoleCards, heroEquityOf(game, handEquity, heroSeatNo));
  var warmSeenRef = useRef(null);
  useEffect(function() {
    var hand = game ? game.handNumber : null;
    if (!isWarmNow || warmSeenRef.current === hand) return;
    warmSeenRef.current = hand;
    beat('heroCardWarms', fireHaptic);
  }, [isWarmNow, game && game.handNumber]);

  var newestBubbleId = bubbles.length ? bubbles[bubbles.length - 1].id : null;
  var bubbleSeenRef = useRef(newestBubbleId);
  useEffect(function() {
    if (!newestBubbleId || bubbleSeenRef.current === newestBubbleId) return;
    bubbleSeenRef.current = newestBubbleId;
    beat('bubbleAppears', fireHaptic);
  }, [newestBubbleId]);

  var revealSeenRef = useRef(null);
  var showdownSeats = (game && game.result && game.result.showdown) ? game.result.showdown.length : 0;
  useEffect(function() {
    var hand = game ? game.handNumber : null;
    if (showdownSeats === 0 || revealSeenRef.current === hand) return;
    revealSeenRef.current = hand;
    var id = setTimeout(function() { beat('showdownReveal', fireHaptic); }, REVEAL_TAP_MS);
    return function() { clearTimeout(id); };
  }, [showdownSeats, game && game.handNumber]);

  // ---- W3-4: the prediction beat -------------------------------------------
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

  useEffect(function() {
    if (predictOn) setPick(null);
  }, [predictOn, game && game.handNumber]);

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

  // ── WATCH-6 · one layer slot over the lower felt ────────────────────────
  // The thread and a read are the same gesture in the same glass: they occupy
  // the lower 70% of the felt, the game keeps running behind them, and opening
  // one closes the other. The felt itself never moves.
  var [selectedSeat, setSelectedSeat] = useState(null);
  var [threadOpen, setThreadOpen] = useState(false);

  var toggleSeat = useCallback(function(seat) {
    setThreadOpen(false);
    setSelectedSeat(function(prev) {
      if (prev !== seat) fireHaptic('readForms');
      return prev === seat ? null : seat;
    });
  }, []);

  var openChat = useCallback(function(ctx) {
    if (onOpenThread) { onOpenThread(ctx || null); return; }
    setSelectedSeat(null);
    setThreadOpen(true);
  }, [onOpenThread]);

  // ── the thread, in one ordered list ─────────────────────────────────────
  // HIM / YOU / TABLE, plus an opponent under their own name. Everything the
  // felt showed and everything it had to let go, in the order it happened.
  var threadRows = tableRecord.map(function(u) {
    var who = u.mine
      ? 'HIM'
      : (Number.isInteger(u.seat) && game && game.seats && game.seats[u.seat]
        ? (game.seats[u.seat].displayName || displayNames[u.seat] || 'TABLE')
        : 'TABLE').toUpperCase();
    return { id: u.id, who: who, text: u.text, t: u.at };
  })
    .concat(agentThread.map(function(m, i) {
      return { id: 'c' + i, who: m.role === 'user' ? 'YOU' : 'HIM', text: m.content, t: m.t };
    }))
    .concat(attrRecord.map(function(a) {
      return {
        id: a.id, who: 'TABLE', cost: true, t: a.t,
        text: [a.line, a.key].filter(Boolean).join(' · '),
      };
    }))
    .sort(function(a, b) { return (a.t || 0) - (b.t || 0); });

  function handleSitOutConfirm() {
    setSitOutPending(false);
    if (onSitOut) onSitOut();
    if (onLeave)  onLeave();
  }

  // W5-3/W5-5: the block that calls the hand, and the two taps it offers.
  var agentName = (config && config.displayName) ? config.displayName : null;
  var ceremonyNode = null;
  if (ceremonyHand != null && game && game.result) {
    var res = game.result;
    var heroIdx = Number.isInteger(mySeat) ? mySeat : 0;
    var champion = (res.winners && res.winners.length) ? res.winners[0] : null;
    var heroTook = !!(res.winners || []).some(function (w) { return w.seat === heroIdx; });
    var championName = (champion && game.seats && game.seats[champion.seat])
      ? (game.seats[champion.seat].displayName || ('Seat ' + (champion.seat + 1)))
      : null;
    ceremonyNode = (
      <HandCeremony
        won={heroTook}
        agentName={agentName}
        amount={res.pot || 0}
        delta={handDelta}
        stack={heroStackNow}
        winnerName={championName}
        mood={heroMood}
        heat={heroHeat}
        accent={heroAccent}
        talkLabel={'Talk to ' + (agentName || 'your agent') + ' about this hand'}
        onTalk={function () { openChat({ handId: ceremonyHand }); }}
        onDeal={function () { setCeremonyHand(null); }}
      />
    );
  }

  var overlay = null;
  if (selectedSeat != null) {
    overlay = (
      <ReadSheet
        entry={readFor(game, selectedSeat)}
        seat={seatSummary(game, selectedSeat)}
        onClose={function() { setSelectedSeat(null); }}
      />
    );
  } else if (threadOpen) {
    // Everything the felt has no room for lives in the sheet's own furniture:
    // the sound switch, the prediction beat behind its flag, and — between
    // hands — the way to pull him out. None of them is a grey panel on a green
    // table any more.
    overlay = (
      <ThreadSheet
        rows={threadRows}
        live={!between}
        pending={agentLoading}
        onClose={function() { setThreadOpen(false); }}
        head={<MuteToggle />}
        foot={(
          <>
            {predictOn && (
              <PredictBeat
                picked={pick ? pick.guess : null}
                locked={!!(pick && pick.locked)}
                right={pick ? pick.right : undefined}
                streak={pick && pick.locked ? pick.streak : getStreak()}
                onPick={function(guess) { setPick({ guess: guess, locked: false }); }}
              />
            )}
            <SitOutStrip
              visible={between}
              cause={cause}
              onRequest={function() { setSitOutPending(true); }}
            />
          </>
        )}
      />
    );
  }

  return (
    <div className="watch-screen"
      data-pace-lag={Number.isFinite(paceLag) ? Math.round(paceLag) : 0}>

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
          onClick={function() { openChat(); }}
        >Chat</button>
      </div>

      {/* THE FELT IS THE SCREEN: header → felt → composer, nothing between. */}
      <WatchFelt selectedSeat={selectedSeat} onSelectSeat={toggleSeat}
        game={game} mySeat={mySeat} lastDecision={lastDecision}
        handEquity={handEquity} flipped={faceUp} line={feltLine}
        agentMood={heroMood} agentHeat={heroHeat} agentAccent={heroAccent}
        cost={pinnedCost}
        whispers={whispers}
        onTapHero={function() { openChat(); }}
        overlay={overlay}
        // W5-3: no speech over the ceremony. For its three seconds the hand is
        // the only thing being said; the line is in the record either way.
        bubbles={ceremonyNode ? [] : bubbles} ceremony={ceremonyNode} />

      <WhisperComposer
        onSend={sendToAgent}
        onOpenThread={function() { openChat(); }}
        agentName={agentName}
      />

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
