import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';
import { getAgentAction, generateAiChatLine } from '../agent/handler.js';
import { appendHand } from './handHistory.js';
import {
  recordHandResult,
  runMemoryUpdate,
  getMemoryContext,
  updateComputedMemory,
  getAgentMood,
  setAgentMood,
  finishAgentSession,
} from './agentProfiles.js';
import { estimateEquity } from '../engine/equity.js';
import { compilePolicy, inferProfileFromStyleRisk, normalizeProfile } from '../agent/policy.js';
import { recordHand as recordHandForOpponentStats, getRead as getOpponentRead } from './opponentStats.js';
import {
  applyEvent as applyMoodEvent,
  tickDecay as tickMoodDecay,
  decisionEffects as moodDecisionEffects,
} from '../agent/mood.js';

const HOUSE_FALLBACK_MS = 5000;

// Complementary House archetypes. Playtest 2026-08-29 showed tight-vs-tight
// tables produce fold-fests (seven straight uncontested preflop hands). Fix:
// pick the House that creates action against the specific agent's shape.
const HOUSE_TAG = {
  strategy: 'You are a tight-aggressive heads-up player. You play premium hands aggressively, fold weak ones, and bluff occasionally at about 30% frequency. Mix up your play to stay unpredictable.',
  profile:  { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 75 },
  displayName: 'House',
};
const HOUSE_STATION = {
  strategy: 'You are a loose call-heavy heads-up player. Call a wide range preflop with any two suited cards, connectors, or any pair. Postflop, call bets with any piece of the board. Rarely raise unless you have a strong made hand.',
  profile:  { tightness: 22, aggression: 30, bluffFreq: 10, discipline: 55 },
  displayName: 'House',
};
// Backwards-compat export for anything importing HOUSE_STRATEGY (none in
// the tree currently, but kept as the canonical text of the TAG House).
const HOUSE_STRATEGY = HOUSE_TAG.strategy;
const HOUSE_PROFILE = HOUSE_TAG.profile;

// Pick which House archetype to seat, given the profile of the already-seated
// agent (if any). Tight agent → loose Station House; loose agent → TAG House.
// Default is TAG (the historical baseline) when no counterpart profile exists.
function pickComplementaryHouse(opposingProfile) {
  if (!opposingProfile || !Number.isFinite(opposingProfile.tightness)) return HOUSE_TAG;
  if (opposingProfile.tightness > 60) return HOUSE_STATION;
  return HOUSE_TAG;
}

// A Table owns a single Game instance and the WebSocket connections for its
// 2ÔÇô4 seats. It serializes incoming actions, broadcasts filtered state, and
// auto-starts the next hand once enough seated players still have chips.
//
// Seat invariant: occupied seats are contiguous from index 0. The
// game.seats[i] always corresponds to table.pending[i]. seatPlayer / seatAI
// always pick the lowest free index, and a mid-table disconnect compacts the
// remaining seats down (only for maxSeats > 2 ÔÇö HU keeps fixed indices).
export class Table {
  constructor({ tableId, smallBlind, bigBlind, maxSeats = 2, onEmpty }) {
    if (!Number.isInteger(maxSeats) || maxSeats < 2 || maxSeats > 4) {
      throw new Error('maxSeats must be an integer 2..4');
    }
    this.tableId = tableId;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.maxSeats = maxSeats;
    this.onEmpty = onEmpty;
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
    this.agentStrategy = null;                     // player-designed strategy from CreateAgent flow

    // Per-street raise counter, keyed by `${handNumber}:${street}`. Reset at
    // maybeStartHand and mutated in _incrementRaiseCountIfAggressive after
    // every applied bet/raise. Consumed by _buildAiGameState.
    this._raiseCounts = {};
    this._aiInactivityTimer = null;                // 60s timeout for AI tables
    this._houseFallbackTimer = null;               // 5s delay before auto-seating House

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

    // BUG-14: SIT_OUT — when set, the table finishes the CURRENT hand and
    // then closes gracefully in _handCompleted.
    this._pendingSitOut = false;
  }

