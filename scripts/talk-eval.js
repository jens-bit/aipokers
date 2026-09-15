// scripts/talk-eval.js — LIFE-1 job 5
//
// `npm run talk:eval` — the lines, the supply behind them, and the voices.
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
// So it evaluates the halves that decide whether a reply CAN be good:
//
//   SUPPLY  — does the prompt this agent would actually be given contain the
//             fact the question needs? Built through the real
//             buildAgentChatSystem, not a copy of it.
//   GATE    — does the deterministic grader catch the reply that fails, and
//             let the reply that works through? Run over hand-written lines,
//             half of them the failure modes from the playtest and half of
//             them what a good answer looks like.
//   VARIETY — LIFE-2 job 4. Do two agents of different natures say the same
//             sentence in the same state? Every nature-keyed table of
//             sentences in the product, imported and walked column by column.
//             A voice that is only distinct because nobody put two of them
//             side by side is not distinct.
//
// A regression in any of them is a regression in the conversation, and all
// three are checkable without a key, in under a second, with byte-identical
// output.
//
// Exit code is 0 when every case behaves as expected and 1 otherwise, so it
// can be run in anger even though nothing runs it automatically.

import {
  faultsIn, shapeOf, selfFacts, talkLaws, isQuestion, answersQuestion, repairReply,
  answerFor, noteFocus, focusOf,
} from '../src/agent/talk.js';
import { buildAgentChatSystem, REST_ACKNOWLEDGEMENTS } from '../src/server/agentProfiles.js';
// LIFE-2 job 4 - every nature-keyed table of sentences in the product, imported
// rather than copied. A copy is a second place to update and therefore a place
// that goes stale without going red.
import { NATURES, firstWordsFor } from '../src/agent/attributes.js';
import { NATURE_OPENERS, SEATED_OPENERS } from '../src/agent/moment.js';
import { NATURE_ACTION_LINE } from '../src/agent/voice.js';
import { NATURE_LINES } from '../src/agent/policyPlay.js';
import { NATURE_WANT_LINES } from '../src/agent/wantVoice.js';
import { SUGGESTIONS } from '../src/server/naming.js';

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
      // LIFE-3 job 1: and `why` — the decisive action, the reason behind it and
      // the state he was in. 812 is the hand from the transcript: the call he
      // lost on, made steaming and worn. It is what "why did you do that" has
      // to be answerable from.
      { handNumber: 812, won: false, potSize: 1450, holeCards: ['Ah', 'Kd'],
        board: ['Qh', '7d', '2s', 'Kc', '3h'], net: -820,
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } },
          { street: 'turn', action: { type: 'call', amount: 400 } }],
        why: { street: 'turn', action: { type: 'call', amount: 400 }, allIn: false,
          reasoning: 'he has been firing every turn, I am not folding top pair',
          heat: 78, stamina: 'worn', moodState: 'tilted' } },
      { handNumber: 811, won: true, potSize: 620, holeCards: ['Qs', 'Qc'],
        board: ['9c', '4d', '4s'], net: 260,
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }],
        why: { street: 'preflop', action: { type: 'raise', amount: 60 }, allIn: false,
          reasoning: 'queens play better heads up', heat: 22, stamina: 'fresh',
          moodState: 'confident' } },
      { handNumber: 810, won: false, potSize: 120, holeCards: ['7h', '2c'],
        board: [], net: -20,
        decisions: [{ street: 'preflop', action: { type: 'fold' } }],
        why: { street: 'preflop', action: { type: 'fold' }, allIn: false,
          reasoning: 'worst hand in the deck', heat: 40, stamina: 'settled',
          moodState: 'neutral' } },
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

