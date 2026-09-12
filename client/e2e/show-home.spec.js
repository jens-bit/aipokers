// client/e2e/home.spec.js — HOME-1
//
// Five pictures of the room at 390×844, the size the Mini App actually opens at.
//
// WHY THIS IS NOT IN `npm test` OR IN CI, and why Playwright is not a dependency
// of this repo:
//
//   * It is a LOOK check, not a rule check. Everything with a rule behind it —
//     the routine ladder, the walks, the want flow, the thread, the money law —
//     is asserted in HomeScreen.test.jsx under vitest, which runs in seconds and
//     gates every commit. Screenshots gate nothing; they are for a person's
//     eyes, and a screenshot diff in CI is a machine asking a person to look at
//     a picture, every time a shadow moves.
//   * Playwright plus a browser is a heavy install to put in every
//     contributor's `npm ci` for a check nothing blocks on. It is run with
//     `npx playwright test` from client/, which needs no entry in package.json
//     (CLAUDE.md: no new npm dependencies without a stated reason — the reason
//     for NOT adding one is this paragraph).
//
// The five states are the brief's own: one agent alone, two home and one away,
// a want, the thread open, the tape room. Each is served from a fixed fixture
// through page.route, so nothing here needs a server, a database, or a model —
// and the pictures are the same on every machine.
//
// Run:  cd client && npx playwright test e2e/home.spec.js
// Look: client/e2e/__screenshots__/*.png

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { roomsResponse } from '../src/test/fixtures/rooms.js';
import { bigBluffHand, badBeatHand } from '../src/test/fixtures/flagged.js';

const VIEWPORT = { width: 390, height: 844 };

const HOME = '/';

const loc = (where = 'home', extra = {}) => ({
  where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra,
});

const agent = (id, name, over = {}) => ({
  id,
  name,
  style: 'Balanced',
  risk: 'Medium',
  nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 },
  fatigue: 'fresh',
  location: loc('home'),
  routine: { key: 'reads', label: 'reading' },
  unseenRecap: false,
  want: null,
  opener: 'Sit down. What do you want to know?',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const CASTS = {
  alone: {
    name: 'one-alone',
    agents: [agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'counts', label: 'counting chips' } })],
    game: null,
  },
  household: {
    name: 'two-home-one-away',
    agents: [
      agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'plays', label: 'in a hand' } }),
      agent('a2', 'River Rat', { nature: { name: 'Shark' }, routine: { key: 'plays', label: 'in a hand' }, mood: { state: 'confident', heat: 58 } }),
      agent('a3', 'Big Slick', {
        nature: { name: 'Hothead' },
        location: loc('table', { tableId: 't1', room: 'upstairs' }),
        routine: null,
        activeTableId: 't1',
        mood: { state: 'tilted', heat: 78 },
        liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], net: 340, street: 'flop' },
      }),
    ],
    game: { tableId: 'home-u1', state: 'running', seats: [{ seat: 0, agentId: 'a1', name: 'The Clock', house: false }, { seat: 1, agentId: 'a2', name: 'River Rat', house: false }], handsPlayed: 7 },
  },
  want: {
    name: 'a-want',
    agents: [
      agent('a1', 'The Clock', {
        mood: { state: 'frustrated', heat: 64 },
        want: { kind: 'beer', text: "Can I have a beer. It's been rough.", needs: null, dangerous: false },
      }),
      agent('a2', 'River Rat', { nature: { name: 'Hothead' }, routine: { key: 'paces', label: 'pacing' } }),
    ],
    game: null,
  },
  tape: {
    name: 'the-tape-room',
    agents: [
      agent('a1', 'The Clock', { routine: { key: 'tape', label: 'the tape room' } }),
      agent('a2', 'River Rat', { routine: { key: 'sleeps', label: 'asleep' }, fatigue: 'worn', mood: { state: 'sulking', heat: 22 } }),
    ],
    game: null,
    study: {
      study: { handNumber: 41, flagType: 'badBeat', startedAt: Date.now(), endsAt: Date.now() + 60_000 },
      book: [{ playerId: 'p1', displayName: 'Granite', updatedAt: Date.now(), lines: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }],
      count: 1,
    },
  },
};

