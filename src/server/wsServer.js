import { WebSocketServer } from 'ws';
import { ClientMsg, ServerMsg } from './protocol.js';
import { isOwner } from './auth.js';
import {
  getAgentProfile, setLiveTableProvider, setAgentChangeListener,
  reconcileActiveSessions, presentedRoster,
} from './agentProfiles.js';
import * as registry from './tableRegistry.js';
import * as floor from './floorChannel.js';
import * as rooms from './rooms.js';
import * as homeGame from './homeGame.js';
import * as homeNight from './homeNight.js';

const { getOrCreateTable } = registry;

// Either pass `server` (an existing http.Server, e.g. shared with Express) to
// attach the WebSocket upgrade handler to it, or pass `port`/`host` to create
// a standalone listening WS server. Returns { wss, tables }.
//
// This function is also the composition root: it hands the REST layer a live
// view of the table registry (AGE-35 deploy needs to create tables) and runs
// boot reconciliation so no agent is left pointing at a table that died with
// the previous process.
export function createServer({ port, host = '0.0.0.0', server, defaultBlinds = { smallBlind: 10, bigBlind: 20 } }) {
  const wss = server
    ? new WebSocketServer({ server })
    : new WebSocketServer({ port, host });

  registry.setDefaultBlinds(defaultBlinds);
  setLiveTableProvider(registry);
  // AGE-38: the floor channel listens to both sides — table state changes for
  // FLOOR_GAME deltas, agent standing changes for FLOOR_STATE refreshes.
  floor.configure({ liveTables: registry, homeGames: homeGame });
  // ROOMS-1: the floor-by-stakes view reads the same registry, through the same
  // kind of injected provider, so neither it nor floorChannel imports table.js.
  rooms.configure({ liveTables: registry });
  // HOME-STATE-1: the home game reads the registry (to stand a table up) and
  // the roster (to know who is in). Both injected, so homeGame imports neither
  // table.js nor agentProfiles.js and the graph stays acyclic.
  homeGame.configure({
    liveTables: registry,
    agentsFor: (userId) => presentedRoster(userId, { owner: true }),
    onChange: (userId) => floor.notifyHomeChanged(userId),
  });
  registry.setStateHook((table) => floor.notifyTable(table));
  // HOME-STATE-1: an agent's standing changing is the trigger for all three —
  // the home game reconciles first (so the snapshot the floor is about to send
  // already reflects it), then the floor and the living room are pushed. The
  // nightly observation rides the same tick, because "who was in together" is
  // exactly the question a standing change answers.
  setAgentChangeListener((userId) => {
    try {
      homeGame.sync(userId);
      const roster = presentedRoster(userId, { owner: true });
      homeNight.noteHousehold(userId, roster);
      // Fire-and-forget: the exchange is a nightly nicety and must never be on
      // the path of anything that made an agent's standing change. It is
      // capped to one model call per owner per day inside.
      homeNight.maybeRunNightly(userId, roster)
        .catch((err) => console.error('[home-night] failed:', err.message));
    } catch (err) {
      console.error('[home] sync failed:', err.message);
    }
    floor.notifyAgentsChanged(userId);
  });
  const retired = reconcileActiveSessions();
  if (retired > 0) {
    console.log(`[ai-poker] boot reconciliation retired ${retired} agent(s) whose table no longer exists`);
  }
  const tables = registry.allTables();

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
            // Auto-seat AI when the player explicitly asked for it (vs-You flow),
            // or schedule House as a fallback opponent if no one else joins.
            console.log(`[JOIN] AI_ENABLED=${process.env.AI_ENABLED}, wantAI=${msg.wantAI} (type: ${typeof msg.wantAI}), agentDisplayName=${msg.agentDisplayName ?? 'n/a'}`);
            if (msg.wantAI === true) {
              const agentProfile = msg.agentId ? getAgentProfile(msg.agentId, msg.userId) : null;
              table.maybeAutoSeatAI({
                agentStrategy: msg.agentStrategy ?? null,
                agentDisplayName: msg.agentDisplayName ?? null,
                agentId: msg.agentId ?? null,
                userId: msg.userId ?? null,
                memoryContext: msg.memoryContext ?? '',
                agentProfile,
              });
            } else {
              table.scheduleHouseFallback();
            }
            table.maybeStartHand({ clientDriven: true });
            return;
          }

          case ClientMsg.WATCH: {
            if (!msg.tableId) throw new Error('tableId required');
            const table = getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind ?? 10, bigBlind: msg.bigBlind ?? 20, maxSeats: msg.maxSeats });
            const agentProfile = msg.agentId ? getAgentProfile(msg.agentId, msg.userId) : null;
            const spectatorSeat = table.addSpectator(ws, {
              agentStrategy: msg.agentStrategy ?? null,
              displayName: msg.displayName,
              agentId: msg.agentId ?? null,
              userId: msg.userId ?? null,
              memoryContext: msg.memoryContext ?? '',
              agentProfile,
            });
            ws.tableId = msg.tableId;
            // SERVER-3 (additive): the id of the stay this watcher has just
            // attached to, so a client can ask for that session's thread
            // (GET /api/agents/:id/thread?session=) without waiting for a
            // STATE to tell it. Null for a seat with no agent behind it.
            send(ws, {
              type: ServerMsg.WATCHING,
              tableId: msg.tableId,
              spectatorSeat,
              sessionId: table.sessionIdAtSeat?.(spectatorSeat) ?? null,
            });
            // AGE-36: hand the watcher the hand already in progress. Sent
            // after WATCHING so the client knows its spectatorSeat first.
            table.sendSnapshot(ws, spectatorSeat);
            table.maybeStartHand({ clientDriven: true });
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
            // AGE-36: DEAL is a human control. On an autonomous AI-only table
            // maybeStartHand ignores it — the server loop sets the tempo.
            table.maybeStartHand({ clientDriven: true });
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

          case ClientMsg.SIT_OUT: {
            const table = tables.get(ws.tableId);
            if (!table) throw new Error('not at a table');
            // Finishes the current hand (if any) then broadcasts TABLE_CLOSED
            // + runs the agent finish path. Owner-initiated STOP (BUG-14).
            table.sitOut(ws);
            return;
          }

          case ClientMsg.FLOOR_SUB: {
            if (!msg.userId) throw new Error('userId required');
            const userId = String(msg.userId);
            // Same credentials the REST layer takes, carried in the message
            // because a WebSocket frame has no headers. Without them the
            // subscription still works — it just never receives heroHole.
            const owner = isOwner({
              headers: {
                'x-telegram-init-data': msg.initData,
                'x-api-secret': msg.apiSecret,
              },
            }, userId);
            // HOME-STATE-1: opening the app is the other honest moment to
            // bring the living room up to date. Home games are started by
            // agent changes, so after a restart an owner whose agents were
            // already in would see no game until one of them did something.
            // Syncing HERE and not at boot is what keeps the cost bounded to
            // people who are actually looking: a fan-out over every owner in
            // the database would stand up a table for each of them.
            try {
              homeGame.sync(userId);
              homeNight.noteHousehold(userId, presentedRoster(userId, { owner: true }));
            } catch (err) {
              console.error('[home] sub sync failed:', err.message);
            }
            floor.subscribe(ws, { userId, owner });
            ws.floorUserId = userId;
            return;
          }

          case ClientMsg.FLOOR_UNSUB: {
            floor.unsubscribe(ws);
            ws.floorUserId = null;
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
      floor.unsubscribe(ws);
    });

    ws.on('error', () => {
      const table = tables.get(ws.tableId);
      if (table) table.removeConnection(ws);
      floor.unsubscribe(ws);
    });
  });

  return { wss, tables };
}
