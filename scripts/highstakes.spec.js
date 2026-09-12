import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const ROOMS = [
  { rung: 0, id: 'floor', title: 'the floor', door: /^the floor,/i, smallBlind: 10, bigBlind: 20, buyIn: 2000 },
  { rung: 1, id: 'upstairs', title: 'upstairs', door: /^upstairs,/i, smallBlind: 25, bigBlind: 50, buyIn: 5000 },
  { rung: 2, id: 'backroom', title: 'the back room', door: /^the back room,/i, smallBlind: 50, bigBlind: 100, buyIn: 10000 },
];

// Normal development owners and actual API funding, as in smoke.spec.js.
// No Telegram identity simulation, mocked transport, or seeded game state.
async function makeOwner(request, room, suffix) {
  const userId = `highstakes-${room.rung}-${suffix}-${Date.now()}`;
  expect((await request.post('/api/agents/chat/reset', { data: { userId } })).ok()).toBe(true);
  const built = await request.post('/api/agents/build', { data: { userId } });
  expect(built.ok()).toBe(true);
  const agent = (await built.json()).createdAgent;
  expect(agent?.id).toBeTruthy();
  if (room.buyIn > 2000) {
    const funded = await request.post(`/api/agents/${agent.id}/fund?userId=${userId}`, {
      data: { userId, verb: 'give', amount: room.buyIn - 2000 },
    });
    expect(funded.ok()).toBe(true);
  }
  return { userId, agent };
}

function capture(page) {
  const received = [], sent = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => {
    socket.on('framereceived', event => { try { received.push(JSON.parse(String(event.payload))); } catch {} });
    socket.on('framesent', event => { try { sent.push({ ...JSON.parse(String(event.payload)), at: Date.now() }); } catch {} });
  });
  return { received, sent, errors };
}

async function deployFromHome(page, owner, room) {
  await page.addInitScript(id => localStorage.setItem('agentic_uid', id), owner.userId);
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.locator('.dsk-roster-row').filter({ hasText: owner.agent.name }).click();
  await page.getByRole('button', { name: 'Carry', exact: true }).click();
  await page.getByTestId('home-door').click();
  const queued = page.waitForResponse(response => new URL(response.url()).pathname === `/api/agents/${owner.agent.id}/queue` && response.request().method() === 'POST');
  await page.getByRole('button', { name: room.door }).click();
  const response = await queued;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.stakes).toMatchObject({ rung: room.rung, smallBlind: room.smallBlind, bigBlind: room.bigBlind, buyIn: room.buyIn });
  await expect(page.getByTestId('desk-casino-table')).toBeVisible();
  return result;
}

