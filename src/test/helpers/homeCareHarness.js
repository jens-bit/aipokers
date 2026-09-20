// Callers must provide a fresh scratch cwd before importing this native fixture.
import crypto from 'node:crypto';
import express from 'express';
import * as store from '../../server/store.js';
import * as profiles from '../../server/agentProfiles.js';
import * as registry from '../../server/tableRegistry.js';
import * as homeGame from '../../server/homeGame.js';
import * as floor from '../../server/floorChannel.js';
import { createServer } from '../../server/wsServer.js';

export async function homeCareHarness() {
  const owner = '27901', agentId = 'home-care-browser';
  const app = express(); app.use(express.json());
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
  function seed(snacks = 3) {
    homeGame.reset(); registry.resetRegistry('next Home care case');
    store.saveWallet(owner, { ownerId: owner, balance: 10000, fridge: { snack: snacks, beer: 1 }, ledger: [] });
    store.saveProfile(owner, { userId: owner, agents: [{ id: agentId, name: 'The Clock', status: 'idle', activeTableId: null,
      style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: 2000,
      pocket: { agentId, balance: 2000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
      nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 30 },
      stamina: { left: 20, at: Date.now(), stage: 'worn' }, attrs: { STAMINA: 50 },
      stats: { handsPlayed: 40, handsWon: 15 }, profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 },
      sessionLog: [], ledger: [] }] });
    profiles.reloadOwners(owner);
    return state();
  }
  function state() {
    const agent = record(); const wallet = store.loadWallet(owner);
    return { owner, agentId, snacks: wallet.fridge.snack, safe: wallet.balance, left: agent.stamina.left,
      homeItem: agent.homeItem ?? null, want: profiles.presentAgentById(agentId, owner, { owner: true }).want,
      refusal: profiles.restRefusalFor(agentId, owner), tableId: registry.tableOfAgent(agentId)?.tableId ?? null };
  }
  async function stop() {
    for (const ws of wss.clients) ws.terminate();
    homeGame.reset(); floor.reset(); registry.resetRegistry('Home care fixture over');
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    store._closeForTests();
  }
  return { base, owner, agentId, credential, seed, state, record, stop };
}
