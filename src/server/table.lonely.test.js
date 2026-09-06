// src/server/table.lonely.test.js — BUGS-B/1
//
// The lonely table.
//
// An agent sitting on his own at "SHUFFLING" is the worst thing the casino can
// show: he is not resting and he is not playing, the floor reports him as live
// the whole time, and nothing was ever going to change it. MATCH-1 made it
// common — an owner's agents are refused each other's tables, so a stable of
// four opens four felts.
//
// The rules under test:
//
//   1. Fewer than 2 live seats for 20s → the house seats regulars until there
//      are 3, from the existing cast, and never the same regular twice.
//   2. A table that stays alone for 5 minutes closes and re-queues its agent.
//   3. Never at the home table. A living room is allowed to be short-handed.
//   4. A table that filled up on its own is left alone.

// TEST-2: no automated suite talks to a real model. Nothing here deals a hand,
// but the seats it creates would.
delete process.env.ANTHROPIC_API_KEY;

// The clock this file runs on. Set before table.js is imported, because both
// windows are read once at module load.
process.env.LONELY_FILL_MS = '40';
process.env.LONELY_CLOSE_MS = '400';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_CWD = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-lonely-'));
process.chdir(scratch);

const store = await import('./store.js');
// Written before anything reads it: agentProfiles caches the whole profile map
// on its first db() call and never reloads it.
store.saveWallet('u-lonely', { ownerId: 'u-lonely', balance: 50_000, ledger: [] });
store.saveProfile('u-lonely', {
  userId: 'u-lonely', chat: [],
  agents: ['lonely-give-up', 'lonely-clock', 'lonely-fill', 'lonely-cast', 'lonely-fine',
           'lonely-home', 'lonely-bust'].map((t) => ({
    id: `agent-${t}`, name: 'Granite', status: 'playing', activeTableId: t,
    style: 'Tight', risk: 'Low', strategy: 'You wait for premiums.',
    bankroll: 5_000,
    pocket: { balance: 5_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 40, handsWon: 18 },
    profile: { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 },
  })),
});

const {
  Table, MIN_TO_DEAL, LONELY_FILL_MS, LONELY_CLOSE_MS, LONELY_SEATS,
} = await import('./table.js');
const { HOUSE_CAST } = await import('./houseCast.js');
const profiles = await import('./agentProfiles.js');
const registry = await import('./tableRegistry.js');
// The re-queue goes through the real deploy, which needs a real registry to
// seat him at — that is the whole point of it being the same door.
profiles.setLiveTableProvider(registry);

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

// A casino table with one agent in it and nothing else — the shape the bug is.
function aloneTable(tableId, { home = false } = {}) {
  const table = new Table({ tableId, smallBlind: 10, bigBlind: 20, maxSeats: 6, home });
  table.seatAI({
    displayName: 'Granite',
    strategy: 'You wait for premiums.',
    agentId: `agent-${tableId}`,
    userId: 'u-lonely',
    agentProfile: { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 },
    buyIn: 2000,
  });
  return table;
}

const castIds = (table) => table.pending
  .map((p) => p?.playerId)
  .filter((id) => typeof id === 'string' && id.startsWith('house_'));

