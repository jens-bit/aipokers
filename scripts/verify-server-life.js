// scripts/verify-server-life.js — AGE-39
// End-to-end verification of Tree 4 (server-side life). Boots the real stack
// on a random port and proves the product promise: the agent lives whether or
// not anyone is looking at it.
//
// Walk:
//   1. create an agent
//   2. deploy vs House with NO WebSocket connection open at any point
//   3. poll the REST API until 3+ hands have completed server-side
//   4. connect a WebSocket MID-HAND — assert a full snapshot arrives and that
//      arriving did not restart the hand
//   5. FLOOR_SUB — assert FLOOR_STATE and throttled FLOOR_GAME deltas
//   6. disconnect — assert hands keep completing
//   7. SIT_OUT — assert graceful close, presence flips to resting,
//      activeTableId cleared
//   8. concurrency cap refuses deploys past MAX_CONCURRENT_TABLES
//   9. boot reconciliation retires agents whose table no longer exists
//
// No ANTHROPIC_API_KEY required. Without one the agent handler returns its
// safe check/fold fallback, so hands still complete and every mechanism under
// test here (the loop, snapshots, the floor channel, presence, close paths)
// is exercised end to end. With a key set, the same script runs against real
// model decisions — hands just take longer.

// Timings are compressed so the run finishes in under a minute. These must be
// set BEFORE table.js is evaluated, hence the dynamic imports below.
process.env.HAND_PAUSE_MS ??= '600';
process.env.SESSION_MAX_HANDS ??= '100';
process.env.MAX_CONCURRENT_TABLES ??= '2';

import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';

const { createServer } = await import('../src/server/wsServer.js');
const {
  installAgentProfileRoutes,
  setLiveTableProvider,
  reconcileActiveSessions,
} = await import('../src/server/agentProfiles.js');
const registry = await import('../src/server/tableRegistry.js');
const { setPersistEnabled: setOpponentStatsPersist } = await import('../src/server/opponentStats.js');
const { ClientMsg, ServerMsg } = await import('../src/server/protocol.js');

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
const { wss } = createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const port = httpServer.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`[verify] server up on ${base}`);
console.log(`[verify] HAND_PAUSE_MS=${process.env.HAND_PAUSE_MS} MAX_CONCURRENT_TABLES=${process.env.MAX_CONCURRENT_TABLES} ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? 'set' : 'absent (safe-fallback decisions)'}`);

const j = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
};

const userId = 'e2e-server-life-user';
const cleanupAgentIds = [];

const getAgent = async (agentId) => {
  const list = await j('GET', `/api/agents?userId=${userId}`);
  return (list.body?.agents ?? []).find((a) => a.id === agentId) ?? null;
};
const handsPlayed = async (agentId) => {
  const r = await j('GET', `/api/agents/${agentId}/hands?userId=${userId}`);
  return r.body?.stats?.handsPlayed ?? 0;
};
// Poll until `predicate(value)` holds or the budget runs out.
const waitFor = async (label, read, predicate, budgetMs = 60_000, everyMs = 250) => {
  const deadline = Date.now() + budgetMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (predicate(last)) return { ok: true, value: last };
    await sleep(everyMs);
  }
  return { ok: false, value: last, label };
};

const newAgent = async () => {
  await j('POST', '/api/agents/chat/reset', { userId });
  const r = await j('POST', '/api/agents/build', { userId });
  const id = r.body?.createdAgent?.id ?? null;
  if (id) cleanupAgentIds.push(id);
  return id;
};

// ── 1) create + deploy with no client anywhere ───────────────────────────────
console.log('\n[verify] 1) create an agent and deploy it — no WebSocket opened');
const agentId = await newAgent();
check('agent created', !!agentId);

const deploy = await j('POST', `/api/agents/${agentId}/deploy`, { userId });
check('deploy returns 200', deploy.status === 200, `got ${deploy.status}`);
check('deploy started a server-side session', deploy.body?.sessionStarted === true);
const tableId = deploy.body?.tableId;
check('deploy returns a tableId', !!tableId);