  // BUG-14: initiated by ClientMsg.SIT_OUT from either a seated player or a
  // spectator (agent owner watching). If a hand is in progress we finish it
  // first; otherwise close now. Either path ends in `_closeSitOut()`.
  sitOut(ws) {
    const isSeated = this.connections.some((c) => c === ws);
    const isSpectator = this.spectators.some((s) => s.ws === ws);
    if (!isSeated && !isSpectator) throw new Error('not at this table');
    const inHand = !!this.game &&
      this.game.street !== Streets.COMPLETE &&
      this.game.street !== Streets.WAITING;
    if (inHand) {
      this._pendingSitOut = true;
      return { pending: true };
    }
    this._closeSitOut();
    return { pending: false };
  }

  // Close the table cleanly following a sit-out. Broadcasts TABLE_CLOSED,
  // runs the agent's finish path for every AI seat with an owning agentId,
  // then destroys the game + drops the table via onEmpty.
  _closeSitOut() {
    this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'sat out by owner' });
    for (let seat = 0; seat < this.maxSeats; seat++) {
      const agentId = this.agentIds[seat];
      if (!agentId) continue;
      try {
        finishAgentSession(agentId, this.agentUserIds[seat]);
      } catch (err) {
        console.error('[table] finishAgentSession failed:', err.message);
      }
    }
    this.game = null;
    if (this._aiInactivityTimer) { clearTimeout(this._aiInactivityTimer); this._aiInactivityTimer = null; }
    if (this._houseFallbackTimer) { clearTimeout(this._houseFallbackTimer); this._houseFallbackTimer = null; }
    this.onEmpty?.(this.tableId);
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
      console.log(`[table:${this.tableId}] scheduling House archetype=${house === HOUSE_STATION ? 'Station' : 'TAG'} vs opponent T=${opposingProfile?.tightness ?? '?'}`);
      this.maybeAutoSeatAI({
        agentDisplayName: house.displayName,
        agentStrategy: house.strategy,
        agentId: null,
        userId: null,
        memoryContext: '',
        agentProfile: house.profile,
      });
      this.maybeStartHand();
    }, HOUSE_FALLBACK_MS);
  }

  // Seat an AI agent at the first free slot. Called when AI_ENABLED=true.
  seatAI({ displayName = 'Agentic v1', strategy = '', buyIn, agentId = null, userId = null, memoryContext = '', agentProfile = null } = {}) {
    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full ÔÇö cannot seat AI');

    // Match the human player's buy-in if not specified.
    const humanSeat = this.pending.findIndex((p, i) => p !== null && !this.aiSeats[i]);
    const aiBuyIn = buyIn ?? (humanSeat !== -1 ? this.pending[humanSeat].buyIn : this.bigBlind * 100);

    this.pending[free] = {
      playerId: `ai_agent_${free}`,
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
    console.log(`[table:${this.tableId}] AI agent seated at slot ${free} (stack ${aiBuyIn}, model ${process.env.AI_MODEL || 'claude-haiku-4-5'}${agentId ? `, agentId=${agentId}` : ''}${this.agentMemory[free] ? ', memory: yes' : ''}${this.agentProfiles[free] ? `, profile T${this.agentProfiles[free].tightness}/A${this.agentProfiles[free].aggression}` : ''})`);
    return free;
  }

  hasHumanPlayer() {
    return this.connections.some((c, i) => c !== null && !this.aiSeats[i]);
  }

  // Seat an AI for a spectating user and register their WS for state broadcasts.
  // Returns the seat index the AI was placed at.
  addSpectator(ws, { agentStrategy, displayName, agentId = null, userId = null, memoryContext = '', agentProfile = null } = {}) {
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

  // Auto-seat AI at the free slot when one human is seated. No-op if table is
  // already full or has no human seated.
  maybeAutoSeatAI({ agentStrategy = null, agentDisplayName = null, agentId = null, userId = null, memoryContext = '', agentProfile = null } = {}) {
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
  _resetAiInactivityTimer() {
    if (!this.aiSeats.some(Boolean)) return;
    if (this._aiInactivityTimer) clearTimeout(this._aiInactivityTimer);
    this._aiInactivityTimer = setTimeout(() => {
      this._aiInactivityTimer = null;
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'Session ended ÔÇö no activity for 60 seconds' });
      this.game = null;
      this.onEmpty?.(this.tableId);
    }, 60_000);
  }

  removeConnection(ws) {
    // Spectator disconnect: remove from spectator list but keep the AI playing.
    const specIdx = this.spectators.findIndex((s) => s.ws === ws);
    if (specIdx !== -1) {
      this.spectators.splice(specIdx, 1);
      if (this.connections.every((c) => c === null) && this.spectators.length === 0) {
        if (this._aiInactivityTimer) { clearTimeout(this._aiInactivityTimer); this._aiInactivityTimer = null; }
        if (this._houseFallbackTimer) { clearTimeout(this._houseFallbackTimer); this._houseFallbackTimer = null; }
        this.onEmpty?.(this.tableId);
      }
      return;
    }

    let disconnectedWasHuman = false;
    let hadActiveGame = false;
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i] === ws) {
        disconnectedWasHuman = !this.aiSeats[i];
        hadActiveGame = !!(this.game && this.game.street !== Streets.WAITING && this.game.street !== Streets.COMPLETE);
        this.connections[i] = null;
        // For Phase 1 dev simplicity, always release the seat on disconnect so
        // a fresh tab can take it. This means abandoning a tab mid-hand opens
        // the seat back up; we'll add proper sit-out / timeout handling later.
        this.pending[i] = null;
        // Also clear AI flags so the table slot can be reused cleanly.
        this.aiSeats[i] = false;
        this.aiStrategy[i] = null;
        this.agentIds[i] = null;
        this.agentUserIds[i] = null;
        this.agentMemory[i] = '';
        this.agentProfiles[i] = null;
        this.aiHandsPlayed[i] = 0;
        this.aiRecentHands[i] = [];
        if (hadActiveGame) {
          this.game = null;
        }
      }
    }

    // For multi-seat tables, maintain the contiguous-from-zero invariant by
    // compacting when a middle disconnect creates a gap. HU (maxSeats=2)
    // keeps its existing seat-index-stable behaviour.
    if (this.maxSeats > 2) this._compactSeatsIfGapped();

    if (disconnectedWasHuman && hadActiveGame && !this.hasHumanPlayer()) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'Session ended — opponent left' });
      this.game = null;
    }

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

  // Detects whether a non-null seat sits after a null seat, and if so shifts
  // occupied seats down to indices [0..k-1]. Always destroys the existing game
  // because seat indices change.
  _compactSeatsIfGapped() {
    let sawNull = false;
    let hasGap = false;
    for (let i = 0; i < this.maxSeats; i++) {
      if (this.pending[i] === null) sawNull = true;
      else if (sawNull) { hasGap = true; break; }
    }
    if (!hasGap) return;

    this.game = null;

    const filled = [];
    for (let i = 0; i < this.maxSeats; i++) {
      if (this.pending[i]) {
        filled.push({
          pending: this.pending[i],
          ws: this.connections[i],
          aiSeat: this.aiSeats[i],
          aiStrategy: this.aiStrategy[i],
          agentId: this.agentIds[i],
          userId: this.agentUserIds[i],
          memory: this.agentMemory[i],
          profile: this.agentProfiles[i],
          handsPlayed: this.aiHandsPlayed[i],
          recentHands: this.aiRecentHands[i],
          lastChatHand: this.aiLastChatHand[i],
        });
      }
    }
    this.pending = Array(this.maxSeats).fill(null);
    this.connections = Array(this.maxSeats).fill(null);
    this.aiSeats = Array(this.maxSeats).fill(false);
    this.aiStrategy = Array(this.maxSeats).fill(null);
    this.agentIds = Array(this.maxSeats).fill(null);
    this.agentUserIds = Array(this.maxSeats).fill(null);
    this.agentMemory = Array(this.maxSeats).fill('');
    this.agentProfiles = Array(this.maxSeats).fill(null);
    this.aiHandsPlayed = Array(this.maxSeats).fill(0);
    this.aiRecentHands = Array(this.maxSeats).fill(null).map(() => []);
    this.aiLastChatHand = Array(this.maxSeats).fill(-1);
    for (let i = 0; i < filled.length; i++) {
      this.pending[i] = filled[i].pending;
      this.connections[i] = filled[i].ws;
      this.aiSeats[i] = filled[i].aiSeat;
      this.aiStrategy[i] = filled[i].aiStrategy;
      this.agentIds[i] = filled[i].agentId;
      this.agentUserIds[i] = filled[i].userId;
      this.agentMemory[i] = filled[i].memory ?? '';
      this.agentProfiles[i] = filled[i].profile ?? null;
      this.aiHandsPlayed[i] = filled[i].handsPlayed ?? 0;
      this.aiRecentHands[i] = filled[i].recentHands ?? [];
      this.aiLastChatHand[i] = filled[i].lastChatHand ?? -1;
    }
  }

  // Called once at least 2 pending players are seated.
  maybeStartHand() {
    if (this.game && this.game.street !== Streets.COMPLETE && this.game.street !== Streets.WAITING) return;
    const filled = this.pending.filter((p) => p !== null);
    if (filled.length < 2) return;

    if (!this.game) {
      this.game = new Game({
        tableId: this.tableId,
        seats: filled.map((p) => ({ playerId: p.playerId, stack: p.buyIn })),
        smallBlind: this.smallBlind,
        bigBlind: this.bigBlind,
      });
    }

    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
      return;
    }

    // Reset per-hand state before the new hand.
    this.currentHandDecisions = [];
    this.currentHandActionLog = [];
    this.aiLastChatHand = Array(this.maxSeats).fill(-1);
    this.currentHandStartStacks = this.game.seats.map((s) => s.stack);
    this._raiseCounts = {};
    this._streetAtActionCapture = null;
    this.game.startHand();
    this._broadcast({ type: ServerMsg.HAND_START, handNumber: this.game.handNumber });
    this._resetAiInactivityTimer();
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  applyAction(ws, action) {
    if (!this.game) throw new Error('hand not in progress');
    const seat = this.connections.indexOf(ws);
    if (seat === -1) throw new Error('connection not seated');
    const streetBefore = this.game.street;
    this.game.act(seat, action);
    this._incrementRaiseCountIfAggressive(action);
    this._logAction(seat, streetBefore, action);
    this._resetAiInactivityTimer();
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
    this._broadcast({ type: ServerMsg.HAND_RESULT, result: this.game.result });
    // Fire-and-forget per-agent result reports. Snapshot data we need now,
    // because subsequent hands will reset the game's seat state.
    this._reportHandResults(this.game.result);
    this._persistHand();
    this._recordOpponentStats(this.game.result);
    this._updateAgentMoods(this.game.result);
    // After reporting, evolve any AI's persistent memory every 5 hands.
    this._maybeTriggerMemoryUpdates();
    if (this._pendingSitOut) {
      this._pendingSitOut = false;
      this._closeSitOut();
      return;
    }
    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
      return;
    }
    // Auto-deal when all FILLED seats are AI (spectator mode ÔÇö no human to click DEAL).
    const allFilledAreAi = this.pending.some((p) => p !== null) &&
      this.pending.every((p, i) => p === null || this.aiSeats[i]);
    if (allFilledAreAi) {
      setTimeout(() => this.maybeStartHand(), 2500);
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
      const currentMood = getAgentMood(agentId, this.agentUserIds[seat]);
      if (!currentMood) continue;
      const profile = this.agentProfiles[seat] ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };

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
        mood = applyMoodEvent(mood, ev.type, profile, { context: ev.ctx });
      }
      if (events.length === 0) {
        mood = tickMoodDecay(mood);
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
      const decisions = this.currentHandDecisions.filter((d) => d.seat === seat);
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
        });
      } catch (err) {
        console.error('[table] result report failed:', err.message);
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
    // Send read-only state to spectators (no legal actions).
    for (const s of this.spectators) {
      if (!s.ws || s.ws.readyState !== s.ws.OPEN) continue;
      if (s.spectatorSeat >= nGameSeats) continue;
      const state = this._augmentState(this.game.getPublicState(s.spectatorSeat));
      s.ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: [], yourSeat: s.spectatorSeat }));
    }
    // Schedule AI turn if applicable ÔÇö async, fire-and-forget.
    this._maybeRunAiTurn().catch((err) =>
      console.error(`[table:${this.tableId}] AI turn error:`, err.message),
    );
  }

  // Augment state with display names from Table metadata.
  _augmentState(state) {
    state.seats = state.seats.map((s, i) => ({
      ...s,
      displayName: this.pending[i]?.displayName || s.playerId,
    }));
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

  // Build the gameState object for the agent handler from the current game.
  _buildAiGameState(aiSeat) {
    const g = this.game;
    const N = g.seats.length;
    const me = g.seats[aiSeat];
    // For backwards compatibility with the (heads-up) agent prompt, expose a
    // single primary opponent. Pick the seat immediately left of the AI; in
    // HU this collapses to the only opponent.
    const oppSeat = (aiSeat + 1) % N;
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
    const policy = compilePolicy(seatProfile, {
      holeCards: me.holeCards,
      position,
    });

    // Mood-derived bounded effects: nudge the deviation die probability and
    // (via the briefing) sizing. The range verdict itself never changes —
    // per Mood Design Law rule 2, mood shifts flavor, never quality.
    const mood = this.agentIds[aiSeat]
      ? getAgentMood(this.agentIds[aiSeat], this.agentUserIds[aiSeat])
      : null;
    if (mood && mood.state !== 'neutral') {
      const eff = moodDecisionEffects(mood);
      const baseDeviation = (100 - seatProfile.discipline) / 100;
      const boosted = Math.max(0, Math.min(1, baseDeviation + eff.deviationBoost));
      policy.dice.deviationDie = Math.random() < boosted;
    }

    const raisesThisStreet = this._getRaiseCountThisStreet();

    // Read summaries for every OTHER seat with ≥10 observed hands. Handed
    // to the briefing so the LLM can adapt sizing/fold decisions to how
    // this specific opponent has been playing.
    const opponentReads = [];
    for (let i = 0; i < this.pending.length; i++) {
      if (i === aiSeat) continue;
      const pid = this.pending[i]?.playerId;
      if (!pid) continue;
      const read = getOpponentRead(pid);
      if (read && read.handsObserved >= 10) opponentReads.push(read);
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

    const gameState = this._buildAiGameState(aiSeat);
    const strategy = this.agentStrategy || this.aiStrategy[aiSeat];

    // Human-like thinking delay (0.8ÔÇô2.5 s).
    const thinkMs = 800 + Math.random() * 1700;
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
    this.currentHandDecisions.push({
      seat: aiSeat,
      street: this.game.street,
      action,
      reasoning,
      holeCards: [...this.game.seats[aiSeat].holeCards],
      community: [...this.game.community],
      equity: gameState.equity,
      potOdds: gameState.potOdds,
      timestamp: Date.now(),
    });

    const streetBefore = this.game.street;
    try {
      this.game.act(aiSeat, action);
      this._incrementRaiseCountIfAggressive(action);
      this._logAction(aiSeat, streetBefore, action);
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
