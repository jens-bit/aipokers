// src/server/visit.test.js — VISIT-1
//
// Two households, a knock at the door, and the money law underneath it: a
// wager escrows through wallet.js's own ledger and comes home through it too
// — never invented, never lost, only ever moved.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let server;
let base;
let registry;
let profiles;
let homeGame;
let visitMod;

const HOST = 'host-owner';
const GUEST = 'guest-owner';

function agent(id, over = {}) {
  return {
    id,
    name: id.toUpperCase(),
    status: 'idle',
    activeTableId: null,
    strategy: 'You are a poker player.',
    style: 'Balanced',
    risk: 'Medium',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 200, handsWon: 80 },
    profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    ...over,
  };
}

// BUG-149: existing gameplay assertions now arrive through owner consent.
const visitReq = async (agentId, hostUserId, stake) => {
  const invitation=visitMod.issueVisitInvitation({agentId,userId:GUEST,stake:stake??0});
  if(invitation.status!==200)return invitation;
  return fetch(`${base}/api/agents/${agentId}/visit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hostUserId, stake, invitationToken:invitation.body.invitationToken }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
};
const directVisit = options => {
  const invitation=visitMod.issueVisitInvitation({agentId:options.agentId,userId:GUEST,stake:options.stake??0});
  assert.equal(invitation.status,200);
  return visitMod.requestVisit({...options,invitationToken:invitation.body.invitationToken});
};

const answerReq = (visitId, hostUserId, accept) => fetch(`${base}/api/home/visitors/${visitId}/answer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hostUserId, accept }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-visit-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  delete process.env.GUEST_ENABLED;

  store.saveProfile(HOST, { userId: HOST, chat: [], agents: [agent('resident')] });
  store.saveProfile(GUEST, { userId: GUEST, chat: [], agents: [agent('traveler'), agent('busy'), agent('retired', { archived: true })] });

  const { default: express } = await import('express');
  profiles = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  homeGame = await import('./homeGame.js');
  visitMod = await import('./visit.js');
  profiles.setLiveTableProvider(registry);

  homeGame.configure({
    liveTables: registry,
    agentsFor: (userId) => profiles.presentedRoster(userId, { owner: true }),
    visitorsFor: (userId) => visitMod.listVisitorsFor(userId),
  });
  visitMod.configure({ liveTables: registry });

  const app = express();
  app.use(express.json());
  profiles.installAgentProfileRoutes(app);
  visitMod.installVisitRoutes(app);
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  try { registry?.resetRegistry('test over'); } catch { /* best effort */ }
  homeGame?.reset();
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// Fresh records every test, written into the SAME cached array agentProfiles
// already holds — home.test.js's own note applies here too: a profile written
// through store.saveProfile AFTER agentProfiles has cached it is invisible to
// the module under test, so a reset has to mutate the live array in place.
function resetAgents(userId, list) {
  const arr = profiles.agentsOf(userId);
  arr.length = 0;
  arr.push(...list);
  profiles.saveOwner(userId);
}

beforeEach(() => {
  visitMod.reset();
  store.adminDb().exec('DELETE FROM visits; DELETE FROM visit_invitations;');
  homeGame.reset();
  homeGame.configure({
    liveTables: registry,
    agentsFor: (userId) => profiles.presentedRoster(userId, { owner: true }),
    visitorsFor: (userId) => visitMod.listVisitorsFor(userId),
  });
  visitMod.configure({ liveTables: registry });
  registry.resetRegistry('between tests');
  resetAgents(HOST, [agent('resident')]);
  resetAgents(GUEST, [agent('traveler'), agent('busy'), agent('retired', { archived: true })]);
});

const read = (userId, id) => store.loadAgentStore()[userId].agents.find((a) => a.id === id);

// ── Requesting a visit ───────────────────────────────────────────────────────

test('VISIT-1: a visit walks him out his own door', async () => {
  const res = await visitReq('traveler', HOST, 0);
  assert.equal(res.status, 200);
  assert.equal(res.body.agentId, 'traveler');
  assert.ok(res.body.visitId);
  assert.ok(res.body.respondBy > Date.now());
  assert.ok(read(GUEST, 'traveler').visiting, 'his own record now says he is out');
});

test('VISIT-1: he cannot visit his own house', async () => {
  const res = await visitReq('traveler', GUEST, 0);
  assert.equal(res.status, 400);
  assert.equal(res.body.reason, 'self');
});

test('VISIT-1: a retired agent cannot be sent anywhere', async () => {
  const res = await visitReq('retired', HOST, 0);
  assert.equal(res.status, 410);
});

test('VISIT-1: he cannot visit twice at once', async () => {
  const first = await visitReq('traveler', HOST, 0);
  assert.equal(first.status, 200);
  const second = await visitReq('traveler', 'some-other-host', 0);
  assert.equal(second.status, 409);
  assert.equal(second.body.reason, 'alreadyVisiting');
});

test('VISIT-1: a second friend cannot knock while one is already at the door', async () => {
  const first = await visitReq('traveler', HOST, 0);
  assert.equal(first.status, 200);
  const second = await visitReq('busy', HOST, 0);
  assert.equal(second.status, 409);
  assert.equal(second.body.reason, 'hostBusy');
});

test('VISIT-1: 404 for an agent nobody has', async () => {
  const res = await visitReq('nobody', HOST, 0);
  assert.equal(res.status, 404);
});

// ── job 6: the public preview ───────────────────────────────────────────────

test('VISIT-1: the preview names him, with no auth at all', async () => {
  const res = await fetch(`${base}/api/agents/traveler/visit-preview`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { agentId: 'traveler', agentName: 'TRAVELER' });
});

test('VISIT-1: the preview is 404 for an agent nobody has, or a retired one', async () => {
  const gone = await fetch(`${base}/api/agents/nobody/visit-preview`);
  assert.equal(gone.status, 404);
  const retired = await fetch(`${base}/api/agents/retired/visit-preview`);
  assert.equal(retired.status, 404);
});

// ── Answering ────────────────────────────────────────────────────────────────

test('VISIT-1: declined, he walks home with a line', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  const res = await answerReq(knock.visitId, HOST, false);
  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, false);
  assert.ok(res.body.line);
  assert.equal(read(GUEST, 'traveler').visiting, null, 'home again — nothing left owing on the record');
});

