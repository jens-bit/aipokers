// src/server/auditChipsCli.test.js — CHIPS-1
//
// The CLI half of scripts/audit-chips.js, spawned for real rather than
// imported — argv parsing, exit codes, and the report wording only exist at
// that layer. (The arithmetic itself is auditChips.test.js.)
//
// Two guarantees this locks in, because both were broken before CHIPS-1:
//
//   1. THE DEFAULT RUN IS CLEAN NO MATTER WHAT IS SITTING IN THE CALLER'S
//      data/app.db. With no --db, the script builds and seeds its own
//      scratch database instead of defaulting to ./data/app.db — three tabs
//      had separately hit a red `node scripts/audit-chips.js` that was
//      nothing but old Playwright fixture leftovers (home2-item-*,
//      visit-referral-host, ...) accumulated by manual browser-driven specs
//      that draft real agents through /api/agents/build and never clean up
//      after themselves. This test proves the default no longer looks at
//      that directory at all, by running it from a cwd whose data/app.db is
//      deliberately full of exactly that kind of unexplained balance.
//   2. THE SCRATCH DEFAULT DID NOT MAKE THE CHECK TOOTHLESS. Pointed with
//      --db at a database that really does have chips from nowhere, it still
//      fails and names the owner.
//
// No model calls: this script never makes one, so there is nothing to strip
// from the child's environment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SCRIPT = fileURLToPath(new URL('../../scripts/audit-chips.js', import.meta.url));

function run(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', ...opts });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: err.stdout?.toString() ?? '' };
  }
}

/** A database with one owner whose balance the ledger does not explain. */
function buildMintedDb(file, ownerId) {
  const Database = require('better-sqlite3');
  const d = new Database(file);
  try {
    d.exec(`
      CREATE TABLE profiles (owner_id TEXT PRIMARY KEY);
      CREATE TABLE wallets (
        owner_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0,
        earned INTEGER NOT NULL DEFAULT 0, ledger TEXT NOT NULL DEFAULT '[]',
        starting_grant_claimed INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE agents (owner_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    `);
    d.prepare('INSERT INTO profiles (owner_id) VALUES (?)').run(ownerId);
    // Balance claims 9,000; the ledger only ever explains 4,000. The other
    // 5,000 came from nowhere — no code path in this fixture put it there.
    d.prepare(
      'INSERT INTO wallets (owner_id, balance, earned, ledger, starting_grant_claimed) VALUES (?, ?, ?, ?, ?)',
    ).run(ownerId, 9_000, 0, JSON.stringify([{ type: 'seed', amount: 4_000, ts: 1 }]), 0);
  } finally {
    d.close();
  }
}

test('CHIPS-1: the default run seeds its own scratch database and ignores a dirty local data/app.db', () => {
  const dirtyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-chips-dirty-cwd-'));
  fs.mkdirSync(path.join(dirtyCwd, 'data'));
  buildMintedDb(path.join(dirtyCwd, 'data', 'app.db'), 'home2-item-99');

  try {
    const { status, stdout } = run([], { cwd: dirtyCwd });
    assert.equal(status, 0, `expected the scratch default to pass; got:\n${stdout}`);
    assert.match(stdout, /fresh scratch database, seeded by this script/);
    assert.match(stdout, /books: every uncapped ledger explains its own balances\./);
    assert.doesNotMatch(stdout, /home2-item-99/, 'must never have opened the dirty local db');
  } finally {
    fs.rmSync(dirtyCwd, { recursive: true, force: true });
  }
});

test('CHIPS-1: --db against chips minted from nowhere still fails and names the owner', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-chips-minted-'));
  const file = path.join(scratch, 'app.db');
  buildMintedDb(file, 'minted-owner');

  try {
    const { status, stdout } = run(['--db', file]);
    assert.equal(status, 1, `expected the minted-chip owner to fail the audit; got:\n${stdout}`);
    assert.match(stdout, /minted-owner: balances 9,000, ledger 4,000, unexplained 5,000/);
    // The two-failure-case wording: pointed at a real file, the script must
    // not claim certainty either way — it hands the reader the way to check.
    assert.match(stdout, /This file was NOT built by this script/);
    assert.match(stdout, /`node scripts\/audit-chips\.js` with no --db/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('CHIPS-1: the scratch self-check failing would say so is a real bug, not old data', async () => {
  // There is no way to make the scratch seed itself unbalanced from the
  // outside, so this asserts on the report()/wording contract directly:
  // the "scratch" branch of the message never blames local test data.
  const { report } = await import('../../scripts/audit-chips.js');
  const broken = {
    owners: [{ ownerId: 'scratch-owner', diff: 5_000, ledgerCapped: false, safe: 9_000, pockets: 0, ledger: 4_000,
      live: null, liveUnknown: 0, seatedClaimed: 0, total: 9_000, openBuyIns: 0, earned: 0,
      startingGrantClaimed: false, grantEntries: 0, grantTotal: 0, agents: [] }],
    totals: { safe: 9_000, pockets: 0, live: null, houseBank: 0, chipsInExistence: 9_000,
      ledger: 4_000, diff: 5_000, owners: 1, anyLedgerCapped: false },
  };
  const text = report(broken, { file: '/tmp/whatever/app.db', scratch: true });
  assert.match(text, /THIS SCRIPT JUST BUILT AND SEEDED ITSELF/);
  assert.match(text, /That is a real bug\. Fix the code\./);
  assert.doesNotMatch(text, /old manual fixture run/);
});
