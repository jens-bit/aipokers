import express from 'express';
import { installAgentProfileRoutes } from '../src/server/agentProfiles.js';

const app = express();
app.use(express.json({ limit: '64kb' }));
installAgentProfileRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

console.log('\n-- first-run profile --');
{
  const { response, body } = await request('/api/agent-profile?userId=telegram:smoke-zero');
  check('profile request succeeds', response.ok);
  check('new profile has no agents', body.hasAgents === false && body.agents.length === 0);
  check('initial chat is product copy', /playing style/.test(body.chat[0]?.content || ''));
}

console.log('\n-- validation --');
{
  const { response, body } = await request('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'telegram:smoke-zero', content: '' }),
  });
  check('empty chat turn is rejected', response.status === 400);
  check('validation error names content', body.error === 'content required');
}

console.log('\n-- create first agent --');
{
  const { response, body } = await request('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'telegram:smoke-zero', content: 'Balanced heads-up player' }),
  });
  check('chat turn succeeds', response.ok);
  check('agent was created', body.hasAgents === true && body.createdAgent?.name === 'Balanced v1');
  check('agent has deployment-safe defaults', body.createdAgent?.bankroll === 0 && body.createdAgent?.deployStatus === 'needs_funding');
  check('table label fits compact UI', body.createdAgent?.tablePreference === 'HU NLH / $10-$20');
}

console.log('\n-- reset first-run --');
{
  const { response, body } = await request('/api/agent-profile?userId=telegram:smoke-zero', { method: 'DELETE' });
  check('reset succeeds', response.ok);
  check('reset returns to zero agents', body.hasAgents === false && body.agents.length === 0);
}

console.log('\n-- style inference --');
{
  const tight = await request('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'telegram:smoke-tight', content: 'Make it tight and low risk' }),
  });
  check('tight prompt creates Sentinel v1', tight.body.createdAgent?.name === 'Sentinel v1');
  check('tight prompt is low risk', tight.body.createdAgent?.risk === 'Low');

  const pressure = await request('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'telegram:smoke-pressure', content: 'Aggressive pressure agent' }),
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

console.log('\n-- summary --');
if (failures === 0) {
  console.log('all checks passed');
} else {
  console.error(`${failures} checks failed`);
  process.exitCode = 1;
}
