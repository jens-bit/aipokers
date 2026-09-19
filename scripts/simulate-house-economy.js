// Reproducible actual-House benchmark. All files, if any, are scratch-owned.
// node scripts/simulate-house-economy.js --sessions 30 --seeds 3 --iterations 120
// --opponent tilted_ted is an explicit counterfactual, never a production edit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

if (process.env.ANTHROPIC_API_KEY) throw new Error('Unset ANTHROPIC_API_KEY: this benchmark never makes model calls');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const count = (name, fallback) => { const n = Number(arg(name, fallback)); if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid --${name}`); return n; };
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-house-economy-'));
process.chdir(scratch);
process.env.NOTIFY_ENABLED = '0';
const { playHouseSession, summarizeSessions, projectHouseholds, STARTER_PROFILES, currentRake } = await import('../src/server/economyBenchmark.js');
const sourceHashes = Object.fromEntries(['../src/server/economyBenchmark.js', '../src/server/houseCast.js', '../src/server/table.js', '../src/engine/game.js', '../src/agent/policyPlay.js'].map(file =>
  [file, createHash('sha256').update(fs.readFileSync(new URL(file, import.meta.url))).digest('hex')]));
const config = { seed: count('seed', 20260919), seeds: count('seeds', 3), sessions: count('sessions', 30), hands: count('hands', 100),
  iterations: count('iterations', 120), profile: arg('profile', 'balanced'), opponent: arg('opponent', null),
  rungs: arg('rungs', '0,1,2').split(',').map(Number) };
if (!STARTER_PROFILES[config.profile]) throw new Error('Unknown starter profile');
if (arg('percent', null) !== null) process.env.RAKE_PERCENT = arg('percent');
if (arg('cap', null) !== null) process.env.RAKE_CAP_BB = arg('cap');
const byRung = {}, bySeed = [];
for (const rung of config.rungs) {
  byRung[rung] = [];
  for (let seedIndex = 0; seedIndex < config.seeds; seedIndex++) {
    const sessions = [];
    for (let session = 0; session < config.sessions; session++) {
      const seed = (config.seed + seedIndex * 104729 + session * 7919) >>> 0;
      const out = playHouseSession({ ...config, seed, rung, profile: STARTER_PROFILES[config.profile] });
      sessions.push(out); byRung[rung].push(out);
      if ((session + 1) % 10 === 0) console.error(`rung${rung} seed${seedIndex + 1}: ${session + 1}/${config.sessions} sessions`);
    }
    const summary = summarizeSessions(sessions, rung);
    bySeed.push({ seed: config.seed + seedIndex * 104729, ...summary });
    console.error(`rung${rung} seed${seedIndex + 1}: ${summary.hands} hands, ${summary.netBb100.toFixed(2)}bb/100 net, ${summary.rakeBb100.toFixed(2)} rake`);
  }
}
const projection = byRung[0] ? projectHouseholds(byRung, { seed: config.seed ^ 0xc2b2ae35, sessions: count('horizon', 100), progress: config.rungs.length === 3 }) : null;
console.log(JSON.stringify({ config, sourceHashes, rake: currentRake(), summaries: config.rungs.map(r => summarizeSessions(byRung[r], r)), bySeed, projection,
  sessions: Object.fromEntries(Object.entries(byRung).map(([rung, sessions]) => [rung, sessions.map(({ deltas, ...s }) => s)])),
  limits: ['Compiled policy only; no watched-model decisions.', 'Rested numeric starter policy; no fatigue, drinks, learned model memory or growth.',
    'Heads-up vs production-selected House, refilled after busts. No other owners.', 'Survival/slots are resampled-session projections, not more played hands or promised calendar days.'] }, null, 2));
