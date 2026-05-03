import { Game, Streets } from '../engine/game.js';
import { ServerMsg } from './protocol.js';

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
    this.pending = [null, null];     // { playerId, buyIn } per seat before hand starts
    this.game = null;
  }

  // Returns the seat the player got, or throws.
  seatPlayer(ws, { playerId, buyIn }) {
    const existingSeat = this.pending.findIndex((p) => p?.playerId === playerId);
    if (existingSeat !== -1) {
      // Reconnect: replace the WebSocket on that seat.
      const prev = this.connections[existingSeat];
      if (prev && prev !== ws && prev.readyState === prev.OPEN) {
        prev.close(4000, 'replaced by new connection');
      }
      this.connections[existingSeat] = ws;
      return existingSeat;
    }

    const free = this.pending.findIndex((p) => p === null);
    if (free === -1) throw new Error('table full');
    if (!Number.isInteger(buyIn) || buyIn < this.bigBlind * 10) {
      throw new Error(`buy-in must be an integer >= ${this.bigBlind * 10}`);
    }
    this.pending[free] = { playerId, buyIn };
    this.connections[free] = ws;
    return free;
  }

  removeConnection(ws) {
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i] === ws) {
        this.connections[i] = null;
        // Keep `pending` so the player can reconnect mid-hand. Only fully
        // remove the seat if no game is in progress.
        if (!this.game || this.game.street === Streets.WAITING || this.game.street === Streets.COMPLETE) {
          this.pending[i] = null;
        }
      }
    }
    if (this.connections.every((c) => c === null) && this.onEmpty) {
      this.onEmpty(this.tableId);
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
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  applyAction(ws, action) {
    if (!this.game) throw new Error('hand not in progress');
    const seat = this.connections.indexOf(ws);
    if (seat === -1) throw new Error('connection not seated');
    this.game.act(seat, action);
    this._broadcastState();
    if (this.game.street === Streets.COMPLETE) this._handCompleted();
  }

  _handCompleted() {
    this._broadcast({ type: ServerMsg.HAND_RESULT, result: this.game.result });
    if (this.game.seats.some((s) => s.stack <= 0)) {
      this._broadcast({ type: ServerMsg.TABLE_CLOSED, reason: 'a player ran out of chips' });
    }
    // The next hand waits for an explicit DEAL message from a seated player.
  }

  _broadcastState() {
    for (let seat = 0; seat < this.connections.length; seat++) {
      const ws = this.connections[seat];
      if (!ws || ws.readyState !== ws.OPEN) continue;
      const state = this.game.getPublicState(seat);
      const legal = this.game.legalActions(seat);
      ws.send(JSON.stringify({ type: ServerMsg.STATE, state, legalActions: legal }));
    }
  }

  _broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const ws of this.connections) {
      if (ws && ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}
