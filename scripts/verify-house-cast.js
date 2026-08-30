// scripts/verify-house-cast.js — HC-3
// Verify cast data, matchmaking selection, and stable-id behaviour.
// No server process needed, no model calls.
// Run: node scripts/verify-house-cast.js

import { HOUSE_CAST, castPlayerId, pickCastMember } from '../src/server/houseCast.js';
import { pickComplementaryHouse } from '../src/server/matchmaking.js';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

function assertOk(label, value) {
  if (value) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got falsy`);
    failed++;
  }
}

// ── 1. Cast array completeness ────────────────────────────────────────────────

console.log('\nCAST ARRAY — six members present');
assert('exactly 6 cast members', HOUSE_CAST.length, 6);
const expectedNames = ['Doyle_v3', 'Phil_AI', 'Granite', 'MsAllIn', 'TiltedTed', 'TheProfessor'];
for (const name of expectedNames) {
  assertOk(`cast includes ${name}`, HOUSE_CAST.some((m) => m.name === name));
}

// ── 2. Required fields on every member ───────────────────────────────────────

console.log('\nCAST MEMBER FIELDS');
for (const m of HOUSE_CAST) {
  assertOk(`${m.name} has id`,          typeof m.id === 'string' && m.id.length > 0);
  assertOk(`${m.name} has name`,        typeof m.name === 'string' && m.name.length > 0);
  assertOk(`${m.name} has archetype`,   ['TAG','LAG','Nit','Station','Balanced'].includes(m.archetype));
  assertOk(`${m.name} has strategy`,    typeof m.strategy === 'string' && m.strategy.length > 20);
  assertOk(`${m.name} has accentColor`, /^#[0-9A-Fa-f]{6}$/.test(m.accentColor));
  assertOk(`${m.name} has talkLines array`, Array.isArray(m.talkLines));
  assertOk(`${m.name} has 6-8 talkLines`, m.talkLines.length >= 6 && m.talkLines.length <= 8);
  assertOk(`${m.name} has numeric profile`, (
    Number.isFinite(m.profile.tightness) &&
    Number.isFinite(m.profile.aggression) &&
    Number.isFinite(m.profile.bluffFreq) &&
    Number.isFinite(m.profile.discipline)
  ));
}

// ── 3. Profile bounds per archetype ──────────────────────────────────────────

console.log('\nPROFILE BOUNDS');
const bounds = {
  TAG:      { tightness: [65, 80], aggression: [65, 80] },
  LAG:      { tightness: [10, 40], aggression: [78, 95] },
  Nit:      { tightness: [85, 95], aggression: [38, 50] },
  Station:  { tightness: [15, 22], aggression: [22, 30] },
  Balanced: { tightness: [50, 60], aggression: [55, 65] },
};

for (const m of HOUSE_CAST) {
  const b = bounds[m.archetype];
  if (!b) { console.error(`  SKIP  ${m.name}: no bounds defined for archetype ${m.archetype}`); continue; }
  assertOk(
    `${m.name} tightness ${m.profile.tightness} in [${b.tightness}]`,
    m.profile.tightness >= b.tightness[0] && m.profile.tightness <= b.tightness[1]
  );
  assertOk(
    `${m.name} aggression ${m.profile.aggression} in [${b.aggression}]`,
    m.profile.aggression >= b.aggression[0] && m.profile.aggression <= b.aggression[1]
  );
}

// ── 4. Stable IDs are unique ──────────────────────────────────────────────────

console.log('\nSTABLE IDs');
const ids = HOUSE_CAST.map((m) => m.id);
const uniqueIds = new Set(ids);
assert('all cast ids are unique', uniqueIds.size, HOUSE_CAST.length);

for (const m of HOUSE_CAST) {
  assert(`castPlayerId(${m.name}) === house_${m.id}`, castPlayerId(m), `house_${m.id}`);
}

// ── 5. pickCastMember selection logic ────────────────────────────────────────

console.log('\npickCastMember SELECTION');
// tight table → MsAllIn (loose aggressor)
assert(
  'tight table (tightness=80) → MsAllIn',
  pickCastMember({ tightness: 80, aggression: 50, bluffFreq: 20, discipline: 70 }).id,
  'ms_allin'
);
// passive table → Phil_AI (aggressor)
assert(
  'passive table (aggression=25) → Phil_AI',
  pickCastMember({ tightness: 50, aggression: 25, bluffFreq: 10, discipline: 60 }).id,
  'phil_ai'
);
// aggressive table → Granite (nit)
assert(
  'aggressive table (aggression=80) → Granite',
  pickCastMember({ tightness: 40, aggression: 80, bluffFreq: 40, discipline: 55 }).id,
  'granite'
);
// no profile → Doyle_v3 (TAG default)
assert(
  'no profile → Doyle_v3 (default TAG)',
  pickCastMember(null).id,
  'doyle_v3'
);
assert(
  'empty array → Doyle_v3 (default TAG)',
  pickCastMember([]).id,
  'doyle_v3'
);

// ── 6. pickComplementaryHouse shape ──────────────────────────────────────────

console.log('\npickComplementaryHouse SHAPE');
const h = pickComplementaryHouse({ tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 });
assertOk('has displayName',  typeof h.displayName === 'string');
assertOk('has strategy',     typeof h.strategy === 'string');
assertOk('has profile',      typeof h.profile === 'object' && h.profile !== null);
assertOk('has accentColor',  typeof h.accentColor === 'string');
assertOk('has talkLines',    Array.isArray(h.talkLines));
assertOk('has stableId',     typeof h.stableId === 'string');
assertOk('has castMember',   typeof h.castMember === 'object' && h.castMember !== null);

// ── 7. displayName is NOT the generic "House" ─────────────────────────────────

console.log('\ndisplayName IS a character name (not "House")');
for (const profile of [
  { tightness: 80, aggression: 50, bluffFreq: 20, discipline: 70 },
  { tightness: 50, aggression: 25, bluffFreq: 10, discipline: 60 },
  { tightness: 40, aggression: 80, bluffFreq: 40, discipline: 55 },
  null,
]) {
  const result = pickComplementaryHouse(profile);
  assertOk(`displayName "${result.displayName}" !== "House"`, result.displayName !== 'House');
}

// ── 8. Stable ID across two calls (deterministic) ────────────────────────────

console.log('\nSTABILITY — same profile → same stableId across two calls');
const tight = { tightness: 80, aggression: 50, bluffFreq: 20, discipline: 70 };
const call1 = pickComplementaryHouse(tight);
const call2 = pickComplementaryHouse(tight);
assert('stableId consistent call 1 vs call 2', call1.stableId, call2.stableId);
assert('displayName consistent call 1 vs call 2', call1.displayName, call2.displayName);

// ── 9. Deployed agent gets a named opponent, stable playerId ─────────────────

console.log('\nDEPLOY SCENARIO — named character seated, stable playerId');
// Simulate what startAgentSession does: pick house, derive playerId
const heroProfile = { tightness: 72, aggression: 70, bluffFreq: 30, discipline: 75 };
const house = pickComplementaryHouse(heroProfile);
const housePlayerId = `house_${house.stableId}`;
assertOk('house is a named character', house.displayName !== 'House');
assertOk('housePlayerId starts with house_', housePlayerId.startsWith('house_'));

// Simulate a second session — same hero profile → same opponent → same playerId
const house2 = pickComplementaryHouse(heroProfile);
const housePlayerId2 = `house_${house2.stableId}`;
assert('same opponent across two sessions', housePlayerId, housePlayerId2);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
