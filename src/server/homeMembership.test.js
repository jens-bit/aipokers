// BUG-155: private kitchens require household membership in addition to
// per-agent card privacy. Real authenticated HTTP + WS, keyless scratch data.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import WebSocket from 'ws';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = '123456:bug155-synthetic-test-token';
process.env.NOTIFY_ENABLED = '0';
process.env.HOME_GAME_TICK_MS = '600000';
process.env.HOME_PAUSE_MS = '600000';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_CHAT_MAX = '100000';
const store = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const registry = await import('./tableRegistry.js');
const home = await import('./homeGame.js');
const visit = await import('./visit.js');
const { Table } = await import('./table.js');
const { Actions, Streets } = await import('../engine/game.js');
const originalAiTurn = Table.prototype._maybeRunAiTurn;
Table.prototype._maybeRunAiTurn = async () => {}; // controlled fixture turns, real engine/wire
const { createServer } = await import('./wsServer.js');
const HOST = '9201', VISITOR = '9202', THIRD = '9203';
const hostAgent = 'member-host', guestAgent = 'member-visitor', thirdAgent = 'member-third';
const app = express(); app.use(express.json());
// Keep the real owning-agent middleware before visit routes, as in src/index.
// A host receiving a guest's token is not that guest agent's owner.
profiles.installAgentProfileRoutes(app);
visit.installVisitRoutes(app);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const { wss } = createServer({ server });
const sockets = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function credential(uid) {
  const fields = { id: uid, first_name: 'Test', auth_date: String(Math.floor(Date.now() / 1000)) };
  const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(text).digest('hex') }).toString();
}
const identity = uid => uid ? { userId: uid, initData: credential(uid) } : {};
const agent = id => ({ id, name: id, status: 'idle', activeTableId: null, strategy: 'Private fixture strategy ' + id,
  style: 'Balanced', risk: 'Medium', bankroll: 3000,
  pocket: { balance: 3000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
  stats: { handsPlayed: 0, handsWon: 0 }, profile: { tightness: 50, aggression: 50, bluffFreq: 20, discipline: 60 } });
async function post(route, body, uid = HOST) {
  const r = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-init-data': credential(uid) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function waitFor(predicate) {
  for (let i = 0; i < 120; i++) { const value = predicate(); if (value) return value; await sleep(10); }
  assert.fail('Expected socket event was not received');
}
async function connect(message) {
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  const socket = { ws, messages: [] }; sockets.push(socket);
  ws.on('message', raw => socket.messages.push(JSON.parse(raw)));
  await once(ws, 'open'); ws.send(JSON.stringify(message));
  socket.reply = await waitFor(() => socket.messages.find(m => ['watching', 'joined', 'error'].includes(m.type)));
  await sleep(15); return socket;
}
const watch = (uid, agentId, extra = {}) => connect({ type: 'watch', tableId: home.homeTableId(HOST), ...identity(uid), ...(agentId ? { agentId } : {}), ...extra });
const join = (uid, extra = {}) => connect({ type: 'join', tableId: home.homeTableId(HOST), playerId: `human-${uid}`, displayName: 'You', buyIn: 200, wantAI: false, ...identity(uid), ...extra });
async function disconnectAll() { for (const s of sockets.splice(0)) s.ws.terminate(); await sleep(15); }
function reset() {
  visit.reset(); home.reset(); registry.resetRegistry('BUG-155 fixture reset');
  store.adminDb().exec('DELETE FROM visits; DELETE FROM visit_invitations;');
  profiles.setLiveTableProvider(registry);
  home.configure({ liveTables: registry, agentsFor: uid => profiles.presentedRoster(uid, { owner: true }), visitorsFor: uid => visit.listVisitorsFor(uid) });
  visit.configure({ liveTables: registry });
}
beforeEach(async () => {
  await disconnectAll(); reset();
  for (const [uid, id] of [[HOST, hostAgent], [VISITOR, guestAgent], [THIRD, thirdAgent]]) {
    profiles.presentedRoster(uid); const list = profiles.agentsOf(uid); list.length = 0; list.push(agent(id)); profiles.saveOwner(uid);
  }
});
after(async () => {
  await disconnectAll(); visit.reset(); home.reset(); registry.resetRegistry('BUG-155 done');
  for (const ws of wss.clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve));
  Table.prototype._maybeRunAiTurn = originalAiTurn; store._closeForTests();
});
async function kitchen({ accepted = true } = {}) {
  if (!accepted) { profiles.agentsOf(HOST).push(agent('member-host-second')); profiles.saveOwner(HOST); home.sync(HOST); }
  const invitation = await post(`/api/agents/${guestAgent}/visit-invite`, { userId: VISITOR, stake: 0 }, VISITOR);
  assert.equal(invitation.status, 200);
  const knock = await post(`/api/agents/${guestAgent}/visit`, { hostUserId: HOST, stake: 0, invitationToken: invitation.body.invitationToken });
  assert.equal(knock.status, 200);
  if (accepted) assert.equal((await post(`/api/home/visitors/${knock.body.visitId}/answer`, { hostUserId: HOST, accept: true })).status, 200);
  const table = registry.getTable(home.homeTableId(HOST)); assert.ok(table?.home);
  table.maybeStartHand(); assert.equal(table.game.street, Streets.PREFLOP); return table;
}
function stateOf(socket) { return socket.messages.find(m => m.type === 'state'); }
function assertDenied(socket) {
  assert.equal(socket.reply.type, 'error', JSON.stringify(socket.reply));
  assert.ok(!socket.messages.some(m => ['state', 'watching', 'joined'].includes(m.type)), 'denial must not attach or disclose a kitchen snapshot');
}
function fingerprint(table) {
  return JSON.stringify({ pending: table.pending, agentIds: table.agentIds, ai: table.aiSeats, strategy: table.agentStrategy,
    hands: table.game?.handNumber, street: table.game?.street, spectators: table.spectators.length, connections: table.connections.filter(Boolean).length });
}

