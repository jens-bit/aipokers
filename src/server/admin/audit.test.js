// src/server/admin/audit.test.js — ADMIN-2
//
// One line per write: readable back, newest first, paged, and the key
// itself never appears in it — only a stable one-way hash of it.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { appendAudit, readAudit, keyId } = await import('./audit.js');

const originalCwd = process.cwd();
after(() => process.chdir(originalCwd));

// audit.js resolves its file from process.cwd()/data, exactly like store.js
// resolves app.db — so each test gets its own scratch cwd rather than
// sharing one log with every other test in this file.
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-audit-'));
  process.chdir(dir);
  return dir;
}

test('ADMIN-2: keyId is stable and never the key itself', () => {
  const a = keyId('super-secret-key');
  const b = keyId('super-secret-key');
  const c = keyId('a-different-key');
  assert.equal(a, b, 'the same key hashes the same way every time');
  assert.notEqual(a, c);
  assert.equal(a.includes('super-secret-key'), false);
  assert.equal(keyId(''), 'none');
});

test('ADMIN-2: an appended entry never carries the raw key, in any field', () => {
  scratch();
  const entry = appendAudit({
    key: 'raw-admin-key-value', action: 'owner.adjust', target: 'owner-1',
    reason: 'support ticket #4', before: 100, after: 200,
  });
  const blob = JSON.stringify(entry);
  assert.equal(blob.includes('raw-admin-key-value'), false);
  assert.equal(entry.action, 'owner.adjust');
  assert.equal(entry.target, 'owner-1');
  assert.equal(entry.reason, 'support ticket #4');
  assert.equal(entry.before, 100);
  assert.equal(entry.after, 200);
  assert.ok(Number.isFinite(entry.ts));
});

test('ADMIN-2: readAudit returns newest first and pages correctly', () => {
  scratch();
  for (let i = 0; i < 5; i++) {
    appendAudit({ key: 'k', action: `action-${i}`, target: 't', reason: '', before: i, after: i + 1 });
  }
  const page1 = readAudit({ limit: 2, offset: 0 });
  assert.equal(page1.total, 5);
  assert.deepEqual(page1.rows.map((r) => r.action), ['action-4', 'action-3']);

  const page2 = readAudit({ limit: 2, offset: 2 });
  assert.deepEqual(page2.rows.map((r) => r.action), ['action-2', 'action-1']);
});

test('ADMIN-2: reading before anything was written is empty, not an error', () => {
  scratch();
  assert.deepEqual(readAudit({}), { total: 0, rows: [] });
});
