// src/agent/ownerMemory.js — RELATE-1
//
// What he remembers about YOU.
//
// The agent already has memory about poker (Tree 3: computed self-stats) and
// about opponents (opponentStats: a ring of per-hand facts). This is the third
// book, and it is the only one whose subject is the person holding the phone:
// up to twelve lines, in his voice, about how his owner has treated him.
//
//   "calls me an idiot when I lose"
//   "asked about the cooler and actually read it"
//   "cut me off after the Q3o night"
//
// THE GUARDRAIL, and it is the whole design (Mood Design Law, CORE_GAME_PLAN
// §Mood economy, spec v11 §7): a line is written ONLY from a message the owner
// sent or an action the owner took. Never from silence, never from time
// elapsed, never from an unopened review. There is no writer in this file that
// can fire because nobody came back — recordOwnerEvent refuses any event not
// in WRITERS, and every WRITERS entry is an owner act. ownerMemory.test.js
// asserts that as a property of the table rather than a fact about today's
// call sites, because the guardrail has to survive the next person adding an
// event type.
//
// Storage is the agent record (agent.ownerMemory), so it rides the existing
// save seam and needs no table of its own.

import { randomUUID } from 'node:crypto';

export const OWNER_MEMORY_MAX = 12;

// How many sessions between compressions. Same shape as the opponent ring:
// bounded, oldest-first eviction, with repeated facts folded into one line
// carrying a count rather than twelve copies of the same grievance.
export const COMPRESS_EVERY_SESSIONS = 5;

// Tone is the only number this file produces: −1 he was treated badly, +1 well,
// 0 it happened but says nothing about the owner. It feeds the resting-heat
// drift in RELATE-1c and nothing else. It is never shown as a score.
export const TONE = Object.freeze({ HOSTILE: -1, NEUTRAL: 0, DECENT: 1 });

// ── The writers ──────────────────────────────────────────────────────────────
//
// event type → { tone, line(ctx) }. Every one of these is a thing the owner
// DID. Adding an entry here is the only way to write a ledger line, and the
// test asserts every entry names an owner act.

const clip = (s, n = 70) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};

// A short handle for the hand he is sore about, e.g. "the Q3o night".
const handTag = (ctx) => {
  const cards = Array.isArray(ctx?.holeCards) ? ctx.holeCards.filter(Boolean) : [];
  if (cards.length >= 2) {
    const ranks = cards.map((c) => String(c)[0]).join('');
    const suited = String(cards[0])[1] === String(cards[1])[1] ? 's' : 'o';
    return `the ${ranks}${suited} hand`;
  }
  if (Number.isFinite(ctx?.handNumber)) return `hand ${ctx.handNumber}`;
  return 'that one';
};


// WANTS-1: how each ask is paraphrased in the ledger.
//
// A PARAPHRASE, never the line he said. Same rule as the `needle` writer above
// and for the same reason: what survives into his memory is the shape of what
// happened between you, not a transcript of either side of it. It also means
// the ledger reads the same however the want was worded, so retuning
// ASK_LINES never rewrites history.
const ASK_GRANTED = Object.freeze({
  rest:    'let me sit one out when I was cooked',
  deploy:  'put me in when I asked',
  beer:    'got me a beer when I asked',
  back_in: 'let me go straight back in',
  fund:    'fronted me when I was cleaned out',
  brag:    'sat and heard me out about a hand',
  nemesis: 'sent me after him when I asked',
});

const ASK_ASKED_FOR = Object.freeze({
  rest:    'to sit one out',
  deploy:  'to be put in',
  beer:    'for a beer',
  back_in: 'to go straight back in',
  fund:    'for a stake',
  brag:    'to tell him about a hand',
  nemesis: 'to be sent after him',
});

const askedFor = (kind) => ASK_ASKED_FOR[kind] ?? 'for something';

