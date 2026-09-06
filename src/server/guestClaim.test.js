// src/server/guestClaim.test.js — GUEST-1 job 3
//
// Keeping him: a rename, not a conversion.
//
// The assertions here are all versions of one question — after the claim, is
// there anything left that still says the guest's id? A claim that moves the
// agent and forgets the thread is a claim that loses the evening the whole
// wall was about; a claim that moves the rows but not the CACHE looks perfect
// in SQL and empty in the product until somebody restarts the server.
//
// So the cache is asserted through agentProfiles (what the product reads), the
// rows are asserted through the store (what survives a restart), and the two
// are checked to agree. And the money is checked twice, because the two wallet
// cases have opposite right answers: a first-time claimer TAKES the guest's
// wallet (summing would hand him two seeds) and a returning owner ADDS it
// (discarding would throw away an evening).

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let guest;
let claimMod;
let profiles;
let server;
let base;

const TG_NEW = '5550001';       // a Telegram owner who has never been here
const TG_RETURNING = '5550002'; // one who already has a flat

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
  stats: { handsPlayed: 40, handsWon: 12 },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
  ...over,
});

/** initData as Telegram sends it, unsigned — this suite runs with no bot token. */
const initDataFor = (id) => `user=${encodeURIComponent(JSON.stringify({ id: Number(id), first_name: 'A' }))}&auth_date=1`;

/** The token out of a Set-Cookie header — the only place the client ever sees it. */
const tokenOf = (setCookie) => decodeURIComponent(String(setCookie).split(';')[0].split('=')[1] ?? '');

