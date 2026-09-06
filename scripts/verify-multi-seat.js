// scripts/verify-multi-seat.js — MST-5
// End-to-end verification of Tree 6 (multi-seat tables). Boots the real stack
// on a random port and proves the tree's promise: agents share a felt.
//
// Walk:
//   1. deploy three agents, one per owner -> all three land at ONE table
//      (MATCH-1: a shared felt is for agents of DIFFERENT owners; two of one
//      owner's are refused each other's table and open their own)
//   2. hands advance autonomously with nobody watching
//   3. deploy a fourth MID-HAND -> seated at once, dealt into the NEXT hand,
//      the hand in progress untouched
//   4. one SIT_OUT -> that hand finishes, the seat frees, the others play on
//   5. a forced multiway all-in -> side pots layered, every chip accounted for
//   6. GET /api/agents reports liveGame for every seated agent, with heroHole
//      only for a caller that proved ownership
//
// Runs with NO ANTHROPIC_API_KEY, and refuses to run with one (see the guard
// below). The agent handler returns its safe check/fold fallback, so hands
// still complete and every mechanism under test here (matchmaking, the
// reconcile, seat lifecycle, presence, scoping) is exercised end to end —
// deterministically, which is the whole point.

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

// Timings are compressed so the run finishes quickly. These must be set BEFORE
// table.js is evaluated, hence the dynamic imports below.
process.env.HAND_PAUSE_MS ??= '500';
process.env.SESSION_MAX_HANDS ??= '200';
process.env.SESSION_STALL_MS ??= '45000';
process.env.MAX_CONCURRENT_TABLES ??= '6';
// Turns isOwner into a real check, so the heroHole scoping section has
// something to prove.
process.env.DEV_API_SECRET ??= 'multi-seat-e2e-secret';

import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';

const { createServer } = await import('../src/server/wsServer.js');
const { installAgentProfileRoutes } = await import('../src/server/agentProfiles.js');
const registry = await import('../src/server/tableRegistry.js');
const { setPersistEnabled: setOpponentStatsPersist } = await import('../src/server/opponentStats.js');
const { ClientMsg, ServerMsg } = await import('../src/server/protocol.js');
const { Streets, Actions } = await import('../src/engine/game.js');
const { MIN_TO_DEAL, SEAT_LIMIT } = await import('../src/server/table.js');

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
const SECRET = process.env.DEV_API_SECRET;
console.log(`[verify] server up on ${base}`);
console.log(`[verify] SEAT_LIMIT=${SEAT_LIMIT} MIN_TO_DEAL=${MIN_TO_DEAL} HAND_PAUSE_MS=${process.env.HAND_PAUSE_MS} decisions=safe-fallback (no API key)`);

const j = async (method, path, body, { owner = true } = {}) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (owner) headers['x-api-secret'] = SECRET;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
};

// MATCH-1: one owner per agent. Two agents of the same owner are refused a
// shared felt now (a stable playing itself is not a game), so a suite about
// agents SHARING a table has to hand each of them a different backer — which
// is also what the floor actually looks like. `ownerOf` is the whole change;
// every helper below simply takes the owner it is asking about.
const userId = 'e2e-multi-seat-user';
const ownerOf = (n) => `${userId}-${n}`;
const cleanup = [];   // { id, owner }

// SLOTS-1: the second, third and fourth agent slots are EARNED — 10,000 /
// 50,000 / 250,000 in winnings (src/server/slots.js). This was written when
// the suite ran every agent off one owner, which made it the fourth agent's
// problem. MATCH-1 then gave each agent its own backer, so no owner here asks
// for a second slot and the ladder is not in the way at all today.
//
// The seeding stays, moved into newAgent so it applies to whichever owner is
// being built for: it costs one write, and the day a section does build two
// agents for one backer, this suite should fail on the seating it is about and
// not on a slot limit. It has to run before the FIRST request for that owner —
// agentProfiles caches a wallet the first time it is asked for one. The ladder
// itself is asserted in src/server/slots.test.js.
const { saveWallet } = await import('../src/server/store.js');
const unlockSlots = (owner) => saveWallet(owner, { ownerId: owner, balance: 0, earned: 250_000, ledger: [] });