test.after(() => {
  registry.resetRegistry('test over');
  profiles.setLiveTableProvider(null);
  store._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── 1. The house sends people over ──────────────────────────────────────────

test('BUGS-B/1: a man left alone gets regulars, up to three', async () => {
  const table = aloneTable('lonely-fill');
  try {
    assert.equal(table.liveSeatCount(), 1, 'he is on his own');
    assert.ok(table.liveSeatCount() < MIN_TO_DEAL, 'so the table cannot deal');

    table._noteLoneliness();
    assert.notEqual(table._aloneSince, null, 'the clock started');

    await settle(LONELY_FILL_MS * 4);

    assert.equal(table.liveSeatCount(), LONELY_SEATS, 'three live seats — a game, not a duel');
    assert.equal(table._aloneSince, null, 'and the clock stopped');
    assert.equal(table.closed, false);
  } finally {
    table.closeTable('test over');
  }
});

test('BUGS-B/1: they come from the existing cast, and never the same man twice', async () => {
  const table = aloneTable('lonely-cast');
  try {
    table._noteLoneliness();
    await settle(LONELY_FILL_MS * 4);

    const seated = castIds(table);
    assert.equal(seated.length, 2, 'two regulars joined the one agent');
    assert.equal(new Set(seated).size, seated.length,
      'a cast seat is playerId `house_<id>` and the button is keyed on it');
    for (const playerId of seated) {
      const id = playerId.slice('house_'.length);
      assert.ok(HOUSE_CAST.some((m) => m.id === id), `${id} is one of the house regulars`);
    }
  } finally {
    table.closeTable('test over');
  }
});

test('BUGS-B/1: it is not armed while the table can deal', async () => {
  const table = aloneTable('lonely-fine');
  try {
    table.seatAI({ displayName: 'Granite', strategy: 'You wait.', buyIn: 2000, stableId: 'granite' });
    assert.equal(table.liveSeatCount(), 2);

    table._noteLoneliness();
    assert.equal(table._aloneSince, null, 'nobody is lonely at a table that deals');
    assert.equal(table._lonelyTimer, null);

    await settle(LONELY_FILL_MS * 4);
    assert.equal(table.seatedCount(), 2, 'and nobody was sent over');
  } finally {
    table.closeTable('test over');
  }
});

// ── 2. A table that stays alone is not a table ──────────────────────────────

test('BUGS-B/1: five minutes alone closes it, and he is put back in the queue', async () => {
  // A house with nobody to send. It is the only way the fill genuinely fails —
  // six regulars against six seats means it almost always succeeds — and it is
  // exactly the case the five-minute rule exists to answer.
  const table = aloneTable('lonely-give-up');
  table._seatHouseRegulars = () => 0;
  try {
    table._noteLoneliness();
    assert.notEqual(table._aloneSince, null);

    await settle(LONELY_CLOSE_MS + LONELY_FILL_MS * 6);
    assert.equal(table.closed, true, 'a table nobody will ever sit at is closed');

    const record = profiles._agentRecordForTests('agent-lonely-give-up', 'u-lonely');
    assert.equal(record.activeTableId !== 'lonely-give-up', true,
      'he does not still point at the table that died under him');
    assert.ok(registry.getTable(record.activeTableId), 'he is at a table that exists');
    assert.equal(registry.getTable(record.activeTableId).seatOfAgent('agent-lonely-give-up') !== null,
      true, 're-queued into a seat, not just re-flagged');
  } finally {
    table.closeTable('test over');
    registry.resetRegistry('test over');
  }
});

test('BUGS-B/1: a failed fill does not restart the five minutes', async () => {
  const table = aloneTable('lonely-clock');
  table._seatHouseRegulars = () => 0;
  try {
    table._noteLoneliness();
    const startedAt = table._aloneSince;
    await settle(LONELY_FILL_MS * 3);
    assert.equal(table._aloneSince, startedAt,
      'the clock runs from when he was first left alone, not from the last attempt');
    assert.equal(table.closed, false, 'and five minutes have not passed yet');
  } finally {
    table.closeTable('test over');
  }
});

// ── 3. Never at the home table ──────────────────────────────────────────────

test('BUGS-B/1: a living room is allowed to be short-handed', async () => {
  const table = aloneTable('lonely-home', { home: true });
  try {
    assert.equal(table.liveSeatCount(), 1);
    table._noteLoneliness();
    assert.equal(table._aloneSince, null, 'the clock never starts at home');
    assert.equal(table._lonelyTimer, null);

    await settle(LONELY_FILL_MS * 4);
    assert.equal(castIds(table).length, 0, 'and no House regular walks into his flat');
    assert.equal(table.closed, false);
  } finally {
    table.closeTable('test over');
  }
});

// ── 4. The hand that empties the table ──────────────────────────────────────

test('BUGS-B/1: the House busting out no longer ends HIS session', async () => {
  const table = aloneTable('lonely-bust');
  try {
    table.seatAI({
      displayName: 'MsAllIn', strategy: 'All in.', stableId: 'ms_allin', buyIn: 2000,
      agentProfile: { tightness: 14, aggression: 92, bluffFreq: 60, discipline: 33 },
    });
    // He took every chip on the table. Before this tree the next _handCompleted
    // closed his session and reported RECAP_BUST — for the man who had just won.
    table.seatStacks[0] = 4000;
    table.seatStacks[1] = 0;
    assert.equal(table.liveSeatCount(), 1);

    table._noteLoneliness();
    await settle(LONELY_FILL_MS * 4);

    assert.equal(table.closed, false, 'he is still playing');
    assert.equal(table.liveSeatCount(), LONELY_SEATS, 'with a full enough table to deal');
    assert.equal(table.agentIds[0], 'agent-lonely-bust', 'and it is still his seat');
  } finally {
    table.closeTable('test over');
  }
});

// ── The windows themselves ──────────────────────────────────────────────────

// This file overrides both windows before importing table.js, so the defaults
// can only be read in a process that never saw the overrides.
function childEnv() {
  const env = { ...process.env };
  delete env.LONELY_FILL_MS;
  delete env.LONELY_CLOSE_MS;
  delete env.LONELY_SEATS;
  return env;
}


test('BUGS-B/1: the two windows are 20 seconds and 5 minutes by default', async () => {
  // Read from a child process, because this file overrides both before import.
  const { execFileSync } = await import('node:child_process');
  // Located from THIS FILE, not from cwd: the runner gives every suite a
  // scratch cwd and it is nowhere near the repo.
  const src = new URL('./table.js', import.meta.url).href;
  const out = execFileSync(process.execPath, [
    '-e',
    `import(${JSON.stringify(src)})`
    + '.then((m) => console.log(JSON.stringify([m.LONELY_FILL_MS, m.LONELY_CLOSE_MS, m.LONELY_SEATS])))',
  ], { encoding: 'utf8', env: childEnv() });
  const [fill, close, seats] = JSON.parse(out.trim().split('\n').pop());
  assert.equal(fill, 20_000);
  assert.equal(close, 300_000);
  assert.equal(seats, 3);
});
