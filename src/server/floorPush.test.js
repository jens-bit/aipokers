// src/server/floorPush.test.js — SERVER-4 job 1
//
// Who is allowed to receive a thread line.
//
// Its own file rather than a section of threadPush.test.js for a reason worth
// writing down: subscribing to the floor asks agentProfiles for a roster, and
// agentProfiles loads the whole store into memory on its first call and never
// reloads. A channel test that subscribes as some owner therefore fixes that
// module's idea of the world for the rest of the process — which is harmless
// here, where nothing needs a real agent, and quietly wrong next door, where
// everything does.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as floor from './floorChannel.js';
import { ServerMsg } from './protocol.js';
import { ThreadKind } from './thread.js';

// ── Job 1 · who is allowed to receive one ───────────────────────────────────

test('SERVER-4: OWNER_LINE reaches the owner who PROVED it, and nobody else', () => {
  const proven = fakeSocket();
  const claimed = fakeSocket();
  const stranger = fakeSocket();
  try {
    floor.configure({});
    floor.subscribe(proven, { userId: 'u1', owner: true });
    floor.subscribe(claimed, { userId: 'u1', owner: false });
    floor.subscribe(stranger, { userId: 'u2', owner: true });

    const line = { id: 1, sessionId: 'h-1', ts: 1, kind: ThreadKind.HIM, who: 'BALANCE', text: 'mine' };
    const sent = floor.broadcastOwnerLine('u1', line);

    assert.equal(sent, 1, 'one subscriber, not three');
    const got = proven.sent.filter((m) => m.type === ServerMsg.OWNER_LINE);
    assert.equal(got.length, 1);
    assert.equal(got[0].userId, 'u1');
    assert.equal(got[0].sessionId, 'h-1');
    assert.deepEqual(got[0].line, line);
    // A userId is a claim. Without initData behind it, his reasoning is not
    // yours to read — the same law heroHole already rides on.
    assert.equal(claimed.sent.some((m) => m.type === ServerMsg.OWNER_LINE), false);
    assert.equal(stranger.sent.some((m) => m.type === ServerMsg.OWNER_LINE), false);
  } finally {
    floor.reset();
  }
});

test('SERVER-4: TYPING is gated exactly like the line it precedes', () => {
  const proven = fakeSocket();
  const claimed = fakeSocket();
  try {
    floor.configure({});
    floor.subscribe(proven, { userId: 'u1', owner: true });
    floor.subscribe(claimed, { userId: 'u1', owner: false });

    assert.equal(floor.broadcastTyping('u1', 'balance', 'h-1'), 1);
    const got = proven.sent.filter((m) => m.type === ServerMsg.TYPING);
    assert.equal(got.length, 1);
    assert.equal(got[0].agentId, 'balance');
    assert.equal(got[0].sessionId, 'h-1');
    // Announcing a line to somebody who will not be shown the line is worse
    // than silence.
    assert.equal(claimed.sent.some((m) => m.type === ServerMsg.TYPING), false);
  } finally {
    floor.reset();
  }
});

// The minimum a WebSocket has to be for floorChannel to push to it.
function fakeSocket() {
  const ws = { OPEN: 1, readyState: 1, sent: [] };
  ws.send = (raw) => ws.sent.push(JSON.parse(raw));
  return ws;
}

test('BUG-227: every owned agent sharing a table receives a private, throttled live frame', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const proven = fakeSocket(), claimed = fakeSocket(), stranger = fakeSocket();
  let handNumber = 1;
  const table = {
    tableId: 'shared-227', agentIds: ['first-227', 'second-227', 'other-227'],
    agentUserIds: ['owner-227', 'owner-227', 'elsewhere-227'],
    liveGameView(agentId, { includeHole }) {
      return { tableId: this.tableId, street: 'preflop', board: [], pot: handNumber * 30,
        handNumber, heroHole: includeHole ? [agentId, 'private'] : [], toAct: agentId };
    },
  };
  const frames = ws => ws.sent.filter(m => m.type === 'floor_game');
  try {
    floor.configure({ liveTables: { listTables: () => [table] } });
    floor.subscribe(proven, { userId: 'owner-227', owner: true });
    floor.subscribe(claimed, { userId: 'owner-227', owner: false });
    floor.subscribe(stranger, { userId: 'unrelated-227', owner: true });
    assert.deepEqual(frames(proven).map(m => m.agentId), ['first-227', 'second-227']);
    assert.deepEqual(frames(proven).map(m => m.heroHole[0]), ['first-227', 'second-227']);
    assert.equal(frames(claimed).length, 2);
    assert.ok(frames(claimed).every(m => m.heroHole.length === 0));
    assert.equal(frames(stranger).length, 0);
    handNumber = 2; floor.notifyTable(table);
    handNumber = 3; floor.notifyTable(table);
    assert.equal(frames(proven).length, 2, 'co-seated agents share the table throttle');
    t.mock.timers.tick(1000);
    assert.equal(frames(proven).length, 4);
    assert.ok(frames(proven).slice(-2).every(m => m.handNumber === 3), 'both get latest trailing state');
    floor.notifyTable(table);
    t.mock.timers.tick(1000);
    assert.equal(frames(proven).length, 4, 'unchanged frames stay suppressed');
    handNumber = 4; floor.notifyTable(table);
    handNumber = 5; floor.notifyTable(table);
    floor.unsubscribe(proven);
    const count = frames(proven).length;
    t.mock.timers.tick(1000);
    assert.equal(frames(proven).length, count, 'unsubscribe cancels pending frames');
  } finally { floor.reset(); t.mock.timers.reset(); }
});