const listAgents = async (owner, { auth = true } = {}) =>
  (await j('GET', `/api/agents?userId=${owner}`, null, { owner: auth })).body?.agents ?? [];
const getAgent = async (agentId, owner, opts) =>
  (await listAgents(owner, opts)).find((a) => a.id === agentId) ?? null;
const handsPlayed = async (agentId, owner) => {
  const r = await j('GET', `/api/agents/${agentId}/hands?userId=${owner}`);
  return r.body?.stats?.handsPlayed ?? 0;
};

const waitFor = async (label, read, predicate, budgetMs = 60_000, everyMs = 100) => {
  const deadline = Date.now() + budgetMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (predicate(last)) return { ok: true, value: last };
    await sleep(everyMs);
  }
  return { ok: false, value: last, label };
};

const newAgent = async (label, owner) => {
  unlockSlots(owner);   // SLOTS-1 — before the first request for this owner
  await j('POST', '/api/agents/chat/reset', { userId: owner });
  const r = await j('POST', '/api/agents/build', { userId: owner });
  const id = r.body?.createdAgent?.id ?? null;
  if (id) cleanup.push({ id, owner });
  if (!id) console.error(`  (agent build failed for ${label}: ${JSON.stringify(r.body)})`);
  return id;
};

// ── 1) three deploys, one table ──────────────────────────────────────────────
console.log('\n[verify] 1) three agents of three owners deploy and land at ONE table');
const agents = [];   // { id, owner }
const deploys = [];
for (let i = 0; i < 3; i++) {
  const owner = ownerOf(i + 1);
  const id = await newAgent(`agent ${i + 1}`, owner);
  check(`agent ${i + 1} created`, !!id);
  agents.push({ id, owner });
  const r = await j('POST', `/api/agents/${id}/deploy`, { userId: owner });
  check(`agent ${i + 1} deployed`, r.status === 200, `got ${r.status}`);
  deploys.push(r.body);
}
const agentIds = agents.map((a) => a.id);
const tableId = deploys[0]?.tableId;
check('all three agents share one tableId', deploys.every((d) => d?.tableId === tableId),
  deploys.map((d) => d?.tableId).join(', '));
check('the first deploy created the table', deploys[0]?.joinedExisting !== true);
check('the second joined it',               deploys[1]?.joinedExisting === true);
check('the third joined it too',            deploys[2]?.joinedExisting === true);
// The floor, not the registry: a household that is briefly all home stands up
// its own kitchen table, and that table is deliberately not on the floor.
check('exactly one table is on the floor',  registry.listFloorTables().length === 1,
  registry.listFloorTables().map((t) => t.tableId).join(', '));

const table = registry.getTable(tableId);
check('the table seats more than two',      table?.maxSeats > 2, `maxSeats=${table?.maxSeats}`);
check('four seats are taken (3 agents + House)', table?.seatedCount() === 4, `${table?.seatedCount()}`);
check('every seat index is distinct',
  new Set(deploys.map((d) => d.seat)).size === 3, deploys.map((d) => d.seat).join(','));
console.log(`       table ${tableId}: ${table.pending.filter(Boolean).map((p) => p.displayName).join(', ')}`);

// ── 2) hands advance with nobody watching ────────────────────────────────────
console.log('\n[verify] 2) hands advance autonomously, four-handed');
{
  const got = await waitFor('2 hands', async () => table.handsThisSession, (n) => n >= 2, 90_000, 200);
  check('the table completed 2+ hands with no client connected', got.ok, `saw ${got.value}`);
  check('all four seats were dealt in', table.game?.seats.length === 4, `${table.game?.seats.length}`);
  check('no WebSocket clients are attached',
    table.spectators.length === 0 && table.connections.every((c) => c === null));
  for (let i = 0; i < agents.length; i++) {
    check(`agent ${i + 1} is playing`, (await getAgent(agents[i].id, agents[i].owner))?.presence === 'playing');
  }
}

