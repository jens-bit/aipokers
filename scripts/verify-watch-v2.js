// scripts/verify-watch-v2.js — WATCH-23 / WV2-6
//
// End-to-end verification of the watch tree's server-side promises.
//
// Walk:
//   1. WV2-1 — two owned agents deployed with NO spectator: they share a
//      table and hands advance unattended.
//   2. WV2-1 — the shape that actually hung: two owned agents assembled at one
//      felt by WATCH alone (agent vs agent, no House). Nothing owned the tempo,
//      the table sat at WAITING forever, and the floor still reported it as
//      playing because liveGameView only asks isAiOnly().
//   3. WV2-5 — the showdown payload a spectator receives: revealed cards on
//      result.showdown and on the terminal STATE, folded seats absent from
//      both, winners named. This is what the felt renders the reveal from.
//   4. WV2-5 — a pot won without a showdown reveals nothing at all.
//
// Runs with NO ANTHROPIC_API_KEY, and refuses to run with one (see the guard
// below). The agent handler returns its safe check/fold fallback, so hands
// still complete and everything under test here is exercised end to end,
// deterministically.

// TEST-2 — deterministic or it isn't a test. With a key present the agents
// make real model decisions, every run deals a different hand, and this suite
// failed intermittently on whichever machine had the key exported. The test
// runner strips ANTHROPIC_API_KEY from the child environment; this is the
// seatbelt for a hand-run. Live-model behaviour belongs in `npm run test:live`.
if (process.env.ANTHROPIC_API_KEY) {
  console.error('[verify] ANTHROPIC_API_KEY is set. This suite asserts on the deterministic');
  console.error('[verify] check/fold fallback and is not reproducible against a live model.');
  console.error('[verify] Unset it and re-run, or use `npm run test:e2e`, which strips it.');
  process.exit(1);
}

process.env.HAND_PAUSE_MS ??= '300';
process.env.SESSION_MAX_HANDS ??= '200';
process.env.SESSION_STALL_MS ??= '45000';
process.env.MAX_CONCURRENT_TABLES ??= '8';
process.env.DEV_API_SECRET ??= 'watch-v2-e2e-secret';

import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';

const { createServer } = await import('../src/server/wsServer.js');
const { installAgentProfileRoutes } = await import('../src/server/agentProfiles.js');
const registry = await import('../src/server/tableRegistry.js');
const { setPersistEnabled: setOpponentStatsPersist } = await import('../src/server/opponentStats.js');
const { ClientMsg, ServerMsg } = await import('../src/server/protocol.js');
const { Streets, Actions } = await import('../src/engine/game.js');
const { Table } = await import('../src/server/table.js');

setOpponentStatsPersist(false);

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── boot ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
installAgentProfileRoutes(app);
const httpServer = http.createServer(app);
createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const port = httpServer.address().port;
const base = `http://127.0.0.1:${port}`;
const SECRET = process.env.DEV_API_SECRET;
console.log(`[verify] server up on ${base}`);
console.log(`[verify] decisions=safe-fallback (no API key)`);

const j = async (method, path, body) => {
  const headers = { 'x-api-secret': SECRET };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
};

const userId = 'e2e-watch-v2-user';

const newAgent = async (label) => {
  await j('POST', '/api/agents/chat/reset', { userId });
  const r = await j('POST', '/api/agents/build', { userId });
  const id = r.body?.createdAgent?.id ?? null;
  if (!id) console.error(`  (agent build failed for ${label}: ${JSON.stringify(r.body)})`);
  return id;
};

const getAgent = async (agentId) => {
  const r = await j('GET', `/api/agents?userId=${userId}`);
  return (r.body?.agents ?? []).find((a) => a.id === agentId) ?? null;
};

const waitFor = async (label, read, predicate, budgetMs = 45_000, everyMs = 150) => {
  const deadline = Date.now() + budgetMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (predicate(last)) return { ok: true, value: last };
    await sleep(everyMs);
  }
  return { ok: false, value: last, label };
};

const describeTable = (t) => t
  ? `autoPlay=${t.autoPlay} isAiOnly=${t.isAiOnly()} seated=${t.seatedCount()} hands=${t.handsThisSession} street=${t.game ? t.game.street : 'no game'}`
  : 'no table';

