// scripts/verify-visit-referral.js — VISIT-1 job 6
//
// The whole referral chain, end to end, against a real server: an existing
// owner's agent is sent visiting a link with nobody behind it yet, a
// stranger follows it, drafts his own agent, and the ORIGINAL visit — the
// one job 1 already knows how to run — starts the moment he is born.
//
// What the unit suites cannot hold: this is three modules' wiring
// (guest.js's referredBy, agentProfiles.js's birth listener, visit.js's own
// request/answer pair) reached the way a browser actually reaches it, through
// createServer()'s real composition — the one place all three are actually
// wired together.
//
// Run: node scripts/verify-visit-referral.js

// TEST-2: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;
process.env.GUEST_ENABLED = '1';

import express from 'express';
import http from 'node:http';

const { createServer } = await import('../src/server/wsServer.js');
const {
  installAgentProfileRoutes, setLiveTableProvider, agentsOf,
} = await import('../src/server/agentProfiles.js');
const registry = await import('../src/server/tableRegistry.js');
const guest = await import('../src/server/guest.js');
const visit = await import('../src/server/visit.js');
const store = await import('../src/server/store.js');

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

// ── boot ─────────────────────────────────────────────────────────────────────
//
// Written BEFORE createServer() ever touches agentProfiles.js — its own boot
// reconciliation is the module's first read, and a profile saved after that
// is invisible to the cache it populates (the same note homeGame.test.js and
// place.test.js carry).

const HOST = 'visit-referral-host';
store.deleteOwner(HOST);
store.saveProfile(HOST, {
  userId: HOST, chat: [],
  agents: [{
    id: 'agent_referrer', name: 'Away Day', status: 'idle', activeTableId: null,
    strategy: 'You are a poker player.', style: 'Balanced', risk: 'Medium', bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'topup', cap: null, realised: 0, ledger: [] },
    stats: { handsPlayed: 0, handsWon: 0 },
    profile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 },
  }],
});

const app = express();
app.use(express.json());
guest.installGuestRoutes(app);
installAgentProfileRoutes(app);
visit.installVisitRoutes(app);
const httpServer = http.createServer(app);
const { wss } = createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${httpServer.address().port}`;
console.log(`[verify] server up on ${base}`);
setLiveTableProvider(registry);

let cookie = '';
const j = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
};

// ── 1) the preview a stranger with no account can read ──────────────────────

console.log('\n[verify] 1) the public preview, before any account exists');

const preview = await j('GET', '/api/agents/agent_referrer/visit-preview');
check('200, no auth needed', preview.status === 200, `got ${preview.status}`);
check('names him, and only him', preview.body?.agentName === 'Away Day', JSON.stringify(preview.body));

const noPreview = await j('GET', '/api/agents/nobody/visit-preview');
check('404 for an agent nobody has', noPreview.status === 404, `got ${noPreview.status}`);

// ── 2) a stranger follows the link ───────────────────────────────────────────

console.log('\n[verify] 2) he mints a guest, carrying the referral');

const made = await j('POST', '/api/guest', { visitAgentId: 'agent_referrer' });
check('POST /api/guest returns 200', made.status === 200, `got ${made.status}`);
const guestOwnerId = made.body?.ownerId;
check('he is an owner id', typeof guestOwnerId === 'string' && guestOwnerId.startsWith('g_'));

const referred = guest.guestFor(guestOwnerId)?.referredBy;
check('the referral is on record', referred === 'agent_referrer', String(referred));

// Before he has drafted anybody, there is nobody's door for the visit to land
// on — the referral is recorded, not yet acted on.
check('and nothing has knocked yet', visit.pendingVisitorFor(guestOwnerId) === null);

// ── 3) he drafts his own agent ───────────────────────────────────────────────

console.log('\n[verify] 3) he drafts his own agent — his first household');

await j('POST', '/api/agents/chat/reset', { userId: guestOwnerId });
await j('POST', '/api/agents/chat', { userId: guestOwnerId, content: 'tight, patient, punishes bluffs' });
const built = await j('POST', '/api/agents/build', { userId: guestOwnerId });
const newAgentId = built.body?.createdAgent?.id ?? null;
check('he is born', !!newAgentId, JSON.stringify(built.body).slice(0, 160));
check('one agent, as a guest is capped at', agentsOf(guestOwnerId).length === 1);

// ── 4) the visit proceeds as job 1 ───────────────────────────────────────────

console.log('\n[verify] 4) the original visit starts on its own, the moment he has a household');

const pending = visit.pendingVisitorFor(guestOwnerId);
check('a knock is waiting, unprompted', pending?.agentId === 'agent_referrer', JSON.stringify(pending));

const answered = await j('POST', `/api/home/visitors/${pending.id}/answer`, { hostUserId: guestOwnerId, accept: true });
check('he can answer it exactly as job 1 already lets a host answer any knock',
  answered.status === 200 && answered.body?.accepted === true, JSON.stringify(answered.body));
check('and the visitor is seated at his OWN brand-new kitchen table',
  (answered.body?.game?.seats ?? []).some((s) => s.agentId === 'agent_referrer'));

// A guest with a referral to a nonexistent agent gets nothing — not a crash.
console.log('\n[verify] 5) a stray referral is a no-op, not a failure');
const strayGuest = await j('POST', '/api/guest', { visitAgentId: 'agent_does_not_exist' });
const strayOwnerId = strayGuest.body?.ownerId;
await j('POST', '/api/agents/chat/reset', { userId: strayOwnerId });
await j('POST', '/api/agents/chat', { userId: strayOwnerId, content: 'loose and aggressive' });
const strayBuilt = await j('POST', '/api/agents/build', { userId: strayOwnerId });
check('he is still born', !!strayBuilt.body?.createdAgent?.id);
check('nothing knocked on a household built from a stray referral',
  visit.pendingVisitorFor(strayOwnerId) === null);

// ── done ─────────────────────────────────────────────────────────────────────

console.log(`\n[verify] ${failures === 0 ? 'PASS' : `FAIL — ${failures} failure(s)`}`);
try { registry.resetRegistry('verify-visit-referral finished'); } catch { /* best effort */ }
await new Promise((res) => httpServer.close(res));
await new Promise((res) => wss.close(res));
store._closeForTests();
// BUG-34: forced exit while Windows is closing async handles can abort libuv
// after every assertion passed. Let the event loop finish its own cleanup.
process.exitCode = failures > 0 ? 1 : 0;
