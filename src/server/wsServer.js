import { WebSocketServer } from 'ws';
import { ClientMsg, ServerMsg } from './protocol.js';
import { isOwner } from './auth.js';
import {
  getAgentProfile, setLiveTableProvider, setAgentChangeListener, setWantListener,
  reconcileActiveSessions, presentedRoster, presentAgentById, noteHomeThreadLine,
  setHomeChangeListener, setTypingListener, setBirthListener,
} from './agentProfiles.js';
import { isGuestOwner, guestFor } from './guest.js';
import * as registry from './tableRegistry.js';
import * as floor from './floorChannel.js';
import * as rooms from './rooms.js';
import * as roomTables from './roomTables.js';
import * as homeGame from './homeGame.js';
import * as visit from './visit.js';
import * as homeNight from './homeNight.js';
import * as rustNight from './rustNight.js';
import * as guestNight from './guestNight.js';
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
  floor.configure({ liveTables: registry, homeGames: homeGame, visits: visit });
  // VISIT-1: reads a live table's seats to settle a wager at the end of a
  // stay. Injected exactly like homeGame's own registry, for the same reason.
  visit.configure({ liveTables: registry });
  // ROOMS-1: the floor-by-stakes view reads the same registry, through the same
  // kind of injected provider, so neither it nor floorChannel imports table.js.
  rooms.configure({ liveTables: registry });
  // CASINO-2: the felts inside those rooms read the same registry through the
  // same kind of injected provider. It asks for listFloorTables — a home game
  // is nobody's lobby — and never opens a table up itself: every felt on the
  // wire is Table.feltView().
  roomTables.configure({ liveTables: registry });
  // HOME-STATE-1: the home game reads the registry (to stand a table up) and
  // the roster (to know who is in). Both injected, so homeGame imports neither
  // table.js nor agentProfiles.js and the graph stays acyclic.
  homeGame.configure({
    liveTables: registry,
    agentsFor: (userId) => presentedRoster(userId, { owner: true }),
    onChange: (userId) => floor.notifyHomeChanged(userId),
    // VISIT-1: whoever is visiting this household right now, HOME-shaped and
    // already tagged `guest: true` — see visit.js, which is the only place
    // that ever builds one of these.
    visitorsFor: (userId) => visit.listVisitorsFor(userId),
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
      // GUEST-1: and the guest pass beside it, on the same tick and for the
      // same reason — a household nobody has touched produces no changes of
      // its own, so the pass has to ride somebody else's. Once per day inside,
      // free when there is nothing stale, and a no-op unless GUEST_ENABLED.
      guestNight.runNightly();
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
  // VISIT-1 job 6: a guest owner's first agent is his first household — the
  // moment the referral on his guest record (visit.js's own visit_<agentId>,
  // recorded at POST /api/guest) can finally be acted on. Fired for every
  // birth; only a guest with a referral on record does anything with it, and
  // a guest is capped at one agent (GUEST_AGENT_CAP), so this can only ever
  // fire once per referral.
  setBirthListener((userId) => {
    if (!isGuestOwner(userId)) return;
    const referredBy = guestFor(userId)?.referredBy;
    if (!referredBy) return;
    try {
      const out = visit.requestReferredVisit(userId);
      if (out.status !== 200) {
        console.log(`[visit] referral for ${userId} did not knock: ${out.body?.reason ?? out.status}`);
      }
      return visit.visitOutcome(out);
    } catch (err) {
      console.error('[visit] referral knock failed:', err.message);
      return visit.visitOutcome({status:503,body:{error:'The invitation could not be confirmed. Please try again.',reason:'visitUnavailable'}});
    }
  });
  const retired = reconcileActiveSessions();
  visit.reconcileVisits();
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

  wss.on('connection', (ws, request) => {
    ws.tableId = null;
    ws.publicOnly = false;
    const authRequest = msg => ({ headers: {
      ...request.headers,
      'x-telegram-init-data': msg.initData ?? request.headers['x-telegram-init-data'],
      'x-api-secret': msg.apiSecret ?? request.headers['x-api-secret'],
    } });

    // BUG-155: kitchen membership and ownership of one agent's private
    // cards are separate checks. Reject outsiders before attaching, seating
    // an AI or creating a table; omitting agentId must not grant public entry.
    function kitchenFor(msg, { canStart = false } = {}) {
      let table = tables.get(msg.tableId);
      const reserved = typeof msg.tableId === 'string' && msg.tableId.startsWith('home-');
      if (!table?.home && !reserved) return null;
      const userId = String(msg.userId || 'anon');
      if (!isOwner(authRequest(msg), userId)) throw new Error('This kitchen is private');
      if (!table?.home || table.closed) {
        // A host's explicit Sit/rebuy may restart their actual kitchen. A
        // WATCH never creates one, and generic JOIN cannot squat on its id.
        if (msg.tableId !== homeGame.homeTableId(userId)) throw new Error('This kitchen is private');
        if (!canStart) throw new Error('Home table is not available');
        homeGame.sync(userId, { manual: true });
        table = tables.get(msg.tableId);
      }
      if (!table?.home || table.closed) throw new Error('Home table is not available');
      const hostUserId = table.homeOwnerId;
      if (!hostUserId || (hostUserId !== userId && !visit.hasActiveVisit(hostUserId, userId))) {
        throw new Error('This kitchen is private');
      }
      return table;
    }

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
            const ownerId = String(msg.userId || 'anon');
            if (!isOwner(authRequest(msg), ownerId)) throw new Error('Unauthorized owner');
            if (msg.agentId && !getAgentProfile(msg.agentId, ownerId)) throw new Error('Not your agent owner');
            const protectedServer = process.env.TELEGRAM_BOT_TOKEN || process.env.DEV_API_SECRET;
            const table = kitchenFor(msg, { canStart: true })
              ?? getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind, bigBlind: msg.bigBlind, maxSeats: msg.maxSeats });
            const seat = table.seatPlayer(ws, {
              // BUG-50: public player ids cannot be replayed to steal a seat.
              playerId: protectedServer ? `${ownerId}:${msg.playerId}` : msg.playerId,
              buyIn: msg.buyIn,
              displayName: msg.displayName,
            });
            ws.tableId = msg.tableId;
            ws.publicOnly = false;
            send(ws, { type: ServerMsg.JOINED, tableId: msg.tableId, seat,
              waitingForNextHand: table.waitingForNextHand(seat) });
            // BUG-141: a late join observes the current hand immediately,
            // without being shown anybody else's private cards or actions.
            table.sendPlayerSnapshot(ws, seat, { snapshot: true });
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
            const kitchen = kitchenFor(msg);
            const agentProfile = msg.agentId ? getAgentProfile(msg.agentId, msg.userId) : null;
            // The shared development secret is a trusted test/operator
            // identity, like REST. Telegram deployments require a real agent.
            const localDev = !process.env.TELEGRAM_BOT_TOKEN;
            const owner = isOwner(authRequest(msg), String(msg.userId || 'anon'))
              && (localDev || (!!msg.agentId && !!agentProfile));
            if (owner && !localDev && !tables.get(msg.tableId)?.agentIds?.includes(msg.agentId)
              && presentAgentById(msg.agentId, msg.userId, { owner: true })?.activeTableId !== msg.tableId) {
              throw new Error('Deploy your agent before watching a new table');
            }
            // BUG-50: public watching observes an existing table. Only a
            // proven owner may use the legacy path that seats an agent.
            const table = kitchen ?? (owner
              ? getOrCreateTable(msg.tableId, { smallBlind: msg.smallBlind ?? 10, bigBlind: msg.bigBlind ?? 20, maxSeats: msg.maxSeats })
              : tables.get(msg.tableId));
            if (!table) throw new Error('Table not found');
            const spectatorSeat = table.addSpectator(ws, {
              publicOnly: !owner,
              agentStrategy: msg.agentStrategy ?? null,
              displayName: msg.displayName,
              agentId: msg.agentId ?? null,
              userId: msg.userId ?? null,
              memoryContext: msg.memoryContext ?? '',
              agentProfile,
            });
            ws.tableId = msg.tableId;
            ws.publicOnly = !owner;
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
            if (owner) table.maybeStartHand({ clientDriven: true });
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
            if (ws.publicOnly) throw new Error('Owner control only');
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
            if (ws.publicOnly) throw new Error('Owner control only');
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
            const owner = isOwner(authRequest(msg), userId);
            // HOME-STATE-1: opening the app is the other honest moment to
            // bring the living room up to date. Home games are started by
            // agent changes, so after a restart an owner whose agents were
            // already in would see no game until one of them did something.
            // Syncing HERE and not at boot is what keeps the cost bounded to
            // people who are actually looking: a fan-out over every owner in
            // the database would stand up a table for each of them.
            //
            // BUG-211 (fix/ui-nav-2's JOB B) wanted `{ manual: true }` here,
            // so that opening Home always seats a hand — the solo House game
            // included — instead of leaving an owner with one eligible agent
            // looking at a still kitchen table. It is HELD BACK at MERGE-8,
            // and this comment is the record of why rather than a plan:
            //
            // `manual: true` makes a SOLO household's only body permanently
            // seated in a live hand, and HomeScreen's `canLift` refuses to
            // lift a man whose street is preflop..river (BUG-134). So HOME-2
            // job 5 — pick him up and put him down — becomes unreachable for
            // exactly the household the change is for. Measured, not argued:
            // with it in, `npm run test:home2` is 17/20 with the three carry
            // cases red; with it out, 20/20. Two rules Jens asked for, and
            // which of them gives is a design call, not an integration one.
            //
            // The wanted rule is kept as a todo test rather than deleted —
            // homeMembership.test.js's BUG-211 case, and BUGS.md's BUG-211.
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
