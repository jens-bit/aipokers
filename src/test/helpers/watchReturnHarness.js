// Shared native harness for the signed API regression and actual browser flow.
// Callers provide a fresh scratch cwd before importing this module.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import * as store from '../../server/store.js';
import * as profiles from '../../server/agentProfiles.js';
import * as registry from '../../server/tableRegistry.js';
import { createServer } from '../../server/wsServer.js';

export async function watchReturnHarness() {
  const owner = '25901', agentId = 'return-browser';
  let table, requests = 0;
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { if (req.method === 'POST' && req.path.endsWith('/finish')) requests++; next(); });
  profiles.installAgentProfileRoutes(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const { wss } = createServer({ server });
  const base = `http://127.0.0.1:${server.address().port}`;
  const record = () => profiles._agentRecordForTests(agentId, owner);
  function credential(id = owner) {
    const fields = { id, first_name: 'Jens', auth_date: String(Math.floor(Date.now() / 1000)) };
    const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(text).digest('hex') }).toString();
  }
  function seed() {
    registry.resetRegistry('next return case'); requests = 0;
    store.saveWallet(owner, { ownerId: owner, balance: 10000, ledger: [] });
    store.saveProfile(owner, { userId: owner, agents: [{ id: agentId, name: 'The Clock', status: 'idle', activeTableId: null,
      style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: 4000,
      pocket: { agentId, balance: 4000, mode: 'auto', cap: 6000, realised: 0, ledger: [] },
      nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 140, handsWon: 55 },
      profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 }, sessionLog: [], ledger: [] }] });
    profiles.reloadOwners(owner); profiles.setLiveTableProvider(registry);
    const deployed = profiles.deployAgent(owner, agentId, { body: { rung: 0 } });
    assert.equal(deployed.status, 200, JSON.stringify(deployed.body));
    table = registry.tableOfAgent(agentId);
    // Keep native betting/settlement/transport; only the decision clock is manual.
    table._maybeRunAiTurn = async () => {};
    table._clearTimers();
    table.maybeStartHand(); table._clearTimers();
    assert.notEqual(table.game.street, 'waiting');
    assert.notEqual(table.game.street, 'complete');
    return state();
  }
  function state() {
    const agent = record();
    const seat = table?.seatOfAgent(agentId) ?? -1;
    return { owner, agentId, tableId: table?.tableId, activeTableId: agent.activeTableId, requests,
      street: table?.game?.street, seat, folded: table?.game?.seats?.[seat]?.folded,
      pending: table?._benchAfterHand.has(seat) || table?.seatLeaving?.[seat] || false,
      pocket: structuredClone(agent.pocket), safe: store.loadWallet(owner).balance,
      agent: profiles.presentAgent(agent, { owner: true }),
      publicAgent: profiles.presentAgent(agent, { owner: false }) };
  }
  function settle() {
    let actions = 0;
    while (table.game.street !== 'complete') {
      assert.ok(actions++ < 50, 'the controlled hand terminates');
      const seat = table.game.toAct;
      const legal = table.game.legalActions(seat);
      const action = legal.find(a => a.type === 'check') ?? legal.find(a => a.type === 'call') ?? legal.find(a => a.type === 'fold');
      assert.ok(action, JSON.stringify(legal));
      table.game.act(seat, { type: action.type });
    }
    // Match Table's native action ordering: the complete public/owner state
    // reaches WATCH before its hand result and session-end messages. Direct
    // engine actions alone leave a viewer holding the initial preflop frame.
    table._broadcastState();
    table._handCompleted(); table._clearTimers();
    if (table._pendingPaceResult) table._finishPaceHold();
    table._clearTimers();
    return state();
  }
  async function stop() {
    for (const ws of wss.clients) ws.terminate();
    registry.resetRegistry('return fixture over');
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    store._closeForTests();
  }
  return { base, owner, agentId, credential, seed, state, settle, stop };
}
