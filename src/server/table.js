import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';
import { getAgentAction } from '../agent/handler.js';

// A Table owns a single Game instance and the WebSocket connections for its
// two seats. It serializes incoming actions, broadcasts filtered state, and
// auto-starts the next hand once both players still have chips.
export class Table {
  constructor({ tableId, smallBlind, bigBlind, onEmpty }) {
    this.tableId = tableId;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.onEmpty = onEmpty;
    this.connections = [null, null]; // ws by seat
    this.pending = [null, null];     // { playerId, buyIn, displayName } per seat before hand starts
    this.game = null;

    // AI seat tracking
    this.aiSeats = [false, false];   // true if that seat is controlled by the AI agent
    this.aiStrategy = [null, null];  // per-seat strategy string (passed to prompt)
    this.agentStrategy = null;       // player-designed strategy from CreateAgent flow
    this._aiInactivityTimer = null;  // 60s timeout for AI tables

    // Spectators: users who watch their AI play from its seat's POV
    this.spectators = [];            // [{ ws, spectatorSeat }]
  }

  // Returns the seat the player got, or throws.
  seatPlayer(ws, { playerId, buyIn, displayName }) {
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

  // Seat an AI agent at the first free slot. Called when AI_ENABLED=true.
  seatAI({ displayName = 'Agentic v1', strategy = '', buyIn } = {}) {
    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full — cannot seat AI');

    // Match the human player's buy-in if not specified.
    const humanSeat = this.pending.findIndex((p) => p !== null && !this.aiSeats[this.pending.indexOf(p)]);
    const aiBuyIn = buyIn ?? this.pending[humanSeat]?.buyIn ?? this.bigBlind * 100;

    this.pending[free] = {
      playerId: `ai_agent_${free}`,
      buyIn: aiBuyIn,
      displayName,
    };
    this.aiSeats[free] = true;
    this.aiStrategy[free] = strategy || process.env.AI_STRATEGY || '';
    console.log(`[table:${this.tableId}] AI agent seated at slot ${free} (stack ${aiBuyIn}, model ${process.env.AI_MODEL || 'claude-haiku-4-5'})`);
    return free;
  }

  // Seat an AI for a spectating user and register their WS for state broadcasts.
  // Returns the seat index the AI was placed at.
  addSpectator(ws, { agentStrategy, displayName } = {}) {
    const seat = this.seatAI({
      strategy: agentStrategy || '',
      displayName: displayName || 'Agent',
    });
    this.spectators.push({ ws, spectatorSeat: seat });
    return seat;
  }

  // Auto-seat AI at the free slot when one human is seated. No-op if table is
  // already full or has no human seated.
  maybeAutoSeatAI(agentStrategy = null, agentDisplayName = null) {
    const humanSeated = this.pending.some((p, i) => p !== null && !this.aiSeats[i]);
    const hasFree = this.pending.some((p) => p === null);
    if (!humanSeated || !hasFree) return;
    if (agentStrategy) this.agentStrategy = agentStrategy;
    this.seatAI({ displayName: agentDisplayName || undefined });
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
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'Session ended — no activity for 60 seconds' });
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
        this.onEmpty?.(this.tableId);
      }
      return;
    }

    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i] === ws) {
        this.connections[i] = null;
        // For Phase 1 dev simplicity, always release the seat on disconnect so
        // a fresh tab can take it. This means abandoning a tab mid-hand opens
        // the seat back up; we'll add proper sit-out / timeout handling later.
        this.pending[i] = null;
        // Also clear AI flags so the table slot can be reused cleanly.
        this.aiSeats[i] = false;
        this.aiStrategy[i] = null;
        if (this.game && this.game.street !== Streets.WAITING && this.game.street !== Streets.COMPLETE) {
          // Reset the in-progress hand so the table is in a clean state.
          this.game = null;
        }
      }
    }
    if (this.connections.every((c) => c === null) && this.spectators.length === 0) {
      if (this._aiInactivityTimer) {
        clearTimeout(this._aiInactivityTimer);
        this._aiInactivityTimer = null;
      }
      this.onEmpty?.(this.tableId);
    }
  }

  // Called once both seats have a pending player.
  maybeStartHand() {
    if (this.game && this.game.street !== Streets.COMPLETE && this.game.street !== Streets.WAITING) return;
    if (this.pending.some((p) => p === null)) return;

    if (!this.game) {
      this.game = new Game({
        tableId: this.tableId,
        seats: this.pending.map((p) => ({ playerId: p.playerId, stack: p.buyIn })),
        smallBlind: this.smallBlind,
        bigBlind: this.bigBlind,
      });
    }

    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
      return;
    }

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
    this.game.act(seat, action);
    this._resetAiInactivityTimer();
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  _handCompleted() {
    this._broadcast({ type: ServerMsg.HAND_RESULT, result: this.game.result });
    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
      return;
    }
    // Auto-deal when all seats are AI (spectator mode — no human to click DEAL).
    if (this.aiSeats.every(Boolean)) {
      setTimeout(() => this.maybeStartHand(), 2500);
    }
  }

  _broadcastState() {
    for (let seat = 0; seat < this.connections.length; seat++) {
      const ws = this.connections[seat];
      if (!ws || ws.readyState !== ws.OPEN) continue;
      const state = this._augmentState(this.game.getPublicState(seat));
      const legal = this.game.legalActions(seat);
      ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: legal, yourSeat: seat }));
    }
    // Send read-only state to spectators (no legal actions).
    for (const s of this.spectators) {
      if (!s.ws || s.ws.readyState !== s.ws.OPEN) continue;
      const state = this._augmentState(this.game.getPublicState(s.spectatorSeat));
      s.ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: [], yourSeat: s.spectatorSeat }));
    }
    // Schedule AI turn if applicable — async, fire-and-forget.
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

  // Build the gameState object for the agent handler from the current game.
  _buildAiGameState(aiSeat) {
    const g = this.game;
    const oppSeat = 1 - aiSeat;
    const me = g.seats[aiSeat];
    const opp = g.seats[oppSeat];
    const legal = g.legalActions(aiSeat);

    const callAction   = legal.find((a) => a.type === 'call')  ?? null;
    const betAction    = legal.find((a) => a.type === 'bet')   ?? null;
    const raiseAction  = legal.find((a) => a.type === 'raise') ?? null;

    return {
      holeCards:  me.holeCards,
      community:  g.community,
      pot:        g.pot,
      street:     g.street,
      myStack:    me.stack,
      oppStack:   opp.stack,
      myContrib:  me.contribThisStreet,
      position:   g.dealerSeat === aiSeat ? 'BTN/SB' : 'BB',
      sb:         g.smallBlind,
      bb:         g.bigBlind,
      canCheck:   legal.some((a) => a.type === 'check'),
      canBet:     !!betAction,
      canRaise:   !!raiseAction,
      toCall:     callAction?.amount ?? 0,
      minBet:     betAction?.min ?? 0,
      maxBet:     betAction?.max ?? 0,
      minRaise:   raiseAction?.min ?? 0,
      maxRaise:   raiseAction?.max ?? 0,
    };
  }

  // If it's currently an AI seat's turn, fetch a decision and apply it.
  // Async — called fire-and-forget from _broadcastState.
  async _maybeRunAiTurn() {
    const g = this.game;
    if (!g) return;
    const aiSeat = g.toAct;
    if (aiSeat === null || aiSeat === undefined) return;
    if (!this.aiSeats[aiSeat]) return;
    if (g.street === Streets.COMPLETE || g.street === Streets.WAITING) return;

    const gameState = this._buildAiGameState(aiSeat);
    const strategy = this.agentStrategy || this.aiStrategy[aiSeat];

    // Human-like thinking delay (0.8–2.5 s).
    const thinkMs = 800 + Math.random() * 1700;
    await new Promise((r) => setTimeout(r, thinkMs));

    // Re-check: the human might have acted somehow, or hand ended.
    if (!this.game || this.game.toAct !== aiSeat || this.game.street === Streets.COMPLETE) return;

    console.log(`[agent] using strategy: "${(this.agentStrategy || 'default').slice(0, 60)}"`);
    const decision = await getAgentAction(gameState, strategy);

    // One final guard before mutating game state.
    if (!this.game || this.game.toAct !== aiSeat) return;

    try {
      this.game.act(aiSeat, decision);
      this._resetAiInactivityTimer();
      this._broadcastState();
      if (this.game.street === Streets.COMPLETE) this._handCompleted();
    } catch (err) {
      console.error(`[table:${this.tableId}] AI action rejected (${JSON.stringify(decision)}):`, err.message);
      // Safe fallback — play whatever is available.
      const legal = this.game.legalActions(aiSeat);
      const fallback = legal.find((a) => a.type === 'check') ?? legal.find((a) => a.type === 'call') ?? { type: 'fold' };
      try {
        this.game.act(aiSeat, { type: fallback.type, ...(fallback.amount ? { amount: fallback.amount } : {}) });
        this._resetAiInactivityTimer();
        this._broadcastState();
        if (this.game.street === Streets.COMPLETE) this._handCompleted();
      } catch (e2) {
        console.error(`[table:${this.tableId}] fallback action also failed:`, e2.message);
      }
    }
  }
}