export const WRITERS = Object.freeze({
  // — messages he received —
  needle: {
    tone: TONE.HOSTILE,
    ownerAct: 'sent a message',
    // His read, never the words. An earlier draft quoted 40 characters of the
    // message here and relate.test.js caught it: a clipped quote is still a
    // transcript, and an owner who types something private while needling him
    // should not find it in his agent's memory. What survives is the shape of
    // the behaviour, which is the only part that is his to remember anyway.
    line: (ctx) => (ctx.losing
      ? 'gets on my back when I lose'
      : 'has a go at me when he feels like it'),
  },
  care: {
    tone: TONE.DECENT,
    ownerAct: 'sent a message',
    line: (ctx) => (ctx.aboutHand
      ? `asked about ${handTag(ctx)} and actually read it`
      : 'says something decent when it goes well'),
  },
  pep_talk: {
    tone: TONE.DECENT,
    ownerAct: 'sent a message that talked him down',
    line: () => 'talked me down when I was steaming',
  },

  // — things he did to the agent —
  review_opened: {
    tone: TONE.DECENT,
    ownerAct: 'opened a flagged hand',
    line: (ctx) => `read back ${handTag(ctx)}`,
  },
  proposal_accepted: {
    tone: TONE.DECENT,
    ownerAct: 'accepted a self-change proposal',
    line: (ctx) => `let me ${clip(ctx.what || 'change how I play', 34)}`,
  },
  proposal_rejected: {
    tone: TONE.NEUTRAL,
    ownerAct: 'rejected a self-change proposal',
    line: (ctx) => `said no when I asked to ${clip(ctx.what || 'change something', 30)}`,
  },

  // — money (§7.1) —
  funded: {
    tone: TONE.DECENT,
    ownerAct: 'put money in the pocket',
    line: (ctx) => `staked me ${Number(ctx.amount) || 0}`,
  },
  collected: {
    tone: TONE.NEUTRAL,
    ownerAct: 'collected from the pocket',
    line: (ctx) => `took ${Number(ctx.amount) || 0} home`,
  },
  cut: {
    tone: TONE.HOSTILE,
    ownerAct: 'cut him off',
    line: (ctx) => `cut me off after ${handTag(ctx)}`,
  },

  // — the one item (design 29) —
  item_given: {
    tone: TONE.DECENT,
    ownerAct: 'gave an item',
    line: (ctx) => `brought me ${ctx.item === 'beer' ? 'a beer' : 'a snack'} when it was rough`,
  },
  want_ignored: {
    tone: TONE.HOSTILE,
    ownerAct: 'declined a want he had raised',
    line: (ctx) => `I asked for ${ctx.item === 'beer' ? 'a beer' : 'something'}. Nothing.`,
  },
  // — WANTS-1: answering an ask (§ the want as an ask) —
  //
  // Every answer writes a line, including `later` and including `no`. That is
  // deliberate and it is the point: the ledger is his read on how you treat
  // him, and "he asks and I say no" is a real way to treat someone. What it is
  // NOT is a punishment — `want_refused` and `want_snoozed` are NEUTRAL, so a
  // week of saying no to things you were right to say no to does not drift his
  // resting heat at all. The only hostile want line in the table is
  // RELATE-1d's `want_ignored`, which is the one raised by a rough night and
  // then declined; a refused ASK is a decision, not a slight.
  //
  // The dangerous yes gets a type of its own rather than a flag on
  // `want_granted`, because the thing a later feature wants to find is exactly
  // "the times he asked to sit back down steaming and was let". A distinct
  // type is findable; a flag inside a formatted string is not.
  want_granted: {
    tone: TONE.DECENT,
    ownerAct: 'said yes to something he asked for',
    line: (ctx) => ASK_GRANTED[ctx?.kind] ?? 'said yes when I asked for something',
  },
  want_snoozed: {
    tone: TONE.NEUTRAL,
    ownerAct: 'said later to something he asked for',
    line: (ctx) => `said later when I asked ${askedFor(ctx?.kind)}`,
  },
  want_refused: {
    tone: TONE.NEUTRAL,
    ownerAct: 'said no to something he asked for',
    line: (ctx) => `said no when I asked ${askedFor(ctx?.kind)}`,
  },
  want_yes_dangerous: {
    tone: TONE.NEUTRAL,
    ownerAct: 'said yes to an ask he had flagged as a bad idea',
    line: () => 'let me sit straight back down when I was steaming',
  },
});

