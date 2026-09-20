delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-home-care-browser-token';
process.env.NOTIFY_ENABLED = '0';
const { homeCareHarness } = await import('../../../src/test/helpers/homeCareHarness.js');
const harness = await homeCareHarness();
process.send({ event: 'ready', backend: harness.base, credential: harness.credential(), owner: harness.owner, agentId: harness.agentId });
process.on('message', async ({ id, method, snacks }) => {
  try {
    if (method === 'stop') { await harness.stop(); process.send({ id }); process.disconnect(); return; }
    if (!['seed', 'state'].includes(method)) throw new Error('Unknown Home care fixture method');
    process.send({ id, result: harness[method](snacks) });
  } catch (error) { process.send({ id, error: error.stack }); }
});
