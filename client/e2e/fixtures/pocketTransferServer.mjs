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
    if (!['seed', 'seedHistory', 'state'].includes(method)) throw new Error('Unknown pocket fixture method');
    const state = harness[method === 'seedHistory' ? 'seed' : method]();
    if (method === 'seedHistory') {
      const wallet = store.loadWallet(harness.owner);
      // A normal populated statement, like the reported You-screen capture.
      // These prior paired transfers net to zero; current balances and the
      // real committed hand still come from the native harness above.
      wallet.ledger = Array.from({ length: 20 }, (_, index) => ({
        id: `past-transfer-${index}`, ts: Date.now() - (index + 1) * 60000,
        type: index % 2 ? 'fund' : 'cashout', amount: index % 2 ? -2000 : 2000,
        agentId: harness.agentId,
      }));
      store.saveWallet(harness.owner, wallet);
    }
    const table = registry.tableOfAgent(harness.agentId);
    process.send({ id, result: { ...state, game: table.game.getState(),
      saved: store.loadProfile(harness.owner).agents.find(agent => agent.id === harness.agentId).pocket } });
  } catch (error) { process.send({ id, error: error.stack }); }
});
