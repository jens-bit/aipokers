import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';
import { getAgentAction, generateAiChatLine, perceivedMath } from '../agent/handler.js';
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
  addFlaggedHand,
} from './agentProfiles.js';
import { classifyHand, buildFlaggedEntry, THRESHOLDS } from './flaggedHands.js';
import { PACE, paceFor, advancePace, potInBb, holdPlan, seedFor } from './pace.js';
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
import { readPanel } from '../agent/reads.js';
import {
  applyEvent as applyMoodEvent,
  tickDecay as tickMoodDecay,
  decisionEffects as moodDecisionEffects,
  EVENT_DELTAS,
} from '../agent/mood.js';
import { notifyMoodAlert } from './notifications/telegram.js';
import {
  HOUSE_TAG,
  HOUSE_STATION,
  HOUSE_STRATEGY,
  HOUSE_PROFILE,
  pickComplementaryHouse,
} from './matchmaking.js';
import {
  pickTalkLine,
  isStoic,
  isSusceptible,
  TALK_INTERVAL_HANDS,
} from '../agent/tableTalk.js';

const HOUSE_FALLBACK_MS = 5000;

// -- MST-1: multi-seat tables ----------------------------------------------
// Hard ceiling -- the engine accepts 2..6 seats.
export const SEAT_LIMIT = 6;
// Default size of a newly created table.
export const MAX_SEATS = Math.min(SEAT_LIMIT, Math.max(2, Number(process.env.MAX_SEATS ?? 6)));
// Occupied, chipped seats needed before a hand can be dealt.
export const MIN_TO_DEAL = 2;

