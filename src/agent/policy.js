// src/agent/policy.js
// The policy compiler. Turns a numeric personality profile into per-decision
// directives (range verdict, server-rolled dice, sizing hints) that the
// server hands to the LLM as advisory scaffolding.
//
// The point: an LLM can't randomize a bluff frequency and can't reliably
// stay inside a preflop range. The server does both, and the model chooses
// within/around the scaffold, weighted by its own discipline value.
//
// Profile shape: { tightness, aggression, bluffFreq, discipline } each 0-100.

const RANKS = '23456789TJQKA';
const TOTAL_COMBOS = 1326;

// ── Chen formula (coarse but usable preflop hand strength) ──────────────────

function chenBaseValue(r) {
  // r is rank value 2..14 (14 = Ace)
  if (r === 14) return 10;
  if (r === 13) return 8;
  if (r === 12) return 7;
  if (r === 11) return 6;
  return r / 2;
}

function chenScore(highR, lowR, suited, pair) {
  if (pair) return Math.max(chenBaseValue(highR) * 2, 5);
  let score = chenBaseValue(highR);
  if (suited) score += 2;
  const gap = highR - lowR - 1;
  if (gap === 0) { /* connectors: no penalty */ }
  else if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else score -= 5;
  // Small straight bonus for both cards under Q with a small gap.
  if (highR < 12 && gap >= 0 && gap <= 2) score += 1;
  return score;
}

// Precomputed 169-hand table with cumulative combo percentiles.
// Once, at module load: rank every canonical hand type by Chen score, then
// assign each hand a `percentileTop` = fraction of combos strictly stronger.
const HAND_TABLE = (() => {
  const entries = [];
  for (let hi = 12; hi >= 0; hi--) {
    for (let lo = 12; lo >= 0; lo--) {
      const highR = hi + 2, lowR = lo + 2;
      if (hi === lo) {
        entries.push({ code: `${RANKS[hi]}${RANKS[lo]}`, combos: 6,  chen: chenScore(highR, lowR, false, true) });
      } else if (hi > lo) {
        entries.push({ code: `${RANKS[hi]}${RANKS[lo]}s`, combos: 4,  chen: chenScore(highR, lowR, true,  false) });
      } else {
        // We only want each pair of ranks once; the offsuit form is defined
        // by (higher, lower). Skip the mirrored index.
        // Handle it under (lo,hi) once by iterating below.
      }
    }
  }
  // Add offsuit (each rank pair once).
  for (let hi = 12; hi >= 1; hi--) {
    for (let lo = hi - 1; lo >= 0; lo--) {
      const highR = hi + 2, lowR = lo + 2;
      entries.push({ code: `${RANKS[hi]}${RANKS[lo]}o`, combos: 12, chen: chenScore(highR, lowR, false, false) });
    }
  }
  // Sanity: total combos should equal 1326.
  const totalCombos = entries.reduce((s, e) => s + e.combos, 0);
  if (totalCombos !== TOTAL_COMBOS) {
    throw new Error(`policy HAND_TABLE combo total ${totalCombos} != 1326`);
  }
  // Sort by strength desc, with stable tiebreak by high rank then low rank.
  entries.sort((a, b) => {
    if (b.chen !== a.chen) return b.chen - a.chen;
    const rankTie = (x) => RANKS.indexOf(x.code[0]) * 100 + RANKS.indexOf(x.code[1]);
    return rankTie(b) - rankTie(a);
  });
  const map = new Map();
  let cum = 0;
  for (const e of entries) {
    const start = cum;
    cum += e.combos;
    map.set(e.code, {
      code: e.code,
      combos: e.combos,
      chen: e.chen,
      percentileTop: (start / TOTAL_COMBOS) * 100,
      percentileMid: ((start + e.combos / 2) / TOTAL_COMBOS) * 100,
    });
  }
  return { map, entries };
})();

// Map two hole cards (['As','Kh']) into the canonical 169-hand code (e.g. 'AKo').
export function handCode(holeCards) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return null;
  const [c1, c2] = holeCards;
  if (typeof c1 !== 'string' || typeof c2 !== 'string' || c1.length !== 2 || c2.length !== 2) return null;
  const v1 = RANKS.indexOf(c1[0]);
  const v2 = RANKS.indexOf(c2[0]);
  if (v1 < 0 || v2 < 0) return null;
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  if (v1 === v2) return `${RANKS[hi]}${RANKS[lo]}`;
  const suited = c1[1] === c2[1];
  return `${RANKS[hi]}${RANKS[lo]}${suited ? 's' : 'o'}`;
}

// ── Profile normalization + style/risk fallback inference ────────────────────

