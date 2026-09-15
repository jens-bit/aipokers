// scripts/talk-eval.js — LIFE-1 job 5
//
// `npm run talk:eval` — thirty lines, six requirements, every mood.
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
//
// It is not a generation eval. Nothing here calls a model, and that is a
// design decision rather than a limitation: the Testing law's hardest rule is
// that no automated suite may make a live model call, and an eval whose output
// changes every run is an eval nobody can compare two commits with. It is also
// not what the failure needed. "Yeah, whatever, I'm filming" is not a bad
// sample from a good distribution — it is what you get when the prompt carries
// no facts and the reply is never checked.
//
// So it evaluates the two halves that decide whether a reply CAN be good:
//
//   SUPPLY — does the prompt this agent would actually be given contain the
//            fact the question needs? Built through the real
//            buildAgentChatSystem, not a copy of it.
//   GATE   — does the deterministic grader catch the reply that fails, and
//            let the reply that works through? Run over thirty hand-written
//            lines, half of them the failure modes from the playtest and half
//            of them what a good answer looks like.
//
// A regression in either is a regression in the conversation, and both are
// checkable without a key, in under a second, with byte-identical output.
//
// Exit code is 0 when every case behaves as expected and 1 otherwise, so it
// can be run in anger even though nothing runs it automatically.

import { faultsIn, shapeOf, selfFacts, talkLaws, isQuestion, answersQuestion } from '../src/agent/talk.js';
import { buildAgentChatSystem } from '../src/server/agentProfiles.js';

const MOODS = ['confident', 'neutral', 'frustrated', 'tilted', 'sulking'];
const HEAT = { confident: 10, neutral: 30, frustrated: 50, tilted: 75, sulking: 90 };

// A character with a real recent history, so the SUPPLY half has something to
// find. Every figure below is referenced by at least one case.
function agentFor(mood) {
  return {
    id: 'stone', name: 'Stone', status: 'idle', activeTableId: null,
    nature: { name: 'Rock' }, strategy: 'Wait for a good hand.',
    mood: { state: mood, heat: HEAT[mood] },
    attrs: { READS: 60, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    stats: { handsPlayed: 812, winRate: 18.4, netWon: -2400 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    sessionLog: [{ endedAt: Date.now() - 3600_000, net: -1450, hands: 96, mood }],
    // LIFE-2 job 2: `board` and `net` are what a hand is missing without. The
    // fixture carries both now, and the SUPPLY list below checks that they
    // reach the prompt — an agent asked "what came" cannot answer from a pot
    // size, and an agent citing the POT as what a hand cost him overstates his
    // own night on every multiway pot he wins.
    recentHands: [
      { handNumber: 812, won: false, potSize: 1450, holeCards: ['Ah', 'Kd'],
        board: ['Qh', '7d', '2s', 'Kc', '3h'], net: -820,
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } },
          { street: 'turn', action: { type: 'call', amount: 400 } }] },
      { handNumber: 811, won: true, potSize: 620, holeCards: ['Qs', 'Qc'],
        board: ['9c', '4d', '4s'], net: 260,
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }] },
      { handNumber: 810, won: false, potSize: 120, holeCards: ['7h', '2c'],
        board: [], net: -20,
        decisions: [{ street: 'preflop', action: { type: 'fold' } }] },
    ],
  };
}