export const OWNER_EVENTS = Object.freeze(Object.keys(WRITERS));

// ── The ledger ───────────────────────────────────────────────────────────────

export function ensureOwnerMemory(agent) {
  if (!Array.isArray(agent.ownerMemory)) agent.ownerMemory = [];
  return agent.ownerMemory;
}

/**
 * Write one line, from one thing the owner did.
 *
 * Returns the stored entry, or null when the event is unknown — an unknown
 * event is a programming error, not a silence, and it writes nothing rather
 * than inventing a line.
 */
export function recordOwnerEvent(agent, type, ctx = {}) {
  const writer = WRITERS[type];
  if (!writer) return null;
  const ledger = ensureOwnerMemory(agent);

  const text = clip(writer.line(ctx), 80);
  if (!text) return null;

  // Same fact twice is one memory with a count, not two lines. This is the
  // compression the opponent ring does by keeping counters rather than
  // transcripts, and it is why twelve lines is enough to hold a relationship.
  const existing = ledger.find((e) => e.type === type && e.text === text);
  if (existing) {
    existing.count = (existing.count ?? 1) + 1;
    existing.ts = Date.now();
    return existing;
  }

  const entry = {
    id: randomUUID(),
    ts: Date.now(),
    type,
    tone: writer.tone,
    text,
    count: 1,
  };
  ledger.push(entry);
  if (ledger.length > OWNER_MEMORY_MAX) ledger.splice(0, ledger.length - OWNER_MEMORY_MAX);
  return entry;
}

/**
 * Fold the ledger down. Called every COMPRESS_EVERY_SESSIONS sessions, the
 * same cadence the opponent ring is trimmed on.
 *
 * Never a transcript: identical lines merge into one carrying its count, and
 * what survives the cap is the most-repeated first, then the most recent —
 * a thing he was told once six weeks ago loses to a thing he is told nightly.
 */
export function compressOwnerMemory(agent) {
  const ledger = ensureOwnerMemory(agent);
  const byText = new Map();
  for (const e of ledger) {
    const key = `${e.type}:${e.text}`;
    const prev = byText.get(key);
    if (prev) {
      prev.count += e.count ?? 1;
      prev.ts = Math.max(prev.ts, e.ts);
    } else {
      byText.set(key, { ...e, count: e.count ?? 1 });
    }
  }
  const merged = [...byText.values()].sort((a, b) => (b.count - a.count) || (b.ts - a.ts));
  agent.ownerMemory = merged.slice(0, OWNER_MEMORY_MAX).sort((a, b) => a.ts - b.ts);
  return agent.ownerMemory;
}

// Called at session end. Bumps the counter and compresses on the cadence.
export function tickOwnerMemorySession(agent) {
  ensureOwnerMemory(agent);
  agent.ownerMemorySessions = (agent.ownerMemorySessions ?? 0) + 1;
  if (agent.ownerMemorySessions % COMPRESS_EVERY_SESSIONS === 0) {
    compressOwnerMemory(agent);
    return true;
  }
  return false;
}

// ── Reading it ───────────────────────────────────────────────────────────────

/**
 * How the relationship reads, in [−1..+1]. Weighted by how often each line
 * happened, so one bad night against a month of decency does not flip it.
 * Null when there is nothing to read — no ledger is not a bad relationship.
 */
