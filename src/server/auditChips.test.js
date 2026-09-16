// src/server/auditChips.test.js — MONEY-1 job 2
//
// The test for scripts/audit-chips.js. It lives HERE, beside wallet.test.js,
// rather than next to the script, because of how discovery works: the harness
// walks `src/**/*.test.js` and SKIPS `src/test/` (that directory is the harness
// itself), while `scripts/` is discovered only for `verify-*.js`. A test file
// under src/server/ is the one place this suite actually runs from.
//
// What is asserted is the arithmetic, not the CLI: given plain wallet and agent
// records, does the reconciliation say what the money is. The database half is
// exercised by the conservation suite, which drives real deploys, and the CLI
// itself (argv, exit codes, the scratch default) by auditChipsCli.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { auditOwner, auditChips, ledgerSum } = await import('../../scripts/audit-chips.js');

const entry = (type, amount, extra = {}) => ({ type, amount, ts: 1, ...extra });

test('ledgerSum adds signed amounts and ignores rubbish', () => {
  assert.equal(ledgerSum([entry('fund', -500), entry('fund', 500)]), 0);
  assert.equal(ledgerSum([entry('seed', 8_000), entry('buyin', -2_000)]), 6_000);
  assert.equal(ledgerSum(null), 0);
  assert.equal(ledgerSum([{ amount: 'nonsense' }, {}]), 0);
});

test('a freshly granted owner balances: safe + pocket equals the ledger', () => {
  const wallet = { balance: 8_000, ledger: [entry('seed', 8_000)] };
  const agents = [{
    id: 'a1', name: 'Hero',
    pocket: { balance: 2_000, ledger: [entry('seed', 2_000)] },
    ledger: [entry('grant', 10_000)],
  }];
  const r = auditOwner('owner-1', wallet, agents);
  assert.equal(r.safe, 8_000);
  assert.equal(r.pockets, 2_000);
  assert.equal(r.ledger, 10_000);
  assert.equal(r.diff, 0, 'the books explain the balances');
  assert.equal(r.live, null, 'live stacks are unknowable without a registry');
  assert.equal(r.seatedClaimed, 0);
});

test('an open buy-in leaves the pocket, and the chips are at the table', () => {
  const wallet = { balance: 8_000, ledger: [entry('seed', 8_000)] };
  const agents = [{
    id: 'a1', activeTableId: 't-1',
    pocket: { balance: 0, ledger: [entry('seed', 2_000), entry('buyin', -2_000, { tableId: 't-1' })] },
  }];

  // Without a registry: the settled books are short by the open buy-in, and the
  // audit says so rather than pretending the chips are gone.
  const cold = auditOwner('owner-1', wallet, agents);
  assert.equal(cold.diff, 0, 'ledger and balances still agree — both are down 2,000');
  assert.equal(cold.seatedClaimed, 1);
  assert.equal(cold.openBuyIns, 2_000);
  assert.equal(cold.total, 8_000, 'a cold read cannot see the felt');

  // With one: the chips are found.
  const warm = auditOwner('owner-1', wallet, agents, new Map([['a1', 2_000]]));
  assert.equal(warm.live, 2_000);
  assert.equal(warm.total, 10_000, 'safe + pocket + what is in front of him');
});

test('a cashed-out stay is closed, not open', () => {
  const agents = [{
    id: 'a1', activeTableId: 't-1',
    pocket: {
      balance: 3_400,
      ledger: [
        entry('seed', 2_000),
        entry('buyin', -2_000, { tableId: 't-1' }),
        entry('cashout', 3_400, { tableId: 't-1' }),
      ],
    },
  }];
  assert.equal(auditOwner('o', { balance: 0, ledger: [] }, agents).openBuyIns, 0);
});

test('a ledger at the 100-entry cap is flagged, because it no longer explains anything', () => {
  const long = Array.from({ length: 100 }, () => entry('fund', 1));
  const r = auditOwner('o', { balance: 5_000, ledger: long }, []);
  assert.equal(r.ledgerCapped, true);
  assert.notEqual(r.diff, 0, 'and it does not balance — which is exactly why the flag matters');
});

test('more than one grant entry in a household is the BUG-136 signature', () => {
  const one = auditOwner('o', { balance: 0, ledger: [] }, [
    { id: 'a1', pocket: { balance: 0, ledger: [] }, ledger: [entry('grant', 10_000)] },
  ]);
  assert.equal(one.grantEntries, 1, 'a normal owner has exactly one');

  const looped = auditOwner('o', { balance: 0, ledger: [] }, [
    { id: 'a1', pocket: { balance: 0, ledger: [] }, ledger: [entry('grant', 10_000)] },
    { id: 'a2', pocket: { balance: 0, ledger: [] }, ledger: [entry('grant', 10_000)] },
    { id: 'a3', pocket: { balance: 0, ledger: [] }, ledger: [entry('grant', 10_000)] },
  ]);
  assert.equal(looped.grantEntries, 3);
  assert.equal(looped.grantTotal, 30_000);
});

test('chipsInExistence is safes + pockets + the bank, and nothing else', () => {
  const owners = [{
    ownerId: 'o1',
    wallet: { balance: 8_000, ledger: [entry('seed', 8_000)] },
    agents: [{
      id: 'a1', activeTableId: 't',
      pocket: { balance: 0, ledger: [entry('seed', 2_000), entry('buyin', -2_000, { tableId: 't' })] },
    }],
  }];
  const stacks = new Map([['a1', 2_000]]);

  // He is seated, so his 2,000 is inside the bank, not beside it. Adding the
  // `live` column on top would count the same chips twice — see the note on
  // auditChips() and houseBank.js.
  const closed = auditChips(owners, { stacks, houseBank: 2_000 });
  assert.equal(closed.totals.live, 2_000, 'what is in front of him is still reported');
  assert.equal(closed.totals.chipsInExistence, 10_000, 'safe 8,000 + pocket 0 + bank 2,000');

  // Without the bank there is no total to conserve, and the audit refuses to
  // invent one rather than printing a number that happens to add up.
  const open = auditChips(owners, { stacks });
  assert.equal(open.totals.chipsInExistence, null);
  assert.equal(open.totals.houseBank, null);
  assert.equal(open.totals.live, 2_000, 'the view survives; only the total is withheld');
});