test('VISIT-1: only the host can answer his own door', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  const res = await answerReq(knock.visitId, 'not-the-host', true);
  assert.equal(res.status, 404);
});

test('VISIT-1: accepted, he joins the kitchen table under his own owner', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  const res = await answerReq(knock.visitId, HOST, true);
  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.game.state, 'running');
  assert.deepEqual(res.body.game.seats.map((s) => s.agentId).sort(), ['resident', 'traveler']);

  const table = registry.getTable(homeGame.homeTableId(HOST));
  const guestSeat = table.agentIds.indexOf('traveler');
  assert.equal(table.agentUserIds[guestSeat], GUEST, 'his seat is booked under HIS OWN owner');
});

test('VISIT-1: answering the same knock twice is refused, not repeated', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  await answerReq(knock.visitId, HOST, true);
  const again = await answerReq(knock.visitId, HOST, true);
  assert.equal(again.status, 409);
});

// ── HOME_STATE bodies ────────────────────────────────────────────────────────

test('VISIT-1: a pending visitor stands in the room before any answer exists', () => {
  directVisit({ agentId: 'traveler', hostUserId: HOST, stake: 0 });
  const bodies = visitMod.visitBodiesFor(HOST);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].id, 'traveler');
  assert.equal(bodies[0].guest, true);
  assert.equal(bodies[0].location.where, 'home');
  // Not yet in homeGame's own feed — he has not been let in.
  assert.equal(visitMod.listVisitorsFor(HOST).length, 0);
});

test('VISIT-1: the pending visitor pill names who is waiting', () => {
  const { body: knock } = directVisit({ agentId: 'traveler', hostUserId: HOST, stake: 0 });
  const pending = visitMod.pendingVisitorFor(HOST);
  assert.equal(pending.id, knock.visitId);
  assert.equal(pending.agentId, 'traveler');
});