// ── LIFE-3 job 2: the man from the transcript ───────────────────────────────
//
// The hand Jens actually asked about: a queen-six he got his stack in with and
// busted on. The R9 rows below quote both halves of that conversation word for
// word, which is the whole reason this fixture exists rather than reusing
// Stone's ace-king — "queen six? the one you just busted on" has to resolve to
// a hand with a queen and a six in it, or the row proves nothing.
function bustedAgent(extra = {}) {
  return {
    ...agentFor('tilted'), id: 'burn', name: 'Burn',
    recentHands: [
      { handNumber: 812, won: false, potSize: 1450, holeCards: ['Qh', '6d'],
        board: ['Qs', '7d', '2s', 'Kc', '3h'], net: -820,
        decisions: [{ street: 'turn', action: { type: 'call', amount: 400 }, allIn: true }],
        why: { street: 'turn', action: { type: 'call', amount: 400 }, allIn: true,
          reasoning: 'he has been firing every street, I put him on a bluff',
          heat: 78, stamina: 'worn', moodState: 'tilted' } },
      { handNumber: 811, won: true, potSize: 620, holeCards: ['Js', 'Td'],
        board: ['9c', '4d', '4s'], net: 260,
        decisions: [{ street: 'preflop', action: { type: 'raise', amount: 60 } }],
        why: { street: 'preflop', action: { type: 'raise', amount: 60 }, allIn: false,
          reasoning: 'suited connector, cheap to see a flop', heat: 30,
          stamina: 'settled', moodState: 'neutral' } },
    ],
    ...extra,
  };
}