for (const room of ROOMS) test(`HIGHSTAKES: ${room.id} starts with a House opponent after leaving and accepts another owner`, async ({ page, request, context }, testInfo) => {
  const config = await request.get('/api/auth/config');
  expect((await config.json()).guest, 'run against the isolated development server').toBe(false);
  const owner = await makeOwner(request, room, 'first');
  const traffic = capture(page);
  let peerContext;
  try {
    const queued = await deployFromHome(page, owner, room);
    expect(queued.matched, 'the first owner opens this fresh room match').toBe(false);
    await expect.poll(() => traffic.sent.some(frame => frame.type === 'watch' && frame.tableId === queued.tableId)).toBe(true);
    await page.getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }).click();
    await expect.poll(() => traffic.sent.some(frame => frame.type === 'leave')).toBe(true);
    const firstWatch = traffic.sent.find(frame => frame.type === 'watch' && frame.tableId === queued.tableId);
    const firstLeave = traffic.sent.find(frame => frame.type === 'leave' && frame.at >= firstWatch.at);
    expect(firstLeave.at - firstWatch.at, 'leave before the original five-second fallback fires').toBeLessThan(5000);

    // This real-time boundary reproduces the dropped fallback: no watcher is
    // present when its five-second deadline expires. Browser fake timers would
    // not advance the server and would therefore miss the bug.
    await page.waitForTimeout(6100);
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await expect(page.getByRole('heading', { name: room.title, exact: true }), 'return to the room where this agent is playing').toBeVisible();
    const resumedAt = traffic.received.length;
    await page.locator(`.csn-felt58[data-table="${queued.tableId}"]`).click();
    await expect(page.getByTestId('desk-casino-table')).toBeVisible();
    const stateFor = frame => frame.type === 'state' && frame.state?.tableId === queued.tableId;
    await expect.poll(() => traffic.received.slice(resumedAt).some(frame => stateFor(frame) && frame.state.handNumber >= 1 && frame.state.street !== 'waiting' && frame.state.seats.length >= 2), {
      timeout: 15_000,
      message: 'the owned agent and a House opponent must deal without another player rescuing the table',
    }).toBe(true);
    const firstHand = traffic.received.findLast(stateFor).state;
    expect(firstHand.seats.some(seat => seat.playerId === `agent_${owner.agent.id}`)).toBe(true);
    expect(firstHand.seats.some(seat => seat.playerId !== `agent_${owner.agent.id}`)).toBe(true);
    const rosterRow = page.locator('.dsk-roster-row').filter({ hasText: owner.agent.name });
    await expect(rosterRow.locator('.dsk-roster-place'), 'confirmed play must update the roster without waiting for its ten-second poll').toHaveText('at the casino', { timeout: 1500 });
    await expect(rosterRow).not.toContainText('counting chips');
    await page.screenshot({ path: testInfo.outputPath('house-hand.png') });

    const roomResponse = await request.get(`/api/rooms/${room.id}/tables`);
    const roomData = await roomResponse.json();
    const table = roomData.tables.find(item => item.tableId === queued.tableId);
    expect(table.seated).toBeGreaterThanOrEqual(2);
    expect(table.seated).toBeLessThan(table.maxSeats);
    expect(table.seats.some(seat => seat.agentId === null), 'a House seat supplies the first opponent').toBe(true);

    // The next owner enters through exactly the same Carry/door UI. This also
    // consumes this rung's match slot before the next independent case runs.
    const peer = await makeOwner(request, room, 'second');
    peerContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 }, baseURL: testInfo.project.use.baseURL });
    const peerPage = await peerContext.newPage();
    const peerTraffic = capture(peerPage);
    const peerQueued = await deployFromHome(peerPage, peer, room);
    expect(peerQueued.matched).toBe(true);
    expect(peerQueued.tableId).toBe(queued.tableId);
    await expect.poll(() => traffic.received.some(frame => stateFor(frame) && frame.state.seats.some(seat => seat.playerId === `agent_${peer.agent.id}`) && frame.state.seats.length >= 3), {
      timeout: 30_000,
      message: 'the House must leave room for a real second owner to play subsequent hands',
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('multiplayer-hand.png') });
    expect(traffic.received.filter(frame => frame.type === 'error')).toEqual([]);
    expect(peerTraffic.received.filter(frame => frame.type === 'error')).toEqual([]);
    expect([...traffic.errors, ...peerTraffic.errors]).toEqual([]);
  } finally {
    const framesPath = testInfo.outputPath('server-frames.json');
    await writeFile(framesPath, JSON.stringify(traffic, null, 2));
    await testInfo.attach('server-frames', { path: framesPath, contentType: 'application/json' });
    await peerContext?.close();
  }
});

test('HIGHSTAKES: simultaneous owners keep their chosen rooms and each get a House opponent', async ({ page, request, context }, testInfo) => {
  const config = await request.get('/api/auth/config');
  expect((await config.json()).guest).toBe(false);
  const entries = [], extraContexts = [];
  try {
    for (const room of ROOMS) {
      const owner = await makeOwner(request, room, 'simultaneous');
      let ownerPage = page;
      if (entries.length) {
        const ownerContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 }, baseURL: testInfo.project.use.baseURL });
        extraContexts.push(ownerContext);
        ownerPage = await ownerContext.newPage();
      }
      const traffic = capture(ownerPage);
      const queued = await deployFromHome(ownerPage, owner, room);
      entries.push({ room, queued, traffic, page: ownerPage });
      expect(queued.matched, 'an owner waiting in another room must not override this room choice').toBe(false);
    }
    expect(new Set(entries.map(entry => entry.queued.tableId)).size).toBe(3);
    for (const entry of entries) {
      await expect.poll(() => entry.traffic.received.some(frame => frame.type === 'state' && frame.state?.tableId === entry.queued.tableId && frame.state.handNumber >= 1 && frame.state.seats?.length >= 2), {
        timeout: 15_000,
        message: `${entry.room.title} must independently start its own hand`,
      }).toBe(true);
      const response = await request.get(`/api/rooms/${entry.room.id}/tables`);
      const table = (await response.json()).tables.find(item => item.tableId === entry.queued.tableId);
      expect(table).toBeTruthy();
      expect(table.seats.some(seat => seat.agentId === null)).toBe(true);
      expect(table.seated).toBeLessThan(table.maxSeats);
      expect(entry.traffic.received.filter(frame => frame.type === 'error')).toEqual([]);
      expect(entry.traffic.errors).toEqual([]);
      await entry.page.screenshot({ path: testInfo.outputPath(`${entry.room.id}-simultaneous.png`) });
    }
  } finally {
    const framesPath = testInfo.outputPath('simultaneous-server-frames.json');
    await writeFile(framesPath, JSON.stringify(entries.map(({ room, queued, traffic }) => ({ room, queued, traffic })), null, 2));
    await testInfo.attach('simultaneous-server-frames', { path: framesPath, contentType: 'application/json' });
    for (const extra of extraContexts) await extra.close();
  }
});