// JOB B / BUG-205: real players opened the app and saw a still kitchen table
// because homeGame.sync()'s own solo-agent and cooldown gates only ever lift
// for a manual sync (a deliberate Carry/SIT) -- FLOOR_SUB, the message the
// client sends the moment Home actually opens, used to call sync() without
// it. HOST's default fixture is exactly the common failing shape: one
// eligible agent, nobody else home, no prior deliberate placement.
test('BUG-205: opening Home starts the kitchen table even with one eligible agent and no prior placement', async () => {
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  const socket = { ws, messages: [] }; sockets.push(socket);
  ws.on('message', raw => socket.messages.push(JSON.parse(raw)));
  await once(ws, 'open');
  ws.send(JSON.stringify({ type: 'floor_sub', ...identity(HOST) }));
  const home_state = await waitFor(() => socket.messages.find(m => m.type === 'home_state'));
  assert.equal(home_state.game?.state, 'running', 'the very first HOME_STATE already has a hand running');
  assert.equal(home_state.game?.tableId, home.homeTableId(HOST));
  const table = registry.getTable(home.homeTableId(HOST));
  assert.ok(table?.home, 'a real kitchen table exists, not a placeholder');
  assert.ok(table.agentIds.includes(hostAgent), 'the actual lone agent is seated');
});

test('BUG-155: unrelated JOIN cannot seat, add an AI, speak, act or close the private kitchen', async () => {
  const table = await kitchen(); const before = fingerprint(table);
  for (const wantAI of [false, true]) {
    const stranger = await join(THIRD, { wantAI, agentId: thirdAgent, agentStrategy: 'ATTACKER STRATEGY' });
    assertDenied(stranger); assert.equal(fingerprint(table), before);
    stranger.ws.send(JSON.stringify({ type: 'chat', text: 'intrusion' }));
    stranger.ws.send(JSON.stringify({ type: 'action', action: { type: Actions.FOLD } }));
    stranger.ws.send(JSON.stringify({ type: 'leave' })); await sleep(20);
    assert.equal(fingerprint(table), before); assert.equal(table.closed, false);
  }
});

test('BUG-155: anonymous, unrelated and forged-owner WATCH cannot observe a kitchen', async () => {
  const table = await kitchen(); const before = fingerprint(table);
  for (const input of [[null, null, {}], [THIRD, null, {}], [THIRD, hostAgent, { userId: HOST }]]) {
    assertDenied(await watch(...input)); assert.equal(fingerprint(table), before);
  }
  assertDenied(await join(THIRD, { userId: HOST })); assert.equal(fingerprint(table), before);
});

