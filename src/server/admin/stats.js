// src/server/admin/stats.js — ADMIN-1 job 2
//
// The whole game, in one JSON.
//
// Three rules the shape of this file comes from:
//
//   1. EVERY NUMBER CARRIES ITS DEFINITION. A field is { value, definition },
//      never a bare number, and the definition is the actual SQL or the actual
//      source. A dashboard nobody can audit is a dashboard that gets quoted
//      wrong six months later, and the failure mode is silent — the number
//      looks fine, it just means something else. The page renders the
//      definition as a hover title on the tile, so nothing on it is a mystery.
//   2. ONE STATEMENT PER NUMBER. No number here walks a table in JavaScript.
//      The whole page has to come back in under 200ms on a prod-sized database
//      (asserted in stats.test.js against 500 owners / 2,000 agents / 50,000
//      hands) because it auto-refreshes every sixty seconds, and a dashboard
//      that costs the floor a hitch every minute is a dashboard that gets
//      turned off. The one loop is the cohort table, and it is one statement
//      too.
//   3. IT READS, AND THAT IS ALL. Nothing here writes, and nothing here calls a
//      model. The counters it reads are written by the product as it runs (see
//      the six bumpTick call sites) — not by this file, and never by a request
//      to it.
//
// Where the numbers come from, since it is not obvious from the field names:
//   · owner_activity   — presence (ADMIN-1 job 1)
//   · event_ticks      — the hourly tally (ADMIN-1 job 2)
//   · model_calls,
//     decision_routes,
//     watch_hands/calls — the meter (METER-1, COST-1, COST-2), read through
//                         meter.js's own adminMeter() rather than re-queried
//   · agents, wallets, guests, notifications — the product's own tables
//   · tableRegistry    — the live floor, which is in memory and nowhere else

import fs from 'node:fs';
import path from 'node:path';

import { adminDb, _dbPath } from '../store.js';
import { adminMeter } from '../meter.js';
import { SLOT_PRICES } from '../slots.js';
import * as registry from '../tableRegistry.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// The three canned strategies inferFallback() hands out when the model could
// not write a character (BUG-46). Since the repair they should only ever be
// produced on a keyless local box, so on prod this count is a smoke alarm: a
// number above zero means agents are being born from the default branch.
export const FALLBACK_STRATEGIES = Object.freeze([
  'You are a relentless aggressor who bets and raises at every opportunity. You build massive pots with strong hands and fire sustained bluffs to keep opponents permanently off-balance.',
  'You are a disciplined, patient player who only commits chips with premium holdings. You wait for the best spots, fold marginal hands without hesitation, and extract maximum value when you hold the nuts.',
  'You are a calculated, adaptive player who blends solid fundamentals with well-timed aggression. You value bet strong hands, pick precise bluff spots, and adjust your range based on how your opponent plays.',
]);

// Rule 1, as a constructor. Nothing in the payload is allowed to skip it.
const stat = (value, definition) => ({ value, definition });

const utcDay = (at) => new Date(at).toISOString().slice(0, 10);
const utcHour = (at) => new Date(at).toISOString().slice(0, 13);
const round = (n, places = 6) => Math.round(n * 10 ** places) / 10 ** places;