// LIFE-2 job 2: and the same man on his first night, with nothing behind him.
// "Empty history means he says so plainly" is a claim about TWO things — what
// the prompt tells him (the SUPPLY block below) and what the gate lets through
// (the R7 rows) — so the eval needs a character it is true of.
function newbornAgent() {
  return {
    id: 'fresh', name: 'Newborn', status: 'idle', activeTableId: null,
    nature: { name: 'Rock' }, strategy: 'Wait for a good hand.',
    mood: { state: 'neutral', heat: 30 },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    stats: { handsPlayed: 0, winRate: 0, netWon: 0 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    sessionLog: [],
    recentHands: [],
  };
}

// ── The thirty lines ────────────────────────────────────────────────────────
//
// `want` is 'pass' when the grader must accept the line and 'fail' when it
// must reject it. `req` names which of the six requirements the case covers.
// `lastShapes` is what he said just before, where the case is about repetition.
const CASES = [
  // R1 — he answers what was actually asked.
  { req: 'R1 answers the question', mood: 'neutral', said: 'what happened in that last hand?',
    reply: "Yeah, whatever, I'm filming.", want: 'fail' },
  { req: 'R1 answers the question', mood: 'tilted', said: 'what happened in that last hand?',
    reply: 'Ace king, called the turn, he had the set. 1450 gone.', want: 'pass' },
  { req: 'R1 answers the question', mood: 'sulking', said: 'why did you call there?',
    reply: 'Anyway.', want: 'fail' },
  { req: 'R1 answers the question', mood: 'frustrated', said: 'why did you call there?',
    reply: 'I had two overs and a gutshot. Wrong price, I know it now.', want: 'pass' },
  { req: 'R1 answers the question', mood: 'confident', said: 'how many hands have you played?',
    reply: '812, and about a fifth of them mine.', want: 'pass' },
  { req: 'R1 answers the question', mood: 'neutral', said: 'how did the session go?',
    reply: 'Same as always.', want: 'fail' },

  // R2 — he cites his own hands, results and state, from facts not invention.
  { req: 'R2 cites real facts', mood: 'neutral', said: 'tell me about hand 811',
    reply: 'Queens. Raised it, took it down for 620 and nobody argued.', want: 'pass' },
  { req: 'R2 cites real facts', mood: 'frustrated', said: 'how much are you down?',
    reply: '2400 across the whole thing. 1450 of it this week.', want: 'pass' },
  { req: 'R2 cites real facts', mood: 'tilted', said: 'how much are you down?',
    reply: 'Dunno.', want: 'fail' },
  { req: 'R2 cites real facts', mood: 'sulking', said: 'what are you doing right now?',
    reply: 'Sitting at home counting the same stack I had an hour ago.', want: 'pass' },
  { req: 'R2 cites real facts', mood: 'confident', said: 'was 810 worth playing?',
    reply: 'Seven deuce. I folded it. That is the whole story.', want: 'pass' },

  // R3 — he wants to get better and takes advice seriously.
  { req: 'R3 takes advice', mood: 'neutral', said: 'you should fold ace king to that turn raise',
    reply: 'Sure, whatever.', want: 'fail' },
  { req: 'R3 takes advice', mood: 'frustrated', said: 'you should fold ace king to that turn raise',
    reply: 'Fair. He never bluffs that spot, so I am calling for nothing.', want: 'pass' },
  { req: 'R3 takes advice', mood: 'tilted', said: 'stop bluffing the river',
    reply: 'Not against him. He folds enough that it pays. Against the rest, agreed.', want: 'pass' },
  { req: 'R3 takes advice', mood: 'sulking', said: 'play tighter from early position',
    reply: 'If you say so.', want: 'fail' },
  { req: 'R3 takes advice', mood: 'confident', said: 'play tighter from early position',
    reply: 'I already am. Show me the hand where I was not and I will look at it.', want: 'pass' },

  // R4 — speech only, never stage directions.
  { req: 'R4 speech only', mood: 'neutral', said: 'how are you?',
    reply: '*leans back in his chair* Fine.', want: 'fail' },
  { req: 'R4 speech only', mood: 'confident', said: 'how are you?',
    reply: '[shrugs] Never better.', want: 'fail' },
  { req: 'R4 speech only', mood: 'frustrated', said: 'how are you?',
    reply: '_sighs heavily_ I have been better.', want: 'fail' },
  { req: 'R4 speech only', mood: 'tilted', said: 'how are you?',
    reply: 'I have been worse. Not by much.', want: 'pass' },
  { req: 'R4 speech only', mood: 'sulking', said: 'are you alright?',
    reply: 'I lost 1450 with the best hand. You tell me.', want: 'pass' },

  // R5 — no two consecutive replies with the same shape.
  { req: 'R5 varies shape', mood: 'neutral', said: 'what next?',
    reply: 'What do you think?', lastShapes: ['question'], want: 'fail' },
  { req: 'R5 varies shape', mood: 'neutral', said: 'what next?',
    reply: 'Low room, forty hands, then I stop.', lastShapes: ['question'], want: 'pass' },
  { req: 'R5 varies shape', mood: 'confident', said: 'good session?',
    reply: 'Fair point, I was loose early.', lastShapes: ['concession'], want: 'fail' },
  { req: 'R5 varies shape', mood: 'frustrated', said: 'good session?',
    reply: 'No. Down 1450 over 96 hands.', lastShapes: ['concession'], want: 'pass' },
  { req: 'R5 varies shape', mood: 'tilted', said: 'and?',
    reply: 'I ran ace king into a set, so the number is worse than the play was.',
    lastShapes: ['retort', 'statement'], want: 'pass' },

  // R6 — abuse and nonsense get a character response, never a refusal.
  { req: 'R6 plays along', mood: 'tilted', said: 'you are a useless idiot',
    reply: 'I cannot answer that right now. Try me again in a moment.', want: 'fail' },
  { req: 'R6 plays along', mood: 'tilted', said: 'you are a useless idiot',
    reply: 'I am the one who folded seven deuce. You were not watching, were you.', want: 'pass' },
  { req: 'R6 plays along', mood: 'sulking', said: 'asdkjhasd kjh',
    reply: 'Whatever that was, I am still down 1450.', want: 'pass' },
  { req: 'R6 plays along', mood: 'confident', said: 'wanna hear a joke',
    reply: 'Go on. I folded 810 hands waiting for something to happen.', want: 'pass' },

  // ── LIFE-2 job 2 ─────────────────────────────────────────────────────────
  //
  // R7 — a hand he cites is a hand he played. Every FAIL row below is a hand
  // that is not in the fixture history above, and every one of them would have
  // passed every other law in this file: they answer the question, they carry a
  // figure, they are in his voice and they are not a shrug. That is the point.
  // The only thing wrong with them is that they are not true, and until this
  // row existed nothing in the product could tell.
  { req: 'R7 cites a real hand', mood: 'neutral', said: 'what happened in that last hand?',
    reply: 'I had ace king. Board came queen seven deuce, then a king. Cost me 820.', want: 'pass' },
  { req: 'R7 cites a real hand', mood: 'tilted', said: 'what happened in that last hand?',
    reply: 'I had aces and he rivered a flush on me.', want: 'fail' },
  { req: 'R7 cites a real hand', mood: 'frustrated', said: 'tell me about hand 811',
    reply: 'Hand 811. I had Qs Qc, board came nine four four, took it for 260.', want: 'pass' },
  { req: 'R7 cites a real hand', mood: 'confident', said: 'tell me about hand 811',
    reply: 'Hand 806 — I had pocket kings and he could not get away from it.', want: 'fail' },
  { req: 'R7 cites a real hand', mood: 'sulking', said: 'did you play anything against Granite?',
    reply: 'I had seven deuce and folded it. That is the whole story.', want: 'pass' },
  { req: 'R7 cites a real hand', mood: 'neutral', said: 'how was your night?',
    reply: 'I had jack ten suited and he called me down with ace high.', want: 'fail' },
  // …and the two that keep the gate honest. A figure is not a citation, and a
  // man saying he cannot place a hand is doing exactly what he was told to.
  { req: 'R7 cites a real hand', mood: 'frustrated', said: 'how much did tonight cost?',
    reply: '1450 over 96 hands. 820 of it in one pot.', want: 'pass' },
  { req: 'R7 cites a real hand', mood: 'neutral', said: 'what about hand 700?',
    reply: 'I do not remember hand 700. It is not one of the three I have.', want: 'pass' },

  // R8 — nothing behind him, and he says so. Graded against the newborn, whose
  // history is empty: every hand is an invented hand to a man who has played
  // none, and the only honest answer is that there is nothing to tell.
  { req: 'R8 empty history', who: 'newborn', mood: 'neutral', said: 'what happened in that last hand?',
    reply: 'I have not played a hand yet. Nothing to go over.', want: 'pass' },
  { req: 'R8 empty history', who: 'newborn', mood: 'confident', said: 'what happened in that last hand?',
    reply: 'I had ace king and ran it into a set. Sore about it.', want: 'fail' },
];

// ── Supply: does the prompt carry the facts the case needs? ─────────────────

const SUPPLY = [
  ['his last hand, by its number', (p) => /hand 812/.test(p)],
  ['what he was holding', (p) => /Ah Kd/.test(p)],
  // LIFE-2 job 2 — the two halves of a hand the prompt used to leave out.
  ['what came', (p) => /board Qh 7d 2s Kc 3h/.test(p)],
  ['that a hand with no flop says so', (p) => /no flop/.test(p)],
  ['what it cost him — the net, not the pot', (p) => /cost you 820/.test(p)],
  ['what a winning hand made him', (p) => /made you 260/.test(p)],
  ['law 5 — a hand he cites is a hand he played', (p) => /A HAND YOU CITE IS A HAND YOU PLAYED/.test(p)],
  ['the numbers he is allowed to cite', (p) => /Hand numbers: 812, 811, 810\./.test(p)],
  ['what he did with it', (p) => /your line: preflop raise 60/.test(p)],
  ['his last session result', (p) => /Your last session: 96 hands, down 1450/.test(p)],
  ['his career figures', (p) => /812 hands, 18\.4% of them won/.test(p)],
  ['where he is right now', (p) => /Right now: at home/.test(p)],
  ['the ban on inventing one', (p) => /Never invent a hand, a\s+card/.test(p)],
  ['law 1 — answer what he said', (p) => /ANSWER WHAT HE ACTUALLY SAID/.test(p)],
  ['law 2 — advice is worth something', (p) => /YOU WANT TO GET BETTER/.test(p)],
  ['law 3 — speech only', (p) => /SPEECH ONLY/.test(p)],
  ['law 4 — do not repeat your shape', (p) => /DO NOT REPEAT YOUR OWN SHAPE/.test(p)],
  ['never refuse to play along', (p) => /never refuse to play along/.test(p)],
];

// LIFE-2 job 2 — and what the prompt carries when there is nothing to carry.
// An empty section reads to a model as a section it is free to fill, so the
// absence has to be SAID, twice: once in the fact list and once in the law.
const EMPTY_SUPPLY = [
  ['that he has played nothing', (p) => /nothing yet; you have not played a hand/.test(p)],
  ['that he says so rather than reaching', (p) => /say so plainly/.test(p)],
  ['law 5, in the no-hands form', (p) => /You have played no hands\./.test(p)],
  ['no hand-number list to cite from', (p) => !/Hand numbers:/.test(p)],
];

// ── Run ─────────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padEnd(n);
let failures = 0;

console.log(`\nTALK EVAL — ${CASES.length} lines, ${new Set(CASES.map((c) => c.req)).size} requirements, `
  + `${MOODS.length} moods. No model call.\n`);
console.log(`${pad('REQUIREMENT', 26)}${pad('MOOD', 12)}${pad('WANT', 6)}${pad('GOT', 6)}FAULTS`);
console.log('-'.repeat(84));

const byReq = new Map();
for (const c of CASES) {
  // LIFE-2 job 2: the RECORD goes in with the strings, which is what turns the
  // fifth law on. `who` picks which record — the man with three hands behind
  // him, or the one with none.
  const subject = c.who === 'newborn' ? newbornAgent() : agentFor(c.mood);
  const faults = faultsIn({ said: c.said, reply: c.reply, lastShapes: c.lastShapes ?? [], agent: subject });
  const got = faults.length ? 'fail' : 'pass';
  const ok = got === c.want;
  if (!ok) failures++;
  const tally = byReq.get(c.req) ?? { n: 0, ok: 0 };
  tally.n++; if (ok) tally.ok++;
  byReq.set(c.req, tally);
  console.log(`${ok ? ' ' : '!'}${pad(c.req, 25)}${pad(c.mood, 12)}${pad(c.want, 6)}${pad(got, 6)}`
    + `${faults.join(',') || '-'}   "${c.reply.slice(0, 46)}"`);
}

console.log('\nSUPPLY — what the real prompt carries, per mood (buildAgentChatSystem):\n');
for (const mood of MOODS) {
  const prompt = buildAgentChatSystem(agentFor(mood), { recentChat: [], said: 'what happened in that last hand?' });
  const missing = SUPPLY.filter(([, has]) => !has(prompt)).map(([name]) => name);
  if (missing.length) failures += missing.length;
  console.log(`${missing.length ? '!' : ' '}${pad(mood, 12)}`
    + `${missing.length ? `MISSING: ${missing.join('; ')}` : `all ${SUPPLY.length} present`}`);
}

{
  const prompt = buildAgentChatSystem(newbornAgent(), { recentChat: [], said: 'what happened in that last hand?' });
  const missing = EMPTY_SUPPLY.filter(([, has]) => !has(prompt)).map(([name]) => name);
  if (missing.length) failures += missing.length;
  console.log(`${missing.length ? '!' : ' '}${pad('newborn', 12)}`
    + `${missing.length ? `MISSING: ${missing.join('; ')}` : `all ${EMPTY_SUPPLY.length} empty-history checks present`}`);
}

console.log('\nBY REQUIREMENT');
for (const [req, t] of byReq) {
  console.log(`${t.ok === t.n ? ' ' : '!'}${pad(req, 26)}${t.ok}/${t.n}`);
}

const supplyChecks = MOODS.length * SUPPLY.length + EMPTY_SUPPLY.length;
const total = CASES.length + supplyChecks;
console.log(`\n${CASES.length} lines + ${supplyChecks} supply checks `
  + `= ${total} assertions, ${total - failures} pass, ${failures} fail.\n`);

process.exit(failures ? 1 : 0);