function clamp01_100(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export function normalizeProfile(profile) {
  return {
    tightness:  clamp01_100(profile?.tightness),
    aggression: clamp01_100(profile?.aggression),
    bluffFreq:  clamp01_100(profile?.bluffFreq),
    discipline: clamp01_100(profile?.discipline),
  };
}

// Best-effort profile when the agent only carries the legacy style/risk fields.
// Nudges around the neutral 50 based on a few keyword mappings.
export function inferProfileFromStyleRisk(style, risk) {
  let tightness = 55, aggression = 55, bluffFreq = 25, discipline = 60;
  const s = String(style || '').toLowerCase();
  const r = String(risk || '').toLowerCase();
  if (s.includes('tight'))       { tightness = 75; aggression = 55; bluffFreq = 15; }
  if (s.includes('aggressive'))  { tightness = 30; aggression = 85; bluffFreq = 45; discipline = 45; }
  if (s.includes('balanced'))    { tightness = 55; aggression = 60; bluffFreq = 25; discipline = 65; }
  if (r === 'low')  { discipline += 15; bluffFreq = Math.max(0, bluffFreq - 10); }
  if (r === 'high') { discipline -= 15; bluffFreq += 15; aggression += 5; }
  return normalizeProfile({ tightness, aggression, bluffFreq, discipline });
}

// ── Range verdict ────────────────────────────────────────────────────────────
// Given a hand + position + profile, report whether the hand is inside the
// profile's opening/calling range. targetVpip is the percent of all combos
// the profile is willing to play. In-position hands get a small bonus.

function targetVpipFor(profile, position) {
  const t = profile.tightness;
  // Linear map: t=0 → 78% VPIP, t=100 → 8% VPIP.
  let vpip = 78 - 0.70 * t;
  // Heads-up positional bump: BTN/SB opens wider than BB defends.
  if (position === 'BTN' || position === 'BTN/SB') vpip += 4;
  else if (position === 'BB') vpip -= 2;
  return Math.max(6, Math.min(85, vpip));
}

export function rangeVerdict(holeCards, position, profile) {
  const p = normalizeProfile(profile);
  const targetVpip = targetVpipFor(p, position);
  const code = handCode(holeCards);
  const entry = code ? HAND_TABLE.map.get(code) : null;
  if (!entry) {
    return {
      inRange: false,
      percentile: 100,
      targetVpip: Number(targetVpip.toFixed(1)),
      code: code ?? null,
    };
  }
  // A hand is in range if its position (by cumulative combo count) is inside
  // the top targetVpip%. Compare `percentileTop` (fraction strictly stronger)
  // against targetVpip: if some combos of this hand fall within the top X%,
  // the whole hand counts as inside.
  const inRange = entry.percentileTop < targetVpip;
  return {
    inRange,
    percentile: Number(entry.percentileMid.toFixed(1)),
    targetVpip: Number(targetVpip.toFixed(1)),
    code: entry.code,
  };
}

// ── Server-rolled dice ───────────────────────────────────────────────────────
// The LLM cannot randomize. The server rolls the dice from the profile and
// states the outcome as fact.

export function rollDice(profile, rand = Math.random) {
  const p = normalizeProfile(profile);
  const bluffDie     = rand() * 100 < p.bluffFreq;
  // deviationDie = 1 means "you may deviate from the briefing this decision".
  // Frequency = 100 - discipline (a highly disciplined agent almost never deviates).
  const deviationDie = rand() * 100 < (100 - p.discipline);
  return { bluffDie, deviationDie };
}

// ── Sizing directives ────────────────────────────────────────────────────────

export function sizingDirectives(profile) {
  const p = normalizeProfile(profile);
  const openBB       = p.aggression >= 70 ? 3.5 : p.aggression >= 40 ? 3.0 : 2.5;
  const cbetFraction = p.aggression >= 70 ? 0.75 : p.aggression >= 40 ? 0.55 : 0.35;
  const valueGuidance = p.aggression >= 60
    ? 'vs a player who folds <10%, value bet thin and often — do not check back made hands'
    : p.aggression >= 30
      ? 'value bet strong hands for two streets; give up on the river without a plan'
      : 'pot control with medium strength; only get chips in with the goods';
  const text = `open ~${openBB.toFixed(1)}bb; c-bet ~${Math.round(cbetFraction * 100)}% pot; ${valueGuidance}`;
  return {
    openBB,
    cbetFraction,
    valueGuidance,
    text,
  };
}

// ── Full per-decision compilation ────────────────────────────────────────────
// Bundles profile normalization + range verdict + dice roll + sizing text
// into a single object handed to the briefing builder.

export function compilePolicy(profile, { holeCards = null, position = null, rand = Math.random } = {}) {
  const p = normalizeProfile(profile);
  const dice = rollDice(p, rand);
  const sizing = sizingDirectives(p);
  const range = (holeCards && position) ? rangeVerdict(holeCards, position, p) : null;
  return { profile: p, dice, sizing, range };
}
