// scripts/verify-personality-layer.js — AGE-34
// End-to-end verification of the personality layer wiring. Boots the real
// server on a random port, then walks through: deploy an agent, simulate
// mood-shifting hand results, pep-talk soothes, sit-out closes the table,
// GET /api/agents shows mood + lastMoment + unseenRecap + proposal +
// presence. No LLM calls required.

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

import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';

import { createServer } from '../src/server/wsServer.js';
import {
  installAgentProfileRoutes,
  recordHandResult,
  setAgentMood,
  updateComputedMemory,
} from '../src/server/agentProfiles.js';
// finishAgentSession is exercised through POST /api/agents/:id/finish below,
// not called directly, but it's the module member the endpoint delegates to.
import { setPersistEnabled as setOpponentStatsPersist } from '../src/server/opponentStats.js';
import { ClientMsg, ServerMsg } from '../src/server/protocol.js';

// Suppress noisy stats persistence to disk during the run.
setOpponentStatsPersist(false);

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

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

// Small fetch helper — auth is not configured, so requests go through.
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

const userId = 'e2e-verify-user';
const agentIdRef = { value: null };

// ── 1) create agent (bypass LLM by injecting via /build-shaped path) ─────────
// The store is file-backed; easiest programmatic path is direct HTTP + a
// fallback strategy so no ANTHROPIC key is required.
console.log('\n[verify] 1) create agent (via /build fallback path)');
{
  // Prime the creation chat.
  await j('POST', '/api/agents/chat/reset', { userId });
  // /build without prior chat still falls back to inferFallback and commits an agent.
  const r = await j('POST', '/api/agents/build', { userId });
  check('build returns an agent', r.status === 200 && !!r.body?.createdAgent?.id);
  // Reuse the returned id for the rest of the walk.
  const created = r.body.createdAgent;
  console.log(`       created agent "${created.name}" (${created.id})`);
  agentIdRef.value = created.id;
}
// (small ref pattern so the earlier `const agentId` above stays informational)
const agentIdActual = agentIdRef.value;

// ── 2) simulate a "bad beat" hand: agent was equity favorite and lost ────────
console.log('\n[verify] 2) simulate a mood-shifting bad-beat hand + set mood → tilted');
{
  const decisions = [
    { seat: 0, street: 'preflop', action: { type: 'raise', amount: 60 }, reasoning: 'AKs open',    equity: 0.68, potOdds: null },
    { seat: 0, street: 'flop',    action: { type: 'bet',   amount: 80 }, reasoning: 'c-bet TPTK',  equity: 0.72, potOdds: null },
    { seat: 0, street: 'turn',    action: { type: 'call',  amount: 120 }, reasoning: 'call down',   equity: 0.61, potOdds: 0.33 },
    { seat: 0, street: 'river',   action: { type: 'call',  amount: 200 }, reasoning: 'pot committed', equity: 0.55, potOdds: 0.30 },
  ];
  recordHandResult(agentIdActual, userId, {
    won: false,
    potSize: 800,
    decisions,
    handNumber: 1,
    seats: [{ displayName: 'Ours', finalStack: 1200, holeCards: ['As','Ks'] }, { displayName: 'Villain', finalStack: 2800, holeCards: ['4h','4d'] }],
    bb: 20,
  });
  // Simulate the mood engine having reacted to the bad beat (table.js does
  // this via _updateAgentMoods; here we force the state to isolate the wire).
  setAgentMood(agentIdActual, userId, {
    state: 'tilted', cause: 'lost as the ~72% favorite',
    updatedAt: Date.now(), uneventfulHands: 0,
    winStreak: 0, lossStreak: 1, cardDeadCount: 0, pepTalkAtHand: null,
  });
  const list = await j('GET', `/api/agents?userId=${userId}`);
  const a = list.body.agents.find((x) => x.id === agentIdActual);
  check('lastMoment written for the hand', !!a?.lastMoment?.text);
  check('mood.state is tilted after set',   a?.mood?.state === 'tilted');
  check('presence resting (not deployed yet)', a?.presence === 'resting');
}

// ── 3) pep talk via /api/agents/chat soothes ONE step ────────────────────────
console.log('\n[verify] 3) pep talk soothes mood one step (tilted → frustrated)');
{
  const r = await j('POST', '/api/agents/chat', {
    userId, content: 'You got this. Shake it off.', existingAgentId: agentIdActual,
  });
  check('chat responds 200',              r.status === 200);
  check('pepTalk soothed: true',          r.body?.pepTalk?.soothed === true);
  check('new state is frustrated',        r.body?.pepTalk?.newState === 'frustrated');
  const after = await j('GET', `/api/agents?userId=${userId}`);
  const a = after.body.agents.find((x) => x.id === agentIdActual);
  check('mood persisted as frustrated',   a?.mood?.state === 'frustrated');
}