// ── His own household is not double-booked ──────────────────────────────────

test("VISIT-1: while he is out, his OWN owner's kitchen table does not seat him", async () => {
  resetAgents(GUEST, [agent('traveler'), agent('second')]);
  const { body: knock } = await visitReq('traveler', HOST, 0);
  assert.ok(knock.visitId);

  // HOME-3 leaves a lone man in the room until deliberately placed. His own
  // game still must not include the man who just walked out the door.
  assert.equal(homeGame.sync(GUEST),null);
  const own = homeGame.sync(GUEST,{manual:true});
  assert.ok(own, 'the remaining agent can deliberately play the House');
  assert.equal(own.seats.some((s) => s.agentId === 'traveler'), false);
});

// ── The clock ────────────────────────────────────────────────────────────────

test('VISIT-1: an unanswered knock times out and he walks home', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  visitMod._sweepNow(Date.now() + 31 * 60_000);
  assert.equal(visitMod.pendingVisitorFor(HOST), null);
  assert.equal(read(GUEST, 'traveler').visiting, null);
});

test('VISIT-1: the stay ends on its own clock, and he is swept off the table', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  await answerReq(knock.visitId, HOST, true);
  assert.equal(visitMod.listVisitorsFor(HOST).length, 1);

  visitMod._sweepNow(Date.now() + 3 * 60 * 60_000);   // past VISIT_MAX_MS
  assert.equal(visitMod.listVisitorsFor(HOST).length, 0);
  assert.equal(read(GUEST, 'traveler').visiting, null);
});

// ── The wager ────────────────────────────────────────────────────────────────

test('VISIT-1: a wager is capped at ten per cent of the smaller pocket', async () => {
  resetAgents(GUEST, [agent('traveler', { pocket: { balance: 1_000, mode: 'allowance', cap: null, realised: 0, ledger: [] } })]);
  resetAgents(HOST, [agent('resident', { pocket: { balance: 10_000, mode: 'allowance', cap: null, realised: 0, ledger: [] } })]);

  const { body: knock } = await visitReq('traveler', HOST, 5_000);   // asks for way more than the cap
  await answerReq(knock.visitId, HOST, true);

  // 10% of the smaller pocket (1,000) is 100 — taken from BOTH sides.
  assert.equal(read(GUEST, 'traveler').pocket.balance, 900);
  assert.equal(read(HOST, 'resident').pocket.balance, 9_900);
});

test('VISIT-1: a wash refunds both pockets when the stay ends with nobody ahead', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 200);
  await answerReq(knock.visitId, HOST, true);
  const guestAfterEscrow = read(GUEST, 'traveler').pocket.balance;
  const hostAfterEscrow = read(HOST, 'resident').pocket.balance;
  assert.ok(guestAfterEscrow < 3_000, 'the stake left his pocket at accept');
  assert.ok(hostAfterEscrow < 3_000, 'and his');

  // Ended before a single hand moved a stack — a push, by construction.
  visitMod._sweepNow(Date.now() + 3 * 60 * 60_000);
  assert.equal(read(GUEST, 'traveler').pocket.balance, 3_000, 'his stake came home');
  assert.equal(read(HOST, 'resident').pocket.balance, 3_000, 'and his');
});

test('VISIT-1: no stake, no escrow — an ordinary friendly game', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  await answerReq(knock.visitId, HOST, true);
  assert.equal(read(GUEST, 'traveler').pocket.balance, 3_000);
  assert.equal(read(HOST, 'resident').pocket.balance, 3_000);
});

// ── Reads, grudges and roles cross households (job 3) ───────────────────────
//
// Nothing new is built here. table.js's own _recordBiographyHand and
// _threadTo already key off `this.agentUserIds[seat]` regardless of `home`
// (HOME-STATE-1's own law: "the BIOGRAPHY is written... two agents sharing a
// flat is worth simulating at all") — the one thing that was ever wrong was
// WHOSE owner that seat was booked under, which job 1's fix to homeGame.js's
// open() corrects. These tests exercise the exact seam table.js calls through,
// with the real seats an accepted visit produces, to prove the fix reaches it.

