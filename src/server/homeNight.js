// src/server/homeNight.js — HOME-STATE-1
//
// "While you were out."
//
// Two of your agents spent the evening in the same flat. Once a day, if that
// actually happened for long enough to be worth reporting, they get two or
// three lines to each other — in their own voices, about their own week — and
// you read it the next time you open the app.
//
// This is the one part of the home that costs money, so it is the one part
// with a hard cap around it. THE CAP IS THE FEATURE: an exchange you get every
// day is a diary, and an exchange you get every twenty minutes is spam with a
// bill attached.
//
//   * ONE MODEL CALL PER OWNER PER DAY. Not per agent, not per pair. The day
//     is stamped BEFORE the call goes out, so a call that fails or times out
//     costs the day rather than retrying into a bill.
//   * NOTHING WITHOUT EVIDENCE. Two agents must have been home together for
//     TOGETHER_MIN_MS. A household where everybody was out all evening gets
//     nothing and spends nothing — the skip is the common case and it has to
//     be free, so it is one map lookup.
//   * NO KEY, NO CALL. Without ANTHROPIC_API_KEY this returns null having
//     done nothing, which is also what makes it safe in the automated suites
//     (the runner strips the key from every child).
//
// "Nightly" is implemented as ONCE PER DAY, fired the moment the day's
// evidence exists, rather than pinned to a wall-clock hour. The server has no
// idea what time it is where the owner lives; an exchange that arrives at 3am
// their time because it was 9pm in Helsinki is not "nightly", it is a lottery.
// Once a day, at the first moment it is earned, is the honest reading.
//
// The lines are stored as THREAD lines with source 'home' (see thread.js), so
// they read back through the route the felt's thread already uses. Kind is
// `him` for both speakers, which makes the exchange owner-private — it is a
// conversation in his house, and it is filed under whichever agent said each
// line, so each of them owns his own words.

import Anthropic from '@anthropic-ai/sdk';
import { appendLine, ThreadKind, ThreadSource } from './thread.js';
import { Where } from './home.js';
import { capWords, isSolverSpeak } from '../agent/voice.js';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

// Long enough that they were actually in together rather than passing on the
// stairs. Half an hour is the brief's number.
export const TOGETHER_MIN_MS = Number(process.env.HOME_TOGETHER_MIN_MS ?? 30 * 60_000);

// The most time one observation may credit a pair with. Observations arrive on
// agent changes and on homeGame's tick — seconds apart in a live process, but
// a laptop that slept for six hours would otherwise wake up and credit six
// hours of togetherness to a flat nobody was in. The clamp makes the counter
// an approximation that can only ever UNDER-count, which is the right
// direction for something that unlocks a spend.
export const MAX_CREDIT_MS = Number(process.env.HOME_TOGETHER_STEP_MS ?? 90_000);

// Two or three lines. Never one (that is a caption, not an exchange) and never
// four (nobody reads the fourth).
export const MIN_LINES = 2;
export const MAX_LINES = 3;

// ownerId -> { day, ranOn, lastNote, pairs: Map<pairKey, ms> }
const households = new Map();

/** The day a timestamp belongs to, UTC. One string, comparable, no library. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function householdFor(ownerId, now) {
  const day = dayKey(now);
  const existing = households.get(ownerId);
  // A new day wipes the evidence AND the spend stamp. Yesterday's half hour
  // does not pay for today's exchange.
  if (existing && existing.day === day) return existing;
  const fresh = { day, ranOn: null, lastNote: now, pairs: new Map() };
  households.set(ownerId, fresh);
  return fresh;
}

/**
 * Observe the household. Called wherever the home state is recomputed, which
 * is often, so it does no work beyond arithmetic over the pairs that are
 * actually home.
 *
 * @param {string} ownerId
 * @param {Array}  agents  presented agents (id, name, location)
 * @returns the pair that has been in together longest today, or null
 */
export function noteHousehold(ownerId, agents, { now = Date.now() } = {}) {
  if (!ownerId) return null;
  const owner = String(ownerId);
  const household = householdFor(owner, now);

  const home = (agents ?? [])
    .filter((a) => a?.id && a.location?.where === Where.HOME)
    .map((a) => ({ id: String(a.id), name: a.name || String(a.id) }));

  const elapsed = Math.min(Math.max(0, now - household.lastNote), MAX_CREDIT_MS);
  household.lastNote = now;

  // Every pair that is in together right now gets credited, rather than only
  // the set as a whole: a third agent coming home must not reset the clock on
  // the two who have been sitting there all evening.
  for (let i = 0; i < home.length; i++) {
    for (let j = i + 1; j < home.length; j++) {
      const key = pairKey(home[i].id, home[j].id);
      const prev = household.pairs.get(key) ?? { a: home[i], b: home[j], ms: 0 };
      household.pairs.set(key, { a: home[i], b: home[j], ms: prev.ms + elapsed });
    }
  }
  return longestPair(owner, { now });
}

