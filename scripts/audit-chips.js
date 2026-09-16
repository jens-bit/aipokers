#!/usr/bin/env node
// scripts/audit-chips.js — MONEY-1 job 2
//
// READ-ONLY chip reconciliation. Given a database, print for every owner:
//
//   safe        the wallet balance
//   pockets     the sum of his agents' pocket balances
//   live        the sum of his agents' stacks at tables that are still running
//   total       safe + pockets + live
//   ledger      the signed sum of every entry on the wallet ledger AND on
//               every pocket ledger
//   diff        (safe + pockets) − ledger, i.e. do the books explain the money
//
// and then the household-level question the playtest actually asked: is
// anything still minting chips, or are the big balances the fossil of a bug
// that has already been fixed?
//
// ── Three things to know before reading a number off this ────────────────────
//
// 1. IT NEVER WRITES TO A DATABASE YOU GIVE IT. Pointed at a real file with
//    --db, it opens SQLite readonly and does not go through store.js at all,
//    because store.js's conn() applies the schema and imports data/agents.json
//    on first use. An audit that migrates the thing it is auditing is not an
//    audit. Consequence: that file must already exist; this tool will not
//    create or upgrade one.
//
// 2. WITH NO --db, IT NEVER TOUCHES YOUR DATABASE AT ALL. The default target
//    is a scratch SQLite file this script builds and seeds itself, in a temp
//    directory, and deletes when it exits. CHIPS-1: a developer's real local
//    data/app.db accumulates fixture agents from every Playwright spec anyone
//    has ever pointed at a running `npm start` (home2.spec.js, verify-*.js —
//    they draft through the real /api/agents/build, there is no test-only
//    path) with nothing that ever cleans them up. Three tabs each lost time
//    to a red run that was that leftover local data, not a bug. Making the
//    default self-contained means `node scripts/audit-chips.js` answers "did
//    the reconciliation engine mint or lose a chip" and nothing about whose
//    laptop it runs on. --db is still how you point it at a real file,
//    including your own data/app.db, when that's the question you're asking.
//
// 3. A TABLE STACK IS NOT PERSISTED. `live` is zero from a cold read of a
//    database, because nothing anywhere stores what an agent has in front of
//    him — see read-me-claude/MONEY_AUDIT.md §4. Running against a file, the
//    script says how many agents CLAIM to be playing and prices the chips it
//    cannot see at one buy-in each, as `liveUnknown`. To get the real number,
//    call auditChips() in-process and hand it the live table registry: that is
//    what the conservation tests do.
//
// 4. THE LEDGER IS CAPPED AT 100 ENTRIES (LEDGER_CAP, src/server/wallet.js).
//    A long-lived pocket silently forgets its own beginning, so `diff` on an
//    old household is evidence of nothing on its own. `ledgerCapped` is
//    printed beside it for exactly that reason; trust `diff` only on a
//    household whose ledgers are all short.
//
// Usage:
//   node scripts/audit-chips.js                     # a fresh scratch db, seeded by this script
//   node scripts/audit-chips.js --db path/to/app.db  # a real database, e.g. your local data/app.db
//   node scripts/audit-chips.js --json
//
// NEVER point --db at production. It cannot write, but it reads whole ledgers
// into memory and prints balances; run it on a copy.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// ── Constants this shares with the running server ────────────────────────────
// Imported, not restated: a ladder that drifts from wallet.js would make the
// audit disagree with the product about what a buy-in is.
const { STAKES, ENTRY_BUYIN } = await import('../src/server/wallet.js');

// ── The reconciliation itself ────────────────────────────────────────────────
// Pure: hand it plain objects and it tells you what they add up to. No
// database, no filesystem, no registry — which is what lets the conservation
// tests call it with a live table registry and get the same arithmetic the
// command line prints.

const int = (n) => (Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 0);
const LEDGER_CAP = 100;

/** Signed sum of one ledger's amounts. */
export function ledgerSum(ledger) {
  if (!Array.isArray(ledger)) return 0;
  let n = 0;
  for (const e of ledger) n += int(e?.amount);
  return n;
}

