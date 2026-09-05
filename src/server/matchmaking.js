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
import { pickCastMember } from './houseCast.js';

// Neutral shape for a seat we know nothing about.
const NEUTRAL = { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };

// Below this projected action score a table is not worth joining and the
// deploy creates a fresh one instead.
export const JOIN_MIN_SCORE = Number(process.env.MATCHMAKING_MIN_SCORE ?? 25);

// Bonus applied when a deploying agent is joining a table that already holds
// one of their own agents (same userId). Keeps owner agents together and
// skips the JOIN_MIN_SCORE gate so a same-owner join always beats a fresh table.
export const SAME_OWNER_SCORE_BONUS = 50;

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
export function pickComplementaryHouse(opposing) {
  const member = pickCastMember(opposing);
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

// Why a table cannot host this agent, or null when it can.
export function joinBlocker(table, { agentId } = {}) {
  if (!table || table.closed) return 'closed';
  if (!table.hasFreeSeat?.()) return 'full';
  if (table.hasHumanPlayer?.()) return 'has a human seat';
  if (!(table.autoPlay || table.isAiOnly?.())) return 'not server-driven';
  if (table.seatedCount?.() < 1) return 'empty';
  if (agentId && (table.agentIds ?? []).includes(agentId)) return 'agent already seated';
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
// MATCH-2: when `userId` is supplied, tables that already hold one of the
// owner's agents get SAME_OWNER_SCORE_BONUS added and bypass JOIN_MIN_SCORE
// entirely — any open own-table with a free seat beats creating a fresh table.
export function pickTableToJoin(candidates, { profile = null, agentId = null, userId = null } = {}) {
  const joiner = profile ? normalizeProfile(profile) : NEUTRAL;
  const ranked = [];
  for (const table of candidates ?? []) {
    const blocker = joinBlocker(table, { agentId });
    if (blocker) continue;
    const isOwnTable = !!userId &&
      (table.agentUserIds ?? []).some((uid) => uid != null && uid === userId);
    const base = scoreTableForJoin(table, joiner);
    const score = isOwnTable ? base + SAME_OWNER_SCORE_BONUS : base;
    if (!isOwnTable && score < JOIN_MIN_SCORE) continue;
    ranked.push({ table, score, seated: table.seatedCount() });
  }
  if (ranked.length === 0) return null;
  ranked.sort((a, b) => (b.score - a.score) || (b.seated - a.seated));
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
