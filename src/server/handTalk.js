// src/server/handTalk.js — COST-1
//
// What was said at the table, written once, at the end of the hand.
//
// Table talk used to be priced per remark. Every trigger — a big bet, a pot
// taken, a human typing something — fired its own model call, with its own
// full prompt, to produce one sentence. Three agents at a lively table could
// spend three calls on one hand SAYING things about a hand that had already
// cost three calls to PLAY, and each of those calls had to be told about the
// hand from scratch because none of them had seen it.
//
// So the talk is written the way a person would write it: once, afterwards,
// with the whole hand in front of you. One call takes the action log and every
// speaking seat's reads and grudges and writes a line for each of them, in
// each of their voices, about the same hand. It is strictly better copy for
// strictly less money — a line about the turn raise can now actually mention
// the turn raise, because the writer saw it.
//
// Four rules the shape of this file comes from:
//
//   1. ONE CALL PER HAND. Not per seat, not per remark. If nobody has a
//      trigger the call does not happen, which is most hands.
//
//   2. ONLY WHERE SOMEBODY IS WATCHING. An unwatched table's talk is nobody's
//      experience — it is a log line with a bill attached. Unwatched tables
//      keep TLK-1's template lines during the session and get their evening
//      written up once, at the end, by nightRecap.js. The kitchen table gets
//      templates and nothing else, ever.
//
//   3. THE INSTANT REACTIONS STAY TEMPLATES. A fold or a check that gets a
//      line has to have it NOW, in the two seconds the bubble is up, and a
//      call that resolves after the hand is over cannot. Those come from
//      policyPlay.instantLine and from the model's own optional `say` on the
//      decision call — both free, both in the moment. This file writes the
//      things that are allowed to arrive late, which is everything about a
//      hand that has just finished.
//
//   4. NO KEY, NO CALL, NO EXCEPTION. Without ANTHROPIC_API_KEY this returns
//      an empty list having done nothing, which is what makes it safe in the
//      automated suites (the runner strips the key from every child).
//
// Pure except for the one call: the prompt builder and the parser are both
// exported and both testable with object literals, and the caller injects the
// call. table.js owns the bubbles and the pacing.

import Anthropic from '@anthropic-ai/sdk';
import { capWords, isSolverSpeak } from '../agent/voice.js';
import { recordAnthropicCall, Kind as MeterKind } from './meter.js';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

// A hand does not produce a conversation. Four voices on one hand is already a
// table that talks more than it plays.
export const MAX_SPEAKERS = 4;

// How far apart the bubbles land when they play back. Long enough to read one
// before the next arrives; short enough that the last one is still about the
// hand everybody just watched.
export const BUBBLE_GAP_MS = Number(process.env.TALK_BUBBLE_GAP_MS ?? 1400);

/**
 * Build the one prompt.
 *
 * @param speakers [{ seat, name, style, mood, trigger, note }]
 *        `trigger` is TLK-1's vocabulary (wonBigPot | lostAsFavorite |
 *        shownBluff | cardDead) — what happened TO him. `note` is his read or
 *        his grudge against somebody at this table, in words, or null.
 * @param hand { board, pot, result, log: [{ who, street, action }] }
 */
export function buildPrompt(speakers, hand) {
  const who = (s) => [
    s.name,
    s.style ? `plays ${String(s.style).slice(0, 60)}` : null,
    s.mood && s.mood !== 'neutral' ? `currently ${s.mood}` : null,
    s.note ? `about the table: ${s.note}` : null,
  ].filter(Boolean).join('; ');

  const log = (hand?.log ?? [])
    .map((e) => `${e.street}: ${e.who} ${e.action}`)
    .join('\n');

  return {
    system:
      'You write the table talk for one hand of poker that has just finished. ' +
      `You are given the hand and a list of players who have something to say about it. ` +
      'Write ONE line for each player, in that player\'s own voice, in the order given.\n\n' +
      'Rules:\n' +
      '- One line per player, in order, one per output line. No names, no quotes, no numbering.\n' +
      '- Under twelve words each. Plain spoken English. Dry.\n' +
      '- Say something about THIS hand — the bet, the card, the pot, the man who made it.\n' +
      '- They are talking to the table, not to a camera and not to the reader.\n' +
      '- NEVER poker jargon, statistics, percentages, sizes in blinds, or strategy terms.\n' +
      '- Banned: "nice hand", "good game", "well played", "you got lucky", "gg", "wp".',
    user:
      `BOARD: ${(hand?.board ?? []).join(' ') || 'none'}\n` +
      `POT: ${hand?.pot ?? 0}\n` +
      `RESULT: ${hand?.result ?? 'unknown'}\n` +
      `ACTION:\n${log || '(no betting)'}\n\n` +
      `PLAYERS WITH SOMETHING TO SAY, in order:\n` +
      speakers.map((s, i) => `${i + 1}. ${who(s)} — ${describeTrigger(s.trigger)}`).join('\n') +
      `\n\nWrite ${speakers.length} line(s):`,
  };
}

// TLK-1's four triggers, in words the writer can use. Kept here rather than in
// tableTalk.js because that module is the TEMPLATE half and has no prompt in
// it; this is the only place a trigger has to become a sentence.
function describeTrigger(trigger) {
  switch (trigger) {
    case 'wonBigPot':      return 'he just took a big pot';
    case 'lostAsFavorite': return 'he was well ahead and lost it anyway';
    case 'shownBluff':     return 'his bluff was called and everybody saw it';
    case 'cardDead':       return 'he has folded three hands in a row and is bored';
    default:               return 'something happened to him this hand';
  }
}

/**
 * Split what the model returned into one line per speaker, in order.
 *
 * A line that reads as solver output is DROPPED, and dropping it drops that
 * speaker rather than shifting everybody up — the third line is the third
 * player's, and sliding it onto the second player would put one man's words in
 * another man's mouth. Same law as homeNight.parseExchange, one consequence
 * further: there the speakers alternate and a gap is harmless, here they are
 * named and it is not.
 */
export function parseTalk(raw, speakers) {
  if (typeof raw !== 'string' || !Array.isArray(speakers)) return [];
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .map((l) => l.replace(/^[A-Z][A-Za-z' ]{0,20}:\s*/, '').trim())
    .filter(Boolean);

  const out = [];
  for (let i = 0; i < speakers.length && i < lines.length; i++) {
    if (isSolverSpeak(lines[i])) continue;
    const text = capWords(lines[i]);
    if (!text) continue;
    out.push({ seat: speakers[i].seat, name: speakers[i].name, text });
  }
  return out;
}

/**
 * Write the hand's talk. Returns [{ seat, name, text }] — empty for every skip,
 * which the caller never has to distinguish.
 *
 * `call` is injectable so the tests never touch a network.
 */
export async function writeHandTalk(speakers, hand, { ownerId = null, call = callModel } = {}) {
  const cast = (speakers ?? []).filter((s) => s && Number.isInteger(s.seat)).slice(0, MAX_SPEAKERS);
  if (cast.length === 0) return [];

  let raw = null;
  try {
    raw = await call(buildPrompt(cast, hand ?? {}), { ownerId });
  } catch (err) {
    console.error('[hand-talk] model call failed:', err.message);
    return [];
  }
  return parseTalk(raw, cast);
}

async function callModel({ system, user }, { ownerId = null } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;   // no key, no call, no bill
  const client = new Anthropic();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }, { signal: controller.signal });
    recordAnthropicCall({ ownerId, kind: MeterKind.TALK, model: MODEL, msg: res });
    return res.content[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}