/**
 * Reconcile one owner.
 *
 * @param wallet  { balance, ledger, earned, startingGrantClaimed }
 * @param agents  [{ id, name, pocket, ledger, activeTableId, archived }]
 * @param stacks  Map<agentId, chips> — what each agent has in front of him at a
 *                live table right now. Omit it and `live` is reported as
 *                unknown rather than as zero.
 */
export function auditOwner(ownerId, wallet, agents = [], stacks = null) {
  const safe = int(wallet?.balance);
  const rows = [];
  let pockets = 0;
  let live = 0;
  let seatedClaimed = 0;
  let pocketLedgerSum = 0;
  let capped = Array.isArray(wallet?.ledger) && wallet.ledger.length >= LEDGER_CAP;
  let grantEntries = 0;
  let grantTotal = 0;
  let openBuyIns = 0;

  for (const agent of agents) {
    const pocket = agent?.pocket ?? {};
    const balance = int(pocket.balance);
    pockets += balance;
    pocketLedgerSum += ledgerSum(pocket.ledger);
    if (Array.isArray(pocket.ledger) && pocket.ledger.length >= LEDGER_CAP) capped = true;

    // BUG-136's fossil. A household that drafted agents in a loop before the
    // fix has one `grant` line per draft in the AGENT ledger (the legacy
    // mirror, agentProfiles.js ensureBankroll / createAgent). More than one in
    // a household is the exploit's signature; exactly one is a normal owner.
    for (const e of agent?.ledger ?? []) {
      if (e?.type === 'grant') { grantEntries++; grantTotal += int(e.amount); }
    }

    const seated = !!agent?.activeTableId;
    if (seated) seatedClaimed++;
    const stack = stacks ? int(stacks.get?.(agent.id) ?? stacks[agent.id]) : null;
    if (stack !== null) live += stack;

    // What he took to the table and has not brought back. buyin is negative
    // and cashout positive on the pocket ledger, so an open stay reads as a
    // negative realised balance for that table.
    if (seated) openBuyIns += openBuyInFor(pocket.ledger, agent.activeTableId);

    rows.push({
      id: agent?.id ?? null,
      name: agent?.name ?? null,
      pocket: balance,
      seated,
      tableId: agent?.activeTableId ?? null,
      stack,
      archived: !!agent?.archived,
    });
  }

  const ledger = ledgerSum(wallet?.ledger) + pocketLedgerSum;
  const settled = safe + pockets;
  return {
    ownerId: String(ownerId),
    safe,
    pockets,
    // null means "not knowable from this source", which is a different answer
    // from zero and the script prints it as a different answer.
    live: stacks ? live : null,
    liveUnknown: stacks ? 0 : seatedClaimed * ENTRY_BUYIN,
    seatedClaimed,
    total: settled + (stacks ? live : 0),
    ledger,
    diff: settled - ledger,
    ledgerCapped: capped,
    openBuyIns,
    earned: int(wallet?.earned),
    startingGrantClaimed: !!wallet?.startingGrantClaimed,
    grantEntries,
    grantTotal,
    agents: rows,
  };
}

// The buy-in an open stay at `tableId` has not yet cashed out. Walks backwards
// so a pocket that has visited the same table twice reports the CURRENT stay.
function openBuyInFor(ledger, tableId) {
  if (!Array.isArray(ledger) || !tableId) return 0;
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i];
    if (e?.tableId !== tableId) continue;
    if (e.type === 'cashout') return 0;          // already settled
    if (e.type === 'buyin') return -int(e.amount);
  }
  return 0;
}

/**
 * Reconcile a whole database's worth of owners.
 *
 * ── What "every chip that exists" means, after MONEY-1 job 3 ─────────────────
 *
 * Three places and no others:
 *
 *     chipsInExistence = SUM(safes) + SUM(pockets) + houseBank
 *
 * Table stacks are deliberately NOT in that sum. Under the bank model a stack
 * is a CLAIM against the house — a buy-in moves pocket -> bank and a cash-out
 * moves bank -> pocket, so the chips a seat is playing with are already counted
 * inside `houseBank` for as long as he is sitting there. Adding `live` on top
 * would count every seated agent's chips twice.
 *
 * That is not a redefinition to make the books balance; it is what the audit
 * found the stacks already were (MONEY_AUDIT.md §6.1, "a display number, not a
 * balance"). The difference is that the display number is now backed by
 * something. `live` is still reported, because what is in front of a man is
 * worth being able to read — it is a view, not a holding.
 *
 * @param owners     [{ ownerId, wallet, agents }]
 * @param stacks     Map<agentId, chips> for the `live` column, or null
 * @param houseBank  the bank's balance. Without it there is no total to
 *                   conserve and `chipsInExistence` is null rather than a
 *                   number that happens to add up.
 */
