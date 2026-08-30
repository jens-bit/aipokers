// src/agent/reference.test.js — CACHE-1
// Two things to pin:
//   1. The DEFAULT decision prompt is byte-identical to the one that shipped
//      before CACHE-1. This is the "decision semantics must not change"
//      guarantee, and it is checked against a literal copy of the old string
//      rather than against the code that builds it.
//   2. The invariant block clears Haiku 4.5's 4096-token cacheable minimum,
//      approximated here by character count so the test needs no API call.
// Run: node src/agent/reference.test.js

import { legacySystemText } from './handler.js';
import { NLHE_REFERENCE, OUTPUT_CONTRACT } from './reference.js';

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const STRATEGY = 'You are a disciplined tight-aggressive player. Open raise premium hands.';
const MEMORY = '\n\nYour self-knowledge from past sessions:\nYou fold too often as an equity favorite.';

// A verbatim transcription of the pre-CACHE-1 buildSystem() output. Kept as a
// literal so a future edit to handler.js cannot silently redefine "unchanged".
const PRE_CACHE1 = `${STRATEGY}${MEMORY}

You are playing No-Limit Texas Hold'em poker.
Respond with ONLY a single-line JSON object — no prose outside the JSON, no markdown.

JSON format (the "amount" key is required for bet/raise, omit otherwise):
{"action":{"type":"<fold|check|call|bet|raise>","amount":<integer>},"reasoning":"<one short sentence>"}

For bet/raise, "amount" is the TOTAL chips you want committed this street
(your existing contribution plus any additional you're putting in now).

The "reasoning" field is required for every decision: one punchy sentence,
max 12 words, why you made this specific decision right now.`;

console.log('\n1) the default prompt is unchanged from before CACHE-1');
{
  const actual = legacySystemText(STRATEGY, MEMORY);
  check('default system text is byte-identical', actual === PRE_CACHE1,
    actual === PRE_CACHE1 ? '' : `length ${actual.length} vs ${PRE_CACHE1.length}`);
  check('strategy still comes FIRST', actual.startsWith(STRATEGY));
  check('memory still follows the strategy', actual.indexOf(MEMORY) === STRATEGY.length);
  check('format contract still comes last', actual.trimEnd().endsWith('why you made this specific decision right now.'));
  // Persona-first is load-bearing: a 150-pair arena run with the strategy moved
  // behind the format contract dropped the Calling Station's VPIP 94.6 -> 76.7.
  check('format contract does not precede the persona',
    actual.indexOf('You are playing No-Limit') > actual.indexOf(STRATEGY));
}

console.log('\n2) no-memory case');
{
  const actual = legacySystemText(STRATEGY, '');
  check('empty memory contributes nothing', actual === `${STRATEGY}\n\n${OUTPUT_CONTRACT}`);
  check('a default strategy is substituted when absent', legacySystemText('', '').startsWith('You are a solid, balanced poker player'));
}

console.log('\n3) the invariant block clears the Haiku 4.5 cacheable floor');
{
  // messages.count_tokens measured the real block at 4157 tokens against a
  // 4096 floor — only 61 tokens of headroom, so guard the length here. English
  // prose runs ~3.6-4.2 chars/token; 16000 chars is a conservative floor for
  // 4096 tokens and leaves room for wording edits without a live API call.
  const invariant = `${NLHE_REFERENCE}\n\n${OUTPUT_CONTRACT}`;
  check('invariant block is long enough to cache', invariant.length >= 16000,
    `${invariant.length} chars — re-measure with messages.count_tokens before trusting this`);
  check('reference documents the amount convention', /TOTAL you want committed on this street/i.test(NLHE_REFERENCE));
  check('reference documents every briefing line',
    ['EQUITY','POT ODDS','SPR','RANGE','BLUFF DIE','SIZING','RAISES THIS STREET','OPPONENT READ','EXPLOIT','STATE']
      .every((k) => NLHE_REFERENCE.includes(k)));
  check('reference restates the showdown law', /never a reason to fold more/i.test(NLHE_REFERENCE));
  check('reference carries worked examples with JSON', (NLHE_REFERENCE.match(/\{"action":/g) ?? []).length >= 4);
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all reference checks passed');
  process.exitCode = 0;
} else {
  console.error(`${failures} reference checks failed`);
  process.exitCode = 1;
}
