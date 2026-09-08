// scripts/measure-tokens.js — COST-2 job 1
//
// The prompt's size, across a deck of spots, without spending a cent.
//
// NO MODEL CALLS. The key is stripped exactly the way verify-growth.js strips
// it, and estimateCallTokens only ever builds strings — it never reaches
// providers/index.js. What this prints is the median (and p90) of the static
// system prompt and the per-hand dynamic prompt, in estimated tokens
// (chars/4 — see tokenEstimate.js), across the 200-spot fixture deck job 2
// also uses for its determinism check.
//
// Usage:
//   node scripts/measure-tokens.js
//   node scripts/measure-tokens.js --n 500 --seed 11

const HAD_KEY = !!process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

import { estimateCallTokens } from '../src/agent/handler.js';
import { sampleGameStates } from '../src/agent/fixtures/sampleGameStates.js';
import { median, percentile } from '../src/agent/tokenEstimate.js';

function parseArgs(argv) {
  const out = { n: 200, seed: 42 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--n') out.n = parseInt(argv[++i], 10);
    else if (argv[i] === '--seed') out.seed = parseInt(argv[++i], 10);
  }
  return out;
}
const args = parseArgs(process.argv);

console.log('═══ COST-2 job 1 · prompt token measurement (estimated, chars/4) ═══\n');
console.log(`  spots: ${args.n}   seed: ${args.seed}`);
console.log(`  ANTHROPIC_API_KEY: ${HAD_KEY ? 'was set — REMOVED for this run' : 'not set'}\n`);

const spots = sampleGameStates(args.n, args.seed);
const STRATEGY = 'You are a solid, balanced poker player. Play tight-aggressive.';

const staticTokens = [];
const dynamicTokens = [];
for (const gs of spots) {
  const est = estimateCallTokens(gs, STRATEGY, '');
  staticTokens.push(est.staticTokens);
  dynamicTokens.push(est.dynamicTokens);
}

function report(label, values) {
  console.log(
    `  ${label.padEnd(9)} median ${String(median(values)).padStart(5)}   ` +
    `p90 ${String(percentile(values, 90)).padStart(5)}   ` +
    `min ${String(Math.min(...values)).padStart(5)}   ` +
    `max ${String(Math.max(...values)).padStart(5)}`,
  );
}

report('static', staticTokens);
report('dynamic', dynamicTokens);
console.log(
  `  ${'output'.padEnd(9)} capped at 200 (maxTokens) — no call was made, so there is ` +
  'no measured value; see CORE_GAME_PLAN.md ACCEPT-1/arena runs for observed averages.',
);

console.log(`\n  static + dynamic median: ${median(staticTokens) + median(dynamicTokens)} tokens`);
console.log('[measure-tokens] done — no model was called');
