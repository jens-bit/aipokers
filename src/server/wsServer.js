import { WebSocketServer } from 'ws';
import { ClientMsg, ServerMsg } from './protocol.js';
import { Table } from './table.js';

// Either pass `server` (an existing http.Server, e.g. shared with Express) to
// attach the WebSocket upgrade handler to it, or pass `port`/`host` to create
// a standalone listening WS server. Returns { wss, tables }.
export function createServer({ port, host = '0.0.0.0', server, defaultBlinds = { smallBlind: 10, bigBlind: 20 } }) {
  const wss = server
    ? new WebSocketServer({ server })
    : new WebSocketServer({ port, host });
  const tables = new Map();   // tableId -> Table

  function getOrCreateTable(tableId, opts = {}) {
    let table = tables.get(tableId);
    if (!table) {
      table = new Table({
        tableId,
        smallBlind: opts.smallBlind ?? defaultBlinds.smallBlind,
        bigBlind: opts.bigBlind ?? defaultBlinds.bigBlind,
        maxSeats: opts.maxSeats ?? 2,
        onEmpty: (id) => tables.delete(id),
      });
      tables.set(tableId, table);
    }
    return table;
  }

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  function sendError(ws, message) {
    send(ws, { type: ServerMsg.ERROR, message });
  }

  wss.on('connection', (ws) => {
    ws.tableId = null;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendError(ws, 'invalid JSON');
        return;
      }

      try {
        switch (msg.type) {
          case ClientMsg.PING:
            send(ws, { type: ServerMsg.PONG });
            return;

          case ClientMsg.JOIN: {
            if (!msg.tableId || !msg.playerId) throw new Error('tableId and playerId required');
            const table = getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind, bigBlind: msg.bigBlind, maxSeats: msg.maxSeats });
            const seat = table.seatPlayer(ws, {
              playerId: msg.playerId,
              buyIn: msg.buyIn,
              displayName: msg.displayName,
            });
            ws.tableId = msg.tableId;
            send(ws, { type: ServerMsg.JOINED, tableId: msg.tableId, seat });
            // Auto-seat AI when the server has AI enabled AND the player asked for it.
            if (process.env.AI_ENABLED === 'true' && msg.wantAI === true) {
              table.maybeAutoSeatAI({
                agentStrategy: msg.agentStrategy ?? null,
                agentDisplayName: msg.agentDisplayName ?? null,
                agentId: msg.agentId ?? null,
                userId: msg.userId ?? null,
                memoryContext: msg.memoryContext ?? '',
              });
            }
            table.maybeStartHand();
            return;
          }

          case ClientMsg.WATCH: {
            if (!msg.tableId) throw new Error('tableId required');
            const table = getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind ?? 10, bigBlind: msg.bigBlind ?? 20, maxSeats: msg.maxSeats });
            const spectatorSeat = table.addSpectator(ws, {
              agentStrategy: msg.agentStrategy ?? null,
              displayName: msg.displayName,
              agentId: msg.agentId ?? null,
              userId: msg.userId ?? null,
              memoryContext: msg.memoryContext ?? '',
            });
            ws.tableId = msg.tableId;
            send(ws, { type: ServerMsg.WATCHING, tableId: msg.tableId, spectatorSeat });
            const seatedAiCount = table.aiSeats.filter(Boolean).length;
            const seatedHumanCount = table.connections.filter((c) => c !== null).length;
            if (seatedAiCount === 1 && seatedHumanCount === 0) {
              table.maybeAutoSeatAI({
                agentDisplayName: 'House',
                agentStrategy: 'You are a tight-aggressive heads-up player. You play premium hands aggressively, fold weak ones, and bluff occasionally at about 30% frequency. Mix up your play to stay unpredictable.',
                agentId: null,
                userId: null,
                memoryContext: '',
              });
            }
            table.maybeStartHand();
            return;
          }

          case ClientMsg.RENAME: {
            const table = tables.get(ws.tableId);
            if (!table) throw new Error('not seated at any table');
            table.rename(ws, msg.displayName);
            return;
          }

          case ClientMsg.ACTION: {
            const table = tables.get(ws.tableId);
            if (!table) throw new Error('not seated at any table');
            table.applyAction(ws, msg.action);
            return;
          }

          case ClientMsg.DEAL: {
            const table = tables.get(ws.tableId);
            if (!table) throw new Error('not seated at any table');
            table.maybeStartHand();
            return;
          }

          case ClientMsg.CHAT: {
            const table = tables.get(ws.tableId);
            if (!table) throw new Error('not at a table');
            const seat = table.connections.indexOf(ws);
            // Spectators can also chat — find their effective seat.
            const specEntry = seat === -1 ? table.spectators.find((s) => s.ws === ws) : null;
            const effectiveSeat = seat !== -1 ? seat : (specEntry?.spectatorSeat ?? -1);
            if (effectiveSeat === -1) throw new Error('not seated');
            if (!msg.text || !String(msg.text).trim()) return;
            const text = String(msg.text).trim();
            table.sendChat(effectiveSeat, text, false);
            // Maybe trigger AI seats to respond to the human chat.
            for (let i = 0; i < table.aiSeats.length; i++) {
              if (table.aiSeats[i] && table.pending[i]) {
                table._maybeGenerateAiChat(i, 'human_chat', text);
              }
            }
            return;
          }

          case ClientMsg.LEAVE: {
            const table = tables.get(ws.tableId);
            if (table) table.removeConnection(ws);
            ws.tableId = null;
            return;
          }

          default:
            throw new Error(`unknown message type: ${msg.type}`);
        }
      } catch (err) {
        sendError(ws, err.message);
      }
    });

    ws.on('close', () => {
      const table = tables.get(ws.tableId);
      if (table) table.removeConnection(ws);
    });

    ws.on('error', () => {
      const table = tables.get(ws.tableId);
      if (table) table.removeConnection(ws);
    });
  });

  return { wss, tables };
}
