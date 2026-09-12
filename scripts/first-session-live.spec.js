import { expect, test } from '@playwright/test';

// Each test gets a fresh browser context and a real newborn. The guest path
// also mints its actual cookie. No seed route, API fixture, SDK replacement,
// or WebSocket mock. The two guest projects consume two of the server's five
// fresh guests per IP per day.
const NAME = 'Pebble';
const pathOf = request => new URL(request.url()).pathname;

for (const guestFlow of [false, true]) test(`FIRST-SESSION-LIVE: ${guestFlow ? 'fresh guest' : 'development owner'} drafts, follows the real first-run guide, and opens private chat`, async ({ page, request }, testInfo) => {
  const config = await request.get('/api/auth/config');
  expect(config.ok(), 'the built-app server is reachable').toBe(true);
  expect((await config.json()).guest, `this isolated server must have GUEST_ENABLED=${guestFlow ? 1 : 0}`).toBe(guestFlow);

  const errors = [], writes = [], gameCommands = [];
  let documents = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents += 1;
    if (pathOf(req).startsWith('/api/') && !['GET', 'HEAD'].includes(req.method())) writes.push(`${req.method()} ${pathOf(req)}`);
  });
  page.on('websocket', socket => socket.on('framesent', event => {
    try {
      const message = JSON.parse(String(event.payload));
      if (['join', 'action', 'deal', 'watch', 'chat'].includes(message.type)) gameCommands.push(message.type);
    } catch { /* Non-JSON transport frames are unrelated to game commands. */ }
  }));

  if (guestFlow) {
    const guestCreated = page.waitForResponse(res => pathOf(res.request()) === '/api/guest' && res.request().method() === 'POST');
    await page.goto('/welcome', { waitUntil: 'domcontentloaded' });
    const guestResponse = await guestCreated;
    expect(guestResponse.ok(), 'fresh guest boot succeeds without a supplied identity').toBe(true);
    expect((await guestResponse.json()).ownerId).toMatch(/^g_/);
    await page.getByRole('button', { name: 'DRAFT HIM', exact: true }).first().click();
  } else {
    // Existing repository browser gates use this local development identity.
    // It is not Telegram authentication or evidence of a successful claim.
    const ownerId = `first-session-${testInfo.project.name}-${Date.now()}`;
    await page.addInitScript(id => localStorage.setItem('agentic_uid', id), ownerId);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'DRAFT YOUR FIRST AGENT', exact: true }).click();
  }

  const draft = page.getByTestId('draft-screen');
  await expect(draft).toBeVisible();
  if (guestFlow) {
    for (const answer of ['Balanced', 'Sometimes', 'Fold']) await draft.getByRole('button', { name: answer, exact: true }).click();
    await draft.getByRole('textbox', { name: 'His name', exact: true }).fill(NAME);
  } else {
    await draft.getByRole('button', { name: 'Tight and patient', exact: true }).click();
    await draft.getByPlaceholder('His name…', { exact: true }).fill(NAME);
    await draft.getByRole('button', { name: 'Send', exact: true }).click();
  }
  const birthCreated = page.waitForResponse(res => {
    const req = res.request();
    return pathOf(req) === '/api/agents/chat' && req.method() === 'POST' && req.postDataJSON()?.draftIntent === 'create';
  });
  await draft.getByRole('button', { name: 'Deal him in', exact: true }).click();
  const birthResponse = await birthCreated;
  expect(birthResponse.ok()).toBe(true);
  const birth = await birthResponse.json();
  expect(birth.agentId).toBeTruthy();
  expect(birth.agentName).toBe(NAME);
  const writesAfterBirth = writes.length;
  const commandsAfterBirth = gameCommands.length;

  const bornCard = draft.locator('.birth-card3');
  await expect(bornCard).toBeVisible();
  await expect(bornCard.locator('.birth-card3__name')).toHaveText(NAME);
  // The draft already owns this moment; the desktop roster must not add a
  // second birth rail while the same final action is waiting to be pressed.
  await expect(page.getByText('The card he was born with', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Go home', exact: true })).toHaveCount(1);
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('birth-card.png') });
  await bornCard.getByRole('button', { name: 'Go home', exact: true }).click();

  const home = page.getByTestId('home-screen');
  await expect(draft).toHaveCount(0);
  await expect(home).toBeVisible();
  await expect(home.locator(`.home-one[data-agent="${birth.agentId}"]`)).toBeVisible();
  if (testInfo.project.name.startsWith('phone-')) {
    await expect(home.getByTestId('room-header'), 'Go home lands at the room, not below the guest landing page').toBeInViewport({ ratio: 1 });
    await expect(home.locator(`.home-one[data-agent="${birth.agentId}"]`), 'the newborn is on screen without a corrective scroll').toBeInViewport({ ratio: 1 });
  }
  const hint = page.getByTestId('context-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(`This is ${NAME}. Tap to talk.`);
  await expect(page.locator('.practice-entry')).toHaveCount(0);
  await expect(page.getByTestId('guided-practice')).toHaveCount(0);
  expect(documents, 'birth arrives in Home without reloading the document').toBe(1);
  await page.screenshot({ path: testInfo.outputPath('home-arrival.png') });

  await hint.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(hint).toContainText('The kitchen table is where you watch or join a game.');
  const slotsRead = page.waitForResponse(response => pathOf(response.request()) === '/api/slots'
    && response.request().method() === 'GET');
  await hint.getByRole('button', { name: 'Open table', exact: true }).click();
  const table = page.getByTestId('home-table-sheet');
  await expect(table).toBeVisible();
  // HOME-SLOTS-1: the desktop room survives birth. Its table must read the
  // post-birth server projection on opening, not keep the first free slot.
  const slotsResponse = await slotsRead;
  expect(slotsResponse.ok(), 'opening the table reads the current owned slots').toBe(true);
  const slots = await slotsResponse.json();
  expect(slots.used).toBe(1);
  expect(slots.next.index).toBe(2);
  await expect(table.locator('.table-sheet__ordinal')).toHaveText('2ND SEAT');
  await expect(table.locator('.table-sheet__price')).toHaveText(`${slots.next.price.toLocaleString('en-US')} chips won`);
  await expect(table.getByTestId('home-table-draft')).toHaveCount(0);
  const desktop = testInfo.project.name.startsWith('desktop-');
  if (desktop) {
    await expect(page.locator('.dsk-panel').filter({ has: table }).locator('.dsk-panel-head__sub'))
      .toHaveText(`Roster · ${slots.used} of ${slots.cap} agents`);
  }
  // Follow the actual Home state. A single newborn can have a quiet kitchen;
  // this test must not seat anyone or pretend that an absent game is live.
  await expect(hint).toContainText(/Watch the kitchen game here\.|The kitchen is quiet; the casino has more tables\./);
  expect(writes.slice(writesAfterBirth), 'Home guidance makes no API writes').toEqual([]);
  expect(gameCommands.slice(commandsAfterBirth).filter(type => type !== 'watch'), 'Home preview may watch, but guidance never joins, acts, deals or chats').toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('table-guide.png') });
  let guideRoute;
  if (await table.getByTestId('home-table-watch').isVisible()) {
    guideRoute = 'running kitchen → actual WATCH → watching and opponent guidance → completed';
    await expect(hint).toContainText('Watch the kitchen game here.');
    await expect(hint.getByRole('button')).toHaveCount(1);
    await expect(hint.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
    await table.getByTestId('home-table-watch').click();
    const liveTable = desktop ? page.getByTestId('desk-home-table') : page.locator('.watch-screen');
    await expect(liveTable).toBeVisible();
    await expect(liveTable.locator('.watch-felt__board')).toBeVisible();
    await expect(hint).toContainText(/You are watching\. The (AI players|players) make their own decisions\./);
    expect(gameCommands.slice(commandsAfterBirth)).toContain('watch');
    expect(gameCommands.slice(commandsAfterBirth).filter(type => type !== 'watch'), 'the guide never joins, acts, deals or chats').toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('live-table-guide.png') });
    await hint.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(hint).toContainText('An opponent. Tap to see what is known about them.');
    await hint.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(hint).toHaveCount(0);
    await liveTable.getByRole('button', { name: desktop ? 'Back to the room' : 'Leave table', exact: true }).click();
  } else {
    guideRoute = 'quiet kitchen → actual casino doorway → Home; no live-hand coverage';
    await expect(hint).toContainText('The kitchen is quiet; the casino has more tables.');
    await hint.getByRole('button', { name: 'Show door', exact: true }).click();
    await expect(table).toHaveCount(0);
    await expect(home).toBeVisible();
    await expect(hint).toContainText('The casino has tables for your agent.');
    await expect(hint.getByRole('button', { name: 'Enter casino', exact: true })).toBeVisible();
    const door = home.getByTestId('home-door');
    await expect(door).toBeVisible();
    await expect.poll(async () => {
      const [target, outline] = await Promise.all([door.boundingBox(), page.getByTestId('context-hint-target').boundingBox()]);
      return !!target && !!outline && ['x', 'y', 'width', 'height'].every(key => Math.abs(target[key] - outline[key]) < 2);
    }, { message: 'the guide outlines the real casino door' }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('quiet-door-guide.png') });
    await door.click();
    const floor = page.getByTestId('floor-view');
    await expect(floor).toBeVisible();
    await expect(hint).toHaveCount(0);
    expect(gameCommands.slice(commandsAfterBirth), 'finding the casino does not start or watch a game').toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('quiet-casino-arrival.png') });
    const casinoBack = desktop ? page.locator('.dsk-top--room') : floor;
    await casinoBack.getByRole('button', { name: 'Back home', exact: true }).click();
  }
  testInfo.annotations.push({ type: 'guide-route', description: guideRoute });
  await testInfo.attach('guide-route', { body: JSON.stringify({ route: guideRoute, gameCommands: gameCommands.slice(commandsAfterBirth) }), contentType: 'application/json' });
  await expect(home).toBeVisible();
  await home.locator(`.home-one[data-agent="${birth.agentId}"]`).click();
  const chat = page.getByRole('region', { name: `${NAME}'s room`, exact: true });
  await expect(chat).toBeVisible();
  await expect(hint).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Keep him', exact: true })).toHaveCount(0);
  expect(writes.slice(writesAfterBirth), 'the guide and opening private chat submit no API writes before the owner chooses Send').toEqual([]);
  expect(gameCommands.slice(commandsAfterBirth).filter(type => type !== 'watch'), 'the entire guide remains a spectator').toEqual([]);
  await chat.getByPlaceholder('Whisper to him…', { exact: true }).fill('go home');
  const replied = page.waitForResponse(res => {
    const req = res.request();
    return pathOf(req) === '/api/agents/chat' && req.method() === 'POST' && req.postDataJSON()?.existingAgentId === birth.agentId;
  });
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  const reply = await replied;
  if (guestFlow) {
    expect(reply.status(), 'private chat retains the existing sign-in requirement').toBe(403);
    const refused = await reply.json();
    expect(refused.claim).toBe(true);
    expect(refused.chat).toBeUndefined();
    const wall = page.getByRole('dialog', { name: 'Keep him', exact: true });
    await expect(wall).toBeVisible();
    await expect(wall).toContainText('And you cannot talk to him.');
    await wall.getByRole('button', { name: 'keep playing as a guest', exact: true }).click();
    await expect(chat.getByPlaceholder('Whisper to him…')).toHaveValue('go home');
    await expect(chat.getByText('I am already home.', { exact: true })).toHaveCount(0);
    await expect(chat.locator('.agent-view__line.is-mine').getByText('go home', { exact: true })).toHaveCount(0);
  } else {
    expect(reply.ok(), 'the real local owner private chat route accepts the newborn').toBe(true);
    expect((await reply.json()).chat).toContainEqual({ role: 'assistant', content: 'I am already home.' });
    await expect(chat.locator('.agent-view__line:not(.is-mine)').getByText('I am already home.', { exact: true })).toBeVisible();
    await expect(chat.getByPlaceholder('Whisper to him…')).toHaveValue('');
  }
  await page.screenshot({ path: testInfo.outputPath(guestFlow ? 'private-chat-refused.png' : 'private-chat.png') });
  expect(documents, 'the full first session uses the original document').toBe(1);
  // A reload is deliberately separate from the uninterrupted journey above.
  // Seeing the same newborn again must not restart the automatically shown guide.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(home).toBeVisible();
  await expect(home.locator(`.home-one[data-agent="${birth.agentId}"]`)).toBeVisible();
  await expect(hint).toHaveCount(0);
  await expect(page.locator('.practice-entry')).toHaveCount(0);
  expect(documents).toBe(2);
  if (guestFlow) {
    // /welcome is the public landing page after reload. Use its real room
    // entry, rather than letting locator auto-scroll reach an embedded control.
    await page.getByRole('button', { name: 'OPEN YOUR ROOM', exact: true }).first().click();
    await expect(desktop ? page.locator('.dsk-top') : home.getByTestId('room-header')).toBeInViewport({ ratio: 1 });
  }
  // The next deliberate visit must offer a real seat directly from the floor.
  // This uses the real deploy/matchmaking/engine path; it is not a WATCH that
  // fabricates an opponent or a guide callback that starts a session.
  await home.getByTestId('home-door').click();
  const play = page.getByTestId('casino-play');
  await expect(play).toBeVisible();
  const deployResponse = page.waitForResponse(response => pathOf(response.request()) === `/api/agents/${birth.agentId}/deploy`
    && response.request().method() === 'POST');
  await play.getByRole('button', { name: `Send ${NAME} to play`, exact: true }).click();
  const deployed = await deployResponse;
  expect(deployed.ok(), 'the named floor action creates or joins a real session').toBe(true);
  const session = await deployed.json();
  expect(session.agentId).toBe(birth.agentId);
  expect(session.sessionStarted).toBe(true);
  const felt = page.locator('.watch-felt').filter({ visible: true });
  await expect(felt).toBeVisible();
  await expect(felt.locator('.seat-ghost').first()).toBeVisible();
  await expect(felt.locator('.watch-hero__body')).toBeVisible();
  if (!desktop) await expect(page.locator('.watch-screen__header')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('real-casino-entry.png') });
  expect(errors).toEqual([]);
});