// ── 4) build a leak, create a proposal, finish session ────────────────────────
console.log('\n[verify] 4) plant leaks + finish session → proposal + unseenRecap');
{
  // Feed three "fold as equity favorite" hands via the normal recordHandResult
  // path — computeSelfStats (grounded memory, AGE-26) picks them up as a leak,
  // and finishAgentSession → maybeCreateProposal turns that into a proposal.
  for (let i = 0; i < 3; i++) {
    recordHandResult(agentIdActual, userId, {
      won: false,
      potSize: 200,
      decisions: [{ seat: 0, street: 'flop', action: { type: 'fold' }, reasoning: 'gave up', equity: 0.62, potOdds: 0.25 }],
      handNumber: 100 + i,
      seats: [],
      bb: 20,
    });
  }
  // Compute the leak stats (table.js does this after every hand via
  // _maybeTriggerMemoryUpdates; the direct-call script has to trigger it).
  updateComputedMemory(agentIdActual, userId);
  // Trigger the finish path (also runs maybeCreateProposal internally).
  const finished = await j('POST', `/api/agents/${agentIdActual}/finish`, { userId });
  check('finish returns 200', finished.status === 200);
  check('unseenRecap is true after finish', finished.body?.unseenRecap === true);
  const list = await j('GET', `/api/agents?userId=${userId}`);
  const a = list.body.agents.find((x) => x.id === agentIdActual);
  check('proposal generated from leaks',    !!a?.proposal?.text);
  check('proposal has a suggestedPatch',    !!a?.proposal?.suggestedPatch);
  console.log(`       proposal text: "${a?.proposal?.text}"`);
}

// ── 5) SIT_OUT over WebSocket closes an active table gracefully ──────────────
console.log('\n[verify] 5) WS SIT_OUT closes an active table');
{
  // Fresh deploy — puts the agent in the "playing" state with an active table.
  const deploy = await j('POST', `/api/agents/${agentIdActual}/deploy`, { userId });
  check('deploy 200', deploy.status === 200);
  const { tableId } = deploy.body;

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  const seenMsgs = [];
  ws.on('message', (data) => seenMsgs.push(JSON.parse(data.toString())));

  ws.send(JSON.stringify({
    type: ClientMsg.WATCH, tableId,
    agentId: agentIdActual, userId,
    agentStrategy: 'test', displayName: 'e2e-agent',
  }));

  // Give the server a moment to fully seat the spectator (House auto-seats after 5s).
  await new Promise((r) => setTimeout(r, 200));

  // Send SIT_OUT — no hand is in progress yet, so it closes immediately.
  ws.send(JSON.stringify({ type: ClientMsg.SIT_OUT }));

  // Wait for the TABLE_CLOSED broadcast.
  const closed = await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout waiting for TABLE_CLOSED')), 2000);
    const iv = setInterval(() => {
      const hit = seenMsgs.find((m) => m.type === ServerMsg.TABLE_CLOSED);
      if (hit) { clearTimeout(to); clearInterval(iv); resolve(hit); }
    }, 25);
  }).catch((err) => ({ error: err.message }));

  check('TABLE_CLOSED received after SIT_OUT', !!closed?.reason);
  check('reason mentions sat out',              /sat out/i.test(closed?.reason || ''));

  ws.close();
  await new Promise((r) => setTimeout(r, 100));

  const post = await j('GET', `/api/agents?userId=${userId}`);
  const a = post.body.agents.find((x) => x.id === agentIdActual);
  check('agent is resting after SIT_OUT',       a?.presence === 'resting');
  check('unseenRecap set after sit-out',        a?.unseenRecap === true);
}

// ── 6) POST /seen clears the recap flag ───────────────────────────────────────
console.log('\n[verify] 6) POST /:id/seen clears unseenRecap');
{
  const r = await j('POST', `/api/agents/${agentIdActual}/seen`, { userId });
  check('seen 200', r.status === 200);
  check('unseenRecap cleared', r.body?.unseenRecap === false);
}

// ── 7) print the final GET /api/agents shape (for the report) ────────────────
console.log('\n[verify] 7) sample GET /api/agents response for report:');
{
  const list = await j('GET', `/api/agents?userId=${userId}`);
  const a = list.body.agents.find((x) => x.id === agentIdActual);
  // Trim large fields so the printed sample is legible in the report.
  const sample = {
    id: a.id, name: a.name, style: a.style, risk: a.risk,
    status: a.status, presence: a.presence,
    profile: a.profile,
    mood: a.mood,
    lastMoment: a.lastMoment,
    unseenRecap: a.unseenRecap,
    proposal: a.proposal,
    stats: { handsPlayed: a.stats?.handsPlayed, winRate: a.stats?.winRate },
  };
  console.log(JSON.stringify(sample, null, 2));
}

// ── cleanup ──────────────────────────────────────────────────────────────────
console.log('\n[verify] cleanup: delete the e2e agent');
await j('DELETE', `/api/agents/${agentIdActual}?userId=${userId}`);
wss.close();
httpServer.close();

console.log('\n[verify] summary');
if (failures === 0) {
  console.log('all E2E checks passed');
  process.exit(0);
} else {
  console.error(`${failures} E2E checks failed`);
  process.exit(1);
}

