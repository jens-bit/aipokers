// src/server/wants.test.js — WANTS-1
//
// The asks, end to end: one test per want (does his real state raise it, over
// the real route) and one per answer (does yes do the thing, does later go
// quiet and come back, does no clear it, and does each of the three land in
// the owner ledger).
//
// The trigger table itself is tested in src/agent/wants.test.js against plain
// numbers. What is only testable HERE is the wiring: that an agent record
// produces the state the trigger reads, that the want rides presentAgent, and
// that answering it moves wallets, benches, ledgers and nothing else.
//
// One server, one seed, one agent per want. They are separate agents rather
// than one agent walked through seven states because the priority ladder means
// a single record can only ever be asking one thing — which is the feature.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';
import { ASK_SNOOZE_MS } from '../agent/wants.js';

const MIN = 60_000;
const now = Date.now();

const getJson = (url) => fetch(url).then((r) => r.json());
const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

// A solvent, unremarkable agent at the bar. Each seed below is this plus the
// one thing that makes him ask for something.
function agent(id, name, over = {}) {
  return {
    id,
    name,
    status: 'idle',
    activeTableId: null,
    fatigue: 'fresh',
    restedAt: now - 5 * MIN,          // home, but not long enough to be bored
    bankroll: 5_000,
    pocket: { balance: 5_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 300, handsWon: 150, winRate: 50, biggestPot: 900 },
    sessionLog: [{ endedAt: now - 20 * MIN, mood: 'neutral', net: 100, hands: 40, biggestPot: 900 }],
    ...over,
  };
}

// Auth off — the documented local-dev posture, and independent of whatever the
// developer happens to have exported. Same harness as walletRoutes.test.js.
async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wants1-'));
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  const savedSecret = process.env.DEV_API_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);

  const { default: express } = await import('express');
  const { installAgentProfileRoutes } = await import('./agentProfiles.js');
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

const ledgerTypes = (view) => (view.ownerMemory ?? []).map((e) => e.type);

