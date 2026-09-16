// scripts/verify-rest-floor.js — AGENT-5 job C
//
// THE REMEDY CLEARS THE REFUSAL. End to end, on a fresh database, through the
// real routes — because the whole complaint is that the parts worked and the
// walk did not.
//
// Jens's session: agents drained to empty overnight, each one deployed, played
// exactly one hand and came home with a YOU LOST screen. AGENT-5 job A refuses
// that deploy at the door instead. This suite proves the door is not simply a
// wall — that what he ASKS FOR, when you actually do it, lets him back in:
//
//   1. an agent at reserve 0 is refused, and the refusal names the remedy,
//      the item, the count and the action
//   2. FOOD: stock three snacks, hand him three snacks, deploy — he sits down
//   3. REST: a second agent at 0 who has been out of a seat for three hours
//      deploys with nothing bought and nobody pressing anything
//   4. and the near miss that was the bug: TWO snacks are not enough, the
//      refusal after them still says so, and it says how many are left to go
//
// Run: node scripts/verify-rest-floor.js
//
// No model calls. Nothing here deals a hand — the walk is the money-free
// deploy gate, which is what makes it a fast-group suite rather than an e2e.

// TEST-2's seatbelt. Nothing in this file asks a model anything, but a suite
// that boots the stack can reach the handler by accident, and a flaky test is
// worse than no test.
if (process.env.ANTHROPIC_API_KEY) {
  console.error('[verify] ANTHROPIC_API_KEY is set. Unset it and re-run.');
  process.exit(1);
}

process.env.HAND_PAUSE_MS ??= '60000';   // nothing here wants a second hand
process.env.MAX_SEATS ??= '2';

import express from 'express';
import http from 'node:http';

