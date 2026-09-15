#!/usr/bin/env node
// scripts/simulate-economy.js — MONEY-2 job 3
//
// DOES THE MONEY IN OWNER HANDS STAY PUT?
//
// MONEY-1 made the books balance: `Σ safes + Σ pockets + bank` stopped moving,
// and every chip an agent wins now comes out of the cage instead of out of
// nowhere. What it did not do — could not do, it was a correctness job — is
// give the economy a DRAIN. A population of agents playing House regulars takes
// chips off the bank on every winning night and gives them back only by losing,
// and the House refills the felt every time it busts, so the winners keep
// finding somebody to win from. The total in owner hands climbs.
//
// MONEY-2 job 3 adds a rake. This script is how its two dials were chosen, and
// it is here so they can be chosen again rather than argued about: change
// `RAKE_PERCENT` or `RAKE_CAP_BB` and watch the curve.
//
// ── What is real here and what is modelled ───────────────────────────────────
//
// REAL, because the shape of the answer depends on it:
//   * the engine (src/engine/game.js) deals and awards every hand;
//   * a real `Table` runs them, which is what seats a fresh House regular the
//     moment the last one busts — the compounding half of the problem;
//   * the compiled policy (src/agent/policyPlay.js) plays every seat, through
//     the table's own `_buildAiGameState`, so these are the decisions the
//     product actually makes when nobody is paying for a model call;
//   * `src/server/rake.js` takes the cut, through the table's own `_takeRake`.
//
// MODELLED, because it is arithmetic the conservation suite already pins:
//   * the rail. Deploy debits the pocket into the bank; settlement pays the
//     gross out of the bank and takes the rake back. Three lines, done in
//     plain objects rather than through SQLite, so a few thousand hands take
//     seconds instead of minutes. `src/server/chipConservation.test.js` and
//     `src/server/money2Rake.test.js` are what prove the real rail matches.
//
// No model calls, ever: the script refuses to start with a key in the
// environment, for the same reason the e2e suites do (TEST-2).
//
// ── Usage ────────────────────────────────────────────────────────────────────
//
//   node scripts/simulate-economy.js                     # the current setting
//   node scripts/simulate-economy.js --hands 4000 --owners 12
//   node scripts/simulate-economy.js --sweep             # the table job 3 wanted
//   node scripts/simulate-economy.js --percent 4 --cap 3
//   node scripts/simulate-economy.js --json
//
// The number to read is `drift`: chips in owner hands at the end minus at the
// start, as a percentage of the start. Positive is a faucet, negative is a
// grinder, and roughly flat over a few thousand hands is what we are looking
// for — the rake should stop the climb, not confiscate the bankroll.

import { Streets } from '../src/engine/game.js';
import { Table, MIN_TO_DEAL } from '../src/server/table.js';
import { chooseFromPolicy } from '../src/agent/policyPlay.js';
import { setPersistEnabled } from '../src/server/opponentStats.js';
import { rakeFor, rakeSettings } from '../src/server/rake.js';
import { STAKES } from '../src/server/wallet.js';

if (process.env.ANTHROPIC_API_KEY) {
  console.error('simulate-economy: unset ANTHROPIC_API_KEY. This script must never make a model call.');
  process.exit(1);
}

// Opponent stats persist to disk through store.js; a simulation has no business
// writing to anybody's data directory.
setPersistEnabled(false);
process.env.NOTIFY_ENABLED = '0';

// A Table narrates every seat, every reconcile and every cooler. Four thousand
// hands of that buries the one table this script exists to print, so the
// table's own voice is turned off and only this script's output survives.
// `--verbose` gives it back.
const say = console.log.bind(console);
if (!process.argv.includes('--verbose')) console.log = () => {};

// ── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || i === argv.length - 1) return fallback;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
};

