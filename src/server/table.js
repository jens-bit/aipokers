import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';
import { getAgentAction, generateAiChatLine } from '../agent/handler.js';

// A Table owns a single Game instance and the WebSocket connections for its
// 2–4 seats. It serializes incoming actions, broadcasts filtered state, and
// auto-starts the next hand once enough seated players still have chips.
//
// Seat invariant: occupied seats are contiguous from index 0. The
// game.seats[i] always corresponds to table.pending[i]. seatPlayer / seatAI
// always pick the lowest free index, and a mid-table disconnect compacts the
// remaining seats down (only for maxSeats > 2 — HU keeps fixed indices).
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
    this.aiHandsPlayed = Array(maxSeats).fill(0);  // local hand count per AI seat (for memory-update cadence)
    this.aiRecentHands = Array(maxSeats).fill(null).map(() => []); // last 5 hand summaries per AI seat
    this.agentStrategy = null;                     // player-designed strategy from CreateAgent flow
    this._aiInactivityTimer = null;                // 60s timeout for AI tables

    // Per-hand decision log; reset at the start of each hand. Populated by
    // _maybeRunAiTurn before every AI action and consumed in _handCompleted.
    this.currentHandDecisions = [];                // [{ seat, street, action, reasoning, holeCards, community, timestamp }]

    // Rolling chat history (last 20, newest last). Used only by sendChat —
    // not replayed to clients on reconnect for simplicity.
    this.chatHistory = [];                         // [{ seat, displayName, text, isAI, timestamp }]

    // Spectators: users who watch their AI play from its seat's POV
    this.spectators = [];                          // [{ ws, spectatorSeat }]
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
  seatAI({ displayName = 'Agentic v1', strategy = '', buyIn, agentId = null, userId = null, memoryContext = '' } = {}) {
    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full — cannot seat AI');

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
    this.aiHandsPlayed[free] = 0;
    this.aiRecentHands[free] = [];
    console.log(`[table:${this.tableId}] AI agent seated at slot ${free} (stack ${aiBuyIn}, model ${process.env.AI_MODEL || 'claude-haiku-4-5'}${agentId ? `, agentId=${agentId}` : ''}${this.agentMemory[free] ? ', memory: yes' : ''})`);
    return free;
  }

  // Seat an AI for a spectating user and register their WS for state broadcasts.
  // Returns the seat index the AI was placed at.
  addSpectator(ws, { agentStrategy, displayName, agentId = null, userId = null, memoryContext = '' } = {}) {
    const seat = this.seatAI({
      strategy: agentStrategy || '',
      displayName: displayName || 'Agent',
      agentId,
      userId,
      memoryContext,
    });
    this.spectators.push({ ws, spectatorSeat: seat });
    return seat;
  }

  // Auto-seat AI at the free slot when one human is seated. No-op if table is
  // already full or has no human seated.
  maybeAutoSeatAI({ agentStrategy = null, agentDisplayName = null, agentId = null, userId = null, memoryContext = '' } = {}) {
    const humanSeated = this.pending.some((p, i) => p !== null && !this.aiSeats[i]);
    const hasFree = this.pending.some((p) => p === null);
    if (!humanSeated || !hasFree) return;
    if (agentStrategy) this.agentStrategy = agentStrategy;
    this.seatAI({ displayName: agentDisplayName || undefined, agentId, userId, memoryContext });
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
        this.agentIds[i] = null;
        this.agentUserIds[i] = null;
        this.agentMemory[i] = '';
        this.aiHandsPlayed[i] = 0;
        this.aiRecentHands[i] = [];
        if (this.game && this.game.street !== Streets.WAITING && this.game.street !== Streets.COMPLETE) {
          // Reset the in-progress hand so the table is in a clean state.
          this.game = null;
        }
      }
    }

    // For multi-seat tables, maintain the contiguous-from-zero invariant by
    // compacting when a middle disconnect creates a gap. HU (maxSeats=2)
    // keeps its existing seat-index-stable behaviour.
    if (this.maxSeats > 2) this._compactSeatsIfGapped();

    if (this.connections.every((c) => c === null) && this.spectators.length === 0) {
      if (this._aiInactivityTimer) {
        clearTimeout(this._aiInactivityTimer);
        this._aiInactivityTimer = null;
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
          handsPlayed: this.aiHandsPlayed[i],
          recentHands: this.aiRecentHands[i],
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
    this.aiHandsPlayed = Array(this.maxSeats).fill(0);
    this.aiRecentHands = Array(this.maxSeats).fill(null).map(() => []);
    for (let i = 0; i < filled.length; i++) {
      this.pending[i] = filled[i].pending;
      this.connections[i] = filled[i].ws;
      this.aiSeats[i] = filled[i].aiSeat;
      this.aiStrategy[i] = filled[i].aiStrategy;
      this.agentIds[i] = filled[i].agentId;
      this.agentUserIds[i] = filled[i].userId;
      this.agentMemory[i] = filled[i].memory ?? '';
      this.aiHandsPlayed[i] = filled[i].handsPlayed ?? 0;
      this.aiRecentHands[i] = filled[i].recentHands ?? [];
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

    // Reset the per-hand decision log before the new hand so reports only
    // contain decisions taken during this hand.
    this.currentHandDecisions = [];
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
    // Fire-and-forget per-agent result reports. Snapshot data we need now,
    // because subsequent hands will reset the game's seat state.
    this._reportHandResults(this.game.result);
    // After reporting, evolve any AI's persistent memory every 5 hands.
    this._maybeTriggerMemoryUpdates();
    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
      return;
    }
    // Auto-deal when all FILLED seats are AI (spectator mode — no human to click DEAL).
    const allFilledAreAi = this.pending.some((p) => p !== null) &&
      this.pending.every((p, i) => p === null || this.aiSeats[i]);
    if (allFilledAreAi) {
      setTimeout(() => this.maybeStartHand(), 2500);
    }
  }

  // POST a per-agent summary of the just-completed hand to the HTTP API so
  // stats and recent-hands history can be persisted. Best-effort — failures
  // are logged but do not affect the table.
  _reportHandResults(result) {
    if (!result || !this.game) return;
    const port = process.env.PORT || 8765;
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

      const body = {
        userId: this.agentUserIds[seat],
        won,
        potSize: result.pot,
        decisions,
        handNumber,
        seats: seatSnapshots,
      };
      fetch(`http://localhost:${port}/api/agents/${agentId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((err) => console.error('[table] result report failed:', err.message));
    }
  }

  // For each AI seat with an agentId, increment the local hand counter and
  // fire an /update-memory call every 5 hands. Then refresh the cached
  // memoryContext so the next decision uses the new self-knowledge.
  _maybeTriggerMemoryUpdates() {
    for (let seat = 0; seat < this.maxSeats; seat++) {
      if (!this.agentIds[seat]) continue;
      this.aiHandsPlayed[seat] = (this.aiHandsPlayed[seat] ?? 0) + 1;
      if (this.aiHandsPlayed[seat] > 0 && this.aiHandsPlayed[seat] % 5 === 0) {
        this._triggerMemoryUpdate(seat);
      }
    }
  }

  _triggerMemoryUpdate(seat) {
    const agentId = this.agentIds[seat];
    const userId = this.agentUserIds[seat];
    if (!agentId) return;
    const port = process.env.PORT || 8765;
    const recentHands = this.aiRecentHands[seat] ?? [];
    console.log(`[table:${this.tableId}] triggering memory update for agent ${agentId} (${recentHands.length} recent hands)`);
    fetch(`http://localhost:${port}/api/agents/${agentId}/update-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, recentHands }),
    })
      .then((r) => (r.ok ? this._refreshAgentMemory(seat) : null))
      .catch((err) => console.error('[table] memory update failed:', err.message));
  }

  // Re-read the agent's formatted memoryContext so subsequent decisions pick
  // up the new self-knowledge. Best-effort, short-lived.
  _refreshAgentMemory(seat) {
    const agentId = this.agentIds[seat];
    const userId = this.agentUserIds[seat];
    if (!agentId) return;
    const port = process.env.PORT || 8765;
    fetch(`http://localhost:${port}/api/agents/${agentId}/memory?userId=${encodeURIComponent(userId ?? 'anon')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // Re-check the seat is still owned by the same agent — the table may
        // have been compacted or re-seated while we awaited the fetch.
        if (this.agentIds[seat] !== agentId) return;
        this.agentMemory[seat] = data.memoryContext || '';
        console.log(`[table:${this.tableId}] refreshed memory for seat ${seat} (${this.agentMemory[seat].length} chars)`);
      })
      .catch(() => {});
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

  // ── Table chat ─────────────────────────────────────────────────────────────

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
  // with no watcher). Probabilistic — most calls produce nothing.
  //   trigger: 'big_pot' | 'aggressive_action' | 'won_hand' | 'human_chat'
  //   humanMessage: only meaningful for 'human_chat'.
  _maybeGenerateAiChat(aiSeat, trigger, humanMessage = null) {
    if (!this.aiSeats[aiSeat] || !this.pending[aiSeat]) return;
    const hasHuman =
      this.connections.some((ws, i) => ws && !this.aiSeats[i]) ||
      this.spectators.length > 0;
    if (!hasHuman) {
      console.log(`[table:${this.tableId}] skipping AI chat (${trigger}) — no human at table`);
      return;
    }
    // Always respond to direct human chat (psychological warfare feature).
    // Other triggers (big_pot, won_hand, aggressive_action) fire 30% of the time.
    if (trigger !== 'human_chat' && Math.random() >= 0.3) return;

    const strategy = this.agentStrategy || this.aiStrategy[aiSeat] || '';
    const gameContext = {
      pot: this.game?.pot ?? 0,
      street: this.game?.street ?? 'preflop',
    };

    generateAiChatLine(gameContext, strategy, trigger, humanMessage)
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
      toCall:     callAction?.amount ?? 0,
      minBet:     betAction?.min ?? 0,
      maxBet:     betAction?.max ?? 0,
      minRaise:   raiseAction?.min ?? 0,
      maxRaise:   raiseAction?.max ?? 0,
      opponents:  g.seats
        .map((s, i) => i === aiSeat ? null : { seat: i, stack: s.stack, folded: s.folded, contribThisStreet: s.contribThisStreet })
        .filter(Boolean),
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
      timestamp: Date.now(),
    });

    try {
      this.game.act(aiSeat, action);
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
      // Safe fallback — play whatever is available.
      const legal = this.game.legalActions(aiSeat);
      const fallback = legal.find((a) => a.type === 'check') ?? legal.find((a) => a.type === 'call') ?? { type: 'fold' };
      const fallbackAction = { type: fallback.type, ...(fallback.amount ? { amount: fallback.amount } : {}) };
      try {
        this.game.act(aiSeat, fallbackAction);
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
