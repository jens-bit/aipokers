delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-watch-return-browser-token';
process.env.NOTIFY_ENABLED = '0';
const { watchReturnHarness } = await import('../../../src/test/helpers/watchReturnHarness.js');
const harness = await watchReturnHarness();
process.send({ event: 'ready', backend: harness.base, credential: harness.credential(), owner: harness.owner, agentId: harness.agentId });
process.on('message', async ({ id, method }) => {
  try {
    if (method === 'stop') { await harness.stop(); process.send({ id }); process.disconnect(); return; }
    if (!['seed', 'state', 'settle'].includes(method)) throw new Error('Unknown return fixture method');
    process.send({ id, result: harness[method]() });
  } catch (error) { process.send({ id, error: error.stack }); }
});