// ── The hourly tally ─────────────────────────────────────────────────────────
//
// One read of event_ticks covers every window and every sparkline on the page,
// so it is fetched once, for the widest window anything asks for, and sliced in
// memory. 168 hours by 8 names is at most about 1,300 rows.
//
// The windows are exact and they are stated exactly, because "last hour" is the
// one label on this page that could mean two things:
//   · 1h  — the CURRENT UTC hour bucket, so far. Not a rolling sixty minutes.
//   · 24h — the current bucket and the 23 before it.
//   · 7d  — the current bucket and the 167 before it.
function tallies(db, now) {
  const since = utcHour(now - 167 * HOUR);
  const rows = db.prepare('SELECT hour, name, count, value FROM event_ticks WHERE hour >= ? ORDER BY hour').all(since);

  const from = (hours) => {
    const bound = utcHour(now - (hours - 1) * HOUR);
    const out = new Map();
    for (const r of rows) {
      if (r.hour < bound) continue;
      const acc = out.get(r.name) ?? { count: 0, value: 0 };
      acc.count += r.count;
      acc.value += r.value;
      out.set(r.name, acc);
    }
    return out;
  };

  const h1 = from(1), h24 = from(24), h168 = from(168);
  const pick = (bucket, name, field = 'count') => bucket.get(name)?.[field] ?? 0;

  // A daily series for the sparklines: seven days, oldest first, zero-filled,
  // so a metric that was quiet on Tuesday draws a trough rather than shifting
  // the whole line one day to the left.
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(utcDay(now - i * DAY));

  const series = (name, field = 'count') => {
    const byDay = new Map(days.map((d) => [d, 0]));
    for (const r of rows) {
      if (r.name !== name) continue;
      const d = r.hour.slice(0, 10);
      if (byDay.has(d)) byDay.set(d, byDay.get(d) + (field === 'count' ? r.count : r.value));
    }
    return days.map((d) => ({ day: d, value: round(byDay.get(d)) }));
  };

  return {
    count: (name) => ({ h1: pick(h1, name), h24: pick(h24, name), d7: pick(h168, name) }),
    value: (name) => ({
      h1: round(pick(h1, name, 'value')),
      h24: round(pick(h24, name, 'value')),
      d7: round(pick(h168, name, 'value')),
    }),
    series,
    days,
  };
}

// ── The live floor ───────────────────────────────────────────────────────────
//
// In memory and nowhere else, so every one of these is wrapped: an exception
// out of the registry must cost the page one tile, not the whole page. Zero is
// a fact ("nobody is playing"); a 500 is a broken dashboard.
function floorCounts() {
  const safe = (fn, fallback = 0) => { try { return fn(); } catch { return fallback; } };
  return {
    casinoTables: safe(() => registry.activeFloorTableCount()),
    seatedAgents: safe(() => registry.seatedAgentCount()),
    homeGames: safe(() => registry.allTables().filter((t) => t.home && !t.closed).length),
  };
}

// ── System ───────────────────────────────────────────────────────────────────

// Read out of .git rather than shelled out to git: this runs on a request, and
// a dashboard that spawns a process every sixty seconds is a dashboard with a
// process-table problem. GIT_SHA wins when it is set, for a deployment that
// builds without a .git directory.
export function gitSha(root = process.cwd()) {
  if (process.env.GIT_SHA) return String(process.env.GIT_SHA).slice(0, 40);
  const read = (...p) => fs.readFileSync(path.join(...p), 'utf8').trim();
  try {
    // In a WORKTREE, .git is a FILE pointing at the real directory rather than
    // a directory — which is how every tab in HOW_WE_WORK runs. Both shapes
    // resolve here, and a worktree's refs may live only in the common dir.
    let gitDir = path.join(root, '.git');
    if (fs.statSync(gitDir).isFile()) gitDir = path.resolve(root, read(gitDir).replace(/^gitdir:\s*/, ''));
    let commonDir = gitDir;
    try { commonDir = path.resolve(gitDir, read(gitDir, 'commondir')); } catch { /* not a worktree */ }

    const head = read(gitDir, 'HEAD');
    if (!head.startsWith('ref:')) return head.slice(0, 40);
    const ref = head.slice(4).trim();

    for (const dir of [gitDir, commonDir]) {
      try { return read(dir, ref).slice(0, 40); } catch { /* try the next */ }
    }
    // A packed ref — the loose file is gone once git has packed it.
    const line = read(commonDir, 'packed-refs').split('\n').find((l) => l.endsWith(` ${ref}`));
    return line ? line.split(' ')[0].slice(0, 40) : null;
  } catch {
    return null;
  }
}

const sizeOf = (file) => { try { return fs.statSync(file).size; } catch { return 0; } };

