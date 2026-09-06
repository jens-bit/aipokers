import { WebSocketServer } from 'ws';
import { ClientMsg, ServerMsg } from './protocol.js';
import { isOwner } from './auth.js';
import {
  getAgentProfile, setLiveTableProvider, setAgentChangeListener, setWantListener,
  reconcileActiveSessions, presentedRoster, noteHomeThreadLine,
  setHomeChangeListener, setTypingListener,
} from './agentProfiles.js';
import * as registry from './tableRegistry.js';
import * as floor from './floorChannel.js';
import * as rooms from './rooms.js';
import * as homeGame from './homeGame.js';
import * as homeNight from './homeNight.js';
import * as rustNight from './rustNight.js';
import * as tapeIdle from './tapeIdle.js';
import * as thread from './thread.js';
import { ThreadKind, ThreadSource } from './thread.js';

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
      // SERVER-5 job 2: the nightly rust pass, beside the nightly exchange and
      // on the same tick, but FIRST — it changes stored attributes, and both
      // the sweep and the roster below have to be the ones that already
      // include them. Once per owner per day inside, and it walks the whole
      // building rather than this owner's roster, because the household most
      // in need of a pass is the one that never produces a change of its own.
      rustNight.runNightly();
      // COST-1: before the home game is reconciled, not after. An agent who
      // has just put a tape on himself is no longer eligible for the kitchen
      // table (homeGame.eligible excludes a man who is studying), and syncing
      // first would seat him and then take him straight back out of a hand.
      // Free by construction — the tape room contains no model call.
      tapeIdle.sweep(userId, presentedRoster(userId, { owner: true }));
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
  // WANTS-1: the same injection for the same reason — agentProfiles must not
  // import the floor, so the floor hands it a function instead.
  setWantListener((userId, agentId, want) => floor.broadcastWant(userId, agentId, want));
  // WATCH-9 + SERVER-4: every stored thread line, pushed to whoever is
  // entitled to it. thread.js knows about no socket, no registry and no floor;
  // this is the one place that knows all three, so it is the one place they are
  // joined — and it is ONE listener, because there is one write behind the two
  // deliveries and a second sink would be a second place for them to disagree
  // about what was said.
  //
  // The line goes out of TWO doors, and they are not the same door twice:
  //
  //   THREAD_LINE  to the felt — the sockets watching that seat. A line with
  //                no table behind it (THREAD-2's nightly exchange in the flat)
  //                has no felt to arrive at, so it is skipped here rather than
  //                delivered to a table it was never said at.
  //   OWNER_LINE   to the owner's floor — the channel he is subscribed to
  //                whether or not a table of his is open. This is the only door
  //                a line said at HOME can reach him through live, and the
  //                unread mark hangs off it.
  //
  // A client normally has one of these open, not both; a client that has both
  // keys on the line id, which is the row's own and identical on either door.
  thread.setLineListener((line) => {
    if (!line) return;

    // The felt.
    if (line.tableId) {
      const table = registry.getTable(line.tableId);
      if (table) table.deliverThreadLine(line);
    }

    // The floor. Two things, in this order: mark the flat's thread unread for
    // the owner — but only when it is a line he has not just typed himself,
    // because his own sentence coming back cannot be news to him — and then put
    // it on the wire. Marking first means the HOME_STATE a client fetches after
    // the push already agrees with it.
    const userId = line.ownerId;
    if (!userId) return;
    try {
      if (line.source === ThreadSource.HOME && line.kind !== ThreadKind.YOU
          && noteHomeThreadLine(userId, line.ts)) {
        // The marker only moves on the FIRST unread line, so this pushes a
        // fresh HOME_STATE at most once per unread run rather than per line.
        floor.notifyHomeChanged(userId);
      }
    } catch (err) {
      console.error('[home] unread mark failed:', err.message);
    }
    floor.broadcastOwnerLine(userId, thread.wireLine(line));
  });
  // SERVER-4: the living room's own change trigger — the unread badge being
  // cleared, and nothing else so far.
  setHomeChangeListener((userId) => floor.notifyHomeChanged(userId));
  // SERVER-4: he is answering you. Straight through; there is nothing to
  // reconcile and nothing to store.
  setTypingListener((userId, agentId, sessionId) => floor.broadcastTyping(userId, agentId, sessionId));
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
            // COST-1: this used to be one model call per AI seat, per typed
            // message, to answer a sentence. The line is now queued on each
            // agent instead, where the decision router reads it as a reason to
            // spend — so he answers in his next decision, holding both the
            // spot and what was said to him, on a call that was happening
            // anyway. See Table._hearFromTable.
            table._hearFromTable(text, effectiveSeat);
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