// …and the same man, later in the same conversation, having already said it
// once. `chatHistory` is the window the repeat rule reads and it is the one
// agentProfiles already keeps: twelve messages, no new field, no new storage.
function repeatingAgent() {
  return bustedAgent({ chatHistory: [
    { role: 'user', content: 'why did you go all in on that hand?' },
    { role: 'assistant', content: "Don't remember that one, man — which hand you talking about?" },
  ] });
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

  // ── LIFE-3 job 2 ─────────────────────────────────────────────────────────
  //
  // R9 — the dead end. Every FAIL row here is a sentence Jens was actually
  // given on the night of 15 September, quoted word for word, and every one of
  // them passed the whole gate before this tree: they are not refusals (law 6's
  // failure is not the help-desk voice), they are not deflections (they are
  // real questions, so shapeOf calls them questions), and they carry no
  // invented hand because they carry no hand at all. That is what made them
  // invisible. The PASS rows beside them are the same question answered.
  { req: 'R9 no dead end', who: 'busted', mood: 'tilted', said: 'why did you go all in on that hand?',
    reply: "Don't remember that one, man — which hand you talking about?", want: 'fail' },
  { req: 'R9 no dead end', who: 'busted', mood: 'tilted', said: 'why did you go all in on that hand?',
    reply: 'Hand 812, the queen-six. He fired every street and I put him on a bluff. Cost me 820.', want: 'pass' },
  { req: 'R9 no dead end', who: 'busted', mood: 'frustrated', said: 'queen six? the one you just busted on.',
    reply: "Man, I don't know what you're asking about — what happened?", want: 'fail' },
  { req: 'R9 no dead end', who: 'busted', mood: 'frustrated', said: 'queen six? the one you just busted on.',
    reply: 'That is the one. Queen six, board came queen seven deuce, and I could not put it down.', want: 'pass' },
  { req: 'R9 no dead end', who: 'busted', mood: 'sulking', said: 'why???',
    reply: "Man, I don't know what you're asking about — what happened?", want: 'fail' },
  { req: 'R9 no dead end', who: 'busted', mood: 'sulking', said: 'why???',
    reply: 'Because I had him on a bluff and he had the king. 820 says I was wrong.', want: 'pass' },
  // And the one that is not the dead end however much it looks like one: he
  // NAMES the hand he cannot place, which is what law 5 asks for.
  { req: 'R9 no dead end', who: 'busted', mood: 'neutral', said: 'what about hand 700?',
    reply: 'I have no hand 700 on my list. Not one of mine.', want: 'pass' },

  // R10 — and it may never be said twice in one conversation. `repeating` has
  // already said it once, two messages ago. The transcript had it three times,
  // word for word, which is what a character with one string in it sounds like.
  { req: 'R10 never twice', who: 'repeating', mood: 'tilted', said: 'why???',
    reply: "Man, I don't know what you're asking about — what happened?", want: 'fail' },
  { req: 'R10 never twice', who: 'repeating', mood: 'tilted', said: 'why???',
    reply: "Don't remember that one, man — which hand you talking about?", want: 'fail' },
  { req: 'R10 never twice', who: 'repeating', mood: 'tilted', said: 'why???',
    reply: 'The queen-six. I called 400 on the turn with top pair and he had the king.', want: 'pass' },

  // -- LIFE-3 job 3 ---------------------------------------------------------
  //
  // R11 - he owns a bad call. Asked why he made a decision that lost, the
  // answer is the reason he actually had and the state he was actually in, and
  // it ends with him rather than with the deck. The FAIL rows are two of the
  // three ways out of that: the shrug and the refusal. The third - blaming the
  // cards - is a sentence no line grader can catch, because "he had the king"
  // is true; it is caught on the REPAIR side below, where the product writes
  // the line itself and can be held to ending on him.
  { req: 'R11 owns it', who: 'busted', mood: 'tilted', said: 'why did you call there?',
    reply: 'Hand 812. He fired every street so I had him on a bluff, and I was steaming. Cost me 820 and that is on me.', want: 'pass' },
  { req: 'R11 owns it', who: 'busted', mood: 'sulking', said: 'why did you call there?',
    reply: 'Dunno.', want: 'fail' },
  { req: 'R11 owns it', who: 'busted', mood: 'frustrated', said: 'why did you call there?',
    reply: 'I cannot answer that right now. Try me again in a moment.', want: 'fail' },
  { req: 'R11 owns it', who: 'busted', mood: 'tilted', said: 'that was a terrible call',
    reply: 'It was. I had him on a bluff at that price and he had the king. My call, my 820.', want: 'pass' },
  { req: 'R11 owns it', who: 'busted', mood: 'neutral', said: 'were you tilting?',
    reply: 'I was, and I still called. Heat does not get to sign for it, I do.', want: 'pass' },
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
  // LIFE-3 job 1 — the fifth thing a hand is made of, and the one the owner
  // asks about most. It was on the record and stopped at handFact().
  ['WHY he did it', (p) => /because: "he has been firing every turn/.test(p)],
  ['which action the why is about', (p) => /why: you turn called 400/.test(p)],
  ['his heat at the time', (p) => /heat 78/.test(p)],
  ['his stamina at the time', (p) => /I was steaming and I had been sitting there too long/.test(p)],
  ['his last session result', (p) => /Your last session: 96 hands, down 1450/.test(p)],
  ['his career figures', (p) => /812 hands, 18\.4% of them won/.test(p)],
  ['where he is right now', (p) => /Right now: at home/.test(p)],
  ['the ban on inventing one', (p) => /Never invent a hand, a\s+card/.test(p)],
  ['law 1 — answer what he said', (p) => /ANSWER WHAT HE ACTUALLY SAID/.test(p)],
  ['law 2 — advice is worth something', (p) => /YOU WANT TO GET BETTER/.test(p)],
  ['law 3 — speech only', (p) => /SPEECH ONLY/.test(p)],
  ['law 4 — do not repeat your shape', (p) => /DO NOT REPEAT YOUR OWN SHAPE/.test(p)],
  // LIFE-3 job 2 — the law against handing the question back, and the answer to
  // the question it is about. The hand is worked out by the same resolver the
  // gate grades him with, so the prompt and the repair cannot disagree.
  ['law 6 — never ask which hand he means', (p) => /NEVER ASK HIM WHICH HAND HE MEANS/.test(p)],
  ['which hand he is being asked about', (p) => /THE HAND HE IS ASKING ABOUT IS HAND 812 — the ace-king/.test(p)],
  ['that he was not told one, so it is the notable one', (p) => /the hand your night turned on/.test(p)],
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
  // LIFE-3 job 2 — law 6 is stated to him too, but no hand is named, because
  // there is none to name. A pointer at a hand he has not played would be the
  // prompt itself inventing one.
  ['law 6, with no hand pointed at', (p) => /NEVER ASK HIM WHICH HAND HE MEANS/.test(p) && !/THE HAND HE IS ASKING ABOUT/.test(p)],
];

// ── Run ─────────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padEnd(n);
let failures = 0;

console.log(`\nTALK EVAL — ${CASES.length} lines, ${new Set(CASES.map((c) => c.req)).size} requirements, `
  + `${MOODS.length} moods. No model call.\n`);
console.log(`${pad('REQUIREMENT', 26)}${pad('MOOD', 12)}${pad('WANT', 6)}${pad('GOT', 6)}FAULTS`);
console.log('-'.repeat(84));

// LIFE-3 job 2 — one place the `who` column resolves, so a row cannot name a
// character that does not exist and quietly get the default one instead.
const SUBJECTS = { newborn: newbornAgent, busted: bustedAgent, repeating: repeatingAgent };

const byReq = new Map();
for (const c of CASES) {
  // LIFE-2 job 2: the RECORD goes in with the strings, which is what turns the
  // fifth law on. `who` picks which record — the man with three hands behind
  // him, or the one with none.
  const subject = SUBJECTS[c.who]?.() ?? agentFor(c.mood);
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

// -- LIFE-3 job 3: what he is handed when the line fails ---------------------
//
// The GATE half of this eval grades sentences somebody wrote. This grades the
// sentence the PRODUCT writes - the repair, which is what the owner actually
// reads whenever the model's line is rejected. It has been checked by hand
// since LIFE-1 and never by anything that runs.
//
// Three claims per row, and the last is the one that matters: the repair must
// survive its own gate. A product that answers with a line it would itself
// reject has two opinions about what a good reply is.
const REPAIRS = [
  ['the hand he was asked about, by name', 'busted', 'why did you go all in on that hand?',
    (line) => /Hand 812, the queen-six/.test(line)],
  ['the decisive action, not the first one', 'busted', 'why did you call there?',
    (line) => /I put it all in on the turn/.test(line)],
  ['his own reason, verbatim off the record', 'busted', 'why???',
    (line) => /I put him on a bluff/.test(line)],
  ['his heat at the time, said out loud', 'busted', 'why???',
    (line) => /I was steaming/.test(line)],
  ['and he owns it, after the heat and not instead of it', 'busted', 'why???',
    (line) => /that one is on me/.test(line) && line.indexOf('steaming') < line.indexOf('on me')],
  ['never the cards alone', 'busted', 'why???',
    (line) => !/\b(?:ran bad|unlucky|bad beat|variance|nothing i could do)\b/i.test(line)],
  ['a hand he does not have is named, not shrugged at', 'busted', 'what about hand 700?',
    (line) => /no hand 700/.test(line)],
  ['nothing behind him is said plainly', 'newborn', 'why did you shove?',
    (line) => line === 'I have not played a hand yet. Nothing to go over.'],
];

console.log('\nREPAIR - the line the product writes when the model\'s is rejected:\n');
for (const [name, who, said, ok] of REPAIRS) {
  const subject = SUBJECTS[who]();
  const line = repairReply(subject, { said, faults: ['deflection'] });
  const good = typeof line === 'string' && ok(line);
  // ...and it must pass the gate that produced it.
  const back = line ? faultsIn({ said, reply: line, agent: subject }) : ['empty'];
  if (!good) failures++;
  if (back.length) failures++;
  console.log(`${good && !back.length ? ' ' : '!'}${pad(name, 54)}`
    + `${back.length ? `REJECTED BY ITS OWN GATE: ${back.join(',')} ` : ''}"${String(line).slice(0, 60)}"`);
}

// -- LIFE-3 job 4: does the thread hold? -------------------------------------
//
// The rows above each grade ONE message. This walks a conversation, because
// the failure it is written against only exists across turns: Jens asked a
// question, was answered, said "why???" - and got a man who had never heard of
// the hand. A follow-up is a follow-up to the last answer, and nothing in this
// eval could see a last answer until now.
//
// Each thread is a list of messages; each row says which hand he should be
// talking about by the end of that message, `null` meaning the subject has
// genuinely been dropped. Driven through answerFor + noteFocus, which is
// exactly the pair agentProfiles calls per owner message and in that order.
const THREADS = [
  ['he names a hand, then only says why',
    'busted',
    [['tell me about hand 811', 811], ['why???', 811], ['why that', 811]]],
  ['he names none, and the thread holds the hand it found',
    'busted',
    [['why did you go all in on that hand?', 812], ['why???', 812], ['and?', 812]]],
  ['he moves to another hand, and the follow-up moves with him',
    'busted',
    [['why did you go all in on that hand?', 812], ['what about the jack-ten?', 811], ['why', 811]]],
  ['he changes the subject, and the hand is let go',
    'busted',
    [['tell me about hand 811', 811], ['are you hungry?', null], ['why', 812]]],
  ['he asks about a hand that is not his, and the old one does not come back',
    'busted',
    [['tell me about hand 811', 811], ['what about hand 700?', null], ['why', 812]]],
];

console.log('\nTHREAD - one hand, carried across turns until he changes the subject:\n');
for (const [name, who, turns] of THREADS) {
  const subject = SUBJECTS[who]();
  const trail = [];
  let bad = null;
  for (const [said, want] of turns) {
    const answer = answerFor(subject, said);
    noteFocus(subject, { said, answer });
    const got = answer.hand ? Number(answer.hand.handNumber) : focusOf(subject);
    trail.push(`${said} -> ${got ?? '-'}`);
    if (got !== want && bad === null) bad = `"${said}" wanted ${want ?? 'none'}, got ${got ?? 'none'}`;
  }
  if (bad) failures++;
  console.log(`${bad ? '!' : ' '}${pad(name, 74)}${bad || trail.join('  |  ')}`);
}

console.log('\nBY REQUIREMENT');
for (const [req, t] of byReq) {
  console.log(`${t.ok === t.n ? ' ' : '!'}${pad(req, 26)}${t.ok}/${t.n}`);
}

// ── LIFE-2 job 4: two natures must not be the same man ──────────────────────
//
// Not a line grader and not a supply check — a TABLE AUDIT, and it belongs in
// this file because this is the file somebody runs after touching what an agent
// says. It walks every nature-keyed table of SENTENCES in the product and fails
// when two different natures in the same state emit the same one.
//
// "The same state" is one column of one table: the same ask kind, the same
// action, the same seated/standing flag. A nature-keyed table of POSES is
// deliberately not here — four idle habits across eight natures is home.js's
// design, and a pose is not a sentence.
//
// The tables are IMPORTED, not copied. A copy is a second place to update and
// therefore a place that goes stale without going red.

function column(name, byNature) {
  return { name, byNature };
}

function spread(name, table, keys) {
  return keys.map((k) => column(`${name}:${k}`, Object.fromEntries(
    Object.keys(table).map((n) => [n, table[n][k]]),
  )));
}

const NATURE_NAMES = NATURES.map((n) => n.name);
const byName = (pick) => Object.fromEntries(NATURE_NAMES.map((n) => [n, pick(n)]));

const VOICE_COLUMNS = [
  // attributes.js — the four sentences the birth card is built out of.
  column('birth: first words', byName((n) => firstWordsFor(n))),
  column('birth: signature', byName((n) => NATURES.find((x) => x.name === n).sig)),
  column('birth: announcement', byName((n) => NATURES.find((x) => x.name === n).line)),
  column('birth: built for', byName((n) => NATURES.find((x) => x.name === n).builtFor)),
  column('birth: will struggle', byName((n) => NATURES.find((x) => x.name === n).struggle)),
  // moment.js — the thread's first line, standing and seated.
  column('opener: standing', NATURE_OPENERS),
  column('opener: seated', SEATED_OPENERS),
  // agentProfiles.js — what he says when you bench him.
  column('rest: acknowledgement', REST_ACKNOWLEDGEMENTS),
  // voice.js — the line under his ghost on the felt. LIFE-2 job 4 keyed this
  // table on nature; before that every agent in the product shared five
  // clauses, and since COST-1 the policy path reaches them on a large share of
  // all decisions.
  ...spread('felt line', NATURE_ACTION_LINE, ['fold', 'check', 'call', 'bet', 'raise']),
  // wantVoice.js — LIFE-2 job 1.
  ...spread('want', NATURE_WANT_LINES, Object.keys(NATURE_WANT_LINES.Rock)),
];

console.log('\nVOICE VARIETY — one row per state, eight natures each. No two alike.\n');
for (const { name, byNature } of VOICE_COLUMNS) {
  const seen = new Map();
  const bad = [];
  for (const nature of NATURE_NAMES) {
    const line = byNature[nature];
    if (line == null || line === '') { bad.push(`${nature} has no line`); continue; }
    if (seen.has(line)) bad.push(`${seen.get(line)} = ${nature}: "${line}"`);
    seen.set(line, nature);
  }
  failures += bad.length;
  console.log(`${bad.length ? '!' : ' '}${pad(name, 26)}${bad.length ? bad.join(' | ') : 'all 8 distinct'}`);
}

// The pooled tables — several alternates per nature per state — get the same
// rule across the whole pool: no line may belong to two natures.
const POOLED = [
  ['table talk', NATURE_LINES, ['fold', 'check', 'call', 'bet', 'raise']],
  ['name suggestions', SUGGESTIONS, null],
];
for (const [name, table, keys] of POOLED) {
  const owner = new Map();
  const bad = [];
  for (const nature of Object.keys(table)) {
    const pools = keys ? keys.map((k) => table[nature][k]) : [table[nature]];
    for (const pool of pools) {
      for (const line of pool ?? []) {
        if (owner.has(line) && owner.get(line) !== nature) bad.push(`${owner.get(line)} = ${nature}: "${line}"`);
        owner.set(line, nature);
      }
    }
  }
  failures += bad.length;
  console.log(`${bad.length ? '!' : ' '}${pad(name, 26)}${bad.length ? bad.join(' | ') : `${owner.size} lines, none shared`}`);
}

// And the two surfaces a single policy decision can light at once: the public
// bubble over his seat (policyPlay) and the private line under his ghost
// (voice). They may not print the same sentence in the same beat — that reads
// as a bug rather than as a character.
{
  const bubbles = new Set();
  for (const nature of Object.keys(NATURE_LINES)) {
    for (const k of ['fold', 'check', 'call', 'bet', 'raise']) {
      for (const line of NATURE_LINES[nature][k] ?? []) bubbles.add(line);
    }
  }
  const clash = [];
  for (const nature of Object.keys(NATURE_ACTION_LINE)) {
    for (const k of ['fold', 'check', 'call', 'bet', 'raise']) {
      const line = NATURE_ACTION_LINE[nature][k];
      if (bubbles.has(line)) clash.push(`${nature}/${k}: "${line}"`);
    }
  }
  failures += clash.length;
  console.log(`${clash.length ? '!' : ' '}${pad('felt line vs bubble', 26)}`
    + `${clash.length ? clash.join(' | ') : 'disjoint — one decision never says it twice'}`);
}

const supplyChecks = MOODS.length * SUPPLY.length + EMPTY_SUPPLY.length;
const varietyChecks = VOICE_COLUMNS.length + POOLED.length + 1;
const repairChecks = REPAIRS.length * 2;   // what it says, and that it survives its own gate
const threadChecks = THREADS.length;      // one per conversation, each of three turns
const total = CASES.length + supplyChecks + varietyChecks + repairChecks + threadChecks;
console.log(`\n${CASES.length} lines + ${supplyChecks} supply checks + ${varietyChecks} variety checks `
  + `+ ${repairChecks} repair checks + ${threadChecks} threads
  = ${total} assertions, ${total - failures} pass, ${failures} fail.\n`);

process.exit(failures ? 1 : 0);
