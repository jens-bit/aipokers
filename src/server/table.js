import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';
import { getAgentAction, perceivedMath } from '../agent/handler.js';
import { appendHand } from './handHistory.js';
import {
  recordHandResult,
  runMemoryUpdate,
  getMemoryContext,
  updateComputedMemory,
  getAgentMood,
  setAgentMood,
  getAgentAttributes,
  noteAgentFatigue,
  finishAgentSession,
  recordOpponentHand,
  getAgentBioRole,
  getAgentBio,
  addFlaggedHand,
  openerForAgent,
  getAgentPocket,
  takeDrinkForSession,
  // BUGS-B/1: a table that emptied out under an agent puts him back in a seat
  // through the SAME door his owner's deploy uses — same pocket gate, same
  // matchmaking, same cost bound.
  deployAgent,
} from './agentProfiles.js';
import { classifyHand, isSessionBiggestPot, buildFlaggedEntry, THRESHOLDS } from './flaggedHands.js';
import {
  PACE, paceFor, advancePace, potInBb, holdPlan, seedFor,
  raiseFloor, raisesCapped, raiseCapPerStreet,
} from './pace.js';
import { classifyCooler } from './cooler.js';
import { DRINK_DISCIPLINE_PENALTY, DRINK_BLUFF_BONUS } from './fridge.js';
import {
  emitCasinoEvent, EventType, noteHandWin, bigPotThresholdBb, hotThresholdBb,
  hotTableIds,
} from './events.js';
// METER-1: every model call this table makes is filed under the owner of the
// seat that made it. Best-effort by construction — recordModelCall swallows
// its own errors, because a meter that can break a hand is worse than none.
import { recordModelCall, Kind as MeterKind } from './meter.js';
// COST-1: the decision router. Before every AI turn the server asks, for free,
// whether this spot is decided already; the ones that are never reach a model.
// See router.js for the gates and policyPlay.js for what answers them.
import { routeFor, Route, newRouteCounter, countRoute, formatRoutes } from './router.js';
import { chooseFromPolicy } from '../agent/policyPlay.js';
// COST-1: the hand's talk, written once at the end of it, and the recap of an
// evening nobody watched. Both are one call where there used to be many, and
// both are injected the same way: table.js supplies the facts and never the
// prompt.
import { writeHandTalk, BUBBLE_GAP_MS } from './handTalk.js';
import { writeNightRecap } from './nightRecap.js';
import { recordDecisionRoute } from './meter.js';
import { estimateEquity } from '../engine/equity.js';
import { compilePolicy, deviationPercent, inferProfileFromStyleRisk, normalizeProfile } from '../agent/policy.js';
import {
  effectiveAttrs,
  readMinHands,
  attrCostsForHand,
  wornMomentFor,
  newEvidence,
  addEvidence,
  decisionEvidence,
  handEvidence,
} from '../agent/attributes.js';
import { recordHand as recordHandForOpponentStats, getRead as getOpponentRead } from './opponentStats.js';
import { readPanel, classifyOpponent } from '../agent/reads.js';
import {
  applyEvent as applyMoodEvent,
  tickDecay as tickMoodDecay,
  decisionEffects as moodDecisionEffects,
  clampHeat,
  heatForState,
  HEAT_MIDPOINT,
  MOOD_STATES,
  EVENT_DELTAS,
} from '../agent/mood.js';
// NOTIFY-2: the owner-facing push events are emitted from the places in this
// file that already know they happened, and there are now two ways to say so.
// Where a fact is ALSO a floor headline it travels on the bus, once, with the
// owner's half hung off it as `detail` (see _emitCasinoEvents) — that is the
// bust and the biggest pot. Where it is nobody's business but the owner's it
// calls notifyEvent directly — the session that merely ended, the crossing
// into tilt. Either way it is a no-op until attachNotify() runs in
// src/index.js.
import { notifyEvent, HEAT_TILTED } from './notify.js';
import {
  HOUSE_TAG,
  HOUSE_STATION,
  HOUSE_STRATEGY,
  HOUSE_PROFILE,
  pickComplementaryHouse,
  pickHouseRegular,
} from './matchmaking.js';
import {
  pickTalkLine,
  isStoic,
  isSusceptible,
  TALK_INTERVAL_HANDS,
} from '../agent/tableTalk.js';
import { newSessionId, sessionEndRecord, sessionEndMessage } from './sessions.js';
import { appendLine as appendThreadLine, ThreadKind, OWNER as THREAD_OWNER } from './thread.js';
import { canAffordTable } from './wallet.js';

const HOUSE_FALLBACK_MS = 5000;

// ── SERVER-3: the hero's clock ──────────────────────────────────────────────
// The AI's think delay, which is also the only action deadline the server
// actually enforces today. It is armed BEFORE the state that announces whose
// turn it is, so the ring the client draws is the real one rather than a guess
// started when the message happened to arrive.
const THINK_MIN_MS = Number(process.env.THINK_MIN_MS ?? 800);
const THINK_SPREAD_MS = Number(process.env.THINK_SPREAD_MS ?? 1700);

// A pot worth a face. The same 20bb the mood machine already calls a big pot,
// so "he won big" means one thing on the felt and in his head.
const BIG_POT_BB = 20;

// He was a long way in front and lost anyway. Deliberately above the 0.55 the
// mood machine uses for lostAsEquityFavorite: that is a bad hand, this is the
// face you pull when the river betrays you.
const BAD_BEAT_EQUITY = 0.75;

// The premium holdings that earn a dealtStrong face at first sight. Pairs from
// tens up and the big broadway aces — the hands a person actually reacts to
// looking down at, kept deliberately short so the face stays rare enough to
// mean something.
const STRONG_PAIRS = new Set(['T', 'J', 'Q', 'K', 'A']);
const STRONG_UNPAIRED = new Set(['AK', 'AQ']);

// -- MST-1: multi-seat tables ----------------------------------------------
// Hard ceiling -- the engine accepts 2..6 seats.
export const SEAT_LIMIT = 6;
// Default size of a newly created table.
export const MAX_SEATS = Math.min(SEAT_LIMIT, Math.max(2, Number(process.env.MAX_SEATS ?? 6)));
// Occupied, chipped seats needed before a hand can be dealt.
export const MIN_TO_DEAL = 2;

// ── BUGS-B/1: the lonely table ──────────────────────────────────────────────
//
// An agent sitting on his own at "SHUFFLING" is the worst thing the casino can
// show. He is not resting and he is not playing; he is waiting for a game that
// will never start, and the floor reports him as live the whole time.
//
// The house has six regulars for exactly this. A casino table that cannot deal
// gets them until it has enough bodies for a real game, and a table that stays
// alone even after that is not a table — it is closed and its agent is put back
// in the queue, which is a better answer than leaving him there.
//
// Never at the HOME table. A home game is two of an owner's own agents in his
// living room; seating a House regular in it would make it the casino, and it
// is allowed to be short-handed or to stop entirely.

// How long alone before the house sends somebody over.
export const LONELY_FILL_MS = Number(process.env.LONELY_FILL_MS ?? 20_000);
// How long alone before the table is not worth keeping open.
export const LONELY_CLOSE_MS = Number(process.env.LONELY_CLOSE_MS ?? 300_000);
// What the house fills TO. Three is a game; two is a duel that ends the moment
// one of them busts, which is the state this whole mechanism exists to escape.
export const LONELY_SEATS = Number(process.env.LONELY_SEATS ?? 3);

// ── AGE-35: server-side session loop ────────────────────────────────────────
// Pause between a completed hand and the next deal on an autonomous table.
const HAND_PAUSE_MS = Number(process.env.HAND_PAUSE_MS ?? 8000);
// COST-1: the pause on a table NOBODY IS WATCHING.
//
// PACE-1 already established the principle for the all-in hold: "a five-second
// pause that nobody sees is five seconds of a worse win rate", so unwatched
// hands resolved at machine speed. That was right about the PAUSE and wrong
// about the TEMPO, because tempo is the throttle on the bill. An unwatched
// casino table dealing every eight seconds is 450 hands an hour of model calls
// that produce an experience for nobody until the owner comes back and reads
// the number at the bottom.
//
// So an unwatched table deals at a walking pace. It is not a worse session —
// the hand cap is what bounds a session, not the clock, and he plays exactly
// as many hands either way. It is the same session spread over an evening,
// which is also what it is supposed to look like. The moment somebody attaches
// a spectator it snaps back to today's pacing, mid-session, on the next deal.
//
// An explicit HAND_PAUSE_MS (env, or the constructor argument the home game
// uses) always wins: a caller who named a tempo means it, and the e2e scripts
// that deal a hundred hands in ten seconds are exactly that caller.
const UNWATCHED_HAND_PAUSE_MS = Number(process.env.UNWATCHED_HAND_PAUSE_MS ?? 25_000);
const HAND_PAUSE_EXPLICIT = process.env.HAND_PAUSE_MS !== undefined;
// Hands one deployment is allowed to play before the agent gracefully sits
// out. Bounds the LLM spend of a table nobody is watching.
const SESSION_MAX_HANDS = Number(process.env.SESSION_MAX_HANDS ?? 100);
// Recap lines the agent is left with when a session ends for each reason.
const RECAP_MAX_HANDS = 'long session, sitting out';
const RECAP_BUST = 'someone ran out of chips — session over';
const RECAP_SIT_OUT = 'sat out by owner';
const RECAP_IDLE = 'the table went quiet, so I stepped away';
const RECAP_STALL = 'something jammed at my table, so I stepped away';
// BUGS-B/1: the table never filled up, so he was moved to one that had.
const RECAP_LONELY = 'nobody else ever sat down, so I moved tables';

// Watchdog for the autonomous loop. A hand that cannot advance — the engine
// rejecting both the model's action AND the safe fallback, or _maybeRunAiTurn
// failing outright — schedules nothing, so the table would sit in the registry
// forever reporting presence=playing. The 60s inactivity reaper used to catch
// exactly this, and autonomous tables opt out of it. Generous by design: the
// longest hand observed against live Haiku is ~30s. Set SESSION_STALL_MS to
// override verbatim; otherwise the floor scales with HAND_PAUSE_MS so a slow
// tempo can never trip it.
const SESSION_STALL_MS = Number(process.env.SESSION_STALL_MS ?? 120_000);
const SESSION_STALL_MS_EXPLICIT = process.env.SESSION_STALL_MS !== undefined;

// MST-2: the House archetypes and the complementarity rule moved to
// matchmaking.js, where the same judgement now also ranks real tables. Kept
// as re-exports so nothing importing them from here breaks.
export { HOUSE_TAG, HOUSE_STATION, HOUSE_STRATEGY, HOUSE_PROFILE, pickComplementaryHouse };

// A Table owns the seat roster for 2 to 6 players plus the Game instance those
// seats are currently playing in. It serializes incoming actions, broadcasts
// filtered state, and auto-starts the next hand once enough seated players
// still have chips.
//
// Seat invariant: occupied seats are contiguous from index 0, and
// game.seats[i] always corresponds to table.pending[i]. seatPlayer / seatAI
// take the lowest free index; a departure in the middle compacts the seats
// above it down (_compactSeats), which is why everything per-seat lives in the
// arrays listed in Table.SEAT_FIELDS and moves as one unit.
//
// MST-1: the roster and the Game are separate things. The roster changes the
// moment somebody sits down or stands up; the Game is brought back into
// agreement with it between hands, in _reconcileSeats. That is what makes
// join-in-progress and leave-mid-session possible without tearing the table
// down -- previously the Game was built once, on the first deal, and never
// revisited.
// ATTR-3: one session's worth of evidence for one seat. Field names are the
// contract with EVIDENCE_FIELD in attributes.js — what trains each attribute,
// in the ref's own words: showdowns seen, decision volume, big folds made
// correctly, beats survived, bluffs that got through, hands at the table.
// FRIDGE-1: reading the drink flag must never be able to break a seating. The
// record lives in agentProfiles and this is the one call table.js makes into
// it that is purely decorative, so it fails to false and says so once.
function safeTakeDrink(agentId, userId, tableId) {
  try {
    return takeDrinkForSession(agentId, userId);
  } catch (err) {
    console.error(`[table:${tableId}] drink flag read failed:`, err.message);
    return false;
  }
}

// SERVER-4: is this table inside the `hot` window right now?
//
// Wrapped rather than called inline because liveGameView must never be the
// place a hand dies: the event ring is a shared module-level structure and a
// live frame that cannot say whether a table is hot is worth infinitely more
// than one that throws. False is the honest fallback — a table nobody can
// confirm is on fire is not on fire.
function isHot(tableId) {
  if (!tableId) return false;
  try {
    return hotTableIds().includes(String(tableId));
  } catch (err) {
    console.error('[table] hot lookup failed:', err.message);
    return false;
  }
}

export class Table {
  constructor({ tableId, smallBlind, bigBlind, maxSeats = MAX_SEATS, onEmpty, onStateChange, maxHands, handPauseMs, home = false }) {
    if (!Number.isInteger(maxSeats) || maxSeats < MIN_TO_DEAL || maxSeats > SEAT_LIMIT) {
      throw new Error(`maxSeats must be an integer ${MIN_TO_DEAL}..${SEAT_LIMIT}`);
    }
    this.tableId = tableId;
    // ── HOME-STATE-1: the kitchen table ──────────────────────────────────
    // A home game is a real table running the real engine — same hands, same
    // decisions, same voices — with everything that costs money or changes a
    // record switched off. It is at no stakes, so it is on no rung of the
    // wallet ladder, so it appears in no room; the matchmaker will not send
    // anybody to it, the floor ticker never hears about it, and no push
    // notification comes out of it.
    //
    // What stays ON is deliberate and is the entire point: he talks (bubbles
    // and table talk), and he remembers who he played (bio, grudges). What
    // goes OFF is everything that would let a friendly game at home stand in
    // for a night's work: the pocket, the wallet, the casino bus, the owner's
    // notifications, fatigue, and — through finishAgentSession never being
    // called — attribute growth and the session ledger.
    //
    // The rule underneath all of it: NOTHING THAT HAPPENS HERE MAY MOVE A
    // NUMBER THE CASINO READS. If it did, the home game would be the cheapest
    // grind in the product, and the one thing it is for is that it is not
    // work.
    this.home = !!home;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.maxSeats = maxSeats;
    this.onEmpty = onEmpty;
    // AGE-38: fired whenever this table's visible state changes, so the floor
    // channel can push a FLOOR_GAME delta. Cheap no-op when unset.
    this.onStateChange = onStateChange ?? null;
    this.connections = Array(maxSeats).fill(null); // ws by seat
    this.pending = Array(maxSeats).fill(null);     // { playerId, buyIn, displayName } per seat before hand starts
    this.game = null;

    // AI seat tracking
    this.aiSeats = Array(maxSeats).fill(false);    // true if that seat is controlled by the AI agent
    this.aiStrategy = Array(maxSeats).fill(null);  // per-seat strategy string (passed to prompt)
    this.agentIds = Array(maxSeats).fill(null);    // owning agentId for stats reporting
    this.agentUserIds = Array(maxSeats).fill(null);// owning userId for stats reporting
    this.agentMemory = Array(maxSeats).fill('');   // cached memoryContext string; refreshed after memory updates
    this.agentProfiles = Array(maxSeats).fill(null); // { tightness, aggression, bluffFreq, discipline } for policy compiler
    this.aiHandsPlayed = Array(maxSeats).fill(0);  // local hand count per AI seat (for memory-update cadence)
    this.aiRecentHands = Array(maxSeats).fill(null).map(() => []); // last 5 hand summaries per AI seat
    this.aiLastChatHand = Array(maxSeats).fill(-1); // hand number of last chat per AI seat (1 chat/hand cap)
    // FRIDGE-1: he had a beer before this session. Effective only — his stored
    // DISCIPLINE is untouched; this seat plays with 5 less of it and bluffs 10
    // points more often, and the flag rides the wire so the client can draw the
    // bottle. Set once when the seat is taken and gone when he stands up.
    this.seatDrinking = Array(maxSeats).fill(false);
    // HC-1: House cast identity per seat — null for player/agent seats.
    this.seatAccentColors = Array(maxSeats).fill(null);
    this.seatTalkLines    = Array(maxSeats).fill(null);
    // TLK-1: table talk + needle state.
    this.pendingNeedle         = Array(maxSeats).fill(null);  // queued talk line for next decision briefing
    this._needledThisSession   = Array(maxSeats).fill(0);     // cap mood event once per session per seat
    this._talkHandNumber       = -1;                          // last hand any agent talked (one per hand)
    this._talkLastHandBySeat   = Array(maxSeats).fill(-1);    // last hand this seat talked
    this._prefoldStreakBySeat  = Array(maxSeats).fill(0);     // consecutive preflop-fold hands per seat
    // MST-1: chips live on the table, not inside whichever Game instance is
    // current -- the Game is rebuilt whenever the roster changes.
    this.seatStacks = Array(maxSeats).fill(null);
    // Seats that asked to leave. They fold out of the hand in progress and are
    // removed by the next between-hands reconcile.
    this.seatLeaving = Array(maxSeats).fill(false);
    // handsThisSession when the seat sat down, so a late joiner's session
    // length is reported honestly instead of the whole table's.
    this.seatJoinedAtHand = Array(maxSeats).fill(0);
    // ATTR-3: what each seat has EARNED this session, per attribute. Growth is
    // drawn from this at the end of the session, so an agent grows from how he
    // was deployed rather than from how long the app was left open.
    this.attrEvidence = Array.from({ length: maxSeats }, () => newEvidence());
    // Opponents this seat has actually formed a read on this session — a Set so
    // the same opponent is not counted every hand.
    this.attrReadSubjects = Array.from({ length: maxSeats }, () => new Set());
    // BIO-2c: whether this seat has already noticed his nemesis this session.
    this._nemesisNoted = Array(maxSeats).fill(false);
    // EVENT-1: the hand this table has already shouted `hot` about. A hand
    // reaches the river once, but every river action calls _broadcastPace, and
    // a ticker that repeats itself is a ticker nobody reads.
    this._hotNotedHand = null;

    // The roster (playerIds in seat order) the current Game was built from.
    // Any mismatch against the live roster triggers a rebuild.
    this._gameRoster = null;
    // Button continuity across rebuilds. Seat indices move when players come
    // and go, so the button is remembered by playerId plus the seat order it
    // was recorded in.
    this._buttonPlayerId = null;
    this._buttonOrder = null;
    // Monotonic per-table counter behind the synthetic playerIds of AI seats
    // that have no agentId of their own (the House).
    this._seatSeq = 0;
    this.agentStrategy = null;                     // player-designed strategy from CreateAgent flow

    // Per-street raise counter, keyed by `${handNumber}:${street}`. Reset at
    // maybeStartHand and mutated in _incrementRaiseCountIfAggressive after
    // every applied bet/raise. Consumed by _buildAiGameState.
    // PACE-1: the pacing ladder for the hand in progress. Reset to CALM at each
    // deal; only ever advances within a hand.
    this.pace = PACE.CALM;
    // The board as it stood before the action that closed the hand — the cards
    // the client has actually been shown. The engine runs the rest of the board
    // out synchronously, so without this snapshot there is nothing left to
    // reveal one card at a time.
    this._boardBeforeAct = [];
    this._raiseCounts = {};
    this._paceTimers = [];                         // PACE-1 staged-hold timers
    // PACE-1b: hero equity is Monte Carlo and the felt asks for it on every
    // snapshot, so it is computed once per (hand, board, seat) and reused.
    this._heroEquity = new Map();
    // The formed-read fingerprint per seat, so a READ message is sent when the
    // picture actually changes rather than on every broadcast.
    this._readFingerprint = new Map();
    this._aiInactivityTimer = null;                // 60s timeout for AI tables
    this._houseFallbackTimer = null;               // 5s delay before auto-seating House
    this.sessionBiggestPot = 0;                    // session high-water pot; flaggedHands tracks it

    // Per-hand decision log; reset at the start of each hand. Populated by
    // _maybeRunAiTurn before every AI action and consumed in _handCompleted.
    this.currentHandDecisions = [];                // [{ seat, street, action, reasoning, holeCards, community, timestamp }]
    this.currentHandStartStacks = [];              // stack snapshot taken just before each startHand() call

    // Full per-hand action log across ALL seats (human + AI). Feeds
    // opponentStats after each hand so reads reflect every actor.
    this.currentHandActionLog = [];                // [{ seat, street, actionType }]

    // Rolling chat history (last 20, newest last). Used only by sendChat ÔÇö
    // not replayed to clients on reconnect for simplicity.
    this.chatHistory = [];                         // [{ seat, displayName, text, isAI, timestamp }]

    // Spectators: users who watch their AI play from its seat's POV
    this.spectators = [];                          // [{ ws, spectatorSeat }]

    // BUG-14 / MST-1: SIT_OUT is seat-scoped. Seats in this set finish the
    // CURRENT hand (folding as soon as it is their turn) and are freed in
    // _handCompleted. The table itself only closes when the departure leaves
    // it with fewer than MIN_TO_DEAL seats.
    this._pendingSitOut = new Set();

    // WALLET-6: the other way off the table. Seats in this set PLAY the current
    // hand out normally -- no fold, no shortcut -- and are benched by
    // _handCompleted the moment it ends. That is the promise the funding sheet
    // makes when an owner cuts his agent off ("he finishes the hand he is in
    // and takes a seat at the bar"), and it is why it cannot reuse
    // _pendingSitOut, which folds out of the hand as soon as the seat acts.
    this._benchAfterHand = new Set();

    // ── AGE-35: autonomous session loop ──────────────────────────────────
    // autoPlay tables deal themselves. Nothing a client does — connecting,
    // watching, leaving — advances or stops them; only the loop, a bust, the
    // hand cap, or an explicit SIT_OUT does.
    this.autoPlay = false;
    this.handsThisSession = 0;
    this.maxHands = Number.isFinite(maxHands) ? maxHands : SESSION_MAX_HANDS;
    this.handPauseMs = Number.isFinite(handPauseMs) ? handPauseMs : HAND_PAUSE_MS;
    // COST-1: was this table's tempo asked for, or defaulted? Only a defaulted
    // one is allowed to slow down when nobody is watching.
    this._handPauseNamed = Number.isFinite(handPauseMs) || HAND_PAUSE_EXPLICIT;
    this._nextHandTimer = null;
    this._stallTimer = null;
    this.stallMs = SESSION_STALL_MS_EXPLICIT
      ? SESSION_STALL_MS
      : Math.max(SESSION_STALL_MS, this.handPauseMs * 3 + 60_000);
    this.closed = false;
    // BUGS-B/1: when this table stopped having enough bodies to deal, or null
    // when it has them. One timestamp rather than a countdown, so the fill at
    // 20s and the close at 5 minutes are measured from the same moment and a
    // failed fill does not restart the clock.
    this._aloneSince = null;
    this._lonelyTimer = null;
    // Advisory deadline for the seat currently to act (the AI's think delay).
    // Surfaced to the floor as liveGame.actionDeadline. A real server-side
    // action timer for HUMAN seats is still Fredrik's queue.
    this.actionDeadline = null;

    // ── SERVER-3: the session, as a thing with a name ────────────────────
    // A stay at this table by one agent. Minted when the seat is taken, so
    // everything that happens while he is sitting there can be filed under it
    // — the table thread, and the SESSION_END that fires the ceremony.
    // A seat with no agent behind it (a House regular, a human) has none.
    this.seatSessionIds = Array(maxSeats).fill(null);
    // When he sat down, for SESSION_END's `duration`.
    this.seatSeatedAt = Array(maxSeats).fill(0);
    // Why he is leaving, when the answer is known BEFORE the seat is retired
    // and cannot be read off the final stack: the owner called him in, or
    // STAMINA sat him down. Null means "work it out at retirement time".
    this.seatEndReason = Array(maxSeats).fill(null);
    // The biggest pot this seat had money in this session. Per SEAT, not per
    // table: the ceremony prints HIS session, and a monster pot he folded out
    // of preflop is not part of it.
    this.seatBiggestPot = Array(maxSeats).fill(0);
    // SERVER-3: the acting seat's clock — { key, seat, deadlineTs, totalMs }.
    // See _armActionTimer. `key` never leaves the server.
    this.actionTimer = null;
    // Bumped on every action the engine accepts, so the clock can tell "the
    // same seat, still to act" from "the same seat, to act again on the next
    // street" — which heads-up happens on every hand.
    this._actionSeq = 0;
    // The turn _maybeRunAiTurn has already claimed, so one turn is never
    // driven twice. See the guard there.
    this._aiTurnKey = null;
    // COST-1: this table's own tally of where its decisions went. Per table
    // rather than global so a verify script can assert on one session, and so
    // the number in the log at the end of a session is that session's.
    this.routes = newRouteCounter();
    // COST-1: the picture of the opposition as it stood at his LAST decision,
    // per seat. A read that has been true for thirty hands is background; a
    // read that just moved is news, and news is the thing worth paying to
    // react to. Same fingerprint idea _maybeBroadcastReads uses to decide
    // whether a READ message goes on the wire at all, asked per decision
    // rather than per broadcast.
    this._routeReadPrint = Array(maxSeats).fill(null);
    // COST-1: was anybody watching this session at ANY point?
    //
    // The end-of-session write-up is for a session nobody saw, and `isWatched()`
    // at close time answers a different question: an owner who watched all
    // evening and then shut his phone has an unwatched table by the time the
    // hand cap trips, and would be handed a write-up of the session he had just
    // sat through. This is the ONE watched-flag that is stored rather than
    // derived, and it is stored precisely because it is a fact about the past.
    this._everWatched = false;
    // COST-1: the hands worth mentioning, in the order they happened. The
    // input to the end-of-session write-up on an unwatched table — see
    // _writeNightRecap. One sentence per flagged hand, capped, because an
    // evening is three or four things and not a hundred.
    this.sessionMoments = [];
    this._recapWritten = false;
  }

