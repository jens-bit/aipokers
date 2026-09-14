// scripts/shots.js — SHOTS-1
//
// One command that refreshes the whole ground-truth screenshot pack in
// design-refs/shipped/. Claude Design can read the code but cannot run the
// app, so its boards drift from what actually shipped; this is what puts a
// real, current picture of every screen back in front of it.
//
// This is where the SEEDING happens — not in the Playwright spec — for one
// hard reason: SLOTS-1's 2nd and 3rd agent slots cost lifetime EARNED money
// (won at a felt, never given), and there is no HTTP route that credits it.
// The only honest way to unlock them for a single owner without playing
// hundreds of real hands is to write the `earned` column directly into the
// scratch SQLite database. That is safe to do to a row the running server has
// never touched — but agentProfiles.js's `wallets` Map caches every wallet it
// HAS touched for the life of the process (src/server/agentProfiles.js:175),
// so writing to a row already in that cache is invisible: the next unrelated
// save silently flushes the stale cached value straight back over it. So the
// household's first agent is built, the server is stopped (which drops the
// cache), `earned` is unlocked on disk, and the server is started again
// before the second and third agents are built. client/e2e/shipped-shots.spec.js
// receives the finished household as plain ids over SHOTS_CTX and never
// touches the database itself.
//
// Two servers run for the actual walk: one plain, one GUEST_ENABLED=1 — a
// guest and an owner cannot share a process, since GUEST-1's door is a
// boot-time env var (main.jsx's boot() picks it over everything once the
// server says it is open). Both keyless — no ANTHROPIC_API_KEY, no
// TELEGRAM_BOT_TOKEN — so every agent decision is the deterministic
// check/fold fallback and auth is open, which is what lets this seed a real
// household over plain HTTP instead of a signed Telegram session.
//
//   npm run shots
//
// Point it elsewhere with SHOTS_MAIN_PORT / SHOTS_GUEST_PORT if 8793/8794 are
// taken (this repo is regularly worked in several git worktrees at once).

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const MAIN_PORT = process.env.SHOTS_MAIN_PORT ?? '8793';
const GUEST_PORT = process.env.SHOTS_GUEST_PORT ?? '8794';
const MAIN_BASE = `http://127.0.0.1:${MAIN_PORT}`;
const GUEST_BASE = `http://127.0.0.1:${GUEST_PORT}`;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const MAIN_DIR = path.join(os.tmpdir(), `railbird-shots-${stamp}`, 'main');
const GUEST_DIR = path.join(os.tmpdir(), `railbird-shots-${stamp}`, 'guest');

const OWNER_UID = 'shipowner';
const UPSTAIRS_UID = 'shipupstairs';
const BACKROOM_UID = 'shipbackroom';

// A key or a bot token in the environment turns the seeding this pack relies
// on into 403s and non-deterministic model calls — stripped the same way the
// test runner strips them from every child, regardless of whose shell has
// them exported.
function childEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const k of ['ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'DEV_API_SECRET', 'ADMIN_KEY']) {
    delete env[k];
  }
  return env;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (result.status !== 0) {
    console.error(`FAIL: ${cmd} ${args.join(' ')} exited ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

async function waitForHealth(base, label) {
  const url = `${base}/api/stats`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) { console.log(`${label} up after ${i}s`); return; }
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} never answered ${url}`);
}

function startServer(dir, port, label, extraEnv = {}) {
  mkdirSync(dir, { recursive: true });
  const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: dir,
    env: childEnv({
      PORT: String(port),
      NOTIFY_ENABLED: '0',
      RATE_LIMIT_MAX: '100000',
      RATE_LIMIT_CHAT_MAX: '100000',
      HAND_PAUSE_MS: '300',
      HOME_PAUSE_MS: '300',
      ...extraEnv,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks = [];
  child.stdout.on('data', (d) => chunks.push(d));
  child.stderr.on('data', (d) => chunks.push(d));
  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`${label} server exited early (code ${code}, signal ${signal}):\n${Buffer.concat(chunks).toString()}`);
    }
  });
  return child;
}

async function stopServer(child) {
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
  });
}

async function api(base, method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* keep the text */ }
  return { status: res.status, body: parsed };
}

/**
 * Builds one agent from a creation chat. `brief`, when given, is one message
 * sent before /build — agentProfiles.js's keyless inferFallback() reads it
 * for "aggressive"/"tight" and names and styles the agent accordingly
 * (draftScripted.test.js's own scripted path, no model needed). Left empty,
 * every agent is "The Grinder" — fine for a throwaway, a household that is
 * supposed to read as three different people needs the nudge.
 */
async function buildAgent(base, userId, brief = null) {
  await api(base, 'POST', '/api/agents/chat/reset', { userId });
  if (brief) await api(base, 'POST', '/api/agents/chat', { userId, content: brief });
  const built = await api(base, 'POST', '/api/agents/build', { userId });
  const agent = built.body?.createdAgent;
  if (!agent?.id) throw new Error(`build for ${userId} failed: ${built.status} ${JSON.stringify(built.body)}`);
  return agent;
}

