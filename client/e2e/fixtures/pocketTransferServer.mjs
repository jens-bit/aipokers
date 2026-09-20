// Real signed money routes and a paid live hand, isolated by the browser spec.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-pocket-transfer-browser-token';
process.env.NOTIFY_ENABLED = '0';
const { watchReturnHarness } = await import('../../../src/test/helpers/watchReturnHarness.js');
const registry = await import('../../../src/server/tableRegistry.js');
const store = await import('../../../src/server/store.js');
const harness = await watchReturnHarness();
process.send({ event: 'ready', backend: harness.base, credential: harness.credential(), owner: harness.owner, agentId: harness.agentId });
process.on('message', async ({ id, method }) => {
  try {
    if (method === 'stop') { await harness.stop(); process.send({ id }); process.disconnect(); return; }
    if (!['seed', 'state'].includes(method)) throw new Error('Unknown pocket fixture method');
    const state = harness[method]();
    const table = registry.tableOfAgent(harness.agentId);
    process.send({ id, result: { ...state, game: table.game.getState(),
      saved: store.loadProfile(harness.owner).agents.find(agent => agent.id === harness.agentId).pocket } });
  } catch (error) { process.send({ id, error: error.stack }); }
});
