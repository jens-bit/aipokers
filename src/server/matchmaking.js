// src/server/matchmaking.js — MST-2
//
// Where a deployed agent sits down.
//
// Before this, every deploy stood up a private table with a House opponent.
// That was the only shape available while tables seated exactly two, and it
// scattered the floor: N agents meant N heads-up tables, each one a separate
// model bill, none of them producing a real 6-max game.
//
// Now a deploy PREFERS an open AI-only table with a free seat, and only
// creates a fresh one when nothing qualifies. Which table it prefers is the
// same judgement pickComplementaryHouse made heads-up — put shapes together
// that generate action — generalised to N seats:
//
//   * loose play (low tightness) creates action, because hands get played
//   * aggression creates action, because pots get built
//   * CONTRAST creates action, because a station and a TAG produce a game
//     that two nits never will (the 2026-08-29 playtest: seven straight
//     uncontested preflop hands at a tight-vs-tight table)
//
// The score is deliberately a soft ranking with a low floor, not a gate. A
// table full of nits is still a better home for a new agent than yet another
// empty felt; the floor exists to skip the genuinely pathological case.

import { normalizeProfile } from '../agent/policy.js';
import { pickCastMember, pickCastMemberExcluding } from './houseCast.js';
import { roomForBigBlind } from './rooms.js';

// Neutral shape for a seat we know nothing about.
const NEUTRAL = { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };

// Below this projected action score a table is not worth joining and the
// deploy creates a fresh one instead.
export const JOIN_MIN_SCORE = Number(process.env.MATCHMAKING_MIN_SCORE ?? 25);

// ── AGENT-5 jobs E + F · TWO OF HIS MAY SIT TOGETHER, BUT NOT BY DEFAULT ────
//
// MATCH-2 paid a bonus to keep an owner's agents together. MATCH-1 reversed it
// into an outright REFUSAL, on the playtest reading that a stable of four
// sharing one felt is a man playing himself: the pots move chips from his left
// hand to his right, every read in the room is a read on somebody he already
// owns, and the one thing the casino is FOR — his character meeting somebody
// else's — never happens.
//
// JENS HAS OVERRULED THE REFUSAL (AGENT-5 job E). Two of his agents CAN sit at
// the same table. No collusion guard and no special-cased play: they are two
// players, and the engine has never known or cared who owns a seat.
//
// What survives is the OBSERVATION, which was always the better half of the
// argument, and it survives as a RANKING rather than as a wall (job F):
//
//   default        a table already seating one of his own ranks LAST, and
//                  deployAgent opens a fresh table in preference to it while
//                  the floor has room. So deploying four agents spreads them,
//                  which is the behaviour MATCH-1 was protecting.
//   together:true  the same tables rank FIRST — an explicit per-deploy ask, so
//                  "put these two in the same game" is one flag on the request
//                  rather than a setting somebody has to go and find.
//
// The difference from MATCH-1 is what happens on a floor with nowhere else to
// go: a refusal sent him home, a ranking seats him beside his stablemate. That
// is strictly the better of the two answers, and it is the one Jens asked for.
//
// The home game is still refused by name below — it is a different table with
// different rules (no pocket, no record, no room), not a crowded casino felt.

// A table with fewer hands than this left in its session cap would give a
// joiner a pointless few-hand stay, so it is skipped.
export const MIN_REMAINING_HANDS = Number(process.env.MATCHMAKING_MIN_HANDS ?? 10);

// ── House archetypes ────────────────────────────────────────────────────────
// Kept here rather than in table.js because they are matchmaking decisions:
// the House is the opponent we invent when the floor cannot supply one.

export const HOUSE_TAG = {
  strategy: 'You are a tight-aggressive heads-up player. You play premium hands aggressively, fold weak ones, and bluff occasionally at about 30% frequency. Mix up your play to stay unpredictable.',
  profile:  { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 75 },
  displayName: 'House',
};

export const HOUSE_STATION = {
  strategy: 'You are a loose call-heavy heads-up player. Call a wide range preflop with any two suited cards, connectors, or any pair. Postflop, call bets with any piece of the board. Rarely raise unless you have a strong made hand.',
  profile:  { tightness: 22, aggression: 30, bluffFreq: 10, discipline: 55 },
  displayName: 'House',
};

// Canonical text of the TAG House, kept for anything importing the old names.
export const HOUSE_STRATEGY = HOUSE_TAG.strategy;
export const HOUSE_PROFILE = HOUSE_TAG.profile;

// Pick the House cast member whose archetype best complements the agents already
// at the table. Returns a house descriptor with display-ready fields plus the
// stable id and full castMember reference for table plumbing.
export function pickComplementaryHouse(opposing, options = {}) {
  const member = pickCastMember(opposing, options);
  return {
    displayName: member.name,
    strategy:    member.strategy,
    profile:     member.profile,
    accentColor: member.accentColor,
    talkLines:   member.talkLines,
    stableId:    member.id,
    castMember:  member,
  };
}

// BUGS-B/1: the same descriptor for a table that is filling EMPTY seats rather
// than seating one opponent. `exclude` is the cast ids already sitting there.
// Returns null when the whole cast is at the felt already.
export function pickHouseRegular(opposing, exclude = [], options = {}) {
  const member = pickCastMemberExcluding(opposing, exclude, options);
  if (!member) return null;
  return {
    displayName: member.name,
    strategy:    member.strategy,
    profile:     member.profile,
    accentColor: member.accentColor,
    talkLines:   member.talkLines,
    stableId:    member.id,
    castMember:  member,
  };
}

