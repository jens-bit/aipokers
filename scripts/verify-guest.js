// scripts/verify-guest.js — GUEST-1
//
// The whole guest run, end to end, against a real server: a stranger arrives,
// drafts somebody, plays his one night, hits the wall, and keeps him.
//
// The unit suites hold the rules one at a time. What this holds is the ORDER —
// that the five things happen in sequence, to the same person, through the
// routes a browser actually calls, with the cookie doing the work throughout.
// Every one of the limits below is enforced somewhere else in the codebase from
// where it is decided, and a chain like that is exactly the kind that passes
// piece by piece and is broken end to end.
//
// The two claims it exists for, that nothing smaller can make:
//
//   · THE COOKIE IS THE WHOLE IDENTITY. Not one request below sends a userId
//     the server has any reason to trust, and not one sends a token. The
//     cookie minted by POST /api/guest is carried by hand — this is a script,
//     not a browser — and everything from the draft to the claim follows from
//     it.
//   · HIS NIGHT SURVIVES THE CLAIM. The agent, the wallet and the hand history
//     that existed as `g_…` are the Telegram owner's afterwards, read back
//     through the ordinary roster route rather than out of the database.
//
// Run: node scripts/verify-guest.js

// TEST-2: no automated suite talks to a real model. Every decision below comes
// from the compiled policy, which is also what a guest gets in production.
delete process.env.ANTHROPIC_API_KEY;

// Timings compressed so the night is over in seconds. Set BEFORE table.js is
// evaluated, hence the dynamic imports below.
process.env.HAND_PAUSE_MS ??= '150';
process.env.SESSION_MAX_HANDS ??= '6';
process.env.MAX_SEATS ??= '2';
process.env.GUEST_ENABLED = '1';

import express from 'express';
import http from 'node:http';