export function auditChips(owners, { stacks = null, houseBank = null } = {}) {
  const rows = owners.map((o) => auditOwner(o.ownerId, o.wallet, o.agents, stacks));
  const sum = (k) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  return {
    owners: rows,
    totals: {
      safe: sum('safe'),
      pockets: sum('pockets'),
      live: stacks ? sum('live') : null,
      houseBank,
      chipsInExistence: houseBank === null ? null : sum('safe') + sum('pockets') + int(houseBank),
      ledger: sum('ledger'),
      diff: sum('diff'),
      owners: rows.length,
      anyLedgerCapped: rows.some((r) => r.ledgerCapped),
    },
  };
}

// ── Reading a database, without touching it ──────────────────────────────────

// better-sqlite3 is a CommonJS native addon. Required lazily, so the pure
// arithmetic above stays importable by a test that never opens a database.
const require = createRequire(import.meta.url);

/** The house bank as stored, or null on a database that has never had one. */
export function readHouseBank(file) {
  const Database = require('better-sqlite3');
  const d = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const raw = d.prepare("SELECT value FROM meta WHERE key = 'house_bank'").get()?.value ?? null;
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.floor(n) : null;
  } catch {
    return null;   // a database old enough to predate the bank
  } finally {
    d.close();
  }
}

/** Every owner in `file`, as auditChips() wants them. Opens READONLY. */
export function readOwners(file) {
  const Database = require('better-sqlite3');
  const d = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const owners = new Map();
    const take = (id) => {
      const key = String(id);
      if (!owners.has(key)) owners.set(key, { ownerId: key, wallet: null, agents: [] });
      return owners.get(key);
    };
    for (const row of d.prepare('SELECT owner_id FROM profiles').all()) take(row.owner_id);
    for (const row of d.prepare(
      'SELECT owner_id, balance, earned, ledger, starting_grant_claimed FROM wallets',
    ).all()) {
      take(row.owner_id).wallet = {
        balance: row.balance ?? 0,
        earned: row.earned ?? 0,
        ledger: parse(row.ledger, []),
        startingGrantClaimed: !!row.starting_grant_claimed,
      };
    }
    for (const row of d.prepare('SELECT owner_id, data FROM agents ORDER BY owner_id, id').all()) {
      take(row.owner_id).agents.push(parse(row.data, {}));
    }
    return [...owners.values()].map((o) => ({ ...o, wallet: o.wallet ?? { balance: 0, ledger: [] } }));
  } finally {
    d.close();
  }
}

