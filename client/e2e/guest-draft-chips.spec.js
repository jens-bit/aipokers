// client/e2e/guest-draft-chips.spec.js — BUG-198
//
// FOUR TAPS, AT BOTH WIDTHS.
//
// The claim: a guest who never types a word gets a poker player in four taps —
// three chips and Deal him in — and the recruiter never asks the same question
// twice on the way.
//
// jsdom cannot make this claim. It performs no layout, so "the chips are on
// screen at 390 wide" is a measurement it reports as zeroes, and it cannot say
// whether the fourth stage's name row fits beside its button in the phone's
// sheet or the desk's rail. Those are the two things this file is for; the
// wiring itself is already held by src/screens/draftChips.test.jsx.
//
// THE FIXTURE IS THE REAL SCRIPT. `page.route` answers /api/agents/chat by
// calling draftScript.js — the same module the server calls — rather than by
// replaying a canned transcript. That is deliberate: the bug was a client
// offering "Loose" to a matcher that had never heard of it, and a hand-written
// fixture would agree with whichever side wrote it. Here, a chip the script
// cannot read fails this test.
//
// One BirthScreen serves both shells, so both widths run the same walk: the
// phone puts the sheet over the room, the desk puts it in the rail.
//
// Run: cd client && npx playwright test e2e/guest-draft-chips.spec.js

import { test, expect } from '@playwright/test';
import {
  chipsFor, questionFor, readAnswer, restate, nextStage, isComplete, MISS_LINE,
} from '../../src/server/draftScript.js';
import { suggestName } from '../../src/server/naming.js';
import { profileFromAnswers } from '../../src/server/draftScript.js';
import { natureForProfile } from '../../src/agent/attributes.js';

const HOME = 'http://127.0.0.1:5199/';

const SIZES = [
  { tag: 'phone', width: 390, height: 844 },
  { tag: 'desk', width: 1440, height: 900 },
];

// The server's own projection, computed the server's own way.
function projection(state) {
  const answers = state.answers;
  const ready = isComplete(answers);
  const stage = state.name || ready ? 'name' : nextStage(answers);
  const profile = profileFromAnswers(answers);
  return {
    draftId: 'draft-guest',
    draftScripted: true,
    draftStep: !ready ? 'briefing' : state.name ? 'ready' : 'naming',
    ready,
    chat: state.chat,
    draftName: state.name,
    natureHint: ready ? natureForProfile(profile).name : null,
    profile: ready ? profile : null,
    draftStage: stage,
    draftChips: chipsFor(stage),
    suggestedName: state.name ?? suggestName(natureForProfile(profile).name, { rand: () => 0 }),
    ...(state.agentId ? { agentId: state.agentId, agentName: state.name, draftStep: 'created' } : {}),
  };
}

async function stub(page) {
  const state = {
    answers: {},
    name: null,
    agentId: null,
    chat: [{ role: 'assistant', content: 'Tell me how he should play.' }],
  };

  const say = (role, content) => {
    const last = [...state.chat].reverse().find((t) => t.role === 'assistant');
    if (role === 'assistant' && String(last?.content ?? '').trim() === content) return;
    state.chat.push({ role, content });
  };

  await page.route('**/api/agents/draft', (r) => r.fulfill({ json: projection(state) }));
  await page.route('**/api/agents/chat**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const content = String(body.content ?? '');
    say('user', content);

    if (body.draftIntent === 'create') {
      state.agentId = 'a-guest';
      return route.fulfill({ json: projection(state) });
    }
    if (body.draftIntent === 'name' || (isComplete(state.answers) && !state.name)) {
      state.name = content.trim() || suggestName(null, { rand: () => 0 });
      say('assistant', `${state.name} it is. Ready when you are.`);
      return route.fulfill({ json: projection(state) });
    }

    const stage = nextStage(state.answers);
    const heard = readAnswer(content, { stage });
    Object.assign(state.answers, heard);
    const said = Object.keys(heard).length ? restate(heard) : null;
    const ask = isComplete(state.answers) ? null : questionFor(nextStage(state.answers));
    say('assistant', said ? [said, ask].filter(Boolean).join(' ') : MISS_LINE);
    return route.fulfill({ json: projection(state) });
  });

  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: [] } }));
  await page.route('**/api/slots**', (r) => r.fulfill({
    json: { used: 0, cap: 4, next: { index: 1, price: 0, earned: 5000, unlocked: true } },
  }));
  await page.route('**/api/wallet**', (r) => r.fulfill({ json: { balance: 12_000, ledger: [] } }));
  await page.route('**/api/events**', (r) => r.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (r) => r.fulfill({ json: { rooms: [], hotWindowMs: 20_000 } }));
  await page.route('**/api/home/thread**', (r) => r.fulfill({ json: { lines: [] } }));
  await page.route('**/api/auth/config**', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (r) => r.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        get viewportHeight() { return window.innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
      },
    };
  });

  // The room rides HOME_STATE, so the socket is scripted rather than silenced —
  // draft-2.spec.js's own stub, for the same reason: an empty room that never
  // arrives never offers the invitation the draft opens from.
  await page.addInitScript(() => {
    class Scripted {
      constructor() {
        this.readyState = 0;
        this.listeners = {};
        setTimeout(() => {
          this.readyState = 1;
          (this.listeners.open ?? []).forEach((f) => f({}));
          (this.listeners.message ?? []).forEach((f) => f({
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents: [], game: null }),
          }));
        }, 20);
      }
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
      removeEventListener() {}
      send() {}
      close() { this.readyState = 3; }
    }
    Scripted.OPEN = 1; Scripted.prototype.OPEN = 1;
    window.WebSocket = Scripted;
  });
  return state;
}