const THREAD = {
  sessionId: 's1',
  count: 4,
  lines: [
    { id: 1, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', ts: Date.now() - 500_000, source: 'table' },
    { id: 2, kind: 'him', who: 'HIM', text: 'He does that every single time.', ts: Date.now() - 480_000, source: 'table' },
    { id: 3, kind: 'you', who: 'YOU', text: 'So take it off him.', ts: Date.now() - 460_000, source: 'table' },
    { id: 4, kind: 'him', who: 'HIM', text: 'Working on it. Long night in here.', ts: Date.now() - 60_000, source: 'home' },
  ],
};

// Everything the room asks for, from a fixture. No server, no database, no model.
async function stub(page, cast) {
  await page.route('**/api/agents?**', (route) => route.fulfill({ json: { agents: cast.agents } }));
  await page.route('**/api/agents/*/study**', (route) => route.fulfill({ json: cast.study ?? { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (route) => route.fulfill({ json: THREAD }));
  await page.route('**/api/home/thread**', route => route.fulfill({ json: cast.agents.length ? THREAD : { sessionId: 'home-empty', lines: [], count: 0 } }));
  await page.route('**/api/fridge?**', route => route.fulfill({ json: { items: [{ id: 'beer', count: 4, price: 12 }, { id: 'snack', count: 2, price: 8 }] } }));
  await page.route('**/api/slots**',r=>r.fulfill({json:{used:cast.agents.length,cap:4,next:null}}));
  await page.route('**/api/wallet**', (route) => route.fulfill({ json: { balance: 12_000, ledger: [] } }));
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (route) => route.fulfill({ json: { rooms: [], hotWindowMs: 20_000 } }));
  await page.route('**/api/auth/config**', (route) => route.fulfill({ json: { botUsername: '' } }));

  // index.html loads Telegram's real SDK from telegram.org, and it REPLACES
  // window.Telegram when it arrives — which is after addInitScript has run, so
  // the stub below was being overwritten by a session with no initData and the
  // login gate took the screen. Block it: there is no Telegram here to talk to.
  await page.route('https://telegram.org/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }));

  // The Mini App SDK, installed before the bundle runs so the login gate opens.
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

  // HOME_STATE rides a WebSocket, and the HOME GAME rides only HOME_STATE —
  // GET /api/agents has no kitchen table in it. So the socket is scripted
  // rather than silenced: it opens, answers FLOOR_SUB with this cast's own
  // HOME_STATE, and says nothing else. That is the frame the server would
  // send, so the picture is of the real screen and not of a fallback.
  await page.addInitScript(([agents, game, table]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        (window.__homeSockets ??= []).push(this);
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game }),
          });
          if (table) this.dispatch('message', { data: JSON.stringify({ type: 'state', state: table, legalActions: [] }) });
        }, 30);
      }
      dispatch(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) {
        const at = this.listeners[type]?.indexOf(fn) ?? -1;
        if (at >= 0) this.listeners[type].splice(at, 1);
      }
      send() {}
      close() { this.readyState = 3; }
    }
    ScriptedSocket.OPEN = 1;
    ScriptedSocket.prototype.OPEN = 1;
    window.WebSocket = ScriptedSocket;
  }, [cast.agents, cast.game ?? null, cast.table ?? null]);
}

async function room(page, cast, viewport = VIEWPORT) {
  await stub(page, cast);
  await page.setViewportSize(viewport);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The room's own bodies have landed, so nothing is captured mid-mount.
  await page.waitForSelector('.home-flat');
  await page.waitForTimeout(600);
}


for (const [name,cast,viewport] of [
 ['alone',CASTS.alone,{width:390,height:844}],
 ['household',CASTS.household,{width:390,height:844}],
 ['want',CASTS.want,{width:390,height:844}],
 ['empty',{agents:[],game:null},{width:390,height:844}],
 ['short',CASTS.household,{width:390,height:590}],
 ['desktop',CASTS.household,{width:1440,height:900}],
]) test(`HOME-1 inspect ${name}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await room(page,cast,viewport);
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByTestId('home-table')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
  await page.screenshot({path:`../artifacts/show/home-1-${name}.png`});
  const metrics=await page.evaluate(()=>Object.fromEntries(['.home1','.room-header','.home1__room','.home-flat','.home-thread','.home1__scale'].map(sel=>{const el=document.querySelector(sel),r=el?.getBoundingClientRect();return[sel,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null];})));
  console.log(name,JSON.stringify(metrics));
  if(viewport.width===390) {
    expect.soft(metrics['.home-flat'].h).toBeGreaterThanOrEqual(metrics['.home1__room'].h-1);
    await expect.soft(page.getByRole('button',{name:'Your agents',exact:true}).locator('svg')).toHaveAttribute('fill','none');
    if(name==='household')await expect.soft(page.locator('[data-agent="a2"] .home-one__body')).toHaveCSS('width','44px');
    await expect(page.getByRole('button',{name:'Your agents',exact:true})).toHaveCSS('color',name==='want'?'rgb(205, 179, 128)':'rgb(195, 195, 198)');
    if(name==='short'){
      await page.getByTestId('home-tv').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('home-tv')).toBeInViewport();
      await expect(page.getByPlaceholder('Say something to the room…')).toBeInViewport();
    }
  }
  expect(errors).toEqual([]);
});