export function ownerToneScore(agent, { now = Date.now(), windowMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  const ledger = Array.isArray(agent?.ownerMemory) ? agent.ownerMemory : [];
  const recent = ledger.filter((e) => Number.isFinite(e.ts) && now - e.ts <= windowMs);
  if (recent.length === 0) return null;
  let weighted = 0;
  let weight = 0;
  for (const e of recent) {
    const n = Math.max(1, e.count ?? 1);
    weighted += (e.tone ?? 0) * n;
    weight += n;
  }
  if (weight === 0) return null;
  return Math.max(-1, Math.min(1, weighted / weight));
}

/** The ledger as prompt lines — his voice, never a transcript. */
export function ownerMemoryContext(agent) {
  const ledger = Array.isArray(agent?.ownerMemory) ? agent.ownerMemory : [];
  if (ledger.length === 0) return '';
  const lines = ledger
    .slice(-OWNER_MEMORY_MAX)
    .map((e) => `- ${e.text}${(e.count ?? 1) > 1 ? ` (${e.count}×)` : ''}`)
    .join('\n');
  return `\n\nWhat you remember about your owner — your read on him, not a log:\n${lines}`;
}

// ── "What do you think of me?" ───────────────────────────────────────────────
//
// Answered from the ledger, by template, with no model call. This is the one
// question in the product where a generated answer would be worse than a
// written one: he is describing a real record and the record is right there.

const ASK_PATTERNS = [
  /\bwhat do you (think|make) of me\b/i,
  /\bwhat('?s| is) your (read|take) on me\b/i,
  /\bdo you (like|trust|hate|rate) me\b/i,
  /\bhow (do|would) you (describe|rate) me\b/i,
  /\bam i a (good|bad|decent|terrible) (owner|backer)\b/i,
  /\bwhat am i to you\b/i,
];

export function isAskingAboutOwner(text) {
  const t = String(text ?? '').trim();
  return !!t && ASK_PATTERNS.some((re) => re.test(t));
}

/**
 * His answer, in his voice, from the ledger. Always returns a string.
 *
 * Three registers, chosen by the tone score, each naming the thing he actually
 * remembers rather than describing a feeling — the specific is what makes it
 * land, and it is also what keeps it honest.
 */
export function whatDoYouThinkOfMe(agent) {
  const ledger = Array.isArray(agent?.ownerMemory) ? agent.ownerMemory : [];
  if (ledger.length === 0) {
    return "Not much to go on yet. Play some hands with me and ask again.";
  }

  const score = ownerToneScore(agent, { windowMs: Number.MAX_SAFE_INTEGER }) ?? 0;
  const loudest = [...ledger].sort((a, b) => (b.count ?? 1) - (a.count ?? 1))[0];
  const worst = ledger.filter((e) => e.tone === TONE.HOSTILE)
    .sort((a, b) => (b.count ?? 1) - (a.count ?? 1))[0];
  const best = ledger.filter((e) => e.tone === TONE.DECENT)
    .sort((a, b) => (b.count ?? 1) - (a.count ?? 1))[0];

  // The lines carry an implied third-person subject ("gets on my back when I
  // lose"), so they cannot be prefixed with "You " — an earlier draft did and
  // produced "you gets on my back", which verify-personality-layer.js printed
  // straight into the report. They stand on their own as clipped observations,
  // which is how someone actually talks about their backer.
  const a = best?.text ?? loudest.text;
  const b = worst?.text ?? null;

  if (score <= -0.34) {
    return `Honestly? ${sentence(worst?.text ?? loudest.text)} I still sit down, but I've noticed.`;
  }
  if (score >= 0.34) {
    return `You're alright. ${sentence(best?.text ?? loudest.text)} That's more than most of them get.`;
  }
  return b
    ? `Mixed. ${sentence(a)} But also: ${b}. I take the good nights.`
    : `${sentence(a)} That's about the size of it so far.`;
}

// A ledger line as a standalone sentence: capitalised, full-stopped once.
function sentence(line) {
  const t = String(line ?? '').trim();
  if (!t) return '';
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
