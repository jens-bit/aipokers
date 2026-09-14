// scripts/measure-stamina.js — LIFE-1 follow-up 2
//
// `npm run stamina:measure` — the two numbers, and the question behind them.
//
// Jens's finding was "I've never seen an agent sleep once." The fix for that
// is not a mechanic, it is a RATE, and a rate you have not measured is a guess
// with a unit attached. So this simulates the actual household — the real
// HOME_MAX_HANDS, the real HOME_PAUSE_MS, the real cooldown, the real
// eligibility rule that drops a worn agent out of the game — against the real
// stamina functions, and reports:
//
//   (a) how many CASINO hands take a fresh agent from a full reserve to WORN
//   (b) how many HOURS take him from empty back to full
//   (c) what fraction of his life he is actually asleep, and therefore
//       whether an owner who opens the app twice a day will ever find one.
//
// (c) is the only one of the three that answers the finding. (a) and (b) are
// dials; (c) is the product.
//
// Deterministic, no model, no database, under a second. Nothing runs it
// automatically — it is a measuring instrument, not a gate — but it exits
// non-zero when the answer to (c) is no, so it can be run in anger.

import {
  STAMINA_MAX, WORN_AT, SETTLED_AT, RECOVER_PER_HOUR, HOME_HAND_WEIGHT,
  HAND_COST, handCost, staminaStage, spendStamina, staminaNow, storedStage, restStamina,
} from '../src/agent/stamina.js';
import {
  HOME_MAX_HANDS, HOME_PAUSE_MS, HOME_COOLDOWN_MS, HOME_PLAY_MS, HOME_SEATS,
} from '../src/server/homeGame.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const agent = (stamina) => ({ attrs: { STAMINA: stamina }, stamina: { left: STAMINA_MAX, at: 0, stage: 'fresh' } });

// ── (a) casino hands, full reserve to worn ──────────────────────────────────
//
// A casino seat plays continuously, so no recovery is credited while he is in
// it — `seatedSince` is the moment he sat down, which is before the first hand.
function casinoHandsToWorn(stamina) {
  const a = agent(stamina);
  let hands = 0;
  let now = 0;
  while (staminaStage(staminaNow(a, { now, resting: false }), storedStage(a)) !== 'worn') {
    hands++;
    now += 8000;                                   // HAND_PAUSE_MS, the watched default
    spendStamina(a, 1, { staminaAttr: stamina, now, seatedSince: 0 });
    if (hands > 10_000) break;
  }
  return hands;
}

// ── (b) hours, empty to full ────────────────────────────────────────────────
function hoursEmptyToFull() {
  const a = { stamina: { left: 0, at: 0, stage: 'worn' } };
  let h = 0;
  while (staminaNow(a, { now: h * HOUR, resting: true }) < STAMINA_MAX && h < 1000) h += 0.05;
  return h;
}

// ── (c) a household, living ─────────────────────────────────────────────────
//
// The real loop, as homeGame runs it: a game deals HOME_MAX_HANDS hands at
// HOME_PAUSE_MS apart (or runs out of HOME_PLAY_MS first), then the household
// takes HOME_COOLDOWN_MS off, then it goes again. An agent who reads 'worn' is
// dropped by `eligible`, and a game needs two bodies — so when the roster
// falls below two the whole household pauses until somebody wakes up.
function simulateHousehold({ agents: n = 2, stamina = 50, days = 14 } = {}) {
  const roster = [];
  for (let i = 0; i < n; i++) {
    const a = agent(stamina);
    // Stagger their reserves so a household is not one body four times — which
    // is what the room does anyway, and what makes "at least one is asleep" a
    // different question from "he is asleep".
    a.stamina.left = STAMINA_MAX - (i * STAMINA_MAX) / (2 * n);
    roster.push(a);
  }

  const handMs = HOME_PAUSE_MS;
  const gameMs = Math.min(HOME_MAX_HANDS * handMs, HOME_PLAY_MS);
  const handsPerGame = Math.min(HOME_MAX_HANDS, Math.floor(HOME_PLAY_MS / handMs));
  const step = 60_000;                              // sample the room once a minute
  const horizon = days * DAY;

  const stageOf = (a, now) => staminaStage(staminaNow(a, { now, resting: true }), storedStage(a));

  let now = 0;
  let nextGameAt = 0;
  let asleepSamples = 0;
  let anyAsleepSamples = 0;
  let samples = 0;
  let sleeps = 0;
  let sleepMs = 0;
  const asleepSince = new Array(n).fill(null);

  while (now < horizon) {
    // Deal a game if the household is off cooldown and has two awake bodies.
    if (now >= nextGameAt) {
      const awake = roster.filter((a) => stageOf(a, now) !== 'worn');
      if (awake.length >= 2) {
        const seated = awake.slice(0, HOME_SEATS);
        for (const a of seated) {
          spendStamina(a, handsPerGame, {
            staminaAttr: stamina, home: true,
            now: now + gameMs, seatedSince: now,
          });
        }
        nextGameAt = now + gameMs + HOME_COOLDOWN_MS;
      } else {
        nextGameAt = now + step;                    // nobody to play; look again shortly
      }
    }

    // presentAgent commits the reserve on every projection for an agent who is
    // not in a seat, and the room is projected many times a minute. The sim
    // does the same, because the COMMIT is what records that he fell asleep —
    // see the hysteresis note in stamina.js.
    roster.forEach((a) => { if (now >= nextGameAt - HOME_COOLDOWN_MS) restStamina(a, { now }); });
    roster.forEach((a, i) => {
      const worn = stageOf(a, now) === 'worn';
      if (worn && asleepSince[i] === null) { asleepSince[i] = now; sleeps++; }
      if (!worn && asleepSince[i] !== null) { sleepMs += now - asleepSince[i]; asleepSince[i] = null; }
      if (worn) asleepSamples++;
    });
    if (roster.some((a) => stageOf(a, now) === 'worn')) anyAsleepSamples++;
    samples++;
    now += step;
  }
  roster.forEach((_, i) => { if (asleepSince[i] !== null) sleepMs += horizon - asleepSince[i]; });

  const perAgent = asleepSamples / (samples * n);
  const anyone = anyAsleepSamples / samples;
  return {
    perAgent, anyone,
    meanSleepHours: sleeps ? sleepMs / sleeps / HOUR : 0,
    sleepsPerDay: sleeps / n / days,
  };
}