// ── 2) hands complete with nobody watching ───────────────────────────────────
console.log('\n[verify] 2) hands advance server-side with zero connections');
{
  const started = Date.now();
  const got = await waitFor('3 hands', () => handsPlayed(agentId), (n) => n >= 3, 90_000);
  check('3+ hands completed with no client connected', got.ok, `saw ${got.value} hand(s)`);
  console.log(`       ${got.value} hand(s) in ${((Date.now() - started) / 1000).toFixed(1)}s, WebSocket clients: 0`);

  const a = await getAgent(agentId);
  check('presence is playing while the loop runs', a?.presence === 'playing', `got ${a?.presence}`);
  check('liveGame is present while playing',       !!a?.liveGame);
  check('liveGame names the table',                a?.liveGame?.tableId === tableId);
  check('liveGame reports hands this session',     (a?.liveGame?.handsThisSession ?? 0) >= 3);
}

// ── 3) a watcher arriving mid-hand gets a snapshot, and changes nothing ──────
console.log('\n[verify] 3) WebSocket connects MID-HAND — snapshot, no restart');
let ws;
{
  // Wait for a hand actually in progress rather than the pause between hands.
  const mid = await waitFor(
    'mid-hand',
    async () => (await getAgent(agentId))?.liveGame ?? null,
    (lg) => !!lg && lg.street !== 'complete' && lg.street !== 'waiting',
    30_000, 60,
  );
  check('caught the table mid-hand', mid.ok, `street was ${mid.value?.street}`);
  const handBefore = mid.value?.handNumber ?? 0;

  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  const seen = [];
  ws.on('message', (data) => seen.push(JSON.parse(data.toString())));

  ws.send(JSON.stringify({
    type: ClientMsg.WATCH, tableId, agentId, userId, displayName: 'e2e-watcher',
  }));

  const snapWait = await waitFor(
    'snapshot',
    async () => seen.find((m) => m.type === ServerMsg.STATE) ?? null,
    (m) => !!m,
    5000, 25,
  );
  const snap = snapWait.value;
  check('a STATE snapshot arrives on WATCH',   !!snap);
  check('snapshot is flagged as a snapshot',   snap?.snapshot === true);
  check('snapshot carries the hand in progress', Number.isInteger(snap?.state?.handNumber) && snap.state.handNumber >= handBefore,
    `snapshot hand ${snap?.state?.handNumber}, expected >= ${handBefore}`);
  check('snapshot shows the agent\'s hole cards', (snap?.state?.seats?.[snap?.yourSeat]?.holeCards ?? []).length === 2);
  check('WATCHING ack received',               seen.some((m) => m.type === ServerMsg.WATCHING));

  // Watching must not have seated anyone new: heads-up means exactly 2 seats.
  check('no extra seat was created by watching', (snap?.state?.seats ?? []).length === 2,
    `${snap?.state?.seats?.length} seats`);
}