// ── Action potential ────────────────────────────────────────────────────────

// 0..100. How much action a set of seat shapes is likely to produce.
// Weights: looseness dominates (nobody folding preflop is the failure mode we
// actually observed), aggression next, contrast last but never zero.
export function actionPotential(profiles) {
  const list = toProfileList(profiles);
  if (list.length < 2) return 0;
  const tightness = list.map((p) => p.tightness);
  const looseness = mean(tightness.map((t) => 100 - t));
  const aggression = mean(list.map((p) => p.aggression));
  const spread = Math.max(...tightness) - Math.min(...tightness);
  const contrast = (Math.min(spread, 60) / 60) * 100;
  return round1(0.45 * looseness + 0.30 * aggression + 0.25 * contrast);
}

// ── Table selection ─────────────────────────────────────────────────────────

/** True when one of `userId`'s agents already holds a seat at this table. */
export function seatsAgentOf(table, userId) {
  if (!table || userId == null || userId === '') return false;
  const owner = String(userId);
  return (table.agentUserIds ?? []).some((uid, seat) =>
    uid != null && String(uid) === owner && (table.agentIds ?? [])[seat] != null);
}

// Why a table cannot host this agent, or null when it can.
export function joinBlocker(table, { agentId, userId = null } = {}) {
  if (!table || table.closed) return 'closed';
  // HOME-STATE-1: a home game is somebody's living room. It is AI-only and
  // self-dealing, which is every other test a candidate has to pass, so it has
  // to be refused by name — a deploying agent must never be matched into a
  // table that pays nothing and is not on the floor.
  if (table.home) return 'home game';
  if (!table.hasFreeSeat?.()) return 'full';
  if (table.hasHumanPlayer?.()) return 'has a human seat';
  if (!(table.autoPlay || table.isAiOnly?.())) return 'not server-driven';
  if (table.seatedCount?.() < 1) return 'empty';
  if (agentId && (table.agentIds ?? []).includes(agentId)) return 'agent already seated';
  // AGENT-5 job E: MATCH-1's `if (seatsAgentOf(table, userId)) return ...` was
  // here. A stablemate is no longer a blocker at all — see the header.
  // pickTableToJoin ranks on it instead of refusing on it.
  const remaining = (table.maxHands ?? 0) - (table.handsThisSession ?? 0);
  if (remaining < MIN_REMAINING_HANDS) return `only ${remaining} hand(s) left in the session`;
  return null;
}

// Projected action score for `table` once this agent sits down.
export function scoreTableForJoin(table, joinerProfile) {
  const seated = [];
  for (let seat = 0; seat < (table.agentProfiles?.length ?? 0); seat++) {
    if (!table.pending?.[seat]) continue;
    seated.push(table.agentProfiles[seat] ?? NEUTRAL);
  }
  return actionPotential([...seated, joinerProfile ?? NEUTRAL]);
}

// The best open table for this agent, or null when it should get a fresh one.
// Ranked by projected action; ties go to the fuller table, so the floor
// concentrates into one lively felt instead of drifting into several quiet
// ones. `candidates` is any iterable of Tables.
//
// `room` is the room the deploy is FOR, as a room id from rooms.js, and it
// sorts ahead of everything else: a man who cannot have his first choice of
// table should find another one in the same room, not be sent up a floor
// because the game happens to look livelier there. It is a preference and not
// a filter — a seat in the wrong room still beats standing up an empty table
// nobody joins.
//
// AGENT-5 job F: `together` is the second key, directly under the room. False
// (the default) pushes a table already seating one of this owner's agents to
// the BOTTOM of the ranking; true pulls it to the top. It is never a filter
// either way — see the header for why a wall was the wrong shape.
//
// The returned entry carries `stablemate`, which is what lets deployAgent tell
// "the only table left" from "a table he would be sharing with his own man",
// and what the deploy response reports back to the owner.
export function pickTableToJoin(candidates, {
  profile = null, agentId = null, userId = null, room = null, together = false,
} = {}) {
  const joiner = profile ? normalizeProfile(profile) : NEUTRAL;
  const ranked = [];
  for (const table of candidates ?? []) {
    const blocker = joinBlocker(table, { agentId, userId });
    if (blocker) continue;
    const score = scoreTableForJoin(table, joiner);
    if (score < JOIN_MIN_SCORE) continue;
    ranked.push({
      table,
      score,
      seated: table.seatedCount(),
      sameRoom: room != null && roomForBigBlind(table.bigBlind)?.id === room ? 1 : 0,
      stablemate: seatsAgentOf(table, userId),
    });
  }
  if (ranked.length === 0) return null;
  const mate = (e) => (e.stablemate ? 1 : 0) * (together ? 1 : -1);
  ranked.sort((a, b) =>
    (b.sameRoom - a.sameRoom)
    || (mate(b) - mate(a))
    || (b.score - a.score)
    || (b.seated - a.seated));
  return ranked[0];
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toProfileList(input) {
  const raw = Array.isArray(input) ? input : [input];
  const out = [];
  for (const p of raw) {
    if (!p || !Number.isFinite(Number(p.tightness))) continue;
    out.push(normalizeProfile(p));
  }
  return out;
}

function mean(nums) {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
