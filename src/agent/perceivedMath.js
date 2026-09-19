import { perceiveEquity } from './attributes.js';

// The model briefing, free policy and hand record share one perception of
// the true snapshot. Never rewrite gs.equity/potOdds: later callers must not
// apply FOCUS noise to a number that has already been distorted.
export function perceivedMath(gs) {
  const seed = `${gs?.handNumber ?? 0}:${gs?.seat ?? 0}:${gs?.street}:${(gs?.holeCards ?? []).join('')}:${(gs?.community ?? []).join('')}`;
  const focus = gs?.attrs?.FOCUS ?? null;
  return {
    seed,
    equity: perceiveEquity(gs?.equity, focus, `${seed}:eq`),
    potOdds: perceiveEquity(gs?.potOdds, focus, `${seed}:po`),
  };
}
