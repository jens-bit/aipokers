import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureRosterIdentities } from './identity.js';
import { identitiesFor, identityOf } from '../../client/src/lib/identity.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('BUG-66: a colliding household keeps the same identity in room and solo views', () => {
  const agents = ['bal', 'agg', 'val', 'blf'].map(id => ({ id }));
  const before = identitiesFor(agents);
  assert.equal(ensureRosterIdentities(agents), true);
  for (const agent of agents) {
    assert.equal(identityOf(agent).hood.id, before.get(agent.id).hood.id);
    assert.equal(identityOf(agent).glow.id, before.get(agent.id).glow.id);
  }
  assert.equal(new Set(agents.map(a => a.identity.hood)).size, 4);
  const saved = JSON.stringify(agents);
  assert.equal(ensureRosterIdentities(agents), false);
  assert.equal(JSON.stringify(agents), saved);
});

test('BUG-66: retirement, reordering, mood and new arrivals do not recolor an existing agent', () => {
  const agents = ['bal', 'agg', 'val'].map(id => ({ id }));
  ensureRosterIdentities(agents);
  const old = new Map(agents.map(a => [a.id, { ...a.identity }]));
  agents[0].archived = true;
  agents[1].mood = { state: 'tilted' };
  agents.reverse();
  agents.push({ id: 'newborn' });
  ensureRosterIdentities(agents);
  for (const [id, identity] of old) assert.deepEqual(agents.find(a => a.id === id).identity, identity);
});

test('BUG-66: identity survives JSON persistence and public projection', async () => {
  const { presentAgent } = await import('./agentProfiles.js');
  const agent = { id: 'visible-birth', name: 'Visible', status: 'idle', strategy: 'private' };
  ensureRosterIdentities([agent]);
  const restored = JSON.parse(JSON.stringify(agent));
  assert.deepEqual(presentAgent(restored).identity, agent.identity);
  assert.equal(presentAgent(restored).strategy, undefined);
});

test('BUG-66: loading a legacy SQLite household persists its identity across a restart', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'railbird-identity-'));
  const storeUrl = new URL('./store.js', import.meta.url).href;
  const agentsUrl = new URL('./agentProfiles.js', import.meta.url).href;
  const env = { ...process.env, ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', NOTIFY_ENABLED: '0' };
  const run = code => execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env, encoding: 'utf8' });
  try {
    run(`import { saveProfile, _closeForTests } from ${JSON.stringify(storeUrl)};
      saveProfile('legacy', { userId: 'legacy', agents: ['bal', 'agg', 'val'].map(id => ({ id, name: id })), chat: [] });
      _closeForTests();`);
    const read = `import { agentsOf } from ${JSON.stringify(agentsUrl)};
      import { loadProfile, _closeForTests } from ${JSON.stringify(storeUrl)};
      const shown = agentsOf('legacy').map(a => a.identity);
      const stored = loadProfile('legacy').agents.map(a => a.identity);
      console.log('IDENTITY:' + JSON.stringify({ shown, stored })); _closeForTests();`;
    const parse = output => JSON.parse(output.split('\n').find(l => l.startsWith('IDENTITY:')).slice(9));
    const first = parse(run(read));
    assert.ok(first.shown.every(i => i?.hood && i?.glow));
    assert.deepEqual(first.stored, first.shown);
    assert.deepEqual(parse(run(read)), first);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
