// src/server/homeRoster.test.js — BUG-46
//
// THE ROSTER INVARIANT.
//
// A household is a list of agents ONE owner drafted. Everything on the HOME
// screen is drawn off `HOME_STATE.agents`, so the moment a body that is not
// his can reach that array untagged, the screen says he owns somebody he does
// not — and BUG-46 is exactly that report from prod: a stranger standing in
// the living room, indistinguishable from a resident.
//
// The invariant, in the one form that is true after VISIT-1:
//
//   Every entry in HOME_STATE.agents is EITHER an active agent whose record
//   lives in this owner's own profile, OR is tagged `guest: true`.
//
// The second half of that is not a loophole, it is the whole of VISIT-1: a
// visitor is SUPPOSED to be visible in the flat — that is what visiting is —
// and `guest: true` is what stops the client drawing him as one of yours (it
// takes the tap off his body, HomeScreen.jsx:792). What must never happen is
// the untagged case. So the assertion below is not "no strangers"; it is
// "no UNMARKED strangers", and it is written to fail loudly if the tag is
// ever dropped from the projection, from visit.js's body, or from the concat
// in homeSnapshot.
//
// The last test is the other half of the same rule at the table: a guest's
// SEAT is booked under his own owner, so nothing about the visit credits his
// hands, his money or his grudges to the household he is standing in.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-roster-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;

const OWNER = 'roster-owner';
const OTHER = 'roster-other';

let store;
let profiles;
let registry;
let homeGame;
let visitMod;

function mkAgent(id, name, over = {}) {
  return {
    id,
    name,
    status: 'idle',
    activeTableId: null,
    strategy: 'You are a poker player.',
    style: 'Balanced',
    risk: 'Medium',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 40, handsWon: 12 },
    profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    ...over,
  };
}

// Every profile is written BEFORE agentProfiles is first touched — the same
// trap home.test.js and visit.test.js both document: the module caches the
// loaded store, and a profile saved after its first read is invisible to it.
before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.GUEST_ENABLED;
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);

  store.saveProfile(OWNER, {
    userId: OWNER,
    chat: [],
    agents: [
      mkAgent('mine-a', 'The Clock'),
      mkAgent('mine-b', 'River Rat'),
      mkAgent('mine-gone', 'Dead Money', { archived: true }),
    ],
  });
  store.saveProfile(OTHER, {
    userId: OTHER,
    chat: [],
    agents: [mkAgent('theirs', 'The Grinder')],
  });

  profiles = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  homeGame = await import('./homeGame.js');
  visitMod = await import('./visit.js');
  profiles.setLiveTableProvider(registry);
});