test('BUG-155: host and accepted visitor retain exact-agent cards, reasoning and private thread', async () => {
  const table = await kitchen();
  const h = await watch(HOST, hostAgent), v = await watch(VISITOR, guestAgent);
  const hostPublic = await watch(HOST, guestAgent); // host access is not ownership of guest
  for (const [socket, ownAgent] of [[h, hostAgent], [v, guestAgent]]) {
    const seat = table.agentIds.indexOf(ownAgent), state = stateOf(socket)?.state;
    assert.equal(socket.reply.spectatorSeat, seat); assert.ok(state);
    assert.equal(state.seats[seat].holeCards.length, 2);
    assert.ok(state.seats.filter((_, i) => i !== seat).every(p => p.holeCards.length === 0));
    assert.ok(state.sessionId); assert.ok(state.reads);
    const secret = `PRIVATE_REASON_${ownAgent}`;
    table._broadcastDecision({ seat, action: { type: 'check' }, reasoning: secret, equity: 77, potOdds: 21 });
    await waitFor(() => socket.messages.some(m => m.type === 'decision' && m.reasoning === secret));
    assert.ok(socket.messages.some(m => m.type === 'thread_line' && m.line?.text === secret));
    for (const other of [h, v, hostPublic].filter(s => s !== socket)) assert.ok(!JSON.stringify(other.messages).includes(secret));
  }
  assert.equal(hostPublic.reply.spectatorSeat, -1);
  assert.ok(stateOf(hostPublic).state.seats.every(s => s.holeCards.length === 0));
  assert.equal(stateOf(hostPublic).state.sessionId, null);
});

test('BUG-162: both kitchen owners receive their actual live Profile destination without casino accounting', async () => {
  const table = await kitchen();
  table.handsThisSession = 80;
  const before = [HOST, VISITOR].map(uid => {
    const a = profiles.agentsOf(uid)[0];
    return { stats:structuredClone(a.stats), sessionLog:structuredClone(a.sessionLog ?? []), pocket:structuredClone(a.pocket), fatigue:a.fatigue };
  });
  for (const [index, uid, id] of [[0, HOST, hostAgent], [1, VISITOR, guestAgent]]) {
    const response = await fetch(base + '/api/agents?userId=' + uid, {headers:{'x-telegram-init-data':credential(uid)}});
    assert.equal(response.status, 200);
    const p = (await response.json()).agents.find(a => a.id === id);
    const expected = registry.getLiveGame(table.tableId, {agentId:id, includeHole:true});
    assert.equal(p.liveGame?.tableId, table.tableId, 'Profile must have the seated agent’s real Watch destination');
    assert.deepEqual(p.liveGame.heroHole, expected.heroHole);
    assert.equal(p.liveGame.heroHole.length, 2);
    assert.equal(p.homeTableId, table.tableId);
    assert.equal(p.liveGame.home, true, 'preview consumers must distinguish practice chips from casino money');
    assert.equal(p.activeTableId, null, 'Home membership is not a casino deployment');
    assert.equal(p.presence, 'resting', 'legacy casino presence stays scoped to casino activity');
    assert.equal(p.sessionHands, 0, 'Home hands do not become casino fatigue inputs');
    assert.equal(p.effectiveAttrs, null);
    assert.deepEqual(profiles.agentsOf(uid)[0].stats, before[index].stats);
    assert.deepEqual(p.sessionLog, before[index].sessionLog);
    assert.deepEqual(profiles.agentsOf(uid)[0].pocket, before[index].pocket);
    assert.equal(profiles.agentsOf(uid)[0].fatigue, before[index].fatigue);
    const wire = profiles.floorSnapshot(uid, {owner:true}).find(a => a.id === id);
    assert.equal(wire.liveGame?.tableId, table.tableId);
    assert.equal(wire.homeTableId, table.tableId, 'compact pushes must identify the same Home scope');
  }
  assert.equal(profiles.presentedRoster(HOST, {owner:true})[0].location.where, 'home');
  assert.notEqual(profiles.presentedRoster(VISITOR, {owner:true})[0].location.where, 'home');
  assert.equal(registry.seatedAgentCount(), 0, 'the casino live total excludes both kitchen players');
});

