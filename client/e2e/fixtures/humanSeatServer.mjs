delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-human-seat-browser-token';
process.env.NOTIFY_ENABLED = '0';

const { default: assert } = await import('node:assert/strict');
const { default: crypto } = await import('node:crypto');
const { default: express } = await import('express');
const store = await import('../../../src/server/store.js');
const profiles = await import('../../../src/server/agentProfiles.js');
const registry = await import('../../../src/server/tableRegistry.js');
const home = await import('../../../src/server/homeGame.js');
const { Table } = await import('../../../src/server/table.js');
const { createServer } = await import('../../../src/server/wsServer.js');

// Only AI decision scheduling is held. JOIN, reconnect, native human actions,
// 15s deadlines, hand transitions and signed socket delivery are production.
Table.prototype._maybeRunAiTurn = async () => {};
const owner = '26701';
const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const { wss } = createServer({ server });
const backend = `http://127.0.0.1:${server.address().port}`;
let table;
const credential = () => {
  const fields = { id: owner, first_name: 'Jens', auth_date: String(Math.floor(Date.now() / 1000)) };
  const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(text).digest('hex') }).toString();
};
const humanSeat = () => table.pending.findIndex((p, seat) => p && !table.aiSeats[seat]);
function state() {
  const seat = humanSeat(), game = table.game, player = game?.seats?.[seat];
  return { now: Date.now(), tableId: table.tableId, seat, playerId: table.pending[seat]?.playerId,
    connected: table.connections[seat]?.readyState === 1, hand: game?.handNumber,
    street: game?.street, pot: game?.pot, toAct: game?.toAct, folded: player?.folded,
    cards: player?.holeCards, stack: player?.stack, timer: table._actionTimerPayload(),
    legal: game && seat >= 0 ? game.legalActions(seat) : [],
    actionSeq: table._actionSeq, actions: structuredClone(table.currentHandActionLog),
    chips: game?.seats.reduce((sum, seat) => sum + seat.stack + seat.contribTotal, 0),
    safe: store.loadWallet(owner)?.balance,
  };
}
function aiStep() {
  const seat = table.game.toAct;
  assert.ok(table.aiSeats[seat], 'fixture never chooses a human action');
  const legal = table.game.legalActions(seat);
  const action = legal.find(a => a.type === 'check') ?? legal.find(a => a.type === 'call');
  assert.ok(action, 'controlled AI can check or call');
  // This shared native action path logs, broadcasts, arms the next real clock
  // and completes the hand in the same order as a player action.
  table._applyHumanAction(seat, { type: action.type });
}
async function advance() {
  for (let i = 0; i < 80; i++) {
    if (table.game?.street === 'complete') {
      const hand = table.game.handNumber;
      const until = Date.now() + 8000;
      while (table.game?.handNumber === hand && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
      assert.notEqual(table.game?.handNumber, hand, 'native next deal arrives');
    }
    if (table.game.toAct === humanSeat()) return state();
    aiStep();
  }
  throw new Error('No human turn reached');
}
function seed() {
  registry.resetRegistry('next human browser case');
  store.saveWallet(owner, { ownerId: owner, balance: 10000, ledger: [] });
  store.saveProfile(owner, { userId: owner, agents: ['Moss', 'Indigo'].map((name, i) => ({
    id: `human-host-${i}`, name, status: 'idle', activeTableId: null, style: 'Balanced', risk: 'Medium',
    strategy: 'Play patiently.', bankroll: 2000, pocket: { balance: 2000, mode: 'topup', ledger: [] },
    identity: { hood: i ? 'indigo' : 'moss', glow: i ? 'ice' : 'gold' },
    mood: { state: 'neutral', heat: 20 }, nature: { name: 'Rock' },
    profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 },
    stats: { handsPlayed: 20, handsWon: 7 }, sessionLog: [], ledger: [],
  })) });
  profiles.reloadOwners(owner);
  const game = home.sync(owner, { manual: true });
  table = registry.getTable(game.tableId);
  assert.ok(table?.home, 'real kitchen table opened');
  table.maybeStartHand();
  return state();
}
async function drop() {
  const seat = humanSeat(), socket = table.connections[seat];
  assert.ok(socket && socket.readyState === 1, 'human native socket is connected');
  socket.terminate();
  const until = Date.now() + 2000;
  while (table.connections[seat] === socket && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(table.connections[seat], null, 'native close handler reserved the seat');
  return state();
}
async function stop() {
  for (const ws of wss.clients) ws.terminate();
  home.reset(); registry.resetRegistry('human browser over');
  await new Promise(resolve => wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
  store._closeForTests();
}
process.on('message', async ({ id, method }) => {
  try {
    if (method === 'stop') { await stop(); process.send({ id }); process.disconnect(); return; }
    const operation = { seed, state, advance, drop }[method];
    if (!operation) throw new Error('Unknown human fixture operation');
    process.send({ id, result: await operation() });
  } catch (error) { process.send({ id, error: error.stack }); }
});
process.send({ event: 'ready', backend, owner, credential: credential() });