after(() => {
  try { registry?.resetRegistry('test over'); } catch { /* best effort */ }
  homeGame?.reset();
  visitMod?.reset();
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// Fresh records every test, written into the SAME cached array agentProfiles
// already holds — visit.test.js's own note applies here too. It matters twice
// over in this file: visit.reset() clears the in-memory visit map but leaves
// `visiting` stamped on the agent's record, and a stale one refuses the next
// knock with `alreadyVisiting`.
function resetAgents(userId, list) {
  const arr = profiles.agentsOf(userId);
  arr.length = 0;
  arr.push(...list);
  profiles.saveOwner(userId);
}

beforeEach(() => {
  visitMod.reset();
  store.adminDb().exec('DELETE FROM visits; DELETE FROM visit_invitations;');
  homeGame.reset();
  registry.resetRegistry('between tests');
  resetAgents(OWNER, [
    mkAgent('mine-a', 'The Clock'),
    mkAgent('mine-b', 'River Rat'),
    mkAgent('mine-gone', 'Dead Money', { archived: true }),
  ]);
  resetAgents(OTHER, [mkAgent('theirs', 'The Grinder')]);
  homeGame.configure({
    liveTables: registry,
    agentsFor: (userId) => profiles.presentedRoster(userId, { owner: true }),
    visitorsFor: (userId) => visitMod.listVisitorsFor(userId),
  });
  visitMod.configure({ liveTables: registry });
});

/** The ids this owner actually drafted, straight off the stored record. */
const ownIds = (userId) => new Set(profiles.agentsOf(userId).map((a) => a.id));
const invitedVisit = () => {
  const invitation=visitMod.issueVisitInvitation({agentId:'theirs',userId:OTHER,stake:0});
  assert.equal(invitation.status,200);
  return visitMod.requestVisit({agentId:'theirs',hostUserId:OWNER,invitationToken:invitation.body.invitationToken});
};

// ── The invariant ───────────────────────────────────────────────────────────

test('BUG-46: HOME_STATE.agents is his own household and nothing else', () => {
  const snap = profiles.homeSnapshot(OWNER, { owner: true });
  const mine = ownIds(OWNER);

  assert.ok(snap.agents.length > 0, 'the household is not empty');
  for (const body of snap.agents) {
    assert.ok(mine.has(body.id), `${body.name} (${body.id}) is in the roster and is not his`);
    assert.equal(body.guest, false, 'nobody in an unvisited flat is a guest');
  }
  // The archived one is not a resident either — the roster is ACTIVE agents.
  assert.ok(!snap.agents.some((a) => a.id === 'mine-gone'), 'a retired agent is not in the flat');
});

test('BUG-46: an agent of another household cannot reach the roster untagged', () => {
  // The only seam that puts a foreign body in the array is homeSnapshot's
  // `visitors` injection. Hand it one WITHOUT the tag — the shape a future
  // caller could produce by forgetting it — and the invariant must catch it.
  const stranger = profiles.presentAgentById('theirs', OTHER, { owner: false });
  assert.ok(stranger, 'the other household has somebody in it');

  const snap = profiles.homeSnapshot(OWNER, { owner: true, visitors: [{ ...stranger, guest: false }] });
  const mine = ownIds(OWNER);
  const trespassers = snap.agents.filter((a) => !mine.has(a.id) && !a.guest);

  assert.deepEqual(
    trespassers.map((a) => a.id),
    [],
    'a body that is neither his nor tagged `guest` reached HOME_STATE.agents — this is BUG-46',
  );
});

test('BUG-46: a visitor is visible in the flat, but only ever as a guest', () => {
  assert.deepEqual(visitMod.visitBodiesFor(OWNER), [], 'nobody is visiting yet');

  const out = invitedVisit();
  assert.equal(out.status, 200, JSON.stringify(out.body));

  const snap = profiles.homeSnapshot(OWNER, {
    owner: true,
    visitors: visitMod.visitBodiesFor(OWNER),
    visitor: visitMod.pendingVisitorFor(OWNER),
  });
  const mine = ownIds(OWNER);
  const foreign = snap.agents.filter((a) => !mine.has(a.id));

  assert.equal(foreign.length, 1, 'exactly the one visitor');
  assert.equal(foreign[0].id, 'theirs');
  assert.equal(foreign[0].guest, true, 'and he is wearing the tag');
  // He is somebody else's, so the wire must not hand this household his owner.
  assert.equal(foreign[0].ownerId, undefined, 'the projection does not leak whose he is');
  // Every resident is still untagged — the tag is not sprayed over the array.
  for (const body of snap.agents.filter((a) => mine.has(a.id))) {
    assert.equal(body.guest, false, `${body.name} is a resident, not a guest`);
  }
});

test('BUG-46: a guest seat at the kitchen table is booked under his own owner', () => {
  const out = invitedVisit();
  assert.equal(out.status, 200, JSON.stringify(out.body));
  const answered = visitMod.answerVisit(out.body.visitId, OWNER, true);
  assert.equal(answered.status, 200, JSON.stringify(answered.body));

  const table = registry.getTable(homeGame.homeTableId(OWNER));
  assert.ok(table, 'the kitchen table stood up');
  const seat = table.agentIds.indexOf('theirs');
  assert.ok(seat >= 0, 'the guest is in a chair');
  assert.equal(table.agentUserIds[seat], OTHER,
    'the visit is credited to his own household, never to the one he is standing in');
});

test('Home retains resident and visiting outfits without exposing wardrobe inventory or foreign owner data', () => {
  const mine={head:'rail-cap',face:null,neck:null};
  const theirs={head:null,face:'round-glasses',neck:'knit-scarf'};
  profiles.agentsOf(OWNER)[0].wardrobe={owned:['PRIVATE RESIDENT INVENTORY'],equipped:mine};
  profiles.agentsOf(OTHER)[0].wardrobe={owned:['PRIVATE GUEST INVENTORY'],equipped:theirs,privateNote:'PRIVATE FITTING'};
  profiles.saveOwner(OWNER);profiles.saveOwner(OTHER);
  const visit=invitedVisit();assert.equal(visit.status,200,JSON.stringify(visit.body));
  const assertSnapshot=()=>{
    for(const owner of [false,true]){
      const snapshot=profiles.homeSnapshot(OWNER,{owner,visitors:visitMod.visitBodiesFor(OWNER)});
      const resident=snapshot.agents.find(agent=>agent.id==='mine-a');
      const guest=snapshot.agents.find(agent=>agent.id==='theirs');
      assert.deepEqual(resident.equipment,mine);
      assert.deepEqual(guest.equipment,theirs);
      assert.equal(guest.guest,true);assert.equal(guest.ownerId,undefined);
      for(const body of [resident,guest])assert.equal(body.wardrobe,undefined);
      assert.equal(JSON.stringify(snapshot).includes('PRIVATE'),false);
    }
  };
  assertSnapshot();
  assert.equal(visitMod.answerVisit(visit.body.visitId,OWNER,true).status,200);
  assertSnapshot();
  const untrustedGuest={...visitMod.visitBodiesFor(OWNER)[0],equipment:{...theirs,head:'unowned-hat',privateNote:'PRIVATE FIELD'}};
  const guest=profiles.homeSnapshot(OWNER,{owner:true,visitors:[untrustedGuest]}).agents.find(agent=>agent.id==='theirs');
  assert.deepEqual(guest.equipment,theirs);
  assert.equal(JSON.stringify(guest).includes('PRIVATE'),false);
});