// ── 3) a fourth agent deploys MID-HAND ───────────────────────────────────────
console.log('\n[verify] 3) a fourth agent deploys mid-hand and joins the NEXT hand');
const lateOwner = ownerOf(4);
const lateId = await newAgent('late agent', lateOwner);
{
  const live = await waitFor('hand in progress', async () => table.game,
    (g) => !!g && g.street !== Streets.WAITING && g.street !== Streets.COMPLETE, 60_000, 40);
  check('caught a hand in progress', live.ok, `street=${table.game?.street}`);
  const handAtJoin = table.game.handNumber;
  const seatsAtJoin = table.game.seats.length;

  const r = await j('POST', `/api/agents/${lateId}/deploy`, { userId: lateOwner });
  check('the late deploy joined the running table', r.body?.joinedExisting === true && r.body?.tableId === tableId,
    JSON.stringify({ joined: r.body?.joinedExisting, table: r.body?.tableId }));
  check('the seat was taken immediately', table.seatedCount() === 5, `${table.seatedCount()}`);
  check('the hand in progress was NOT restarted', table.game.handNumber === handAtJoin);
  check('the late agent is not in the live hand', table.game.seats.length === seatsAtJoin,
    `${table.game.seats.length} vs ${seatsAtJoin}`);
  const midHand = await getAgent(lateId, lateOwner);
  check('presence already reports playing', midHand?.presence === 'playing', `${midHand?.presence}`);
  check('liveGame flags it as not yet dealt in', midHand?.liveGame?.dealtIn === false,
    JSON.stringify(midHand?.liveGame?.dealtIn));

  const dealtIn = await waitFor('next hand', async () => table.game,
    (g) => !!g && g.seats.length === seatsAtJoin + 1, 90_000, 100);
  check('dealt into the next hand', dealtIn.ok, `game seats=${table.game?.seats.length}`);
  const seated = await waitFor('hole cards', async () => await getAgent(lateId, lateOwner),
    (a) => Array.isArray(a?.liveGame?.heroHole) && a.liveGame.heroHole.length === 2, 30_000, 100);
  check('and holds two hole cards of its own', seated.ok, JSON.stringify(seated.value?.liveGame?.heroHole));
  check('five-handed now', table.game.seats.length === 5, `${table.game?.seats.length}`);
}