/** The pair that has spent longest at home together today, or null. */
export function longestPair(ownerId, { now = Date.now() } = {}) {
  const household = households.get(String(ownerId));
  if (!household || household.day !== dayKey(now)) return null;
  let best = null;
  for (const entry of household.pairs.values()) {
    if (!best || entry.ms > best.ms) best = entry;
  }
  return best ?? null;
}

/** Has this owner already had today's exchange? */
export function ranToday(ownerId, { now = Date.now() } = {}) {
  const household = households.get(String(ownerId));
  return !!household && household.day === dayKey(now) && household.ranOn === household.day;
}

/**
 * Run the day's exchange if it has been earned.
 *
 * Returns { lines, pair, sessionId } when one was written, or null — including
 * for every skip, which is the overwhelmingly common answer. The caller never
 * has to know which of the four reasons it was.
 */
export async function maybeRunNightly(ownerId, agents, { now = Date.now(), call = callModel } = {}) {
  if (!ownerId) return null;
  const owner = String(ownerId);
  const household = householdFor(owner, now);
  if (household.ranOn === household.day) return null;

  const pair = longestPair(owner, { now });
  if (!pair || pair.ms < TOGETHER_MIN_MS) return null;

  // Stamped BEFORE the call. A failed call costs the day; a failed call that
  // left the day open would retry on the next observation, which on a busy
  // household is every few seconds.
  household.ranOn = household.day;

  const roster = new Map((agents ?? []).map((a) => [String(a.id), a]));
  const a = roster.get(pair.a.id);
  const b = roster.get(pair.b.id);
  if (!a || !b) return null;

  let raw = null;
  try {
    raw = await call(buildPrompt(a, b, pair));
  } catch (err) {
    console.error('[home-night] model call failed:', err.message);
    return null;
  }
  const lines = parseExchange(raw, [a, b]);
  if (lines.length < MIN_LINES) return null;

  const sessionId = homeSessionId(owner, household.day);
  for (const line of lines) {
    appendLine({
      sessionId,
      agentId: line.agentId,
      ownerId: owner,
      tableId: null,
      kind: ThreadKind.HIM,
      who: line.name,
      text: line.text,
      source: ThreadSource.HOME,
    });
  }
  console.log(`[home-night] ${owner}: ${a.name} and ${b.name} talked (${lines.length} lines, ${Math.round(pair.ms / 60_000)} min in)`);
  return { lines, pair, sessionId };
}

/**
 * The synthetic session the exchange is filed under. One per owner per day, so
 * it is stable, readable back through GET /api/agents/:id/thread?session=, and
 * cannot collide with a table's session id (those are minted by sessions.js).
 */
export function homeSessionId(ownerId, day = dayKey()) {
  return `home-${String(ownerId)}-${day}`;
}

// ── The prompt ──────────────────────────────────────────────────────────────
//
// Deliberately thin. It is handed two characters and told to let them talk;
// everything that makes them distinguishable is already in the nature line and
// the mood, and a longer prompt buys length rather than voice.

export function buildPrompt(a, b, pair) {
  const who = (x) => [
    `${x.name}`,
    x.nature?.name ? `a ${x.nature.name}` : null,
    x.mood?.state ? `currently ${x.mood.state}` : null,
    x.sessionRecap?.text ? `last session: ${x.sessionRecap.text}` : null,
  ].filter(Boolean).join(', ');

  const hours = Math.max(1, Math.round(pair.ms / 3_600_000));
  return {
    system:
      'Two poker players share a flat. They have been in all evening with nothing to do. ' +
      'Write a short exchange between them — 2 or 3 lines total, alternating, starting with the first player. ' +
      'One line each per turn, under twelve words. Plain spoken English, in character, dry. ' +
      'They are talking to each other, not to a camera. ' +
      'NEVER use poker jargon, statistics, percentages, or strategy terms of any kind. ' +
      'Output the lines only, one per line, with no names, no quotes and no numbering.',
    user:
      `First player: ${who(a)}.\n` +
      `Second player: ${who(b)}.\n` +
      `They have been home together about ${hours} hour(s).`,
  };
}

async function callModel({ system, user }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;   // no key, no call — and no bill
  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 160,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }, { signal: controller.signal });
    return res.content[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Split what the model returned into alternating, attributed lines.
 *
 * Everything voice.js rejects is rejected here too, for the same reason and by
 * the same rules: a line that reads as solver output is not a character
 * talking. A rejected line is DROPPED rather than replaced with a template —
 * there is no fallback for a conversation, and two good lines are a better
 * exchange than three with a canned one in the middle.
 */
export function parseExchange(raw, speakers) {
  if (typeof raw !== 'string') return [];
  const out = [];
  const candidates = raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    // A model that ignored "no names" prefixes each line with one.
    .map((l) => l.replace(/^[A-Z][A-Za-z' ]{0,20}:\s*/, '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (out.length >= MAX_LINES) break;
    if (isSolverSpeak(candidate)) continue;
    const text = capWords(candidate);
    if (!text) continue;
    const speaker = speakers[out.length % speakers.length];
    out.push({ agentId: String(speaker.id), name: speaker.name, text });
  }
  return out;
}

// Test/shutdown helper: forget every household's evidence and spend stamp.
export function reset() {
  households.clear();
}