test('WANTS-1: the seven asks, and answering them', async (t) => {
  const { setLiveTableProvider, noteNemesisSeated, resetNemesisSightings } = await import('./agentProfiles.js');

  // Nobody is at a table: every agent below is at the bar, which is where six
  // of the seven asks live. `hasTable` answers for the nemesis's table only.
  setLiveTableProvider({
    getTable: () => null,
    hasTable: (id) => id === 'backroom-table',
    getLiveGame: () => null,
    // Enough of the deploy path to get past the floor-capacity check, so the
    // one deploy this file makes fails or succeeds on the REST BENCH and not
    // on a missing stub method.
    countAutonomousTables: () => 0,
    MAX_CONCURRENT_TABLES: 4,
    findJoinableTable: () => null,
    getDefaultBlinds: () => ({ smallBlind: 10, bigBlind: 20 }),
  });

  try {
    await withServer(async (base) => {
      const store = await import('./store.js');
      store.saveWallet('u1', { ownerId: 'u1', balance: 10_000, ledger: [] });
      store.saveProfile('u1', {
        userId: 'u1',
        chat: [],
        agents: [
          // 1 — worn. He wants to sit one out.
          agent('worn', 'The Grinder', { fatigue: 'worn', restedAt: now }),
          // 2 — fresh and sat at the bar for over twenty minutes.
          agent('bored', 'Ready Freddy', { restedAt: now - 25 * MIN }),
          // 3 — hot, and long enough off the felt to want a drink instead of
          //     his seat back.
          agent('hot', 'Steaming', { mood: { state: 'tilted', heat: 78, losingRun: 3 }, restedAt: now - 15 * MIN }),
          // 3 — hot, and straight off the felt. The dangerous one.
          agent('justleft', 'Back In There', { mood: { state: 'tilted', heat: 82, losingRun: 4 }, restedAt: now - 2 * MIN }),
          // 4 — cleaned out.
          agent('busted', 'Skint', { bankroll: 0, pocket: { balance: 0, mode: 'allowance', cap: null, realised: 0, ledger: [] } }),
          // 5 — a night worth telling you about: 3,000 against a 1,000 week.
          agent('winner', 'Big Night', {
            sessionLog: [{ endedAt: now - 10 * MIN, mood: 'confident', net: 3_000, hands: 60, biggestPot: 1_000 }],
          }),
          // 0 — the control. Nothing is wrong with him, so he asks for nothing.
          agent('quiet', 'Perfectly Fine'),
          // 6 — the man he cannot beat is in the back room.
          agent('grudge', 'Unfinished Business', {
            bio: {
              nemesis: { playerId: 'p-marlow', displayName: 'Marlow', hands: 120, net: -4_000 },
              rival: null, victim: null,
            },
          }),
        ],
      });

      const wantOf = async (id) => (await getJson(`${base}/api/agents/${id}?userId=u1`)).want;

      // ── one test per want ────────────────────────────────────────────────

      await t.test('worn -> "sit one out"', async () => {
        const want = await wantOf('worn');
        assert.equal(want.kind, 'rest');
        assert.match(want.text, /sit one out/i);
        assert.equal(want.needs, null, 'the server can bench him itself');
        assert.equal(want.dangerous, false);
      });

      await t.test('fresh and idle at home over twenty minutes -> "put me in"', async () => {
        const want = await wantOf('bored');
        assert.equal(want.kind, 'deploy');
        assert.equal(want.text, 'Put me in.');
        assert.equal(want.needs, 'deploy', 'only the client can open the casino');
      });

      await t.test('heat >= 70 at home -> "get me a beer"', async () => {
        const want = await wantOf('hot');
        assert.equal(want.kind, 'beer');
        assert.match(want.text, /beer/i);
        assert.equal(want.item, 'beer');
        assert.equal(want.needs, null, 'the server buys it');
        assert.equal(want.dangerous, false);
      });

      await t.test('heat >= 70 and he just left a table -> "let me back in there", flagged', async () => {
        const want = await wantOf('justleft');
        assert.equal(want.kind, 'back_in');
        assert.match(want.text, /back in there/i);
        assert.equal(want.dangerous, true, 'this is the one the owner has to be told is a bad idea');
        assert.equal(want.needs, 'deploy');
      });

      await t.test('busted -> "front me?"', async () => {
        const want = await wantOf('busted');
        assert.equal(want.kind, 'fund');
        assert.equal(want.text, 'Front me?');
        assert.equal(want.needs, 'fund');
      });

      await t.test('a session at three times the week\'s biggest pot -> "you have to hear about this hand"', async () => {
        const want = await wantOf('winner');
        assert.equal(want.kind, 'brag');
        assert.match(want.text, /hear about this hand/i);
        assert.equal(want.needs, 'thread');
      });

      await t.test('his nemesis seated somewhere -> "<name> is in the <room>. Send me."', async () => {
        // Nothing yet: a grudge with nobody sitting down is not a want.
        assert.equal(await wantOf('grudge'), null);

        // The floor says Marlow just took a seat at $50/$100.
        noteNemesisSeated({ playerId: 'p-marlow', displayName: 'Marlow', tableId: 'backroom-table', bigBlind: 100 });

        const want = await wantOf('grudge');
        assert.equal(want.kind, 'nemesis');
        assert.equal(want.text, 'Marlow is in the back room. Send me.');
        assert.equal(want.room, 'backroom');
        assert.equal(want.needs, 'deploy');
      });

      await t.test('a quiet agent is asking for nothing at all', async () => {
        // The seed's own baseline, with nothing added: home five minutes,
        // level, solvent, a normal night behind him and no grudge in the
        // building. Seven triggers, and not one of them fires. This is the
        // test that fails first if any threshold above is set to something a
        // perfectly ordinary agent clears.
        assert.equal(await wantOf('quiet'), null);
      });

      // ── one test per answer ──────────────────────────────────────────────

      await t.test('no clears it, writes a NEUTRAL ledger line, and he does not ask again', async () => {
        const res = await postJson(`${base}/api/agents/winner/want?userId=u1`, { userId: 'u1', answer: 'no' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.answered, 'no');
        assert.equal(body.kind, 'brag');
        assert.equal(body.want, null);

        const view = await getJson(`${base}/api/agents/winner?userId=u1`);
        assert.equal(view.want, null, 'gone, and not straight back');
        const line = (view.ownerMemory ?? []).find((e) => e.type === 'want_refused');
        assert.ok(line, `no want_refused line: ${ledgerTypes(view).join(',')}`);
        assert.equal(line.tone, 0, 'saying no is a decision, not a hostility');
        assert.match(line.text, /said no when I asked/i);
        assert.doesNotMatch(line.text, /You have to hear/, 'a paraphrase, never the line he said');
      });

      await t.test('later goes quiet for thirty minutes and brings back the SAME want', async () => {
        const before = await wantOf('busted');
        const res = await postJson(`${base}/api/agents/busted/want?userId=u1`, { userId: 'u1', answer: 'later' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.answered, 'later');
        assert.equal(body.want, null);
        assert.ok(body.snoozedUntil > Date.now(), 'and it has a deadline');
        assert.ok(body.snoozedUntil <= Date.now() + ASK_SNOOZE_MS + 1_000);

        const during = await getJson(`${base}/api/agents/busted?userId=u1`);
        assert.equal(during.want, null, 'silent while snoozed');
        assert.equal(during.ownerMemory.some((e) => e.type === 'want_snoozed'), true);
        assert.equal(during.ownerMemory.find((e) => e.type === 'want_snoozed').tone, 0);

        // Wind the snooze back by hand — the same want object, unanswered,
        // surfaces again. That is the whole difference between later and no.
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        _agentRecordForTests('busted', 'u1').want.snoozedUntil = Date.now() - 1;

        const after = await wantOf('busted');
        assert.equal(after.kind, 'fund');
        assert.equal(after.text, before.text, 'the same ask, word for word');
      });

      await t.test('yes on a beer spends 200 from the WALLET and soothes him', async () => {
        const walletBefore = (await getJson(`${base}/api/agents?userId=u1`)).wallet?.balance
          ?? (await import('./store.js')).loadWallet('u1').balance;

        const res = await postJson(`${base}/api/agents/hot/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.answered, 'yes');
        assert.equal(body.kind, 'beer');
        assert.equal(body.given, 'beer');
        assert.equal(body.spent, 200, '§7.1: the one item, 200 chips, from the wallet');
        assert.equal(body.soothed, true);
        assert.ok(body.mood.heat < 78, `heat did not move: ${body.mood.heat}`);
        assert.equal(body.needs, undefined, 'the server did the whole thing');

        const wallet = (await import('./store.js')).loadWallet('u1');
        assert.equal(wallet.balance, walletBefore - 200, 'and nothing came out of his pocket');

        const view = await getJson(`${base}/api/agents/hot?userId=u1`);
        assert.equal(view.want, null);
        assert.ok(ledgerTypes(view).includes('item_given'), 'the RELATE-1d line still lands');
        assert.ok(ledgerTypes(view).includes('want_granted'), 'and the answer does too');
      });

      await t.test('yes on "put me in" hands the client a room to open', async () => {
        const res = await postJson(`${base}/api/agents/bored/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.needs, 'deploy', 'the server cannot seat him; the casino screen can');
        assert.equal(body.kind, 'deploy');
        assert.ok('room' in body, 'room rides every deploy answer, null when he named none');

        const view = await getJson(`${base}/api/agents/bored?userId=u1`);
        assert.equal(view.want, null);
        const line = (view.ownerMemory ?? []).find((e) => e.type === 'want_granted');
        assert.ok(line);
        assert.equal(line.tone, 1);
      });

      await t.test('yes on "send me" names the room he asked for', async () => {
        const res = await postJson(`${base}/api/agents/grudge/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.kind, 'nemesis');
        assert.equal(body.needs, 'deploy');
        assert.equal(body.room, 'backroom', 'the client opens the room the man is actually in');
      });

      await t.test('yes on "front me?" points at the wallet and moves no money on its own', async () => {
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        _agentRecordForTests('busted', 'u1').want.snoozedUntil = Date.now() - 1;

        const before = (await import('./store.js')).loadWallet('u1').balance;
        const res = await postJson(`${base}/api/agents/busted/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.needs, 'fund');
        assert.equal((await import('./store.js')).loadWallet('u1').balance, before,
          'staking him is a decision with an amount on it — this route does not guess one');
      });

      await t.test('yes on a DANGEROUS want is recorded as exactly that', async () => {
        const res = await postJson(`${base}/api/agents/justleft/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.kind, 'back_in');
        assert.equal(body.needs, 'deploy');

        const view = await getJson(`${base}/api/agents/justleft?userId=u1`);
        const types = ledgerTypes(view);
        assert.ok(types.includes('want_yes_dangerous'),
          `bio/relate has to be able to find this one: ${types.join(',')}`);
        assert.equal(types.includes('want_granted'), false, 'one answer, one line');
        const line = view.ownerMemory.find((e) => e.type === 'want_yes_dangerous');
        assert.match(line.text, /steaming/i);
      });

      await t.test('yes on "sit one out" benches him until STAMINA has him back at fresh', async () => {
        const res = await postJson(`${base}/api/agents/worn/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        const body = await res.json();
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.kind, 'rest');
        assert.equal(body.benched, true);
        assert.equal(body.restingUntil, 'fresh');

        // The bench has to mean something, or the answer was theatre.
        const deploy = await postJson(`${base}/api/agents/worn/deploy`, { userId: 'u1' });
        const denied = await deploy.json();
        assert.equal(deploy.status, 409, JSON.stringify(denied));
        assert.equal(denied.error, 'agentResting');
        assert.equal(denied.restingUntil, 'fresh');

        // And it lets go by itself: attributes.js recovers one stage every two
        // hours at the bar, so five hours ago is a man who is fresh again.
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        _agentRecordForTests('worn', 'u1').restedAt = Date.now() - 5 * 60 * 60_000;

        const again = await postJson(`${base}/api/agents/worn/deploy`, { userId: 'u1' });
        const body2 = await again.json().catch(() => ({}));
        assert.notEqual(body2.error, 'agentResting', 'nothing to press — the bench clears itself');
        assert.notEqual(again.status, 409, JSON.stringify(body2));
      });

      // ── the rules, over the wire ─────────────────────────────────────────

      await t.test('one want per agent, and the higher one wins', async () => {
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        const rec = _agentRecordForTests('grudge', 'u1');
        // He is asking for nothing (his nemesis want was answered). Make him
        // hot AND bored AND broke at once.
        rec.want = null;
        rec.wantCooldowns = {};
        rec.mood = { state: 'tilted', heat: 90, losingRun: 4 };
        rec.restedAt = Date.now() - 30 * 60_000;
        rec.pocket.balance = 0;

        const want = await wantOf('grudge');
        assert.equal(want.kind, 'deploy', 'fresh-and-idle (2) outranks hot (3) and broke (4)');

        // Now cook him. Being cooked outranks everything, including a want
        // already on the table.
        rec.fatigue = 'worn';
        rec.restedAt = Date.now();
        assert.equal((await wantOf('grudge')).kind, 'rest');
      });

      await t.test('a lower-priority want never displaces a higher one', async () => {
        const { _agentRecordForTests } = await import('./agentProfiles.js');
        const rec = _agentRecordForTests('grudge', 'u1');
        assert.equal(rec.want.kind, 'rest');
        // Rest him off the "worn" reading but leave him broke: `fund` (4) is
        // now the only candidate, and it must not take the pending `rest` (1).
        rec.fatigue = 'settled';
        rec.restedAt = Date.now();
        assert.equal((await wantOf('grudge')).kind, 'rest', 'he is still asking the bigger thing');
      });

      await t.test('answering something that is not pending is a 400, not a silent success', async () => {
        const res = await postJson(`${base}/api/agents/hot/want?userId=u1`, { userId: 'u1', answer: 'yes' });
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error, 'nothing pending');
      });

      await t.test('an answer has to be one of the three', async () => {
        const res = await postJson(`${base}/api/agents/grudge/want?userId=u1`, { userId: 'u1', answer: 'maybe' });
        assert.equal(res.status, 400);
        assert.match((await res.json()).error, /yes, later, no/);
      });

      // ── the wire ─────────────────────────────────────────────────────────
      //
      // Inside this block rather than a test() of its own: agentProfiles
      // caches the agent store in a module-level object on first read, so only
      // the first withServer() in a process can seed through store.saveProfile
      // — the same reason walletRoutes.test.js shares one server.

      await t.test('the want rides the floor snapshot and pushes WANT when it changes', async () => {
        const floor = await import('./floorChannel.js');
        const { ServerMsg } = await import('./protocol.js');
        const { setWantListener, refreshWantsFor, _agentRecordForTests } = await import('./agentProfiles.js');

        const mkWs = () => ({ readyState: 1, OPEN: 1, sent: [], send(p) { this.sent.push(JSON.parse(p)); } });
        const mine = mkWs();
        const someoneElses = mkWs();

        floor.configure({ liveTables: null });
        setWantListener((userId, agentId, want) => floor.broadcastWant(userId, agentId, want));
        floor.subscribe(mine, { userId: 'u1', owner: true });
        floor.subscribe(someoneElses, { userId: 'u2', owner: true });

        try {
          // 1 — it rides FLOOR_STATE, so a client that has just subscribed
          //     already knows what everyone is asking for.
          const state = mine.sent.find((m) => m.type === ServerMsg.FLOOR_STATE);
          assert.ok(state, 'no FLOOR_STATE');
          for (const a of state.agents) {
            assert.ok('want' in a, `${a.id} has no want field on the floor snapshot`);
          }

          // 2 — a want appearing is a push. The control agent has been asking
          //     for nothing all file; give him twenty-five minutes of boredom.
          const quiet = _agentRecordForTests('quiet', 'u1');
          quiet.restedAt = Date.now() - 25 * MIN;
          refreshWantsFor('u1');

          const pushed = mine.sent.filter((m) => m.type === ServerMsg.WANT && m.agentId === 'quiet');
          assert.equal(pushed.length, 1, 'exactly one push for one change');
          assert.equal(pushed[0].userId, 'u1');
          assert.equal(pushed[0].want.kind, 'deploy');
          assert.equal(pushed[0].want.text, 'Put me in.');

          // 3 — it is owner-filtered. What a man asks his backer for is
          //     between the two of them, unlike the ticker.
          assert.equal(someoneElses.sent.filter((m) => m.type === ServerMsg.WANT).length, 0);

          // 4 — an unchanged floor is silent. This is what stops the channel
          //     turning into a poll with extra steps.
          const before = mine.sent.length;
          refreshWantsFor('u1');
          refreshWantsFor('u1');
          assert.equal(mine.sent.length, before, 'nothing changed, so nothing was sent');

          // 5 — and answering pushes the clearing, so the badge goes away
          //     without the client asking.
          const res = await postJson(`${base}/api/agents/quiet/want?userId=u1`, { userId: 'u1', answer: 'no' });
          assert.equal(res.status, 200, JSON.stringify(await res.json()));
          const cleared = mine.sent.filter((m) => m.type === ServerMsg.WANT && m.agentId === 'quiet').at(-1);
          assert.equal(cleared.want, null, 'null is how he stops asking');
        } finally {
          setWantListener(null);
          floor.reset();
        }
      });

      await t.test('a want cannot be answered by somebody who does not own him', async () => {
        const res = await postJson(`${base}/api/agents/grudge/want?userId=someone-else`, {
          userId: 'someone-else', answer: 'yes',
        });
        assert.equal(res.status, 404, 'not even far enough to be told what he wants');
      });
    });
  } finally {
    resetNemesisSightings();
    setLiveTableProvider(null);
  }
});