function parse(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

// ── The scratch database ──────────────────────────────────────────────────────
//
// Not store.js's schema, and deliberately not trying to be — this file is
// never anything but a throwaway fixture for the audit's own self-check, so
// it carries only the four tables readOwners()/readHouseBank() actually
// query. One owner, hand-balanced, so a passing run demonstrates the
// arithmetic on real (if synthetic) numbers rather than on an empty database
// that would pass by having nothing to add up.

const SCRATCH_OWNER = 'scratch-owner';

function seedScratchDb(file) {
  const Database = require('better-sqlite3');
  const d = new Database(file);
  try {
    d.exec(`
      CREATE TABLE profiles (owner_id TEXT PRIMARY KEY);
      CREATE TABLE wallets (
        owner_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        earned INTEGER NOT NULL DEFAULT 0,
        ledger TEXT NOT NULL DEFAULT '[]',
        starting_grant_claimed INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE agents (owner_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    `);
    const ts = Date.UTC(2026, 0, 1);
    d.prepare('INSERT INTO profiles (owner_id) VALUES (?)').run(SCRATCH_OWNER);
    d.prepare(
      'INSERT INTO wallets (owner_id, balance, earned, ledger, starting_grant_claimed) VALUES (?, ?, ?, ?, ?)',
    ).run(SCRATCH_OWNER, 5_000, 0, JSON.stringify([{ type: 'seed', amount: 5_000, ts }]), 0);
    const agent = {
      id: 'scratch-agent', name: 'Scratch Hero', status: 'idle', activeTableId: null,
      pocket: { balance: 1_000, ledger: [{ type: 'seed', amount: 1_000, ts }] },
      ledger: [{ type: 'grant', amount: 6_000, ts }],
    };
    d.prepare('INSERT INTO agents (owner_id, id, data) VALUES (?, ?, ?)').run(SCRATCH_OWNER, agent.id, JSON.stringify(agent));
    d.prepare("INSERT INTO meta (key, value) VALUES ('house_bank', ?)").run('0');
  } finally {
    d.close();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const money = (n) => (n === null || n === undefined ? '     —' : n.toLocaleString('en-US'));
const pad = (s, w) => String(s).padStart(w);

function report(result, { file, scratch = false }) {
  const lines = [];
  lines.push(`chip audit — ${file}${scratch ? '  (fresh scratch database, seeded by this script)' : ''}`);
  lines.push('');
  lines.push([
    pad('owner', 28), pad('safe', 12), pad('pockets', 12), pad('live', 12),
    pad('total', 13), pad('ledger', 13), pad('diff', 11),
  ].join(''));
  lines.push('-'.repeat(101));
  for (const o of result.owners) {
    lines.push([
      pad(o.ownerId.slice(0, 27), 28),
      pad(money(o.safe), 12),
      pad(money(o.pockets), 12),
      pad(o.live === null ? (o.seatedClaimed ? `?x${o.seatedClaimed}` : '—') : money(o.live), 12),
      pad(money(o.total), 13),
      pad(money(o.ledger), 13),
      pad(money(o.diff), 11),
    ].join('') + (o.ledgerCapped ? '  (ledger capped)' : ''));
  }
  const t = result.totals;
  lines.push('-'.repeat(101));
  lines.push([
    pad(`${t.owners} owner(s)`, 28),
    pad(money(t.safe), 12), pad(money(t.pockets), 12),
    pad(t.live === null ? '—' : money(t.live), 12),
    pad(money(t.safe + t.pockets + (t.live ?? 0)), 13),
    pad(money(t.ledger), 13), pad(money(t.diff), 11),
  ].join(''));
  lines.push('');
  if (t.houseBank === null) {
    lines.push('house bank: this database has none. Nothing can be conserved against, because');
    lines.push('  there is no counterparty on record for what is on the felts.');
  } else {
    lines.push(`house bank          : ${money(t.houseBank)}`);
    lines.push(`CHIPS IN EXISTENCE  : ${money(t.chipsInExistence)}   (safes + pockets + bank)`);
    lines.push('  A table stack is a claim against the bank, not a fourth pile, so `live`');
    lines.push('  above is a view and is deliberately not added in.');
  }
  lines.push('');

  if (t.live === null) {
    const seated = result.owners.reduce((n, o) => n + o.seatedClaimed, 0);
    if (seated === 0) {
      lines.push('live stacks: none to count — no agent in this database claims to be seated.');
    } else {
      lines.push(`live stacks: NOT KNOWABLE from a database, and ${seated} agent(s) claim to be`);
      lines.push('  seated. Nothing persists what is in front of them (MONEY_AUDIT.md §4), so');
      lines.push(`  those chips — at least ${money(seated * ENTRY_BUYIN)} of them — are already lost if`);
      lines.push('  this database outlived its server, and the next deploy debits a second');
      lines.push('  buy-in. Call auditChips() in-process with the live registry for the real');
      lines.push('  number.');
    }
    lines.push('');
  }
  if (t.anyLedgerCapped) {
    lines.push(`ledgers: at least one is at the ${LEDGER_CAP}-entry cap, so it no longer holds`);
    lines.push('  the whole history. `diff` for those owners is not evidence.');
    lines.push('');
  }

  // The question job 2 exists to answer.
  const looped = result.owners.filter((o) => o.grantEntries > 1);
  lines.push('starting grants (BUG-136, the 10,000-per-draft loop):');
  if (looped.length === 0) {
    lines.push('  no owner has more than one grant entry — no residue of the draft loop');
    lines.push('  in this database.');
  } else {
    for (const o of looped) {
      lines.push(`  ${o.ownerId}: ${o.grantEntries} grant entries, ${money(o.grantTotal)} total` +
        `${o.startingGrantClaimed ? '' : ' (marker not set — an unmigrated wallet)'}`);
    }
    lines.push('  These are LEGACY. The fix at agentProfiles.js:652-656 gates the grant on');
    lines.push('  wallets.starting_grant_claimed, so no further grant can be drawn.');
  }
  lines.push('');

  const broken = result.owners.filter((o) => o.diff !== 0 && !o.ledgerCapped);
  if (broken.length === 0) {
    lines.push('books: every uncapped ledger explains its own balances.');
  } else if (scratch) {
    lines.push(`books: ${broken.length} owner(s) hold chips their ledger does not explain, in a`);
    lines.push('  database THIS SCRIPT JUST BUILT AND SEEDED ITSELF. There is no old local');
    lines.push('  test data here to blame — the reconciliation engine, or something on this');
    lines.push('  branch, is minting or losing chips. That is a real bug. Fix the code.');
  } else {
    lines.push(`books: ${broken.length} owner(s) hold chips their ledger does not explain, in`);
    lines.push(`  ${file}.`);
    lines.push('  This file was NOT built by this script, so an unexplained owner here can be');
    lines.push('  a real bug, or it can be the fossil of an old manual fixture run — every');
    lines.push('  Playwright spec that drafts an agent against a running `npm start` drafts it');
    lines.push('  through the real /api/agents/build, into whatever data/app.db sits in that');
    lines.push('  terminal\'s cwd, and nothing ever cleans those owners up. To tell which: run');
    lines.push('  `node scripts/audit-chips.js` with no --db. That builds and audits a clean');
    lines.push('  scratch database and only ever fails on a genuine bug. If that run is green');
    lines.push('  and this one is red, the owners below are old local data, not a branch');
    lines.push('  problem.');
  }
  for (const o of broken) {
    lines.push(`  ${o.ownerId}: balances ${money(o.safe + o.pockets)}, ledger ${money(o.ledger)}, ` +
      `unexplained ${money(o.diff)}`);
  }
  return lines.join('\n');
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--db');
  const explicitDb = at !== -1;
  const asJson = argv.includes('--json');

  let file;
  let scratchDir = null;
  const cleanup = () => {
    if (scratchDir) { try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch { /* best effort */ } }
  };

  if (explicitDb) {
    file = argv[at + 1];
    if (!file) {
      console.error('--db needs a path, e.g. --db data/app.db');
      process.exit(1);
    }
    if (!fs.existsSync(file)) {
      console.error(`No database at ${file}.`);
      console.error('This tool is read-only and will not create or migrate one — point --db at an existing app.db.');
      process.exit(1);
    }
  } else {
    // CHIPS-1: no --db means "audit the reconciliation engine itself", not
    // "audit whatever happens to be in this developer's data/ directory" —
    // see note 2 at the top of this file.
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-chips-scratch-'));
    file = path.join(scratchDir, 'app.db');
    seedScratchDb(file);
  }

  let owners;
  try {
    owners = readOwners(file);
  } catch (err) {
    console.error(`Cannot read ${file}: ${err.message}`);
    cleanup();
    process.exit(1);
  }

  let bank = null;
  try { bank = readHouseBank(file); } catch { /* reported as "none" below */ }
  const result = auditChips(owners, { houseBank: bank });
  if (asJson) console.log(JSON.stringify({ file, scratch: !explicitDb, ...result }, null, 2));
  else console.log(report(result, { file, scratch: !explicitDb }));

  // A non-zero exit is reserved for books that genuinely do not balance, so
  // this can sit in a check later. A capped ledger is not a failure.
  const bad = result.owners.some((o) => o.diff !== 0 && !o.ledgerCapped);
  cleanup();
  process.exit(bad ? 1 : 0);
}

export { report, STAKES, LEDGER_CAP };
