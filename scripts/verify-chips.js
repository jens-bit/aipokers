#!/usr/bin/env node
// scripts/verify-chips.js — BNK-3 chip conservation assertion
//
// Usage: node scripts/verify-chips.js
//
// Reads the agent store and verifies that each agent's stored bankroll equals
// the sum implied by its ledger (grants - buyins + cashouts). Prints a summary
// and exits non-zero when any mismatch is found.
//
// Full chip conservation (bankrolls + active-table chips == total grants)
// requires access to live table state; this offline script checks the ledger
// consistency invariant, which is the part that can be verified from disk.
//
// SQLITE-1: the source is now data/app.db rather than data/agents.json. This
// stays an operational check against the machine's real data (npm run
// test:data), so it deliberately resolves the repo root rather than cwd — it
// is excluded from `npm test` for exactly that reason.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);   // store.js resolves data/ from cwd

const { loadAgentStore, _dbPath } = await import('../src/server/store.js');

// A read-only check must not be the thing that migrates live data: opening the
// store would import data/agents.json and rename it. Boot the server once
// (`npm start`) and the migration happens there, where it is logged.
if (!fs.existsSync(path.join(ROOT, 'data', 'app.db'))) {
  const legacy = fs.existsSync(path.join(ROOT, 'data', 'agents.json'));
  console.error(`Cannot read ${path.join(ROOT, 'data', 'app.db')}: no database on this machine.`);
  if (legacy) console.error('data/agents.json is still here — start the server once to migrate it, then re-run.');
  process.exit(1);
}

let store;
try {
  store = loadAgentStore();
} catch (err) {
  console.error(`Cannot read ${_dbPath()}:`, err.message);
  process.exit(1);
}

let totalAgents = 0;
let totalBankroll = 0;
let totalGrants = 0;
let mismatches = 0;

for (const [userId, profile] of Object.entries(store)) {
  for (const agent of (profile.agents || [])) {
    totalAgents++;
    const ledger = Array.isArray(agent.ledger) ? agent.ledger : [];
    const grants   = ledger.filter((e) => e.type === 'grant').reduce((s, e) => s + (e.amount || 0), 0);
    const buyins   = ledger.filter((e) => e.type === 'buyin').reduce((s, e) => s + (e.amount || 0), 0);
    const cashouts = ledger.filter((e) => e.type === 'cashout').reduce((s, e) => s + (e.amount || 0), 0);
    const ledgerBalance = grants - buyins + cashouts;
    const stored = typeof agent.bankroll === 'number' ? agent.bankroll : null;

    totalGrants   += grants;
    totalBankroll += stored ?? 0;

    if (stored === null) {
      console.warn(`  WARN  ${agent.name ?? agent.id} (user ${userId}): no bankroll field (run server to migrate)`);
      continue;
    }
    if (Math.abs(ledgerBalance - stored) > 0) {
      console.error(`  FAIL  ${agent.name ?? agent.id} (user ${userId}): ledger=${ledgerBalance} stored=${stored} diff=${stored - ledgerBalance}`);
      mismatches++;
    }
  }
}

console.log(`\nAgents checked : ${totalAgents}`);
console.log(`Total grants   : ${totalGrants.toLocaleString()} chips`);
console.log(`Total bankrolls: ${totalBankroll.toLocaleString()} chips`);
console.log(`Mismatches     : ${mismatches}`);
if (mismatches > 0) {
  console.error('\nChip ledger INCONSISTENT — investigate before deploying.');
  process.exit(1);
} else {
  console.log('\nLedger consistent. (Add active-table chip sums to bankrolls to verify totalGrants == total chips.)');
}
