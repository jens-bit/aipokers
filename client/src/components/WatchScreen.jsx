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
//
// WATCH-7, from the playtest:
//   5. A HAND END IS QUIET. The WON/LOST block used to take the felt at the end
//      of every hand, which made a SESSION moment fire forty times a session.
//      The pot slides, his stack ticks, a result toast comes and goes over his
//      strip, and nothing blocks the felt.
//   6. THE CEREMONY BELONGS TO SESSION_END. That is the one moment big enough
//      for it, and it offers the two things there are to do then — not "deal
//      him in", because there is no next hand.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { MoodChip, StateTag } from './floor/atoms.jsx';
import { ChipStack, BetSpot, PotChip, potBand, stackBand, SEAT_PILE_CHIPS } from './system/Chips.jsx';
import { Bottle, isDrinking } from './system/FeltBodyBars.jsx';
import { PlayingCard, CardBack } from './system/PlayingCard.jsx';
import { moodOf, causeOf, stateOf } from './floor/agentView.js';
import { Streets } from '../lib/protocol.js';
import { TugBar } from './system/TugBar.jsx';
import { SeatGhost } from './system/SeatGhost.jsx';
import { ReadSheet } from './system/ReadSheet.jsx';
import { Bubble } from './system/Bubble.jsx';
import { MoodGhost } from './system/MoodGhost.jsx';
import { GhostHandLayer } from './system/GhostHands.jsx';
import { WatchHero, heroPose, betBand } from './system/WatchHero.jsx';
import { OwnerHero } from './system/OwnerHero.jsx';
import { SitStrip } from './system/SitStrip.jsx';
import { ThreadSheet } from './system/ThreadSheet.jsx';
import { handResult } from '../lib/handResult.js';
// WATCH-10 job 4: ONE THOUSANDS SEPARATOR ON THE FELT. Every figure on this
// screen went through toLocaleString, which groups by the device's locale — so
// the same pot read "$4 180" in the pot pill and "$4,180" in the result pill
// three lines under it, on the same phone, in the same hand. money() groups by
// hand and always the same way; group() is money() without the dollar, for the
// figures beside chips that are already the currency.
import { money as potMoney, group as groupChips } from '../lib/wallet.js';
import { Whisper, WhisperComposer, WHISPER_MS } from './system/Whisper.jsx';
import { onFelt, record } from '../lib/bubbles.js';
import { sidesById } from '../lib/feltBubbles.js';
import { fire as fireHaptic } from '../lib/haptics.js';
import { beat, isMuted, toggleMuted } from '../lib/audio.js';
import { PredictBeat } from './system/PredictBeat.jsx';
import { predictEnabled, settle, getStreak } from '../lib/predict.js';
import { ResultToast } from './system/ResultToast.jsx';
import { handDelta as netForSeat, money } from '../lib/deltas.js';
import {
  paceOf, paceMeta, heroEquityOf, landedCount, stagedCount, FLIP_MS,
  RESULT_TOAST_MS, STACK_TICK_MS, timerLeft, timerOf,
} from '../lib/pace.js';
import { dealBeat, isWarm, isNewDeal, DEAL_TOTAL_MS, CARD_GAP_MS, BACKS_DELAY_MS } from '../lib/deal.js';
import { pickOpponent } from '../lib/reads.js';
import { attrCostOf } from '../lib/attributes.js';
import { mergeThread } from '../lib/thread.js';
import { useTableThread } from '../hooks/useTableThread.js';
import { faceOf, FACE_HOLD_MS } from '../lib/faces.js';

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
// HANDS-1 / 52i: "A seat folding is not the hero folding." 250ms rather than
// 350, a flatter arc, and it ends at the muck — one fixed spot beside the pot,
// so a table of six folds resolves to one pile instead of six directions.
export var OPP_MUCK_MS = 250;

var NO_MUCK = {};

