// Sanity tests for the Monte Carlo equity engine. Run with:
//   node src/engine/equity.test.js

import assert from 'node:assert';
import { estimateEquity } from './equity.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

console.log('\n— AA preflop vs 1 opponent (~85%) —');
{
  const { equity, iterations } = estimateEquity({
    holeCards: ['As', 'Ah'],
    community: [],
    nOpponents: 1,
    iterations: 3000,
  });
  console.log(`  AA equity: ${(equity * 100).toFixed(1)}%  (n=${iterations})`);
  check('AA preflop ~ 0.85 ± 0.03', equity > 0.82 && equity < 0.88);
}

console.log('\n— 72o preflop vs 1 opponent (~35%) —');
{
  const { equity } = estimateEquity({
    holeCards: ['7c', '2d'],
    community: [],
    nOpponents: 1,
    iterations: 3000,
  });
  console.log(`  72o equity: ${(equity * 100).toFixed(1)}%`);
  check('72o preflop is a dog (< 0.42)', equity < 0.42);
}

console.log('\n— board-locked nuts (quad aces, king kicker) —');
{
  const { equity } = estimateEquity({
    holeCards: ['Ah', 'Ad'],
    community: ['As', 'Ac', 'Kh', 'Kd', '2c'],
    nOpponents: 1,
    iterations: 200,
  });
  console.log(`  quads equity: ${equity}`);
  check('quads on a paired board = 1.0', equity === 1);
}

console.log('\n— dead hand (drawing to a chop or loss) —');
{
  // Hero has 2h2c on a board of AsKsQsJsTs — hero cannot make anything better
  // than the royal flush already on the board, so equity vs a live opponent
  // depends only on whether the opponent has a heart (chop) or not (chop too,
  // since board plays). Everyone chops: equity == 0.5.
  const { equity } = estimateEquity({
    holeCards: ['2h', '2c'],
    community: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    nOpponents: 1,
    iterations: 200,
  });
  console.log(`  chop equity: ${equity}`);
  check('board plays → chop = 0.5', equity === 0.5);
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all equity checks passed');
  process.exit(0);
} else {
  console.error(`${failures} equity checks failed`);
  process.exit(1);
}