function freeBytes(dir) {
  try {
    const s = fs.statfsSync(dir);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

// ── The payload ──────────────────────────────────────────────────────────────

/**
 * Everything the dashboard shows. One object; every leaf is { value, definition }
 * except `series`, `retention` and `problems`, which are shapes rather than
 * single numbers and carry their definition on the container.
 */
export function adminStats({ now = Date.now(), root = process.cwd() } = {}) {
  const db = adminDb();
  const t = tallies(db, now);
  const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args) ?? {})[0] ?? 0;

  const since24 = now - DAY;
  const since7 = now - 7 * DAY;
  const since30 = now - 30 * DAY;

  // ── owners ─────────────────────────────────────────────────────────────────
  //
  // An UNCLAIMED guest is not an owner: he is a guest, counted separately
  // below. A CLAIMED one is — his row stays in guests forever as the record
  // that the two ids were the same person, and excluding him would quietly
  // delete every owner who arrived through the guest door.
  const notGuest = 'owner_id NOT IN (SELECT owner_id FROM guests WHERE claimed_by IS NULL)';
  const activeSince = (ts) => one(
    `SELECT COUNT(DISTINCT owner_id) AS n FROM owner_activity WHERE last_seen >= ? AND ${notGuest}`, ts);
  const firstAgentSince = (ts) => one(
    'SELECT COUNT(*) AS n FROM (SELECT owner_id, MIN(created_at) AS f FROM agents GROUP BY owner_id) WHERE f >= ?', ts);

  const owners = {
    total: stat(
      one('SELECT COUNT(*) AS n FROM (SELECT owner_id FROM profiles UNION SELECT owner_id FROM wallets)'),
      'Distinct owner ids with a profile row or a wallet row — the same UNION listOwners() uses. Guests included.'),
    new24h: stat(firstAgentSince(since24),
      'Owners whose FIRST agent was drafted in the last 24h: COUNT over MIN(agents.created_at) GROUP BY owner_id, >= now-24h. An owner who opened the app and drafted nobody is not counted — nothing else in the database records a signup.'),
    new7d: stat(firstAgentSince(since7),
      'The same first-agent count, over 7 days: owners whose MIN(agents.created_at) is >= now-7d.'),
    active24h: stat(activeSince(since24),
      'COUNT(DISTINCT owner_id) FROM owner_activity WHERE last_seen >= now-24h, excluding unclaimed guests. ACTIVE means the server saw an authenticated request from him — the presence write, at most one a minute per owner (ADMIN-1 job 1). The table starts at the deploy that added it, so anything before that reads zero.'),
    active7d: stat(activeSince(since7),
      'The same presence count over 7 days: COUNT(DISTINCT owner_id) FROM owner_activity WHERE last_seen >= now-7d, excluding unclaimed guests.'),
    active30d: stat(activeSince(since30),
      'The same presence count over 30 days: COUNT(DISTINCT owner_id) FROM owner_activity WHERE last_seen >= now-30d, excluding unclaimed guests.'),
    guestsTotal: stat(one('SELECT COUNT(*) AS n FROM guests'),
      'COUNT(*) FROM guests — every no-account door ever opened, claimed or not. A claimed row is kept forever, so this only ever grows.'),
    guestsClaimed: stat(one('SELECT COUNT(*) AS n FROM guests WHERE claimed_by IS NOT NULL'),
      'COUNT(*) FROM guests WHERE claimed_by IS NOT NULL — guests who became a Telegram account. This over guestsTotal is the guest funnel.'),
    guestsActive24h: stat(one('SELECT COUNT(*) AS n FROM guests WHERE last_seen_at >= ?', since24),
      'COUNT(*) FROM guests WHERE last_seen_at >= now-24h. guests.last_seen_at is touched by guest.js on the cookie, not by presence, so guests are counted by their own clock.'),
  };

  // ── agents ─────────────────────────────────────────────────────────────────
  const perOwner = db.prepare(
    'SELECT AVG(n) AS avg, MAX(n) AS max FROM (SELECT COUNT(*) AS n FROM agents GROUP BY owner_id)').get() ?? {};

  const agents = {
    total: stat(one('SELECT COUNT(*) AS n FROM agents'),
      'COUNT(*) FROM agents — every agent record that exists, retired ones included.'),
    born24h: stat(one('SELECT COUNT(*) AS n FROM agents WHERE created_at >= ?', since24),
      'COUNT(*) FROM agents WHERE created_at >= now-24h.'),
    born7d: stat(one('SELECT COUNT(*) AS n FROM agents WHERE created_at >= ?', since7),
      'COUNT(*) FROM agents WHERE created_at >= now-7d.'),
    perOwnerAvg: stat(round(perOwner.avg ?? 0, 2),
      'AVG over COUNT(*) FROM agents GROUP BY owner_id. An owner with no agent at all is not in the denominator.'),
    perOwnerMax: stat(perOwner.max ?? 0,
      'MAX over the same grouping — the biggest roster on the server. The ceiling is 4 (SLOT_CAP).'),
    retired: stat(one("SELECT COUNT(*) AS n FROM agents WHERE json_extract(data, '$.archived') = 1"),
      'Agents whose record is stamped archived — what archiveAgent() sets when one is retired. The row is kept; nothing is ever deleted.'),
    fallbackBirths: stat(
      one('SELECT COUNT(*) AS n FROM agents WHERE json_extract(data, \'$.strategy\') IN (?, ?, ?)', ...FALLBACK_STRATEGIES),
      'BUG-46 alarm: agents whose strategy is EXACTLY one of inferFallback()’s three canned strings, meaning the draft was committed with no model behind it. Since the BUG-46 repair that can only happen on a keyless box, so on prod anything above zero is a fault, not a statistic.'),
  };

  // ── play ───────────────────────────────────────────────────────────────────
  const hands = t.count('hand');
  const knocks = t.count('visit.knock');
  const accepted = t.count('visit.accept');
  const floor = floorCounts();

  const play = {
    hands1h: stat(hands.h1,
      'event_ticks, name=hand, CURRENT UTC hour only — this hour so far, not a rolling sixty minutes. One tick per finished hand across the whole building (table.js _handCompleted), home games included.'),
    hands24h: stat(hands.h24,
      'event_ticks, name=hand, summed over the current UTC hour and the 23 before it — one tick per finished hand across the whole building.'),
    hands7d: stat(hands.d7,
      'event_ticks, name=hand, summed over the current UTC hour and the 167 before it — seven days of finished hands.'),
    casinoTablesLive: stat(floor.casinoTables,
      'tableRegistry.activeFloorTableCount() — casino tables with a hand actually in progress this instant. In memory; a restart resets it. Home games excluded.'),
    homeGamesRunning: stat(floor.homeGames,
      'Live tables flagged home and not closed, from tableRegistry.allTables(). Somebody’s living room, not the casino.'),
    agentsSeated: stat(floor.seatedAgents,
      'tableRegistry.seatedAgentCount() — distinct agents holding a casino seat this instant. The same figure the header pill shows.'),
    agentsVisiting: stat(one("SELECT COUNT(*) AS n FROM agents WHERE json_extract(data, '$.visiting.visitId') IS NOT NULL"),
      'Agents whose record says they are out at somebody else’s flat. Read from the record rather than from visit.js’s live Map because the record is the half that survives a restart.'),
    visitKnocks24h: stat(knocks.h24,
      'event_ticks, name=visit.knock, last 24 hourly buckets — every knock at a door, answered or not.'),
    visitAccepted24h: stat(accepted.h24,
      'event_ticks, name=visit.accept — of those knocks, the ones the host let in.'),
  };

  // ── money (chips) ──────────────────────────────────────────────────────────
  //
  // seatsUnlocked is built FROM SLOT_PRICES rather than written out, so the
  // ladder has one definition and re-pricing a slot re-prices this number.
  const slotCase = SLOT_PRICES
    .map((price, i) => (i === 0 ? null : `WHEN earned >= ${price} THEN ${i + 1}`))
    .filter(Boolean).reverse().join(' ');
  const chipsWon = t.value('chips.won');

  const money = {
    walletChips: stat(one('SELECT COALESCE(SUM(balance), 0) AS n FROM wallets'),
      'SUM(balance) FROM wallets — chips in owners’ wallets, not at any table.'),
    pocketChips: stat(one('SELECT COALESCE(SUM(pocket_balance), 0) AS n FROM agents'),
      'SUM(pocket_balance) FROM agents — chips in agents’ pockets, the lifted column the wallet screen’s "in pockets" tile already uses.'),
    biggestPocket: stat(one('SELECT COALESCE(MAX(pocket_balance), 0) AS n FROM agents'),
      'MAX(pocket_balance) FROM agents — the fattest single pocket on the server.'),
    chipsWon24h: stat(chipsWon.h24,
      'event_ticks, name=chips.won, the value column, last 24 hourly buckets. The sum of POSITIVE session nets as they were credited to wallets.earned — a losing session is not a debit here, it is simply not a credit, which is the rule SLOTS-1 already follows.'),
    seatsUnlocked: stat(
      one(`SELECT COALESCE(SUM(CASE ${slotCase} ELSE 1 END), 0) AS n FROM wallets`),
      `Agent slots opened by winnings, summed over every wallet, derived from SLOT_PRICES [${SLOT_PRICES.join(', ')}]. Everybody has one for free, so this is at least one per wallet.`),
  };

  // ── model ──────────────────────────────────────────────────────────────────
  //
  // The dollars come from meter.js, not from a second query over model_calls —
  // the meter already owns "what did this cost" and a dashboard that re-derives
  // it is a second answer waiting to disagree. The hourly numbers come from the
  // tick meter.js writes beside its own roll-up, because model_calls is keyed
  // by DAY and cannot answer "what has this hour cost".
  const meter = adminMeter({ days: 7, now });
  const calls = t.count('model.call');
  const spend = t.value('model.call');
  const lastCall = one('SELECT COALESCE(MAX(updated_at), 0) AS n FROM model_calls');
  const err = (bucket) => t.count(`model.err.${bucket}`).h24;

  const model = {
    calls1h: stat(calls.h1,
      'event_ticks, name=model.call, current UTC hour — every model call that succeeded, written by meter.recordModelCall alongside the daily roll-up.'),
    calls24h: stat(calls.h24,
      'event_ticks, name=model.call, summed over the current UTC hour and the 23 before it — successful model calls in the last day.'),
    calls7d: stat(calls.d7,
      'event_ticks, name=model.call, summed over 168 hourly buckets — successful model calls in the last week.'),
    usd1h: stat(spend.h1,
      'The value column of the same tick — dollars, priced by pricing.js at the moment of the call. Current UTC hour.'),
    usd24h: stat(spend.h24,
      'The value column of the model.call tick, summed over the current UTC hour and the 23 before it — dollars spent on models in the last day.'),
    usd7d: stat(spend.d7,
      'The value column of the model.call tick, summed over 168 hourly buckets — dollars spent on models in the last week.'),
    usdPer100HandsWatched: stat(meter.watch.watched.usdPer100Hands,
      'meter.js adminMeter(7 days).watch.watched — decision spend per 100 hands played at a table somebody was watching. null when no watched hand has been recorded: a rate with no hands behind it is not a rate.'),
    usdPer100HandsUnwatched: stat(meter.watch.unwatched.usdPer100Hands,
      'The same for hands nobody was watching. This is the COST-2 dial earning its keep — the unwatched line should be the cheap one, and if it is not, the gate is not firing.'),
    policyShare: stat(meter.routes.policyShare,
      'adminMeter(7 days).routes — the share of ALL decisions the router answered from the compiled policy, with no model call at all. null when nothing has been decided.'),
    cachedTokens: stat(meter.totals.cachedInputTokens,
      'SUM(cached_input_tokens) over 7 days of model_calls. Expected to be zero: CACHE-1 and COST-2-4 both measured prompt caching as inert on Haiku 4.5 (4,096-token minimum cacheable prefix; ours is 291).'),
    lastCallAt: stat(lastCall || null,
      'MAX(updated_at) FROM model_calls — when a model call last succeeded, epoch ms. This is the key-health reading: a floor that is playing while this stops moving means calls are failing, not that nobody is here.'),
    errors401_24h: stat(err('401'),
      'event_ticks, name=model.err.401, last 24 hourly buckets — a 401 or 403 out of the provider, meaning a revoked, wrong or missing key. Counted in providers/index.js, the one place every provider error passes through. Nothing about the call is stored, only that it failed.'),
    errors429_24h: stat(err('429'),
      'event_ticks, name=model.err.429, last 24 hourly buckets — the provider rate-limited us. A tally only; nothing about the call is stored.'),
    errors5xx_24h: stat(err('5xx'),
      'event_ticks, name=model.err.5xx, last 24 hourly buckets — the provider answered 5xx, meaning it was down or degraded. A tally only.'),
  };

  // ── notifications ──────────────────────────────────────────────────────────
  const sentByType = db.prepare(
    "SELECT type, COUNT(*) AS n FROM notifications WHERE state = 'sent' AND ts >= ? GROUP BY type ORDER BY n DESC").all(since24);

  // Booleans only. Three of these four env vars carry a secret, and the answer
  // this page needs is on or off, so the value never leaves the process.
  const flag = (name, on) => stat(on,
    `process.env.${name}, as a boolean. The value itself is never read out of the process by this endpoint.`);

  const notifications = {
    sent24h: stat(Object.fromEntries(sentByType.map((r) => [r.type, r.n])),
      "COUNT(*) FROM notifications WHERE state='sent' AND ts >= now-24h, GROUP BY type. The ledger is written only when a message actually went out — a failed send leaves no row."),
    sentTotal24h: stat(sentByType.reduce((a, r) => a + r.n, 0),
      "The same ledger rows summed across every type: COUNT(*) FROM notifications WHERE state='sent' AND ts >= now-24h."),
    refusedByBudget24h: stat(t.count('notify.budgetDrop').h24,
      'event_ticks, name=notify.budgetDrop — pings the daily budget (3 per owner) refused. Nothing about WHICH message is stored. A refusal writes nothing to the notifications ledger by design, so without this tick it was unanswerable.'),
    NOTIFY_ENABLED: flag('NOTIFY_ENABLED', process.env.NOTIFY_ENABLED === '1' || process.env.NOTIFY_ENABLED === 'true'),
    GUEST_ENABLED: flag('GUEST_ENABLED', process.env.GUEST_ENABLED === '1' || process.env.GUEST_ENABLED === 'true'),
    TICKER_ENABLED: flag('TICKER_ENABLED', !!process.env.TICKER_ENABLED && !!process.env.TICKER_CHANNEL_ID),
    UNWATCHED_POLICY: flag('UNWATCHED_POLICY', process.env.UNWATCHED_POLICY !== '0'),
  };

  // ── system ─────────────────────────────────────────────────────────────────
  const dbFile = _dbPath();
  const dataDir = path.dirname(dbFile);
  const uptimeS = Math.floor(process.uptime());

  const system = {
    gitSha: stat(gitSha(root),
      'GIT_SHA if set, else the commit .git/HEAD points at, read from the filesystem. Never shelled out to git — this runs on a request.'),
    bootAt: stat(now - uptimeS * 1000, 'now minus process.uptime(), epoch ms — when this process started.'),
    uptimeS: stat(uptimeS, 'process.uptime() in whole seconds — how long this server process has been up.'),
    node: stat(process.version, 'process.version — the Node runtime this server process is running on.'),
    dbBytes: stat(sizeOf(dbFile), `Size of ${path.basename(dbFile)} on disk.`),
    walBytes: stat(sizeOf(`${dbFile}-wal`),
      'Size of the write-ahead log. A WAL that keeps growing means a reader is holding a snapshot open.'),
    dataFreeBytes: stat(freeBytes(dataDir),
      'statfs on the data directory — bytes available. null where the platform will not say.'),
  };

  // ── retention ──────────────────────────────────────────────────────────────
  //
  // One statement for all fourteen cohorts. A cohort is the UTC day an owner's
  // FIRST agent was drafted; day 2 is the day after, day 7 is six days after,
  // and "active" is the same presence row every other active count reads.
  //
  // owner_activity only exists from the deploy that added it, so a cohort older
  // than that reads zero retained however real its owners were. The definition
  // says so rather than the page pretending otherwise.
  const cohortFrom = utcDay(now - 13 * DAY);
  const cohorts = db.prepare(`
    SELECT c.day AS day,
           COUNT(*) AS owners,
           SUM(CASE WHEN a2.owner_id IS NOT NULL THEN 1 ELSE 0 END) AS day2,
           SUM(CASE WHEN a7.owner_id IS NOT NULL THEN 1 ELSE 0 END) AS day7
      FROM (SELECT owner_id, strftime('%Y-%m-%d', MIN(created_at) / 1000, 'unixepoch') AS day
              FROM agents GROUP BY owner_id) c
      LEFT JOIN owner_activity a2 ON a2.owner_id = c.owner_id AND a2.day = date(c.day, '+1 day')
      LEFT JOIN owner_activity a7 ON a7.owner_id = c.owner_id AND a7.day = date(c.day, '+6 days')
     WHERE c.day >= ?
     GROUP BY c.day
     ORDER BY c.day
  `).all(cohortFrom).map((r) => ({
    day: r.day,
    owners: r.owners,
    day2: r.day2,
    day7: r.day7,
    day2Share: r.owners ? round(r.day2 / r.owners, 3) : null,
    day7Share: r.owners ? round(r.day7 / r.owners, 3) : null,
  }));

  const retention = stat(cohorts,
    'Cohorts by the UTC day an owner drafted his FIRST agent, last 14 days. day2 is how many of them were seen again on the following day; day7, six days after. SEEN is a row in owner_activity, which only starts at the deploy that added presence — a cohort older than that reads zero retained whatever its owners actually did.');

  // ── sparklines ─────────────────────────────────────────────────────────────
  const dailyCount = (sql, ...args) => {
    const byDay = new Map(t.days.map((d) => [d, 0]));
    for (const r of db.prepare(sql).all(...args)) if (byDay.has(r.day)) byDay.set(r.day, r.n);
    return t.days.map((d) => ({ day: d, value: byDay.get(d) }));
  };

  const series = stat({
    hands: t.series('hand'),
    modelCalls: t.series('model.call'),
    modelUsd: t.series('model.call', 'value'),
    chipsWon: t.series('chips.won', 'value'),
    visitKnocks: t.series('visit.knock'),
    notifyRefused: t.series('notify.budgetDrop'),
    agentsBorn: dailyCount(
      "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM agents WHERE created_at >= ? GROUP BY day",
      now - 7 * DAY),
    activeOwners: dailyCount(
      'SELECT day, COUNT(DISTINCT owner_id) AS n FROM owner_activity WHERE day >= ? GROUP BY day',
      t.days[0]),
  }, 'Seven daily buckets per metric, oldest first, zero-filled, UTC days. The tick series are event_ticks grouped by the day part of the hour key; agentsBorn and activeOwners are their own single statements.');

  // ── problems ───────────────────────────────────────────────────────────────
  //
  // Computed here rather than in the page, so "is anything wrong" has one
  // definition and it is the same one whether you read the JSON or look at the
  // strip. Each entry says what is wrong AND what makes it wrong.
  const problems = [];
  const add = (text, detail) => problems.push({ text, detail });

  if (model.errors401_24h.value > 0) {
    add(`Key unhealthy — ${model.errors401_24h.value} provider 401/403 in 24h`,
      'A revoked, wrong or missing ANTHROPIC_API_KEY. Every agent is falling back to the compiled policy.');
  }
  if (lastCall && play.hands24h.value > 0 && now - lastCall > 6 * HOUR) {
    add('Key unhealthy — hands are being played but no model call has succeeded in 6h',
      `Last successful call ${new Date(lastCall).toISOString()}; ${play.hands24h.value} hands in the last 24h.`);
  }
  if (model.errors5xx_24h.value > 0) {
    add(`${model.errors5xx_24h.value} provider 5xx in 24h`, 'The model provider was down or degraded.');
  }
  if (agents.fallbackBirths.value > 0) {
    add(`${agents.fallbackBirths.value} fallback birth(s)`,
      'Agents carrying one of inferFallback()’s three canned strategies — BUG-46. On a deployment with a key this should be zero.');
  }
  if (system.dbBytes.value > 500 * 1024 * 1024) {
    add(`Database is ${(system.dbBytes.value / (1024 ** 3)).toFixed(2)} GB`,
      'Over the 500 MB line. Nothing prunes hands or threads beyond their per-owner caps.');
  }
  if (!notifications.GUEST_ENABLED.value) {
    add('GUEST_ENABLED is off', 'The no-account door is shut — nobody can play without a Telegram account.');
  }
  if (!notifications.NOTIFY_ENABLED.value) {
    add('NOTIFY_ENABLED is off', 'The bot sends nothing. Owners are not being told their agent busted or finished a session.');
  }

  return { at: now, owners, agents, play, money, model, notifications, system, retention, series, problems };
}