test('BUG-162: kitchen Profile projections never expose another agent’s private cards', async () => {
  const table = await kitchen();
  for (const [uid, id] of [[HOST, hostAgent], [VISITOR, guestAgent]]) {
    const p = profiles.presentAgentById(id, uid, {owner:false});
    assert.equal(p.liveGame?.tableId, table.tableId);
    assert.equal(p.liveGame.heroHole, null);
    assert.ok(p.liveGame.seats.every(seat => !seat.holeCards && !seat.heroHole));
    // The established GET contract allows a public projection, not owner fields.
    const response = await fetch(base + '/api/agents?userId=' + uid, {headers:{'x-telegram-init-data':credential(THIRD)}});
    assert.equal(response.status, 200);
    const publicAgent = (await response.json()).agents.find(a => a.id === id);
    assert.equal(publicAgent.liveGame.heroHole, null, 'the public API projection excludes private cards');
    assert.equal(publicAgent.strategy, undefined);
    assert.equal(publicAgent.chatHistory, undefined);
  }
  const visitingBody = profiles.homeSnapshot(HOST, {owner:true, visitors:visit.visitBodiesFor(HOST)}).agents.find(a => a.id === guestAgent);
  assert.equal(visitingBody.guest, true);
  // BUG-168 supersedes omission of the entire picture: Home now carries a
  // public TV preview while private cards remain exclusively owner-gated.
  assert.equal(visitingBody.liveGame.tableId,table.tableId);
  assert.equal(visitingBody.liveGame.heroHole,undefined);
  assert.ok(visitingBody.liveGame.seats.every(s=>!s.holeCards&&!s.heroHole&&!s.history));
  assert.equal(visit.visitBodiesFor(HOST).find(a => a.id === guestAgent).liveGame.heroHole, null, 'owning the room is not owning its visitor');
  assert.equal(profiles.presentAgentById(hostAgent, THIRD, {owner:true}), null);
});

test('BUG-178: signed host Home keeps the visitor saved identity without owner-only fields', async () => {
  const visitor = profiles.agentsOf(VISITOR)[0];
  visitor.identity = { hood: 'indigo', glow: 'violet', secret: 'PRIVATE_IDENTITY_FIELD' };
  visitor.memory = 'PRIVATE_VISITOR_MEMORY';
  profiles.saveOwner(VISITOR);
  const table = await kitchen();
  assert.equal(registry.getLiveGame(table.tableId, { agentId: guestAgent, includeHole: true }).heroHole.length, 2);
  async function subscribe(uid) {
    const ws = new WebSocket(base.replace('http:', 'ws:'));
    const socket = { ws, messages: [] }; sockets.push(socket);
    ws.on('message', raw => socket.messages.push(JSON.parse(raw)));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'floor_sub', ...identity(uid) }));
    return waitFor(() => socket.messages.find(m => m.type === 'home_state'));
  }
  const host = await subscribe(HOST);
  assert.equal(host.userId, HOST);
  const body = host.agents.find(a => a.id === guestAgent);
  assert.ok(body, 'the accepted guest reaches the actual host wire');
  assert.equal(body.guest, true);
  assert.equal(body.routine.key, 'plays');
  assert.equal(body.strategy, undefined);
  assert.equal(body.memory, undefined);
  assert.equal(body.holeCards, undefined);
  assert.equal(body.liveGame.tableId, table.tableId, 'BUG-168 public preview remains present');
  assert.equal(body.liveGame.heroHole, undefined);
  assert.ok(body.liveGame.seats.every(seat => !seat.holeCards && !seat.heroHole));
  assert.equal(JSON.stringify(body).includes('PRIVATE_'), false);
  assert.deepEqual(body.identity, { hood: 'indigo', glow: 'violet' });
  const other = await subscribe(THIRD);
  assert.equal(other.userId, THIRD);
  assert.ok(other.agents.every(a => a.id !== guestAgent && a.id !== hostAgent));
  const own = profiles.presentAgentById(guestAgent, VISITOR, { owner: true });
  assert.notEqual(own.location.where, 'home');
  assert.deepEqual(own.identity, body.identity);
});