  // -- MST-1: seat bookkeeping ----------------------------------------------
  // Every per-seat array in one place. Anything that clears or moves a seat
  // goes through here, so a new per-seat field can never be forgotten by one
  // of the call sites (clear, compact, retire).
  static SEAT_FIELDS = [
    ['connections',      () => null],
    ['pending',          () => null],
    ['aiSeats',          () => false],
    ['aiStrategy',       () => null],
    ['agentIds',         () => null],
    ['agentUserIds',     () => null],
    ['agentMemory',      () => ''],
    ['agentProfiles',    () => null],
    ['aiHandsPlayed',    () => 0],
    ['aiRecentHands',    () => []],
    ['aiLastChatHand',   () => -1],
    ['seatStacks',       () => null],
    ['seatLeaving',      () => false],
    ['seatJoinedAtHand', () => 0],
    ['attrEvidence',      () => newEvidence()],   // ATTR-3
    ['attrReadSubjects',  () => new Set()],           // ATTR-3
    ['_nemesisNoted',     () => false],                // BIO-2c
    ['seatAccentColors',       () => null],
    ['seatTalkLines',          () => null],
    ['pendingNeedle',          () => null],   // TLK-1
    ['_needledThisSession',    () => 0],      // TLK-1
    ['_talkLastHandBySeat',    () => -1],     // TLK-1
    ['_prefoldStreakBySeat',   () => 0],      // TLK-1
    ['seatSessionIds',   () => null],   // SERVER-3
    ['seatSeatedAt',     () => 0],      // SERVER-3
    ['seatEndReason',    () => null],   // SERVER-3
    ['seatBiggestPot',   () => 0],      // SERVER-3
    ['seatDrinking',     () => false],  // FRIDGE-1
    ['_routeReadPrint',  () => null],    // COST-1
  ];

  _clearSeat(seat) {
    for (const [field, empty] of Table.SEAT_FIELDS) this[field][seat] = empty();
  }

  _moveSeat(from, to) {
    if (from === to) return;
    for (const [field] of Table.SEAT_FIELDS) this[field][to] = this[field][from];
    this._clearSeat(from);
  }

  seatedCount() { return this.pending.filter((p) => p !== null).length; }
  freeSeatCount() { return this.pending.filter((p) => p === null).length; }
  hasFreeSeat() { return !this.closed && this.pending.some((p) => p === null); }

  // MATCH-1: does this owner already hold a seat here? Asked on both doors
  // into a seat (deploy's joinAgentSession, WATCH's addSpectator) so neither
  // can let a stable share a felt. Deliberately reads the live seat arrays
  // rather than a cached set — a seat that stood up is not here any more.
  seatsAgentOfOwner(userId) {
    if (userId == null || userId === '') return false;
    const owner = String(userId);
    return this.agentUserIds.some((uid, seat) =>
      uid != null && String(uid) === owner && this.agentIds[seat] != null);
  }
  defaultBuyIn() { return this.bigBlind * 100; }

  // The stack a seat carries into the next hand.
  seatStack(seat) {
    return this.seatStacks[seat] ?? this.pending[seat]?.buyIn ?? 0;
  }

  // Seats that will still be here for the next deal: occupied, not leaving,
  // and holding chips.
  _survivingSeats() {
    const out = [];
    for (let i = 0; i < this.maxSeats; i++) {
      if (!this.pending[i]) continue;
      if (this.seatLeaving[i] || this._pendingSitOut.has(i)) continue;
      if (this._benchAfterHand.has(i)) continue;
      if (this.seatStack(i) <= 0) continue;
      out.push(i);
    }
    return out;
  }

  // True once the seat is actually represented in the current Game. A seat
  // that joined mid-hand is occupied but not yet dealt in.
  _seatIsInGame(seat) {
    return !!this.game && seat < this.game.seats.length;
  }

  // Copy the live Game stacks back onto the table's per-seat ledger, so chips
  // survive the Game instance they were won in.
  _captureStacks() {
    if (!this.game) return;
    for (let i = 0; i < this.game.seats.length && i < this.maxSeats; i++) {
      if (this.pending[i]) this.seatStacks[i] = this.game.seats[i].stack;
    }
  }

  // The engine rotates its button at the end of every hand, so on a completed
  // hand game.dealerSeat already names the NEXT hand's button. Remember it by
  // playerId (indices move when seats come and go) together with the seat
  // order it was recorded in, so a rebuild can resume the rotation.
  _recordButton() {
    if (!this.game) return;
    this._buttonOrder = this.game.seats.map((s) => s.playerId);
    this._buttonPlayerId = this._buttonOrder[this.game.dealerSeat] ?? null;
  }

  // Where the button sits in a freshly built roster.
  //
  // DEAD-BLIND RULE (deliberately simple; this is play money): the button
  // walks the OLD seat order from wherever it was until it finds a player who
  // is still here, and the blinds follow the button as usual. Nobody posts a
  // dead blind, and a seat that joins between hands owes no catch-up big
  // blind -- it is simply dealt in. The only cost of the simplification is
  // that in rare join/leave patterns a player can skip one big blind.
  _resolveButtonSeat(roster) {
    if (!this._buttonOrder || !this._buttonPlayerId) return 0;
    const start = this._buttonOrder.indexOf(this._buttonPlayerId);
    if (start === -1) return 0;
    for (let i = 0; i < this._buttonOrder.length; i++) {
      const pid = this._buttonOrder[(start + i) % this._buttonOrder.length];
      const idx = roster.indexOf(pid);
      if (idx !== -1) return idx;
    }
    return 0;
  }

  // Occupied seats stay contiguous from index 0 so game.seats[i] always maps
  // to this table's seat i. A departure in the middle shifts everyone above it
  // down; spectator points of view and pending sit-outs move with them.
  _compactSeats() {
    const order = [];
    for (let i = 0; i < this.maxSeats; i++) if (this.pending[i]) order.push(i);
    if (order.every((from, to) => from === to)) return;

    const remap = new Map();
    order.forEach((from, to) => { remap.set(from, to); this._moveSeat(from, to); });
    for (const s of this.spectators) {
      if (remap.has(s.spectatorSeat)) s.spectatorSeat = remap.get(s.spectatorSeat);
    }
    const movedSitOuts = new Set();
    for (const seat of this._pendingSitOut) {
      if (remap.has(seat)) movedSitOuts.add(remap.get(seat));
    }
    this._pendingSitOut = movedSitOuts;
    const movedBench = new Set();
    for (const seat of this._benchAfterHand) {
      if (remap.has(seat)) movedBench.add(remap.get(seat));
    }
    this._benchAfterHand = movedBench;
    // Seat indices moved, so whatever the Game was built from is stale.
    this._gameRoster = null;
  }

  // -- MST-1: the between-hands reconcile -----------------------------------
  // The one place where the table's seat roster and the Game's seat array are
  // brought back into agreement. Runs ONLY between hands. Order matters:
  //   1. bank the stacks from the hand that just finished
  //   2. retire seats that busted or asked to leave
  //   3. compact, so occupied seats stay contiguous from 0
  //   4. rebuild the Game when the roster no longer matches what it was built
  //      from, carrying stacks, hand number and the button across
  _reconcileSeats() {
    if (this.closed) return;
    if (this.game && this.game.street !== Streets.COMPLETE && this.game.street !== Streets.WAITING) return;

    this._captureStacks();

    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (!this.pending[seat]) continue;
      const busted = this.seatStack(seat) <= 0;
      if (!this.seatLeaving[seat] && !busted) continue;
      this._retireSeat(seat, busted ? RECAP_BUST : RECAP_SIT_OUT);
    }

    this._compactSeats();

