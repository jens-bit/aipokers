delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-home-care-browser-token';
process.env.NOTIFY_ENABLED = '0';
const { homeCareHarness } = await import('../../../src/test/helpers/homeCareHarness.js');
const { saveOwner } = await import('../../../src/server/agentProfiles.js');
const { badBeatHand } = await import('../../src/test/fixtures/flagged.js');
const harness = await homeCareHarness();
process.send({ event: 'ready', backend: harness.base, credential: harness.credential(), owner: harness.owner, agentId: harness.agentId });
process.on('message', async ({ id, method, snacks, flagged = false }) => {
  try {
    if (method === 'stop') { await harness.stop(); process.send({ id }); process.disconnect(); return; }
    if (!['seed', 'state'].includes(method)) throw new Error('Unknown Home care fixture method');
    const result = harness[method](snacks);
    if (method === 'seed' && flagged) {
      // One declared completed hand, served by the real owner-gated route.
      // The browser reaches its sheet through Standup, without mocked reads.
      harness.record().sessionFlagged = [structuredClone(badBeatHand)];
      saveOwner(harness.owner);
    }
    process.send({ id, result });
  } catch (error) { process.send({ id, error: error.stack }); }
});