export function useMuck(game, heroSeat) {
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
    // His throw and a seat's are two different gestures with two different
    // clocks, so they are cleared on two different timers rather than on the
    // longer of the pair.
    [[MUCK_MS, true], [OPP_MUCK_MS, false]].forEach(function (pair) {
      var group = fresh.filter(function (i) { return (i === heroSeat) === pair[1]; });
      if (!group.length) return;
      var t = setTimeout(function () {
        setMucking(function (m) {
          var next = Object.assign({}, m);
          group.forEach(function (i) { delete next[i]; });
          return next;
        });
      }, pair[0]);
      timersRef.current.push(t);
    });
    return undefined;
  }, [handNo, foldKey, heroSeat]);

  useEffect(function () {
    return function () {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  return mucking;
}

// ---- HANDS-1 · the sweep ---------------------------------------------------
// 52j, street end: "every spot moves at once, so the table resolves in one
// gesture." The engine clears contribThisStreet the instant a street advances,
// so the felt would simply lose four piles between frames. This holds the
// street that just closed for the length of the sweep and hands it back, and
// the pot's own chip gains a band as it lands.
export var SWEEP_MS = 320;

// "peek — one holds, one turns up at the near corner." A moment, not a state:
// he looks at what he was dealt and is holding again half a second later.
export var PEEK_HOLD_MS = 700;

export function useSweep(game) {
  var handNo = game ? game.handNumber : null;
  var street = game ? game.street : null;
  var seats  = (game && game.seats) ? game.seats : [];
  var betsKey = seats.map(function (x) { return (x && x.contribThisStreet) || 0; }).join(',');

  var [sweep, setSweep] = useState(null);
  var prevRef  = useRef({ hand: null, street: null, bets: '' });
  var timerRef = useRef(null);

  useEffect(function () {
    var prev = prevRef.current;
    prevRef.current = { hand: handNo, street: street, bets: betsKey };

    if (prev.hand !== handNo) { setSweep(null); return undefined; }
    if (prev.street === street) return undefined;

    var out = prev.bets.split(',')
      .map(function (n, i) { return Number(n) > 0 ? i : -1; })
      .filter(function (i) { return i >= 0; });
    if (!out.length) return undefined;

    setSweep({ street: prev.street, seats: out });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(function () { setSweep(null); }, SWEEP_MS);
    return undefined;
  }, [handNo, street, betsKey]);

  useEffect(function () {
    return function () { clearTimeout(timerRef.current); };
  }, []);

  return sweep;
}

// ---- SERVER-3 · a face is a MOMENT -----------------------------------------
// The decision triggers — dealtStrong, raisedAgainst, allIn — are things he is
// reacting to, and a reaction that stays up for the rest of the street stops
// being a reaction and becomes his resting face, which is the one job the mood
// system already has. So the trigger is held for FACE_HOLD_MS and then let go.
// The hand-end triggers are not held: they last exactly as long as the result
// they belong to is on the felt.
function useFaceDecision(lastDecision) {
  var [held, setHeld] = useState(lastDecision);

  useEffect(function () {
    setHeld(lastDecision);
    if (!lastDecision || !lastDecision.event) return undefined;
    var t = setTimeout(function () { setHeld(null); }, FACE_HOLD_MS);
    return function () { clearTimeout(t); };
  }, [lastDecision]);

  return held;
}

// ---- SERVER-3 · the clock the server is keeping ----------------------------
// state.actionTimer is { seat, deadlineTs, totalMs }. The ring counts that down
// rather than starting one of its own on arrival — which was off by the network
// and wrong again on a reconnect mid-think. No timer on the snapshot, no ring.
export function useActionTimer(game) {
  var at = game ? game.actionTimer : null;
  var deadline = at && Number.isFinite(at.deadlineTs) ? at.deadlineTs : null;
  var [, setTick] = useState(0);

  useEffect(function () {
    if (deadline == null) return undefined;
    var id = setInterval(function () { setTick(function (n) { return n + 1; }); }, 250);
    return function () { clearInterval(id); };
  }, [deadline]);

  if (!at) return null;
  var left = timerLeft(at, Date.now());
  var of   = timerOf(at);
  if (left == null || of == null) return null;
  return { seat: at.seat, left: left, of: of };
}

// ---- HANDS-1 · one fixed spot ----------------------------------------------
// The muck is ONE spot beside the pot and the pot is ONE pill, both centred on a
// felt whose width is not knowable from inside a seat (it is the viewport under
// 760 and capped above it). So the delta from each chair to the spot is
// measured, not guessed, and written inline — where it beats the per-slot
// fallbacks the stylesheet carries for the moment before layout.
function useFlyTo(rootRef, targets, deps) {
  useEffect(function () {
    var root = rootRef.current;
    if (!root || typeof root.querySelectorAll !== 'function') return;
    var flyers = root.querySelectorAll('[data-fly]');
    for (var i = 0; i < flyers.length; i++) {
      var el = flyers[i];
      var to = targets[el.getAttribute('data-fly')];
      if (!to || !to.current) continue;
      var a = el.getBoundingClientRect();
      var b = to.current.getBoundingClientRect();
      // jsdom measures nothing; the stylesheet's fallback stands.
      if (!a.width && !b.width) continue;
      var name = el.getAttribute('data-fly-var') || '--fly';
      el.style.setProperty(name + '-dx', Math.round((b.left + b.width / 2) - (a.left + a.width / 2)) + 'px');
      el.style.setProperty(name + '-dy', Math.round((b.top + b.height / 2) - (a.top + a.height / 2)) + 'px');
    }
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- the session ceremony --------------------------------------------------
// W5-3 gave this block to the end of every hand. WATCH-7's playtest killed that:
// a WON/LOST that size, forty times a session, stops meaning anything by the
// fifth hand and stands between the owner and the felt every time. A hand end is
// a receipt now (ResultToast).
//
// The ceremony is a SESSION moment, and it runs exactly once — when the session
// ends. That is the only point at which the two questions it asks are real ones,
// and it is why "Deal him in" is gone from it: there is no next hand to make
// happen sooner. What there is instead is where his money stands, and the two
// ways out of the evening.
//
//   BUSTED    "Fund him again"  ·  "Back to the floor"
//   OTHERWISE "Back to the floor"  ·  "Talk to him about tonight"
//
// It does not time out. A session ending is worth a tap.
export function SessionCeremony({
  won, busted, agentName, net, stack, hands, reason, mood, heat, accent,
  onFund, onFloor, onTalk, talkLabel,
  // WATCH-10 job 3 · the last hand, NAMED. lib/handResult.js's parts, exactly
  // as the felt's own result pill takes them, so the sentence the owner read a
  // beat ago on the felt is the sentence he reads here. Absent when the session
  // ended between hands, which is a thing that happens and is not a gap.
  handLine = null,
}) {
  var hot = Number.isFinite(heat) && heat > 66;
  var netText = money(net);

  return (
    <div className="watch-ceremony" data-outcome={won ? 'won' : 'lost'}
      data-heat={hot ? 'hot' : 'calm'} data-scope="session" role="status">
      <div className="watch-ceremony__block">
        {/* The scope is said in the small line, so the big word can stay the
            big word. WON here means the night, not the hand — the hand has not
            been announced like this since WATCH-7. */}
        <div className="watch-ceremony__name">
          {(agentName || 'YOUR AGENT').toUpperCase() + ' · TONIGHT'}
        </div>
        <div className="watch-ceremony__head">
          {busted ? 'BUSTED' : (won ? 'WON' : 'LOST')}
        </div>

        {/* WHERE HE STANDS AT THE END OF IT: the night's net against the buy-in,
            and what he is walking away with. */}
        <div className="watch-ceremony__delta">
          {netText && (
            <>
              <span className={'watch-ceremony__delta-amt' + (won ? ' is-won' : ' is-lost')}>{netText}</span>
              <span className="watch-ceremony__dot">·</span>
            </>
          )}
          <span className="watch-ceremony__stack-lbl">stack</span>
          <span className="watch-ceremony__stack">
            {potMoney(stack)}
          </span>
        </div>

        <div className="watch-ceremony__took">
          {[
            Number.isFinite(hands) && hands > 0
              ? (hands + ' HAND' + (hands === 1 ? '' : 'S'))
              : null,
            reason ? String(reason).toUpperCase() : null,
          ].filter(Boolean).join(' · ')}
        </div>

        {/* WATCH-10 job 3. The night's figure says how it went; this says how
            it ENDED, and it is the same sentence, from the same namer, as the
            felt's result pill — "Granite took $30 with a pair of nines". The
            ceremony is the one place an owner reads the evening back, and
            "LOST · 41 HANDS" with no last hand in it was a scoreboard. */}
        {handLine && (
          <div className="watch-ceremony__hand" aria-label={handLine.line}>
            <span className="watch-ceremony__hand-who">{handLine.who + ' took'}</span>
            <span className="watch-ceremony__hand-amt">{handLine.amount}</span>
            {handLine.tail
              ? <span className="watch-ceremony__hand-with">{handLine.tail}</span>
              : null}
          </div>
        )}

        {/* 52g / 52h — "the grammar of the pair reads at a glance: hands go UP
            AND OUT on a win, IN OVER THE FACE on a loss." The pose lives HERE
            and nowhere else: a hand end is quiet (WATCH-7), and both fists over
            his head forty times a session is the exact mistake that law fixed.
            The ceremony is the one moment big enough for it. */}
        <div className="watch-ceremony__ghost">
          <span className="watch-ceremony__aura" aria-hidden />
          <MoodGhost mood={mood || (won ? 'confident' : 'frustrated')}
            accent={accent || '#00D4AA'} size={76} heat={Number.isFinite(heat) ? heat : 45}
            event={won ? 'smug' : 'stunned'} ring={false} />
          <GhostHandLayer className="watch-ceremony__hands"
            pose={won ? 'raise' : 'cover'} size={76} />
        </div>

        {/* A busted agent has one thing he needs and it is not conversation. */}
        <div className="watch-ceremony__acts">
          {busted ? (
            <>
              <button type="button" className="watch-btn watch-btn--primary watch-ceremony__fund"
                onClick={onFund}>
                Fund him again
              </button>
              <button type="button" className="watch-btn watch-btn--ghost watch-ceremony__floor"
                onClick={onFloor}>
                Back to the floor
              </button>
            </>
          ) : (
            <>
              <button type="button" className="watch-btn watch-btn--primary watch-ceremony__floor"
                onClick={onFloor}>
                Back to the floor
              </button>
              <button type="button" className="watch-btn watch-btn--ghost watch-ceremony__talk"
                onClick={onTalk}>
                {talkLabel}
              </button>
            </>
          )}
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
            {toCall > 0 ? potMoney(toCall) : (street || '—')}
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
  agentMood, agentHeat, agentAccent, agentFatigue = null,
  // SIT-1: the owner is the one in the hero seat. Everything above the hero is
  // unchanged — same opponents, same board, same pot — and the bottom of the
  // axis becomes his cards and a YOU pill instead of a ghost he does not have.
  seated = false,
  // WATCH-7: the hand-end receipt, drawn over his strip rather than over the
  // felt, and the ticking stack number under it. Both are the watch screen's;
  // the replay theatre passes neither and is unchanged.
  toast = null, heroStackShown = null,
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
  // "peek — one holds, one turns up at the near corner: dealt, and once when
  // heat rises." It is a MOMENT: he looks, and then he is holding again.
  var [peeking, setPeeking] = useState(false);

  useEffect(function() {
    if (!live || !isNewDeal(handNo, dealRef.current.hand)) return undefined;
    dealRef.current = { hand: handNo, t0: Date.now() };
    setDealT(0);

    setPeeking(false);
    var timers = [
      setTimeout(function() { setDealT(CARD_GAP_MS); fireHaptic('cardDealt'); }, CARD_GAP_MS),
      setTimeout(function() { setDealT(CARD_GAP_MS * 2); setPeeking(true); }, CARD_GAP_MS * 2),
      setTimeout(function() { setDealT(DEAL_TOTAL_MS); }, BACKS_DELAY_MS),
      setTimeout(function() { setPeeking(false); }, DEAL_TOTAL_MS + PEEK_HOLD_MS),
    ];
    // Torn down mid-deal, the beat gives the hand back. Without this the ref
    // outlived the timers it was guarding: React's development double-invoke
    // cancelled the run, the second pass saw a hand it had already claimed and
    // skipped it, and his cards stayed at `landed: 0` — face down, at opacity
    // zero, for the whole hand. Playwright, 390x844: no hole cards on the felt.
    return function() {
      timers.forEach(clearTimeout);
      setPeeking(false);
      dealRef.current = { hand: null, t0: 0 };
    };
  }, [handNo, live]);

  var mucking = useMuck(game, heroSeat);
  var sweep   = useSweep(game);
  var clock   = useActionTimer(game);
  var faceDecision = useFaceDecision(lastDecision);

  // 52i: one fixed spot beside the pot, and one pile on it. The pairs that have
  // landed stay on the felt for the rest of the hand — a fold that dissolves
  // reads as a bug, so nothing here fades.
  var feltRef = useRef(null);
  var muckRef = useRef(null);
  var potRef  = useRef(null);

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

  // Every pile is a BAND, and a band is a ratio: what this seat has against what
  // the average seat has. That is what makes a short stack look short at $2/$4
  // and at $200/$400 without the felt ever being told the blinds.
  var allSeats = (game && game.seats) ? game.seats : [];
  var chipsAtTable = allSeats.reduce(function (t, x) { return t + ((x && x.stack) || 0); }, 0);
  var avgStack = allSeats.length ? chipsAtTable / allSeats.length : 0;

  var opponentSeats = [];
  for (var step = 1; step < seatCount; step++) {
    var si = (heroSeat + step) % seatCount;
    var s = game && game.seats ? game.seats[si] : null;
    if (!s) continue;
    var contrib = (s.contribThisStreet || 0);
    opponentSeats.push({
      seat: si,
      accent: s.accentColor || '#00D4AA',
      mood: moodStateOf(s),
      heat: moodHeatOf(s),
      // SERVER-3: the face he is pulling, from the trigger the server sent —
      // one name, one expression, whichever message carried it.
      event: faceOf(si, faceDecision, result),
      // WATCH-8 job 2: the body. `fatigue` is null for a seat with no agent
      // behind it; `drinking` is FRIDGE-1's, and may not be on the wire at all.
      fatigue: s.fatigue || null,
      drinking: isDrinking(s),
      name: s.displayName || ('Seat ' + (si + 1)),
      // Kept as a NUMBER. It used to be grouped here with toLocaleString(),
      // which groups by the device's locale — the same defect job 4 names on
      // the hero's pile, one line of the same felt away. Every surface below
      // formats it with lib/wallet's money().
      stack: Number.isFinite(s.stack) ? s.stack : 0,
      band: stackBand(s.stack || 0, avgStack),
      pos: posLabel(si, game),
      acting: game.toAct === si,
      folded: !!s.folded,
      dealer: game.dealerSeat === si,
      action: (lastDecision && lastDecision.seat === si) ? lastDecision.action : null,
      bet: (live && contrib > 0) ? contrib : 0,
      betBand: betBand(contrib, pot),
      sweeping: !!(sweep && sweep.seats.indexOf(si) >= 0),
      reveal: (settled && revealed[si] && revealed[si].length)
        ? revealed[si].map(pc).filter(Boolean)
        : null,
      mucked: settled && !revealed[si] && !!s.folded,
    });
  }
  var slots = slotsFor(opponentSeats.length);
  // WATCH-10 job 2: what lib/feltBubbles.js needs to model a name pill — a slot
  // and the name written in it. Nothing else about a seat has a box.
  var feltSeats = opponentSeats.slice(0, slots.length).map(function (o, i) {
    return { slot: slots[i], name: o.name };
  });

  // The pile on the muck: one pair per opponent who has thrown one away and had
  // it land. Capped at three — after that it is a pile, not a count.
  var muckedPairs = live
    ? opponentSeats.filter(function (o) { return o.folded && !mucking[o.seat]; }).length
    : 0;

  var heroWon    = !!(winner && winner.seat === heroSeat);
  var heroShowed = !!(result && revealed[heroSeat]);
  var heroNote   = !settled ? 'waiting for the deal'
    : heroWon    ? (winner.descr || 'won the pot')
    : heroShowed ? 'lost at showdown'
    : 'folded';

  var winnerName = (winner && game.seats && game.seats[winner.seat])
    ? (game.seats[winner.seat].displayName || ('Seat ' + (winner.seat + 1)))
    : null;

  // BUGS-A job 12. Built from the same board and the same showdown the felt is
  // drawing, so the sentence and the cards under it can never disagree.
  var handLine = result
    ? handResult(result, {
      seats: game.seats || [],
      community: community,
      // lib/wallet's formatter, not toLocaleString(). The machine's locale
      // decides what toLocaleString groups with, so on a Swedish phone the
      // same pot read "$4 180" here and "$4,180" three lines below it. One
      // screen, one separator — the law CasinoBuilding's count() already
      // states.
      money: potMoney,
    })
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

  var heroStackRaw = Number.isFinite(heroStackShown)
    ? heroStackShown
    : (heroData && heroData.stack != null ? heroData.stack : null);
  // WATCH-10 job 4. lib/wallet's money(), not toLocaleString(): the device's
  // locale decides what toLocaleString groups with, so his pile read "$1 847"
  // on a Swedish phone and "$1,847" in the pot pill two inches above it. One
  // screen, one separator — the law the pot line already follows, and the
  // reason lib/wallet.js does its own grouping. money() also answers an absent
  // stack with an em dash rather than the "$--" this used to print.
  var heroStack = potMoney(heroStackRaw);
  var heroMuck  = !!mucking[heroSeat];
  var mine = bubbles.filter(function(b) { return b.mine; });
  var heroSays = mine.length ? mine[mine.length - 1].text : null;

  // His chips, as objects on the felt. The pile is his stack, the spot is what
  // he has pushed out this street, and the sweep takes the spot to the pot.
  var heroContrib = (heroData && heroData.contribThisStreet) || 0;
  var heroBetOut  = live && heroContrib > 0;
  var heroSweeping = !!(sweep && sweep.seats.indexOf(heroSeat) >= 0);
  var heroFace = faceOf(heroSeat, faceDecision, result);
  // WATCH-8 job 2 · his body. Fatigue comes off his seat where the server puts
  // it; the agent record is the fallback for the moment before the first
  // snapshot lands, which is the same order his mood already resolves in.
  var heroFatigue = (heroData && heroData.fatigue) || agentFatigue || null;
  var heroDrinking = isDrinking(heroData);

  useFlyTo(feltRef, { muck: muckRef, pot: potRef },
    [mucking, sweep, slots.length, live, settled]);

  return (
    <div ref={feltRef}
      className={'watch-felt' + (geom ? ' watch-felt--boxed' : ' watch-felt--fill')
        + (metaLine ? ' watch-felt--metaline' : '')}
      style={feltStyle} data-pace={pace}>
      {pMeta.glow > 0 && <div className="watch-felt__glow" />}
      <div className="watch-felt__arc" />

      {opponentSeats.slice(0, slots.length).map(function(o, i) {
        var slot = slots[i];
        return (
          <div key={i} className={'watch-felt__seat watch-felt__seat--' + slot}
            data-align={alignFor(slot)}>
            {/* WATCH-10 job 1: on the felt his money IS his chips, and the
                figure stands beside them (the pile, below). The boxed felt has
                no room to bank a pile, so there the pill still carries it. */}
            <SeatGhost
              name={o.name}
              stack={geom ? potMoney(o.stack) : null}
              accent={o.accent}
              mood={o.mood}
              heat={Number.isFinite(o.heat) ? o.heat : 45}
              event={o.event}
              fatigue={o.fatigue}
              drinking={o.drinking}
              folded={o.folded}
              acting={o.acting}
              selected={selectedSeat === o.seat}
              mucking={!!mucking[o.seat]}
              dealt={beatNow.backs}
              dealer={o.dealer}
              action={o.action}
              reveal={!!o.reveal}
              show={o.reveal}
              side={slot === 'ml' || slot === 'mr'}
              order={i}
              timer={clock && clock.seat === o.seat ? clock.left : null}
              timerOf={clock && clock.seat === o.seat ? clock.of : 12}
              onSelect={function() { if (onSelectSeat) onSelectSeat(o.seat); }}
            />
            {/* His bank stands beside his name chip, on the felt side: top
                corners bank BELOW the pill, the rails bank BESIDE the body,
                inside. Never under the name — that was the pile-up 52m ends.

                WATCH-10 job 1: ONE STACK, WITH THE NUMBER BESIDE IT. A banded
                pile is up to ten chips tall, and five of them at the top of a
                390px felt was the densest thing on the table — a wall of
                counters standing in for money nobody could actually read. So
                the pile is capped at the top three chips of its band (the
                DENOMINATIONS still say big or small: three blacks is not three
                whites) and the figure it used to only imply is stated next to
                it. Same trade the hero's pile made when STACK left his strip,
                only the other way round: there the number followed the chips,
                here the chips stop pretending to be the number. */}
            {!geom && (
              <div className={'watch-felt__seat-pile' + (o.folded ? ' is-folded' : '')} aria-hidden>
                <ChipStack band={o.band} w={11} cap={SEAT_PILE_CHIPS}
                  className="is-seat" amt={potMoney(o.stack)} />
              </div>
            )}
            {/* And the bet spot in front of his pair. At street end it sweeps
                into the pot with every other spot — one gesture, not five. */}
            {!geom && (o.bet > 0 || o.sweeping) && (
              <div className={'watch-felt__seat-bet' + (o.sweeping ? ' is-sweeping' : '')}
                data-fly={o.sweeping ? 'pot' : null} data-fly-var="--sweep">
                <BetSpot band={o.betBand} w={12}
                  amt={o.bet > 0 ? groupChips(o.bet) : null} />
              </div>
            )}
          </div>
        );
      })}

      {/* W4-3 · speech. At most two on the felt, one per seat, and a bubble
          that would be cut off is not shown at all — the record has it either
          way. HIS is now part of the hero column below (above his head, so it
          moves him rather than landing on him); an opponent's sits in his
          slot's band and its tail points back at him.

          WATCH-10 job 2: WHICH WAY it opens is a placement decision now, not a
          fixed corner per slot. A bubble is up to 150px wide on a 390px felt,
          so tl pinned at left:6 ran to 156 and tc began at 120 — any two of the
          three top seats speaking at once drew one man's words over another's.
          lib/feltBubbles.js takes FIX-6's room rule (first side that is clear
          of the edge, of every name pill and of every bubble already placed)
          and gives it the felt's geometry. A bubble with no clear side is not
          drawn at all — which is this law's own last clause, applied to being
          cut off by a neighbour rather than by the edge. */}
      {(function () {
        var theirs = [];
        bubbles.forEach(function (b) {
          if (b.mine) return;
          var idx = opponentSeats.findIndex(function (o) { return o.seat === b.seat; });
          if (idx < 0 || idx >= slots.length) return;
          theirs.push({ id: b.id, text: b.text, slot: slots[idx] });
        });
        if (!theirs.length) return null;
        // Newest first, because "the newest win" is the law onFelt already
        // applies and place() fills in the order it is handed.
        var sides = sidesById(theirs.slice().reverse(), feltSeats);
        return theirs.map(function (b) {
          var side = sides.get(b.id);
          if (!side) return null;
          return (
            <div key={b.id}
              className={'watch-felt__bubble watch-felt__bubble--' + b.slot + ' is-' + side}>
              <Bubble text={b.text} side={side} flow />
            </div>
          );
        });
      })()}

      {!settled && (
        <div className="watch-felt__pot">
          <div className="watch-felt__pot-pill" ref={potRef}>
            <span className="watch-felt__pot-label">POT</span>
            {/* "The pot pill grows one step per band", so a table that has been
                betting big looks different from one that has been limping
                before you read a figure. */}
            {!between && <PotChip band={potBand(pot, game ? game.bigBlind : null)} w={13} />}
            <span className={'watch-felt__pot-amt' + (between ? ' is-between' : '')}>
              {between ? '—' : potMoney(pot)}
            </span>
          </div>
        </div>
      )}

      {/* THE MUCK: one fixed spot beside the pot. A table of six folds makes one
          pile instead of six directions, and it is face down at every frame. */}
      {!geom && (
        <div className="watch-felt__muck" ref={muckRef} aria-hidden>
          {Array.from({ length: Math.min(3, muckedPairs) }).map(function (_, i) {
            return (
              <span key={i} className="watch-felt__muck-pair">
                <CardBack w={13} h={18} /><CardBack w={13} h={18} />
              </span>
            );
          })}
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
          {/* BUGS-A job 12: the hand, named. "$30 → Granite" said how much and
              to whom and nothing about WHY, on a screen whose whole subject is
              watching somebody play poker. The felt already knows — the
              showdown reveals every contested seat — and it was throwing the
              answer away. See lib/handResult.js for where the name comes from
              and in what order. */}
          <div className="watch-felt__won">
            <div className="watch-felt__won-pill" aria-label={handLine ? handLine.line : undefined}>
              {handLine && <span className="watch-felt__won-to">{handLine.who + ' took'}</span>}
              <span className="watch-felt__won-amt">
                {potMoney(result.pot || 0)}
              </span>
              {handLine && handLine.tail
                ? <span className="watch-felt__won-with">{handLine.tail}</span>
                : null}
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
        <>
        {/* HIS CHIPS LIVE ON THE FELT, to his left, and the bet spot in front of
            his cards. STACK left the strip with them: the chips ARE the stack,
            so stating it there as well made the number the truth and the pile a
            decoration. The figure belongs under the pile it describes. */}
        <div className="watch-felt__hero-stack">
          <ChipStack band={stackBand(heroStackRaw || 0, avgStack)} w={26}
            label="STACK" amt={heroStack} />
          {/* FRIDGE-1: beside his stack, because that is what it cost him. */}
          {heroDrinking && (
            <span className="watch-felt__hero-bottle"><Bottle size={16} /></span>
          )}
        </div>
        {(heroBetOut || heroSweeping) && (
          <div className={'watch-felt__hero-bet' + (heroSweeping ? ' is-sweeping' : '')}>
            <span data-fly={heroSweeping ? 'pot' : null} data-fly-var="--sweep">
              <BetSpot band={betBand(heroContrib, pot)} w={22}
                amt={heroContrib > 0 ? groupChips(heroContrib) : null} />
            </span>
          </div>
        )}
        {seated ? (
        // SIT-1 · NO GHOST OF HIS OWN. A ghost is a character with a mood, a
        // face and a pair of hands; the owner has none of those and the product
        // has never drawn him. He gets the pill, the cards and the strip.
        <OwnerHero
          hole={heroHole}
          landed={heroLanded}
          mucking={heroMuck}
          between={between}
          equity={heroEquity}
          villain={villainName}
          bigRope={pMeta.heat}
          deadRope={!hasEquity}
          turn={!!(game && live && game.toAct === heroSeat)}
          street={street}
          pos={posLabel(heroSeat, game)}
          toCall={toCall}
          // SIT-1 · HIS OWN ACTION, NOT THE TABLE'S LAST ONE. `actionLabel`
          // takes whatever decision came last, which on the watch screen is the
          // agent whose felt it is and is therefore his. Here the hero seat is
          // the OWNER and the decisions on the wire are the agents' — so the
          // ghost's label would have printed The Grinder's fold on the owner's
          // own strip, over his own cards, while it was still his turn.
          action={(lastDecision && lastDecision.seat === heroSeat && lastDecision.action)
            ? formatAction(lastDecision.action)
            : toActLabel}
          tag={pace === 'allin' && !settled ? 'HOLDING' : null}
          warm={warm}
          note={live ? null : heroNote}
          timer={clock && clock.seat === heroSeat ? clock.left : null}
          timerOf={clock && clock.seat === heroSeat ? clock.of : 12}
          toast={toast}
        />
        ) : (
        <WatchHero
          says={heroSays}
          mood={agentMood || 'neutral'}
          accent={agentAccent || '#00D4AA'}
          heat={Number.isFinite(agentHeat) ? agentHeat : 45}
          event={heroFace}
          fatigue={heroFatigue}
          timer={clock && clock.seat === heroSeat ? clock.left : null}
          timerOf={clock && clock.seat === heroSeat ? clock.of : 12}
          pose={heroPose({
            between: between,
            action: lastDecision && lastDecision.seat === heroSeat ? lastDecision.action : null,
            pace: pace,
            heat: agentHeat,
            mucking: heroMuck,
            peeking: peeking,
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
          toast={toast}
          onTapFace={onTapHero}
        />
        )}
        </>
      )}

      {/* A sent whisper: pale, small, rising from the bottom edge, gone in 4s. */}
      {whispers.map(function(w) { return <Whisper key={w.id} text={w.text} />; })}

      {/* The thread, or an opponent's read — the same glass over the lower 70%,
          with the hand still playing behind it. The felt does not resize. */}
      {overlay}

      {/* WATCH-7: the SESSION is called. Last in the felt so it is over
          everything — and it is the only thing on this screen that is. */}
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
    // The read sheet writes its own dollar, so this is the digits only —
    // grouped by lib/wallet either way, never by the device's locale.
    stack: s.stack != null ? groupChips(s.stack) : null,
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

// ---- the stack tick --------------------------------------------------------
// WATCH-7. `key` is the hand: when it changes and the hand ended with a delta,
// the shown number runs from (target − delta) to target over STACK_TICK_MS and
// stops. Any other change to the target — blinds posted, a snapshot correcting
// the seat — is taken immediately, because only the hand end is worth watching.
//
// setInterval rather than rAF: the felt is already on a 500ms bubble tick, a
// backgrounded tab must not queue seven hundred frames, and a test can advance
// this clock.
function useStackTick(target, delta, key) {
  var [shown, setShown] = useState(target);
  var running = useRef(false);

  useEffect(function () {
    if (!Number.isFinite(target) || !Number.isFinite(delta) || delta === 0) return undefined;
    var from = target - delta;
    var t0 = Date.now();
    running.current = true;
    setShown(from);
    var id = setInterval(function () {
      var p = Math.min(1, (Date.now() - t0) / STACK_TICK_MS);
      // Ease out: it lands on the number rather than stopping at it.
      var e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + delta * e));
      if (p >= 1) { clearInterval(id); running.current = false; }
    }, 50);
    return function () { clearInterval(id); running.current = false; };
    // Keyed on the hand alone: re-running this on every stack change would
    // restart the tick from the top each time a snapshot arrived mid-tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(function () {
    if (running.current) return;
    setShown(target);
  }, [target]);

  return Number.isFinite(shown) ? shown : target;
}

// ---- WatchScreen (export) --------------------------------------------------

export function WatchScreen({
  game, mySeat, lastDecision, chatMessages, sendChat, displayNames,
  onLeave, onSitOut, config,
  // WATCH-8 · job 1: the socket's own status, so the thread can be refetched
  // when the connection comes back. The sheet the owner left is not the sheet
  // the table has been writing while he was gone.
  connection = null,
  // WATCH-9 · the lines the server has PUSHED since this socket opened
  // (THREAD_LINE). The fetch above is a snapshot taken when the sheet opens;
  // this is what keeps an open sheet current without it polling.
  threadLines = null,
  onOpenThread,
  paceFrame,
  paceLag,
  // WATCH-7 · the session-finished signal, and the two ways out of the evening
  // the ceremony offers. `sessionEnd` is null for the whole session and an
  // object exactly once: { reason?, hands?, finalStack?, busted? }.
  sessionEnd = null,
  onFund,
  onBackToFloor,
  // ── SIT-1 · the owner is playing this one himself ────────────────────────
  //
  // `seated` swaps two things and nothing else: the hero at the bottom of the
  // felt (his cards, not a ghost) and the composer's slot (the four verbs, not
  // a whisper). Everything between them — the opponents, the board, the pot,
  // the glass — is the watch screen exactly as it is, which is the point: you
  // are not looking at a second table, you are sitting at the one you watch.
  //
  // `legalActions` is the LIVE offer, not the paced one. Pacing exists so a
  // spectator does not see an action before the line that was said about it; a
  // player must never wait to see his own seat, which is the rule the legacy
  // ActionBar has always kept.
  seated = false,
  legalActions = [],
  onAct,
  // The room's thread rather than one agent's stay. At the kitchen table there
  // is no single agent whose felt this is — the whole household is at it — so
  // the sheet is fed from outside (THREAD-2's /api/home/thread, read by the
  // caller) instead of being assembled from a socket that pushes nothing here
  // (table.js: "the home game pushes nothing").
  threadRows: threadRowsProp = null,
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

  // ── WATCH-8 · job 1 · THE THREAD SURVIVES ────────────────────────────────
  // The sheet used to be assembled from whatever the socket happened to be
  // awake for, so a reconnect got an empty sheet and a look back an hour later
  // got nothing at all. SERVER-3 stores the lines; useTableThread fetches them
  // — here when the sheet is opened, and on the desk for a rail that is always
  // open. One hook, so the two surfaces cannot disagree about what was said.
  var sessionId = game ? game.sessionId : null;

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
  // WATCH-8 job 2: how worn he is. The seat carries it, and the polled agent
  // record is the fallback for the moment before the first snapshot lands —
  // the same order his mood already resolves in.
  var heroFatigueStage = (heroSeatRow && heroSeatRow.fatigue)
    || (agent && agent.fatigue)
    || null;

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
    // BUGS-A job 11 · NOTHING IS SHOWN THAT IS NOT RECORDED.
    //
    // The bubble used to rise first and the guard came after it, so a whisper
    // sent while he was still answering the last one — or at a table with no
    // agent of yours at it — floated up the felt, was gone in four seconds, and
    // was never in the thread. The owner had said something to nobody, and the
    // record disagreed with what he had just watched himself do.
    //
    // The guard is first now, and the composer is disabled while a reply is in
    // flight, so the whisper on the felt and the YOU line in the thread are one
    // event with two drawings of it.
    if (!agentId || agentLoading) return;

    var now = Date.now();
    var id = 'w' + (++whisperIdRef.current);
    setWhispers(function(prev) { return prev.concat([{ id: id, text: text }]); });
    whisperTimers.current.push(setTimeout(function() {
      setWhispers(function(prev) { return prev.filter(function(w) { return w.id !== id; }); });
    }, WHISPER_MS));

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

  // SIT-1: the server's own clock, for the strip's "12s · timeout checks for
  // you". The felt reads the same hook for the ring on the chair; this is the
  // same number in words. `left` is already seconds (lib/pace.js).
  var sitClock = useActionTimer(game);
  var clockSecs = (seated && sitClock && sitClock.seat === mySeat)
    ? sitClock.left
    : null;

  // ── WATCH-7 · a hand ends quietly ───────────────────────────────────────
  // The pot slides to the winner and his stack ticks — both of those are the
  // felt's own doing — and over his strip, for a second and a half, the one line
  // that says what the hand did to HIM. Latched per hand, so however many
  // terminal snapshots the queue serves, a hand is called once.
  //
  // No hold before it. The showdown reveal, the pot trail and this are the same
  // moment; W5-3 delayed its block by SHOWDOWN_HOLD_MS because the block covered
  // the cards being revealed, and a toast over his strip covers nothing.
  var [toastHand, setToastHand] = useState(null);
  var toastSeenRef = useRef(null);
  var settledNow = handSettled(game);
  var settledHand = game ? game.handNumber : null;
  useEffect(function () {
    if (!settledNow) { setToastHand(null); return undefined; }
    if (toastSeenRef.current === settledHand) return undefined;
    toastSeenRef.current = settledHand;
    setToastHand(settledHand);
    var close = setTimeout(function () { setToastHand(null); }, RESULT_TOAST_MS);
    return function () { clearTimeout(close); };
  }, [settledNow, settledHand]);

  // What the hand did to HIM. SERVER-3 puts the real number on the result as
  // `result.deltas`; until it lands — and whenever a payload arrives without it —
  // the screen derives it the way WATCH-6 did: his stack when the hand was dealt
  // against his stack now. lib/deltas.js owns which of the two is used, so this
  // screen never has to know.
  var heroStackNow = heroSeatRow && Number.isFinite(heroSeatRow.stack) ? heroSeatRow.stack : null;
  var stackAtDealRef = useRef({ hand: null, stack: null });
  if (!settledNow && currentHand != null && stackAtDealRef.current.hand !== currentHand) {
    stackAtDealRef.current = { hand: currentHand, stack: heroStackNow };
  }
  var handNet = netForSeat(game && game.result, heroSeatIdx, {
    stackNow: heroStackNow,
    stackAtDeal: stackAtDealRef.current.hand === currentHand
      ? stackAtDealRef.current.stack
      : null,
  });

  // THE STACK TICKS. Not because a counting number is pretty, but because the
  // stack is the only place on the felt where a lost hand leaves a mark, and a
  // number that jumps between renders is a number nobody sees change. It runs
  // from what he had when the hand was dealt to what he has now — which is the
  // delta again, so the server's number moves this too.
  var heroStackTicked = useStackTick(
    heroStackNow,
    settledNow ? handNet : null,
    // The key is the HAND ENDING, not the hand: the settled snapshot carries
    // the same hand number as the hand that was just being played, so keying
    // on the number alone would never fire.
    settledNow ? 'done:' + settledHand : 'live:' + settledHand,
  );

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

  // Opening the sheet is the moment the record has to be current; a reconnect
  // is the other one, and the hook owns both.
  // WATCH-9: and from there it is pushed, so a sheet that is already open shows
  // the next line without being closed and opened again.
  var storedRows = useTableThread({
    agentId: agentId, sessionId: sessionId, connection: connection, want: threadOpen,
    pushed: threadLines,
  });

  // ── the thread, in one ordered list ─────────────────────────────────────
  // HIM / YOU / TABLE, plus an opponent under their own name. Everything the
  // felt showed and everything it had to let go, in the order it happened.
  // WATCH-8: the register each live row is drawn in is stated rather than
  // inferred from its label, so a seat called "TABLE" cannot borrow the room's
  // voice here either — the same rule the stored lines already carry.
  var liveRows = tableRecord.map(function(u) {
    var named = Number.isInteger(u.seat) && game && game.seats && game.seats[u.seat]
      ? (game.seats[u.seat].displayName || displayNames[u.seat] || null)
      : null;
    return {
      id: u.id,
      kind: u.mine ? 'him' : (named ? 'opponent' : 'table'),
      who: (u.mine ? 'HIM' : (named || 'TABLE')).toUpperCase(),
      text: u.text,
      t: u.at,
    };
  })
    .concat(agentThread.map(function(m, i) {
      var you = m.role === 'user';
      return { id: 'c' + i, kind: you ? 'you' : 'him', who: you ? 'YOU' : 'HIM', text: m.content, t: m.t };
    }))
    .concat(attrRecord.map(function(a) {
      return {
        id: a.id, kind: 'table', who: 'TABLE', cost: true, t: a.t,
        text: [a.line, a.key].filter(Boolean).join(' · '),
      };
    }));

  // The record and what is being said now, as one ordered list: one row per id,
  // and where the store and the socket both have a line the STORED copy wins,
  // because it is the one carrying the server's clock.
  var threadRows = threadRowsProp || mergeThread(storedRows, liveRows);

  function handleSitOutConfirm() {
    setSitOutPending(false);
    if (onSitOut) onSitOut();
    if (onLeave)  onLeave();
  }

  var agentName = (config && config.displayName) ? config.displayName : null;

  // WATCH-7 · THE RECEIPT. One line over his strip, teal or red, gone in 1.5s.
  // A delta of exactly zero is not a result — he was not in the hand — and a
  // "+$0" toast would be the screen inventing an event.
  var toastNode = null;
  if (toastHand != null && Number.isFinite(handNet) && handNet !== 0) {
    toastNode = <ResultToast delta={money(handNet)} won={handNet > 0} />;
  }

  // WATCH-7 · THE CEREMONY, and the only thing that still earns the whole felt.
  // `sessionEnd` is the session-finished signal — the TABLE_CLOSED the client
  // already receives today, and SESSION_END when SERVER-3 lands it. Either way
  // it arrives here as { reason, hands, finalStack, busted }, all optional.
  var ceremonyNode = null;
  if (sessionEnd) {
    var finalStack = Number.isFinite(sessionEnd.finalStack) ? sessionEnd.finalStack : heroStackNow;
    // A bust is a fact about his chips, so the screen can see it for itself when
    // the signal does not spell it out.
    var busted = (sessionEnd.busted != null)
      ? !!sessionEnd.busted
      : (Number.isFinite(finalStack) && finalStack <= 0);
    var buyIn = (config && Number.isFinite(config.buyIn)) ? config.buyIn : null;
    var sessionNet = (Number.isFinite(finalStack) && Number.isFinite(buyIn))
      ? finalStack - buyIn
      : null;
    var handsPlayed = Number.isFinite(sessionEnd.hands)
      ? sessionEnd.hands
      : (game && Number.isFinite(game.handNumber) ? game.handNumber : null);
    // WATCH-10 job 3 · the last hand, named — from BUGS-A job 12's namer and
    // from the board and showdown the felt was drawing a beat ago, so the
    // ceremony and the felt's own result pill can never say different things
    // about the same hand. Null between hands: there is nothing to name.
    var lastResult = (game && game.result) ? game.result : null;
    var ceremonyHand = lastResult
      ? handResult(lastResult, {
        seats: (game && game.seats) || [],
        community: (game && game.community) || [],
        money: potMoney,
      })
      : null;
    ceremonyNode = (
      <SessionCeremony
        won={!busted && Number.isFinite(sessionNet) && sessionNet >= 0}
        busted={busted}
        agentName={agentName}
        net={sessionNet}
        stack={finalStack}
        hands={handsPlayed}
        reason={sessionEnd.reason}
        mood={heroMood}
        heat={heroHeat}
        accent={heroAccent}
        handLine={ceremonyHand}
        talkLabel={'Talk to ' + (agentName || 'your agent') + ' about tonight'}
        onTalk={function () { openChat(); }}
        onFund={function () { if (onFund) onFund(); else if (onLeave) onLeave(); }}
        onFloor={function () { if (onBackToFloor) onBackToFloor(); else if (onLeave) onLeave(); }}
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
        agentFatigue={heroFatigueStage}
        cost={pinnedCost}
        whispers={whispers}
        onTapHero={function() { openChat(); }}
        overlay={overlay}
        toast={toastNode}
        heroStackShown={heroStackTicked}
        // No speech over the ceremony: the session is the only thing being said
        // then, and every line is in the record either way. A hand-end toast is
        // not a ceremony and does not silence him.
        seated={seated}
        bubbles={ceremonyNode ? [] : bubbles} ceremony={ceremonyNode} />

      {seated ? (
        // SIT-1 · you are IN the hand, so there is nobody to whisper to. The
        // composer's slot carries the four verbs instead — same slot, same
        // height, so the felt above is measured identically either way.
        <SitStrip
          game={game}
          mySeat={mySeat}
          legalActions={legalActions}
          onAct={onAct}
          secs={clockSecs}
        />
      ) : (
        <WhisperComposer
          onSend={sendToAgent}
          onOpenThread={function() { openChat(); }}
          agentName={agentName}
          // BUGS-A job 11: while he is answering, and at a table where there is
          // no agent of yours to answer. A composer that takes a line and drops
          // it is worse than one that says it cannot take it.
          disabled={agentLoading || !agentId}
        />
      )}

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