// ── 1) WV2-1: two deploys, nobody watching ───────────────────────────────────
console.log('\n[verify] 1) WV2-1 — two owned agents deploy, no spectator, hands advance');
{
  const a = await newAgent('agent A');
  const b = await newAgent('agent B');
  check('two agents created', !!a && !!b);

  const ra = await j('POST', `/api/agents/${a}/deploy`, { userId });
  const rb = await j('POST', `/api/agents/${b}/deploy`, { userId });
  check('both deploys accepted', ra.status === 200 && rb.status === 200, `${ra.status}/${rb.status}`);
  check('both agents land at ONE table', ra.body.tableId === rb.body.tableId,
        `${ra.body.tableId} vs ${rb.body.tableId}`);

  const table = registry.getTable(ra.body.tableId);
  check('the table is server-driven', !!table && table.autoPlay === true, describeTable(table));
  check('no spectator is attached', (table?.spectators?.length ?? -1) === 0);

  const advanced = await waitFor(
    'hands advance unattended',
    async () => table.handsThisSession,
    (n) => n >= 2,
  );
  check('hands advance with nobody watching', advanced.ok, `stuck at ${advanced.value} hand(s) — ${describeTable(table)}`);
  check('both agents report playing', (await getAgent(a))?.status === 'playing' && (await getAgent(b))?.status === 'playing');
}

// ── 2) WV2-1: the hang — two agents assembled by WATCH, no House ─────────────
console.log('\n[verify] 2) WV2-1 — two owned agents assembled by WATCH alone (no House)');
{
  const a = await newAgent('watcher A');
  const b = await newAgent('watcher B');
  const A = await getAgent(a);
  const B = await getAgent(b);
  check('two more agents created', !!A && !!B);

  const tableId = 'watch-v2-pvp';
  const watch = (agent) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('error', reject);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: ClientMsg.WATCH,
        tableId,
        agentId: agent.id,
        userId,
        displayName: agent.name,
        agentStrategy: agent.strategy ?? '',
      }));
      resolve(ws);
    });
  });

  const wsA = await watch(A);
  await sleep(250);
  const wsB = await watch(B);
  await sleep(250);

  const table = registry.getTable(tableId);
  check('the WATCH-assembled table exists', !!table);
  check('it seats exactly the two agents, no House', table?.seatedCount() === 2, describeTable(table));
  check('it is AI-only', table?.isAiOnly() === true);
  check('the House fallback was cancelled by the second agent', table?._houseFallbackTimer == null);
  check('the server adopted the undriven table', table?.autoPlay === true, describeTable(table));

  const advanced = await waitFor(
    'WATCH-assembled table deals',
    async () => table.handsThisSession,
    (n) => n >= 2,
  );
  check('agent vs agent deals instead of sitting at SHUFFLING', advanced.ok,
        `stuck at ${advanced.value} hand(s) — ${describeTable(table)}`);

  // The ghost this bug produced: presence said "playing" while street never
  // left WAITING. Assert the two now agree.
  const live = registry.getLiveGame(tableId, { agentId: a });
  check('liveGameView reports a real street, not WAITING', !!live && live.street !== Streets.WAITING,
        `street=${live?.street ?? 'null'}`);
  check('liveGameView reports both seats', (live?.seatCount ?? 0) === 2, `seatCount=${live?.seatCount}`);

  wsA.close();
  wsB.close();
  await sleep(200);
  check('the table keeps playing after every watcher leaves', table.closed === false && table.autoPlay === true);
}