// ── AGE-35: server-side session loop ────────────────────────────────────────
// Pause between a completed hand and the next deal on an autonomous table.
const HAND_PAUSE_MS = Number(process.env.HAND_PAUSE_MS ?? 8000);
// Hands one deployment is allowed to play before the agent gracefully sits
// out. Bounds the LLM spend of a table nobody is watching.
const SESSION_MAX_HANDS = Number(process.env.SESSION_MAX_HANDS ?? 100);
// Recap lines the agent is left with when a session ends for each reason.
const RECAP_MAX_HANDS = 'long session, sitting out';
const RECAP_BUST = 'someone ran out of chips — session over';
const RECAP_SIT_OUT = 'sat out by owner';
const RECAP_IDLE = 'the table went quiet, so I stepped away';
const RECAP_STALL = 'something jammed at my table, so I stepped away';

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
export class Table {
  constructor({ tableId, smallBlind, bigBlind, maxSeats = MAX_SEATS, onEmpty, onStateChange, maxHands, handPauseMs }) {
    if (!Number.isInteger(maxSeats) || maxSeats < MIN_TO_DEAL || maxSeats > SEAT_LIMIT) {
      throw new Error(`maxSeats must be an integer ${MIN_TO_DEAL}..${SEAT_LIMIT}`);
    }
    this.tableId = tableId;
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

    // ── AGE-35: autonomous session loop ──────────────────────────────────
    // autoPlay tables deal themselves. Nothing a client does — connecting,
    // watching, leaving — advances or stops them; only the loop, a bust, the
    // hand cap, or an explicit SIT_OUT does.
    this.autoPlay = false;
    this.handsThisSession = 0;
    this.maxHands = Number.isFinite(maxHands) ? maxHands : SESSION_MAX_HANDS;
    this.handPauseMs = Number.isFinite(handPauseMs) ? handPauseMs : HAND_PAUSE_MS;
    this._nextHandTimer = null;
    this._stallTimer = null;
    this.stallMs = SESSION_STALL_MS_EXPLICIT
      ? SESSION_STALL_MS
      : Math.max(SESSION_STALL_MS, this.handPauseMs * 3 + 60_000);
    this.closed = false;
    // Advisory deadline for the seat currently to act (the AI's think delay).
    // Surfaced to the floor as liveGame.actionDeadline. A real server-side
    // action timer for HUMAN seats is still Fredrik's queue.
    this.actionDeadline = null;
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
    ['seatAccentColors',       () => null],
    ['seatTalkLines',          () => null],
    ['pendingNeedle',          () => null],   // TLK-1
    ['_needledThisSession',    () => 0],      // TLK-1
    ['_talkLastHandBySeat',    () => -1],     // TLK-1
    ['_prefoldStreakBySeat',   () => 0],      // TLK-1
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
    if (agentId) {
      try {
        const buyIn = occupant.buyIn ?? this.defaultBuyIn();
        const finalStack = this.seatStacks[seat] ?? this.game?.seats?.[seat]?.stack ?? buyIn;
        const watched = this.spectators.some((s) => s.spectatorSeat === seat);
        finishAgentSession(agentId, this.agentUserIds[seat], {
          recap,
          sessionPnl: finalStack - buyIn,
          watched,
          sessionHands: Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0)),
          finalStack,
          buyInAmount: buyIn,
          tableId: this.tableId,
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
    this._clearSeat(seat);
    console.log(`[table:${this.tableId}] seat ${seat} freed -- ${displayName} (${recap})`);
    this._broadcast({ type: ServerMsg.SEAT_LEFT, seat, displayName, reason: recap });
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
    return true;
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
    this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason });
    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      try {
        const buyIn      = this.pending[seat]?.buyIn ?? (this.bigBlind * 100);
        const finalStack = this.seatStacks[seat] ?? this.game?.seats?.[seat]?.stack ?? buyIn;
        const sessionPnl = finalStack - buyIn;
        const watched    = this.spectators.some((s) => s.spectatorSeat === seat);
        finishAgentSession(agentId, this.agentUserIds[seat], {
          recap: recap ?? reason,
          sessionPnl,
          watched,
          sessionHands: Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0)),
          finalStack,
          buyInAmount: buyIn,
          tableId: this.tableId,
          attrEvidence: this.attrEvidence[seat],   // ATTR-3: growth is drawn from this
        });
      } catch (err) {
        console.error('[table] finishAgentSession failed:', err.message);
      }
    }
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

    const inHand = !!this.game &&
      this.game.street !== Streets.COMPLETE &&
      this.game.street !== Streets.WAITING;
    if (inHand) {
      this._pendingSitOut.add(seat);
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
    this.agentProfiles[free] = agentProfile ? normalizeProfile(agentProfile) : null;
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
    console.log(`[table:${this.tableId}] AI agent seated at slot ${free} (stack ${aiBuyIn}, model ${process.env.AI_MODEL || 'claude-haiku-4-5'}${agentId ? `, agentId=${agentId}` : ''}${this.agentMemory[free] ? ', memory: yes' : ''}${this.agentProfiles[free] ? `, profile T${this.agentProfiles[free].tightness}/A${this.agentProfiles[free].aggression}` : ''})`);
    return free;
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
    return effectiveAttrs(rec, { sessionHands });
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
    const state = this._augmentState(this.game.getPublicState(seat));
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
      street: g ? g.street : Streets.WAITING,
      board: inHand ? [...g.community] : [],
      heroHole: includeHole && inHand ? [...(g.seats[seat]?.holeCards ?? [])] : null,
      heroStack: inHand ? (g.seats[seat]?.stack ?? null) : null,
      pot: inHand ? g.pot : 0,
      toAct: inHand ? g.toAct : null,
      actionDeadline: this.actionDeadline ?? null,
      handNumber: g ? g.handNumber : 0,
      dealtIn,
      seatCount: this.seatedCount(),
      maxSeats: this.maxSeats,
      handsThisSession: this.handsThisSession,
      // ATTR-1d: this seat's own session length, which is what fatigue is
      // measured against — a seat that sat down at hand 80 is not 80 hands worn.
      heroSessionHands: Math.max(0, this.handsThisSession - (this.seatJoinedAtHand[seat] ?? 0)),
      maxHands: this.maxHands,
      blinds: `${this.smallBlind}/${this.bigBlind}`,
      seats: g ? g.seats.map((s, i) => ({
        displayName: this.pending[i]?.displayName ?? s.playerId ?? '',
        stack:       s.stack ?? 0,
        accentColor: this.seatAccentColors[i] ?? null,
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
    this.game.startHand();
    this._broadcast({ type: ServerMsg.HAND_START, handNumber: this.game.handNumber });
    this._broadcastPace({ force: true });
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
    this.currentHandActionLog.push({ seat, street, actionType: action.type });
  }

  _handCompleted() {
    this.handsThisSession++;
    this.actionDeadline = null;
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

    // Seats that asked to sit out during the hand are released now.
    if (this._pendingSitOut.size > 0) {
      for (const seat of [...this._pendingSitOut]) this.seatLeaving[seat] = true;
      this._pendingSitOut.clear();
    }

    // A departure or a bust only ends the TABLE when it can no longer be
    // dealt. With three or more agents seated, one leaving is just a seat
    // opening up -- the rest play on.
    const leaving = this.seatLeaving.some(Boolean);
    const survivors = this._survivingSeats();
    if (survivors.length < MIN_TO_DEAL) {
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
      this._scheduleNextHand((this.autoPlay ? this.handPauseMs : 2500) + holdMs);
    }
  }

  // ATTR-3: fatigue is a within-session STATE that the record has to carry, so
  // the floor can slump his posture and the card can dip the two bars it
  // touches without asking the table. Written only when the stage actually
  // changes; the crossing into 'worn' is the one time he mentions it, and it
  // never pushes a notification — fatigue fixes itself at the bar.
  _updateSeatFatigue() {
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
    }
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
      const composure = this._seatAttrs(seat)?.COMPOSURE ?? null;

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
        mood = applyMoodEvent(mood, ev.type, profile, { context: ev.ctx, composure });
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

      // Mood alert: notify owner when agent enters tilted or sulking.
      const prevState = currentMood.state;
      const nextState = mood.state;
      if ((nextState === 'tilted' || nextState === 'sulking') && nextState !== prevState) {
        const ownerId = this.agentUserIds[seat];
        if (ownerId) {
          notifyMoodAlert(String(ownerId), String(ownerId), agentId,
            this.pending[seat]?.displayName || 'Your agent',
            { moodState: nextState, cause: mood.cause || null }
          ).catch((e) => console.error('[notify] mood alert failed:', e.message));
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

    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      const won = winners.some((w) => w.seat === seat);
      // MST-1: a seat that joined mid-hand is not in this hand's Game.
      if (!this._seatIsInGame(seat)) continue;
      const decisions = this.currentHandDecisions.filter((d) => d.seat === seat);
      this._collectHandEvidence(seat, decisions, { won, resultType: result.type });
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

      if (flagType === 'biggestPot') this.sessionBiggestPot = pot;
      if (!flagType) continue;

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

      const entry = buildFlaggedEntry({
        flagType,
        decisions,
        handNumber: this.game.handNumber,
        pot,
        holeCards,
        won,
        opponentShowdownCards,
        // ATTR-3: where an attribute actually shaped this hand. Only flagged
        // hands carry it — the review sheet is the one surface entitled to say
        // a low attribute cost money, and it says it about him, not about the
        // number.
        attrCosts: attrCostsForHand({ decisions, won }),
      });

      try {
        addFlaggedHand(agentId, userId, entry);
      } catch (err) {
        console.error('[table] flagged hand store failed:', err.message);
      }
    }
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
    const nGameSeats = this.game?.seats.length ?? 0;
    for (let seat = 0; seat < this.connections.length; seat++) {
      const ws = this.connections[seat];
      if (!ws || ws.readyState !== ws.OPEN) continue;
      if (seat >= nGameSeats) continue; // shouldn't happen given the contiguity invariant
      const state = this._augmentState(this.game.getPublicState(seat));
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
      const state = this._augmentState(this.game.getPublicState(s.spectatorSeat));
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

  _notifyStateChange() {
    if (!this.onStateChange) return;
    try { this.onStateChange(this); }
    catch (err) { console.error(`[table:${this.tableId}] state hook failed:`, err.message); }
  }

  // Augment state with display names from Table metadata.
  _augmentState(state) {
    state.seats = state.seats.map((s, i) => ({
      ...s,
      displayName: this.pending[i]?.displayName || s.playerId,
    }));
    // PACE-1: the ladder rides every snapshot as well as its own message, so a
    // client that joins mid-hand is not calm until the next transition.
    state.pace = this.pace ?? PACE.CALM;
    state.potBb = potInBb(state.pot ?? this.game?.pot ?? 0, this.bigBlind);
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
  _broadcastDecision({ seat, action, reasoning, equity, potOdds }) {
    const fullPayload = JSON.stringify({
      type: ServerMsg.DECISION, seat, action, reasoning, equity, potOdds,
    });
    const sanitizedPayload = JSON.stringify({
      type: ServerMsg.DECISION, seat, action,
    });
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
  sendChat(seat, text, isAI = false) {
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
    this._broadcast({
      type: ServerMsg.CHAT,
      seat,
      displayName,
      text: trimmed,
      isAI: entry.isAI,
    });
  }

  // Maybe generate a trash-talk line from the AI at `aiSeat` for a given
  // trigger. Skips entirely when no human is at the table (fast AI vs AI
  // with no watcher). Probabilistic ÔÇö most calls produce nothing.
  //   trigger: 'big_pot' | 'aggressive_action' | 'won_hand' | 'human_chat'
  //   humanMessage: optional explicit triggering message (used for 'human_chat').
  //                 Other triggers derive lastOpponentChat from chatHistory.
  _maybeGenerateAiChat(aiSeat, trigger, humanMessage = null) {
    if (!this.aiSeats[aiSeat] || !this.pending[aiSeat]) return;
    const hasHuman =
      this.connections.some((ws, i) => ws && !this.aiSeats[i]) ||
      this.spectators.length > 0;

    // Enforce one chat per agent per hand ÔÇö lock in optimistically so concurrent
    // triggers in the same hand (e.g. won_hand + big_pot) don't both fire.
    const currentHand = this.game?.handNumber ?? -1;
    if (trigger !== 'human_chat' && this.aiLastChatHand[aiSeat] === currentHand) return;

    // Frequency gates:
    //   human_chat  ÔåÆ always respond (100%)
    //   no human present ÔåÆ 15% chance
    //   human present   ÔåÆ 25% chance
    if (trigger !== 'human_chat') {
      const threshold = hasHuman ? 0.25 : 0.15;
      if (Math.random() >= threshold) return;
    }

    // Lock this hand before the async call so concurrent triggers bail out.
    if (trigger !== 'human_chat') this.aiLastChatHand[aiSeat] = currentHand;

    // Pick the most relevant opponent + last message. Walk chatHistory backwards
    // for the most recent line from a seat that isn't this AI; that seat is the
    // opponent we're "in conversation with". Fall back to any other seated
    // player so the prompt still has a name to taunt.
    let opponentSeat = null;
    let lastOpponentChat = null;
    for (let i = this.chatHistory.length - 1; i >= 0; i--) {
      const entry = this.chatHistory[i];
      if (entry.seat !== aiSeat) {
        opponentSeat = entry.seat;
        lastOpponentChat = entry.text;
        break;
      }
    }
    if (opponentSeat === null) {
      for (let i = 0; i < this.maxSeats; i++) {
        if (i !== aiSeat && this.pending[i]) { opponentSeat = i; break; }
      }
    }
    // For human_chat, the just-sent message is the explicit trigger; prefer it
    // over whatever sendChat happened to push onto history (they should match
    // anyway, but this is the authoritative source for the response).
    if (trigger === 'human_chat' && humanMessage) {
      lastOpponentChat = humanMessage;
    }

    const agentName = this.pending[aiSeat]?.displayName || `Seat ${aiSeat}`;
    const opponentName = opponentSeat !== null
      ? (this.pending[opponentSeat]?.displayName || `Seat ${opponentSeat}`)
      : 'opponent';
    const agentStyle = this.agentStrategy || this.aiStrategy[aiSeat] || '';

    // HC-1: cast members have pre-written lines — use one instead of calling
    // the model. Same frequency gates already passed above; this just skips
    // the LLM cost for House opponents.
    const castLines = this.seatTalkLines?.[aiSeat];
    if (Array.isArray(castLines) && castLines.length > 0) {
      const line = castLines[Math.floor(Math.random() * castLines.length)];
      if (this.aiSeats[aiSeat] && this.pending[aiSeat]) {
        this.sendChat(aiSeat, line, true);
      }
      return;
    }

    generateAiChatLine({
      trigger,
      agentName,
      opponentName,
      agentStyle,
      potSize: this.game?.pot ?? 0,
      street: this.game?.street ?? 'preflop',
      lastOpponentChat,
    })
      .then((line) => {
        if (!line) return;
        // Re-check the seat is still seated by the same AI; the table state
        // can change while we awaited the model.
        if (!this.aiSeats[aiSeat] || !this.pending[aiSeat]) return;
        this.sendChat(aiSeat, line, true);
      })
      .catch((err) => console.error('[table] AI chat error:', err.message));
  }

  // TLK-1: After each hand, attempt to send a template talk line from one AI
  // agent. Rate-limited (TALK_INTERVAL_HANDS per seat; one agent per hand).
  // Needles susceptible AI opponents: sets pendingNeedle + fires needled mood
  // event once per session per seat.
  _maybeSendAgentTalk(result) {
    if (!result || !this.game) return;
    const handNumber = this.game.handNumber;
    const winners = Array.isArray(result.winners) ? result.winners : [];
    const pot = result.pot ?? 0;
    const bigPotThreshold = this.bigBlind * 20;

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

      // Rate limit: per-agent gap and one-agent-per-hand.
      const lastTalkHand = this._talkLastHandBySeat[seat] ?? -1;
      if (handNumber - lastTalkHand < TALK_INTERVAL_HANDS) continue;
      if (this._talkHandNumber === handNumber) continue;

      const won = winners.some((w) => w.seat === seat);
      const agentId = this.agentIds[seat];
      const mood = agentId ? getAgentMood(agentId, this.agentUserIds[seat]) : null;
      const moodState = mood?.state ?? 'neutral';

      // Detect trigger (priority: cardDead > wonBigPot > lostAsFavorite > shownBluff).
      let trigger = null;

      if (this._prefoldStreakBySeat[seat] >= 3) {
        trigger = 'cardDead';
      }

      if (!trigger && won && pot > bigPotThreshold) {
        trigger = 'wonBigPot';
      }

      if (!trigger && !won && result.type === 'showdown') {
        const maxEquity = myDecisions.reduce(
          (m, d) => Number.isFinite(d.equity) && d.equity > m ? d.equity : m, 0
        );
        if (maxEquity > 0.60) trigger = 'lostAsFavorite';
      }

      if (!trigger && won && result.type === 'showdown') {
        outerSearch:
        for (let oppSeat = 0; oppSeat < this.maxSeats; oppSeat++) {
          if (oppSeat === seat || !this.pending[oppSeat]) continue;
          const oppDecisions = this.currentHandDecisions.filter((d) => d.seat === oppSeat);
          for (const d of oppDecisions) {
            if (
              (d.action?.type === 'bet' || d.action?.type === 'raise') &&
              Number.isFinite(d.equity) && d.equity < 0.38
            ) { trigger = 'shownBluff'; break outerSearch; }
          }
        }
      }

      if (!trigger) continue;

      const line = pickTalkLine(trigger, moodState, { heat: mood?.heat ?? null });
      if (!line) continue;

      // Lock this hand and update per-seat timing. Reset streak if cardDead fired.
      this._talkHandNumber = handNumber;
      this._talkLastHandBySeat[seat] = handNumber;
      if (trigger === 'cardDead') this._prefoldStreakBySeat[seat] = 0;
      this.sendChat(seat, line, true);

      // Needle susceptible AI opponents.
      for (let oppSeat = 0; oppSeat < this.maxSeats; oppSeat++) {
        if (oppSeat === seat) continue;
        if (!this.aiSeats[oppSeat] || !this.pending[oppSeat]) continue;
        if (!this._seatIsInGame(oppSeat)) continue;
        const oppProfile = this.agentProfiles[oppSeat] ??
          { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
        if (isStoic(oppProfile) || !isSusceptible(oppProfile)) continue;

        // Queue the line for the opponent's next decision briefing.
        this.pendingNeedle[oppSeat] = line;

        // Mood event — once per session per seat to stay BOUNDED.
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

      break; // Only one agent per hand.
    }
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
    const betAction    = legal.find((a) => a.type === 'bet')   ?? null;
    const raiseAction  = legal.find((a) => a.type === 'raise') ?? null;

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
      opponentReads,
      mood,
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
    if (this._pendingSitOut.has(aiSeat) || this.seatLeaving[aiSeat]) {
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

    // Human-like thinking delay (0.8ÔÇô2.5 s).
    const thinkMs = 800 + Math.random() * 1700;
    // Advisory deadline for the floor's LiveBar countdown (AGE-37). Set before
    // the await so a floor push during the think window carries it.
    this.actionDeadline = Date.now() + Math.round(thinkMs);
    await new Promise((r) => setTimeout(r, thinkMs));

    // Re-check: the human might have acted somehow, or hand ended.
    if (!this.game || this.game.toAct !== aiSeat || this.game.street === Streets.COMPLETE) return;

    console.log(`[agent] using strategy: "${(this.agentStrategy || 'default').slice(0, 60)}"`);
    const memoryContext = this.agentMemory[aiSeat] ?? '';
    const { action, reasoning } = await getAgentAction(gameState, strategy, memoryContext);

    // One final guard before mutating game state.
    if (!this.game || this.game.toAct !== aiSeat) return;

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
    try {
      this.game.act(aiSeat, action);
      this._incrementRaiseCountIfAggressive(action);
      this._logAction(aiSeat, streetBefore, action);
      this._broadcastPace();
      this._broadcastDecision({
        seat: aiSeat,
        action,
        reasoning,
        equity: gameState.equity,
        potOdds: gameState.potOdds,
      });
      this._resetAiInactivityTimer();
      this._broadcastState();
      const handEnded = this.game.street === Streets.COMPLETE;
      if (handEnded) this._handCompleted();
      // Fire-and-forget chat triggers. Each trigger rolls its own dice inside
      // _maybeGenerateAiChat so most calls produce nothing.
      if ((action.type === 'bet' || action.type === 'raise')
          && Number.isFinite(action.amount)
          && action.amount > this.bigBlind * 3) {
        this._maybeGenerateAiChat(aiSeat, 'aggressive_action');
      }
      if (handEnded && this.game?.result) {
        const result = this.game.result;
        const won = (result.winners || []).some((w) => w.seat === aiSeat);
        if (won) this._maybeGenerateAiChat(aiSeat, 'won_hand');
        if ((result.pot ?? 0) > this.bigBlind * 20) {
          this._maybeGenerateAiChat(aiSeat, 'big_pot');
        }
      }
    } catch (err) {
      console.error(`[table:${this.tableId}] AI action rejected (${JSON.stringify(action)}):`, err.message);
      // Safe fallback ÔÇö play whatever is available.
      const legal = this.game.legalActions(aiSeat);
      const fallback = legal.find((a) => a.type === 'check') ?? legal.find((a) => a.type === 'call') ?? { type: 'fold' };
      const fallbackAction = { type: fallback.type, ...(fallback.amount ? { amount: fallback.amount } : {}) };
      try {
        this.game.act(aiSeat, fallbackAction);
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
