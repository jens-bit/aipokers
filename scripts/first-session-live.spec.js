import { expect, test } from '@playwright/test';

// Each test gets a fresh browser context and a real newborn. The guest path
// also mints its actual cookie. No seed route, API fixture, SDK replacement,
// or WebSocket mock. The two guest projects consume two of the server's five
// fresh guests per IP per day.
const NAME = 'Pebble';
const STEPS = ['deal', 'preflop-call', 'flop', 'flop-bet', 'turn', 'river', 'river-bet', 'showdown', 'conversation'];
const pathOf = request => new URL(request.url()).pathname;

for (const guestFlow of [false, true]) test(`FIRST-SESSION-LIVE: ${guestFlow ? 'fresh guest' : 'development owner'} drafts, arrives home, learns, and opens private chat`, async ({ page, request }, testInfo) => {
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

  const bornCard = draft.locator('.birth-card3');
  await expect(bornCard).toBeVisible();
  await expect(bornCard.locator('.birth-card3__name')).toHaveText(NAME);
  // The draft already owns this moment; the desktop roster must not add a
  // second birth rail while the same final action is waiting to be pressed.
  await expect(page.getByText('The card he was born with', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Go home', exact: true })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('birth-card.png') });
  await bornCard.getByRole('button', { name: 'Go home', exact: true }).click();

  const home = page.getByTestId('home-screen');
  await expect(draft).toHaveCount(0);
  await expect(home).toBeVisible();
  await expect(home.locator(`.home-one[data-agent="${birth.agentId}"]`)).toBeVisible();
  const learn = home.getByRole('button', { name: `Learn with ${NAME}`, exact: true });
  await expect(learn).toBeVisible();
  expect(documents, 'birth arrives in Home without reloading the document').toBe(1);
  await page.screenshot({ path: testInfo.outputPath('home-arrival.png') });

  const writesBeforePractice = writes.length;
  await learn.click();
  const guide = page.getByTestId('guided-practice');
  await expect(guide).toHaveAttribute('data-step', 'deal');
  await expect(page.getByTestId('practice-role')).toHaveText(`You are watching. ${NAME} is playing.`);
  await expect(page.getByTestId('practice-pointer')).toBeVisible();
  for (const step of STEPS.slice(1)) {
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(guide).toHaveAttribute('data-step', step);
    if (step === 'showdown') {
      await expect(page.getByTestId('practice-hand')).toContainText('Full house');
      await expect(page.getByTestId('practice-result')).toContainText('28 chips');
      await expect(page.getByTestId('practice-result')).toContainText('+14 chips');
      await page.screenshot({ path: testInfo.outputPath('practice-result.png') });
    }
  }
  const finish = guide.getByRole('button', { name: 'Finish practice', exact: true });
  await expect(finish).toBeDisabled();
  await guide.getByRole('button', { name: 'What is a full house?', exact: true }).click();
  await expect(page.getByTestId('practice-answer')).toContainText('three kings and two sevens');
  await finish.click();
  await expect(guide).toHaveAttribute('data-step', 'complete');
  expect(writes.slice(writesBeforePractice), 'practice makes no API writes').toEqual([]);
  expect(gameCommands, 'practice never starts or controls a live game').toEqual([]);

  if (guestFlow) {
    await expect(guide).toContainText('Sign in to send your own messages. You can keep exploring as a guest.');
    await guide.getByRole('button', { name: `Sign in to chat with ${NAME}`, exact: true }).click();
    const signIn = page.getByRole('dialog', { name: 'Keep him', exact: true });
    await expect(signIn).toBeVisible();
    expect(writes.slice(writesBeforePractice), 'the guide explains sign-in before submitting any private message').toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('practice-sign-in.png') });
    await signIn.getByRole('button', { name: 'keep playing as a guest', exact: true }).click();
    await expect(guide).toHaveAttribute('data-step', 'complete');
    await guide.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(home).toBeVisible();
    await home.locator(`.home-one[data-agent="${birth.agentId}"]`).click();
  } else {
    await guide.getByRole('button', { name: `Chat with ${NAME}`, exact: true }).click();
  }
  await expect(guide).toHaveCount(0);
  const chat = page.getByRole('region', { name: `${NAME}'s room`, exact: true });
  await expect(chat).toBeVisible();
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
  expect(errors).toEqual([]);
});