test('VISIT-1 / BIO-2: a hand at the kitchen table writes a grudge row for EACH side, under his own owner', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  await answerReq(knock.visitId, HOST, true);

  const table = registry.getTable(homeGame.homeTableId(HOST));
  const guestSeat = table.agentIds.indexOf('traveler');
  const hostSeat = table.agentIds.indexOf('resident');
  const guestPlayerId = table.pending[guestSeat].playerId;
  const hostPlayerId = table.pending[hostSeat].playerId;

  // The exact call table.js's _recordBiographyHand makes after a completed
  // hand — same shape, same per-seat owner lookup.
  profiles.recordOpponentHand('resident', table.agentUserIds[hostSeat], {
    opponents: [{ playerId: guestPlayerId, displayName: 'Away Day' }], net: 200, pot: 400, won: true, handNumber: 1,
  });
  profiles.recordOpponentHand('traveler', table.agentUserIds[guestSeat], {
    opponents: [{ playerId: hostPlayerId, displayName: 'Resident' }], net: -200, pot: 400, won: false, handNumber: 1,
  });

  const hostLedger = profiles.getAgentBioLedger('resident', HOST);
  const guestLedger = profiles.getAgentBioLedger('traveler', GUEST);
  assert.ok(hostLedger[guestPlayerId], "the host's own resident remembers who visited");
  assert.equal(hostLedger[guestPlayerId].hands, 1);
  assert.ok(guestLedger[hostPlayerId], 'and the visitor remembers his host, in HIS OWN ledger');
  assert.equal(guestLedger[hostPlayerId].net, -200);
});

test('VISIT-1: both seats get their own thread session, so both threads can carry a line', async () => {
  const { body: knock } = await visitReq('traveler', HOST, 0);
  await answerReq(knock.visitId, HOST, true);

  const table = registry.getTable(homeGame.homeTableId(HOST));
  const guestSeat = table.agentIds.indexOf('traveler');
  const hostSeat = table.agentIds.indexOf('resident');
  const guestSessionId = table.seatSessionIds[guestSeat];
  const hostSessionId = table.seatSessionIds[hostSeat];
  assert.ok(guestSessionId, 'the visitor has a session of his own, exactly like a resident');
  assert.notEqual(guestSessionId, hostSessionId);

  const { appendLine, readThread, ThreadKind } = await import('./thread.js');
  appendLine({
    sessionId: guestSessionId, agentId: 'traveler', ownerId: table.agentUserIds[guestSeat],
    tableId: table.tableId, kind: ThreadKind.TABLE, who: 'Away Day', text: 'Nice spot.',
  });
  appendLine({
    sessionId: hostSessionId, agentId: 'resident', ownerId: table.agentUserIds[hostSeat],
    tableId: table.tableId, kind: ThreadKind.TABLE, who: 'Resident', text: 'Cheers.',
  });

  const guestThread = readThread(guestSessionId, { owner: true });
  const hostThread = readThread(hostSessionId, { owner: true });
  assert.ok(guestThread.some((l) => l.text === 'Nice spot.'), "the visitor's own thread carries his line");
  assert.ok(hostThread.some((l) => l.text === 'Cheers.'), "the host's thread carries his, separately");
});

