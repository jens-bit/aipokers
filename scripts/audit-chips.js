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
// 1. IT NEVER WRITES. It opens SQLite readonly and does not go through
//    store.js at all, because store.js's conn() applies the schema and imports
//    data/agents.json on first use. An audit that migrates the thing it is
//    auditing is not an audit. Consequence: the DB must already exist; this
//    tool will not create or upgrade one.
//
// 2. A TABLE STACK IS NOT PERSISTED. `live` is zero from a cold read of a
//    database, because nothing anywhere stores what an agent has in front of
//    him — see read-me-claude/MONEY_AUDIT.md §4. Running against a file, the
//    script says how many agents CLAIM to be playing and prices the chips it
//    cannot see at one buy-in each, as `liveUnknown`. To get the real number,
//    call auditChips() in-process and hand it the live table registry: that is
//    what the conservation tests do.
//
// 3. THE LEDGER IS CAPPED AT 100 ENTRIES (LEDGER_CAP, src/server/wallet.js).
//    A long-lived pocket silently forgets its own beginning, so `diff` on an
//    old household is evidence of nothing on its own. `ledgerCapped` is
//    printed beside it for exactly that reason; trust `diff` only on a
//    household whose ledgers are all short.
//
// Usage:
//   node scripts/audit-chips.js                     # ./data/app.db
//   node scripts/audit-chips.js --db path/to/app.db
//   node scripts/audit-chips.js --json
//
// NEVER point this at production. It cannot write, but it reads whole ledgers
// into memory and prints balances; run it on a copy.

import fs from 'node:fs';
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
 * @param owners  [{ ownerId, wallet, agents }]
 * @param stacks  Map<agentId, chips>, or null
 * @param houseStacks  chips sitting in front of UNOWNED seats (the House). Only
 *                     an in-process caller can know this, and it is the number
 *                     that decides whether the felt is a closed system.
 */
export function auditChips(owners, { stacks = null, houseStacks = null } = {}) {
  const rows = owners.map((o) => auditOwner(o.ownerId, o.wallet, o.agents, stacks));
  const sum = (k) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  return {
    owners: rows,
    totals: {
      safe: sum('safe'),
      pockets: sum('pockets'),
      live: stacks ? sum('live') : null,
      house: houseStacks,
      // The only number that answers "were chips created". Everything owned by
      // somebody, plus everything sitting in front of a House seat, is every
      // chip that exists.
      chipsInExistence: stacks
        ? sum('safe') + sum('pockets') + sum('live') + int(houseStacks)
        : null,
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

// ── CLI ──────────────────────────────────────────────────────────────────────

const money = (n) => (n === null || n === undefined ? '     —' : n.toLocaleString('en-US'));
const pad = (s, w) => String(s).padStart(w);

function report(result, { file }) {
  const lines = [];
  lines.push(`chip audit — ${file}`);
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
  lines.push(broken.length === 0
    ? 'books: every uncapped ledger explains its own balances.'
    : `books: ${broken.length} owner(s) hold chips their ledger does not explain:`);
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
  const file = at !== -1 ? argv[at + 1] : path.join(process.cwd(), 'data', 'app.db');
  const asJson = argv.includes('--json');

  if (!fs.existsSync(file)) {
    console.error(`No database at ${file}.`);
    console.error('This tool is read-only and will not create or migrate one — point --db at an existing app.db.');
    process.exit(1);
  }

  let owners;
  try {
    owners = readOwners(file);
  } catch (err) {
    console.error(`Cannot read ${file}: ${err.message}`);
    process.exit(1);
  }

  const result = auditChips(owners);
  if (asJson) console.log(JSON.stringify({ file, ...result }, null, 2));
  else console.log(report(result, { file }));

  // A non-zero exit is reserved for books that genuinely do not balance, so
  // this can sit in a check later. A capped ledger is not a failure.
  const bad = result.owners.some((o) => o.diff !== 0 && !o.ledgerCapped);
  process.exit(bad ? 1 : 0);
}

export { report, STAKES, LEDGER_CAP };
