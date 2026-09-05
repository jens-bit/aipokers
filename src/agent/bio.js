// src/agent/bio.js — BIO-2
//
// The biography layer: nemesis, rival, favourite victim.
//
// Ported from design-refs/char-bio.jsx. It is deliberately the LIGHTEST system
// on the board — narrative, not numbers. It is his story with other players,
// and a story does not need a stat.
//
// THE LAW, from the ref's own sheet, and the reason this file exports nothing
// that returns a modifier:
//
//   1. It changes VOICE. He names the opponent, before the hand and after it.
//      That is the whole point of the layer.
//   2. It changes TABLE TALK — the line the strip shows when they are seated
//      together ("Granite again.").
//   3. It may trigger a MOOD EVENT. Mood is already state, already temporary,
//      already visible, already bounded.
//   4. IT NEVER TOUCHES AN ATTRIBUTE, A POTENTIAL BAND, OR FATIGUE. No Reads
//      bonus versus a rival, no Composure penalty versus a nemesis, no hidden
//      modifier of any kind.
//   5. IT NEVER TOUCHES STRATEGY. He does not tighten up against Granite
//      unless he proposes it and the owner accepts.
//   6. It is DERIVED and therefore reversible. Beat Granite for three sessions
//      and the row changes, or leaves.
//
// A nemesis modifier would be invisible, unverifiable, and a licence to explain
// every bad session away. Kept to voice, the same fact becomes the best thing in
// the product: he remembers, he tells you, and you can go and read the hands he
// means.
//
// Pure and side-effect free. Nothing here reads a clock or a store.

// ── Roles ───────────────────────────────────────────────────────────────────
// The ref's three rules, verbatim: nemesis = worst net, min 30 hands; rival =
// most hands against; victim = best net, min 30 hands.
export const ROLES = Object.freeze(['nemesis', 'rival', 'victim']);

// Below this, there is no relationship — just a few hands with a stranger. A
// grudge earned over four hands is a mood, not a biography.
export const ROLE_MIN_HANDS = 30;

// A rival is the one he is most evenly matched with. "Evenly" has to mean
// something: a net inside this many chips per hand played is close enough that
// neither of them is winning.
export const RIVAL_CLOSE_PER_HAND = 4;

// How many opponents a ledger keeps. Compression, exactly like the opponent
// memory: the least-played are dropped first, because a relationship is made
// of hands and the thinnest ones were never going to become one.
export const LEDGER_CAP = 20;

// ── The ledger ──────────────────────────────────────────────────────────────

export function newLedgerEntry(playerId, displayName = null) {
  return {
    playerId,
    displayName: displayName ?? playerId,
    hands: 0,
    net: 0,                 // chips, from HIS side
    coolersDealt: 0,        // he had it, they had second best
    coolersTaken: 0,        // the other way round
    biggestPotWon: 0,
    biggestPotLost: 0,
    bluffsCaught: 0,        // his bluff was called and shown down
    showdowns: 0,
    lastSeenHand: 0,
  };
}

export function ensureBio(agent) {
  if (!agent || typeof agent !== 'object') return agent;
  if (!agent.bioLedger || typeof agent.bioLedger !== 'object') agent.bioLedger = {};
  if (!agent.bio || typeof agent.bio !== 'object') agent.bio = { nemesis: null, rival: null, victim: null };
  return agent;
}

/**
 * One hand against one opponent, from his side.
 *
 * `net` is his chip change across the hand — the only figure the whole layer
 * is built on, and the only one an owner can check against the hand history.
 */
export function recordLedgerHand(ledger, {
  playerId,
  displayName = null,
  net = 0,
  pot = 0,
  won = false,
  cooler = false,
  bluffCaught = false,
  showdown = false,
  handNumber = 0,
} = {}) {
  if (!ledger || !playerId) return ledger;
  const e = ledger[playerId] ?? newLedgerEntry(playerId, displayName);
  if (displayName) e.displayName = displayName;

  e.hands += 1;
  e.net += Number.isFinite(net) ? Math.round(net) : 0;
  const potChips = Number.isFinite(pot) ? Math.round(pot) : 0;
  if (won) e.biggestPotWon = Math.max(e.biggestPotWon, potChips);
  else if (potChips > 0) e.biggestPotLost = Math.max(e.biggestPotLost, potChips);
  if (cooler) {
    if (won) e.coolersDealt += 1;
    else e.coolersTaken += 1;
  }
  if (bluffCaught) e.bluffsCaught += 1;
  if (showdown) e.showdowns += 1;
  if (Number.isFinite(handNumber)) e.lastSeenHand = Math.max(e.lastSeenHand, handNumber);

  ledger[playerId] = e;
  return compressLedger(ledger, LEDGER_CAP, { protect: playerId });
}

/**
 * Keep the LEDGER_CAP most-played opponents. Thin ones were never a story.
 *
 * `protect` is the opponent he is playing RIGHT NOW, and it is not optional in
 * practice: without it a new face at a full table is evicted on his first hand,
 * every hand, and can never accumulate the history that would keep him.
 */