const HANDS = Math.max(100, Math.floor(opt('hands', 4_000)));
// Heads-up poker is loud. One run of a few thousand hands is forty-odd
// sessions, and forty sessions of variance is bigger than any rake worth
// charging — so every setting is replayed over N independent seeds and the
// drift is the mean. `--seeds 1` is the single run, for a quick look.
const SEEDS = Math.max(1, Math.floor(opt('seeds', 3)));
const OWNERS = Math.max(2, Math.floor(opt('owners', 12)));
const SEED = Math.floor(opt('seed', 20260915));
const SESSION_HANDS = Math.max(10, Math.floor(opt('session', 100)));
const SAMPLES = 10;

// One entry rung, because that is where a new household plays and where the
// climb was measured. A household starts with the starting grant split the way
// agentProfiles.js splits it: one buy-in in the pocket, the rest in the safe.
const RUNG = STAKES[0];
const STARTING_GRANT = 10_000;
const OPENING_POCKET = RUNG.buyIn;

// ── A seeded shuffle ────────────────────────────────────────────────────────
//
// mulberry32: small, fast, and good enough for a deck — this is an economy
// simulation, not a randomness test.
//
// IT DOES NOT MAKE A RUN REPRODUCIBLE, and it is worth knowing why before
// reading two rows as an A/B. The seed controls the CARDS; it does not control
// the policy, because `compilePolicy` rolls its bluff die on `Math.random` by
// default (policy.js `rollDice`) and `_buildAiGameState` lets it. So the same
// seed at two settings plays two different games, and the same seed twice at
// one setting does too — measured: the same three seeds at 0% came back
// +3.6/+1.0/+4.2 on one pass and -2.6/-0.2/+1.9 on the next.
//
// The consequence for reading this script: DRIFT IS A SAMPLE, not a
// measurement, and the seeds are there to give you several of them rather than
// to pin anything. `raked` is the number that holds still (within ~10% run to
// run at a fixed setting), which is why the recommendation below is built on
// it and not on the drift column.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANKS = '23456789TJQKA';
const SUITS = 'cdhs';
function shuffledDeck(rand) {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// A spread of characters rather than twelve copies of one, because how much a
// population wins off the House depends on how it plays. These are the same
// four sliders `normalizeProfile` takes everywhere else.
const CHARACTERS = [
  { tightness: 75, aggression: 45, bluffFreq: 10, discipline: 80 },   // a rock
  { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },   // balanced
  { tightness: 35, aggression: 80, bluffFreq: 45, discipline: 40 },   // a maniac
  { tightness: 60, aggression: 70, bluffFreq: 30, discipline: 70 },   // TAG
];

const n = (v) => Math.round(v).toLocaleString('en-US');
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ── The rail, modelled ───────────────────────────────────────────────────────

function newWorld() {
  const owners = [];
  for (let i = 0; i < OWNERS; i++) {
    owners.push({
      id: `sim-${i}`,
      profile: CHARACTERS[i % CHARACTERS.length],
      pocket: OPENING_POCKET,
      safe: STARTING_GRANT - OPENING_POCKET,
    });
  }
  // The bank holds what it holds; only the DELTA matters to this script, so it
  // opens at zero and is allowed to go negative, exactly as houseBank.js is.
  return { owners, bank: 0, rakeTaken: 0, sessions: 0, hands: 0, busts: 0, houseSeats: 0 };
}

const inOwnerHands = (world) => world.owners.reduce((n, o) => n + o.pocket + o.safe, 0);

/** Deploy: POCKET -> BANK. Refused when the pocket does not cover the buy-in. */
function buyIn(world, owner) {
  // The refill toggle, modelled: he tops up from the safe when he is short,
  // which is what an `auto` pocket does at the admission gate.
  if (owner.pocket < RUNG.buyIn) {
    const need = Math.min(RUNG.buyIn - owner.pocket, owner.safe);
    owner.safe -= need;
    owner.pocket += need;
  }
  if (owner.pocket < RUNG.buyIn) return false;
  owner.pocket -= RUNG.buyIn;
  world.bank += RUNG.buyIn;
  return true;
}

/** Settlement: BANK -> POCKET for the gross, then the cut back to the cage. */
function cashOut(world, owner, { stack, rake }) {
  const gross = stack + rake;
  world.bank -= gross;
  owner.pocket += gross;
  world.bank += rake;
  owner.pocket -= rake;
  world.rakeTaken += rake;
}

/**
 * Take one action, and never let a rejected one end the run.
 *
 * The compiled policy sizes a raise from directives, and the engine has rules
 * the directives do not carry (min-raise, a shove that is not a raise, a seat
 * that is already all-in). In the product a rejected action is a bug worth
 * shouting about; here it is a hand that has to finish so the economy can be
 * measured, so this falls back through the engine's OWN list of what is legal
 * rather than guessing a second time. Returns false only when the engine says
 * this seat has nothing at all it may do, which ends the hand.
 */
function act(game, seat, action) {
  if (action) {
    try { game.act(seat, action); return true; } catch { /* fall through */ }
  }
  let legal = [];
  try { legal = game.legalActions(seat) ?? []; } catch { return false; }
  for (const want of ['check', 'call', 'fold']) {
    const found = legal.find((a) => a.type === want);
    if (!found) continue;
    try { game.act(seat, { type: found.type }); return true; } catch { /* next */ }
  }
  return false;
}

// ── One session, played for real ─────────────────────────────────────────────

function playSession(world, owner, rand) {
  const table = new Table({
    tableId: `sim-${world.sessions}`,
    smallBlind: RUNG.smallBlind,
    bigBlind: RUNG.bigBlind,
    maxSeats: 2,
  });
  // Nothing in this script waits on a clock: hands happen when the loop below
  // says so, and every scheduler on the table is a no-op.
  table._scheduleNextHand = () => {};
  table.startSessionLoop = () => {};
  table._broadcast = () => {};
  table._broadcastState = () => {};
  table._notifyStateChange = () => {};
  table.maxHands = SESSION_HANDS;

  // The four things a completed hand does that neither move a chip NOR change
  // a decision: the hand history goes to disk, the per-agent reports and the
  // memory trigger reach into agentProfiles for records these seats do not
  // have, and the thread narrates a session nobody is watching.
  //
  // `_recordOpponentStats` and `_updateAgentMoods` are deliberately NOT stubbed
  // even though they are slow. They feed the reads and the tilt that
  // `_buildAiGameState` hands the policy, so silencing them would change how
  // the population plays — measured: the same seed and no rake drifted +2.0%
  // with them and −5.2% without. A simulation that plays a different game from
  // the product is a simulation of nothing.
  table._persistHand = () => {};
  table._reportHandResults = () => {};
  table._classifyAndFlagHands = () => {};
  table._maybeTriggerMemoryUpdates = () => {};
  table._handEndEvents = () => [];
  table._threadTable = () => {};

  const hero = table.seatAI({ displayName: owner.id, agentProfile: owner.profile, buyIn: RUNG.buyIn });
  table.seatAI({ displayName: 'House', agentProfile: CHARACTERS[1], buyIn: RUNG.buyIn });
  world.houseSeats++;

  let played = 0;
  while (played < SESSION_HANDS) {
    table._reconcileSeats();
    if (!table.game || table.game.seats.length < MIN_TO_DEAL) break;
    // The hero busting ends the session; the House busting does not — the
    // table stands a fresh regular up, which is the compounding this is here
    // to measure.
    if (table.seatStack(hero) <= 0) break;

    try {
      table.game.startHand(shuffledDeck(rand));
    } catch {
      break;   // a stack too short to post is the end of the evening
    }

    let guard = 0;
    let stuck = false;
    while (table.game.street !== Streets.COMPLETE && guard++ < 400) {
      const seat = table.game.toAct;
      if (seat === null || seat === undefined) break;
      let action;
      try {
        action = chooseFromPolicy(table._buildAiGameState(seat)).action;
      } catch {
        action = null;
      }
      if (!act(table.game, seat, action)) { stuck = true; break; }
    }
    if (stuck || table.game.street !== Streets.COMPLETE) break;

    table._handCompleted();
    played++;
    world.hands++;

    // The House ran out and the table refills it. Table's own call, made here
    // rather than through the scheduler this script has stubbed out.
    if (table.seatStack(1 - hero) <= 0) {
      table._reconcileSeats();
      if (table.seatedCount() < MIN_TO_DEAL) {
        table._seatHouseRegulars(MIN_TO_DEAL);
        world.houseSeats++;
      }
    }
  }

  const stack = Math.max(0, table.seatStack(hero) ?? 0);
  const rake = table.seatRakePaid(hero);
  if (stack <= 0) world.busts++;
  table._clearTimers?.();
  return { stack, rake, hands: played };
}

// ── One run ──────────────────────────────────────────────────────────────────

function run({ percent, capBb }, seed = SEED) {
  if (percent === null) delete process.env.RAKE_PERCENT; else process.env.RAKE_PERCENT = String(percent);
  if (capBb === null) delete process.env.RAKE_CAP_BB; else process.env.RAKE_CAP_BB = String(capBb);
  const settings = rakeSettings();

  const rand = rng(seed);
  const world = newWorld();
  const start = inOwnerHands(world);
  const every = Math.max(1, Math.floor(HANDS / SAMPLES));
  const curve = [{ hands: 0, owners: start }];
  let nextSample = every;
  let next = 0;

  while (world.hands < HANDS) {
    // Round-robin, so every character gets the same number of trips.
    const owner = world.owners[next % world.owners.length];
    next++;
    if (!buyIn(world, owner)) {
      // Everybody broke is the end of the world, and it is a result.
      if (world.owners.every((o) => o.pocket + o.safe < RUNG.buyIn)) break;
      continue;
    }
    const out = playSession(world, owner, rand);
    cashOut(world, owner, out);
    world.sessions++;
    if (world.hands >= nextSample) {
      curve.push({ hands: world.hands, owners: inOwnerHands(world) });
      nextSample += every;
    }
  }

  const end = inOwnerHands(world);
  curve.push({ hands: world.hands, owners: end });
  return {
    seed,
    percent: settings.percent,
    capBb: settings.capBb,
    capChips: Math.floor(settings.capBb * RUNG.bigBlind),
    // What a rake of this size actually costs on a typical pot at this rung —
    // the number that makes a percentage legible.
    rakeOnTenBb: rakeFor(RUNG.bigBlind * 10, RUNG.bigBlind, settings),
    hands: world.hands,
    sessions: world.sessions,
    busts: world.busts,
    houseSeats: world.houseSeats,
    start,
    end,
    drift: end - start,
    driftPct: start > 0 ? ((end - start) / start) * 100 : 0,
    rakeTaken: world.rakeTaken,
    bank: world.bank,
    curve,
  };
}

// ── Output ───────────────────────────────────────────────────────────────────


function printRun(r) {
  say(`\nrake ${r.percent}% capped at ${r.capBb}bb (${n(r.capChips)} chips at ${RUNG.label})`);
  say(`  ${r.hands} hands over ${r.sessions} sessions, ${r.busts} busts, ${r.houseSeats} House seats dealt in`);
  say(`  owner chips  ${n(r.start)} -> ${n(r.end)}   drift ${n(r.drift)} (${pct(r.driftPct)})`);
  say(`  raked ${n(r.rakeTaken)}, bank ${n(r.bank)}`);
  say('  curve:');
  for (const point of r.curve) {
    const delta = point.owners - r.start;
    const bar = '#'.repeat(Math.min(40, Math.round(Math.abs(delta) / Math.max(1, r.start) * 200)));
    say(`    ${String(point.hands).padStart(6)}  ${n(point.owners).padStart(10)}  ${delta >= 0 ? '+' : '-'}${bar}`);
  }
}

// The settings actually worth a row. The cap is held at 3bb across most of them
// on purpose: the first sweep put 2bb and 3bb within 3.5% of each other at the
// entry rung, because the percentage binds and the cap almost never does, so
// spending a row on the cap buys nothing here. 2bb is kept as the one
// comparison that shows that.
const SWEEP = [
  { percent: 0, capBb: 0 },
  { percent: 1, capBb: 3 },
  { percent: 2, capBb: 2 },
  { percent: 2, capBb: 3 },
  { percent: 3, capBb: 3 },
  { percent: 5, capBb: 3 },
];

/**
 * One setting, over every seed, averaged.
 *
 * The per-seed drifts are kept and printed beside the mean: a setting whose
 * runs disagree about the SIGN has not been measured, it has been guessed at,
 * and the honest thing is to see that rather than to round it away.
 */
function runSetting(setting) {
  const runs = [];
  for (let i = 0; i < SEEDS; i++) {
    const started = Date.now();
    runs.push(run(setting, SEED + i * 7919));
    // A sweep is minutes per row. Printing as it goes is the difference between
    // a tool somebody re-runs and a tool somebody kills because it looks hung.
    if (flag('progress')) {
      const r = runs[runs.length - 1];
      process.stderr.write(
        `    ${String(r.percent).padStart(3)}% ${String(r.capBb).padStart(2)}bb  seed ${r.seed}  ` +
        `${r.hands} hands  drift ${pct(r.driftPct)}  raked ${n(r.rakeTaken)}  ` +
        `(${Math.round((Date.now() - started) / 1000)}s)
`);
    }
  }
  const mean = (pick) => runs.reduce((n, r) => n + pick(r), 0) / runs.length;
  return {
    ...runs[0],
    runs: runs.length,
    seeds: runs.map((r) => r.seed),
    drift: mean((r) => r.drift),
    driftPct: mean((r) => r.driftPct),
    driftEach: runs.map((r) => r.driftPct),
    rakeTaken: mean((r) => r.rakeTaken),
    hands: mean((r) => r.hands),
    sessions: mean((r) => r.sessions),
    busts: mean((r) => r.busts),
    houseSeats: mean((r) => r.houseSeats),
    bank: mean((r) => r.bank),
    // The two halves of the answer, per thousand hands, because that is the
    // rate a setting can be compared at and a total cannot.
    wonPerK: mean((r) => ((r.drift + r.rakeTaken) / r.hands) * 1_000),
    rakePerK: mean((r) => (r.rakeTaken / r.hands) * 1_000),
  };
}

const results = flag('sweep')
  ? SWEEP.map(runSetting)
  : [runSetting({
      percent: argv.includes('--percent') ? opt('percent', null) : null,
      capBb: argv.includes('--cap') ? opt('cap', null) : null,
    })];

if (flag('json')) {
  say(JSON.stringify({ hands: HANDS, owners: OWNERS, seed: SEED, results }, null, 2));
} else if (flag('sweep')) {
  say(`\n${HANDS} hands x ${SEEDS} seed(s), ${OWNERS} owners, ${RUNG.label}, sessions capped at ${SESSION_HANDS} hands`);
  say('won/1k is what owners took off the house per thousand hands BEFORE the rake;');
  say('raked/1k is what the house took back. A setting is flat when the two match.\n');
  say('  rake   cap     won/1k    raked/1k       drift   drift%   per-seed drift%');
  say('  ------------------------------------------------------------------------------');
  for (const r of results) {
    say(
      `  ${String(r.percent).padStart(3)}%  ${String(r.capBb).padStart(2)}bb  ` +
      `${n(r.wonPerK).padStart(9)}   ${n(r.rakePerK).padStart(9)}   ` +
      `${n(r.drift).padStart(9)}  ${pct(r.driftPct).padStart(7)}   ` +
      r.driftEach.map((d) => pct(d)).join(' '));
  }
  say('\nThe setting to want is the smallest one whose drift is near zero:');
  const flatest = [...results].sort((a, b) => Math.abs(a.driftPct) - Math.abs(b.driftPct))[0];
  say(`  ${flatest.percent}% capped at ${flatest.capBb}bb — drift ${pct(flatest.driftPct)}\n`);
} else {
  for (const r of results) printRun(r);
}