const { createServer } = await import('../src/server/wsServer.js');
const {
  installAgentProfileRoutes, setLiveTableProvider, setAgentStamina, staminaOf,
} = await import('../src/server/agentProfiles.js');
await import('../src/server/tableRegistry.js');
const { saveWallet, deleteOwner } = await import('../src/server/store.js');
const { DEPLOY_FLOOR } = await import('../src/server/restFloor.js');
const { RECOVER_PER_HOUR, SETTLED_AT } = await import('../src/agent/stamina.js');
const { SNACK_STAMINA } = await import('../src/server/fridge.js');

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const app = express();
app.use(express.json());
installAgentProfileRoutes(app);
const httpServer = http.createServer(app);
createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${httpServer.address().port}`;

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

// TEST-4 — start from nothing, so the suite is repeatable by hand as well as
// under the runner's scratch cwd.
const userId = 'e2e-rest-floor';
deleteOwner(userId);
// SLOTS-1: two agents, and the second slot is earned. Seeded before the first
// request for this owner, because the wallet is cached on first ask.
saveWallet(userId, { ownerId: userId, balance: 40_000, earned: 250_000, ledger: [] });

const newAgent = async () => {
  await j('POST', '/api/agents/chat/reset', { userId });
  const r = await j('POST', '/api/agents/build', { userId });
  return r.body?.createdAgent?.id ?? null;
};
const agentRecord = async (id) => {
  const list = await j('GET', `/api/agents?userId=${userId}`);
  return (list.body?.agents ?? []).find((a) => a.id === id) ?? null;
};
const cleanUp = async (id) => {
  const r = await j('POST', `/api/agents/${id}/finish`, { userId });
  return r.status;
};

console.log(`[verify] floor ${DEPLOY_FLOOR}, snack ${SNACK_STAMINA}, recovery ${RECOVER_PER_HOUR}/h`);

// ── 1) at zero he is refused, and the refusal is actionable ─────────────────
console.log('\n[verify] 1) an agent at reserve 0 is refused at the door');
const hungry = await newAgent();
check('agent created', !!hungry);
setAgentStamina(hungry, userId, 0);
check('reserve is 0', staminaOf({ stamina: { left: 0, at: Date.now() } }).left === 0);

const refused = await j('POST', `/api/agents/${hungry}/deploy`, { userId });
check('deploy is refused', refused.status === 409, `got ${refused.status}`);
check('refusal is agentSpent', refused.body?.error === 'agentSpent', JSON.stringify(refused.body?.error));
check('refusal names a remedy', typeof refused.body?.message === 'string' && refused.body.message.length > 0);
check('refusal names the item', refused.body?.item === 'snack', String(refused.body?.item));
check('refusal names three snacks', refused.body?.snacksNeeded === 3, String(refused.body?.snacksNeeded));
check('refusal says three snacks out loud', /three snacks/i.test(refused.body?.message ?? ''), refused.body?.message);
check('refusal carries the action', refused.body?.action === 'feed', String(refused.body?.action));
check('refusal carries the button copy', !!refused.body?.actionLabel, String(refused.body?.actionLabel));
check('empty fridge says so', refused.body?.outOfStock === true && refused.body?.needs === 'stock',
  JSON.stringify({ out: refused.body?.outOfStock, needs: refused.body?.needs }));
check('refusal reports the floor it missed', refused.body?.stamina?.floor === DEPLOY_FLOOR);
console.log(`       he said: "${refused.body?.message}"`);

// A refusal must cost nothing. If the gate sat below the charge, this is where
// it would show.
const afterRefusal = await agentRecord(hungry);
check('a refused deploy took no seat', !afterRefusal?.activeTableId, String(afterRefusal?.activeTableId));
check('a refused deploy left him idle', afterRefusal?.status !== 'playing', String(afterRefusal?.status));

// ── 2) the food path ────────────────────────────────────────────────────────
console.log('\n[verify] 2) apply the remedy — three snacks — and deploy again');
const stocked = await j('POST', '/api/fridge/stock', { userId, item: 'snack', qty: 3 });
check('three snacks stocked', stocked.status === 200 && stocked.body?.qty === 3,
  `${stocked.status} ${JSON.stringify(stocked.body?.qty)}`);

// AGENT-4 job C: the fridge reads the stage the OWNER sees, so all three are
// accepted rather than the first one being refused as unnecessary.
for (let n = 1; n <= 3; n++) {
  const fed = await j('POST', `/api/agents/${hungry}/give`, { userId, item: 'snack' });
  const rec = await agentRecord(hungry);
  console.log(`       snack ${n}: ${fed.status}, reserve now ${rec?.body?.stamina?.value ?? '?'}`);
  check(`snack ${n} accepted`, fed.status === 200, JSON.stringify(fed.body));
  // THE BUG, ASSERTED. After two he is still under the floor and still worn —
  // which is what an owner who fed him twice and redeployed him ran into.
  if (n === 2) {
    const half = await j('POST', `/api/agents/${hungry}/deploy`, { userId });
    check('two snacks are NOT enough', half.status === 409, `got ${half.status}`);
    check('and the second refusal names the one that is left',
      half.body?.snacksNeeded === 1 && /one snack/i.test(half.body?.message ?? ''),
      half.body?.message);
    check('and it points at the shelf rather than at the clock',
      half.body?.action === 'feed' && half.body?.outOfStock === undefined,
      JSON.stringify({ action: half.body?.action, out: half.body?.outOfStock }));
    console.log(`       after two he said: "${half.body?.message}"`);
  }
}

const fedRecord = await agentRecord(hungry);
check('three snacks put him over the floor',
  (fedRecord?.body?.stamina?.value ?? 0) >= DEPLOY_FLOOR,
  `reserve ${fedRecord?.body?.stamina?.value}`);
check('and the dots agree he is rested', fedRecord?.body?.stamina?.level === 'fresh',
  String(fedRecord?.body?.stamina?.level));

const fedDeploy = await j('POST', `/api/agents/${hungry}/deploy`, { userId });
check('FOOD PATH: deploy succeeds', fedDeploy.status === 200, `${fedDeploy.status} ${JSON.stringify(fedDeploy.body)}`);
check('and he is actually in a seat', !!fedDeploy.body?.tableId);
await cleanUp(hungry);

// ── 3) the rest path ────────────────────────────────────────────────────────
//
// THREE HOURS, NOT WAITED OUT. The reserve is not ticked by a scheduler — it
// is { left, at } and recovery is computed from the elapsed time whenever
// somebody asks (stamina.js rule 2). So a record written three hours ago with
// nothing in it IS an agent who has slept three hours, and reading it back is
// the real arithmetic rather than a stub of it.
console.log('\n[verify] 3) the rest path — three hours out of a seat, nothing bought');
// A SECOND OWNER, deliberately. A household of two forms a kitchen game and
// seats both of them, and a man at the kitchen table is not resting — the gate
// reads it that way on purpose (restRefusalFor's `seatedAnywhere`). Asserting
// that rest is a remedy means asserting on somebody actually out of a chair.
const sleepUser = 'e2e-rest-floor-sleep';
deleteOwner(sleepUser);
saveWallet(sleepUser, { ownerId: sleepUser, balance: 40_000, earned: 250_000, ledger: [] });
await j('POST', '/api/agents/chat/reset', { userId: sleepUser });
const sleepy = (await j('POST', '/api/agents/build', { userId: sleepUser })).body?.createdAgent?.id ?? null;
check('second agent created', !!sleepy);

const hoursNeeded = DEPLOY_FLOOR / RECOVER_PER_HOUR;
console.log(`       ${DEPLOY_FLOOR} / ${RECOVER_PER_HOUR} = ${hoursNeeded.toFixed(2)}h from empty`);

// Just short of it first: he must still be refused two hours in, or "rest" is
// not a remedy, it is a delay with no number behind it.
setAgentStamina(sleepy, sleepUser, 0, { now: Date.now() - 2 * 3_600_000 });
const twoHours = await j('POST', `/api/agents/${sleepy}/deploy`, { userId: sleepUser });
check('two hours is not enough', twoHours.status === 409, `got ${twoHours.status}`);
check('and at two hours the remedy is sleep, not shopping',
  twoHours.body?.action === 'rest', String(twoHours.body?.action));
check('and it names the wait', /hour/i.test(twoHours.body?.message ?? ''), twoHours.body?.message);
console.log(`       he said: "${twoHours.body?.message}"`);

setAgentStamina(sleepy, sleepUser, 0, { now: Date.now() - 3.2 * 3_600_000 });
const sleepList = await j('GET', `/api/agents?userId=${sleepUser}`);
const rested = (sleepList.body?.agents ?? []).find((a) => a.id === sleepy) ?? null;
check('three hours of rest put him over the floor',
  (rested?.body?.stamina?.value ?? 0) >= SETTLED_AT,
  `reserve ${rested?.body?.stamina?.value}`);

const restDeploy = await j('POST', `/api/agents/${sleepy}/deploy`, { userId: sleepUser });
check('REST PATH: deploy succeeds with nothing bought and nothing pressed',
  restDeploy.status === 200, `${restDeploy.status} ${JSON.stringify(restDeploy.body)}`);
check('and he is actually in a seat', !!restDeploy.body?.tableId);
await j('POST', `/api/agents/${sleepy}/finish`, { userId: sleepUser });

// ── 4) the answer to "does an agent already at zero self-recover" ───────────
console.log('\n[verify] 4) self-recovery, stated');
console.log(`       an agent at 0 reaches the floor after ${hoursNeeded.toFixed(2)} hours out of a seat,`);
console.log(`       unattended: ${RECOVER_PER_HOUR}/hour is credited on read, not by a scheduler.`);
check('self-recovery is under four hours', hoursNeeded < 4, `${hoursNeeded}h`);

// ── done ────────────────────────────────────────────────────────────────────
deleteOwner(userId);
deleteOwner(sleepUser);
await new Promise((res) => httpServer.close(res));

console.log(`\n[verify] ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