// ── Report ──────────────────────────────────────────────────────────────────

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const h1 = (v) => v.toFixed(1);

console.log('\nSTAMINA — the two numbers, and whether the feature lands.\n');
console.log(`dials: HAND_COST ${HAND_COST}/hand at STAMINA 50 · HOME_HAND_WEIGHT ${HOME_HAND_WEIGHT}`
  + ` · RECOVER_PER_HOUR ${RECOVER_PER_HOUR} · worn under ${WORN_AT}, rested at ${SETTLED_AT}`);
console.log(`home:  ${HOME_MAX_HANDS} hands a game, ${HOME_PAUSE_MS}ms a hand,`
  + ` ${HOME_COOLDOWN_MS / 60000}min off after\n`);

console.log('(a) CASINO HANDS, full reserve to worn');
for (const s of [0, 25, 50, 75, 100]) {
  console.log(`      STAMINA ${String(s).padStart(3)}   ${String(casinoHandsToWorn(s)).padStart(5)} hands`
    + `   (${handCost(s).toFixed(2)}/hand)`);
}
const neutralHands = casinoHandsToWorn(50);

console.log('\n(b) HOURS, empty reserve back to full');
const fullHours = hoursEmptyToFull();
console.log(`      ${h1(fullHours)} hours   (worn to rested: ${h1(SETTLED_AT / RECOVER_PER_HOUR)} hours)`);

console.log('\n(c) A HOUSEHOLD, LIVING — 14 days, sampled every minute');
console.log(`      ${'agents'.padEnd(8)}${'asleep'.padEnd(10)}${'someone asleep'.padEnd(17)}${'nap'.padEnd(9)}naps/day`);
let worst = null;
for (const n of [2, 3, 4]) {
  const r = simulateHousehold({ agents: n });
  if (worst === null || r.anyone < worst) worst = r.anyone;
  console.log(`      ${String(n).padEnd(8)}${pct(r.perAgent).padEnd(10)}${pct(r.anyone).padEnd(17)}`
    + `${(h1(r.meanSleepHours) + 'h').padEnd(9)}${r.sleepsPerDay.toFixed(1)}`);
}

// The question, answered rather than implied. Two openings a day, independent,
// against the chance that at least one agent in the room is asleep.
const perOpening = worst;
const perDay = 1 - (1 - perOpening) ** 2;
const perWeek = 1 - (1 - perDay) ** 7;
console.log('\nWILL AN OWNER WHO OPENS THE APP TWICE A DAY EVER FIND AN AGENT ASLEEP?');
console.log(`      ${pct(perOpening)} of openings · ${pct(perDay)} of days · ${pct(perWeek)} within a week`);
const ok = perDay >= 0.5 && perWeek >= 0.95;
console.log(`\n      ${ok ? 'YES.' : 'NO — the dials are wrong and this job has not landed.'}\n`);

console.log(`summary: (a) ${neutralHands} casino hands to worn at STAMINA 50 · (b) ${h1(fullHours)} hours empty to full\n`);
process.exit(ok ? 0 : 1);