export function compressLedger(ledger, cap = LEDGER_CAP, { protect = null } = {}) {
  const keys = Object.keys(ledger ?? {});
  if (keys.length <= cap) return ledger;
  const ranked = keys.map((k) => ledger[k])
    .filter((e) => e.playerId !== protect)
    .sort((a, b) => (b.hands - a.hands) || (b.lastSeenHand - a.lastSeenHand));
  const keep = new Set(ranked.slice(0, protect ? cap - 1 : cap).map((e) => e.playerId));
  if (protect) keep.add(protect);
  for (const k of keys) if (!keep.has(k)) delete ledger[k];
  return ledger;
}

// ── Derivation ──────────────────────────────────────────────────────────────
// Three roles, one query each, recomputed from scratch every time. Nothing is
// remembered about a role, which is what makes law 6 true for free: beat him
// for three sessions and the row changes, or leaves.

/**
 * @returns {{ nemesis, rival, victim }} — each null or
 *   { playerId, displayName, hands, net, evidence, opinion }
 */
export function deriveRoles(ledger, { minHands = ROLE_MIN_HANDS } = {}) {
  const all = Object.values(ledger ?? {}).filter((e) => e && e.hands >= minHands);
  const out = { nemesis: null, rival: null, victim: null };
  if (all.length === 0) return out;

  // RIVAL FIRST. Evenness is the defining fact of a rivalry, and it is a
  // stronger claim than "best net" on a player nobody is actually beating —
  // the ref's own example has a +$60 regular over 388 hands as the rival while
  // a +$880 opponent over 96 is the victim. Deciding the extremes first would
  // have made that +$60 the favourite victim, which is not what the word means.
  //
  // Close = inside RIVAL_CLOSE_PER_HAND chips per hand played, so the bar
  // scales: +200 over 40 hands is a beating, over 400 hands it is noise.
  const even = all
    .filter((e) => Math.abs(e.net) <= RIVAL_CLOSE_PER_HAND * e.hands)
    .sort((a, b) => (b.hands - a.hands) || (Math.abs(a.net) - Math.abs(b.net)));
  if (even.length > 0) out.rival = describe('rival', even[0]);

  // A player cannot be two things at once.
  const rest = all.filter((e) => e.playerId !== out.rival?.playerId);

  // NEMESIS — worst net. He has to actually be down to him: a relationship
  // built on winning is not a grudge.
  const losses = rest.filter((e) => e.net < 0).sort((a, b) => a.net - b.net);
  if (losses.length > 0) out.nemesis = describe('nemesis', losses[0]);

  // VICTIM — best net, the same test the other way up.
  const wins = rest.filter((e) => e.net > 0).sort((a, b) => b.net - a.net);
  if (wins.length > 0) out.victim = describe('victim', wins[0]);

  return out;
}

function describe(role, e) {
  return {
    playerId: e.playerId,
    displayName: e.displayName,
    hands: e.hands,
    net: e.net,
    evidence: evidenceFor(role, e),
    opinion: opinionFor(role, e),
  };
}

// The one fact the role is built on, in the ref's own register: a mono caption
// under the name, all caps, no sentence.
function evidenceFor(role, e) {
  const hands = `${e.hands} HANDS`;
  if (role === 'nemesis') {
    if (e.coolersTaken > 0) return `${e.coolersTaken} COOLER${e.coolersTaken === 1 ? '' : 'S'} FROM HIM · ${hands}`;
    return `WORST NET AGAINST · ${hands}`;
  }
  if (role === 'victim') return `BEST NET AGAINST · ${hands}`;
  return `MOST HANDS AGAINST ANYONE · ${hands}`;
}

// His opinion, in his own words, with the figure attached. This is the layer:
// not a badge, a sentence he would say out loud.
function opinionFor(role, e) {
  const who = e.displayName;
  const chips = Math.abs(e.net).toLocaleString('en-US');
  if (role === 'nemesis') {
    if (e.coolersTaken >= 2) {
      return `${who} has coolered me ${e.coolersTaken} times now. ${chips} chips gone. I keep paying anyway.`;
    }
    return `I have decided I do not like ${who}. He is up ${chips} on me and I keep coming back.`;
  }
  if (role === 'victim') {
    return `${who} has given me ${chips} across ${e.hands} hands. I am not going to stop.`;
  }
  return `${who} and I are even after ${e.hands} hands. Neither of us is pleased about it.`;
}

/** The role this opponent holds for him right now, or null. */
export function roleOf(bio, playerId) {
  if (!bio || !playerId) return null;
  for (const role of ROLES) {
    if (bio[role]?.playerId === playerId) return role;
  }
  return null;
}

// ── The recap line ──────────────────────────────────────────────────────────
// Law 1, at the end of a session: he names the opponent when the opponent was
// actually there. Never otherwise — a grudge recited to an empty room is a
// stat, and the whole point is that it is a memory.
export function recapMention(bio, seatedPlayerIds = []) {
  const seated = new Set(seatedPlayerIds.filter(Boolean));
  for (const role of ROLES) {
    const rel = bio?.[role];
    if (!rel || !seated.has(rel.playerId)) continue;
    if (role === 'nemesis') return `${rel.displayName} again. He owes me a cooler.`;
    if (role === 'victim')  return `${rel.displayName} was there again. Good.`;
    return `${rel.displayName} again. Still nothing between us.`;
  }
  return null;
}