// ── 3) WV2-5: the showdown payload a spectator receives ──────────────────────
// Driven through the real Table with plain seats, so every action is explicit
// and the walk is deterministic -- no model calls, no timers.
console.log('\n[verify] 3) WV2-5 — revealed cards reach the spectator');
{
  const fakeWs = () => ({
    readyState: 1, OPEN: 1, received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    ofType(type) { return this.received.filter((m) => m.type === type); },
  });

  const table = new Table({ tableId: 'watch-v2-showdown', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  for (const id of ['p0', 'p1', 'p2']) {
    table.seatPlayer(fakeWs(), { playerId: id, buyIn: 1000, displayName: id.toUpperCase() });
  }
  // A spectator watching seat 0, exactly as WATCH attaches one.
  const spectator = fakeWs();
  table.spectators.push({ ws: spectator, spectatorSeat: 0 });

  table.maybeStartHand({ clientDriven: true });

  // Seat 2 folds; the other two check/call to a real showdown.
  let guard = 400;
  let folded = false;
  while (table.game && table.game.street !== Streets.COMPLETE && guard-- > 0) {
    const seat = table.game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = table.game.legalActions(seat);
    let pick;
    if (!folded && seat === 2 && legal.some((a) => a.type === Actions.FOLD)) {
      pick = { type: Actions.FOLD };
      folded = true;
    } else {
      pick = legal.find((a) => a.type === Actions.CHECK)
          ?? legal.find((a) => a.type === Actions.CALL)
          ?? { type: Actions.FOLD };
    }
    table.applyAction(table.connections[seat], { type: pick.type });
  }

  check('the hand reached a showdown', table.game?.result?.type === 'showdown',
        `result was ${table.game?.result?.type ?? 'none'}`);

  // -- the hand-result payload --
  const results = spectator.ofType(ServerMsg.HAND_RESULT);
  check('the spectator received HAND_RESULT', results.length === 1, `got ${results.length}`);
  const result = results[0]?.result ?? null;

  check('it carries a showdown array', Array.isArray(result?.showdown));
  check('every contestant is in it, and only them',
        (result?.showdown ?? []).map((sd) => sd.seat).sort().join(',') === '0,1',
        JSON.stringify((result?.showdown ?? []).map((sd) => sd.seat)));
  check('the seat that folded is NOT in it',
        !(result?.showdown ?? []).some((sd) => sd.seat === 2));
  check('each entry carries two hole cards',
        (result?.showdown ?? []).every((sd) => Array.isArray(sd.holeCards) && sd.holeCards.length === 2),
        JSON.stringify(result?.showdown));
  check('winners carry seat, amount and a hand description',
        Array.isArray(result?.winners) && result.winners.length > 0
          && result.winners.every((w) => Number.isInteger(w.seat) && w.amount > 0 && typeof w.descr === 'string'),
        JSON.stringify(result?.winners));
  check('the pot is reported', Number.isFinite(result?.pot) && result.pot > 0, String(result?.pot));

  // -- the terminal STATE, which is what the felt actually renders from --
  const states = spectator.ofType(ServerMsg.STATE);
  const terminal = states[states.length - 1]?.state ?? null;
  check('the spectator saw a terminal STATE', !!terminal);
  check('it is at COMPLETE', terminal?.street === Streets.COMPLETE, terminal?.street);
  check('it carries the result alongside', terminal?.result?.type === 'showdown');
  check('revealed seats show their cards in it',
        (terminal?.seats ?? []).filter((s, i) => i !== 2).every((s) => s.holeCards.length === 2),
        JSON.stringify((terminal?.seats ?? []).map((s) => s.holeCards)));
  check('the mucked seat shows nothing', (terminal?.seats ?? [])[2]?.holeCards.length === 0);
  check('the felt can name the winner from it',
        !!(terminal?.seats ?? [])[result?.winners?.[0]?.seat]?.displayName);

  table.closeTable('verify done');
}

// ── 4) WV2-5: an uncontested pot reveals nothing ─────────────────────────────
console.log('\n[verify] 4) WV2-5 — a hand won without a showdown reveals nothing');
{
  const fakeWs = () => ({
    readyState: 1, OPEN: 1, received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    ofType(type) { return this.received.filter((m) => m.type === type); },
  });

  const table = new Table({ tableId: 'watch-v2-uncontested', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  for (const id of ['q0', 'q1']) {
    table.seatPlayer(fakeWs(), { playerId: id, buyIn: 1000, displayName: id.toUpperCase() });
  }
  const spectator = fakeWs();
  table.spectators.push({ ws: spectator, spectatorSeat: 0 });
  table.maybeStartHand({ clientDriven: true });
  table.applyAction(table.connections[table.game.toAct], { type: Actions.FOLD });

  const result = spectator.ofType(ServerMsg.HAND_RESULT)[0]?.result ?? null;
  check('the result is uncontested', result?.type === 'uncontested', result?.type);
  check('no showdown array, so nothing is revealed', result?.showdown === undefined);
  const terminal = spectator.ofType(ServerMsg.STATE).slice(-1)[0]?.state ?? null;
  check("and no seat but the spectator\'s own shows cards",
        (terminal?.seats ?? []).slice(1).every((s) => s.holeCards.length === 0),
        JSON.stringify((terminal?.seats ?? []).map((s) => s.holeCards)));

  table.closeTable('verify done');
}

// ── done ─────────────────────────────────────────────────────────────────────
registry.resetRegistry('verify-watch-v2 finished');
httpServer.close();

console.log(`\n[verify] ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