test('BUG-175: a seated visitor has the host playing routine without changing identity or privacy', async () => {
  resetAgents(GUEST, [agent('traveler', {
    nature: { name: 'Rock' }, identity: { hood: 'indigo', glow: 'violet' },
    memory: 'Private strategy memory', sessionRecap: { text: 'Private recap' },
  })]);
  const { body: knock } = await visitReq('traveler', HOST, 0);
  const pending = visitMod.visitBodiesFor(HOST).find(a => a.id === 'traveler');
  assert.notEqual(pending.routine?.key, 'plays', 'a pending knock is not a seat');
  assert.equal(pending.homeTableId, null);
  const answered = await answerReq(knock.visitId, HOST, true);
  assert.equal(answered.status, 200);
  const table = registry.getTable(homeGame.homeTableId(HOST));
  table.maybeStartHand();
  const own = profiles.presentAgentById('traveler', GUEST, { owner: true });
  assert.equal(own.liveGame.heroHole.length, 2, 'privacy is measured with real dealt cards');
  assert.notEqual(own.location.where, 'home', 'he remains away from his own household');
  assert.equal(own.routine, null);
  const body = visitMod.listVisitorsFor(HOST).find(a => a.id === 'traveler');
  assert.equal(body.location.where, 'home');
  assert.deepEqual(body.identity, own.identity);
  assert.equal(body.fatigue, own.fatigue);
  assert.equal(body.guest, true);
  assert.equal(body.homeTableId, table.tableId);
  assert.equal(body.liveGame.heroHole, null, 'host never receives the visiting owner\'s cards');
  assert.equal(body.memory, undefined);
  assert.equal(body.strategy, undefined);
  assert.equal(body.sessionRecap, null);
  assert.deepEqual(body.routine, { key: 'plays', label: 'in the home game' });
  const wire = profiles.homeSnapshot(HOST, { owner: true, game: homeGame.state(HOST), visitors: [body] });
  assert.equal(wire.agents.find(a => a.id === 'traveler').routine.key, 'plays');
});

test('BUG-175: an accepted visitor who leaves the actual chair is no longer playing', async () => {
  resetAgents(HOST, [agent('resident'), agent('housemate')]);
  resetAgents(GUEST, [agent('traveler', { nature: { name: 'Rock' } })]);
  const { body: knock } = await visitReq('traveler', HOST, 0);
  assert.equal((await answerReq(knock.visitId, HOST, true)).status, 200);
  const table = registry.getTable(homeGame.homeTableId(HOST));
  while (table.handInProgress()) table.game.act(table.game.toAct, { type: 'fold' });
  if (table.game?.result) table._handCompleted();
  const seat = table.agentIds.indexOf('traveler');
  assert.ok(seat >= 0);
  assert.equal(table.sitOutSeat(seat).pending, false);
  assert.equal(table.closed, false, 'the two host residents can keep their game');
  assert.equal(table.agentIds.includes('traveler'), false);
  const body = visitMod.listVisitorsFor(HOST).find(a => a.id === 'traveler');
  assert.ok(body, 'the pending visit sweep has not yet removed the visiting body');
  assert.notEqual(body.routine?.key, 'plays', 'an accepted record cannot invent current seating');
  assert.equal(body.homeTableId, null);
});

 test('BUG-131: the visitor owner receives the actual host-table preview with scoped cards',async()=>{
 const {body:knock}=await visitReq('traveler',HOST,0);
 assert.equal(profiles.presentedRoster(GUEST,{owner:true}).find(a=>a.id==='traveler').liveGame,null,'a pending knock is not a live game');
 await answerReq(knock.visitId,HOST,true);
 const table=registry.getTable(homeGame.homeTableId(HOST));
 table.maybeStartHand();
 const expected=registry.getLiveGame(table.tableId,{agentId:'traveler',includeHole:true});
 assert.equal(expected.heroHole?.length,2,'the privacy check uses a dealt hand');
 const own=profiles.presentedRoster(GUEST,{owner:true}).find(a=>a.id==='traveler');
 assert.equal(own.liveGame?.tableId,table.tableId);assert.equal(own.liveGame.net,expected.net);assert.equal(own.liveGame.blinds,expected.blinds);assert.deepEqual(own.liveGame.heroHole,expected.heroHole);
 assert.notEqual(own.location.where,'home');assert.equal(own.activeTableId,null,'viewing the visit must not become a casino deployment');
 const other=profiles.presentAgentById('traveler',GUEST,{owner:false});assert.equal(other.liveGame.heroHole,null);
 table.closeTable('visit preview test');
 assert.equal(profiles.presentedRoster(GUEST,{owner:true}).find(a=>a.id==='traveler').liveGame,null,'closed table must not remain live');
 });
