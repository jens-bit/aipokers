// src/server/admin/ops.test.js — ADMIN-2
//
// The actual operations, called directly (not over HTTP — opsRoutes.test.js
// covers the wire, the guard and the audit wiring). Every one of these is a
// thin wrapper over a function this job did not write; what is asserted
// here is that the wrapper calls it correctly and leaves the record the way
// the rest of the product already reads it.

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { saveProfile, saveWallet, loadWallet, _closeForTests } from '../store.js';
import { agentsOf, reloadOwners, setLiveTableProvider } from '../agentProfiles.js';
import * as registry from '../tableRegistry.js';
import {
  adjustOwnerChips, resetOwnerWallet, ownerLedger, CLEAN_STARTING_BALANCE,
  renameAgent, retireAgent, unretireAgent, unseatAgent, forceAgentState,
} from './ops.js';

after(() => { setLiveTableProvider(null); registry.resetRegistry(); _closeForTests(); });

let seq = 0;
function fixture(extra = {}) {
  const owner = `ops-${++seq}`;
  const agent = {
    id: `${owner}-agent`, name: 'Granite', status: 'idle', activeTableId: null,
    fatigue: 'fresh', mood: { state: 'neutral', heat: 30 },
    pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] },
    bankroll: 2000, sessionHands: 0, ...extra,
  };
  saveProfile(owner, { userId: owner, chat: [], agents: [agent] });
  saveWallet(owner, { balance: 5000, earned: 0, ledger: [] });
  reloadOwners(owner);
  return { owner, agentId: agent.id };
}

// ── Owner actions ────────────────────────────────────────────────────────────

test('ADMIN-2: adjustOwnerChips credits, debits, and appends a balanced ledger entry', () => {
  const { owner } = fixture();

  const credit = adjustOwnerChips(owner, { amount: 500, reason: 'goodwill' });
  assert.equal(credit.ok, true);
  assert.equal(credit.before, 5000);
  assert.equal(credit.after, 5500);

  const debit = adjustOwnerChips(owner, { amount: -200, reason: 'correcting a duplicate grant' });
  assert.equal(debit.after, 5300);

  const wallet = loadWallet(owner);
  assert.equal(wallet.balance, 5300);
  const entries = wallet.ledger.filter((e) => e.type === 'admin_adjust');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].amount, 500);
  assert.equal(entries[0].reason, 'goodwill');
  assert.equal(entries[1].amount, -200);
  assert.equal(entries[1].reason, 'correcting a duplicate grant');
});

test('ADMIN-2: adjustOwnerChips refuses a zero amount, and refuses a missing reason', () => {
  const { owner } = fixture();
  assert.equal(adjustOwnerChips(owner, { amount: 0, reason: 'x' }).ok, false);
  assert.equal(adjustOwnerChips(owner, { amount: 100, reason: '' }).ok, false);
  assert.equal(adjustOwnerChips(owner, { amount: 100, reason: '   ' }).ok, false);
});

test('ADMIN-2: adjustOwnerChips never puts a wallet below zero', () => {
  const { owner } = fixture();
  const result = adjustOwnerChips(owner, { amount: -999999, reason: 'test the floor' });
  assert.equal(result.ok, true);
  assert.equal(result.after, 0);
  assert.equal(loadWallet(owner).balance, 0);
});

test('ADMIN-2: resetOwnerWallet sets the clean starting balance with one balancing entry', () => {
  const { owner } = fixture();
  adjustOwnerChips(owner, { amount: 12345, reason: 'setup' });
  const before = loadWallet(owner).balance;

  const result = resetOwnerWallet(owner, { reason: 'support ticket #9' });
  assert.equal(result.before, before);
  assert.equal(result.after, CLEAN_STARTING_BALANCE);

  const wallet = loadWallet(owner);
  assert.equal(wallet.balance, CLEAN_STARTING_BALANCE);
  const reset = wallet.ledger.at(-1);
  assert.equal(reset.type, 'admin_reset');
  assert.equal(reset.amount, CLEAN_STARTING_BALANCE - before);
});

test('ADMIN-2: ownerLedger reads newest first and pages', () => {
  const { owner } = fixture();
  for (let i = 0; i < 3; i++) adjustOwnerChips(owner, { amount: i + 1, reason: `entry ${i}` });

  const page = ownerLedger(owner, { limit: 2, offset: 0 });
  assert.ok(page.total >= 3);
  assert.equal(page.rows[0].reason, 'entry 2');
  assert.equal(page.rows[1].reason, 'entry 1');
});

// ── Agent actions ────────────────────────────────────────────────────────────