// ── 4) the floor channel ─────────────────────────────────────────────────────
console.log('\n[verify] 4) FLOOR_SUB → FLOOR_STATE + throttled FLOOR_GAME deltas');
{
  const floorWs = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((res, rej) => { floorWs.once('open', res); floorWs.once('error', rej); });
  const floorMsgs = [];
  floorWs.on('message', (data) => floorMsgs.push({ at: Date.now(), msg: JSON.parse(data.toString()) }));

  floorWs.send(JSON.stringify({ type: ClientMsg.FLOOR_SUB, userId }));

  const stateWait = await waitFor(
    'floor_state',
    async () => floorMsgs.find((m) => m.msg.type === ServerMsg.FLOOR_STATE)?.msg ?? null,
    (m) => !!m, 5000, 25,
  );
  const floorState = stateWait.value;
  check('FLOOR_STATE arrives immediately on subscribe', !!floorState);
  const floorAgent = (floorState?.agents ?? []).find((a) => a.id === agentId);
  check('FLOOR_STATE lists the agent',                  !!floorAgent);
  check('FLOOR_STATE presence is playing',              floorAgent?.presence === 'playing');
  check('FLOOR_STATE carries mood',                     !!floorAgent?.mood?.state);
  check('FLOOR_STATE carries lastMoment',               !!floorAgent?.lastMoment?.text);

  const deltaWait = await waitFor(
    'floor_game deltas',
    async () => floorMsgs.filter((m) => m.msg.type === ServerMsg.FLOOR_GAME),
    (arr) => arr.length >= 3,
    30_000, 100,
  );
  const deltas = deltaWait.value ?? [];
  check('FLOOR_GAME deltas stream in', deltas.length >= 3, `saw ${deltas.length}`);
  check('deltas carry board/pot/street', deltas.every((d) => Array.isArray(d.msg.board) && Number.isFinite(d.msg.pot) && !!d.msg.street));
  check('deltas carry heroHole for the owner', deltas.some((d) => (d.msg.heroHole ?? []).length === 2));

  const gaps = deltas.slice(1).map((d, i) => d.at - deltas[i].at);
  const minGap = gaps.length ? Math.min(...gaps) : Infinity;
  // One push per second per table, with a little slack for timer jitter.
  check('deltas throttled to <= 1/s per table', minGap >= 950, `min gap ${minGap}ms`);
  console.log(`       ${deltas.length} deltas, min gap ${minGap === Infinity ? 'n/a' : minGap + 'ms'}`);

  floorWs.send(JSON.stringify({ type: ClientMsg.FLOOR_UNSUB }));
  await sleep(100);
  const countAfterUnsub = floorMsgs.length;
  await sleep(1500);
  check('FLOOR_UNSUB stops the pushes', floorMsgs.length === countAfterUnsub,
    `${floorMsgs.length - countAfterUnsub} pushes after unsub`);
  floorWs.close();
}

// ── 5) disconnect — the agent plays on ───────────────────────────────────────
console.log('\n[verify] 5) watcher disconnects — hands keep completing (FLR-5)');
{
  const before = await handsPlayed(agentId);
  ws.close();
  await sleep(200);
  check('table survives the watcher leaving', registry.hasTable(tableId));

  const got = await waitFor('2 more hands', () => handsPlayed(agentId), (n) => n >= before + 2, 60_000);
  check('hands continue after disconnect', got.ok, `${before} → ${got.value}`);
  console.log(`       ${before} → ${got.value} hands with no client attached`);

  const a = await getAgent(agentId);
  check('presence still playing after disconnect', a?.presence === 'playing');
  check('agent was not recalled by the disconnect', a?.activeTableId === tableId);
}

// ── 6) SIT_OUT closes gracefully ─────────────────────────────────────────────
console.log('\n[verify] 6) SIT_OUT — graceful close, presence flips, table cleared');
{
  const stopWs = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((res, rej) => { stopWs.once('open', res); stopWs.once('error', rej); });
  const seen = [];
  stopWs.on('message', (data) => seen.push(JSON.parse(data.toString())));
  stopWs.send(JSON.stringify({ type: ClientMsg.WATCH, tableId, agentId, userId, displayName: 'e2e-stop' }));
  await sleep(200);

  const handsAtStop = await handsPlayed(agentId);
  stopWs.send(JSON.stringify({ type: ClientMsg.SIT_OUT }));

  const closedWait = await waitFor(
    'table_closed',
    async () => seen.find((m) => m.type === ServerMsg.TABLE_CLOSED) ?? null,
    (m) => !!m, 30_000, 50,
  );
  const closed = closedWait.value;
  check('TABLE_CLOSED received after SIT_OUT', !!closed);
  check('reason mentions sitting out',         /sat out/i.test(closed?.reason ?? ''));
  check('the in-flight hand was allowed to finish', (await handsPlayed(agentId)) >= handsAtStop);

  await sleep(200);
  const a = await getAgent(agentId);
  check('presence flipped to resting',   a?.presence === 'resting', `got ${a?.presence}`);
  check('activeTableId cleared',         a?.activeTableId === null || a?.activeTableId === undefined);
  check('liveGame gone once resting',    !a?.liveGame);
  check('unseenRecap set',               a?.unseenRecap === true);
  check('sessionRecap written',          !!a?.sessionRecap?.text, JSON.stringify(a?.sessionRecap));
  check('table removed from the registry', !registry.hasTable(tableId));
  console.log(`       recap: "${a?.sessionRecap?.text}"`);
  stopWs.close();
}

