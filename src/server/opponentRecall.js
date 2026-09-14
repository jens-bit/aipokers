// src/server/opponentRecall.js — LIFE-1 job 4
//
// What he is allowed to tell you about a man he has played.
//
// THE FINDING. Jens asked his agent about a specific opponent — "you should
// know him well at this point, can you see the stats?" — and got "Nah, I can't
// see the stats." That answer is wrong twice over. It is wrong as a fact: the
// opponent model has existed since AGE-30, the ring is fifty hands deep per
// player, and the same agent is handed VPIP, PFR, AF and a fold-to-raise
// figure on every decision he makes at the table. And it is wrong as a
// character: a man who has sat across from somebody for two hundred hands and
// says he has no idea who they are is not being modest, he is being nobody.
//
// The cause is plain once you look: buildAgentChatSystem carried `bioLedger`
// roles ("nemesis", "rival") as OPINIONS — deriveRoles' one-line summaries —
// and no numbers at all. There was nothing in the prompt for him to read out,
// so he correctly said he could not see any.
//
// THE THRESHOLD IS NOT A NEW ONE. attributes.js readMinHands is the existing
// unlock rule and has been since ATTR-1: ten observed hands at neutral,
// pulled DOWN by the hero's own READS (to five at READS 100 — he solves people
// faster) and pushed UP by the subject's DECEPTION (×0.6 to ×2.4 — they are
// harder to solve). table.js gates the in-hand briefing on exactly
// `read.handsObserved >= readMinHands(...)`, and so does this file, against
// exactly the same figure. An agent who can act on a read at the table can
// talk about it at home, and one who cannot, cannot. Inventing a second
// number here would mean he could discuss a man he cannot yet play.
//
// ONE DIFFERENCE, STATED. At the table the subject's DECEPTION is read off
// their live seat. In a conversation there is no seat and no subject record to
// read, so `deception` is null and the gate is the hero's READS alone. That
// makes the chat gate very slightly EASIER than the felt's for a deceptive
// opponent. The alternative — withholding what he has already been briefed on
// because the man is not currently sitting down — is worse, and the honest
// version of the difference is that the felt knows something the living room
// does not.
//
// FOUR RULES.
//
//   1. THE FIGURES OR THE HONEST ADMISSION, never silence and never a bluff.
//      Below the gate he is told, in the prompt, to say he has not played the
//      man enough to have a read. That is a real answer and it is his.
//   2. THE NUMBERS ARE THE REAL NUMBERS. getRead's own output, formatted by
//      reads.js so the read he quotes in the living room is word for word the
//      read he is briefed with at the table.
//   3. HE ONLY KNOWS WHO HE HAS PLAYED. The name is resolved against HIS OWN
//      bioLedger, never a global directory. He cannot produce statistics on a
//      man he has never sat with because he has never sat with him.
//   4. NO MODEL CALL. Name matching is a scan of at most LEDGER_CAP entries.

import { getRead } from './opponentStats.js';
import { readMinHands } from '../agent/attributes.js';
import { formatOpponentRead, vpipLabel, classifyOpponent } from '../agent/reads.js';

// How many opponents he volunteers when the owner asks about the field in
// general rather than about one man. Three: enough to be a survey, few enough
// that it is not a data dump, and they are the three he knows best.
export const RECALL_MAX = 3;

// Names shorter than this are not matched. "Al" or "Ed" as a display name
// would otherwise fire on "also" and "edge" and put the wrong man's numbers in
// front of the owner, which is worse than not answering.
const MIN_NAME_CHARS = 3;

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** His own ledger, as an array, safe on a record that has never had one. */
export function ledgerEntries(agent) {
  const ledger = agent?.bioLedger;
  if (!ledger || typeof ledger !== 'object') return [];
  return Object.values(ledger).filter((e) => e && e.playerId);
}

/**
 * The opponent the owner just named, or null.
 *
 * Whole-word, case-insensitive, LONGEST NAME FIRST — so a table holding both
 * "Doyle" and "Doyle Jr" resolves "ask Doyle Jr about the turn" to the right
 * one rather than to whichever happens to be first in the ledger.
 */