test('ADMIN-2: renameAgent uses the existing name rules and cap', () => {
  const { owner, agentId } = fixture();
  const result = renameAgent(owner, agentId, { name: 'The Aggressive Bluffing Machine Supreme' });
  assert.equal(result.ok, true);
  assert.ok(result.after.length <= 14, 'NAME_MAX from naming.js');
  assert.equal(agentsOf(owner)[0].name, result.after);
});

test('ADMIN-2: renameAgent refuses a name that coins to nothing', () => {
  const { owner, agentId } = fixture();
  const result = renameAgent(owner, agentId, { name: 'the' });
  assert.equal(result.ok, false);
  assert.equal(agentsOf(owner)[0].name, 'Granite', 'a refused rename never touches the record');
});

test('ADMIN-2: renameAgent 404s a missing agent', () => {
  const { owner } = fixture();
  assert.equal(renameAgent(owner, 'no-such-agent', { name: 'X' }).ok, false);
});

test('ADMIN-2: retireAgent hides him, and unretireAgent is a full, honest undo', () => {
  const { owner, agentId } = fixture();

  const retired = retireAgent(owner, agentId);
  assert.equal(retired.ok, true);
  assert.equal(retired.after, true);
  const hidden = agentsOf(owner)[0];
  assert.equal(hidden.archived, true);
  assert.ok(hidden.archivedAt);
  // Money untouched — this is a flag, not the money-collecting one-way route.
  assert.equal(hidden.pocket.balance, 2000);

  const restored = unretireAgent(owner, agentId);
  assert.equal(restored.ok, true);
  assert.equal(restored.after, false);
  const back = agentsOf(owner)[0];
  assert.equal(back.archived, false);
  assert.equal(back.archivedAt, null);
  assert.equal(back.pocket.balance, 2000, 'nothing was collected on the way in, so nothing needs to be given back');
});

test('ADMIN-2: retireAgent refuses a seated agent', () => {
  const { owner, agentId } = fixture({ activeTableId: 'table-1' });
  setLiveTableProvider({
    hasTable: () => true,
    getTable: () => ({ agentIds: [agentId], pending: [true], handInProgress: () => true }),
    homeTableOf: () => null,
  });
  const result = retireAgent(owner, agentId);
  assert.equal(result.ok, false);
  assert.notEqual(agentsOf(owner)[0].archived, true, 'a refusal never touches the record');
});

test('ADMIN-2: retiring an already-retired agent is a no-op that still reports ok', () => {
  const { owner, agentId } = fixture({ archived: true, archivedAt: 111 });
  const result = retireAgent(owner, agentId);
  assert.equal(result.ok, true);
  assert.equal(result.before, true);
  assert.equal(result.after, true);
});

test('ADMIN-2: unseatAgent releases the seat through the real seating path, and refuses when not seated', () => {
  const { owner, agentId } = fixture();
  assert.equal(unseatAgent(owner, agentId).ok, false, 'not seated at all');
  assert.equal(unseatAgent(owner, 'no-such-agent').ok, false, 'unknown agent');

  // The real tableRegistry.js singleton, seated through table.js's own real
  // seatAI — the same door homeSit.test.js uses, because benchCutSeat itself
  // is duck-typed on purpose (wallet.js) and the thing worth proving here is
  // that unseatAgent actually reaches the SAME live table the rest of the
  // server would, not a re-implementation of what seating means.
  const seated = fixture({ activeTableId: 'table-unseat-9' });
  const table = registry.getOrCreateTable('table-unseat-9', { smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  table.seatAI({ agentId: seated.agentId, displayName: 'Granite', buyIn: 1000 });
  assert.ok(table.agentIds.includes(seated.agentId), 'seatAI actually seated him');

  const result = unseatAgent(seated.owner, seated.agentId);
  assert.equal(result.ok, true);
  assert.deepEqual(result.after, { tableId: 'table-unseat-9', benched: true });
});

test('ADMIN-2: forceAgentState sets fatigue and/or mood through the existing setters', () => {
  const { owner, agentId } = fixture();

  const fatigued = forceAgentState(owner, agentId, { fatigue: 'worn' });
  assert.equal(fatigued.ok, true);
  assert.equal(agentsOf(owner)[0].fatigue, 'worn');

  const heated = forceAgentState(owner, agentId, { mood: { state: 'tilted', heat: 90 } });
  assert.equal(heated.ok, true);
  assert.deepEqual(agentsOf(owner)[0].mood, { state: 'tilted', heat: 90 });
});

test('ADMIN-2: forceAgentState refuses an unknown fatigue stage and an empty request', () => {
  const { owner, agentId } = fixture();
  assert.equal(forceAgentState(owner, agentId, { fatigue: 'exhausted' }).ok, false);
  assert.equal(forceAgentState(owner, agentId, {}).ok, false);
});