// ── 7) concurrency cap ───────────────────────────────────────────────────────
console.log(`\n[verify] 7) MAX_CONCURRENT_TABLES=${registry.MAX_CONCURRENT_TABLES} refuses the overflow deploy`);
const capAgentIds = [];
{
  for (let i = 0; i < registry.MAX_CONCURRENT_TABLES; i++) {
    const id = await newAgent();
    capAgentIds.push(id);
    const r = await j('POST', `/api/agents/${id}/deploy`, { userId });
    check(`deploy ${i + 1}/${registry.MAX_CONCURRENT_TABLES} accepted`, r.status === 200, `got ${r.status}`);
  }
  const overflowId = await newAgent();
  capAgentIds.push(overflowId);
  const refused = await j('POST', `/api/agents/${overflowId}/deploy`, { userId });
  check('deploy past the cap is refused', refused.status === 503, `got ${refused.status}`);
  check('refusal names the cap', /floor is full/i.test(refused.body?.error ?? ''), refused.body?.error);
  const a = await getAgent(overflowId);
  check('refused agent stays resting', a?.presence === 'resting');
}

// ── 8) boot reconciliation ───────────────────────────────────────────────────
console.log('\n[verify] 8) boot reconciliation retires agents whose table is gone');
{
  const playingBefore = (await j('GET', `/api/agents?userId=${userId}`)).body.agents.filter((a) => a.activeTableId);
  check('agents are holding live tables before the simulated restart', playingBefore.length > 0);

  // A restart loses every in-memory table. Point the REST layer at an empty
  // registry and reconcile, exactly as createServer does at boot.
  setLiveTableProvider({
    getTable: () => null,
    hasTable: () => false,
    getLiveGame: () => null,
    getOrCreateTable: () => { throw new Error('registry offline'); },
    countAutonomousTables: () => 0,
    listTables: () => [],
    MAX_CONCURRENT_TABLES: registry.MAX_CONCURRENT_TABLES,
  });
  const retired = reconcileActiveSessions();
  check('reconciliation retired the orphans', retired >= playingBefore.length, `retired ${retired}`);

  const after = (await j('GET', `/api/agents?userId=${userId}`)).body.agents;
  check('no agent still points at a dead table', after.every((a) => !a.activeTableId));
  check('no ghost is left showing as playing',   after.every((a) => a.presence === 'resting'));
  const sample = after.find((a) => a.sessionRecap?.text?.includes('table closed'));
  check('retired agents carry the away recap',   !!sample, JSON.stringify(after[0]?.sessionRecap));

  setLiveTableProvider(registry);
}

// ── cleanup ──────────────────────────────────────────────────────────────────
console.log('\n[verify] cleanup');
registry.resetRegistry('e2e run finished');
for (const id of [...cleanupAgentIds]) {
  await j('DELETE', `/api/agents/${id}?userId=${userId}`);
}
wss.close();
await new Promise((res) => httpServer.close(res));
await sleep(100);

console.log('\n[verify] summary');
if (failures === 0) {
  console.log('all server-life E2E checks passed');
  process.exitCode = 0;
} else {
  console.error(`${failures} server-life E2E checks failed`);
  process.exitCode = 1;
}