test('BUG-227: a companion joining mid-hand cannot clear the shared public board or borrow another seat’s cards', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const proven = fakeSocket(), claimed = fakeSocket();
  // Match Table.liveGameView's pending-seat distinction: the new third seat
  // exists in agentIds but will not enter game.seats until the next deal.
  const table = {
    tableId: 'pending-227',
    agentIds: ['playing-227', 'opponent-227', 'joining-227'],
    agentUserIds: ['owner-227', 'other-owner', 'owner-227'],
    game: { street: 'flop', community: ['Ah', 'Kd', '2c'], pot: 420, toAct: 1, handNumber: 7,
      seats: [{ holeCards: ['As', 'Ad'] }, { holeCards: ['Ks', 'Kh'] }] },
    liveGameView(agentId, { includeHole }) {
      const seat = this.agentIds.indexOf(agentId), g = this.game;
      const inHand = seat < g.seats.length;
      return { tableId: this.tableId, street: g.street, handNumber: g.handNumber,
        board: inHand ? [...g.community] : [], pot: inHand ? g.pot : 0, toAct: inHand ? g.toAct : null,
        heroHole: includeHole && inHand ? [...g.seats[seat].holeCards] : null };
    },
    feltView() {
      const g = this.game;
      return { tableId: this.tableId, street: g.street, board: [...g.community], pot: g.pot,
        toAct: g.toAct, handNumber: g.handNumber };
    },
  };
  const frames = socket => socket.sent.filter(m => m.type === ServerMsg.FLOOR_GAME);
  try {
    floor.configure({ liveTables: { listTables: () => [table] } });
    floor.subscribe(proven, { userId: 'owner-227', owner: true });
    floor.subscribe(claimed, { userId: 'owner-227', owner: false });
    for (const socket of [proven, claimed]) {
      assert.deepEqual(frames(socket).map(m => m.agentId), ['playing-227', 'joining-227']);
      for (const message of frames(socket)) {
        assert.deepEqual(message.board, ['Ah', 'Kd', '2c'], 'both previews show the current public board');
        assert.equal(message.pot, 420);
        assert.equal(message.toAct, 1);
        assert.equal(message.street, 'flop');
        assert.equal(message.handNumber, 7);
      }
    }
    assert.deepEqual(frames(proven).map(m => m.heroHole), [['As', 'Ad'], null]);
    assert.ok(frames(claimed).every(m => m.heroHole === null), 'a claimed owner receives no private cards');
    // On the next deal he really has a hand; private cards stay per-agent.
    Object.assign(table.game, { street: 'preflop', community: [], pot: 30, toAct: 2, handNumber: 8 });
    table.game.seats.push({ holeCards: ['Qs', 'Qd'] });
    floor.notifyTable(table);
    t.mock.timers.tick(1000);
    const next = frames(proven).slice(-2);
    assert.ok(next.every(m => m.board.length === 0 && m.pot === 30 && m.toAct === 2 && m.handNumber === 8));
    assert.deepEqual(next.map(m => m.heroHole), [['As', 'Ad'], ['Qs', 'Qd']]);
    assert.ok(frames(claimed).every(m => m.heroHole === null));
  } finally { floor.reset(); t.mock.timers.reset(); }
});

test('BUG-131: kitchen updates reach proven seat owners as throttled Home snapshots only',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:10000});
 const host=fakeSocket(),visitor=fakeSocket(),claimed=fakeSocket(),stranger=fakeSocket();let revision=1;
 try{
  floor.configure({homeGames:{state:()=>({revision})}});
  floor.subscribe(host,{userId:'host131',owner:true});floor.subscribe(visitor,{userId:'guest131',owner:true});floor.subscribe(claimed,{userId:'guest131',owner:false});floor.subscribe(stranger,{userId:'other131',owner:true});
  for(const ws of [host,visitor,claimed,stranger])ws.sent.length=0;
  const table={home:true,tableId:'home-host131',agentUserIds:['host131','guest131']};
  floor.notifyTable(table);
  assert.equal(visitor.sent.length,1);assert.equal(host.sent.length,1);
  assert.equal(visitor.sent[0].type,ServerMsg.HOME_STATE);assert.equal(visitor.sent[0].game.revision,1);
  assert.equal(claimed.sent.length,0);assert.equal(stranger.sent.length,0);
  revision=2;floor.notifyTable(table);revision=3;floor.notifyTable(table);
  assert.equal(visitor.sent.length,1,'updates within a second are coalesced');
  floor.unsubscribe(host);t.mock.timers.tick(1000);
  assert.equal(visitor.sent.length,2);assert.equal(visitor.sent[1].game.revision,3,'trailing snapshot gets the latest state');
  assert.equal(host.sent.length,1,'unsubscribe cancels its pending send');
  assert.ok(visitor.sent.every(m=>m.type===ServerMsg.HOME_STATE),'no private kitchen table in casino messages');
 }finally{floor.reset();t.mock.timers.reset();}
});