const { createServer } = await import('../src/server/wsServer.js');
const {
  installAgentProfileRoutes, setLiveTableProvider, agentsOf,
} = await import('../src/server/agentProfiles.js');
const registry = await import('../src/server/tableRegistry.js');
const guest = await import('../src/server/guest.js');
const { installClaimRoute } = await import('../src/server/guestClaim.js');
const { handleStart } = await import('../src/server/guestBot.js');
const { setPersistEnabled: setOpponentStatsPersist } = await import('../src/server/opponentStats.js');
const store = await import('../src/server/store.js');

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
guest.installGuestRoutes(app);
installClaimRoute(app);
installAgentProfileRoutes(app);
const httpServer = http.createServer(app);
createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${httpServer.address().port}`;
console.log(`[verify] server up on ${base}`);

// TEST-4: start from nothing, so a run by hand from the repo root is
// repeatable rather than passing once. Under `npm run test:e2e` the scratch
// cwd has already made this a no-op.
const TG_ID = '900900900';
store.deleteOwner(TG_ID);

// The browser's cookie jar, kept by hand. This is the whole identity for
// everything below the draft.
let cookie = '';

const j = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
};

const waitFor = async (label, read, predicate, budgetMs = 30_000, everyMs = 200) => {
  const deadline = Date.now() + budgetMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (predicate(last)) return { ok: true, value: last };
    await sleep(everyMs);
  }
  return { ok: false, value: last, label };
};

// ── 1) a stranger arrives ────────────────────────────────────────────────────

console.log('\n[verify] 1) a stranger arrives and is given a cookie');

const made = await j('POST', '/api/guest');
check('POST /api/guest returns 200', made.status === 200, `got ${made.status}`);
const ownerId = made.body?.ownerId;
check('he is an owner id', typeof ownerId === 'string' && ownerId.startsWith('g_'), String(ownerId));
check('the cookie was set', cookie.startsWith('ap_guest='), cookie);
check('the token is not in the body — it is httpOnly for a reason', made.body?.token === undefined);
check('he is told what he is limited to', made.body?.limits?.agents === 1 && made.body?.limits?.sessionsPerDay === 1);

const me = await j('GET', '/api/guest/me');
check('the cookie identifies him on the next request', me.body?.ownerId === ownerId);

// ── 2) he drafts somebody ────────────────────────────────────────────────────
//
// The one thing a guest may spend a model call on — and with no key it is the
// keyless fallback, which is what every automated suite in this repo builds
// agents with.

console.log('\n[verify] 2) he drafts somebody');

await j('POST', '/api/agents/chat/reset', { userId: ownerId });
const brief = await j('POST', '/api/agents/chat', { userId: ownerId, content: 'tight, patient, punishes bluffs' });
check('the recruiter answers a guest', brief.status === 200, `got ${brief.status}`);

const built = await j('POST', '/api/agents/build', { userId: ownerId });
const agentId = built.body?.createdAgent?.id ?? null;
check('he is born', !!agentId, JSON.stringify(built.body).slice(0, 160));
const agentName = built.body?.createdAgent?.name ?? '';

// And a second one is refused, in the guest's own words rather than the
// earned-slot ladder's.
const second = await j('POST', '/api/agents/build', { userId: ownerId });
check('a second agent is refused with guestAgentCap',
  second.status === 409 && second.body?.error === 'guestAgentCap',
  `${second.status} ${JSON.stringify(second.body).slice(0, 120)}`);
check('and the refusal says what fixes it', second.body?.claim === true);

// ── 3) he cannot be talked to ────────────────────────────────────────────────

console.log('\n[verify] 3) he cannot be talked to');

const said = await j('POST', '/api/home/say', { userId: ownerId, text: 'how did it go?' });
check('POST /api/home/say is 403 claimToTalk',
  said.status === 403 && said.body?.error === 'claimToTalk', `got ${said.status}`);

const whispered = await j('POST', '/api/agents/chat', {
  userId: ownerId, content: 'fold more', existingAgentId: agentId,
});
check('the whisper is 403 claimToTalk',
  whispered.status === 403 && whispered.body?.error === 'claimToTalk', `got ${whispered.status}`);
check('both refusals carry the same flag, so one wall answers both',
  said.body?.claim === true && whispered.body?.claim === true);

// ── 4) his one night ─────────────────────────────────────────────────────────

console.log('\n[verify] 4) his one night at the casino');

const deploy = await j('POST', `/api/agents/${agentId}/deploy`, { userId: ownerId });
check('deploy returns 200', deploy.status === 200, `got ${deploy.status} ${JSON.stringify(deploy.body).slice(0, 160)}`);
check('a session started', deploy.body?.sessionStarted === true || !!deploy.body?.tableId);

// Hands are played by the compiled policy — a guest never reaches a model, so
// this is exactly the poker production gives him.
const played = await waitFor(
  'hands played',
  async () => (await j('GET', `/api/agents/${agentId}/hands?userId=${ownerId}`)).body?.stats?.handsPlayed ?? 0,
  (n) => n >= 2,
);
check('he actually plays hands, on the policy alone', played.ok, `handsPlayed=${played.value}`);

// The routes were filed, and every one of them is free.
const routes = store.readDecisionRoutes({ ownerId });
check('his decisions were routed', routes.length > 0);
check('and every one of them went to the policy',
  routes.every((r) => r.route === 'policy'),
  JSON.stringify(routes.map((r) => `${r.route}/${r.reason}`)));
check('for the reason "guest"',
  routes.every((r) => r.reason === 'guest'),
  JSON.stringify(routes.map((r) => r.reason)));

// Nothing was billed. This is the number the whole tree is about.
const spend = store.readModelCalls({ ownerId });
check('not one model call was billed to him', spend.length === 0, JSON.stringify(spend).slice(0, 200));

await j('POST', `/api/agents/${agentId}/finish`, { userId: ownerId });
await waitFor('he comes home',
  async () => (await j('GET', `/api/agents?userId=${ownerId}`)).body?.agents?.[0]?.status,
  (s) => s !== 'playing');

// ── 5) the wall ──────────────────────────────────────────────────────────────

console.log('\n[verify] 5) his night is spent, and the second one is the wall');

const again = await j('POST', `/api/agents/${agentId}/deploy`, { userId: ownerId });
check('a second night is refused with guestSessionCap',
  again.status === 409 && again.body?.error === 'guestSessionCap',
  `${again.status} ${JSON.stringify(again.body).slice(0, 140)}`);
check('and it too says what fixes it', again.body?.claim === true);

// ── 6) he keeps him ──────────────────────────────────────────────────────────

console.log('\n[verify] 6) he keeps him');

const before = agentsOf(ownerId);
const walletBefore = store.loadWallet(ownerId);
check('the guest owns exactly one agent before the claim', before.length === 1);

// No bot token on this server, so the credential is taken at face value the
// same way isOwner() takes it — the signature path is asserted in auth.test.js
// and in guestClaim.test.js.
const initData = `user=${encodeURIComponent(JSON.stringify({ id: Number(TG_ID), first_name: 'Stranger' }))}&auth_date=1`;
const claimed = await j('POST', '/api/guest/claim', { initData });
check('the claim returns 200', claimed.status === 200, `${claimed.status} ${JSON.stringify(claimed.body).slice(0, 140)}`);
check('it moved his agent', claimed.body?.agents === 1, JSON.stringify(claimed.body));
check('to the Telegram id', claimed.body?.ownerId === TG_ID);

// HIS NIGHT SURVIVED. Read back through the ordinary roster route, as the app
// reads it — not out of the database.
const roster = await j('GET', `/api/agents?userId=${TG_ID}`);
const kept = (roster.body?.agents ?? []).find((a) => a.id === agentId) ?? null;
check('the agent is the Telegram owner\'s now', !!kept, JSON.stringify(roster.body).slice(0, 200));
check('and he is the same man, by name', kept?.name === agentName, `${kept?.name} vs ${agentName}`);
check('his hand history came with him',
  ((await j('GET', `/api/agents/${agentId}/hands?userId=${TG_ID}`)).body?.stats?.handsPlayed ?? 0) >= 2);
check('the money came with him',
  store.loadWallet(TG_ID)?.balance === walletBefore?.balance,
  `${store.loadWallet(TG_ID)?.balance} vs ${walletBefore?.balance}`);
check('and nothing is left saying the guest id', agentsOf(ownerId).length === 0);

// The cookie was taken away with the claim.
const gone = await j('GET', '/api/guest/me');
check('the cookie no longer identifies anybody', gone.status === 404, `got ${gone.status}`);

// ── 7) and now he can talk ───────────────────────────────────────────────────

console.log('\n[verify] 7) and now the limits are gone');

const nowTalking = await fetch(`${base}/api/home/say`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
  body: JSON.stringify({ userId: TG_ID, text: 'how did it go?' }),
});
check('the room takes what he says now', nowTalking.status === 200, `got ${nowTalking.status}`);

// ── 8) the bot's door onto the same claim ────────────────────────────────────

console.log('\n[verify] 8) the bot reaches the same claim');

const second_guest = await j('POST', '/api/guest');
const secondOwner = second_guest.body?.ownerId;
const secondToken = cookie.split('=')[1];
store.deleteOwner('900900901');

const sentByBot = [];
const outcome = await handleStart(
  { text: `/start guest_${secondToken}`, chat: { id: 900900901 }, from: { id: 900900901 } },
  { bot: { async sendMessage(chatId, text, opts) { sentByBot.push({ chatId, text, opts }); return true; } } },
);
check('the bot claimed him', outcome === 'claimed', String(outcome));
check('and answered with a way back in', sentByBot.length === 1 && !!sentByBot[0].opts?.reply_markup);
check('the guest owner is empty afterwards', agentsOf(secondOwner).length === 0);

// ── done ─────────────────────────────────────────────────────────────────────

console.log(`\n[verify] ${failures === 0 ? 'PASS' : `FAIL — ${failures} failure(s)`}`);
try { registry.resetRegistry('verify-guest finished'); } catch { /* best effort */ }
await new Promise((res) => httpServer.close(res));
process.exit(failures > 0 ? 1 : 0);