export function namedOpponent(agent, text) {
  const t = String(text ?? '');
  if (!t.trim()) return null;
  const candidates = ledgerEntries(agent)
    .map((e) => ({ entry: e, name: String(e.displayName ?? e.playerId ?? '').trim() }))
    .filter((c) => c.name.length >= MIN_NAME_CHARS)
    .sort((a, b) => b.name.length - a.name.length);
  for (const c of candidates) {
    if (new RegExp(`\\b${esc(c.name)}\\b`, 'i').test(t)) return c.entry;
  }
  return null;
}

/**
 * What he knows about one opponent, and whether he has earned the right to
 * say it.
 *
 * Returns { entry, read, gate, known } — `known` is the whole decision, and it
 * is readMinHands against handsObserved, which is table.js's line verbatim.
 */
export function opponentKnowledge(agent, entry, { reads = null } = {}) {
  if (!entry) return null;
  const read = getRead(entry.playerId);
  const heroReads = reads ?? agent?.attrs?.READS ?? null;
  // `deception` is null on purpose — see the note at the top of the file.
  const gate = readMinHands({ reads: heroReads, deception: null });
  const observed = Number(read?.handsObserved) || 0;
  return { entry, read: read ?? null, gate, known: !!read && observed >= gate };
}

// One opponent, in the words the briefing would use plus the history that is
// his alone. reads.js writes the stat line so the living room and the felt
// quote the same read; the ledger half is what only he can say — how the money
// has actually gone between the two of them.
function describe(agent, knowledge) {
  const { entry, read, gate } = knowledge;
  const who = entry.displayName || entry.playerId;
  const together = `${entry.hands} hand${entry.hands === 1 ? '' : 's'} against him, `
    + `${entry.net >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(entry.net))} chips overall`;

  if (!knowledge.known) {
    const short = read?.handsObserved ?? 0;
    return `- ${who}: ${together}. YOU DO NOT HAVE A READ ON HIM YET — `
      + `${short} observed hand${short === 1 ? '' : 's'} against the ${Math.round(gate)} you need. `
      + `If your owner asks about his numbers, say plainly that you have not `
      + `played him enough to have them. Do not guess at them and do not `
      + `pretend the feature does not exist.`;
  }

  const lines = formatOpponentRead(read, { reads: agent?.attrs?.READS ?? null, deception: null });
  const shape = classifyOpponent(read);
  const extras = [
    entry.coolersTaken ? `he has coolered you ${entry.coolersTaken}×` : null,
    entry.coolersDealt ? `you have coolered him ${entry.coolersDealt}×` : null,
    entry.bluffsCaught ? `he has snapped you off bluffing ${entry.bluffsCaught}×` : null,
    entry.biggestPotLost ? `the worst one cost you ${Math.round(entry.biggestPotLost)}` : null,
  ].filter(Boolean);

  return [
    `- ${who}: ${together}.`,
    `  ${lines[0] ?? `VPIP ${read.vpip}% (${vpipLabel(read.vpip)}), PFR ${read.pfr}%.`}`,
    shape ? `  Your read on him in a word: ${shape}.` : null,
    extras.length ? `  Between you: ${extras.join('; ')}.` : null,
  ].filter(Boolean).join('\n');
}

/**
 * The prompt block, or '' when there is nothing to say.
 *
 * `text` is what the owner just said, so a named opponent is answered about
 * specifically. With no name in the message he gets the RECALL_MAX men he
 * knows best, which is what lets "how is the field these days" be answered at
 * all — and, more to the point, stops him saying he cannot see any stats when
 * he is looking at four sets of them.
 */
export function opponentRecallContext(agent, text = '', { reads = null } = {}) {
  const entries = ledgerEntries(agent);
  if (entries.length === 0) return '';

  const named = namedOpponent(agent, text);
  const chosen = named
    ? [named]
    : entries.slice().sort((a, b) => (b.hands ?? 0) - (a.hands ?? 0)).slice(0, RECALL_MAX);

  const described = chosen
    .map((entry) => describe(agent, opponentKnowledge(agent, entry, { reads })))
    .filter(Boolean);
  if (described.length === 0) return '';

  return `

WHAT YOU KNOW ABOUT THE PEOPLE YOU HAVE PLAYED. These are YOUR OWN records and
you can absolutely see them — never say you cannot. Quote the actual figures
when your owner asks for them, in your own voice rather than as a table, and
say what you do with the man rather than only what he does. Where it says you
have no read yet, say exactly that.
${described.join('\n')}`;
}