test('BUG-168: signed Home subscriptions keep host, visitor and public previews card-free while Profile/Floor retain exact owner cards',async()=>{
  const table=await kitchen();
  async function subscribe(claimed, signed) {
    const ws=new WebSocket(base.replace('http:','ws:')), socket={ws,messages:[]};sockets.push(socket);
    ws.on('message',raw=>socket.messages.push(JSON.parse(raw)));
    await once(ws,'open');ws.send(JSON.stringify({type:'floor_sub',userId:claimed,...(signed?{initData:credential(signed)}:{})}));
    await waitFor(()=>socket.messages.find(m=>m.type==='home_state'));return socket;
  }
  const host=await subscribe(HOST,HOST), visitor=await subscribe(VISITOR,VISITOR);
  const publicHost=await subscribe(HOST,THIRD), anonymous=await subscribe(HOST,null), third=await subscribe(THIRD,THIRD);
  for(const socket of [host,visitor,publicHost,anonymous]) {
    const packet=socket.messages.find(m=>m.type==='home_state');
    assert.ok(packet.agents.some(a=>a.liveGame?.tableId===table.tableId));
    const text=JSON.stringify(packet);
    for(const key of ['heroHole','holeCards','reasoning','strategy','history','reads']) assert.equal(text.includes('"'+key+'"'),false,key+' leaked into Home');
  }
  const hostPacket=host.messages.find(m=>m.type==='home_state');
  assert.equal(hostPacket.agents.find(a=>a.id===guestAgent).guest,true);
  assert.equal(third.messages.find(m=>m.type==='home_state').agents.some(a=>a.id===hostAgent||a.id===guestAgent),false);
  for(const [socket,id] of [[host,hostAgent],[visitor,guestAgent]]) {
    const own=socket.messages.find(m=>m.type==='floor_state').agents.find(a=>a.id===id);
    assert.equal(own.liveGame.heroHole.length,2,'existing owner Floor card contract stays intact');
  }
  for(const socket of [publicHost,anonymous]) assert.ok(socket.messages.find(m=>m.type==='floor_state').agents.every(a=>a.liveGame?.heroHole==null));
  // Move the real engine to the flop, then exercise the existing throttled
  // Home push. No private-card shortcut or new request path supplies the TV.
  while(table.game.street===Streets.PREFLOP) {
    const seat=table.game.toAct, legal=table.game.legalActions(seat);
    const action=legal.find(a=>a.type===Actions.CHECK)||legal.find(a=>a.type===Actions.CALL);
    assert.ok(action);table.game.act(seat,{type:action.type});
  }
  table._notifyStateChange();
  const updated=await waitFor(()=>visitor.messages.find(m=>m.type==='home_state'&&m.agents.find(a=>a.id===guestAgent)?.liveGame?.board?.length===3));
  assert.deepEqual(updated.agents.find(a=>a.id===guestAgent).liveGame.board,table.game.community);
  assert.equal(JSON.stringify(updated).includes('"heroHole"'),false);
});

test('BUG-162: absent, removed and closed kitchen seats cannot leave a live Profile destination', async () => {
  assert.equal(profiles.presentedRoster(HOST, {owner:true})[0].liveGame, null);
  const table = await kitchen();
  const index = table.agentIds.indexOf(hostAgent);
  table.agentIds[index] = null;
  const removed = profiles.presentedRoster(HOST, {owner:true})[0];
  assert.equal(removed.liveGame, null);
  assert.equal(removed.homeTableId, null);
  table.agentIds[index] = hostAgent;
  table.closeTable('BUG-162 ended');
  for (const uid of [HOST, VISITOR]) {
    const ended = profiles.presentedRoster(uid, {owner:true})[0];
    assert.equal(ended.liveGame, null);
    assert.equal(ended.homeTableId, null);
  }
});

test('BUG-155: host and accepted visitor can join as humans and receive their own next-hand cards', async () => {
  const table = await kitchen(), h = await join(HOST), v = await join(VISITOR);
  assert.equal(h.reply.type, 'joined'); assert.equal(v.reply.type, 'joined');
  assert.equal(h.reply.waitingForNextHand, true); assert.equal(v.reply.waitingForNextHand, true);
  for (const s of [h, v]) assert.ok(stateOf(s).state.seats.every(p => p.holeCards.length === 0));
  table.game.act(table.game.toAct, { type: Actions.FOLD }); table._handCompleted();
  if (table._nextHandTimer) { clearTimeout(table._nextHandTimer); table._nextHandTimer = null; }
  table.maybeStartHand();
  for (const s of [h, v]) {
    const dealt = await waitFor(() => s.messages.find(m => m.type === 'state' && m.state.handNumber === 2));
    assert.equal(dealt.waitingForNextHand, false); assert.equal(dealt.state.seats[dealt.yourSeat].holeCards.length, 2);
    assert.ok(dealt.state.seats.filter((_, i) => i !== dealt.yourSeat).every(p => p.holeCards.length === 0));
  }
});