const chipTexts = (page) => page.getByTestId('draft-chips').getByRole('button').allTextContents();
const recruiterLines = (state) => state.chat.filter((t) => t.role === 'assistant').map((t) => t.content);

async function openDraft(page) {
  await page.goto(HOME);
  await page.getByRole('button', { name: /make an agent|draft an agent|draft your first agent/i }).first().click();
  await page.waitForSelector('[data-testid="draft-sheet"]');
  await expect(page.getByTestId('draft-chips')).toBeVisible({ timeout: 15_000 });
}

for (const size of SIZES) {
  test.describe(`BUG-198 · the guest draft at ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.tag === 'phone' });

    test('four taps and he exists — three chips and Deal him in', async ({ page }) => {
      const state = await stub(page);
      await openDraft(page);

      // Tap 1, 2, 3: the first chip at each of the three questions. Which chips
      // are offered is the SCRIPT's answer, not this file's, so a stage that
      // offered something unanswerable would fail here.
      const taps = [];
      for (const stage of ['style', 'bluffing', 'unsure']) {
        // Poll rather than assert: the stage changes when the reply lands, and
        // a synchronous read here measures the question BEFORE the tap.
        await expect.poll(() => chipTexts(page), { timeout: 10_000 }).toEqual(chipsFor(stage));
        const chip = chipsFor(stage)[0];
        taps.push(chip);
        await page.getByRole('button', { name: chip, exact: true }).click();
      }
      expect(taps).toHaveLength(3);

      // The fourth stage: a name already in the field, and one button, in the
      // same row. Scoped to that row — the ordinary composer shares the field's
      // testid, so an unscoped lookup could pass on the wrong screen.
      const row = page.getByTestId('draft-name-row');
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row.getByTestId('draft-input')).not.toHaveValue('');
      await expect(page.getByTestId('draft-chips')).toBeHidden();

      // Tap 4.
      await row.getByRole('button', { name: 'Deal him in', exact: true }).click();
      await expect.poll(() => state.agentId, { timeout: 15_000 }).toBe('a-guest');
    });

    test('every chip is inside the viewport and big enough to hit', async ({ page }) => {
      await stub(page);
      await openDraft(page);

      for (const stage of ['style', 'bluffing', 'unsure']) {
        await expect.poll(() => chipTexts(page), { timeout: 10_000 }).toEqual(chipsFor(stage));
        const chips = page.getByTestId('draft-chips').getByRole('button');
        for (const chip of await chips.all()) {
          const box = await chip.boundingBox();
          expect(box, 'a chip with no box is a chip nobody can tap').not.toBeNull();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(size.width);
          expect(box.y + box.height).toBeLessThanOrEqual(size.height);
          expect(box.height).toBeGreaterThanOrEqual(24);
        }
        await page.getByRole('button', { name: chipsFor(stage)[0], exact: true }).click();
      }
    });

    test('the name row and its button both fit on one line', async ({ page }) => {
      await stub(page);
      await openDraft(page);
      for (const stage of ['style', 'bluffing', 'unsure']) {
        await expect.poll(() => chipTexts(page), { timeout: 10_000 }).toEqual(chipsFor(stage));
        await page.getByRole('button', { name: chipsFor(stage)[0], exact: true }).click();
      }

      // Scoped to the row itself. `draft-input` is also the ordinary composer's
      // testid, so an unscoped lookup here would happily measure the composer
      // and a NextAction button somewhere else and call that a passing row.
      const row = page.getByTestId('draft-name-row');
      await expect(row).toBeVisible({ timeout: 10_000 });
      const field = row.getByTestId('draft-input');
      const deal = row.getByRole('button', { name: 'Deal him in', exact: true });
      await expect(field).toBeVisible();
      await expect(deal).toBeVisible();
      const f = await field.boundingBox();
      const d = await deal.boundingBox();
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(d.x + d.width).toBeLessThanOrEqual(size.width);
      // Beside each other, not stacked: the row is the composer's place.
      expect(Math.abs((f.y + f.height / 2) - (d.y + d.height / 2))).toBeLessThan(f.height);
      expect(d.x).toBeGreaterThanOrEqual(f.x + f.width - 1);
    });

    test('typing nonsense never repeats the question', async ({ page }) => {
      const state = await stub(page);
      await openDraft(page);

      const box = page.getByTestId('draft-input');
      for (const nonsense of ['banana', 'banana', '???']) {
        await box.fill(nonsense);
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(box).toHaveValue('', { timeout: 10_000 });
      }

      const lines = recruiterLines(state);
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i], `the recruiter repeated itself: "${lines[i]}"`).not.toBe(lines[i - 1]);
      }
      expect(lines.at(-1)).toBe(MISS_LINE);
      // And the chips are still there to tap, which is what the line points at.
      expect(await chipTexts(page)).toEqual(chipsFor('style'));
    });

    test('a typed answer works as well as a tap', async ({ page }) => {
      await stub(page);
      await openDraft(page);

      await page.getByTestId('draft-input').fill('loose and bluffs often');
      await page.getByRole('button', { name: 'Send' }).click();

      // Two questions answered by one sentence, so the next one is the third.
      await expect.poll(() => chipTexts(page), { timeout: 10_000 }).toEqual(chipsFor('unsure'));
    });
  });
}