/** A throwaway single-agent household, funded and deployed at a given rung — real, but not "his". */
async function populateRoom(base, userId, rung, giveAmount) {
  const agent = await buildAgent(base, userId);
  await api(base, 'POST', `/api/agents/${agent.id}/fund`, { userId, verb: 'give', amount: giveAmount });
  const deployed = await api(base, 'POST', `/api/agents/${agent.id}/deploy`, { userId, rung });
  if (deployed.status !== 200) throw new Error(`deploy for ${userId} failed: ${deployed.status} ${JSON.stringify(deployed.body)}`);
  return { agent, tableId: deployed.body?.tableId ?? null };
}

function unlockSlots(dbPath, userId, earned) {
  const db = new Database(dbPath);
  try {
    db.pragma('busy_timeout = 5000');
    const changed = db.prepare('UPDATE wallets SET earned = ? WHERE owner_id = ?').run(earned, userId).changes;
    if (changed !== 1) throw new Error(`expected to unlock exactly one wallet row for ${userId}, changed ${changed}`);
  } finally {
    db.close();
  }
}

async function seedHousehold() {
  let main = startServer(MAIN_DIR, MAIN_PORT, 'main');
  await waitForHealth(MAIN_BASE, 'main');

  const homeAgent = await buildAgent(MAIN_BASE, OWNER_UID, 'Play tight, safe and conservative.'); // 1st slot, free
  const placed = await api(MAIN_BASE, 'POST', `/api/agents/${homeAgent.id}/place`, { userId: OWNER_UID, fixture: 'table' });
  if (placed.status !== 200 || !placed.body?.seated) {
    throw new Error(`home placement failed: ${placed.status} ${JSON.stringify(placed.body)}`);
  }

  // Restart to drop agentProfiles.js's in-memory wallet cache before the
  // direct write below — see the file header.
  await stopServer(main);
  unlockSlots(path.join(MAIN_DIR, 'data', 'app.db'), OWNER_UID, 60_000); // covers the 2nd (10k) and 3rd (50k) slots
  main = startServer(MAIN_DIR, MAIN_PORT, 'main');
  await waitForHealth(MAIN_BASE, 'main');

  const casinoAgent = await buildAgent(MAIN_BASE, OWNER_UID, 'Be aggressive, bluff and pressure people.'); // 2nd slot
  const restingAgent = await buildAgent(MAIN_BASE, OWNER_UID); // 3rd slot — see design-refs/shipped/README.md's gap note

  // Default rung: pocket.balance is the 2,000 auto-funded on birth
  // (wallet.js POCKET_FLOAT), which is exactly the floor's buy-in.
  const deployed = await api(MAIN_BASE, 'POST', `/api/agents/${casinoAgent.id}/deploy`, { userId: OWNER_UID });
  if (deployed.status !== 200) throw new Error(`deploy failed: ${deployed.status} ${JSON.stringify(deployed.body)}`);

  const upstairs = await populateRoom(MAIN_BASE, UPSTAIRS_UID, 1, 3_000);
  const backroom = await populateRoom(MAIN_BASE, BACKROOM_UID, 2, 8_000);

  // The matchmaker's own five-second budget (scripts/smoke.spec.js), plus
  // headroom for the deterministic fallback to actually play a beat.
  await new Promise((r) => setTimeout(r, 8_000));

  return {
    main,
    ctx: {
      homeAgentId: homeAgent.id,
      casinoAgentId: casinoAgent.id,
      restingAgentId: restingAgent.id,
      casinoTableId: deployed.body?.tableId ?? null,
      upstairsTableId: upstairs.tableId,
      backroomTableId: backroom.tableId,
    },
  };
}

async function main() {
  console.log('=== build:client ===');
  run('npm', ['run', 'build:client'], { cwd: ROOT });

  console.log('=== seed household ===');
  const { main: mainServer, ctx } = await seedHousehold();
  console.log('seeded:', ctx);

  console.log('=== start guest server ===');
  const guestServer = startServer(GUEST_DIR, GUEST_PORT, 'guest', { GUEST_ENABLED: '1' });
  await waitForHealth(GUEST_BASE, 'guest');

  let exitCode = 1;
  try {
    console.log('=== playwright ===');
    const result = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.shots.config.js'], {
      cwd: path.join(ROOT, 'client'),
      shell: process.platform === 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        SHOTS_BASE_URL: MAIN_BASE,
        SHOTS_GUEST_BASE_URL: GUEST_BASE,
        SHOTS_CTX: JSON.stringify(ctx),
      },
    });
    exitCode = result.status ?? 1;
  } finally {
    mainServer.kill();
    guestServer.kill();
  }

  console.log(`scratch data left at ${path.dirname(MAIN_DIR)} for inspection`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