    const roster = [];
    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (this.pending[seat]) roster.push(this.pending[seat].playerId);
    }

    const unchanged = !!this.game
      && !!this._gameRoster
      && this._gameRoster.length === roster.length
      && this._gameRoster.every((pid, i) => pid === roster[i]);
    if (unchanged) return;

    this._rebuildGame(roster);
  }

  _rebuildGame(roster) {
    const handNumber = this.game?.handNumber ?? 0;
    if (roster.length < MIN_TO_DEAL) {
      this.game = null;
      this._gameRoster = null;
      return;
    }
    this.game = new Game({
      tableId: this.tableId,
      seats: roster.map((playerId, i) => ({ playerId, stack: this.seatStack(i) })),
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      dealerSeat: this._resolveButtonSeat(roster),
    });
    // Hand numbering belongs to the table, not to a Game instance -- the
    // client's hand dividers and the session cap both read it.
    this.game.handNumber = handNumber;
    this._gameRoster = roster;
    console.log(`[table:${this.tableId}] seats reconciled -- ${roster.length}-handed (${roster.join(', ')}), button seat ${this.game.dealerSeat}`);
  }

  // Take one seat out of the table: report that agent's session, tell the
  // sockets bound to the seat their session is over, and blank the seat. The
  // Game still contains it until the next rebuild -- which is exactly what
  // "the seat frees up next hand" means.
  _retireSeat(seat, recap) {
    const occupant = this.pending[seat];
    if (!occupant) return;
    const agentId = this.agentIds[seat];
    // HOME-STATE-1: standing up from the kitchen table is not the end of a
    // session, because it was never one. finishAgentSession is what credits
    // the pocket, draws attribute growth, writes the recap and leaves an
    // unseenRecap behind — none of which a home game has earned, so the whole
    // ceremony is skipped and the seat is simply freed.
    if (agentId && !this.home) {
      try {
        const buyIn = occupant.buyIn ?? this.defaultBuyIn();
        const finalStack = this.seatStacks[seat] ?? this.game?.seats?.[seat]?.stack ?? buyIn;
        const watched = this.spectators.some((s) => s.spectatorSeat === seat);
        const sessionHands = this._seatSessionHands(seat);
        // SERVER-3: built before finishAgentSession, so the same record can go
        // on the sessions bus (the floor) and to this table's sockets (the
        // ceremony) without either being reconstructed from the other.
        const sessionEnd = this._sessionEndFor(seat, {
          reason: this._endReasonFor(seat, { busted: finalStack <= 0 }),
          finalStack, buyIn, sessionHands,
        });
        const agent = finishAgentSession(agentId, this.agentUserIds[seat], {
          recap,
          sessionPnl: finalStack - buyIn,
          watched,
          sessionHands,
          finalStack,
          buyInAmount: buyIn,
          tableId: this.tableId,
          sessionEnd,
        });
        // Before the TABLE_CLOSED below: that message is what a client tears
        // the screen down on, and the ceremony has to have arrived first.
        this._broadcastSessionEnd(sessionEnd);
        this._notifySessionEnd({
          seat, agentId, agent, buyIn, finalStack, watched, sessionHands,
          busted: recap === RECAP_BUST,
        });
      } catch (err) {
        console.error('[table] finishAgentSession failed:', err.message);
      }
    }

    // The owner watching this seat loses their session; everyone else at the
    // table just sees the seat open up.
    const closedMsg = JSON.stringify({ type: ServerMsg.TABLE_CLOSED, reason: recap });
    const ws = this.connections[seat];
    if (ws && ws.readyState === ws.OPEN) ws.send(closedMsg);
    for (const spec of [...this.spectators]) {
      if (spec.spectatorSeat !== seat) continue;
      if (spec.ws && spec.ws.readyState === spec.ws.OPEN) spec.ws.send(closedMsg);
      const idx = this.spectators.indexOf(spec);
      if (idx !== -1) this.spectators.splice(idx, 1);
    }

    const displayName = occupant.displayName ?? occupant.playerId;
    this._pendingSitOut.delete(seat);
    this._benchAfterHand.delete(seat);
    this._clearSeat(seat);
    console.log(`[table:${this.tableId}] seat ${seat} freed -- ${displayName} (${recap})`);
    this._broadcast({ type: ServerMsg.SEAT_LEFT, seat, displayName, reason: recap });
  }


  // NOTIFY-1: the session-end ping, from the one place that knows how the seat
  // ended. A bust and a sit-out are different messages — one is a decision for
  // the owner, the other is a result — so they are different ladder rungs and
  // never both fire for the same seat.
  //
  // NOTIFY-2: the bust half is gone from here. A seat running out of chips is
  // already a floor headline, emitted once in _emitCasinoEvents at the moment
  // the hand that did it finished, and the owner's copy rides along with it as
  // `detail`. Emitting it a second time from the retirement path is how one
  // bust becomes two messages out of one budget. What is left here is the
  // sit-out, which the floor has no opinion about.
  //
  // Nothing is sent for a session the owner WATCHED end: the ref's trigger for
  // the recap is "a session ends while you were not watching it", and pinging
  // someone about the thing on their screen is the kind of message this budget
  // exists to prevent.
  _notifySessionEnd({ seat, agentId, agent, buyIn, finalStack, watched, sessionHands, busted }) {
    const ownerId = this.agentUserIds[seat];
    if (this.home) return;   // HOME-STATE-1: the home game pushes nothing
    if (!ownerId || watched || busted) return;
    const agentName = agent?.name || this.pending[seat]?.displayName || 'Your agent';
    const endedAt = Date.now();

    notifyEvent('session_ended', {
      ownerId: String(ownerId),
      agentId,
      agentName,
      // RAISE-2: the opener is the line he would open the thread with, and it
      // is never null — which is exactly why it can be the message text.
      opener: openerForAgent(agent) || 'Session done.',
      pnl: finalStack - buyIn,
      hands: sessionHands,
      endedAt,
    });
  }

  // ── AGE-35: session loop ──────────────────────────────────────────────────

  // True when the table is populated exclusively by AI seats — the only shape
  // the server-side loop is allowed to drive.
  isAiOnly() {
    if (!this.pending.some((p) => p !== null)) return false;
    return this.pending.every((p, i) => p === null || this.aiSeats[i]);
  }

  // Stand up a fully server-driven session: the owner's agent plus a
  // complementary House, then start dealing. No client is involved at any
  // point — this is what makes the agent live while nobody is watching.
  // Returns the seat the agent took, or null when the table cannot host it.
  startAgentSession({ agentId, userId, displayName, strategy, memoryContext = '', agentProfile = null, buyIn } = {}) {
    if (this.closed) return null;
    if (this.pending.filter((p) => p !== null).length > 0) return null;
    const profile = agentProfile ? normalizeProfile(agentProfile) : null;
    const stack = Number.isInteger(buyIn) ? buyIn : this.bigBlind * 100;

    const heroSeat = this.seatAI({
      displayName: displayName || 'Agent',
      strategy: strategy || '',
      agentId,
      userId,
      memoryContext,
      agentProfile: profile,
      buyIn: stack,
    });
    const house = pickComplementaryHouse(profile);
    this.seatAI({
      displayName:  house.displayName,
      strategy:     house.strategy,
      agentProfile: house.profile,
      buyIn:        stack,
      stableId:     house.stableId,
      accentColor:  house.accentColor,
      talkLines:    house.talkLines,
    });
    // Leave the table-wide agentStrategy null: _maybeRunAiTurn prefers it over
    // the per-seat text, which would hand the hero's strategy to the House.
    this.agentStrategy = null;
    console.log(`[table:${this.tableId}] autonomous session started — ${displayName || 'Agent'} vs ${house.displayName} (${house.castMember?.archetype ?? 'House'}), max ${this.maxHands} hands`);
    this.startSessionLoop({ delayMs: 250 });
    // BUGS-B/1: from the first second. A table that stands up with nobody
    // opposite is the exact shape this watches for.
    this._noteLoneliness();
    return heroSeat;
  }
  // MST-1/MST-2: seat an agent at a table that is ALREADY running. The seat is
  // occupied immediately -- so the floor stops claiming the agent is resting --
  // but the Game only learns about it at the next reconcile, which is what
  // "dealt into the next hand" means. Returns the seat, or null when the table
  // cannot take it.
  joinAgentSession({ agentId, userId, displayName, strategy, memoryContext = '', agentProfile = null, buyIn } = {}) {
    if (this.closed) return null;
    if (!this.hasFreeSeat()) return null;
    if (agentId && this.agentIds.includes(agentId)) return null;
    // MATCH-1: two agents of the same owner never sit at the same CASINO
    // table. The matchmaker refuses these before they get here, but the
    // matchmaker is not the only door into a seat, and a rule that only holds
    // on one path is not a rule. Refusing with null is exactly what a full
    // table does, so every caller already handles it: the deploy opens a
    // table of its own instead.
    //
    // The home game is the exception, and it is the whole point of the home
    // game — see homeGame.js, which seats a household this way on purpose.
    if (!this.home && this.seatsAgentOfOwner(userId)) return null;

    const seat = this.seatAI({
      displayName: displayName || 'Agent',
      strategy: strategy || '',
      agentId,
      userId,
      memoryContext,
      agentProfile: agentProfile ? normalizeProfile(agentProfile) : null,
      buyIn: Number.isInteger(buyIn) ? buyIn : this.defaultBuyIn(),
    });
    console.log(`[table:${this.tableId}] ${displayName || 'Agent'} joined seat ${seat} of ${this.maxSeats} -- dealt in from hand ${this.handsThisSession + 1}`);

    // A table that was not yet self-dealing (or had gone quiet waiting for a
    // second body) starts now.
    if (!this.autoPlay) {
      this.startSessionLoop({ delayMs: 250 });
    } else if (!this._nextHandTimer && (!this.game || this.game.street === Streets.COMPLETE || this.game.street === Streets.WAITING)) {
      this._scheduleNextHand(250);
    }
    this._noteLoneliness();   // BUGS-B/1: somebody arrived — is it enough?
    this._notifyStateChange();
    return seat;
  }


  // WV2-1: an AI-only table with enough bodies to deal and nothing driving it
  // is a ghost — the floor reports it as playing (liveGameView only asks
  // isAiOnly) while it sits at WAITING forever.
  //
  // That is exactly the shape a table assembled seat-by-seat by WATCH takes:
  // the first watcher seats its agent and arms the House fallback, the second
  // watcher CANCELS that fallback and seats a second agent, and from then on
  // nobody owns the tempo. Heads-up-vs-House survived only because the House
  // timer's own maybeStartHand() is not clientDriven.
  //
  // So: whenever a client-driven call finds an undriven AI-only table that
  // could deal, the server adopts it. Idempotent; a no-op on a table that
  // already has a loop, has a human seat, or is short of MIN_TO_DEAL.
  _adoptUndrivenTable() {
    if (this.closed || this.autoPlay) return false;
    if (!this.isAiOnly()) return false;
    if (this._survivingSeats().length < MIN_TO_DEAL) return false;
    console.log(`[table:${this.tableId}] adopting an undriven AI-only table (${this.seatedCount()} seated) — starting the session loop`);
    return this.startSessionLoop({ delayMs: 250 });
  }

  // Flip the table into autonomous mode and queue the first deal. Idempotent;
  // a no-op on a table that still has a human seat.
  startSessionLoop({ delayMs = 0 } = {}) {
    if (this.closed) return false;
    if (!this.isAiOnly()) return false;
    this.autoPlay = true;
    // The 60s inactivity reaper exists to stop orphaned AI tables. The loop's
    // own bounds (hand cap + bust) replace it.
    if (this._aiInactivityTimer) { clearTimeout(this._aiInactivityTimer); this._aiInactivityTimer = null; }
    this._scheduleNextHand(delayMs);
    this._noteLoneliness();   // BUGS-B/1
    return true;
  }

  // ── BUGS-B/1 · the lonely table ───────────────────────────────────────────

  /** Seats that could actually be dealt into the next hand. */
  liveSeatCount() {
    return this._survivingSeats().length;
  }

  /**
   * Look at whether this table can deal, and start or stop the clock.
   *
   * Called wherever the answer can change — a seat taken, a seat retired, a
   * hand finished — and idempotent everywhere: it either notes that the table
   * is fine and clears the clock, or notes when it stopped being fine and arms
   * one timer. Never two.
   */
  _noteLoneliness() {
    // A home game is allowed to be short-handed, and is allowed to stop. It is
    // a living room, not a felt with a floor manager.
    if (this.closed || this.home) return;
    if (this.liveSeatCount() >= MIN_TO_DEAL) {
      this._aloneSince = null;
      if (this._lonelyTimer) { clearTimeout(this._lonelyTimer); this._lonelyTimer = null; }
      return;
    }
    if (this._aloneSince === null) {
      this._aloneSince = Date.now();
      console.log(`[table:${this.tableId}] down to ${this.liveSeatCount()} live seat(s) — the house has ${Math.round(LONELY_FILL_MS / 1000)}s to send somebody over`);
    }
    if (this._lonelyTimer) return;
    this._lonelyTimer = setTimeout(() => {
      this._lonelyTimer = null;
      try { this._answerLoneliness(); }
      catch (err) { console.error(`[table:${this.tableId}] lonely check failed:`, err.message); }
    }, LONELY_FILL_MS);
    this._lonelyTimer.unref?.();
  }

  /** The clock ran out. Fill the table, or give up on it. */
  _answerLoneliness() {
    if (this.closed || this.home) return;
    if (this.liveSeatCount() >= MIN_TO_DEAL) { this._aloneSince = null; return; }

    // Busted and departed seats are still holding slots the house needs.
    this._reconcileSeats();
    if (this.closed) return;

    const aloneFor = Date.now() - (this._aloneSince ?? Date.now());
    if (aloneFor < LONELY_CLOSE_MS) {
      const seated = this._seatHouseRegulars();
      if (this.liveSeatCount() >= MIN_TO_DEAL) {
        console.log(`[table:${this.tableId}] the house sat ${seated} regular(s) down — ${this.liveSeatCount()} live seats, dealing again`);
        this._aloneSince = null;
        this._notifyStateChange();
        if (this.isAiOnly()) {
          if (this.autoPlay) this._scheduleNextHand(250);
          else this.startSessionLoop({ delayMs: 250 });
        }
        return;
      }
      // The fill could not manage it (the whole cast is already here, or every
      // slot is taken by a seat that cannot be freed). Look again later — and
      // deliberately WITHOUT resetting `_aloneSince`, so the five minutes are
      // counted from when he was first left alone.
      console.warn(`[table:${this.tableId}] still ${this.liveSeatCount()} live seat(s) after the house tried to fill it`);
      this._noteLoneliness();
      return;
    }

    console.warn(`[table:${this.tableId}] alone for ${Math.round(aloneFor / 1000)}s — closing, and putting its agent(s) back in the queue`);
    this._closeAndRequeue();
  }

  /**
   * Seat House regulars until the table has LONELY_SEATS live seats.
   *
   * Never two of the same regular: a cast seat's playerId is `house_<id>` and
   * both the button and opponentStats are keyed on it, so a duplicate would
   * break the table's own uniqueness invariant. Returns how many sat down.
   */
  _seatHouseRegulars() {
    let seated = 0;
    // Bounded by the seats there are: nothing here may spin.
    for (let guard = 0; guard < this.maxSeats; guard++) {
      if (this.closed || this.liveSeatCount() >= LONELY_SEATS || !this.hasFreeSeat()) break;
      const opposing = this._survivingSeats()
        .map((seat) => this.agentProfiles[seat])
        .filter(Boolean);
      const house = pickHouseRegular(opposing, this._seatedCastIds());
      if (!house) break;   // the whole cast is already at this felt
      try {
        this.seatAI({
          displayName:  house.displayName,
          strategy:     house.strategy,
          agentProfile: house.profile,
          buyIn:        this.defaultBuyIn(),
          stableId:     house.stableId,
          accentColor:  house.accentColor,
          talkLines:    house.talkLines,
        });
      } catch (err) {
        console.error(`[table:${this.tableId}] could not seat ${house.displayName}:`, err.message);
        break;
      }
      seated++;
    }
    return seated;
  }

  /** The cast ids sitting here right now, read off the seats. */
  _seatedCastIds() {
    const ids = [];
    for (const occupant of this.pending) {
      const playerId = occupant?.playerId;
      if (typeof playerId === 'string' && playerId.startsWith('house_')) {
        ids.push(playerId.slice('house_'.length));
      }
    }
    return ids;
  }

  /**
   * Give up on this table and put whoever was stranded at it back in a seat.
   *
   * Who is here is read BEFORE the close, because closeTable frees every seat;
   * the re-deploy happens AFTER it, because deployAgent refuses an agent who
   * is still pointing at a live table and closeTable is what clears that.
   */
  _closeAndRequeue() {
    const stranded = [];
    for (const seat of this._survivingSeats()) {
      if (this.agentIds[seat]) {
        stranded.push({ agentId: this.agentIds[seat], userId: this.agentUserIds[seat] });
      }
    }
    this.closeTable(RECAP_LONELY, { recap: RECAP_LONELY });
    for (const who of stranded) {
      try {
        const out = deployAgent(who.userId, who.agentId, { requeue: true });
        if (out.status === 200) {
          console.log(`[table:${this.tableId}] ${who.agentId} re-queued at ${out.body.tableId}`);
        } else {
          console.warn(`[table:${this.tableId}] ${who.agentId} could not be re-queued (${out.status}): ${out.body?.error ?? ''}`);
        }
      } catch (err) {
        console.error(`[table:${this.tableId}] re-queue failed:`, err.message);
      }
    }
  }

  // Re-arm the stall watchdog. Called on every sign of progress: a deal
  // scheduled, a state broadcast, an action applied. If nothing resets it
  // within stallMs the table is wedged, and closing it honestly beats leaving
  // a ghost that claims to be playing.
  _resetStallWatchdog() {
    if (!this.autoPlay || this.closed) return;
    if (this._stallTimer) clearTimeout(this._stallTimer);
    this._stallTimer = setTimeout(() => {
      this._stallTimer = null;
      if (this.closed) return;
      console.error(`[table:${this.tableId}] session made no progress for ${this.stallMs}ms — closing a wedged table`);
      this.closeTable('session stalled', { recap: RECAP_STALL });
    }, this.stallMs);
    this._stallTimer.unref?.();
  }

  _scheduleNextHand(ms) {
    this._resetStallWatchdog();
    if (this._nextHandTimer) clearTimeout(this._nextHandTimer);
    this._nextHandTimer = setTimeout(() => {
      this._nextHandTimer = null;
      if (this.closed) return;
      try {
        this.maybeStartHand();
      } catch (err) {
        console.error(`[table:${this.tableId}] session loop deal failed:`, err.message);
      }
    }, Math.max(0, ms));
    // Never hold the process open just to deal another hand.
    this._nextHandTimer.unref?.();
  }

  _clearTimers() {
    for (const t of this._paceTimers ?? []) clearTimeout(t);
    this._paceTimers = [];
    if (this._aiInactivityTimer) { clearTimeout(this._aiInactivityTimer); this._aiInactivityTimer = null; }
    if (this._houseFallbackTimer) { clearTimeout(this._houseFallbackTimer); this._houseFallbackTimer = null; }
    if (this._nextHandTimer) { clearTimeout(this._nextHandTimer); this._nextHandTimer = null; }
    if (this._stallTimer) { clearTimeout(this._stallTimer); this._stallTimer = null; }
    if (this._lonelyTimer) { clearTimeout(this._lonelyTimer); this._lonelyTimer = null; }
  }

  // The single close path for every reason a table ends: sit-out, bust, hand
  // cap, idle reaper, opponent left. Broadcasts TABLE_CLOSED, retires every AI
  // seat that belongs to an agent (clearing activeTableId and leaving an
  // unseenRecap), kills the timers, and drops the table from the registry.
  // Idempotent — a second call is a no-op.
  closeTable(reason, { recap = null } = {}) {
    if (this.closed) return;
    this.closed = true;
    this.autoPlay = false;
    this._captureStacks();
    // COST-1: the route split this session actually took, once, where somebody
    // will read it. Not per decision — that log line already exists — but the
    // one number that says whether the router earned its keep tonight.
    if (this.routes.total > 0) {
      console.log(`[route:${this.tableId}] ${formatRoutes(this.routes)}`);
    }
    // COST-1: what was said tonight, for a session nobody watched. Fired
    // BEFORE the retire loop below, because it reads the seats, the sessions
    // and the voices that are about to be cleared.
    this._writeNightRecap();
    // HOME-STATE-1: same law as _retireSeat — a home game ending is a game
    // ending, not a session ending. Nobody is paid, nobody grows, nobody is
    // told.
    for (let seat = 0; seat < this.maxSeats && !this.home; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      try {
        const buyIn      = this.pending[seat]?.buyIn ?? (this.bigBlind * 100);
        const finalStack = this.seatStacks[seat] ?? this.game?.seats?.[seat]?.stack ?? buyIn;
        const sessionPnl = finalStack - buyIn;
        const watched    = this.spectators.some((s) => s.spectatorSeat === seat);
        const sessionHands = this._seatSessionHands(seat);
        // SERVER-3: one record, two audiences — see _retireSeat.
        const sessionEnd = this._sessionEndFor(seat, {
          reason: this._endReasonFor(seat, { busted: finalStack <= 0 }),
          finalStack, buyIn, sessionHands,
        });
        const agent = finishAgentSession(agentId, this.agentUserIds[seat], {
          recap: recap ?? reason,
          sessionPnl,
          watched,
          sessionHands,
          finalStack,
          buyInAmount: buyIn,
          tableId: this.tableId,
          attrEvidence: this.attrEvidence[seat],   // ATTR-3: growth is drawn from this
          // BIO-2c: he only names an opponent who was actually here.
          seatedPlayerIds: this.pending
            .map((p, i) => (i === seat ? null : p?.playerId ?? null))
            .filter(Boolean),
          sessionEnd,
        });
        this._broadcastSessionEnd(sessionEnd);
        this._notifySessionEnd({
          seat, agentId, agent, buyIn, finalStack, watched, sessionHands,
          busted: finalStack <= 0,
        });
      } catch (err) {
        console.error('[table] finishAgentSession failed:', err.message);
      }
    }
    // SERVER-3: after the ceremony, not before it. TABLE_CLOSED is what a
    // client tears the watch screen down on, and a SESSION_END that arrives
    // behind it arrives to nobody. Same tick, same sockets, so the only thing
    // that changed is the order two messages leave in.
    this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason });
    this.game = null;
    this.actionDeadline = null;
    this._clearTimers();
    console.log(`[table:${this.tableId}] closed after ${this.handsThisSession} hand(s) — ${reason}`);
    this.onEmpty?.(this.tableId);
    this._notifyStateChange();
  }

  // BUG-14 / MST-1: sitting out is SEAT-scoped. The requester's seat folds out
  // of the hand in progress and is freed once that hand completes; everyone
  // else plays on. The table itself only closes when the departure would leave
  // it with fewer than MIN_TO_DEAL seats.
  //
  // Initiated by ClientMsg.SIT_OUT from either a seated player or a spectator
  // (the agent's owner watching it play).
  sitOut(ws) {
    const seated = this.connections.indexOf(ws);
    const spectator = this.spectators.find((s) => s.ws === ws);
    const seat = seated !== -1 ? seated : (spectator ? spectator.spectatorSeat : -1);
    if (seat === -1 || !this.pending[seat]) throw new Error('not at this table');
    return this.sitOutSeat(seat);
  }

  // WALLET-6: the same departure, addressed by seat instead of by socket, for
  // callers that have no WebSocket to speak through -- the wallet benching an
  // agent whose owner just cut him off.
  //
  // The two modes differ only in what happens to the hand in progress:
  //
  //   afterHand: false (the WS SIT_OUT path)  -- a STOP. The seat folds as soon
  //     as it is its turn and is freed when the hand ends. Unchanged.
  //   afterHand: true  (the wallet's bench)   -- he finishes the hand he is in.
  //     No fold, no forfeited chips; the seat is freed the moment the hand
  //     completes and the floor draws him at the bar from there.
  //
  // Between hands the two are the same thing, and both take the immediate path.
  //
  // Returns { pending, seat } while a hand is running, else
  // { pending: false, seat, tableClosed }. Throws if the seat is empty.
  sitOutSeat(seat, { afterHand = false } = {}) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.maxSeats || !this.pending[seat]) {
      throw new Error('not at this table');
    }

    // SERVER-3: whichever way this ends, the OWNER decided it — a WS SIT_OUT
    // from him or his spectator, or the wallet benching a seat he just cut
    // off. Recorded now because a final stack cannot tell you afterwards.
    this.seatEndReason[seat] = 'calledIn';

    const inHand = !!this.game &&
      this.game.street !== Streets.COMPLETE &&
      this.game.street !== Streets.WAITING;
    if (inHand) {
      if (afterHand) this._benchAfterHand.add(seat);
      else this._pendingSitOut.add(seat);
      return { pending: true, seat };
    }

    this.seatLeaving[seat] = true;
    if (this._survivingSeats().length < MIN_TO_DEAL) {
      this.closeTable(RECAP_SIT_OUT, { recap: RECAP_SIT_OUT });
      return { pending: false, seat, tableClosed: true };
    }
    this._reconcileSeats();
    this._notifyStateChange();
    return { pending: false, seat, tableClosed: false };
  }

  // WALLET-6: whether an AI seat should fold out of the hand in progress rather
  // than spend a model call on it. A seat benched *after* the hand is not on
  // this list -- that is the whole point of it.
  _foldsOutOfHand(seat) {
    return this._pendingSitOut.has(seat) || this.seatLeaving[seat];
  }


  // Returns the seat the player got, or throws.
  seatPlayer(ws, { playerId, buyIn, displayName }) {
    // A second player arriving cancels any pending House fallback.
    if (this._houseFallbackTimer && this.pending.some((p) => p !== null)) {
      clearTimeout(this._houseFallbackTimer);
      this._houseFallbackTimer = null;
    }

    const existingSeat = this.pending.findIndex((p) => p?.playerId === playerId);
    if (existingSeat !== -1) {
      // Reconnect: replace the WebSocket on that seat.
      const prev = this.connections[existingSeat];
      if (prev && prev !== ws && prev.readyState === prev.OPEN) {
        prev.close(4000, 'replaced by new connection');
      }
      this.connections[existingSeat] = ws;
      if (displayName) this.pending[existingSeat].displayName = displayName;
      return existingSeat;
    }

    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full');
    if (!Number.isInteger(buyIn) || buyIn < this.bigBlind * 10) {
      throw new Error(`buy-in must be an integer >= ${this.bigBlind * 10}`);
    }
    this.pending[free] = {
      playerId,
      buyIn,
      displayName: (displayName && String(displayName).trim()) || playerId,
    };
    this.connections[free] = ws;
    this.seatStacks[free] = buyIn;
    this.seatLeaving[free] = false;
    this.seatJoinedAtHand[free] = this.handsThisSession;
    return free;
  }

  // Schedule House as opponent if no real opponent joins within HOUSE_FALLBACK_MS.
  // No-op if already scheduled or if 2+ seats are already filled.
  scheduleHouseFallback() {
    if (this._houseFallbackTimer) return;
    if (this.pending.filter((p) => p !== null).length >= 2) return;
    this._houseFallbackTimer = setTimeout(() => {
      this._houseFallbackTimer = null;
      if (this.pending.filter((p) => p !== null).length !== 1) return;
      // If the sole seated participant is a spectated AI agent, look at its
      // profile and pick a complementary House shape so the table produces
      // action instead of a fold-fest.
      const opposingProfile = this.agentProfiles.find((p) => p) ?? null;
      const house = pickComplementaryHouse(opposingProfile);
      console.log(`[table:${this.tableId}] scheduling ${house.displayName} (${house.castMember?.archetype ?? 'House'}) vs opponent T=${opposingProfile?.tightness ?? '?'}`);
      this.maybeAutoSeatAI({
        agentDisplayName: house.displayName,
        agentStrategy:    house.strategy,
        agentId:          null,
        userId:           null,
        memoryContext:    '',
        agentProfile:     house.profile,
        stableId:         house.stableId,
        accentColor:      house.accentColor,
        talkLines:        house.talkLines,
      });
      this.maybeStartHand();
    }, HOUSE_FALLBACK_MS);
  }

  // Seat an AI agent at the first free slot. Called when AI_ENABLED=true.
  seatAI({ displayName = 'Agentic v1', strategy = '', buyIn, agentId = null, userId = null, memoryContext = '', agentProfile = null, stableId = null, accentColor = null, talkLines = null } = {}) {
    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full — cannot seat AI');

    // Match the human player's buy-in if not specified.
    const humanSeat = this.pending.findIndex((p, i) => p !== null && !this.aiSeats[i]);
    const aiBuyIn = buyIn ?? (humanSeat !== -1 ? this.pending[humanSeat].buyIn : this.bigBlind * 100);

    this.pending[free] = {
      // MST-1: playerIds must be unique for the life of the table and stable
      // across compaction -- the button is tracked by playerId, and
      // opponentStats keys its reads on it. `ai_agent_<seat>` was neither:
      // a seat freed and refilled could reissue a live id.
      // HC-1: cast members use a stable `house_<id>` so reads accumulate.
      playerId: agentId
        ? `agent_${agentId}`
        : stableId
          ? `house_${stableId}`
          : `ai_${this.tableId}_${this._seatSeq++}`,
      buyIn: aiBuyIn,
      displayName,
    };
    this.aiSeats[free] = true;
    this.aiStrategy[free] = strategy || process.env.AI_STRATEGY || '';
    this.agentIds[free] = agentId ?? null;
    this.agentUserIds[free] = userId ?? null;
    this.agentMemory[free] = typeof memoryContext === 'string' ? memoryContext : '';
    // FRIDGE-1 § the beer's second half. The flag is CONSUMED here, so one beer
    // colours one session — the next one he plays — and nothing after it. Home
    // games are not sessions (nothing at the kitchen table moves a number the
    // casino reads), so a beer is not spent on one: he takes it to work.
    this.seatDrinking[free] = agentId && !this.home
      ? !!safeTakeDrink(agentId, userId, this.tableId)
      : false;
    const seatedProfile = agentProfile ? normalizeProfile(agentProfile) : null;
    this.agentProfiles[free] = seatedProfile && this.seatDrinking[free]
      // A drink does not change who he is, so the stored profile is untouched;
      // what sat down is a looser version of him for one night.
      ? normalizeProfile({ ...seatedProfile, bluffFreq: seatedProfile.bluffFreq + DRINK_BLUFF_BONUS })
      : seatedProfile;
    this.aiHandsPlayed[free] = 0;
    this.aiRecentHands[free] = [];
    this.aiLastChatHand[free] = -1;
    // HC-1: cast identity (null for player/agent seats)
    this.seatAccentColors[free] = accentColor ?? null;
    this.seatTalkLines[free]    = Array.isArray(talkLines) ? [...talkLines] : null;
    this.seatStacks[free] = aiBuyIn;
    this.seatLeaving[free] = false;
    // MST-1: a seat that arrives mid-session gets credited only with the hands
    // it is actually dealt into.
    this.seatJoinedAtHand[free] = this.handsThisSession;
    // A new session for this seat: fatigue and evidence both start at zero.
    this.attrEvidence[free] = newEvidence();
    this.attrReadSubjects[free] = new Set();
    this._nemesisNoted[free] = false;
    // SERVER-3: a new stay begins. Only an agent gets one -- a House regular
    // has no owner to run a ceremony for and no thread to keep.
    this.seatSessionIds[free] = agentId ? newSessionId() : null;
    this.seatSeatedAt[free] = Date.now();
    this.seatEndReason[free] = null;
    this.seatBiggestPot[free] = 0;
    console.log(`[table:${this.tableId}] AI agent seated at slot ${free} (stack ${aiBuyIn}, model ${process.env.AI_MODEL || 'claude-haiku-4-5'}${agentId ? `, agentId=${agentId}` : ''}${this.agentMemory[free] ? ', memory: yes' : ''}${this.agentProfiles[free] ? `, profile T${this.agentProfiles[free].tightness}/A${this.agentProfiles[free].aggression}` : ''})`);
    return free;
  }

  // SEAT-1a: the posture a seat is holding, for the felt.
  //
  // W4-2's law is "seats as characters": an opponent is somebody sitting there,
  // not a chip with a number on it. The client has drawn the posture since the
  // WATCH v4 port — SeatGhost takes a mood and bobs faster when it is tilted —
  // but the wire never carried one, so every opponent on every table stood
  // neutral. This is the field that was missing.
  //
  // It is the SAME value the owner's own watch header reads (agentView.moodOf →
  // agent.mood.state), taken straight off mood.js with no second mapping. One
  // vocabulary or the felt and the header will drift: confident | neutral |
  // frustrated | tilted | sulking, with heat 0–100 alongside it so a client can
  // tell a 62 from a 94 inside the same band.
  //
  // It is PUBLIC on purpose and carries nothing private: mood is the one thing
  // about an opponent that a person at a real table can see, and the whole
  // point of the layer is that it is visible. What stays owner-scoped is
  // `history` — who he has a grudge against is his business, not the room's.
  //
  // A seat with no agent record — a House regular, a human — has no mood.js
  // state to read, because nothing runs the machine for it. It gets the
  // machine's own resting value rather than an invented one, so the felt shows
  // a level player instead of a hole. (SEAT-1 asked for heat 20; that is inside
  // the CONFIDENT band, which would have made every House bot look pleased with
  // itself. HEAT_MIDPOINT.neutral is the heat that actually reads as neutral,
  // and state and heat agreeing is the invariant worth keeping.)
  _seatMood(seat) {
    const agentId = this.agentIds[seat];
    if (agentId) {
      try {
        const m = getAgentMood(agentId, this.agentUserIds[seat]);
        if (m) {
          const state = MOOD_STATES.includes(m.state) ? m.state : 'neutral';
          return {
            state,
            heat: clampHeat(Number.isFinite(m.heat) ? m.heat : heatForState(state)),
          };
        }
      } catch (err) {
        console.error(`[table:${this.tableId}] seat mood read failed:`, err.message);
      }
    }
    return { state: 'neutral', heat: HEAT_MIDPOINT.neutral };
  }

  // WATCH-8 job 2: how worn this seat is — 'fresh' | 'settled' | 'worn', or
  // null for a seat with no agent behind it. Mood was already public (SEAT-1a:
  // "it is the one thing about an opponent a person at a real table can see");
  // so is this. You can see across a felt that somebody has been sitting there
  // all night. A client that ignores the field sees what it saw before.
  // Memoised per (seat, hand): fatigue is a function of how many hands this
  // seat has played, so it can only move when that number does — and this is
  // read for every seat on every state broadcast, which is far too often to be
  // doing a store lookup and an attribute pass each time.
  _seatFatigue(seat) {
    // Keyed on the occupant as well as the hand count: a seat can change hands
    // between deals, and serving the last agent's fatigue to the next one would
    // be the felt telling a lie about somebody who just sat down.
    const at = `${this.handsThisSession}:${this.agentIds[seat] ?? ''}`;
    const memo = this._fatigueMemo || (this._fatigueMemo = []);
    const hit = memo[seat];
    if (hit && hit.at === at) return hit.value;
    let value = null;
    try {
      value = this._seatAttrs(seat)?.fatigue ?? null;
    } catch (err) {
      console.error(`[table:${this.tableId}] seat fatigue read failed:`, err.message);
    }
    memo[seat] = { at, value };
    return value;
  }

  // ATTR-1: the seat's six attributes after within-session fatigue. Read from
  // the stored agent record rather than plumbed through every seating path, so
  // House seats and player seats (which have no agent) simply get null and
  // every hook falls through to its pre-attribute behaviour.
  _seatAttrs(seat) {
    const agentId = this.agentIds[seat];
    if (!agentId) return null;
    const rec = getAgentAttributes(agentId, this.agentUserIds[seat]);
    if (!rec?.attrs) return null;
    const sessionHands = Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0));
    const attrs = effectiveAttrs(rec, { sessionHands });
    // FRIDGE-1: the drink's cost, applied where fatigue's is — on the way out,
    // never into the record. A man who has had one is less careful tonight and
    // exactly as careful as he was tomorrow.
    if (!attrs || !this.seatDrinking[seat]) return attrs;
    return { ...attrs, DISCIPLINE: Math.max(0, (attrs.DISCIPLINE ?? 0) - DRINK_DISCIPLINE_PENALTY) };
  }

  // ── SERVER-3 · the session ────────────────────────────────────────────────
  //
  // Everything about one agent's STAY at this table: what it is called, what
  // it is worth, and why it ended. A stay is not a table (the table outlives
  // him) and not a hand (he plays many), and until this tree nothing on the
  // wire had a name for it.

  // The buy-in that seat sat down with.
  _seatBuyIn(seat) {
    return this.pending[seat]?.buyIn ?? this.defaultBuyIn();
  }

  // The chips that seat is standing up with. The banked ledger first — it is
  // the one that survives a Game rebuild — then the live Game, then the
  // buy-in, which means "nothing has happened yet".
  _seatFinalStack(seat) {
    return this.seatStacks[seat] ?? this.game?.seats?.[seat]?.stack ?? this._seatBuyIn(seat);
  }

  // Hands HE was dealt into. A seat that sat down at hand 80 of a 100-hand
  // table played 20, not 100.
  _seatSessionHands(seat) {
    return Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0));
  }

  _seatOfAgent(agentId) {
    if (!agentId) return -1;
    return this.agentIds.findIndex((id) => id === agentId);
  }

  // The id of the stay this agent is on here, or null.
  sessionIdFor(agentId) {
    const seat = this._seatOfAgent(agentId);
    return seat === -1 ? null : (this.seatSessionIds[seat] ?? null);
  }

  // The same, addressed by seat — what a watcher gets, because a WATCH that
  // named no agent still lands on a seat and that seat still has a stay.
  sessionIdAtSeat(seat) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.maxSeats) return null;
    return this.seatSessionIds[seat] ?? null;
  }

  // Everything SESSION_END needs about a stay that is still running. POST
  // /finish uses it: that route ends a session from OUTSIDE the table, so
  // without this it would have to invent the four numbers the ceremony prints.
  sessionDetailFor(agentId) {
    const seat = this._seatOfAgent(agentId);
    if (seat === -1 || !this.pending[seat]) return null;
    return {
      sessionId: this.seatSessionIds[seat] ?? null,
      tableId: this.tableId,
      seat,
      hands: this._seatSessionHands(seat),
      net: this._seatFinalStack(seat) - this._seatBuyIn(seat),
      biggestPot: this.seatBiggestPot[seat] ?? 0,
      duration: this._seatDuration(seat),
    };
  }

  _seatDuration(seat) {
    const since = this.seatSeatedAt[seat];
    return since ? Math.max(0, Date.now() - since) : 0;
  }

  // 'bust' and 'allowance' are the two ends of the same event — his stack
  // reached zero — and what tells them apart is whether there is anything
  // behind him. Only the allowance mode can genuinely run out: `auto` refills
  // from the wallet at the next deploy, `topup` is a decision the owner has
  // not been asked for yet, and `cut` is the owner's own doing and reads as
  // calledIn. An allowance is a budget, and running out is the point of it.
  _allowanceGone(seat) {
    const agentId = this.agentIds[seat];
    if (!agentId) return false;
    try {
      const pocket = getAgentPocket(agentId, this.agentUserIds[seat]);
      if (!pocket || pocket.mode !== 'allowance') return false;
      return !canAffordTable(pocket.balance, this.bigBlind);
    } catch (err) {
      console.error(`[table:${this.tableId}] pocket read failed:`, err.message);
      return false;
    }
  }

  // Why this seat's stay ended, in SESSION_END's vocabulary.
  //
  // The money wins. A seat that was on its way out and busted on the last hand
  // busted — that is what happened to it, whatever was already scheduled. Only
  // when the chips are still there does the reason recorded at the moment of
  // the request apply, because that is the half a final stack cannot tell you.
  _endReasonFor(seat, { busted } = {}) {
    if (busted) return this._allowanceGone(seat) ? 'allowance' : 'bust';
    return this.seatEndReason[seat] ?? 'stopped';
  }

  // Build the record ONE way, so the copy that goes on the sessions bus (for
  // the floor) and the copy that goes to this table's sockets (for the
  // ceremony) can never disagree.
  _sessionEndFor(seat, { reason, finalStack, buyIn, sessionHands }) {
    return sessionEndRecord({
      sessionId: this.seatSessionIds[seat] ?? null,
      agentId: this.agentIds[seat],
      userId: this.agentUserIds[seat],
      tableId: this.tableId,
      reason,
      hands: sessionHands,
      net: finalStack - buyIn,
      biggestPot: this.seatBiggestPot[seat] ?? 0,
      duration: this._seatDuration(seat),
    });
  }

  // To every socket at the table. His owner's spectator is the one that runs
  // the ceremony with it; everyone else learns that a seat is standing up,
  // which they were about to be told anyway by SEAT_LEFT or TABLE_CLOSED.
  _broadcastSessionEnd(record) {
    if (!record) return;
    this._broadcast({ type: ServerMsg.SESSION_END, ...sessionEndMessage(record) });
  }

  // ── SERVER-3 · the table thread ───────────────────────────────────────────
  //
  // Every line the watch screen's history sheet shows is written here as it
  // happens, into the thread of every AGENT at the table — each one keeps its
  // own record of the session it is in, because a thread is his, not the
  // room's. Best-effort throughout: thread.js swallows its own failures, and
  // a seat with no session (a House regular, a human) simply has nowhere to
  // write, which is the same thing as not writing.

  _threadTo(seat, kind, who, text, { from = null, to = null, cost = false } = {}) {
    const sessionId = this.seatSessionIds[seat];
    if (!sessionId) return;
    appendThreadLine({
      sessionId,
      agentId: this.agentIds[seat],
      ownerId: this.agentUserIds[seat],
      tableId: this.tableId,
      kind,
      who,
      text,
      // BUGS-B/2: a whisper and its answer are ADDRESSED — owner to him, him
      // back to the owner. Everything else at a felt is said to the room and
      // carries neither, which is the rule thread.js already states.
      from,
      to,
      // WATCH-9: and the room says when an attribute cost him the hand.
      cost,
    });
  }

  // A fact about the felt, in the room's voice — it lands in every agent's
  // thread, because it happened to all of them.
  _threadTable(text) {
    for (let seat = 0; seat < this.maxSeats; seat++) this._threadTo(seat, ThreadKind.TABLE, 'TABLE', text);
  }

  // One seat spoke. His own thread records HIM (or YOU, when the voice is the
  // owner whispering from the spectator socket at his seat); everyone else's
  // records the speaker under his own name.
  _threadSpoken(seat, displayName, text, isAI, { from = null, to = null } = {}) {
    for (let s = 0; s < this.maxSeats; s++) {
      // BUGS-B/2: from/to belong to the SPEAKER's own line. The other seats
      // overheard it; nobody said it to them.
      if (s === seat) this._threadTo(s, isAI ? ThreadKind.HIM : ThreadKind.YOU, isAI ? 'HIM' : 'YOU', text, { from, to });
      else this._threadTo(s, ThreadKind.OPPONENT, displayName, text);
    }
  }

  // An action worth a line. Checks and calls are not: a sheet that records
  // every fold is a log, and the point of the thread is that it reads.
  _threadAction(seat, action) {
    if (!action) return;
    const name = this._seatLabel(seat);
    const amount = Number.isFinite(action.amount) ? Math.round(action.amount) : null;
    const allIn = this.game?.seats?.[seat]?.allIn;
    if (allIn && (action.type === 'bet' || action.type === 'raise' || action.type === 'call')) {
      this._threadTable(`${name} is all in for ${amount ?? this._seatFinalStack(seat)}`);
      return;
    }
    if (action.type === 'bet' && amount !== null) this._threadTable(`${name} bet ${amount}`);
    else if (action.type === 'raise' && amount !== null) this._threadTable(`${name} raised to ${amount}`);
  }

  // RIDERS-1 (REPLAY-1's two exactness gaps): the pot as it stands once the
  // action has landed, and whether that action put the seat all in.
  //
  // The replay timeline had to approximate both — it accumulated a pot by
  // parsing amounts out of action strings and pinned the total to the final
  // figure, and it guessed at all-in from the same strings, so a jam recorded
  // as "raise 1847" played as an ordinary raise and the hold never fired. Both
  // are facts the engine knows at the moment of the act; they only needed
  // writing down.
  //
  // Stamped AFTER game.act, because the pot a viewer sees on that beat is the
  // pot the action created, not the one it walked into.
  _stampDecisionOutcome(idx, seat) {
    const d = this.currentHandDecisions[idx];
    if (!d || d.seat !== seat) return;
    d.pot = this.game?.pot ?? null;
    d.allIn = !!this.game?.seats?.[seat]?.allIn;
  }

  // ATTR-3: the two kinds of evidence that are visible at decision time. The
  // rest (hands, beats survived, bluffs through) can only be known once the
  // hand is over and are counted there.
  _collectAttrEvidence(seat, action, ctx, gs) {
    const ev = this.attrEvidence[seat];
    if (!ev) return;
    addEvidence(ev, decisionEvidence({
      trueEquity: gs.equity,
      seenEquity: ctx.seenEquity,
      deviationDie: ctx.deviationDie,
      inRange: ctx.inRange,
      actionType: action?.type ?? null,
    }));
  }

  hasHumanPlayer() {
    return this.connections.some((c, i) => c !== null && !this.aiSeats[i]);
  }

  // ── COST-1: is anybody actually here? ──────────────────────────────────
  //
  // The one question three separate decisions now hang off: how fast the table
  // deals, whether a hand's talk is written by a model or drawn from a
  // template, and whether the session is written up at the end.
  //
  // "Watched" is a spectator attached OR a human in a seat. It is deliberately
  // the same test _paceHold already makes for the all-in hold, widened by the
  // human seat: a person playing at this table is watching it by definition,
  // and PACE-1 only ignored that because a human seat cannot currently exist
  // on an autonomous table.
  //
  // Derived on every call, never stored. A stored watched-flag is exactly the
  // stale-state lie BUG-16 was, and here it would be a lie about spending.
  isWatched() {
    const watched = this.spectators.length > 0 || this.hasHumanPlayer();
    if (watched) this._everWatched = true;
    return watched;
  }

  // How long before the next deal. See UNWATCHED_HAND_PAUSE_MS.
  _dealPauseMs() {
    // A legacy spectator-created AI table that never became autonomous keeps
    // its old 2.5s tempo — it exists because somebody is looking at it.
    if (!this.autoPlay) return 2500;
    // The kitchen table has its own tempo (HOME_PAUSE_MS, set by homeGame) and
    // its own reason for it. Nothing here second-guesses it.
    if (this.home || this._handPauseNamed) return this.handPauseMs;
    return this.isWatched() ? this.handPauseMs : UNWATCHED_HAND_PAUSE_MS;
  }

  // Attach a watcher to the table.
  //
  // AGE-36: watching is observation, never causation. When the agent is
  // ALREADY seated — the normal case now that /deploy stands the session up
  // server-side — the watcher simply attaches to that seat and receives an
  // immediate snapshot of whatever is happening. It does not seat a second
  // AI, does not schedule a House, and does not deal. (Re-seating on every
  // WATCH is what made entering a running table look like a fresh game —
  // BUG-17.)
  //
  // The legacy path survives for tables that do not exist yet (PvP queue,
  // older clients): there, the spectator's arrival still creates the session.
  // Returns the seat index being watched.
  addSpectator(ws, { agentStrategy, displayName, agentId = null, userId = null, memoryContext = '', agentProfile = null } = {}) {
    const existingSeat = agentId ? this.agentIds.findIndex((id) => id === agentId) : -1;
    const attachSeat = existingSeat !== -1
      ? existingSeat
      // Autonomous table we cannot match by agentId (e.g. a watcher that
      // supplied no agentId): watch the first occupied seat rather than
      // seating anyone new.
      : (this.autoPlay ? this.pending.findIndex((p) => p !== null) : -1);

    if (attachSeat !== -1) {
      this.spectators.push({ ws, spectatorSeat: attachSeat });
      return attachSeat;
    }

    // MATCH-1: WATCH is the other door into a seat — the first watcher seats
    // its agent, the second seats another, and that is how a table assembles
    // itself with nobody deploying. The same law applies to it: not two of one
    // owner's agents at one casino table. It throws rather than returning a
    // seat, because a WATCH that quietly attached the watcher to somebody
    // else's seat would be a worse answer than an error the client can show.
    if (!this.home && this.seatsAgentOfOwner(userId)) {
      throw new Error('another of your agents is already at this table');
    }

    // A second spectator (new agent joining) cancels any pending House fallback.
    if (this._houseFallbackTimer && this.pending.some((p) => p !== null)) {
      clearTimeout(this._houseFallbackTimer);
      this._houseFallbackTimer = null;
    }

    const seat = this.seatAI({
      strategy: agentStrategy || '',
      displayName: displayName || 'Agent',
      agentId,
      userId,
      memoryContext,
      agentProfile,
    });
    this.spectators.push({ ws, spectatorSeat: seat });
    // Schedule House as fallback opponent after HOUSE_FALLBACK_MS if still alone.
    this.scheduleHouseFallback();
    return seat;
  }

  // Push the current table state to a single connection, from `seat`'s point
  // of view. A watcher joining mid-hand gets the hand in progress rather than
  // an empty board and a "Waiting…" placeholder. No-op when no hand has been
  // dealt yet — there is nothing to show.
  // AGE-36: hand a watcher the hand already in progress. PACE-1b: including
  // his agent's equity and read, because this snapshot IS the mid-hand case —
  // a watcher who attaches on the turn saw a dash until somebody acted, which
  // on a checked-down street could be the rest of the hand.
  sendSnapshot(ws, seat) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    if (!this.game) return;
    if (seat < 0 || seat >= this.game.seats.length) return;
    const state = this._augmentState(this.game.getPublicState(seat), seat);
    state.heroEquity = this._heroEquityFor(seat);
    const reads = this._readsFor(seat);
    if (reads) state.reads = reads;
    ws.send(JSON.stringify({
      type: ServerMsg.STATE,
      state,
      legalActions: [],
      yourSeat: seat,
      snapshot: true,
    }));
  }

  // AGE-37: the floor's view of this table for one agent. Returns null unless
  // the session loop is genuinely advancing hands here — that null IS the
  // presence answer, so an agent whose table died reads as resting rather
  // than eternally "playing".
  //
  // `includeHole` must only be true when the caller has proven ownership of
  // the seat. Same law as AGE-33: an agent's hole cards belong to its owner
  // and to nobody else.
  liveGameView(agentId, { includeHole = false } = {}) {
    if (this.closed) return null;
    // Non-autonomous tables that have at least one AI seat self-advance via
    // _scheduleNextHand (isAiOnly guard). Human-only tables never advance on
    // their own; those correctly return null so the agent reads as resting.
    if (!this.autoPlay && !this.isAiOnly()) return null;
    const seat = this.agentIds.findIndex((id) => id === agentId);
    if (seat === -1) return null;
    const g = this.game;
    // MST-1: a seat that joined mid-hand is occupied but not yet in the Game.
    const dealtIn = !!g && seat < g.seats.length;
    const inHand = !!g && g.street !== Streets.WAITING && dealtIn;
    return {
      tableId: this.tableId,
      heroSeat: seat,
      // SERVER-3: the stay this agent is on here — the key his thread and his
      // SESSION_END are both filed under.
      sessionId: this.seatSessionIds[seat] ?? null,
      street: g ? g.street : Streets.WAITING,
      board: inHand ? [...g.community] : [],
      heroHole: includeHole && inHand ? [...(g.seats[seat]?.holeCards ?? [])] : null,
      heroStack: inHand ? (g.seats[seat]?.stack ?? null) : null,
      pot: inHand ? g.pot : 0,
      toAct: inHand ? g.toAct : null,
      actionDeadline: this.actionDeadline ?? null,
      handNumber: g ? g.handNumber : 0,
      dealtIn,
      // SERVER-4: what this stay is WORTH so far — his chips right now minus
      // what he sat down with, signed. The floor's live frame used to carry
      // `heroStack` and nothing to measure it against, so a client that wanted
      // to say "+340" had to remember the buy-in from a message it may never
      // have received. Banked stack first, then the live Game, then the buy-in
      // itself, which is the honest reading of "nothing has happened yet" — so
      // this is 0 between hands rather than null, and it is the same
      // arithmetic SESSION_END's `net` closes the stay with.
      net: this._seatFinalStack(seat) - this._seatBuyIn(seat),
      // SERVER-4: is this table on fire right now? The same flag the lobby's
      // rooms carry, read from the same event window, so the frame on an
      // agent's card and the flame on the room he is in can never disagree.
      // It expires on a clock (HOT_RECENT_MS), which is why it is read here
      // per call rather than stored on the table.
      hot: isHot(this.tableId),
      seatCount: this.seatedCount(),
      maxSeats: this.maxSeats,
      handsThisSession: this.handsThisSession,
      // ATTR-1d: this seat's own session length, which is what fatigue is
      // measured against — a seat that sat down at hand 80 is not 80 hands worn.
      heroSessionHands: Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0)),
      maxHands: this.maxHands,
      blinds: `${this.smallBlind}/${this.bigBlind}`,
      // BIO-2d: `history` is the SeatChip pip — 'nemesis' | 'rival' | 'victim' |
      // null, from THIS agent's point of view. Owner-scoped on the same flag
      // that gates hole cards: another watcher has no business knowing who he
      // has a grudge against.
      seats: g ? g.seats.map((s, i) => ({
        displayName: this.pending[i]?.displayName ?? s.playerId ?? '',
        stack:       s.stack ?? 0,
        accentColor: this.seatAccentColors[i] ?? null,
        // SEAT-1a: { state, heat } — see _seatMood.
        mood:        this._seatMood(i),
        // WATCH-8: 'fresh' | 'settled' | 'worn', or null — see _seatFatigue.
        fatigue:     this._seatFatigue(i),
        // FRIDGE-1: the bottle beside him, for this session only.
        drinking:    !!this.seatDrinking[i],
        history: includeHole && i !== seat && this.pending[i]?.playerId
          ? getAgentBioRole(agentId, this.agentUserIds[seat], this.pending[i].playerId)
          : null,
      })) : [],
    };
  }

  // Auto-seat AI at the free slot when one human is seated. No-op if table is
  // already full or has no human seated.
  maybeAutoSeatAI({ agentStrategy = null, agentDisplayName = null, agentId = null, userId = null, memoryContext = '', agentProfile = null, stableId = null, accentColor = null, talkLines = null } = {}) {
    const humanSeated = this.pending.some((p, i) => p !== null && !this.aiSeats[i]);
    const hasFree = this.pending.some((p) => p === null);
    console.log(`[maybeAutoSeatAI] humanSeated=${humanSeated}, hasFree=${hasFree}, spectators=${this.spectators.length}, agentDisplayName=${agentDisplayName}, agentStrategy=${String(agentStrategy).slice(0, 40)}`);
    if (!hasFree) return;
    if (!humanSeated && this.spectators.length === 0) return;
    if (agentStrategy) this.agentStrategy = agentStrategy;
    this.seatAI({
      displayName: agentDisplayName || undefined,
      strategy: agentStrategy || '',
      agentId,
      userId,
      memoryContext,
      agentProfile,
      stableId,
      accentColor,
      talkLines,
    });
  }

  rename(ws, displayName) {
    const seat = this.connections.indexOf(ws);
    if (seat === -1) throw new Error('connection not seated');
    if (!displayName || !String(displayName).trim()) throw new Error('displayName required');
    this.pending[seat].displayName = String(displayName).trim();
    if (this.game) this._broadcastState();
  }

  // Clears any existing inactivity timer and starts a fresh 60s countdown.
  // Only runs on AI tables; harmless no-op on human vs human.
  // AGE-35: autonomous tables opt out — the session loop's own bounds (hand
  // cap, bust, sit-out) replace the reaper, and a table pausing HAND_PAUSE_MS
  // between hands must not read as "inactive".
  _resetAiInactivityTimer() {
    if (this.autoPlay) return;
    if (!this.aiSeats.some(Boolean)) return;
    if (this._aiInactivityTimer) clearTimeout(this._aiInactivityTimer);
    this._aiInactivityTimer = setTimeout(() => {
      this._aiInactivityTimer = null;
      this.closeTable('Session ended — no activity for 60 seconds', { recap: RECAP_IDLE });
    }, 60_000);
  }

  removeConnection(ws) {
    // Spectator disconnect: remove from spectator list but keep the AI playing.
    const specIdx = this.spectators.findIndex((s) => s.ws === ws);
    if (specIdx !== -1) {
      this.spectators.splice(specIdx, 1);
      // AGE-35/36 (FLR-5): a watcher leaving never recalls the agent. On any
      // AI-only table the game belongs to the server, so the last spectator
      // walking away neither pauses nor closes it. Autonomous tables are
      // bounded by the hand cap; legacy AI-only tables by the 60s reaper,
      // which now retires the agent properly on its way out.
      if (this.autoPlay || this.isAiOnly()) return;
      if (this.connections.every((c) => c === null) && this.spectators.length === 0) {
        if (this._aiInactivityTimer) { clearTimeout(this._aiInactivityTimer); this._aiInactivityTimer = null; }
        if (this._houseFallbackTimer) { clearTimeout(this._houseFallbackTimer); this._houseFallbackTimer = null; }
        this.onEmpty?.(this.tableId);
      }
      return;
    }

    // MST-5: the socket belongs to neither a seat nor a spectator, so it has
    // already been detached — by _retireSeat when its agent sat out, say.
    // Falling through would run the "nobody is left here" cleanup below and
    // drop a table that is still dealing out of the registry, which reads to
    // the floor as every agent at it suddenly resting.
    if (!this.connections.includes(ws)) return;

    let disconnectedWasHuman = false;
    let hadActiveGame = false;
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i] === ws) {
        disconnectedWasHuman = !this.aiSeats[i];
        hadActiveGame = !!(this.game && this.game.street !== Streets.WAITING && this.game.street !== Streets.COMPLETE);
        // For Phase 1 dev simplicity, always release the seat on disconnect so
        // a fresh tab can take it. This means abandoning a tab mid-hand opens
        // the seat back up; proper sit-out / timeout handling is Fredrik's
        // seat-lifecycle queue.
        this._clearSeat(i);
        if (hadActiveGame) {
          this.game = null;
          this._gameRoster = null;
        }
      }
    }

    // Occupied seats stay contiguous from zero, so a middle disconnect shifts
    // everyone above it down. The Game is rebuilt against the new order by the
    // next reconcile.
    this._compactSeats();

    if (disconnectedWasHuman && hadActiveGame && !this.hasHumanPlayer()) {
      // Route through the shared close path so the AI seat's agent is retired
      // (activeTableId cleared) instead of being left pointing at a dead table.
      this.closeTable('Session ended — opponent left', { recap: 'my opponent left the table' });
      return;
    }

    // Same law as the spectator branch: a table the server is driving belongs
    // to the server, and nobody disconnecting retires it.
    if (this.autoPlay || this.isAiOnly()) return;

    if (this.connections.every((c) => c === null) && this.spectators.length === 0) {
      if (this._aiInactivityTimer) {
        clearTimeout(this._aiInactivityTimer);
        this._aiInactivityTimer = null;
      }
      if (this._houseFallbackTimer) {
        clearTimeout(this._houseFallbackTimer);
        this._houseFallbackTimer = null;
      }
      this.onEmpty?.(this.tableId);
    }
  }



  // Called once at least 2 pending players are seated.
  // AGE-36: `clientDriven` marks the calls that originate from a WS client
  // (JOIN / WATCH / DEAL). On ANY AI-only table those never deal — the server
  // owns the tempo, so a watcher arriving mid-pause observes rather than
  // triggers. Tables with a seated human are untouched: they still deal on
  // JOIN and on DEAL exactly as before.
  maybeStartHand({ clientDriven = false } = {}) {
    if (this.closed) return;
    if (clientDriven && (this.autoPlay || this.isAiOnly())) {
      // WV2-1: observation still never deals — but if nothing is driving this
      // AI-only table, hand it to the session loop before backing off.
      this._adoptUndrivenTable();
      return;
    }
    if (this.game && this.game.street !== Streets.COMPLETE && this.game.street !== Streets.WAITING) return;
    // MST-1: joins, departures and busts all land here, between hands. This is
    // the reconciliation the old build-the-Game-once code never did.
    this._reconcileSeats();
    if (this.closed) return;
    if (!this.game || this.game.seats.length < MIN_TO_DEAL) return;

    if (this.game.seats.some((s) => s.stack <= 0)) {
      this.closeTable('a player ran out of chips', { recap: RECAP_BUST });
      return;
    }

    // Reset per-hand state before the new hand.
    this.currentHandDecisions = [];
    this.currentHandActionLog = [];
    this.aiLastChatHand = Array(this.maxSeats).fill(-1);
    this.currentHandStartStacks = this.game.seats.map((s) => s.stack);
    this._raiseCounts = {};
    this._streetAtActionCapture = null;
    this.pace = PACE.CALM;
    this._boardBeforeAct = [];
    this._heroEquity.clear();
    this.actionTimer = null;      // SERVER-3: a new hand, a new clock
    this.game.startHand();
    this._broadcast({ type: ServerMsg.HAND_START, handNumber: this.game.handNumber });
    this._broadcastPace({ force: true });
    // BIO-2c: the roster for this hand is settled, so this is the moment he
    // notices who is across from him.
    for (let seat = 0; seat < this.maxSeats; seat++) this._maybeNemesisSeated(seat);
    this._resetAiInactivityTimer();
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  applyAction(ws, action) {
    if (!this.game) throw new Error('hand not in progress');
    const seat = this.connections.indexOf(ws);
    if (seat === -1) throw new Error('connection not seated');
    const streetBefore = this.game.street;
    this._boardBeforeAct = [...this.game.community];
    this.game.act(seat, action);
    this._incrementRaiseCountIfAggressive(action);
    this._logAction(seat, streetBefore, action);
    this._resetAiInactivityTimer();
    this._broadcastPace();
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  // ── RAISE-1 · raise discipline ─────────────────────────────────────────
  //
  // Playtest: agents re-raising the minimum — +10 into a 400-chip pot — over
  // and over on one street until the stacks were in. Slow, and not poker.
  // Prompt wording never fixed it: a model offered "raise 10–1000" keeps
  // taking the 10. So the table stops offering it, and enforces the same rule
  // on whatever comes back.
  //
  // Two rules, both dialled from pace.js next to PACE_HEAT_BB:
  //
  //   (a) A raise is at least max(min legal raise, currentBet + ⅓ pot), never
  //       above the jam. An agent who cannot afford the floor may still shove:
  //       an all-in is the one raise that is always big enough.
  //   (b) At RAISE_CAP_PER_STREET aggressive actions the street is CAPPED, and
  //       the only raise left is the jam — the offer collapses to call, fold
  //       or all-in, which is how a capped street works in a real cardroom and
  //       is what guarantees the betting round terminates.
  //
  // The offer this returns is what _buildAiGameState puts in the briefing AND
  // what _disciplineAction enforces on the way back in. Deriving it in one
  // place is the point: a floor that only lived in the prompt would be a
  // suggestion, and a floor that only lived in the enforcement would keep
  // showing the agent a size the table intends to overwrite.
  //
  // Everything returned here sits INSIDE the engine's own bet/raise entry:
  // discipline narrows what is legal, it never widens it.
  _raiseOffer(seat, type) {
    const g = this.game;
    if (!g) return null;
    const offer = g.legalActions(seat).find((a) => a.type === type);
    if (!offer) return null;

    const capped = raisesCapped(this._getRaiseCountThisStreet());
    const min = capped
      ? offer.max
      : raiseFloor({
          minLegal: offer.min,
          maxLegal: offer.max,
          pot: g.pot,
          currentBet: g.currentBet,
        });
    return { type, min, max: offer.max, capped, engineMin: offer.min };
  }

  // The final gate. Runs on every AI bet/raise before it reaches the engine,
  // including the ones built from a briefing that predates the current count.
  // Returns the action to actually play.
  _disciplineAction(seat, action) {
    if (!action || (action.type !== 'bet' && action.type !== 'raise')) return action;
    const offer = this._raiseOffer(seat, action.type);
    if (!offer) return action;   // engine will reject it; the fallback path handles that

    const asked = Number.isFinite(action.amount) ? Math.round(action.amount) : offer.engineMin;
    const amount = Math.min(offer.max, Math.max(offer.min, asked));
    if (amount === asked) return action;

    if (offer.capped) {
      console.log(`[agent] street capped at ${raiseCapPerStreet()} raises — ${action.type} ${asked} → all-in ${amount}`);
    } else {
      console.log(`[agent] undersized raise → ${amount}`);
    }
    return { ...action, amount };
  }

  // ── Per-street raise counter + per-hand action log ──────────────────────
  _streetKey() {
    return this.game ? `${this.game.handNumber}:${this.game.street}` : null;
  }
  _incrementRaiseCountIfAggressive(action) {
    const k = this._streetKey();
    if (!k) return;
    if (action?.type === 'raise' || action?.type === 'bet') {
      this._raiseCounts[k] = (this._raiseCounts[k] ?? 0) + 1;
    }
  }
  _getRaiseCountThisStreet() {
    const k = this._streetKey();
    return k ? (this._raiseCounts[k] ?? 0) : 0;
  }
  // Capture actionType against the street it was DECIDED on (not the street
  // Game may have advanced to). Feeds opponentStats in _handCompleted.
  _logAction(seat, street, action) {
    if (!action?.type) return;
    // SERVER-3: every accepted action moves the clock on. Heads-up the same
    // seat can be to act twice in a row across a street boundary, and this is
    // what tells those two turns apart -- see _armActionTimer.
    this._actionSeq++;
    this.currentHandActionLog.push({ seat, street, actionType: action.type });
    this._threadAction(seat, action);
  }

  _handCompleted() {
    this.handsThisSession++;
    this.actionDeadline = null;
    this.actionTimer = null;      // SERVER-3: nobody is on the clock any more
    // SERVER-3: the two things that have to be true of `result` before it goes
    // anywhere. `deltas` the engine already put there; `events` is the
    // hand-end half of the face vocabulary, and the per-seat high-water pot
    // feeds SESSION_END's biggestPot when he eventually stands up.
    if (this.game?.result) {
      this._noteSeatPots(this.game.result);
      this.game.result.events = this._handEndEvents(this.game.result);
      this._threadResult(this.game.result);
    }
    // PACE-1: with a spectator attached and a stack committed, the pot does not
    // move yet — the runout is revealed a card at a time and the finished board
    // is held first. Unwatched, this returns 0 and the hand resolves exactly as
    // it always did: a five-second pause nobody sees is a worse win rate.
    const holdMs = this._paceHold(this.game.result);
    if (holdMs === 0) {
      this._broadcastPace({ pace: PACE.SHOWDOWN });
      this._broadcast({ type: ServerMsg.HAND_RESULT, result: this.game.result });
    }
    // Fire-and-forget per-agent result reports. Snapshot data we need now,
    // because subsequent hands will reset the game's seat state.
    this._reportHandResults(this.game.result);
    this._classifyAndFlagHands(this.game.result);
    this._persistHand();
    this._recordOpponentStats(this.game.result);
    this._updateAgentMoods(this.game.result);
    this._maybeSendAgentTalk(this.game.result);  // TLK-1
    this._updateSeatFatigue();
    // After reporting, evolve any AI's persistent memory every 5 hands.
    this._maybeTriggerMemoryUpdates();
    // MST-1: bank the chips and note where the button goes next BEFORE any
    // seat leaves. Both are read by the reconcile at the next deal.
    this._captureStacks();
    this._recordButton();

    // Seats that asked to sit out during the hand are released now. Both ways
    // off the table land here: the one that folded out of the hand and the one
    // (WALLET-6) that was allowed to play it to the end.
    if (this._pendingSitOut.size > 0) {
      for (const seat of [...this._pendingSitOut]) this.seatLeaving[seat] = true;
      this._pendingSitOut.clear();
    }
    if (this._benchAfterHand.size > 0) {
      for (const seat of [...this._benchAfterHand]) this.seatLeaving[seat] = true;
      this._benchAfterHand.clear();
    }

    // A departure or a bust only ends the TABLE when it can no longer be
    // dealt. With three or more agents seated, one leaving is just a seat
    // opening up -- the rest play on.
    const leaving = this.seatLeaving.some(Boolean);
    const survivors = this._survivingSeats();
    if (survivors.length < MIN_TO_DEAL) {
      // BUGS-B/1: an AGENT still holding chips is not a session that should
      // end. The table emptied out around him — the House busted, or the last
      // other seat stood up — and closing on him reported RECAP_BUST for a man
      // who had just won the pot. He is LONELY, which the house answers by
      // sending regulars over, and only a table that stays alone is closed.
      const strandedAgent = !this.home && survivors.some((seat) => this.agentIds[seat]);
      if (strandedAgent) {
        this._reconcileSeats();
        this._notifyStateChange();
        this._noteLoneliness();
        return;
      }
      const byChoice = leaving && survivors.length + 1 >= MIN_TO_DEAL;
      this.closeTable(byChoice ? RECAP_SIT_OUT : 'a player ran out of chips',
                      { recap: byChoice ? RECAP_SIT_OUT : RECAP_BUST });
      return;
    }
    // AGE-35: the session ends gracefully at the hand cap rather than running
    // up an unbounded model bill on a table nobody may be watching.
    if (this.autoPlay && this.handsThisSession >= this.maxHands) {
      this.closeTable('session hand limit reached', { recap: RECAP_MAX_HANDS });
      return;
    }
    // Free the departed seats now rather than at the next deal, so an owner
    // who sat their agent out sees it resting immediately.
    if (leaving) {
      this._reconcileSeats();
      this._notifyStateChange();
    }
    // Auto-deal when all FILLED seats are AI. On an autonomous table this is
    // the session loop; a legacy spectator-created AI table keeps its old
    // 2.5s tempo until startSessionLoop takes it over.
    if (this.isAiOnly()) {
      this._scheduleNextHand(this._dealPauseMs() + holdMs);
    }
  }

  // SERVER-3: the biggest pot each seat had MONEY IN this session. Per seat,
  // not per table: the ceremony prints his session, and a monster he folded
  // out of preflop was never his. Contribution rather than the delta, because
  // a seat that got its money back in a split still played the pot.
  _noteSeatPots(result) {
    const g = this.game;
    if (!g || !result) return;
    const pot = result.pot ?? 0;
    if (pot <= 0) return;
    for (let seat = 0; seat < g.seats.length && seat < this.maxSeats; seat++) {
      if (!this.agentIds[seat]) continue;
      if ((g.seats[seat]?.contribTotal ?? 0) <= 0) continue;
      if (pot > (this.seatBiggestPot[seat] ?? 0)) this.seatBiggestPot[seat] = pot;
    }
  }

  // One line for the sheet, in the room's voice: who took it and for how much.
  _threadResult(result) {
    if (!result) return;
    const winners = Array.isArray(result.winners) ? result.winners : [];
    if (winners.length === 0) return;
    const names = this._nameList(winners.map((w) => w.seat));
    const pot = result.pot ?? 0;
    this._threadTable(
      result.type === 'showdown'
        ? `${names} won ${pot} at showdown`
        : `${names} took ${pot} uncontested`,
    );
  }

  // ATTR-3: fatigue is a within-session STATE that the record has to carry, so
  // the floor can slump his posture and the card can dip the two bars it
  // touches without asking the table. Written only when the stage actually
  // changes; the crossing into 'worn' is the one time he mentions it, and it
  // never pushes a notification — fatigue fixes itself at the bar.
  _updateSeatFatigue() {
    // HOME-STATE-1: fatigue is the cost side of the attribute curve — it is
    // what a session of work takes out of him — so it is off at home for the
    // same reason growth is. An evening in must not be able to wear him out,
    // and it must not be able to rest him either: the stored stage is left
    // exactly where the casino left it and recovers on its own clock.
    if (this.home) return;
    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      const eff = this._seatAttrs(seat);
      if (!eff) continue;
      const sessionHands = Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0));
      try {
        noteAgentFatigue(agentId, this.agentUserIds[seat], {
          stage: eff.fatigue,
          sessionHands,
          moment: eff.fatigue === 'worn' ? wornMomentFor(sessionHands) : null,
        });
      } catch (err) {
        console.error('[table] fatigue note failed:', err.message);
      }

      // SERVER-3 · the session stop rule. Worn is not a debuff he plays
      // through: he stands up. The ref's line is that he sits at the bar
      // HIMSELF — nobody calls him in, no notification fires, and fatigue
      // fixes itself there. Marking the seat leaving here is enough; we are
      // between hands inside _handCompleted, and the departure check a few
      // lines below either frees the seat or closes the table exactly as it
      // does for a sit-out.
      if (eff.fatigue === 'worn' && !this.seatLeaving[seat]
          && !this._pendingSitOut.has(seat) && !this._benchAfterHand.has(seat)) {
        this.seatLeaving[seat] = true;
        this.seatEndReason[seat] = 'worn';
        console.log(`[table:${this.tableId}] seat ${seat} is worn after ${sessionHands} hand(s) — ending his session`);
      }
    }
  }

  // ── SERVER-3 · the face triggers ──────────────────────────────────────────
  //
  // Six moments a ghost pulls a face for. Three of them are knowable at the
  // moment of a decision and ride DECISION; the other three need the hand to
  // be over and ride result.events. Same vocabulary either way — a client maps
  // one name to one expression and never has to know which message brought it.
  //
  // One face at a time, so both of these return a single trigger and the order
  // inside them IS the priority. A ghost that tried to look stunned and smug
  // at once would look like neither.

  // Was he looking at a premium holding? Deliberately narrow: pairs from tens
  // and the two big broadway aces. A face that fires on a third of hands is
  // wallpaper.
  _isStrongHolding(holeCards) {
    if (!Array.isArray(holeCards) || holeCards.length < 2) return false;
    const a = String(holeCards[0] ?? '')[0];
    const b = String(holeCards[1] ?? '')[0];
    if (!a || !b) return false;
    if (a === b) return STRONG_PAIRS.has(a);
    const RANKS = '23456789TJQKA';
    const hi = RANKS.indexOf(a) >= RANKS.indexOf(b) ? a : b;
    const lo = hi === a ? b : a;
    return STRONG_UNPAIRED.has(`${hi}${lo}`);
  }

  // What this seat is reacting to BEFORE it acts. Called with the game still
  // in its pre-action state; the all-in case is decided after, in the caller,
  // because whether an action commits a stack is a fact about the engine
  // having applied it.
  _decisionEventBefore(seat) {
    const g = this.game;
    const me = g?.seats?.[seat];
    if (!me) return null;
    // His first look at this hand. Preflop the blinds are already in, so
    // "facing a raise" has to mean more than the big blind is out there.
    const firstThisHand = !this.currentHandDecisions.some((d) => d.seat === seat);
    if (firstThisHand && this._isStrongHolding(me.holeCards)) return 'dealtStrong';
    const owed = g.currentBet - me.contribThisStreet;
    const openBar = g.street === Streets.PREFLOP ? this.bigBlind : 0;
    if (owed > 0 && g.currentBet > openBar) return 'raisedAgainst';
    return null;
  }

  // The trigger that actually ships with a decision: whatever he was reacting
  // to before he acted, unless the action committed his stack. Committing the
  // stack outranks everything else he could be feeling, and it is only
  // knowable once the engine has applied the action.
  _decisionEventFor(seat, before) {
    return this.game?.seats?.[seat]?.allIn ? 'allIn' : (before ?? null);
  }

  // What each seat is reacting to once the hand is over. Returns a sparse
  // { [seat]: event } — a seat with nothing to react to is absent rather than
  // carrying a null, so the map is the list of faces to draw.
  _handEndEvents(result) {
    const g = this.game;
    if (!g || !result) return {};
    const out = {};
    const winners = Array.isArray(result.winners) ? result.winners : [];
    const pot = result.pot ?? 0;
    const bigPot = pot > this.bigBlind * BIG_POT_BB;

    for (let seat = 0; seat < g.seats.length; seat++) {
      const won = winners.some((w) => w.seat === seat);
      const mine = this.currentHandDecisions.filter((d) => d.seat === seat);
      if (won) {
        if (bigPot) out[seat] = 'wonBig';
        continue;
      }
      if (mine.length === 0) continue;
      const maxEquity = mine.reduce((m, d) => (Number.isFinite(d.equity) && d.equity > m ? d.equity : m), 0);
      // He got there with the best of it and lost anyway.
      if (result.type === 'showdown' && maxEquity >= BAD_BEAT_EQUITY) { out[seat] = 'badBeat'; continue; }
      // He fired without the goods and somebody looked him up.
      const bluffed = mine.some((d) =>
        (d.action?.type === 'bet' || d.action?.type === 'raise')
        && Number.isFinite(d.equity) && d.equity < THRESHOLDS.BLUFF_MAX_EQUITY);
      if (result.type === 'showdown' && bluffed) out[seat] = 'bluffCaught';
    }
    return out;
  }

  // Feed the just-completed hand to the opponent-stats ring buffer so
  // reads are available to future decisions at this or any other table.
  _recordOpponentStats(result) {
    if (!this.game) return;
    const playerIdsBySeat = this.pending.map((p) => p?.playerId ?? null);
    const displayNamesBySeat = this.pending.map((p) => p?.displayName ?? p?.playerId ?? null);
    const showdownSeats = Array.isArray(result?.showdown)
      ? result.showdown.map((s) => s.seat).filter((n) => Number.isInteger(n))
      : [];
    try {
      recordHandForOpponentStats({
        playerIdsBySeat,
        displayNamesBySeat,
        actionLog: this.currentHandActionLog,
        showdownSeats,
      });
    } catch (err) {
      console.error('[table] opponent stats record failed:', err.message);
    }
  }

  // Detect mood-relevant events from the just-completed hand and update
  // each AI seat's persisted mood. Detects:
  //   wonBigPot            — won a pot > 20BB
  //   lostBigPot           — lost a pot > 20BB
  //   lostAsEquityFavorite — lost the hand while any decision this hand had equity > 0.55
  //   cardDead             — 6th consecutive preflop-fold hand
  //   sessionWinStreak     — 3 wins in a row (fires once per crossing)
  //   sessionLossStreak    — 3 losses in a row (fires once per crossing)
  // When no event fires this hand the decay tick runs instead (drift toward neutral).
  _updateAgentMoods(result) {
    if (!result || !this.game) return;
    const winners = Array.isArray(result.winners) ? result.winners : [];
    const bbSize = this.bigBlind;
    const bigPotThreshold = bbSize * 20;

    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      // MST-1: a seat that joined mid-hand is not in this hand's Game.
      if (!this._seatIsInGame(seat)) continue;
      const currentMood = getAgentMood(agentId, this.agentUserIds[seat]);
      if (!currentMood) continue;
      const profile = this.agentProfiles[seat] ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
      // ATTR-1 hook — COMPOSURE: how hard the beat lands, and how fast he comes back.
      const eff = this._seatAttrs(seat);
      const composure = eff?.COMPOSURE ?? null;
      // SERVER-3: and STAMINA, through the same door. A worn agent takes a
      // beat harder than the same agent an hour earlier — see heatScales.
      const fatigue = eff?.fatigue ?? null;

      const won = winners.some((w) => w.seat === seat);
      const pot = result.pot ?? 0;
      const myDecisions = this.currentHandDecisions.filter((d) => d.seat === seat);

      // Collect fired events for THIS hand. `wonBigPot` and `lostBigPot` are
      // mutually exclusive with each other and with fold-only outcomes.
      const events = [];
      if (won && pot > bigPotThreshold) {
        events.push({ type: 'wonBigPot', ctx: { potChips: pot } });
      }
      if (!won && pot > bigPotThreshold) {
        events.push({ type: 'lostBigPot', ctx: { potChips: pot } });
      }
      if (!won) {
        const maxEquity = myDecisions.reduce((m, d) => Number.isFinite(d.equity) && d.equity > m ? d.equity : m, 0);
        if (maxEquity > 0.55) {
          events.push({ type: 'lostAsEquityFavorite', ctx: { equityPct: Math.round(maxEquity * 100) } });
        }
      }

      // Card-dead streak: any hand where the agent's only decision was a
      // preflop fold. Increment counter; on hitting 6, fire and reset.
      const onlyFoldedPreflop =
        myDecisions.length > 0 &&
        myDecisions.every((d) => d.street === 'preflop' && d.action?.type === 'fold');
      let next = { ...currentMood };
      if (onlyFoldedPreflop) {
        next.cardDeadCount = (next.cardDeadCount ?? 0) + 1;
        if (next.cardDeadCount >= 6) {
          events.push({ type: 'cardDead', ctx: { foldsInARow: next.cardDeadCount } });
          next.cardDeadCount = 0;
        }
      } else if (myDecisions.length > 0) {
        next.cardDeadCount = 0;
      }

      // Session streaks: extend the current run, fire a streak event exactly
      // on the crossing to 3, and then reset that streak counter so it
      // doesn't spam every subsequent hand.
      if (won) {
        next.winStreak = (next.winStreak ?? 0) + 1;
        next.lossStreak = 0;
        if (next.winStreak === 3) {
          events.push({ type: 'sessionWinStreak', ctx: { streak: 3 } });
          next.winStreak = 0;
        }
      } else {
        next.lossStreak = (next.lossStreak ?? 0) + 1;
        next.winStreak = 0;
        if (next.lossStreak === 3) {
          events.push({ type: 'sessionLossStreak', ctx: { streak: 3 } });
          next.lossStreak = 0;
        }
      }

      // Apply each event via the mood machine. Multiple events in one hand
      // apply sequentially; each roll is independent.
      let mood = { ...next };
      for (const ev of events) {
        const before = mood.state;
        mood = applyMoodEvent(mood, ev.type, profile, { context: ev.ctx, composure, fatigue });
        // ATTR-3 evidence: COMPOSURE is trained by surviving beats WITHOUT
        // tilting. The event landed, the state held — that is the survival.
        if ((EVENT_DELTAS[ev.type] ?? 0) < 0 && mood.state === before) {
          this.attrEvidence[seat].tiltSurvived++;
        }
      }
      if (events.length === 0) {
        mood = tickMoodDecay(mood, { composure });
      } else {
        // Any event resets the decay clock.
        mood.uneventfulHands = 0;
      }
      // Preserve streak counters we mutated on `next` (applyEvent copied the
      // record; the counters ride along in the spread).
      mood.winStreak = next.winStreak;
      mood.lossStreak = next.lossStreak;
      mood.cardDeadCount = next.cardDeadCount;

      try {
        setAgentMood(agentId, this.agentUserIds[seat], mood);
      } catch (err) {
        console.error('[table] mood update failed:', err.message);
      }

      // NOTIFY-1: tilt is only worth a ping once it is hot. `tilted` at heat 62
      // is a bad ten minutes; heat 70 is the night going wrong, and the heat is
      // the number the owner can check on the floor.
      //
      // NOTIFY-2: this stays a direct call rather than moving to the bus. A
      // mood is not a floor headline — the ticker has no `tilted` event and
      // should not get one, because "he is steaming" is a thing you may say to
      // a man's owner and not to the room. The legacy notifier's second,
      // looser mood alert (any crossing into tilted OR sulking, once a day per
      // owner) was folded away here; this heat gate is the rule now.
      const prevState = currentMood.state;
      const nextState = mood.state;
      // HOME-STATE-1: he can still tilt at home — the mood machine above ran
      // and his heat moved, because that is character and character is the
      // point. What he does not do is buzz his owner's phone about a friendly
      // game in the living room.
      if (nextState === 'tilted' && prevState !== 'tilted' && mood.heat >= HEAT_TILTED && !this.home) {
        const ownerId = this.agentUserIds[seat];
        if (ownerId) {
          notifyEvent('tilted', {
            ownerId: String(ownerId),
            agentId,
            agentName: this.pending[seat]?.displayName || 'Your agent',
            heat: Math.round(mood.heat),
            cause: mood.cause || null,
          });
        }
      }
    }
  }

  // Persist a per-agent hand summary and update aggregate stats. Best-effort —
  // failures are logged but do not affect the table.
  _reportHandResults(result) {
    if (!result || !this.game) return;
    const handNumber = this.game.handNumber;
    const seatSnapshots = this.game.seats.map((s, i) => ({
      displayName: this.pending[i]?.displayName ?? s.playerId,
      finalStack: s.stack,
      holeCards: [...s.holeCards],
    }));
    const winners = Array.isArray(result.winners) ? result.winners : [];

    // SEAT-1b: a cooler is a fact about the HAND, so it is classified once and
    // both sides are told — the winner dealt it, the loser took it. Read off the
    // showdown rather than off one seat's equity, which is what used to leave
    // `coolersDealt` structurally stuck at 0.
    const coolerHand = classifyCooler({
      result,
      seats: this.game.seats,
      community: this.game.community,
      bigBlind: this.bigBlind,
    });
    if (coolerHand.cooler) {
      console.log(`[table:${this.tableId}] cooler (${coolerHand.reason}): seat(s) ${coolerHand.winners.join(',')} dealt it to ${coolerHand.losers.join(',')}`);
    }

    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      const won = winners.some((w) => w.seat === seat);
      // MST-1: a seat that joined mid-hand is not in this hand's Game.
      if (!this._seatIsInGame(seat)) continue;
      const decisions = this.currentHandDecisions.filter((d) => d.seat === seat);
      // HOME-STATE-1: the split runs right through this loop, and it is the
      // clearest statement of what a home game is. The BIOGRAPHY is written —
      // he remembers who he sat with and what they did to him, which is the
      // reason two agents sharing a flat is worth simulating at all. The
      // EVIDENCE is not, because evidence is what growth is drawn from, and
      // the career record below is not, because a hand at home is not a hand
      // of poker he played for anyone.
      if (!this.home) this._collectHandEvidence(seat, decisions, { won, resultType: result.type });
      this._recordBiographyHand(seat, decisions, { won, result, coolerHand });
      const handSummary = {
        handNumber,
        won,
        potSize: result.pot,
        decisions,
        seats: seatSnapshots,
        timestamp: Date.now(),
      };
      // Mirror the agentProfiles recentHands cap (newest first, last 5 here
      // since the memory-update prompt only ever asks for 5).
      this.aiRecentHands[seat] = [handSummary, ...this.aiRecentHands[seat]].slice(0, 5);

      if (!this.home) {
        try {
          recordHandResult(agentId, this.agentUserIds[seat], {
            won,
            potSize: result.pot,
            decisions,
            handNumber,
            seats: seatSnapshots,
            bb: this.bigBlind,
            holeCards: [...(this.game.seats[seat]?.holeCards ?? [])],
          });
        } catch (err) {
          console.error('[table] result report failed:', err.message);
        }
      }
    }

    // EVENT-1: the hand-end hook. It lives here rather than in _handCompleted
    // because the cooler has already been classified once, a few lines up, and
    // classifying it twice is how two definitions of a cooler get born.
    this._emitCasinoEvents(result, coolerHand);
  }

  // ── EVENT-1 · the floor ticker ─────────────────────────────────
  //
  // Everything a table shouts into the casino-wide bus. Headlines only: names,
  // a type, a pot size. Nothing here may carry a hole card or a reasoning
  // string, because the ticker fans out to every floor subscriber and not just
  // to the owner of the agents in it.
  //
  // Best-effort by construction: the whole thing is wrapped, because a ticker
  // that can break a hand is worse than no ticker.

  _seatLabel(seat) {
    return this.pending[seat]?.displayName ?? this.game?.seats?.[seat]?.playerId ?? `seat ${seat}`;
  }

  _nameList(seats) {
    const names = seats.map((s) => this._seatLabel(s));
    if (names.length <= 1) return names[0] ?? 'someone';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  _agentIdsAt(seats) {
    return seats.map((s) => this.agentIds[s]).filter(Boolean);
  }

  // ── NOTIFY-2 · the owner's half of a headline ────────────────────────────
  //
  // Both of these build records for src/server/notify.js and hand them to
  // emitCasinoEvent as `detail`. They never enter the ring, GET /api/events or
  // the ticker — events.js keeps them on a channel of their own — which is the
  // only reason an owner id and a buy-in may appear in them at all.
  //
  // The TRIGGER rule lives here rather than in the notifier, next to the state
  // that proves it. notify.js is told what happened and decides only whether
  // there is budget to say it.

  // Nothing for a seat the owner is watching: he is looking at the bust as it
  // happens, and the floor headline above already fired for everyone else.
  _bustDetail(seat) {
    const ownerId = this.agentUserIds[seat];
    const agentId = this.agentIds[seat];
    if (!ownerId || !agentId) return [];
    if (this.spectators.some((sp) => sp.spectatorSeat === seat)) return [];
    return [{
      type: 'busted',
      ownerId: String(ownerId),
      agentId,
      agentName: this.pending[seat]?.displayName || 'Your agent',
      buyIn: this.pending[seat]?.buyIn ?? this.defaultBuyIn(),
      hands: Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0)),
      endedAt: Date.now(),
    }];
  }

  // `this.sessionBiggestPot` is still the previous high-water mark here:
  // _classifyAndFlagHands advances it, and it runs after us in _handCompleted.
  // That ordering is what lets both ask flaggedHands the same question and get
  // the same answer, which is why the predicate is imported rather than
  // written out twice.
  _biggestPotDetail(result, pot) {
    if (!isSessionBiggestPot(pot, this.sessionBiggestPot)) return [];
    const out = [];
    for (const w of (Array.isArray(result?.winners) ? result.winners : [])) {
      const seat = w?.seat;
      const agentId = this.agentIds[seat];
      const ownerId = this.agentUserIds[seat];
      if (!agentId || !ownerId) continue;
      out.push({
        type: 'biggest_pot',
        ownerId: String(ownerId),
        agentId,
        agentName: this.pending[seat]?.displayName || 'Your agent',
        pot,
        handNumber: this.game?.handNumber ?? 0,
      });
    }
    return out;
  }

  // The hand is over: what, if anything, was worth shouting about it.
  _emitCasinoEvents(result, coolerHand) {
    // HOME-STATE-1: the ticker is the CASINO's ticker. A big pot at the
    // kitchen table is not floor news, and the `detail` half of these events
    // is the owner's push notification, which a home game does not earn
    // either. One guard covers both because they travel together.
    if (this.home) return;
    const g = this.game;
    if (!g || !result) return;
    try {
      const pot = result.pot ?? 0;
      const potBb = potInBb(pot, this.bigBlind);
      const inHand = [];
      for (let seat = 0; seat < g.seats.length; seat++) {
        if (this._seatIsInGame(seat)) inHand.push(seat);
      }

      // bigPot — three times the pot the felt already calls warm.
      //
      // NOTIFY-2: this is also where the owner hears about the biggest pot of
      // his agent's night. The public headline is about the pot; the `detail`
      // records are about the men who WON it, one per owner, and only when the
      // pot is also the session's high-water mark. Losing the biggest pot of
      // the night is not this message.
      if (potBb >= bigPotThresholdBb() && inHand.length > 0) {
        emitCasinoEvent({
          type: EventType.BIG_POT,
          tableId: this.tableId,
          agentIds: this._agentIdsAt(inHand),
          headline: `${this._nameList(inHand)} played a ${Math.round(potBb)}bb pot`,
          pot,
          handNumber: g.handNumber,
          detail: this._biggestPotDetail(result, pot),
        });
      }

      // cooler — classified once for the whole server, in cooler.js. The
      // winner dealt it, the loser took it, and the headline says so in that
      // order because that is the sentence a person says out loud.
      if (coolerHand?.cooler) {
        emitCasinoEvent({
          type: EventType.COOLER,
          tableId: this.tableId,
          agentIds: this._agentIdsAt([...coolerHand.winners, ...coolerHand.losers]),
          headline: `${this._nameList(coolerHand.winners)} coolered `
            + `${this._nameList(coolerHand.losers)} for ${Math.round(potBb)}bb`,
          pot,
          handNumber: g.handNumber,
        });
      }

      // heater — five of his last six, counted per agent and casino-wide, so
      // it follows him when he changes seats. Fires only on the hand that
      // crossed the line (see noteHandWin).
      const winnerSeats = new Set((result.winners ?? []).map((w) => w.seat));
      for (const seat of inHand) {
        const agentId = this.agentIds[seat];
        if (!agentId) continue;
        const streak = noteHandWin(agentId, winnerSeats.has(seat));
        if (!streak?.crossed) continue;
        emitCasinoEvent({
          type: EventType.HEATER,
          tableId: this.tableId,
          agentIds: [agentId],
          headline: `${this._seatLabel(seat)} has won ${streak.wins} of the last ${streak.hands}`,
          pot,
          handNumber: g.handNumber,
        });
      }

      // bust — a seat with nothing left. The table closes on the next deal,
      // so this fires exactly once per seat by construction, which is what
      // makes it safe to hang the owner's ping off it (NOTIFY-2).
      for (const seat of inHand) {
        if ((g.seats[seat]?.stack ?? 1) > 0) continue;
        emitCasinoEvent({
          type: EventType.BUST,
          tableId: this.tableId,
          agentIds: this._agentIdsAt([seat]),
          headline: `${this._seatLabel(seat)} is out of chips`,
          pot,
          handNumber: g.handNumber,
          detail: this._bustDetail(seat),
        });
      }
    } catch (err) {
      console.error('[table] casino event failed:', err.message);
    }
  }

  // A big pot has reached the river and is still open. Emitted BEFORE the
  // showdown, which is the whole point: a spectator who reads this line has
  // time to open the table and watch the last bet go in.
  _maybeEmitHot() {
    if (this.home) return;   // HOME-STATE-1: nothing at home is floor news
    const g = this.game;
    if (!g || g.street !== Streets.RIVER) return;
    if (this._hotNotedHand === g.handNumber) return;
    const potBb = potInBb(g.pot ?? 0, this.bigBlind);
    if (potBb < hotThresholdBb()) return;

    const live = [];
    for (let seat = 0; seat < g.seats.length; seat++) {
      if (!g.seats[seat].folded) live.push(seat);
    }
    if (live.length < 2) return;

    this._hotNotedHand = g.handNumber;
    try {
      emitCasinoEvent({
        type: EventType.HOT,
        tableId: this.tableId,
        agentIds: this._agentIdsAt(live),
        headline: `${Math.round(potBb)}bb on the river, ${this._nameList(live)} still live`,
        pot: g.pot ?? 0,
        handNumber: g.handNumber,
      });
    } catch (err) {
      console.error('[table] hot event failed:', err.message);
    }
  }

  // BIO-2c: the strongest relationship at this table right now, from this
  // seat's point of view. Nemesis first — it is the loudest of the three.
  _roleAtTable(seat) {
    const agentId = this.agentIds[seat];
    if (!agentId) return null;
    let best = null;
    for (let i = 0; i < this.maxSeats; i++) {
      if (i === seat) continue;
      const pid = this.pending[i]?.playerId;
      if (!pid) continue;
      const role = getAgentBioRole(agentId, this.agentUserIds[seat], pid);
      const who = this.pending[i]?.displayName ?? pid;
      if (role === 'nemesis') return { role, who };
      if (role && !best) best = { role, who };
    }
    return best;
  }

  // BIO-2c: his nemesis sits down. Once per session per seat — the man arriving
  // is one moment, not a state of affairs — and never a notification.
  _maybeNemesisSeated(seat) {
    const agentId = this.agentIds[seat];
    if (!agentId) return;
    if (this._nemesisNoted[seat]) return;
    const bio = getAgentBio(agentId, this.agentUserIds[seat]);
    const nemesis = bio?.nemesis;
    if (!nemesis) return;

    const here = this.pending.some((p, i) => i !== seat && p?.playerId === nemesis.playerId);
    if (!here) return;

    this._nemesisNoted[seat] = true;

    // EVENT-1: the floor hears about it whether or not the mood update below
    // finds a mood to move — the news is that the man sat down.
    // HOME-STATE-1: the NOTICING stays — grudges are on at home, and the mood
    // move below is the whole reason two agents sharing a flat is interesting.
    // Only the shout to the floor is suppressed.
    if (!this.home) {
      try {
        const nemesisSeat = this.pending.findIndex((p, i) => i !== seat && p?.playerId === nemesis.playerId);
        emitCasinoEvent({
          type: EventType.NEMESIS_SEATED,
          tableId: this.tableId,
          agentIds: this._agentIdsAt([seat, nemesisSeat].filter((i) => i >= 0)),
          headline: `${this._seatLabel(seat)} sits down across from ${nemesis.displayName}`,
          pot: 0,
          // WANTS-1: the private half of the same fact. The headline cannot name
          // the player id (EVENT-1 rule 1), and an id is exactly what a grudge is
          // keyed on — so it rides `detail`, the owner-addressed channel NOTIFY-2
          // opened. agentProfiles listens and raises "Marlow is in the back room.
          // Send me." for every agent AT HOME who is down to this man, whoever
          // owns them. Nothing here knows who that is; it only says who sat down.
          detail: [{
            kind: 'nemesisSeated',
            playerId: nemesis.playerId,
            displayName: nemesis.displayName,
            tableId: this.tableId,
            bigBlind: this.bigBlind,
          }],
        });
      } catch (err) {
        console.error('[table] nemesis event failed:', err.message);
      }
    }

    try {
      const current = getAgentMood(agentId, this.agentUserIds[seat]);
      if (!current) return;
      const profile = this.agentProfiles[seat] ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
      const next = applyMoodEvent(current, 'nemesisSeated', profile, {
        context: { opponent: nemesis.displayName },
        composure: this._seatAttrs(seat)?.COMPOSURE ?? null,
      });
      setAgentMood(agentId, this.agentUserIds[seat], next);
      console.log(`[table:${this.tableId}] seat ${seat}: ${nemesis.displayName} sat down — heat ${current.heat} → ${next.heat}`);
    } catch (err) {
      console.error('[table] nemesis-seated event failed:', err.message);
    }
  }

  // BIO-2: one row in the grudge ledger per opponent who was in the hand.
  // Voice only — nothing here can reach an attribute, a band or the strategy,
  // and the ledger is stored on the agent rather than in opponentStats because
  // it is HIS history with them, not the table's record of them.
  _recordBiographyHand(seat, decisions, { won, result, coolerHand = null }) {
    const agentId = this.agentIds[seat];
    if (!agentId) return;
    const g = this.game;
    if (!g) return;

    // SEAT-1b: which side of the cooler this seat was on, if any. Marked
    // PER OPPONENT rather than per hand: in a three-way pot the man who folded
    // the flop did not cooler anybody and does not get the row.
    const dealtCooler = !!coolerHand?.cooler && coolerHand.winners.includes(seat);
    const tookCooler  = !!coolerHand?.cooler && coolerHand.losers.includes(seat);
    const otherSide   = dealtCooler ? coolerHand.losers : tookCooler ? coolerHand.winners : [];

    const opponents = [];
    for (let i = 0; i < g.seats.length; i++) {
      if (i === seat) continue;
      const pid = this.pending[i]?.playerId;
      if (!pid) continue;
      opponents.push({
        playerId: pid,
        displayName: this.pending[i]?.displayName ?? pid,
        cooler: otherSide.includes(i),
      });
    }
    if (opponents.length === 0) return;

    const start = this.currentHandStartStacks[seat];
    const end = g.seats[seat]?.stack;
    const net = Number.isFinite(start) && Number.isFinite(end) ? end - start : 0;
    const showdown = result?.type === 'showdown';

    // A bluff that got caught: he fired with a hand that could not win, and it
    // went to showdown anyway.
    const bluffCaught = showdown && !won && decisions.some(
      (d) => (d.action?.type === 'bet' || d.action?.type === 'raise') &&
             Number.isFinite(d.equity) && d.equity < THRESHOLDS.BLUFF_MAX_EQUITY,
    );

    try {
      recordOpponentHand(agentId, this.agentUserIds[seat], {
        opponents,
        net,
        pot: result?.pot ?? 0,
        won,
        // Per-opponent now; this is the hand-level fallback for a caller that
        // does not classify (nothing in-tree, but the signature keeps it).
        cooler: false,
        bluffCaught,
        showdown,
        handNumber: g.handNumber,
      });
    } catch (err) {
      console.error('[table] biography record failed:', err.message);
    }
  }

  // ATTR-3: the evidence a hand only yields once it is over.
  _collectHandEvidence(seat, decisions, { won, resultType }) {
    const ev = this.attrEvidence[seat];
    if (!ev) return;
    addEvidence(ev, handEvidence({
      decisions, won, resultType, bluffMaxEquity: THRESHOLDS.BLUFF_MAX_EQUITY,
    }));
  }

  // Classify the just-completed hand for each AI seat and store notable ones
  // in the agent's flagged-hands list for the floor's hand-review sheet.
  _classifyAndFlagHands(result) {
    if (!result || !this.game) return;
    const resultType = result.type === 'showdown' ? 'showdown' : 'fold';
    const pot = result.pot ?? 0;
    const winners = Array.isArray(result.winners) ? result.winners : [];

    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      const userId   = this.agentUserIds[seat];
      const won      = winners.some((w) => w.seat === seat);
      const decisions = this.currentHandDecisions.filter((d) => d.seat === seat);

      const flagType = classifyHand({
        won,
        resultType,
        decisions,
        pot,
        sessionBiggestPot: this.sessionBiggestPot,
      });

      // NOTIFY-2: the owner's ping for this used to be emitted here as well.
      // It now rides the bigPot bus event (_biggestPotDetail), which asks
      // isSessionBiggestPot the same question one step earlier — before the
      // line below moves the mark. All that is left here is the mark itself.
      if (flagType === 'biggestPot') this.sessionBiggestPot = pot;
      if (!flagType) continue;
      // COST-1: the same hand, in one sentence, for the end-of-session
      // write-up an unwatched table gets instead of live talk.
      this._noteMoment(seat, flagType, pot, won);

      const holeCards = [...(this.game.seats[seat]?.holeCards ?? [])];

      // Opponent cards revealed at showdown are public. Mucked cards (fold wins)
      // are absent from result.showdown entirely, so they are never stored.
      const opponentShowdownCards = [];
      if (result.type === 'showdown' && Array.isArray(result.showdown)) {
        for (const { seat: sdSeat, holeCards: sdCards } of result.showdown) {
          if (sdSeat !== seat && Array.isArray(sdCards) && sdCards.length > 0) {
            opponentShowdownCards.push({ seat: sdSeat, holeCards: [...sdCards] });
          }
        }
      }

      // ATTR-3: where an attribute actually shaped this hand.
      const attrCosts = attrCostsForHand({ decisions, won });

      const entry = buildFlaggedEntry({
        flagType,
        decisions,
        handNumber: this.game.handNumber,
        pot,
        holeCards,
        won,
        opponentShowdownCards,
        // Only flagged hands carry it — the review sheet is the one surface
        // entitled to say a low attribute cost money, and it says it about him,
        // not about the number.
        attrCosts,
        // HOME-STATE-1: who he was actually playing against, by playerId, so
        // the tape room can file a read under the man rather than under a seat
        // index that will belong to somebody else within the hour.
        opponents: this.pending
          .map((p, i) => (i === seat || !p ? null : {
            seat: i,
            playerId: p.playerId,
            displayName: p.displayName ?? p.playerId,
          }))
          .filter(Boolean),
      });

      try {
        addFlaggedHand(agentId, userId, entry);
      } catch (err) {
        console.error('[table] flagged hand store failed:', err.message);
      }

      // WATCH-9: and it goes into HIS thread, once, as the room saying it.
      //
      // The felt has always drawn this line — WatchScreen composes it from the
      // hand record and marks it gold — but it lived only in a React state
      // array, so a reconnect or a look back an hour later got the sheet back
      // WITHOUT the one line in it that is about him rather than about the
      // cards. Stored, it survives both, and the `cost` flag is what keeps it
      // gold on the way back.
      //
      // The first cost only. attrCostsForHand already caps itself at one entry
      // per attribute, and a thread that reports three of them for one hand is
      // a review sheet, which is a different surface with a different job.
      this._threadAttrCost(seat, attrCosts[0]);
    }
  }

  // The room's gold line: a low attribute cost him this hand. Same text the
  // felt composes for the live row (line · KEY), so the two are one line to the
  // merge rather than the same sentence printed twice.
  _threadAttrCost(seat, cost) {
    if (!cost || cost.cost === false || !cost.line) return;
    const text = [cost.line, cost.key].filter(Boolean).join(' · ');
    this._threadTo(seat, ThreadKind.TABLE, 'TABLE', text, { cost: true });
  }

  // WATCH-9: a line was just stored for this table — push it to the sockets
  // entitled to it, so a sheet that is already open shows it without a refetch.
  //
  // ROUTED BY SEAT, and that is the whole gate. A thread is per SESSION (rule 1
  // in thread.js), and a session belongs to one seat: the room's line about a
  // raise is not one row that everybody reads, it is one row PER SEAT, written
  // into each man's own thread by _threadTable. So the line already names whose
  // thread it is, and delivering it anywhere else would put another man's stay
  // on this screen — sessionId-tagged and therefore discarded, but sent.
  //
  // Privacy falls out of that rather than being a second rule. `him` and `you`
  // carry what the sanitized DECISION payload withholds (BUG-12/15, AGE-33),
  // and the only sockets this reaches are the seat's own connection and the
  // spectators watching that seat — which is exactly who readThread would serve
  // it to.
  //
  // Called by wsServer through thread.js's line listener rather than by the
  // writers here, so the whisper the REST layer stores is pushed on the same
  // path the felt's own lines are.
  deliverThreadLine(line) {
    if (this.closed || !line || line.agentId == null) return;
    const seat = this.agentIds.findIndex((id) => id != null && String(id) === String(line.agentId));
    if (seat < 0) return;
    // A line from a stay that has ended is not this table's business any more.
    if (this.seatSessionIds[seat] !== line.sessionId) return;

    const payload = JSON.stringify({
      type: ServerMsg.THREAD_LINE,
      tableId: this.tableId,
      sessionId: line.sessionId,
      agentId: line.agentId,
      line: {
        id: line.id,
        ts: line.ts,
        kind: line.kind,
        who: line.who,
        text: line.text,
        ...(line.cost ? { cost: true } : {}),
      },
    });

    for (const s of this.spectators) {
      if (s.spectatorSeat !== seat) continue;
      if (s.ws && s.ws.readyState === s.ws.OPEN) s.ws.send(payload);
    }
    const own = this.connections[seat];
    if (own && own.readyState === own.OPEN) own.send(payload);
  }

  // Append a completed-hand record to data/hands-{userId}.json for every
  // human player at the table (AI seats are skipped). Silently no-ops when
  // there are no human seats or when the game result is unavailable.
  _persistHand() {
    const g = this.game;
    if (!g || !g.result) return;

    const result = g.result;
    const winner = result.winners?.[0]?.seat ?? null;
    const reason = result.type === 'showdown' ? 'showdown' : 'fold';

    const holeCards = {};
    g.seats.forEach((s, i) => {
      if (s.holeCards && s.holeCards.length > 0) {
        holeCards[String(i)] = [...s.holeCards];
      }
    });

    const players = g.seats.map((s, i) => ({
      seat: i,
      playerId: this.pending[i]?.playerId ?? s.playerId,
      displayName: this.pending[i]?.displayName ?? s.playerId,
      isAI: this.aiSeats[i] || false,
      startStack: this.currentHandStartStacks[i] ?? 0,
      endStack: s.stack,
    }));

    const hand = {
      id: `hand_${Date.now()}_${this.tableId}`,
      tableId: this.tableId,
      handNumber: g.handNumber,
      completedAt: new Date().toISOString(),
      players,
      result: { winner, pot: result.pot, reason },
      decisions: [...this.currentHandDecisions],
      communityCards: [...(g.community ?? [])],
      holeCards,
    };

    for (let i = 0; i < this.maxSeats; i++) {
      if (!this.pending[i] || this.aiSeats[i]) continue;
      const userId = this.pending[i].playerId;
      try {
        appendHand(userId, hand);
      } catch (err) {
        console.error(`[table] hand persist failed for ${userId}:`, err.message);
      }
    }
  }

  // For each AI seat with an agentId: every hand refresh the computed
  // (deterministic) memory + cached memoryContext. Every 20 hands, also
  // trigger the LLM narrative refresh (fed the computed stats).
  _maybeTriggerMemoryUpdates() {
    // HOME-STATE-1: memory is built out of the hands he played for a living.
    // The narrative refresh is also a model call every twenty hands, and a
    // home game that quietly rewrote his memory of the casino would be both a
    // lie and a bill.
    if (this.home) return;
    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (!this.agentIds[seat]) continue;
      if (!this._seatIsInGame(seat)) continue;
      this.aiHandsPlayed[seat] = (this.aiHandsPlayed[seat] ?? 0) + 1;
      try {
        updateComputedMemory(this.agentIds[seat], this.agentUserIds[seat]);
      } catch (err) {
        console.error('[table] computed memory update failed:', err.message);
      }
      // Refresh the cached memoryContext string (so the next decision picks
      // up the latest computed stats even without a narrative update).
      this._refreshAgentMemory(seat);

      if (this.aiHandsPlayed[seat] > 0 && this.aiHandsPlayed[seat] % 20 === 0) {
        this._triggerMemoryUpdate(seat);
      }
    }
  }

  _triggerMemoryUpdate(seat) {
    const agentId = this.agentIds[seat];
    const userId = this.agentUserIds[seat];
    if (!agentId) return;
    const recentHands = this.aiRecentHands[seat] ?? [];
    console.log(`[table:${this.tableId}] triggering memory update for agent ${agentId} (${recentHands.length} recent hands)`);
    runMemoryUpdate(agentId, userId, recentHands)
      .then((updated) => { if (updated) this._refreshAgentMemory(seat); })
      .catch((err) => console.error('[table] memory update failed:', err.message));
  }

  // Re-read the agent's formatted memoryContext so subsequent decisions pick
  // up the new self-knowledge.
  _refreshAgentMemory(seat) {
    const agentId = this.agentIds[seat];
    if (!agentId) return;
    // Re-check seat still belongs to the same agent — table may have been
    // compacted or re-seated while the async memory update ran.
    if (this.agentIds[seat] !== agentId) return;
    this.agentMemory[seat] = getMemoryContext(agentId, this.agentUserIds[seat]);
    console.log(`[table:${this.tableId}] refreshed memory for seat ${seat} (${this.agentMemory[seat].length} chars)`);
  }

  _broadcastState() {
    // SERVER-3: arm the acting seat's clock BEFORE anything goes out, so every
    // snapshot of this decision carries the same deadline.
    this._armActionTimer();
    const nGameSeats = this.game?.seats.length ?? 0;
    for (let seat = 0; seat < this.connections.length; seat++) {
      const ws = this.connections[seat];
      if (!ws || ws.readyState !== ws.OPEN) continue;
      if (seat >= nGameSeats) continue; // shouldn't happen given the contiguity invariant
      const state = this._augmentState(this.game.getPublicState(seat), seat);
      const legal = this.game.legalActions(seat);
      ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: legal, yourSeat: seat }));
    }
    // Send read-only state to spectators (no legal actions). PACE-1b: the seat
    // a spectator is attached to is his own, so it carries his agent's live
    // equity and his agent's read on the table — the same scoping
    // _broadcastDecision uses for reasoning.
    for (const s of this.spectators) {
      if (!s.ws || s.ws.readyState !== s.ws.OPEN) continue;
      if (s.spectatorSeat >= nGameSeats) continue;
      const state = this._augmentState(this.game.getPublicState(s.spectatorSeat), s.spectatorSeat);
      state.heroEquity = this._heroEquityFor(s.spectatorSeat);
      const reads = this._readsFor(s.spectatorSeat);
      if (reads) state.reads = reads;
      s.ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: [], yourSeat: s.spectatorSeat }));
    }
    this._maybeBroadcastReads();
    this._resetStallWatchdog();
    this._notifyStateChange();
    // Schedule AI turn if applicable ÔÇö async, fire-and-forget.
    this._maybeRunAiTurn().catch((err) =>
      console.error(`[table:${this.tableId}] AI turn error:`, err.message),
    );
  }

  // ── SERVER-3 · the hero's ring ────────────────────────────────────────────
  //
  // The acting seat's deadline, armed the moment that seat becomes the one to
  // act and BEFORE the state that announces it goes out. That ordering is the
  // whole point: the think delay used to be rolled inside _maybeRunAiTurn,
  // which _broadcastState fires AFTER it has already sent the snapshot, so the
  // first frame of every decision carried no deadline at all and a client
  // drawing a countdown had to start its own clock on arrival — off by the
  // network, and wrong again on a reconnect mid-think.
  //
  // Only an AI seat gets a clock. There is no server-side action timer for a
  // human seat yet (Fredrik's seat-lifecycle queue owns that), and a deadline
  // nothing will enforce is worse than no ring: the client would draw it
  // running out and then nothing would happen.
  //
  // Idempotent per (hand, action, seat). The key includes _actionSeq because
  // heads-up the same seat legitimately acts twice in a row across a street
  // boundary, and re-arming would have restarted his ring mid-think while
  // leaving it stale would have handed him the previous street's clock.
  _armActionTimer() {
    const g = this.game;
    const seat = g?.toAct;
    const live = g && g.street !== Streets.COMPLETE && g.street !== Streets.WAITING;
    if (!live || seat === null || seat === undefined || !this.aiSeats[seat]) {
      this.actionTimer = null;
      this.actionDeadline = null;
      return null;
    }
    const key = `${g.handNumber}:${this._actionSeq}:${seat}`;
    if (this.actionTimer?.key === key) return this.actionTimer;
    const totalMs = Math.round(THINK_MIN_MS + Math.random() * THINK_SPREAD_MS);
    this.actionTimer = { key, seat, deadlineTs: Date.now() + totalMs, totalMs };
    // AGE-37's advisory field is the same clock; the floor's LiveBar reads it.
    this.actionDeadline = this.actionTimer.deadlineTs;
    return this.actionTimer;
  }

  // The wire shape — the internal key never leaves the server.
  _actionTimerPayload() {
    if (!this.actionTimer) return null;
    const { seat, deadlineTs, totalMs } = this.actionTimer;
    return { seat, deadlineTs, totalMs };
  }

  _notifyStateChange() {
    if (!this.onStateChange) return;
    try { this.onStateChange(this); }
    catch (err) { console.error(`[table:${this.tableId}] state hook failed:`, err.message); }
  }

  // Augment state with display names from Table metadata.
  // `forSeat` is the seat this snapshot was filtered for — SERVER-3's
  // sessionId is that seat's stay, not the table's.
  _augmentState(state, forSeat = null) {
    state.seats = state.seats.map((s, i) => ({
      ...s,
      displayName: this.pending[i]?.displayName || s.playerId,
      // SEAT-1a: the posture the felt draws. On the STATE snapshot as well as
      // on liveGameView, because WatchScreen builds its seat ring from STATE —
      // a mood that only rode the poll would never reach a SeatGhost.
      mood: this._seatMood(i),
      // WATCH-8: and how worn he is, for the second of the two body bars.
      fatigue: this._seatFatigue(i),
      // FRIDGE-1: he had a beer before this one. Public, like the posture is —
      // a bottle on the felt is the sort of thing everybody at a table can see.
      drinking: !!this.seatDrinking[i],
    }));
    // PACE-1: the ladder rides every snapshot as well as its own message, so a
    // client that joins mid-hand is not calm until the next transition.
    state.pace = this.pace ?? PACE.CALM;
    state.potBb = potInBb(state.pot ?? this.game?.pot ?? 0, this.bigBlind);
    // SERVER-3: the acting seat's deadline, so the client draws the ring the
    // server is actually keeping rather than one it started on arrival. Null
    // when nobody is to act and null for a human seat -- see _armActionTimer.
    state.actionTimer = this._actionTimerPayload();
    // SERVER-3: which stay this seat is on. The key SESSION_END and
    // GET /api/agents/:id/thread are both filed under, so a client that
    // reconnects mid-session can ask for the thread it was reading.
    state.sessionId = Number.isInteger(forSeat) ? (this.seatSessionIds[forSeat] ?? null) : null;
    return state;
  }

  _broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const ws of this.connections) {
      if (ws && ws.readyState === ws.OPEN) ws.send(payload);
    }
    for (const s of this.spectators) {
      if (s.ws && s.ws.readyState === s.ws.OPEN) s.ws.send(payload);
    }
  }

  // ── PACE-1b: what the owner's spectator sees ───────────────────────────
  // The seat a spectator is attached to is his own — the same rule
  // _broadcastDecision has always used to decide who may see reasoning and
  // equity. Neither of the two payloads below goes anywhere else.

  // Hero equity, from the deal rather than from the first decision. The felt
  // shows a live percentage; before this it showed a dash until the agent
  // acted, which on a folded-round street could be the whole hand.
  //
  // Cached per (hand, board, seat): equity only moves when a card lands, and
  // 800 iterations on every broadcast for every watcher is a real cost.
  _heroEquityFor(seat) {
    const g = this.game;
    if (!g || seat == null || seat < 0 || seat >= g.seats.length) return null;
    const me = g.seats[seat];
    if (!me || me.folded || !Array.isArray(me.holeCards) || me.holeCards.length < 2) return null;
    if (g.street === Streets.WAITING) return null;

    const key = `${g.handNumber}:${g.community.length}:${seat}`;
    if (this._heroEquity.has(key)) return this._heroEquity.get(key);

    const activeOpponents = g.seats.filter((s, i) => i !== seat && !s.folded).length;
    let equity = null;
    try {
      equity = estimateEquity({
        holeCards: me.holeCards,
        community: g.community,
        nOpponents: Math.max(1, activeOpponents),
        iterations: 800,
      }).equity;
    } catch (err) {
      console.warn(`[table:${this.tableId}] hero equity failed:`, err.message);
    }
    this._heroEquity.set(key, equity);
    return equity;
  }

  // His picture of everyone else at the table, gated by exactly the evidence
  // bar the briefing uses — so the panel can never show a read he is not
  // already playing with.
  _readsFor(seat) {
    // An AI seat, not necessarily a STORED agent: a watcher who arrives with no
    // agentId still gets a seat and still forms reads, and gating this on a
    // saved record would leave that panel permanently blank. Without a record
    // there are no attributes either, so the evidence bar falls back to the
    // same default the briefing uses.
    if (!this.aiSeats[seat]) return null;
    const attrs = this._seatAttrs(seat);
    const out = [];
    for (let i = 0; i < this.maxSeats; i++) {
      if (i === seat) continue;
      const pid = this.pending[i]?.playerId;
      if (!pid) continue;
      const panel = readPanel(getOpponentRead(pid), {
        reads: attrs?.READS ?? null,
        deception: this._seatAttrs(i)?.DECEPTION ?? null,
      });
      out.push({ ...panel, seat: i, displayName: panel.displayName ?? this.pending[i]?.displayName ?? pid });
    }
    return out.length > 0 ? out : null;
  }

  // A READ message when the picture changes — a read forming is an event, and
  // the panel animates on it. Silent otherwise, however often state is pushed.
  _maybeBroadcastReads() {
    for (const spec of this.spectators) {
      if (!spec.ws || spec.ws.readyState !== spec.ws.OPEN) continue;
      const seat = spec.spectatorSeat;
      const reads = this._readsFor(seat);
      if (!reads) continue;
      const fingerprint = reads.map((r) => `${r.playerId}:${r.formed ? 1 : 0}:${r.shape ?? ''}`).join('|');
      if (this._readFingerprint.get(seat) === fingerprint) continue;
      this._readFingerprint.set(seat, fingerprint);
      spec.ws.send(JSON.stringify({ type: ServerMsg.READ, tableId: this.tableId, seat, reads }));
    }
  }

  // ── PACE-1 ──────────────────────────────────────────────────────────────
  // Is a seat that is still in the hand all-in, and can anyone still act?
  _allInState() {
    const g = this.game;
    if (!g) return { anyAllIn: false, actionClosed: false };
    const live = g.seats.filter((s) => !s.folded);
    const anyAllIn = live.some((s) => s.allIn);
    const canAct = live.filter((s) => !s.allIn);
    return { anyAllIn, actionClosed: canAct.length <= 1 };
  }

  // Recompute the ladder and broadcast it if it advanced. The client is TOLD
  // the state — it never derives it from the pot, so two watchers warm the felt
  // on the same hand.
  _broadcastPace({ force = false, pace = null, board = null, card = null } = {}) {
    // EVENT-1: the action-time hook. _broadcastPace already runs after every
    // applied action (and once at each deal) on both the human and the AI
    // path, so hanging the live event off it costs one call and no new
    // plumbing. It sits above the "did the ladder advance" early return: a
    // river bet that does not move the ladder can still be the bet that makes
    // the pot worth walking over to.
    this._maybeEmitHot();
    const g = this.game;
    const potChips = g?.pot ?? 0;
    const { anyAllIn, actionClosed } = this._allInState();
    const next = pace ?? paceFor({
      potChips,
      bigBlind: this.bigBlind,
      anyAllIn,
      actionClosed,
      revealed: g?.street === Streets.SHOWDOWN,
    });
    const advanced = advancePace(this.pace, next);
    if (!force && advanced === this.pace && !card) return this.pace;
    this.pace = advanced;
    const msg = {
      type: ServerMsg.PACE,
      tableId: this.tableId,
      pace: this.pace,
      potBb: potInBb(potChips, this.bigBlind),
    };
    if (board) msg.board = [...board];
    if (card) msg.card = card;
    this._broadcast(msg);
    return this.pace;
  }

  // The staged beat: his line lands, three to five seconds of nothing, the
  // runout a card at a time, the finished board held, and only then the pot.
  // Returns 0 when there is nothing to stage, so the caller carries on as before.
  _paceHold(result) {
    if (!result) return 0;
    const watched = this.spectators.length > 0;
    const { anyAllIn } = this._allInState();
    if (!watched || !anyAllIn) return 0;

    const finalBoard = [...(this.game?.community ?? [])];
    const heldBoard = this._boardBeforeAct.slice(0, finalBoard.length);
    const runout = finalBoard.slice(heldBoard.length);

    const plan = holdPlan({
      heldBoard,
      runout,
      seed: seedFor(this.tableId, this.game?.handNumber ?? 0),
      watched: true,
    });
    if (plan.frames.length === 0) return 0;

    for (const f of plan.frames) {
      const t = setTimeout(() => {
        if (this.closed) return;
        this._broadcastPace({ pace: f.pace, board: f.board, card: f.card });
      }, f.at);
      t.unref?.();
      this._paceTimers.push(t);
    }
    const award = setTimeout(() => {
      if (this.closed) return;
      this._broadcast({ type: ServerMsg.HAND_RESULT, result });
    }, plan.awardAt);
    award.unref?.();
    this._paceTimers.push(award);

    console.log(`[table:${this.tableId}] pace hold ${plan.holdMs}ms + ${runout.length} card(s) → award at ${plan.awardAt}ms`);
    return plan.totalMs;
  }

  // BUG-12 / BUG-15: an AI seat's reasoning/equity are secret from every
  // seat except its own owner. Seated players get the bare {seat, action}
  // payload. Spectators get the FULL payload only for the seat they are
  // watching (their spectatorSeat); other seats' decisions arrive
  // sanitized. Full record is still kept in currentHandDecisions for
  // replay/analysis by the seat's owner.
  _broadcastDecision({ seat, action, reasoning, equity, potOdds, event = null }) {
    // SERVER-3: `event` is on BOTH payloads. A face is as public as the action
    // that caused it -- the room can see a man look at his cards and stiffen --
    // which is the same line SEAT-1a's mood draws. What stays owner-only is
    // WHY, which is the reasoning, and that has not moved.
    const fullPayload = JSON.stringify({
      type: ServerMsg.DECISION, seat, action, reasoning, equity, potOdds, event,
    });
    const sanitizedPayload = JSON.stringify({
      type: ServerMsg.DECISION, seat, action, event,
    });
    // SERVER-3: his read, in his own voice, into his own thread. It is the
    // same content the sanitized payload withholds, and readThread applies the
    // same ownership rule on the way back out.
    if (typeof reasoning === 'string' && reasoning.trim()) {
      this._threadTo(seat, ThreadKind.HIM, 'HIM', reasoning);
    }
    for (const ws of this.connections) {
      if (ws && ws.readyState === ws.OPEN) ws.send(sanitizedPayload);
    }
    for (const s of this.spectators) {
      if (!s.ws || s.ws.readyState !== s.ws.OPEN) continue;
      s.ws.send(s.spectatorSeat === seat ? fullPayload : sanitizedPayload);
    }
  }

  // ÔöÇÔöÇ Table chat ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

  // Push a chat line into history and broadcast it to every WS at the table
  // (seated players + spectators). Empty / whitespace-only lines are dropped.
  // Lines are clamped to 280 characters.
  sendChat(seat, text, isAI = false, { from = null, to = null } = {}) {
    if (typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, 280);
    if (!trimmed) return;
    const displayName = this.pending[seat]?.displayName ?? `Seat ${seat}`;
    const entry = {
      seat,
      displayName,
      text: trimmed,
      isAI: !!isAI,
      timestamp: Date.now(),
    };
    this.chatHistory.push(entry);
    if (this.chatHistory.length > 20) {
      this.chatHistory = this.chatHistory.slice(-20);
    }
    // SERVER-3: into the thread as well as onto the wire. His own line is HIM
    // (or YOU, when the voice is the owner whispering from the spectator
    // socket attached to his seat); everybody else's is filed under the name
    // the felt shows.
    this._threadSpoken(seat, displayName, trimmed, entry.isAI, { from, to });
    this._broadcast({
      type: ServerMsg.CHAT,
      seat,
      displayName,
      text: trimmed,
      isAI: entry.isAI,
    });
  }

  // ── BUGS-B/2 · the whisper ────────────────────────────────────────────────
  //
  // The owner leaning in while a hand is running. It is not table chat and it
  // is not the CHATS thread: it is a private line to ONE seat, answered by the
  // man in it, in his voice, knowing what is on the board right now.
  //
  // Three things the shape of this comes from:
  //
  //   1. IT IS ADDRESSED. Owner → him, and him → owner. Every other line at a
  //      felt is said to the room and carries no from/to; these two carry
  //      both, which is what lets the sheet draw "YOU → GRANITE".
  //   2. WHAT YOU SAID IS YOURS. The whisper itself is written into HIS thread
  //      only — no other seat heard it, and no other seat's sheet gets it. His
  //      ANSWER is out loud, so it goes on the wire as an ordinary CHAT bubble
  //      over his head, exactly as his trash talk does.
  //   3. IT NEVER BREAKS A HAND. Everything here is best-effort and returns
  //      null rather than throwing: a whisper that can wedge a table is worse
  //      than a whisper that goes unanswered.

  /** The seat this agent is sitting in, or null. */
  seatOfAgent(agentId) {
    if (!agentId) return null;
    const seat = this.agentIds.findIndex((id) => id === agentId);
    return seat === -1 || !this.pending[seat] ? null : seat;
  }

  /**
   * What he needs to know to answer you: where this hand is, right now.
   *
   * His own cards are in it because they are his — this is only ever built for
   * a caller that has already proved it owns the seat. Nobody else's are.
   */
  whisperContext(agentId) {
    const seat = this.seatOfAgent(agentId);
    if (seat === null) return null;
    const g = this.game;
    const dealtIn = !!g && seat < g.seats.length;
    const inHand = !!g && g.street !== Streets.WAITING && dealtIn;
    return {
      tableId: this.tableId,
      seat,
      displayName: this.pending[seat]?.displayName ?? null,
      blinds: `${this.smallBlind}/${this.bigBlind}`,
      handNumber: g ? g.handNumber : 0,
      // Between hands is a real answer, and a better one than pretending a
      // board exists: "we are shuffling" is something he can say.
      street: inHand ? g.street : Streets.WAITING,
      inHand,
      board: inHand ? [...g.community] : [],
      holeCards: inHand ? [...(g.seats[seat]?.holeCards ?? [])] : [],
      pot: inHand ? g.pot : 0,
      stack: dealtIn ? (g.seats[seat]?.stack ?? null) : this.seatStack(seat),
      toAct: inHand ? g.toAct : null,
      yourTurn: inHand && g.toAct === seat,
      opponents: this.pending
        .map((p, i) => (i === seat || !p ? null : (p.displayName ?? null)))
        .filter(Boolean),
      handsThisSession: this.handsThisSession,
    };
  }

  /**
   * The owner's line into the felt. Stored in HIS thread and nobody else's.
   * Returns the seat it landed at, or null when he is not sitting here.
   */
  receiveWhisper(agentId, text) {
    const seat = this.seatOfAgent(agentId);
    if (seat === null || typeof text !== 'string' || !text.trim()) return null;
    this._threadTo(seat, ThreadKind.YOU, 'YOU', text, { from: THREAD_OWNER, to: agentId });
    return seat;
  }

  /**
   * His answer: a bubble over his head, and a HIM line addressed back to you.
   * Returns the seat, or null.
   */
  whisperReply(agentId, text) {
    const seat = this.seatOfAgent(agentId);
    if (seat === null || typeof text !== 'string' || !text.trim()) return null;
    this.sendChat(seat, text, true, { from: agentId, to: THREAD_OWNER });
    return seat;
  }

  // ── COST-1 · what gets said, and what it costs ──────────────────────────
  //
  // Table talk used to be priced per remark: every trigger fired its own model
  // call, with its own full prompt, to write one sentence about a hand it had
  // to be told about from scratch. Three agents at a lively table could spend
  // three calls SAYING things about a hand that had already cost three calls
  // to PLAY.
  //
  // Now there are three ways a line gets said and only one of them costs
  // anything:
  //
  //   INSTANT   the fold and the check that cannot wait — templates, from
  //             policyPlay.instantLine on the free path, and from the model's
  //             own optional `say` on the decision call, which rides a call
  //             that was happening anyway. Both are free.
  //   PER HAND  everything that is allowed to arrive late. One call, at the
  //             end of the hand, writing a line for every seat that had
  //             something to say — and only on a table somebody is watching.
  //             See handTalk.js.
  //   TEMPLATE  what an unwatched table and the kitchen table say instead,
  //             which is exactly what TLK-1 always said.

  // One spoken line per agent per hand, wherever it came from. The cap is the
  // same one the old trash-talk path enforced and it is enforced in one place
  // now, so `say` and the per-hand writer cannot both put a bubble over the
  // same face in the same hand.
  _speakOnce(seat, text) {
    if (typeof text !== 'string' || !text.trim()) return false;
    if (!this.aiSeats[seat] || !this.pending[seat]) return false;
    const hand = this.game?.handNumber ?? -1;
    if (this.aiLastChatHand[seat] === hand) return false;
    this.aiLastChatHand[seat] = hand;
    this.sendChat(seat, text, true);
    return true;
  }

  // Somebody spoke at the table — an owner whispering from a spectator socket,
  // or a human in a seat. This is where a model call per remark used to be:
  // one call per AI seat, per typed message, to answer a sentence.
  //
  // It answers in the hand instead. The line is queued as TLK-1's needle,
  // which the briefing already carries and which router.js reads as a reason
  // to spend (Reason.TALK) — so his next decision goes to the model holding
  // both the spot and what was said to him, and answers with the `say` field
  // on a call that was going to happen anyway. He replies in character, about
  // the hand he is actually in, for nothing.
  //
  // House regulars have no model behind them and never did: they answer from
  // their own pre-written lines (HC-1), immediately, which is the whole reason
  // those lines exist.
  _hearFromTable(text, fromSeat = -1) {
    const line = typeof text === 'string' ? text.trim().slice(0, 280) : '';
    if (!line) return;
    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (seat === fromSeat) continue;
      if (!this.aiSeats[seat] || !this.pending[seat]) continue;
      const cast = this.seatTalkLines?.[seat];
      if (Array.isArray(cast) && cast.length > 0) {
        this._speakOnce(seat, cast[Math.floor(Math.random() * cast.length)]);
        continue;
      }
      // Last one in wins: he answers what was just said to him, not what was
      // said three messages ago.
      this.pendingNeedle[seat] = line;
    }
  }

  // TLK-1 + COST-1: after each hand, work out who has something to say.
  //
  // The trigger detection is TLK-1's, unchanged — it is the part that decides
  // whether a hand produced a moment at all, and it was always free. What
  // changed is what happens next: an unwatched table (and the kitchen table,
  // always) draws a template line exactly as before, and a WATCHED table hands
  // every triggered seat to one model call.
  //
  // Needles susceptible AI opponents: sets pendingNeedle + fires the needled
  // mood event once per session per seat, off the FIRST speaker only. Bounded
  // for the same reason it always was — one needle per hand is a table with
  // needling in it, and four is a table nobody can follow.
  _maybeSendAgentTalk(result) {
    if (!result || !this.game) return;
    const handNumber = this.game.handNumber;
    const winners = Array.isArray(result.winners) ? result.winners : [];
    const pot = result.pot ?? 0;
    const bigPotThreshold = this.bigBlind * 20;
    // COST-1: a watched table lets every triggered seat speak, because one
    // call covers all of them. Unwatched keeps TLK-1's one-agent-per-hand cap,
    // because there each line is a separate template and four of them in one
    // hand is noise in a log nobody is reading.
    const watched = this.isWatched() && !this.home;
    const spoke = [];

    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (!this.aiSeats[seat] || !this.pending[seat]) continue;
      if (!this._seatIsInGame(seat)) continue;

      const myDecisions = this.currentHandDecisions.filter((d) => d.seat === seat);

      // Always update the preflop-fold streak so it stays accurate even when
      // rate-limited.
      const onlyFoldedPreflop =
        myDecisions.length > 0 &&
        myDecisions.every((d) => d.street === 'preflop' && d.action?.type === 'fold');
      if (onlyFoldedPreflop) {
        this._prefoldStreakBySeat[seat] = (this._prefoldStreakBySeat[seat] ?? 0) + 1;
      } else if (myDecisions.length > 0) {
        this._prefoldStreakBySeat[seat] = 0;
      }

      // Rate limit: per-agent gap, and (unwatched only) one agent per hand.
      const lastTalkHand = this._talkLastHandBySeat[seat] ?? -1;
      if (handNumber - lastTalkHand < TALK_INTERVAL_HANDS) continue;
      if (!watched && this._talkHandNumber === handNumber) continue;
      // He has already spoken this hand — a `say` on his decision, or an
      // instant template. Two bubbles from one face in one hand is one too
      // many, whichever path produced them.
      if (this.aiLastChatHand[seat] === handNumber) continue;

      const won = winners.some((w) => w.seat === seat);
      const trigger = this._talkTriggerFor(seat, { won, result, pot, bigPotThreshold });
      if (!trigger) continue;

      this._talkHandNumber = handNumber;
      this._talkLastHandBySeat[seat] = handNumber;
      if (trigger === 'cardDead') this._prefoldStreakBySeat[seat] = 0;
      spoke.push({ seat, trigger, won });

      if (!watched) break;   // one template line per hand, as it always was
    }

    if (spoke.length === 0) return;

    // The needle rides the first speaker either way, and it is handed the LINE
    // rather than left to find it: on the model path the line does not exist
    // yet when this returns, so reading it back off chatHistory here would
    // needle the table with whatever somebody said three hands ago.
    if (watched) this._talkWithModel(spoke, result);
    else this._needleOpponents(spoke[0].seat, this._talkFromTemplates(spoke));
  }

  // TLK-1's four triggers, in priority order, unchanged.
  _talkTriggerFor(seat, { won, result, pot, bigPotThreshold }) {
    if ((this._prefoldStreakBySeat[seat] ?? 0) >= 3) return 'cardDead';
    if (won && pot > bigPotThreshold) return 'wonBigPot';

    const myDecisions = this.currentHandDecisions.filter((d) => d.seat === seat);
    if (!won && result.type === 'showdown') {
      const maxEquity = myDecisions.reduce(
        (m, d) => Number.isFinite(d.equity) && d.equity > m ? d.equity : m, 0,
      );
      if (maxEquity > 0.60) return 'lostAsFavorite';
    }

    if (won && result.type === 'showdown') {
      for (let oppSeat = 0; oppSeat < this.maxSeats; oppSeat++) {
        if (oppSeat === seat || !this.pending[oppSeat]) continue;
        const oppDecisions = this.currentHandDecisions.filter((d) => d.seat === oppSeat);
        for (const d of oppDecisions) {
          if (
            (d.action?.type === 'bet' || d.action?.type === 'raise') &&
            Number.isFinite(d.equity) && d.equity < 0.38
          ) return 'shownBluff';
        }
      }
    }
    return null;
  }

  // The free path: TLK-1's template pools, in his mood, naming whoever at this
  // table is somebody to him.
  _talkFromTemplates(spoke) {
    let first = null;
    for (const { seat, trigger } of spoke) {
      const agentId = this.agentIds[seat];
      const mood = agentId ? getAgentMood(agentId, this.agentUserIds[seat]) : null;
      const rel = this._roleAtTable(seat);
      const line = pickTalkLine(trigger, mood?.state ?? 'neutral', {
        heat: mood?.heat ?? null,
        role: rel?.role ?? null,
        who: rel?.who ?? null,
      });
      if (line && this._speakOnce(seat, line) && first === null) first = line;
    }
    return first;
  }

  // The paid path: one call, every speaker, the whole hand in front of it.
  // Fire-and-forget — a hand does not wait for its own commentary, and the
  // next one is already being dealt.
  _talkWithModel(spoke, result) {
    const hand = {
      board: [...(this.game?.community ?? [])],
      pot: result?.pot ?? 0,
      result: result?.type === 'showdown' ? 'showdown' : 'everybody else folded',
      log: this.currentHandActionLog.map((e) => ({
        street: e.street,
        who: this._seatLabel(e.seat),
        action: e.actionType,
      })),
    };
    const cast = spoke.map(({ seat, trigger }) => {
      const agentId = this.agentIds[seat];
      const mood = agentId ? getAgentMood(agentId, this.agentUserIds[seat]) : null;
      const rel = this._roleAtTable(seat);
      return {
        seat,
        trigger,
        name: this._seatLabel(seat),
        style: this.agentStrategy || this.aiStrategy[seat] || null,
        mood: mood?.state ?? 'neutral',
        note: rel?.who ? `${rel.who} is his ${rel.role}` : null,
      };
    });
    // The owner of the first speaker pays for the call. One of them has to,
    // the meter files a call with no owner under HOUSE, and a line written
    // about a hand is written for whoever is watching it.
    const ownerId = this.agentUserIds[spoke[0].seat] ?? null;

    writeHandTalk(cast, hand, { ownerId })
      .then((lines) => {
        if (this.closed) return;
        // Nothing usable came back — no key, a timeout, every line rejected as
        // solver speak. A watched table then says what an unwatched one would
        // have said rather than going silent: the templates are already there,
        // they cost nothing, and silence is a worse product than a plain line.
        if (!Array.isArray(lines) || lines.length === 0) {
          this._needleOpponents(spoke[0].seat, this._talkFromTemplates(spoke));
          return;
        }
        this._playBubbles(lines);
        this._needleOpponents(spoke[0].seat, lines[0].text);
      })
      .catch((err) => console.error(`[table:${this.tableId}] hand talk failed:`, err.message));
  }

  // Bubbles play back on the pacing queue rather than all at once. Four lines
  // arriving in the same millisecond is not a table talking, it is a chat
  // window opening; they land BUBBLE_GAP_MS apart, in the order they were
  // written, and every timer is unref'd and dropped when the table closes.
  _playBubbles(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    lines.forEach((line, i) => {
      const fire = () => {
        if (this.closed) return;
        this._speakOnce(line.seat, line.text);
      };
      if (i === 0) { fire(); return; }
      const t = setTimeout(fire, i * BUBBLE_GAP_MS);
      t.unref?.();
      this._paceTimers.push(t);
    });
  }

  // TLK-1: queue the line on susceptible AI opponents and fire the needled
  // mood event once per session per seat. Unchanged except for being lifted
  // out of the loop it used to live inside.
  _needleOpponents(fromSeat, spoken) {
    if (typeof spoken !== 'string' || !spoken.trim()) return;
    for (let oppSeat = 0; oppSeat < this.maxSeats; oppSeat++) {
      if (oppSeat === fromSeat) continue;
      if (!this.aiSeats[oppSeat] || !this.pending[oppSeat]) continue;
      if (!this._seatIsInGame(oppSeat)) continue;
      const oppProfile = this.agentProfiles[oppSeat] ??
        { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
      if (isStoic(oppProfile) || !isSusceptible(oppProfile)) continue;

      this.pendingNeedle[oppSeat] = spoken;

      if ((this._needledThisSession[oppSeat] ?? 0) === 0) {
        const oppAgentId = this.agentIds[oppSeat];
        if (oppAgentId) {
          const oppMood = getAgentMood(oppAgentId, this.agentUserIds[oppSeat]);
          if (oppMood) {
            const newMood = applyMoodEvent(oppMood, 'needled', oppProfile, {});
            try {
              setAgentMood(oppAgentId, this.agentUserIds[oppSeat], newMood);
            } catch (err) {
              console.error(`[table:${this.tableId}] needle setAgentMood failed:`, err.message);
            }
          }
        }
        this._needledThisSession[oppSeat] = 1;
      }
    }
  }


  // ── COST-1 · the evening, written up ────────────────────────────────────
  //
  // An unwatched session says almost nothing while it runs, on purpose: the
  // per-hand writer is a watched-table thing, because writing dialogue into an
  // empty room is the purest form of paying for nothing.
  //
  // But the owner comes back, and "100 hands, +1,240" is a receipt rather than
  // an evening. So the session is written up ONCE, at the end, from the hands
  // it actually contained, into the thread he reads it back through. One call
  // for a session, where the old per-remark path would have spent dozens.
  //
  // Everything the write needs is snapshotted BEFORE the call goes out,
  // because by the time it resolves the seats have been retired and the table
  // is gone from the registry. That is also why the lines are appended through
  // thread.js directly rather than through _threadTo: the seat arrays it reads
  // are empty by then, and a line that lands in nobody's thread is a line that
  // cost money to write and nothing to read.
  _writeNightRecap() {
    if (this._recapWritten) return;
    if (this.home) return;                       // the kitchen table never spends
    if (this.isWatched() || this._everWatched) return;   // he already watched it happen
    this._recapWritten = true;

    const seats = [];
    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (!this.pending[seat]) continue;
      const agentId = this.agentIds[seat];
      const mood = agentId ? getAgentMood(agentId, this.agentUserIds[seat]) : null;
      const rel = this._roleAtTable(seat);
      seats.push({
        seat,
        sessionId: this.seatSessionIds[seat] ?? null,
        agentId,
        ownerId: this.agentUserIds[seat] ?? null,
        name: this._seatLabel(seat),
        style: this.agentStrategy || this.aiStrategy[seat] || null,
        mood: mood?.state ?? 'neutral',
        note: rel?.who ? `${rel.who} is his ${rel.role}` : null,
      });
    }
    // Nobody to write it into. A table of House regulars has no thread and no
    // owner, and an evening nobody can read back is not worth a call.
    if (!seats.some((p) => p.sessionId)) return;

    const session = {
      hands: this.handsThisSession,
      biggestPot: this.sessionBiggestPot,
      moments: [...this.sessionMoments],
    };
    const ownerId = seats.find((p) => p.ownerId)?.ownerId ?? null;

    writeNightRecap(seats, session, { ownerId })
      .then((lines) => this._fileRecapLines(lines, seats))
      .catch((err) => console.error(`[table:${this.tableId}] night recap failed:`, err.message));
  }

  // One written line goes into every agent's thread: his own under HIM, the
  // other seats' under the name the felt showed. Exactly the split
  // _threadSpoken makes live, against the snapshot rather than the seats.
  _fileRecapLines(lines, seats) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    for (const line of lines) {
      for (const target of seats) {
        if (!target.sessionId) continue;
        appendThreadLine({
          sessionId: target.sessionId,
          agentId: target.agentId,
          ownerId: target.ownerId,
          tableId: this.tableId,
          kind: target.seat === line.seat ? ThreadKind.HIM : ThreadKind.OPPONENT,
          who: target.seat === line.seat ? 'HIM' : line.name,
          text: line.text,
        });
      }
    }
    console.log(`[table:${this.tableId}] wrote up the evening — ${lines.length} line(s)`);
  }

  // One sentence for a hand worth remembering, in the room's voice. Fed to the
  // write-up above, and capped: an evening is three or four things.
  _noteMoment(seat, flagType, pot, won) {
    if (this.sessionMoments.length >= 12) return;
    const name = this._seatLabel(seat);
    const line = {
      biggestPot: `${name} took the biggest pot of the night, ${pot}`,
      badBeat:    `${name} was a long way in front and lost ${pot} anyway`,
      cooler:     `${name} ran into a better hand and it cost him ${pot}`,
      bigBluff:   `${name} took ${pot} off the table with nothing`,
      heroCall:   `${name} paid off a ${pot} pot on a hunch and was right`,
    }[flagType];
    if (!line) return;
    this.sessionMoments.push(won === false && flagType === 'biggestPot'
      ? `${name} was in the biggest pot of the night, ${pot}, and lost it`
      : line);
  }

  // Build the gameState object for the agent handler from the current game.
  _buildAiGameState(aiSeat) {
    const g = this.game;
    const N = g.seats.length;
    const me = g.seats[aiSeat];
    // For backwards compatibility with the (heads-up) agent prompt, expose a
    // single primary opponent. Pick the seat immediately left of the AI; in
    // HU this collapses to the only opponent.
    // MST-1: prefer a live opponent so oppStack means something at a full
    // table; falls back to the seat on the left when everyone else has folded.
    let oppSeat = (aiSeat + 1) % N;
    for (let i = 1; i < N; i++) {
      const cand = (aiSeat + i) % N;
      if (!g.seats[cand].folded) { oppSeat = cand; break; }
    }
    const opp = g.seats[oppSeat];
    const legal = g.legalActions(aiSeat);

    const callAction   = legal.find((a) => a.type === 'call')  ?? null;
    // RAISE-1: the DISCIPLINED offer, not the engine's raw one — see
    // _raiseOffer. The briefing must show the sizes the table will actually
    // accept, or the agent spends every turn asking for one the table rewrites.
    const betAction    = this._raiseOffer(aiSeat, 'bet');
    const raiseAction  = this._raiseOffer(aiSeat, 'raise');

    let position;
    if (N === 2) {
      position = g.dealerSeat === aiSeat ? 'BTN/SB' : 'BB';
    } else if (aiSeat === g.dealerSeat) {
      position = 'BTN';
    } else if (aiSeat === (g.dealerSeat + 1) % N) {
      position = 'SB';
    } else if (aiSeat === (g.dealerSeat + 2) % N) {
      position = 'BB';
    } else {
      // Anything past the BB on the ring is UTG (with offset for larger games).
      const offset = (aiSeat - ((g.dealerSeat + 3) % N) + N) % N;
      position = offset === 0 ? 'UTG' : `UTG+${offset}`;
    }

    const toCall = callAction?.amount ?? 0;
    const activeOpponents = g.seats.filter((s, i) => i !== aiSeat && !s.folded).length;

    // Monte Carlo equity vs the live opponents. 800 iterations keeps the
    // per-decision cost around 30ÔÇô80 ms while staying under ±2% standard error.
    let equity = null;
    try {
      const est = estimateEquity({
        holeCards: me.holeCards,
        community: g.community,
        nOpponents: Math.max(1, activeOpponents),
        iterations: 800,
      });
      equity = est.equity;
    } catch (err) {
      console.warn(`[table:${this.tableId}] equity estimation failed:`, err.message);
    }

    const potOdds = toCall > 0 ? toCall / (g.pot + toCall) : null;
    const spr = g.pot > 0 ? me.stack / g.pot : null;

    // Compile the per-decision policy directives from the agent's numeric
    // profile. Agents without a stored profile fall back to a neutral default
    // (the seat may have been created before this feature); an inferred one
    // is passed in via seatAI when available.
    const seatProfile = this.agentProfiles[aiSeat] ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
    // ATTR-1: the six values this decision is made with, after fatigue.
    const attrs = this._seatAttrs(aiSeat);
    const policy = compilePolicy(seatProfile, {
      holeCards: me.holeCards,
      position,
      attrs,
    });

    // Mood-derived bounded effects: nudge the deviation die probability and
    // (via the briefing) sizing. The range verdict itself never changes —
    // per Mood Design Law rule 2, mood shifts flavor, never quality.
    const mood = this.agentIds[aiSeat]
      ? getAgentMood(this.agentIds[aiSeat], this.agentUserIds[aiSeat])
      : null;
    if (mood && mood.state !== 'neutral') {
      const eff = moodDecisionEffects(mood);
      // deviationPercent, not the raw expression: mood must nudge the number
      // the DISCIPLINE hook already produced, not overwrite it.
      const baseDeviation = deviationPercent(seatProfile, { discipline: attrs?.DISCIPLINE ?? null }) / 100;
      const boosted = Math.max(0, Math.min(1, baseDeviation + eff.deviationBoost));
      policy.dice.deviationDie = Math.random() < boosted;
    }

    const raisesThisStreet = this._getRaiseCountThisStreet();

    // Read summaries for every OTHER seat with ≥10 observed hands. Handed
    // to the briefing so the LLM can adapt sizing/fold decisions to how
    // this specific opponent has been playing.
    //
    // ATTR-1: the 10-hand prefilter becomes the attribute-aware gate — READS
    // pulls it down, the SUBJECT's DECEPTION pushes it up — and each read
    // carries that subject's DECEPTION so reads.js can apply the same rule.
    const opponentReads = [];
    for (let i = 0; i < N; i++) {
      if (i === aiSeat) continue;
      const pid = this.pending[i]?.playerId;
      if (!pid) continue;
      const read = getOpponentRead(pid);
      if (!read) continue;
      const subjectDeception = this._seatAttrs(i)?.DECEPTION ?? null;
      const gate = readMinHands({ reads: attrs?.READS ?? null, deception: subjectDeception });
      if (read.handsObserved >= gate) {
        opponentReads.push({ ...read, subjectDeception });
        // ATTR-3 evidence: he has solved this opponent well enough to be told
        // about it. Once per opponent per session — the read does not get
        // better by being re-read every hand.
        const subjects = this.attrReadSubjects[aiSeat];
        if (subjects && !subjects.has(pid)) {
          subjects.add(pid);
          this.attrEvidence[aiSeat].readsFormed++;
        }
      }
    }

    // COST-1: has the picture of the opposition CHANGED since his last
    // decision? This is the "read on the wire" gate — see router.js, which
    // explains at length why the answer is not "does he have a read".
    //
    // The one impure line in this builder, and it is the same kind of impurity
    // the ATTR-3 read-subject counter above already has: the state has to
    // advance exactly once per decision, and this is the one place that runs
    // exactly once per decision.
    // The fingerprint is the SHAPE he is up against, not the sample behind it.
    // Including handsObserved would change the print every single hand and the
    // gate would be permanently open, which is the failure this whole reading
    // exists to avoid. Same fields _maybeBroadcastReads fingerprints on.
    const readPrint = opponentReads
      .map((r) => `${r.playerId}:${classifyOpponent(r) ?? ''}`)
      .join('|');
    const readOnWire = this._routeReadPrint[aiSeat] !== null
      && this._routeReadPrint[aiSeat] !== readPrint;
    this._routeReadPrint[aiSeat] = readPrint;

    return {
      holeCards:  me.holeCards,
      community:  g.community,
      pot:        g.pot,
      street:     g.street,
      myStack:    me.stack,
      oppStack:   opp.stack,
      myContrib:  me.contribThisStreet,
      position,
      sb:         g.smallBlind,
      bb:         g.bigBlind,
      canCheck:   legal.some((a) => a.type === 'check'),
      canBet:     !!betAction,
      canRaise:   !!raiseAction,
      toCall,
      minBet:     betAction?.min ?? 0,
      maxBet:     betAction?.max ?? 0,
      minRaise:   raiseAction?.min ?? 0,
      maxRaise:   raiseAction?.max ?? 0,
      equity,
      potOdds,
      spr,
      policy,
      raisesThisStreet,
      // RAISE-1: the street is capped — the only raise still on offer is the
      // jam, and the briefing says so in words rather than leaving the model to
      // notice that min and max are the same number.
      raiseCapped: !!(betAction?.capped || raiseAction?.capped),
      raiseCap: raiseCapPerStreet(),
      opponentReads,
      readOnWire,
      mood,
      // COST-1: a stack already in the middle. The router reads it as a reason
      // to spend; nothing else does, so it is computed here rather than being
      // recomputed behind the router where it would have no table to ask.
      anyAllIn: this._allInState().anyAllIn,
      attrs,                                          // ATTR-1: FOCUS/READS read these
      fatigue:    attrs?.fatigue ?? null,
      seat:       aiSeat,                             // seeds the FOCUS noise
      handNumber: g.handNumber,
      tableTalk:  this.pendingNeedle[aiSeat] ?? null,   // TLK-1
      opponents:  g.seats
        .map((s, i) => i === aiSeat ? null : { seat: i, stack: s.stack, folded: s.folded, contribThisStreet: s.contribThisStreet })
        .filter(Boolean),
    };
  }

  // If it's currently an AI seat's turn, fetch a decision and apply it.
  // Async ÔÇö called fire-and-forget from _broadcastState.
  async _maybeRunAiTurn() {
    const g = this.game;
    if (!g) return;
    const aiSeat = g.toAct;
    if (aiSeat === null || aiSeat === undefined) return;
    if (!this.aiSeats[aiSeat]) return;
    if (g.street === Streets.COMPLETE || g.street === Streets.WAITING) return;

    // MST-1: a seat that asked to sit out mid-hand folds out of it rather than
    // burning a model call. The seat itself is freed by the reconcile once the
    // hand completes.
    if (this._foldsOutOfHand(aiSeat)) {
      const streetBefore = g.street;
      try {
        this.game.act(aiSeat, { type: 'fold' });
        this._logAction(aiSeat, streetBefore, { type: 'fold' });
        this._broadcastState();
        if (this.game.street === Streets.COMPLETE) this._handCompleted();
      } catch (err) {
        console.error(`[table:${this.tableId}] sit-out fold failed:`, err.message);
      }
      return;
    }

    const gameState = this._buildAiGameState(aiSeat);
    this.pendingNeedle[aiSeat] = null;  // TLK-1: consumed into gameState
    const strategy = this.agentStrategy || this.aiStrategy[aiSeat];

    // SERVER-3: the clock was armed by _broadcastState before the snapshot
    // announcing this turn went out, so the delay we sleep here is the SAME
    // one the client is drawing its ring from. Re-arming as a fallback covers
    // the paths that reach here without a broadcast in front of them.
    const timer = (this.actionTimer && this.actionTimer.seat === aiSeat)
      ? this.actionTimer
      : this._armActionTimer();

    // ONE run per turn. _maybeRunAiTurn is fired from every _broadcastState,
    // and a turn that gets broadcast twice used to be saved only by the two
    // runs drawing different random delays and the loser losing the toAct
    // re-check below. Now that the delay is the armed clock BOTH runs wake at
    // the same millisecond, so the race has to be closed properly rather than
    // left to the dice. The key changes when an action lands or a hand starts,
    // which is exactly when a new turn begins.
    const turnKey = timer?.key ?? `${g.handNumber}:${this._actionSeq}:${aiSeat}`;
    if (this._aiTurnKey === turnKey) return;
    this._aiTurnKey = turnKey;

    const thinkMs = Math.max(0, (timer?.deadlineTs ?? Date.now()) - Date.now());
    await new Promise((r) => setTimeout(r, thinkMs));

    // Re-check: the human might have acted somehow, or hand ended.
    if (!this.game || this.game.toAct !== aiSeat || this.game.street === Streets.COMPLETE) return;

    // ── COST-1: where does this decision go? ─────────────────────────────
    // Answered for free, before anything is spent, from the state that was
    // built for the briefing anyway. A spot with a wide margin and one option
    // is arithmetic and the compiled policy does arithmetic; everything else
    // — close, big, late, all-in, tilted, read, needled, a nemesis opposite —
    // is a hand somebody might watch, and it goes to the model.
    //
    // Note where this sits: AFTER the think delay has already been slept. The
    // free path must not make him act instantly — SERVER-3's clock is the ring
    // the client is drawing, and an agent who answers a spot in 0ms and the
    // next one in 1.8s is visibly two different things. What the router
    // changes is what it costs, never what it looks like.
    const routed = routeFor(gameState, {
      home: this.home,
      nemesis: this._roleAtTable(aiSeat)?.role === 'nemesis',
    });
    countRoute(this.routes, routed);
    // Every decision is filed, including the free ones. See recordDecisionRoute:
    // a meter that only hears about the calls that happened cannot tell a
    // working router from an empty floor.
    recordDecisionRoute({
      ownerId: this.agentUserIds[aiSeat],
      route: routed.route,
      reason: routed.reason,
    });
    console.log(
      `[route:${this.tableId}] seat ${aiSeat} ${gameState.street} ${routed.tag} ` +
      `(margin ${routed.margin ?? '—'}, options ${routed.options})`,
    );

    const memoryContext = this.agentMemory[aiSeat] ?? '';
    let decision;
    if (routed.route === Route.POLICY) {
      decision = chooseFromPolicy(gameState);
    } else {
      console.log(`[agent] using strategy: "${(this.agentStrategy || 'default').slice(0, 60)}"`);
      decision = await getAgentAction(gameState, strategy, memoryContext);
      // METER-1: the decision call, priced by MODEL-1b and filed here. A
      // fallback (no key, an API error) carries no usage and is not a call, so
      // it is not counted as one.
      if (decision.usage) {
        recordModelCall({
          ownerId: this.agentUserIds[aiSeat],
          kind: MeterKind.DECISION,
          model: decision.model,
          provider: decision.provider,
          usage: decision.usage,
          costUsd: decision.costUsd,
        });
      }
    }
    let { action, reasoning } = decision;

    // One final guard before mutating game state.
    if (!this.game || this.game.toAct !== aiSeat) return;

    // RAISE-1: the last gate. The briefing already offered disciplined sizes,
    // but the count can have moved while the model was thinking, and a fallback
    // action never went through the briefing at all.
    action = this._disciplineAction(aiSeat, action);

    // Record the decision (with reasoning) before applying it so that even if
    // the engine rejects the action and we fall back, we still capture the
    // model's intent for stats.
    // ATTR-3: what the attributes were doing when this decision was made.
    // `equity` stays the TRUE number; `seenEquity` is what the briefing showed
    // him. The hand review needs both to say "he misjudged equity by 7 points",
    // and the session needs them to know whether his arithmetic held.
    const seen = perceivedMath(gameState);
    const attrCtx = {
      seenEquity: seen.equity,
      seenPotOdds: seen.potOdds,
      deviationDie: !!gameState.policy?.dice?.deviationDie,
      inRange: gameState.policy?.range ? !!gameState.policy.range.inRange : null,
      moodState: gameState.mood?.state ?? 'neutral',
      readSubjects: (gameState.opponentReads ?? []).map((r) => r.displayName || r.playerId),
      fatigue: gameState.fatigue ?? null,
    };
    this._collectAttrEvidence(aiSeat, action, attrCtx, gameState);

    this.currentHandDecisions.push({
      seat: aiSeat,
      street: this.game.street,
      action,
      reasoning,
      holeCards: [...this.game.seats[aiSeat].holeCards],
      community: [...this.game.community],
      equity: gameState.equity,
      potOdds: gameState.potOdds,
      attr: attrCtx,
      timestamp: Date.now(),
    });

    const streetBefore = this.game.street;
    this._boardBeforeAct = [...this.game.community];
    // SERVER-3: what he is reacting to, read off the table as it stands BEFORE
    // the action. Whether the action itself commits his stack is only knowable
    // once the engine has applied it, which is why allIn is decided below.
    const eventBefore = this._decisionEventBefore(aiSeat);
    // RIDERS-1: the index of the record we just pushed, so the pot and the
    // all-in flag can be stamped on it once the engine has applied the action.
    const decisionIdx = this.currentHandDecisions.length - 1;
    try {
      this.game.act(aiSeat, action);
      this._stampDecisionOutcome(decisionIdx, aiSeat);
      this._incrementRaiseCountIfAggressive(action);
      this._logAction(aiSeat, streetBefore, action);
      this._broadcastPace();
      this._broadcastDecision({
        seat: aiSeat,
        action,
        reasoning,
        equity: gameState.equity,
        potOdds: gameState.potOdds,
        event: this._decisionEventFor(aiSeat, eventBefore),
      });
      this._resetAiInactivityTimer();
      // COST-1: what he says out loud, in the moment, for nothing. Either the
      // model returned a `say` on the decision call it was already making, or
      // the compiled policy drew an instant template. Spoken BEFORE the state
      // broadcast so the bubble arrives with the action that caused it, and
      // before _handCompleted so the per-hand writer can see he has already
      // spoken and leave him alone.
      //
      // The three chat triggers that used to live here — aggressive_action,
      // won_hand, big_pot — each fired their own model call. They are gone.
      // What they were for now happens once, at the end of the hand, in
      // _maybeSendAgentTalk, which can see the whole hand instead of one
      // action out of it.
      if (decision.say) this._speakOnce(aiSeat, decision.say);
      this._broadcastState();
      if (this.game.street === Streets.COMPLETE) this._handCompleted();
    } catch (err) {
      console.error(`[table:${this.tableId}] AI action rejected (${JSON.stringify(action)}):`, err.message);
      // Safe fallback ÔÇö play whatever is available.
      const legal = this.game.legalActions(aiSeat);
      const fallback = legal.find((a) => a.type === 'check') ?? legal.find((a) => a.type === 'call') ?? { type: 'fold' };
      const fallbackAction = { type: fallback.type, ...(fallback.amount ? { amount: fallback.amount } : {}) };
      try {
        this.game.act(aiSeat, fallbackAction);
        this._stampDecisionOutcome(decisionIdx, aiSeat);
        this._logAction(aiSeat, streetBefore, fallbackAction);
        // Replace the recorded decision with the action that actually played
        // out so stats reflect the engine's view.
        const lastIdx = this.currentHandDecisions.length - 1;
        if (lastIdx >= 0 && this.currentHandDecisions[lastIdx].seat === aiSeat) {
          this.currentHandDecisions[lastIdx].action = fallbackAction;
          this.currentHandDecisions[lastIdx].reasoning =
            (reasoning ? reasoning + ' ' : '') + '(engine rejected; fell back to safe action)';
        }
        this._resetAiInactivityTimer();
        this._broadcastState();
        if (this.game.street === Streets.COMPLETE) this._handCompleted();
      } catch (e2) {
        console.error(`[table:${this.tableId}] fallback action also failed:`, e2.message);
      }
    }
  }
}