const post = (p, body, headers = {}) => fetch(`${base}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body ?? {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), setCookie: r.headers.get('set-cookie') }));

// Seeding a NEW owner straight into the store after agentProfiles has already
// loaded its in-memory copy is invisible to it — the same cache this whole
// tree had to learn about. reloadOwners() is the honest way to say "the rows
// changed underneath you", and it is the function the claim itself uses.
const seedRoster = (ownerId, agents) => {
  store.saveProfile(ownerId, { userId: ownerId, chat: [], agents });
  profiles.reloadOwners(ownerId);
};

/** A whole guest, with an agent, a wallet, a thread and a hand behind him. */
function seedGuest(ownerId, token, { balance = 4_200, earned = 900 } = {}) {
  store.insertGuest({ token, ownerId, ip: '10.9.9.9' });
  store.saveWallet(ownerId, { ownerId, balance, earned, fridge: { beer: 1, snack: 2 }, ledger: [] });
  store.saveProfile(ownerId, {
    userId: ownerId,
    chat: [{ role: 'user', content: 'tight and mean' }],
    agents: [agent(`${ownerId}-man`)],
  });
  store.appendHandRow(ownerId, { handNumber: 7, pot: 400 }, 20);
  store.appendThreadLine({
    sessionId: `s-${ownerId}`, agentId: `${ownerId}-man`, ownerId,
    tableId: 't1', ts: Date.now(), kind: 'him', who: 'HIM', text: 'That was mine.',
  });
  store.addDecisionRoute({ day: '2026-09-06', ownerId, route: 'policy', reason: 'guest', decisions: 12 });
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-claim-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  process.env.GUEST_ENABLED = '1';

  guest = await import('./guest.js');
  claimMod = await import('./guestClaim.js');
  profiles = await import('./agentProfiles.js');

  seedGuest('g_first', 'tok-first');
  seedGuest('g_second', 'tok-second', { balance: 1_000, earned: 300 });
  seedGuest('g_twice', 'tok-twice');
  seedGuest('g_stolen', 'tok-stolen');
  seedGuest('g_route', 'tok-route');

  // The returning owner's own flat, seeded before anything warms the cache.
  store.saveWallet(TG_RETURNING, { ownerId: TG_RETURNING, balance: 500, earned: 100, fridge: { beer: 3 }, ledger: [] });
  store.saveProfile(TG_RETURNING, { userId: TG_RETURNING, chat: [], agents: [agent('oldtimer')] });

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  guest.installGuestRoutes(app);
  claimMod.installClaimRoute(app);
  profiles.installAgentProfileRoutes(app);
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => { process.env.GUEST_ENABLED = '1'; });

after(async () => {
  delete process.env.GUEST_ENABLED;
  if (server) await new Promise((r) => server.close(r));
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── The move ────────────────────────────────────────────────────────────────

test('GUEST-1: the claim is a rename — nothing is left saying the old id', () => {
  // Read him through agentProfiles FIRST, so the cache is warm and holding the
  // guest. This is the state the bug would hide in.
  assert.equal(profiles.agentsOf('g_first').length, 1);

  const out = claimMod.claimGuest('tok-first', TG_NEW);
  assert.equal(out.status, 200);
  assert.equal(out.body.claimed, true);
  assert.equal(out.body.ownerId, TG_NEW);
  assert.equal(out.body.from, 'g_first');
  assert.equal(out.body.agents, 1);
  assert.deepEqual(out.body.collided, []);

  // What the PRODUCT reads — the in-memory roster.
  assert.deepEqual(profiles.agentsOf(TG_NEW).map((a) => a.id), ['g_first-man']);
  assert.deepEqual(profiles.agentsOf('g_first'), []);

  // What survives a restart — the rows.
  const rows = store.loadAgentStore();
  assert.equal(rows['g_first'], undefined);
  assert.deepEqual(rows[TG_NEW].agents.map((a) => a.id), ['g_first-man']);
});

test('GUEST-1: the thread, the hands and the meter come with him', () => {
  assert.equal(store.readHandRows(TG_NEW, 20).length, 1);
  assert.equal(store.readHandRows('g_first', 20).length, 0);

  const lines = store.readThreadLines('s-g_first');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].ownerId, TG_NEW);

  const routes = store.readDecisionRoutes({ ownerId: TG_NEW });
  assert.equal(routes.some((r) => r.reason === 'guest' && r.decisions === 12), true);
  assert.equal(store.readDecisionRoutes({ ownerId: 'g_first' }).length, 0);
});

test('GUEST-1: a first-time claimer TAKES the wallet — one seed, not two', () => {
  const wallet = store.loadWallet(TG_NEW);
  assert.equal(wallet.balance, 4_200);
  assert.equal(wallet.earned, 900);
  assert.deepEqual(wallet.fridge, { beer: 1, snack: 2 });
  assert.equal(store.loadWallet('g_first'), null);
});

test('GUEST-1: a returning owner ADDS it — an evening is not thrown away', () => {
  assert.equal(profiles.agentsOf(TG_RETURNING).length, 1);

  const out = claimMod.claimGuest('tok-second', TG_RETURNING);
  assert.equal(out.status, 200);
  assert.equal(out.body.wallet, 'merged');

  const wallet = store.loadWallet(TG_RETURNING);
  assert.equal(wallet.balance, 500 + 1_000);
  assert.equal(wallet.earned, 100 + 300);
  assert.deepEqual(wallet.fridge, { beer: 3 + 1, snack: 2 });

  // Both men are his now, and the roster the product reads says so.
  assert.deepEqual(profiles.agentsOf(TG_RETURNING).map((a) => a.id).sort(), ['g_second-man', 'oldtimer']);
});

// ── Idempotence ─────────────────────────────────────────────────────────────

test('GUEST-1: claiming twice is a no-op, not a second empty guest', () => {
  const first = claimMod.claimGuest('tok-twice', '5550003');
  assert.equal(first.body.agents, 1);

  const second = claimMod.claimGuest('tok-twice', '5550003');
  assert.equal(second.status, 200);
  assert.equal(second.body.claimed, true);
  assert.equal(second.body.alreadyClaimed, true);
  assert.equal(second.body.agents, 0, 'nothing moved the second time');

  // And the roster did not gain a second copy of him.
  assert.deepEqual(profiles.agentsOf('5550003').map((a) => a.id), ['g_twice-man']);
});

test('GUEST-1: somebody else\'s spent token is not his to claim', () => {
  claimMod.claimGuest('tok-stolen', '5550004');
  const thief = claimMod.claimGuest('tok-stolen', '5550005');
  assert.equal(thief.status, 409);
  assert.equal(thief.body.error, 'alreadyClaimed');
  assert.deepEqual(profiles.agentsOf('5550005'), []);
});

test('GUEST-1: a token nobody minted is a 404', () => {
  const out = claimMod.claimGuest('not-a-token', '5550006');
  assert.equal(out.status, 404);
  assert.equal(out.body.error, 'noGuest');
});

test('GUEST-1: no Telegram user is a 400, and nothing moves', () => {
  const out = claimMod.claimGuest('tok-route', '');
  assert.equal(out.status, 400);
  assert.equal(profiles.agentsOf('g_route').length, 1, 'still his');
});

test('GUEST-1: the claim does not exist when the door is shut', () => {
  delete process.env.GUEST_ENABLED;
  const out = claimMod.claimGuest('tok-route', '5550007');
  assert.equal(out.status, 404);
  assert.equal(out.body.error, 'guestDisabled');
  process.env.GUEST_ENABLED = '1';
});

// ── The route ───────────────────────────────────────────────────────────────

test('GUEST-1: POST /api/guest/claim takes the cookie and clears it', async () => {
  const made = await post('/api/guest', {});
  const ownerId = made.body.ownerId;
  seedRoster(ownerId, [agent('cookieman')]);
  // Warm the cache the way the client would, by asking for his roster.
  assert.equal(profiles.agentsOf(ownerId).length, 1);

  const claimed = await post('/api/guest/claim', {}, {
    cookie: `${guest.GUEST_COOKIE}=${tokenOf(made.setCookie)}`,
    'x-telegram-init-data': initDataFor('5550100'),
  });
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.ownerId, '5550100');
  assert.equal(claimed.body.agents, 1);

  // The cookie is taken away: whatever this browser is now, it is not a guest.
  assert.match(claimed.setCookie, /^ap_guest=;/);
  assert.match(claimed.setCookie, /Max-Age=0/);
  assert.match(claimed.setCookie, /HttpOnly/);

  // And the spent cookie no longer resolves to anybody.
  const me = await fetch(`${base}/api/guest/me`, { headers: { cookie: `${guest.GUEST_COOKIE}=${tokenOf(made.setCookie)}` } });
  assert.equal(me.status, 404);
});

test('GUEST-1: the token may come in the body — the bot has no cookie', async () => {
  const made = await post('/api/guest', {});
  const ownerId = made.body.ownerId;
  seedRoster(ownerId, [agent('botman')]);
  assert.equal(profiles.agentsOf(ownerId).length, 1);

  const claimed = await post('/api/guest/claim',
    { token: tokenOf(made.setCookie), initData: initDataFor('5550101') });
  assert.equal(claimed.status, 200);
  assert.deepEqual(profiles.agentsOf('5550101').map((a) => a.id), ['botman']);
});

test('GUEST-1: no token at all is a 400', async () => {
  const out = await post('/api/guest/claim', {}, { 'x-telegram-init-data': initDataFor('5550102') });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'noGuestToken');
});

test('GUEST-1: no credential is a 400 rather than a claim by nobody', async () => {
  const made = await post('/api/guest', {});
  const out = await post('/api/guest/claim', {}, { cookie: `${guest.GUEST_COOKIE}=${tokenOf(made.setCookie)}` });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'noTelegramUser');
});

test('GUEST-1: with a bot token configured, a forged credential is refused', async () => {
  const made = await post('/api/guest', {});
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-not-a-real-one';
  try {
    const out = await post('/api/guest/claim', {}, {
      cookie: `${guest.GUEST_COOKIE}=${tokenOf(made.setCookie)}`,
      'x-telegram-init-data': initDataFor('5550103'),
    });
    assert.equal(out.status, 401);
    assert.deepEqual(profiles.agentsOf('5550103'), []);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

// ── The seats ───────────────────────────────────────────────────────────────

test('GUEST-1: a seat mid-session is re-pointed, not left naming a dead owner', async () => {
  const registry = await import('./tableRegistry.js');
  const { setLiveTableProvider } = profiles;
  setLiveTableProvider(registry);
  try {
    const made = await post('/api/guest', {});
    const ownerId = made.body.ownerId;
    seedRoster(ownerId, [agent('seatedman')]);
    assert.equal(profiles.agentsOf(ownerId).length, 1);

    const table = registry.getOrCreateTable('claim-seat-table', {});
    table.agentUserIds[0] = ownerId;
    table.agentIds[0] = 'seatedman';

    const out = claimMod.claimGuest(tokenOf(made.setCookie), '5550200');
    assert.equal(out.status, 200);
    assert.equal(table.agentUserIds[0], '5550200',
      'the seat files the rest of this session under the owner who exists');
  } finally {
    try { registry.resetRegistry('test over'); } catch { /* best effort */ }
    setLiveTableProvider(null);
  }
});