// ── 4) one SIT_OUT, everyone else plays on ───────────────────────────────────
console.log('\n[verify] 4) one agent sits out — the seat frees, the table plays on');
{
  const quitter = agents[1].id;
  const quitterOwner = agents[1].owner;
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const seen = [];
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (d) => { try { seen.push(JSON.parse(d.toString())); } catch { /* ignore */ } });
  ws.send(JSON.stringify({ type: ClientMsg.WATCH, tableId, agentId: quitter, userId: quitterOwner }));
  const watching = await waitFor('watching', async () => seen.find((m) => m.type === ServerMsg.WATCHING),
    (m) => !!m, 10_000, 40);
  check('a watcher attached to the quitting agent', watching.ok);

  const handsBefore = table.handsThisSession;
  const seatsBefore = table.seatedCount();
  ws.send(JSON.stringify({ type: ClientMsg.SIT_OUT }));

  const closed = await waitFor('table_closed for the quitter',
    async () => seen.find((m) => m.type === ServerMsg.TABLE_CLOSED), (m) => !!m, 60_000, 50);
  check('the quitter\'s own socket is told the session ended', closed.ok);
  check('reason mentions sitting out', /sat out/i.test(closed.value?.reason ?? ''), closed.value?.reason);
  check('the hand in progress was allowed to finish', table.handsThisSession > handsBefore,
    `${handsBefore} -> ${table.handsThisSession}`);

  check('the table is still live', registry.hasTable(tableId) && table.closed === false);
  check('exactly one seat was freed', table.seatedCount() === seatsBefore - 1,
    `${seatsBefore} -> ${table.seatedCount()}`);
  check('the quitter is off the felt', !table.agentIds.includes(quitter));

  const rested = await waitFor('quitter resting', async () => await getAgent(quitter, quitterOwner),
    (a) => a?.presence === 'resting', 20_000, 100);
  check('the quitter is resting',          rested.ok, `${rested.value?.presence}`);
  check('its table reference was cleared', !rested.value?.activeTableId);
  check('it carries a session recap',      !!rested.value?.sessionRecap?.text);
  console.log(`       recap: "${rested.value?.sessionRecap?.text}"`);

  const others = [agents[0], agents[2], { id: lateId, owner: lateOwner }];
  for (const { id, owner } of others) {
    check(`the others keep playing (${id.slice(-6)})`, (await getAgent(id, owner))?.presence === 'playing');
  }
  const kept = await waitFor('more hands', async () => table.handsThisSession,
    (n) => n > table.handsThisSession - 1 && n >= handsBefore + 2, 90_000, 200);
  check('the table dealt further hands after the departure', kept.ok, `hands=${table.handsThisSession}`);
  ws.close();
}

// ── 5) forced multiway all-in: side pots and chip conservation ───────────────
console.log('\n[verify] 5) a forced multiway all-in — side pots, every chip accounted for');
{
  // Three seats with deliberately unequal stacks, driven by hand so the
  // all-in shape is exact. Real Table, real Game, real registry.
  const spTableId = 'table-sidepot-e2e';
  const sp = registry.getOrCreateTable(spTableId, { maxSeats: 6 });
  const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });
  const buyIns = [1000, 200, 400];
  const sockets = buyIns.map((buyIn, i) => {
    const ws = fakeWs();
    sp.seatPlayer(ws, { playerId: `sp${i}`, buyIn, displayName: `Short${i}` });
    return ws;
  });
  const startingChips = buyIns.reduce((a, b) => a + b, 0);

  sp.maybeStartHand({ clientDriven: true });
  check('the side-pot table dealt three-handed', sp.game?.seats.length === 3, `${sp.game?.seats.length}`);
  // 3-handed: dealer 0, SB 1, BB 2, and the button acts first preflop.
  check('the button acts first three-handed', sp.game.toAct === 0, `${sp.game.toAct}`);
  sp.applyAction(sockets[0], { type: Actions.RAISE, amount: 1000 });  // all-in, covers everyone
  sp.applyAction(sockets[1], { type: Actions.CALL });                 // all-in for 200
  sp.applyAction(sockets[2], { type: Actions.CALL });                 // all-in for 400

  // The hand result is read from the broadcast, not from sp.game: a hand that
  // busts two of three seats closes the table on the spot, and the assertions
  // below must hold either way.
  const result = sockets[0].received.find((m) => m.type === ServerMsg.HAND_RESULT)?.result ?? null;
  check('the hand ran out to showdown', !!result && result.type === 'showdown',
    JSON.stringify(result?.type));

  const banked = [0, 1, 2].map((i) => sp.seatStack(i));
  const chipsAfter = banked.reduce((a, b) => a + b, 0);
  check('chip conservation across the multiway all-in', chipsAfter === startingChips,
    `${chipsAfter} vs ${startingChips}`);

  // 600 uncalled comes back to the big stack; 1000 is contested in two layers:
  // 200*3 = 600 for everyone, then 200*2 = 400 between the two deeper stacks.
  const paid = (result?.winners ?? []).reduce((sum, w) => sum + w.amount, 0);
  check('side pots sum to the contested pot', paid === 1000, `${paid}`);
  const shortWin = (result?.winners ?? []).find((w) => w.playerId === 'sp1');
  check('the 200-chip stack cannot win past the main pot', !shortWin || shortWin.amount <= 600,
    `${shortWin?.amount}`);
  console.log(`       stacks after: ${banked.join(' / ')} — payouts: ${(result?.winners ?? []).map((w) => `${w.playerId}+${w.amount}`).join(' ')}`);

  const survivors = banked.filter((n) => n > 0).length;
  if (survivors >= MIN_TO_DEAL) {
    sp.maybeStartHand({ clientDriven: true });
    check('busted seats were released', sp.seatedCount() === survivors,
      `${sp.seatedCount()} seated, ${survivors} with chips`);
    check('the table plays on', !sp.closed && sp.game?.seats.length === survivors);
  } else {
    check('a table that can no longer be dealt closes itself', sp.closed === true);
  }
  if (registry.hasTable(spTableId)) sp.closeTable('side-pot check finished', { recap: 'test over' });
}

