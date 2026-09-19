// Native child process: keeps the real server/database outside Playwright's
// module loader and closes every SQLite handle before scratch cleanup.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.env.RATE_LIMIT_CHAT_MAX = '1000';
process.env.NOTIFY_ENABLED = '0';
const store = await import('../../../src/server/store.js');
const profiles = await import('../../../src/server/agentProfiles.js');
const registry = await import('../../../src/server/tableRegistry.js');
const tape = await import('../../../src/server/tapeRoom.js');
const { default: express } = await import('express');
const app = express(); app.use(express.json());
profiles.installAgentProfileRoutes(app); tape.installTapeRoomRoutes(app);
const server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
profiles.setHomeChangeListener(() => process.send?.({ event: 'home-change' }));
profiles.setAgentChangeListener(() => process.send?.({ event: 'home-change' }));
process.send({ event: 'ready', backend: `http://127.0.0.1:${server.address().port}` });
process.on('message', async ({ id, method, owner, agent, wallet }) => {
  try {
    let result;
    if (method === 'seed') {
      registry.resetRegistry('next browser command case'); tape.reset();
      store.saveWallet(owner, wallet);
      store.saveProfile(owner, { userId: owner, agents: [agent] });
      profiles.reloadOwners(owner); profiles.setLiveTableProvider(registry);
    } else if (method === 'snapshot') result = profiles.homeSnapshot(owner, { owner: true });
    else if (method === 'state') result = {
      table: registry.tableOfAgent(agent)?.bigBlind ?? null,
      wallet: store.loadWallet(owner), pocket: profiles._agentRecordForTests(agent, owner).pocket,
    };
    else if (method === 'reset') { registry.resetRegistry('browser case over'); tape.reset(); }
    else if (method === 'stop') {
      profiles.setHomeChangeListener(null); profiles.setAgentChangeListener(null); registry.resetRegistry('browser fixture over'); tape.reset();
      await new Promise(resolve => server.close(resolve)); store._closeForTests();
      process.send({ id }); process.disconnect(); return;
    } else throw new Error(`Unknown fixture method ${method}`);
    process.send({ id, result });
  } catch (error) { process.send({ id, error: error.stack }); }
});
