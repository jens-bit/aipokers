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
            const table = getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind, bigBlind: msg.bigBlind });
            const seat = table.seatPlayer(ws, {
              playerId: msg.playerId,
              buyIn: msg.buyIn,
              displayName: msg.displayName,
            });
            ws.tableId = msg.tableId;
            send(ws, { type: ServerMsg.JOINED, tableId: msg.tableId, seat });
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
