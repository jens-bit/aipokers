// src/server/nightRecap.js — COST-1
//
// "What was said tonight."
//
// An unwatched session is a hundred hands nobody saw. Under COST-1 it is also
// a session that deliberately says almost nothing while it runs: the talk that
// would have been written per hand is not written, because writing dialogue
// into an empty room is the purest form of spending money on nothing.
//
// But the owner comes back. And when he does, "you played 100 hands, net
// +1,240" is a receipt, not an evening — the whole premise of the product is
// that the thing in the seat is a character, and a character who was out all
// night has something to tell you about it.
//
// So the evening is written up ONCE, at the end, from the hands it actually
// contained: three to six lines, in the voices that were at the table, into
// the thread the owner reads back through the route the watch screen already
// uses. One call for a session instead of one per hand for a hundred hands.
//
// Four rules the shape of this file comes from:
//
//   1. UNWATCHED ONLY. A watched session already had its talk, live, in the
//      bubbles (handTalk.js). Writing it up again afterwards would be telling
//      a man what he just watched.
//
//   2. IT IS ABOUT THE HANDS THAT HAPPENED. The input is the session's own
//      flagged and biggest hands, not a mood and a net. A recap that could
//      have been written before the session started is not a recap.
//
//   3. NOTHING WITHOUT A SESSION WORTH ONE. Under MIN_HANDS there is nothing
//      to say; the skip is free and it is the common case for a session that
//      ended on its second hand because somebody busted.
//
//   4. NO KEY, NO CALL. Same as everywhere else — without ANTHROPIC_API_KEY
//      this returns an empty list having done nothing, which is what makes it
//      safe in the automated suites.
//
// The model call is injected, so the tests never touch a network. Writing to
// the thread is the caller's job (table.js knows the session id); this module
// composes lines and nothing else.

import Anthropic from '@anthropic-ai/sdk';
import { capWords, isSolverSpeak } from '../agent/voice.js';
import { recordAnthropicCall, Kind as MeterKind } from './meter.js';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

// Three is an evening, six is a transcript.
export const MIN_LINES = 3;
export const MAX_LINES = 6;

// Below this the session did not happen. A table that dealt four hands and
// broke up has nothing anybody would want written down.
export const MIN_HANDS = Number(process.env.RECAP_MIN_HANDS ?? 10);

/**
 * Build the prompt.
 *
 * @param cast    [{ name, style, mood, note }] — the voices at the table
 * @param session { hands, net, biggestPot, moments: [string], bb }
 *        `moments` is the session in sentences the server already knows how to
 *        write ("he took 860 off Granite on the river", "he was well ahead and
 *        lost it") — the flagged hands, in order. That is the whole input: a
 *        recap of an evening is a recap of the three things that happened in
 *        it, and the server already classified them (FLAG-1).
 */
export function buildPrompt(cast, session) {
  const who = (p) => [
    p.name,
    p.style ? `plays ${String(p.style).slice(0, 60)}` : null,
    p.mood && p.mood !== 'neutral' ? `finished the night ${p.mood}` : null,
    p.note || null,
  ].filter(Boolean).join('; ');

  const moments = (session?.moments ?? []).slice(0, 8);

  return {
    system:
      'A poker session has just finished at one table. Write what the players said to each other ' +
      `over the course of it — between ${MIN_LINES} and ${MAX_LINES} lines in total, in the voices given, ` +
      'in the order the evening went.\n\n' +
      'Rules:\n' +
      '- One line per output line. No names, no quotes, no numbering, no narration.\n' +
      '- Under twelve words each. Plain spoken English. Dry.\n' +
      '- Cover the moments listed, in order. They are what the evening was.\n' +
      '- They are talking to each other at the table, not to a reader.\n' +
      '- NEVER poker jargon, statistics, percentages, sizes in blinds, or strategy terms.\n' +
      '- Banned: "nice hand", "good game", "well played", "you got lucky", "gg", "wp".',
    user:
      `PLAYERS:\n${cast.map((p, i) => `${i + 1}. ${who(p)}`).join('\n')}\n\n` +
      `THE SESSION: ${session?.hands ?? 0} hands, biggest pot ${session?.biggestPot ?? 0}.\n` +
      `WHAT HAPPENED, in order:\n` +
      (moments.length > 0 ? moments.map((m) => `- ${m}`).join('\n') : '- a long quiet grind, nothing much in it') +
      `\n\nWrite the evening:`,
  };
}

/**
 * Split the reply into attributed lines, cycling through the cast in order.
 *
 * Unlike handTalk.parseTalk, a dropped line here does NOT drop a speaker: the
 * lines are a conversation over a whole evening rather than one line owed to
 * each named man, so the next usable line simply belongs to the next voice.
 * Nobody is put in anybody's mouth because nobody was promised a specific one.
 */
export function parseRecap(raw, cast) {
  if (typeof raw !== 'string' || !Array.isArray(cast) || cast.length === 0) return [];
  const out = [];
  const candidates = raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .map((l) => l.replace(/^[A-Z][A-Za-z' ]{0,20}:\s*/, '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (out.length >= MAX_LINES) break;
    if (isSolverSpeak(candidate)) continue;
    const text = capWords(candidate);
    if (!text) continue;
    const speaker = cast[out.length % cast.length];
    out.push({ seat: speaker.seat ?? null, name: speaker.name, text });
  }
  // Under MIN_LINES it is not an evening, it is a fragment. Nothing is written
  // rather than one stray sentence pretending to be a night out.
  return out.length >= MIN_LINES ? out : [];
}

/**
 * Write up one unwatched session. Returns [{ seat, name, text }], empty for
 * every skip — no cast, too few hands, no key, a failed call.
 */
export async function writeNightRecap(cast, session, { ownerId = null, call = callModel } = {}) {
  const voices = (cast ?? []).filter((p) => p?.name);
  if (voices.length === 0) return [];
  if ((session?.hands ?? 0) < MIN_HANDS) return [];

  let raw = null;
  try {
    raw = await call(buildPrompt(voices, session ?? {}), { ownerId });
  } catch (err) {
    console.error('[night-recap] model call failed:', err.message);
    return [];
  }
  return parseRecap(raw, voices);
}

async function callModel({ system, user }, { ownerId = null } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;   // no key, no call, no bill
  const client = new Anthropic();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 260,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }, { signal: controller.signal });
    recordAnthropicCall({ ownerId, kind: MeterKind.TALK, model: MODEL, msg: res });
    return res.content[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}
