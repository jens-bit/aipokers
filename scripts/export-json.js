#!/usr/bin/env node
// scripts/export-json.js — SQLITE-1 rollback path
//
// Usage: node scripts/export-json.js        (or: npm run export:json)
//
// Walks data/app.db and writes data/agents.json, data/hands-<owner>.json,
// data/opponents.json and data/notifications.json in exactly the shapes the
// pre-SQLite code read. Never touches the database.
//
// Rolling back on the VPS:
//   cd /opt/aipokers
//   node scripts/export-json.js     # current state → JSON
//   git revert <the sqlite merge>   # or checkout the last good sha
//   pm2 restart all
//
// The data/*.json.migrated files left behind by the cutover are the second
// parachute: those are the exact bytes the server read before it moved.

import fs from 'node:fs';
import path from 'node:path';

import {
  loadAgentStore, readHandRows, listHandOwners,
  loadOpponentStats, loadNotificationState,
  _dbPath,
} from '../src/server/store.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const MAX_HANDS = 50;

if (!fs.existsSync(_dbPath())) {
  console.error(`No database at ${_dbPath()} — nothing to export.`);
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

function write(name, value) {
  const file = path.join(DATA_DIR, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  return file;
}

// ── agents.json ──────────────────────────────────────────────────────────────
const store = loadAgentStore();
write('agents.json', store);
const owners = Object.keys(store);
const agentCount = owners.reduce((n, o) => n + (store[o].agents?.length ?? 0), 0);
console.log(`agents.json         — ${owners.length} owner(s), ${agentCount} agent(s)`);

// ── hands-<owner>.json ───────────────────────────────────────────────────────
// One file per owner that has hands. readHandRows returns newest-first, which
// is the order the old files were written in. Hand owners are their own key
// space (seat playerIds), so this walks the hands table, not the agent owners.
let handFiles = 0;
for (const ownerId of listHandOwners()) {
  const hands = readHandRows(ownerId, MAX_HANDS);
  if (hands.length === 0) continue;
  write(`hands-${ownerId}.json`, hands);
  handFiles++;
}
console.log(`hands-*.json        — ${handFiles} file(s)`);

// ── opponents.json ───────────────────────────────────────────────────────────
const opponents = loadOpponentStats();
write('opponents.json', opponents);
console.log(`opponents.json      — ${Object.keys(opponents).length} opponent(s)`);

// ── notifications.json ───────────────────────────────────────────────────────
const notifications = loadNotificationState();
write('notifications.json', notifications);
console.log(`notifications.json  — ${Object.keys(notifications).length} owner(s)`);

console.log(`\nExported from ${_dbPath()} into ${DATA_DIR}`);
