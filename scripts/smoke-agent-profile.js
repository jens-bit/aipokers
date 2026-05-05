import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ai-poker-agents-'));
const originalCwd = process.cwd();
process.chdir(tmpDir);

const { installAgentProfileRoutes } = await import('../src/server/agentProfiles.js');

const app = express();
app.use(express.json({ limit: '64kb' }));
installAgentProfileRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;
const userId = `telegram:smoke-${Date.now()}`;

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const body = await response.json();
  return { response, body };
}

async function postJson(route, body) {
  return request(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

console.log('\n-- first-run profile --');
{
  const { response, body } = await request(`/api/agent-profile?userId=${encodeURIComponent(userId)}`);
  check('profile request succeeds', response.ok);
  check('new profile has no agents', body.hasAgents === false && body.agents.length === 0);
  check('initial chat introduces agent creation', /agent/i.test(body.chat[0]?.content || ''));
}

console.log('\n-- validation --');
{
  const { response, body } = await postJson('/api/agents/chat', { userId, content: '' });
  check('empty chat turn is rejected', response.status === 400);
  check('validation error names content', body.error === 'content required');
}

let agentId = null;

console.log('\n-- create first agent --');
{
  const { response, body } = await postJson('/api/agents/chat', { userId, content: 'Balanced heads-up player' });
  agentId = body.createdAgent?.id;
  check('chat turn succeeds', response.ok);
  check('agent was created', body.hasAgents === true && body.createdAgent?.name === 'Balanced v1');
  check('agent starts idle', body.createdAgent?.status === 'idle' && body.createdAgent?.activeTableId === null);
  check('agent strategy is present', typeof body.createdAgent?.strategy === 'string' && body.createdAgent.strategy.length > 20);
}

console.log('\n-- roster, edit, deploy, finish --');
{
  const roster = await request(`/api/agents?userId=${encodeURIComponent(userId)}`);
  check('created agent appears in roster', roster.body.agents.length === 1 && roster.body.agents[0].id === agentId);

  const patched = await request(`/api/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name: 'Balanced Test v1', strategy: 'You are a balanced smoke-test poker agent.' }),
  });
  check('agent can be renamed', patched.body.name === 'Balanced Test v1');
  check('agent strategy can be updated', patched.body.strategy === 'You are a balanced smoke-test poker agent.');

  const deployed = await postJson(`/api/agents/${agentId}/deploy`, { userId });
  check('deploy returns table id', /^table-/.test(deployed.body.tableId || ''));
  check('deploy returns agent strategy', deployed.body.strategy === 'You are a balanced smoke-test poker agent.');

  const finished = await postJson(`/api/agents/${agentId}/finish`, { userId });
  check('finish returns agent to idle', finished.body.status === 'idle' && finished.body.activeTableId === null);
}

console.log('\n-- delete agent --');
{
  const deleted = await request(`/api/agents/${agentId}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  check('delete succeeds', deleted.body.success === true);
  const roster = await request(`/api/agents?userId=${encodeURIComponent(userId)}`);
  check('roster is empty after delete', roster.body.agents.length === 0);
}

console.log('\n-- style inference --');
{
  const tight = await postJson('/api/agents/chat', {
    userId: `${userId}-tight`,
    content: 'Make it tight and low risk',
  });
  check('tight prompt creates Sentinel v1', tight.body.createdAgent?.name === 'Sentinel v1');
  check('tight prompt is low risk', tight.body.createdAgent?.risk === 'Low');

  const pressure = await postJson('/api/agents/chat', {
    userId: `${userId}-pressure`,
    content: 'Aggressive pressure agent',
  });
  check('pressure prompt creates Pressure v1', pressure.body.createdAgent?.name === 'Pressure v1');
  check('pressure prompt is high risk', pressure.body.createdAgent?.risk === 'High');
}

await new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) reject(error);
    else resolve();
  });
});
process.chdir(originalCwd);
await rm(tmpDir, { recursive: true, force: true });

console.log('\n-- summary --');
if (failures === 0) {
  console.log('all checks passed');
} else {
  console.error(`${failures} checks failed`);
  process.exitCode = 1;
}