test('BUG-155: a pending knock or a forged visiting stamp does not grant kitchen access', async () => {
  const table = await kitchen({ accepted: false }); const before = fingerprint(table);
  assertDenied(await watch(VISITOR)); assertDenied(await join(VISITOR));
  profiles.agentsOf(THIRD)[0].visiting = { visitId: 'forged', hostUserId: HOST, since: Date.now() };
  assertDenied(await watch(THIRD)); assertDenied(await join(THIRD)); assert.equal(fingerprint(table), before);
});

test('BUG-155: an accepted visit must still be unexpired and have its actual visiting agent', async () => {
  const table = await kitchen(); const before = fingerprint(table), realNow = Date.now;
  Date.now = () => realNow() + visit.VISIT_MAX_MS + 1;
  try { assertDenied(await watch(VISITOR, guestAgent)); assertDenied(await join(VISITOR)); }
  finally { Date.now = realNow; }
  assert.equal(fingerprint(table), before);
  profiles.agentsOf(VISITOR)[0].visiting = null;
  assertDenied(await watch(VISITOR, guestAgent)); assertDenied(await join(VISITOR));
  assert.equal(fingerprint(table), before);
});

test('BUG-155: lost visit records cannot be replaced by an old seat or client claims', async () => {
  const table = await kitchen();
  // Simulate loss of the authoritative ledger, retaining the old live seat
  // and profile stamp. Clearing only the module cache now reloads valid rows.
  store.adminDb().exec('DELETE FROM visits');
  visit.reset(); visit.configure({ liveTables: registry });
  const before = fingerprint(table);
  assertDenied(await watch(VISITOR, guestAgent, { hostUserId: HOST, accepted: true }));
  assertDenied(await join(VISITOR, { hostUserId: HOST, accepted: true })); assert.equal(fingerprint(table), before);
});

test('BUG-155: reserved missing and stray home IDs cannot be created or occupied by another owner', async () => {
  const id = home.homeTableId(HOST);
  for (const type of ['watch', 'join']) {
    const s = type === 'watch' ? await watch(THIRD) : await join(THIRD, { wantAI: true, agentId: thirdAgent });
    assertDenied(s); assert.equal(registry.getTable(id), null);
  }
  const stray = registry.getOrCreateTable(id); assert.equal(stray.home, false);
  assertDenied(await join(THIRD)); assert.equal(stray.pending.filter(Boolean).length, 0);
});

test('BUG-155: the host can reopen the real kitchen for Sit instead of creating a casino-shaped table', async () => {
  const table = await kitchen(); table.closeTable('finished');
  const host = await join(HOST); assert.equal(host.reply.type, 'joined');
  const reopened = registry.getTable(home.homeTableId(HOST)); assert.ok(reopened.home); assert.equal(reopened.homeOwnerId, HOST);
  assert.notEqual(reopened, table); assert.ok(reopened.agentIds.includes(hostAgent));
});

test('BUG-155: public casino WATCH remains available and private cards remain hidden', async () => {
  const table = registry.getOrCreateTable('public-casino-control');
  table.joinAgentSession({ agentId: hostAgent, userId: HOST, displayName: 'Host', buyIn: 200 });
  table.joinAgentSession({ agentId: thirdAgent, userId: THIRD, displayName: 'Other', buyIn: 200 });
  table.maybeStartHand();
  const publicWatch = await connect({ type: 'watch', tableId: table.tableId });
  assert.equal(publicWatch.reply.type, 'watching'); assert.equal(publicWatch.reply.spectatorSeat, -1);
  assert.ok(stateOf(publicWatch).state.seats.every(p => p.holeCards.length === 0));
  assert.equal(stateOf(publicWatch).state.sessionId, null);
});
