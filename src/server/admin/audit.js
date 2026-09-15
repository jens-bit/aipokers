// src/server/admin/audit.js — ADMIN-2
//
// One line per write, append-only: when, which key, what, on whom, why, and
// the before/after. Readable from the panel (GET /api/admin/audit) and from
// a terminal (it is just JSON lines).
//
// A FILE OF ITS OWN, not a table in app.db. Three other trees are editing
// the economy and agent layers in that database right now — any schema
// change to it is exactly the kind of collision this job's hard constraint
// exists to avoid, and an audit log does not need app.db's transactional
// guarantees to be trustworthy: it is appended once, right after the write
// it describes, and never rewritten.
//
// The key itself is never written, in either direction — same rule key.js
// holds for the read guard. `keyId` is a stable one-way hash (sha256,
// truncated) of the configured key, so two entries from the same key look
// the same across a restart without the key ever being recoverable from it.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Mirrors store.js's own dataDir() (private there). Deliberately not
// imported from it: this file lives beside app.db but is not part of it, on
// purpose — see the header above.
function dataDir() {
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function auditPath() {
  return path.join(dataDir(), 'admin-audit.log');
}

/** A stable, one-way identifier for the configured key. Never the key itself. */
export function keyId(rawKey) {
  const s = String(rawKey ?? '');
  if (!s) return 'none';
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

/**
 * Append one entry. Synchronous and deliberately so: a write endpoint that
 * returned 200 before its own audit line landed on disk is a write endpoint
 * whose audit trail cannot be trusted the one time it would matter.
 */
export function appendAudit({ key, action, target, reason = '', before = null, after = null }) {
  const entry = {
    ts: Date.now(),
    keyId: keyId(key),
    action: String(action),
    target: String(target ?? ''),
    reason: String(reason ?? ''),
    before,
    after,
  };
  fs.appendFileSync(auditPath(), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

/** Every entry, newest first, paged. Malformed lines (a crash mid-write) are skipped rather than failing the whole read. */
export function readAudit({ limit = 50, offset = 0 } = {}) {
  let text = '';
  try { text = fs.readFileSync(auditPath(), 'utf8'); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }

  const lines = text.split('\n').filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try { parsed.push(JSON.parse(line)); } catch { /* a partial line from a crash mid-append */ }
  }
  parsed.reverse();

  const n = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 200));
  const from = Math.max(0, Math.floor(Number(offset) || 0));
  return { total: parsed.length, rows: parsed.slice(from, from + n) };
}
