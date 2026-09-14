// src/server/admin/opsPage.test.js — ADMIN-2
//
// The write panel's own markup and wiring, on the same static file
// page.test.js already asserts against — this file only adds what ADMIN-2
// changed: the post() helper, the confirm checkboxes on every destructive
// button, and that the write calls never put the key in a URL either.

delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(HERE, 'page.html'), 'utf8');

test('ADMIN-2: the write calls also send the key as a header, never in a URL', () => {
  assert.ok(HTML.includes("'x-admin-key': state.key, 'Content-Type': 'application/json'"));
  assert.equal(/[?&]key=/.test(HTML), false);
});

test('ADMIN-2: every destructive button has a confirm checkbox beside it', () => {
  const destructive = ['opReset', 'opRetire', 'opUnseat'];
  for (const id of destructive) {
    const at = HTML.indexOf(`id="${id}"`);
    assert.ok(at > -1, `no button #${id}`);
    const nearby = HTML.slice(Math.max(0, at - 400), at);
    assert.ok(/check.*<input type="checkbox" id="op\w*Confirm"/s.test(nearby) || /id="op\w*Confirm"/.test(nearby),
      `#${id} has no confirm checkbox in its row`);
  }
});

test('ADMIN-2: a negative adjustment is possible from the same field as a positive one', () => {
  assert.ok(HTML.includes('id="opAmount"'), 'one amount field, signed — the route decides destructive from its sign');
});

test('ADMIN-2: the operations section is on the page, after recent births', () => {
  const births = HTML.indexOf('id="births"');
  const ops = HTML.indexOf('id="ops"');
  assert.ok(births > -1 && ops > -1 && ops > births);
});

test('ADMIN-2: the audit log table is on the page and reloads after every write handler', () => {
  assert.ok(HTML.includes('id="opAuditTable"'));
  const writers = ['opAdjust', 'opReset', 'opRename', 'opRetire', 'opUnretire', 'opUnseat', 'opForce'];
  for (const id of writers) {
    const at = HTML.indexOf(`document.getElementById('${id}').addEventListener`);
    assert.ok(at > -1, `no handler for #${id}`);
    const scope = HTML.slice(at, HTML.indexOf('});', at) + 3);
    assert.ok(scope.includes('loadAudit()'), `#${id}'s handler never refreshes the audit log`);
  }
});

test('ADMIN-2: every id the write panel\'s script reaches for exists in the markup (belt, on top of page.test.js)', () => {
  const wanted = new Set();
  for (const m of HTML.matchAll(/getElementById\('([^']+)'\)/g)) wanted.add(m[1]);
  const opIds = [...wanted].filter((id) => id.startsWith('op'));
  assert.ok(opIds.length >= 20, `expected the write panel to be wired, found ${opIds.length} op* ids`);
  for (const id of opIds) assert.ok(HTML.includes(`id="${id}"`), `#${id} is missing from the markup`);
});
