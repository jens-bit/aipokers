// src/server/guestLimits.test.js — GUEST-1 job 2
//
// The four limits, and the nightly pass that forgets him.
//
// The claim this file exists to hold is not "a guest is limited" — it is that
// EVERY limit has exactly one definition. So each test below asserts the rule
// through the door the product actually uses (deployAgent, the chat route, the
// router, the talk split) rather than by calling the predicate that decides it,
// because a predicate agreeing with itself proves nothing about whether
// anybody asked it.
//
// The other half is the negative space, and it is asserted just as hard: a
// CLAIMED owner at the same felt, on the same day, through the same routes, is
// completely untouched. A limit that leaks onto paying owners is worse than no
// limit, and "it only affects guests" is exactly the kind of claim that is true
// on the day it is written.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { routeFor, Route, Reason } from './router.js';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let guest;
let guestNight;
let profiles;
let server;
let base;

let GUEST_ID;
let GUEST_TOKEN;
const CLAIMED_ID = 'u-claimed';

const agent = (id, over = {}) => ({
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
  stats: { handsPlayed: 20, handsWon: 8 },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
  ...over,
});

const post = (p, body, cookie = null) => fetch(`${base}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const guestCookie = () => `${guest.GUEST_COOKIE}=${GUEST_TOKEN}`;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-glimits-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  process.env.GUEST_ENABLED = '1';

  guest = await import('./guest.js');
  guestNight = await import('./guestNight.js');
  profiles = await import('./agentProfiles.js');

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  guest.installGuestRoutes(app);
  profiles.installAgentProfileRoutes(app);
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  const made = await post('/api/guest', {});
  GUEST_ID = made.body.ownerId;
  GUEST_TOKEN = made.body.token;

  store.saveWallet(GUEST_ID, { ownerId: GUEST_ID, balance: 5_000, fridge: {}, ledger: [] });
  store.saveProfile(GUEST_ID, { userId: GUEST_ID, chat: [], agents: [agent('gman')] });
  store.saveWallet(CLAIMED_ID, { ownerId: CLAIMED_ID, balance: 5_000, fridge: {}, ledger: [] });
  store.saveProfile(CLAIMED_ID, { userId: CLAIMED_ID, chat: [], agents: [agent('cman')] });

  // The nightly pass's five fixtures, seeded HERE rather than inside their own
  // tests. agentProfiles holds the profile table in memory and loads it once,
  // lazily, on first use — so a profile written straight to SQL after that
  // first use is invisible to it. In the running server that never happens
  // (every profile is created through agentProfiles), but a test that writes
  // behind the cache is a test asserting against a store the product is not
  // reading. Seeding before anything warms the cache keeps these assertions
  // about the pass rather than about the cache.
  const DAY = 24 * 60 * 60 * 1000;
  const seedGuest = (ownerId, token, madeDaysAgo, seenDaysAgo, over = {}) => {
    store.insertGuest({ token, ownerId, ip: '10.1.1.' + ownerId.length, now: Date.now() - madeDaysAgo * DAY });
    store.touchGuest(token, Date.now() - seenDaysAgo * DAY);
    store.saveWallet(ownerId, { ownerId, balance: 0, fridge: {}, ledger: [] });
    store.saveProfile(ownerId, { userId: ownerId, chat: [], agents: [agent(ownerId + '-man', over)] });
  };
  seedGuest('g_stale',   'tok-stale',     31, 31,
    { pocket: { balance: 700, mode: 'allowance', cap: null, realised: 0, ledger: [] } });
  seedGuest('g_fresh',   'tok-fresh',      1,  1);
  seedGuest('g_loyal',   'tok-old-loyal', 90,  0);   // made in spring, here five minutes ago
  seedGuest('g_claimed', 'tok-claimed',   99, 99);
  seedGuest('g_twice',   'tok-twice',     40, 40);
  store.markGuestClaimed('tok-claimed', '777');
});

beforeEach(() => { process.env.GUEST_ENABLED = '1'; });

after(async () => {
  delete process.env.GUEST_ENABLED;
  if (server) await new Promise((r) => server.close(r));
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── The predicates, and the switch under all of them ────────────────────────

test('GUEST-1: every limit is off when the door is shut', () => {
  delete process.env.GUEST_ENABLED;
  assert.equal(guest.isGuestOwner(GUEST_ID), false);
  assert.equal(guest.modelBlocked(GUEST_ID), false);
  assert.equal(guest.mustClaimToTalk(GUEST_ID), false);
  assert.equal(guest.guestAgentRefusal(GUEST_ID, 4), null);
  assert.equal(guest.guestSessionRefusal(GUEST_ID), null);
  process.env.GUEST_ENABLED = '1';
  assert.equal(guest.isGuestOwner(GUEST_ID), true);
});

test('GUEST-1: a claimed owner is not a guest and never was', () => {
  assert.equal(guest.isGuestOwner(CLAIMED_ID), false);
  assert.equal(guest.modelBlocked(CLAIMED_ID), false);
  assert.equal(guest.mustClaimToTalk(CLAIMED_ID), false);
  assert.equal(guest.guestAgentRefusal(CLAIMED_ID, 99), null);
  assert.equal(guest.guestSessionRefusal(CLAIMED_ID), null);
});

// ── Limit 1 · one agent ─────────────────────────────────────────────────────

test('GUEST-1: one agent, and the refusal says what fixes it', () => {
  assert.equal(guest.GUEST_AGENT_CAP, 1);
  assert.equal(guest.guestAgentRefusal(GUEST_ID, 0), null, 'his first is free');
  const refusal = guest.guestAgentRefusal(GUEST_ID, 1);
  assert.equal(refusal.error, 'guestAgentCap');
  assert.equal(refusal.cap, 1);
  // `claim: true` is what the client opens the wall on. Every guest refusal
  // carries it, which is what lets one wall answer all of them.
  assert.equal(refusal.claim, true);
});

test('GUEST-1: the build door refuses his second agent, and the draft survives', async () => {
  // The go signal with a brief behind it is the build trigger. The roster
  // already holds one, so this is the second.
  await post('/api/agents/chat', { userId: GUEST_ID, content: 'tight and patient, small pots' }, guestCookie());
  const built = await post('/api/agents/chat', { userId: GUEST_ID, content: 'lets go' }, guestCookie());
  assert.equal(built.status, 409);
  assert.equal(built.body.error, 'guestAgentCap');

  // AGENTS-2's rule, kept: a refused build leaves the draft where it was.
  const profile = await fetch(`${base}/api/agent-profile?userId=${GUEST_ID}`, { headers: { cookie: guestCookie() } }).then((r) => r.json());
  assert.equal(profile.agents.length, 1);
  assert.ok(profile.chat.some((m) => m.role === 'user' && /tight and patient/.test(m.content)),
    'the brief he typed is still there');
});

// ── Limit 2 · one casino session a day ──────────────────────────────────────

test('GUEST-1: one session a day, and it is spent by sitting down, not by asking', () => {
  assert.equal(guest.GUEST_SESSIONS_PER_DAY, 1);
  assert.equal(guest.guestSessionRefusal(GUEST_ID), null, 'nothing asked, nothing spent');
  // Asking again does not spend it — the gate is read-only. This is the whole
  // reason noteSession is separate: a refused deploy (a broke pocket, a full
  // floor) must not cost a guest his night.
  assert.equal(guest.guestSessionRefusal(GUEST_ID), null);

  guest.noteSession(GUEST_ID);
  const refusal = guest.guestSessionRefusal(GUEST_ID);
  assert.equal(refusal.error, 'guestSessionCap');
  assert.equal(refusal.perDay, 1);
  assert.equal(refusal.used, 1);
  assert.equal(refusal.claim, true);
});

test('GUEST-1: tomorrow is a new night', () => {
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  assert.equal(guest.guestSessionRefusal(GUEST_ID, { now: tomorrow }), null);
});

test('GUEST-1: noting a session for a claimed owner does nothing at all', () => {
  assert.equal(guest.noteSession(CLAIMED_ID), 0);
  assert.equal(guest.guestSessionRefusal(CLAIMED_ID), null);
});

test('GUEST-1: deploy is the door the cap is enforced at', () => {
  // His night is already spent by the test above. deployAgent is called
  // directly — with no liveTables provider the pocket gate is skipped, which
  // is what makes this an assertion about the ORDER of the gates: the guest
  // refusal comes back rather than a table.
  const out = profiles.deployAgent(GUEST_ID, 'gman');
  assert.equal(out.status, 409);
  assert.equal(out.body.error, 'guestSessionCap');

  // And the same call for a claimed owner is untouched.
  const claimed = profiles.deployAgent(CLAIMED_ID, 'cman');
  assert.notEqual(claimed.status, 409);
});

// ── Limit 3 · he cannot talk ────────────────────────────────────────────────

test('GUEST-1: one refusal body, so one wall can answer all of them', () => {
  assert.equal(guest.CLAIM_TO_TALK.error, 'claimToTalk');
  assert.equal(guest.CLAIM_TO_TALK.claim, true);
  assert.ok(guest.CLAIM_TO_TALK.message.length > 0);
  assert.ok(Object.isFrozen(guest.CLAIM_TO_TALK));
});

test('GUEST-1: POST /api/home/say is 403 claimToTalk', async () => {
  const said = await post('/api/home/say', { userId: GUEST_ID, text: 'anyone in?' }, guestCookie());
  assert.equal(said.status, 403);
  assert.equal(said.body.error, 'claimToTalk');

  const claimed = await post('/api/home/say', { userId: CLAIMED_ID, text: 'anyone in?' });
  assert.equal(claimed.status, 200);
});

test('GUEST-1: the whisper is 403 claimToTalk, and the DRAFT is not', async () => {
  const whisper = await post('/api/agents/chat',
    { userId: GUEST_ID, content: 'fold more', existingAgentId: 'gman' }, guestCookie());
  assert.equal(whisper.status, 403);
  assert.equal(whisper.body.error, 'claimToTalk');

  // The exception, and the reason this file asserts it: the draft is the one
  // model call a guest is allowed, so the same route with no existing agent
  // must still answer. (No key in this suite, so the reply is the keyless
  // fallback — what matters is that it is a 200 and not the wall.)
  const draft = await post('/api/agents/chat', { userId: GUEST_ID, content: 'aggressive, bluffs a lot' }, guestCookie());
  assert.equal(draft.status, 200);

  const claimed = await post('/api/agents/chat',
    { userId: CLAIMED_ID, content: 'fold more', existingAgentId: 'cman' });
  assert.equal(claimed.status, 200);
});

// ── Limit 4 · policy only ───────────────────────────────────────────────────

// The worst spot in poker for the router: a river all-in, in a huge pot, on
// tilt, against a nemesis, with somebody talking to him. Every gate that sends
// a decision to the model fires at once.
const worstSpot = () => ({
  street: 'river',
  community: ['2h', '7d', 'Jc', '4s', '9d'],
  holeCards: ['As', 'Kd'],
  equity: 0.5, potOdds: 0.5, toCall: 500, myStack: 500, pot: 4000, bb: 20,
  anyAllIn: true,
  mood: { state: 'tilted', heat: 95 },
  readOnWire: true,
  tableTalk: 'Still folding, then?',
  legalActions: ['fold', 'call'],
});

test('GUEST-1: a guest plays on policy in the spot that fires every gate', () => {
  const spending = routeFor(worstSpot(), { nemesis: true });
  assert.equal(spending.route, Route.MODEL, 'this spot really does cost money normally');

  const free = routeFor(worstSpot(), { guest: true, nemesis: true });
  assert.equal(free.route, Route.POLICY);
  assert.equal(free.reason, Reason.GUEST);
  assert.equal(free.tag, 'policy/guest');
});

test('GUEST-1: DECISION_ROUTER=off does not switch the guest rule off with it', () => {
  // The kill switch is the way back from a bad ROUTING call. It is not a way
  // to start billing for anonymous browsers, which is the same reason it does
  // not reopen the kitchen table.
  process.env.DECISION_ROUTER = 'off';
  try {
    assert.equal(routeFor(worstSpot(), { guest: true }).reason, Reason.GUEST);
    assert.equal(routeFor(worstSpot(), { home: true }).reason, Reason.HOME);
    assert.equal(routeFor(worstSpot()).reason, Reason.OFF);
  } finally {
    delete process.env.DECISION_ROUTER;
  }
});

test('GUEST-1: the guest gate does not touch anybody else', () => {
  const spot = worstSpot();
  assert.equal(routeFor(spot, { guest: false }).route, Route.MODEL);
  assert.equal(routeFor(spot).route, Route.MODEL);
});

// ── The other model calls ───────────────────────────────────────────────────

test('GUEST-1: the memory refresh is refused for a guest and runs for anybody else', async () => {
  // No key in this suite, so a claimed owner's call returns null too — what is
  // being pinned is that the guest is turned away BEFORE the agent is even
  // looked up, which is what makes the rule hold for a caller that is not the
  // table.
  assert.equal(await profiles.runMemoryUpdate('gman', GUEST_ID, []), null);
  // An id that does not exist proves the guest branch returned first: for a
  // non-guest this is the "agent not found" null, one line further down.
  assert.equal(await profiles.runMemoryUpdate('nobody', GUEST_ID, []), null);
  assert.equal(guest.modelBlocked(GUEST_ID), true);
  assert.equal(guest.modelBlocked(CLAIMED_ID), false);
});

// ── The nightly pass ────────────────────────────────────────────────────────

test('GUEST-1: the switch stops the pass too', () => {
  guestNight.resetNightly();
  delete process.env.GUEST_ENABLED;
  assert.deepEqual(guestNight.runNightly({ force: true }), []);
  process.env.GUEST_ENABLED = '1';
});

test('GUEST-1: a guest untouched for thirty days is retired, and it is a retirement', () => {
  guestNight.resetNightly();
  const retired = guestNight.runNightly({ force: true }).map((r) => r.ownerId).sort();

  // Exactly the two nobody came back for. Asserted as the WHOLE list rather
  // than as five separate "is he in it" checks, because the thing that would
  // actually go wrong is a pass retiring somebody it should not have.
  assert.deepEqual(retired, ['g_stale', 'g_twice']);

  const after = profiles.agentsOf('g_stale').find((a) => a.id === 'g_stale-man');
  assert.equal(after.archived, true, 'archived, exactly as POST /retire archives');
  assert.ok(after.archivedAt > 0);
  // The money came home the way a retirement brings it home, rather than being
  // deleted along with him.
  assert.equal(after.pocket.balance, 0);
  assert.equal(store.loadWallet('g_stale').balance, 700);
  // And nothing is deleted: the guest row survives, so a cookie that somehow
  // outlives thirty days finds a flat with a retired man in it, not a 404.
  assert.ok(store.loadGuestByToken('tok-stale'));
});

test('GUEST-1: a guest who was here yesterday is left alone', () => {
  assert.notEqual(profiles.agentsOf('g_fresh').find((a) => a.id === 'g_fresh-man').archived, true);
});

test('GUEST-1: thirty days of SILENCE, not thirty days of age', () => {
  // Made three months ago, here five minutes ago. An age-based sweep would
  // have taken him; a silence-based one leaves him where he is.
  assert.notEqual(profiles.agentsOf('g_loyal').find((a) => a.id === 'g_loyal-man').archived, true);
});

test('GUEST-1: a claimed guest is nobody the pass has an opinion about', () => {
  assert.notEqual(profiles.agentsOf('g_claimed').find((a) => a.id === 'g_claimed-man').archived, true);
});

test('GUEST-1: once a day — the second call is a map lookup and nothing else', () => {
  assert.deepEqual(guestNight.runNightly(), []);
});