// ── 6) liveGame for every seated agent, heroHole scoped to the owner ─────────
console.log('\n[verify] 6) GET /api/agents — liveGame for all seated agents, heroHole owner-only');
{
  // MATCH-1: every seat belongs to a different backer, so the roster is read
  // per owner. The seats themselves say who to ask, which is also the honest
  // way round — the table is the witness, not the test's bookkeeping.
  const seated = table.agentIds
    .map((id, seat) => (id ? { id, owner: table.agentUserIds[seat] } : null))
    .filter(Boolean);
  check('three agents are still seated', seated.length === 3, `${seated.length}`);

  const readSeated = async ({ auth }) => {
    const out = [];
    for (const { id, owner } of seated) {
      const a = await getAgent(id, owner, { auth });
      if (a) out.push(a);
    }
    return out;
  };

  const owned = await waitFor('hole cards for every seated agent',
    async () => await readSeated({ auth: true }),
    (list) => list.length === seated.length && list.every((a) =>
      a?.presence === 'playing'
        && a?.liveGame?.tableId === tableId
        && Array.isArray(a.liveGame.heroHole) && a.liveGame.heroHole.length === 2),
    60_000, 100);
  check('every seated agent reports liveGame at this table with its own hole cards', owned.ok);
  for (const a of owned.value ?? []) {
    console.log(`       ${a?.name} seat ${a?.liveGame?.heroSeat} hole ${JSON.stringify(a?.liveGame?.heroHole)} of ${a?.liveGame?.seatCount} seats`);
  }
  const holes = (owned.value ?? []).map((a) => JSON.stringify(a?.liveGame?.heroHole));
  check('each agent sees a DIFFERENT hand — its own', new Set(holes).size === holes.length, holes.join(' '));

  const strangerSeated = await readSeated({ auth: false });
  check('an unauthenticated caller still sees presence and the table',
    strangerSeated.length === 3 && strangerSeated.every((a) => a.liveGame?.tableId === tableId));
  check('but never a hole card', strangerSeated.every((a) => a.liveGame?.heroHole === null),
    JSON.stringify(strangerSeated.map((a) => a.liveGame?.heroHole)));
  check('and the board is still public',
    strangerSeated.every((a) => Array.isArray(a.liveGame?.board)));
}

// ── cleanup ──────────────────────────────────────────────────────────────────
console.log('\n[verify] cleanup');
registry.resetRegistry('e2e run finished');
for (const { id, owner } of cleanup) {
  await j('DELETE', `/api/agents/${id}?userId=${owner}`);
}
wss.close();
await new Promise((res) => httpServer.close(res));
await sleep(100);

console.log('\n[verify] summary');
if (failures === 0) {
  console.log('all multi-seat E2E checks passed');
  process.exitCode = 0;
} else {
  console.error(`${failures} multi-seat E2E checks failed`);
  process.exitCode = 1;
}
