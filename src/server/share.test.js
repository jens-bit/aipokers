// src/server/share.test.js — SHARE-2
//
// What is asserted here is what the client cannot check for itself: that the
// bot is handed a message pointing at bytes we actually stored, that the words
// on it were built from the hand and not from the request, that the same card
// comes back through the inline route, and that neither route will show one
// owner's hole cards to another.
//
// The bot is a fake that records what it was handed. The store is the REAL
// SQLite store — this file is spawned in a scratch cwd by
// src/test/helpers/runScript.js, so data/ is a throwaway and the flagged-hand
// lookup is under test with it. The clock is injected; nothing waits.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
// auth.js reads these at call time, so a laptop with a bot token exported would
// 401 every request here and pass in CI.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.MINI_APP_URL;
process.env.PUBLIC_BASE_URL = 'https://cards.example';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import {
  installShareRoutes,
  handleInlineQuery,
  shareCaption,
  handDescription,
  decodePng,
  parseHandId,
  pruneShares,
  photoResult,
  findShare,
  latestShare,
  listShares,
  startInlinePolling,
  SHARE_LIMIT,
  KEEP_SHARES,
  MAX_PNG_BYTES,
  _resetShares,
  _resetShareRate,
} from './share.js';
import { saveProfile } from './store.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

// A real 1x1 PNG. decodePng checks the magic bytes, so "not really a png" would
// be refused — which is the point of it.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// One bad beat: he was ahead with the nut flush draw made, and lost anyway.
// Shaped exactly like buildFlaggedEntry's output, because that is what the
// prepare route reads.
const badBeat = {
  flagType: 'badBeat',
  handNumber: 37,
  pot: 3694,
  holeCards: ['Ah', 'Kh'],
  won: false,
  streets: [
    { street: 'preflop', board: [], action: 'RAISE 60', reasoning: 'Big suited ace, I am raising this every time.' },
    { street: 'flop', board: ['Qh', '7h', '2c'], action: 'BET 120', reasoning: null },
    { street: 'river', board: ['Qh', '7h', '2c', '9d', '3s'], action: 'CALL 900', reasoning: 'He does not have it. He never has it.' },
  ],
  flaggedAt: 1_756_000_000_000,
};

// A second hand, so "the newest card" is a claim with something to beat.
const bigBluff = {
  flagType: 'bigBluff',
  handNumber: 41,
  pot: 880,
  holeCards: ['8c', '4d'],
  won: true,
  streets: [
    { street: 'river', board: ['Qh', '7h', '2c', '9d', '3s'], action: 'RAISE 400', reasoning: 'Nobody calls here.' },
  ],
  flaggedAt: 1_756_000_100_000,
};

const OWNER = 'share-owner';
const OTHER = 'other-owner';

function seed() {
  saveProfile(OWNER, {
    agents: [{ id: 'agent-1', name: 'Aggressive v1.3', sessionFlagged: [badBeat, bigBluff] }],
    chat: [],
  });
  saveProfile(OTHER, {
    agents: [{ id: 'agent-2', name: 'Rock', sessionFlagged: [{ ...badBeat, handNumber: 99 }] }],
    chat: [],
  });
}

// ── The fake bot ─────────────────────────────────────────────────────────────

function fakeBot({ prepared = 'prep_1' } = {}) {
  return {
    saved: [],
    answered: [],
    async savePreparedInlineMessage(userId, result) {
      this.saved.push({ userId, result });
      return prepared === null ? null : { id: prepared };
    },
    async answerInlineQuery(id, results, opts) {
      this.answered.push({ id, results, opts });
      return true;
    },
    async getUpdates() { return []; },
  };
}

// ── Harness ──────────────────────────────────────────────────────────────────

let clock = Date.UTC(2026, 8, 6, 12, 0, 0);

async function withServer(fn, { bot = fakeBot() } = {}) {
  const app = express();
  app.use('/api/share/prepare', express.json({ limit: '12mb' }));
  app.use(express.json());
  installShareRoutes(app, { bot, now: () => clock });

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const prepare = (body, userId = OWNER) =>
    fetch(`${base}/api/share/prepare?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => ({ status: res.status, headers: res.headers, body: await res.json().catch(() => null) }));

  try {
    await fn({ prepare, base, bot });
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const body = (over = {}) => ({ agentId: 'agent-1', handId: 37, png: PNG_B64, ...over });

beforeEach(() => {
  _resetShares();
  _resetShareRate();
  clock = Date.UTC(2026, 8, 6, 12, 0, 0);
  seed();
});

// ── 1. The round trip ────────────────────────────────────────────────────────

test('prepare hosts the PNG and hands the bot a photo message pointing at it', async () => {
  await withServer(async ({ prepare, base, bot }) => {
    const res = await prepare(body());
    assert.equal(res.status, 200);
    assert.equal(res.body.preparedId, 'prep_1');

    // The bot was asked to remember exactly one message, for THIS owner.
    assert.equal(bot.saved.length, 1);
    assert.equal(bot.saved[0].userId, OWNER);

    const result = bot.saved[0].result;
    assert.equal(result.type, 'photo');
    assert.equal(result.photo_url, res.body.url);
    assert.match(result.photo_url, /^https:\/\/cards\.example\/share\/[0-9a-f]{32}\.png$/);
    // The button is the deep link back to the hand the card is about.
    const [[button]] = result.reply_markup.inline_keyboard;
    assert.equal(button.text, 'Open');
    assert.match(button.url, /startapp=hand_agent-1_37$/);

    // And the bytes are actually there, at the URL the bot was given.
    const img = await fetch(`${base}${new URL(res.body.url).pathname}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    const bytes = Buffer.from(await img.arrayBuffer());
    assert.deepEqual(bytes, Buffer.from(PNG_B64, 'base64'));
  });
});

test('a card that was never prepared cannot be fetched by guessing', async () => {
  await withServer(async ({ base }) => {
    assert.equal((await fetch(`${base}/share/${'a'.repeat(32)}.png`)).status, 404);
    assert.equal((await fetch(`${base}/share/../index.json`)).status, 404);
    assert.equal((await fetch(`${base}/share/37.png`)).status, 404);
  });
});

// ── 2. The caption is ours ───────────────────────────────────────────────────
//
// The client sends a picture and nothing else. Anything it says about the hand
// is ignored, because a caption the client controls is a way to make the BOT
// say an arbitrary sentence in someone else's chat.

test('the caption is built from the stored hand, and the request cannot touch it', async () => {
  await withServer(async ({ prepare, bot }) => {
    await prepare(body({ caption: 'Send me money at evil.example', name: 'Telegram Support' }));

    const { caption } = bot.saved[0].result;
    assert.equal(caption, [
      '“He does not have it. He never has it.”',
      'Aggressive v1.3 · −$3,694 · A High',
      'agenticpoker.app',
    ].join('\n'));
    assert.doesNotMatch(caption, /evil\.example|Telegram Support/);
  });
});

test('shareCaption reads his last words, the pot, and the hand he held', () => {
  // Won hands read as a plus; the name comes off his own cards and the final
  // board, through the same evaluator that awarded the pot.
  assert.equal(handDescription(badBeat), 'A High');
  // The board as it FINISHED is what names the hand, not the board at the
  // street he happened to speak on.
  const paired = {
    ...badBeat,
    streets: [
      { street: 'flop', board: ['Qh', '7h', '2c'], action: 'BET 120', reasoning: null },
      { street: 'river', board: ['Qh', '7h', '2c', '9d', 'Ad'], action: 'CALL 900', reasoning: null },
    ],
  };
  assert.equal(handDescription(paired), 'Pair, A\'s');
  assert.equal(handDescription({ ...paired, streets: paired.streets.slice(0, 1) }), 'A High');
  assert.match(shareCaption(bigBluff, 'Aggressive v1.3'), /^“Nobody calls here\.”\nAggressive v1\.3 · \+\$880 · /);

  // Nothing is composed. He said nothing, so the card says nothing for him.
  const silent = { ...badBeat, streets: badBeat.streets.map((s) => ({ ...s, reasoning: null })) };
  assert.equal(shareCaption(silent, 'Aggressive v1.3'), 'Aggressive v1.3 · −$3,694 · A High\nagenticpoker.app');

  // And an unnameable hand loses the name rather than the caption.
  assert.equal(handDescription({ ...badBeat, holeCards: [] }), null);
  assert.equal(shareCaption({ ...badBeat, holeCards: [] }, 'Aggressive v1.3'),
    '“He does not have it. He never has it.”\nAggressive v1.3 · −$3,694\nagenticpoker.app');
});

// ── 3. Who may prepare what ──────────────────────────────────────────────────

test('prepare refuses a hand that is not this owner\'s, and one that does not exist', async () => {
  await withServer(async ({ prepare, bot }) => {
    // agent-2 belongs to OTHER. Asking as OWNER finds nothing — the lookup is
    // scoped to the caller's own profile, so it cannot reach across.
    assert.equal((await prepare(body({ agentId: 'agent-2', handId: 99 }))).status, 404);
    assert.equal((await prepare(body({ handId: 999 }))).status, 404);
    assert.equal(bot.saved.length, 0, 'nothing is prepared for a hand we did not find');
  });
});

test('prepare refuses a body that is not a card', async () => {
  await withServer(async ({ prepare, bot }) => {
    assert.equal((await prepare(body({ agentId: '' }))).status, 400);
    assert.equal((await prepare(body({ handId: '' }))).status, 400);
    assert.equal((await prepare(body({ png: undefined }))).status, 400);
    // Real base64, but not a PNG — these bytes get hosted publicly and fetched
    // by Telegram, so only a PNG is allowed through.
    assert.equal((await prepare(body({ png: Buffer.from('GIF89a nope').toString('base64') }))).status, 400);
    assert.equal(bot.saved.length, 0);
  });
});

test('decodePng takes a data: URL, and refuses everything that is not a PNG', () => {
  assert.ok(decodePng(`data:image/png;base64,${PNG_B64}`).png);
  assert.ok(decodePng(PNG_B64).png);
  assert.match(decodePng('').error, /base64 string/);
  assert.match(decodePng(null).error, /base64 string/);
  assert.match(decodePng(Buffer.from('not a png at all').toString('base64')).error, /not a PNG/);
  assert.match(decodePng('A'.repeat(Math.ceil(MAX_PNG_BYTES / 3) * 4 + 4)).error, /too large/);
});

// ── 4. The budget ────────────────────────────────────────────────────────────

test('five cards an hour, and a refusal does not spend one', async () => {
  await withServer(async ({ prepare }) => {
    // Two rejected requests first: neither is a share, so neither counts.
    assert.equal((await prepare(body({ handId: 999 }))).status, 404);
    assert.equal((await prepare(body({ png: 'zzz' }))).status, 400);

    for (let i = 0; i < SHARE_LIMIT.max; i++) {
      assert.equal((await prepare(body())).status, 200, `share ${i + 1} of ${SHARE_LIMIT.max}`);
    }

    const over = await prepare(body());
    assert.equal(over.status, 429);
    assert.ok(Number(over.headers.get('retry-after')) > 0, 'says when to come back');

    // The window is a window, not a ban.
    clock += SHARE_LIMIT.windowMs + 1;
    assert.equal((await prepare(body())).status, 200);
  });
});

test('the limit is per owner — one owner cannot spend another\'s', async () => {
  await withServer(async ({ prepare }) => {
    for (let i = 0; i < SHARE_LIMIT.max; i++) await prepare(body());
    assert.equal((await prepare(body())).status, 429);
    assert.equal(
      (await prepare({ agentId: 'agent-2', handId: 99, png: PNG_B64 }, OTHER)).status,
      200,
    );
  });
});

// ── 5. The inline route ──────────────────────────────────────────────────────
//
// The same card, reached the other way. Both routes read one record, so they
// cannot disagree about what a hand looked like.

test('an inline query for a hand answers with the card that was prepared for it', async () => {
  const bot = fakeBot();
  await withServer(async ({ prepare }) => {
    const res = await prepare(body());

    await handleInlineQuery({ id: 'q1', from: { id: OWNER }, query: 'hand 37' }, { bot });

    assert.equal(bot.answered.length, 1);
    const [answer] = bot.answered;
    assert.equal(answer.id, 'q1');
    assert.equal(answer.results.length, 1);
    // Byte for byte the message the prepared route saved.
    assert.deepEqual(answer.results[0], bot.saved[0].result);
    assert.equal(answer.results[0].photo_url, res.body.url);
    // Private results, and Telegram must be told so or it caches one person's
    // card against the query string for everybody.
    assert.equal(answer.opts.is_personal, true);
  }, { bot });
});

test('an inline query answers with nothing rather than someone else\'s card', async () => {
  const bot = fakeBot();
  await withServer(async ({ prepare }) => {
    await prepare(body());

    // OTHER asks for hand 37. It exists — it is just not his.
    await handleInlineQuery({ id: 'q2', from: { id: OTHER }, query: 'hand 37' }, { bot });
    assert.deepEqual(bot.answered.at(-1).results, []);

    // And a hand nobody has prepared answers with nothing, not with the newest.
    await handleInlineQuery({ id: 'q3', from: { id: OWNER }, query: 'hand 12345' }, { bot });
    assert.deepEqual(bot.answered.at(-1).results, []);
  }, { bot });
});

test('an inline query with no hand in it offers the newest card the asker has', async () => {
  const bot = fakeBot();
  await withServer(async ({ prepare }) => {
    await prepare(body({ handId: 37 }));
    await prepare(body({ handId: 41 }));

    await handleInlineQuery({ id: 'q4', from: { id: OWNER }, query: '' }, { bot });
    const [result] = bot.answered.at(-1).results;
    assert.equal(result.photo_url, photoResult(latestShare(OWNER)).photo_url);
    assert.equal(findShare(OWNER, 41).id, latestShare(OWNER).id, 'the newest is the one just prepared');
    assert.match(result.caption, /Nobody calls here/);
  }, { bot });
});

test('parseHandId reads the hand out of anything a person might type', () => {
  assert.equal(parseHandId('hand 37'), '37');
  assert.equal(parseHandId('37'), '37');
  assert.equal(parseHandId('  Hand #41 please '), '41');
  assert.equal(parseHandId(''), null);
  assert.equal(parseHandId('hand Aggressive v1.3'), '1');   // a version number is a number
  assert.equal(parseHandId(undefined), null);
});

test('an inline query from nobody is answered by nobody', async () => {
  const bot = fakeBot();
  assert.equal(await handleInlineQuery({ id: 'q5', query: 'hand 37' }, { bot }), false);
  assert.equal(bot.answered.length, 0);
});

// ── 6. What stays on disk ────────────────────────────────────────────────────

test('the newest KEEP_SHARES cards are kept and the rest are dropped', () => {
  const full = Array.from({ length: KEEP_SHARES }, (_, i) => ({ id: `old-${i}`, ownerId: OWNER, handId: i }));
  const { keep, drop } = pruneShares(full, { id: 'new', ownerId: OWNER, handId: 999 });

  assert.equal(keep.length, KEEP_SHARES);
  assert.equal(keep.at(-1).id, 'new');
  assert.deepEqual(drop.map((r) => r.id), ['old-0'], 'exactly the oldest falls off');

  // Under the cap nothing is dropped at all.
  assert.deepEqual(pruneShares([{ id: 'a' }], { id: 'b' }), { keep: [{ id: 'a' }, { id: 'b' }], drop: [] });
});

test('a dropped card takes its bytes with it', async () => {
  await withServer(async ({ prepare }) => {
    const res = await prepare(body());
    const dir = path.join(process.cwd(), 'data', 'share');
    const id = new URL(res.body.url).pathname.split('/').pop().replace('.png', '');

    assert.ok(fs.existsSync(path.join(dir, `${id}.png`)));
    assert.equal(listShares(OWNER).length, 1);

    // The index survives being read back from disk — the inline route depends
    // on it after a restart, when nothing is in memory.
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    assert.equal(onDisk.length, 1);
    assert.equal(onDisk[0].ownerId, OWNER);
    assert.equal(onDisk[0].handId, '37');
  });
});

// ── 7. The poller ────────────────────────────────────────────────────────────

test('inline polling stays off without a token and when SHARE_INLINE=0', () => {
  assert.equal(startInlinePolling({ bot: fakeBot(), token: '' }), null);
  assert.equal(startInlinePolling({ bot: fakeBot(), token: 'x', enabled: false }), null);
});

test('inline polling answers a query it is handed, then stops when told to', async () => {
  await withServer(async ({ prepare }) => {
    await prepare(body());
  });

  const bot = fakeBot();
  const seen = [];
  let handle = null;
  bot.getUpdates = async ({ offset }) => {
    seen.push(offset);
    // One update, once. Every later poll returns nothing, which is what a quiet
    // bot looks like — and lets the assertion below check the offset advanced.
    if (seen.length === 1) return [{ update_id: 7, inline_query: { id: 'q9', from: { id: OWNER }, query: 'hand 37' } }];
    handle?.stop();
    return [];
  };

  handle = startInlinePolling({ bot, token: 'test-token' });
  assert.ok(handle);
  // Two ticks of the loop: the update, then the empty poll that stops it.
  await new Promise((r) => setTimeout(r, 20));

  assert.deepEqual(seen.slice(0, 2), [0, 8], 'the offset advances past what it handled');
  assert.equal(bot.answered.length, 1);
  assert.equal(bot.answered[0].results.length, 1);
});

test('inline polling gives up on a 409 rather than looping on it', async () => {
  const bot = fakeBot();
  let polls = 0;
  bot.getUpdates = async () => {
    polls++;
    throw Object.assign(new Error('Conflict: terminated by other getUpdates request'), { status: 409 });
  };

  startInlinePolling({ bot, token: 'test-token' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(polls, 1, 'a webhook on the same bot is a reason to stop, not to retry');
});

// ── 8. GUEST-1 · one loop, two kinds of update ───────────────────────────────
//
// Only one process may call getUpdates per bot token, so `/start` had to ride
// this loop rather than open a second one. These pin the two halves of that:
// the loop asks for what somebody is actually listening for, and both handlers
// see their own updates from the same batch.

test('GUEST-1: with no message handler the loop asks for inline queries alone', async () => {
  const bot = fakeBot();
  const asked = [];
  let handle = null;
  bot.getUpdates = async ({ allowed_updates }) => {
    asked.push(allowed_updates);
    handle?.stop();
    return [];
  };
  handle = startInlinePolling({ bot, token: 'test-token' });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(asked[0], ['inline_query']);
});

test('GUEST-1: a message handler makes the loop ask for messages too', async () => {
  const bot = fakeBot();
  const asked = [];
  let handle = null;
  bot.getUpdates = async ({ allowed_updates }) => {
    asked.push(allowed_updates);
    handle?.stop();
    return [];
  };
  handle = startInlinePolling({ bot, token: 'test-token', onMessage: () => {} });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(asked[0], ['inline_query', 'message']);
});

test('GUEST-1: both handlers see their own updates out of one batch', async () => {
  await withServer(async ({ prepare }) => { await prepare(body()); });

  const bot = fakeBot();
  const messages = [];
  let polls = 0;
  let handle = null;
  bot.getUpdates = async () => {
    polls++;
    if (polls === 1) {
      return [
        { update_id: 1, inline_query: { id: 'q1', from: { id: OWNER }, query: 'hand 37' } },
        { update_id: 2, message: { text: '/start guest_abc', chat: { id: 5 }, from: { id: 5 } } },
      ];
    }
    handle?.stop();
    return [];
  };

  handle = startInlinePolling({
    bot, token: 'test-token',
    onMessage: (m) => { messages.push(m.text); },
  });
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(bot.answered.length, 1, 'the share card still answered');
  assert.deepEqual(messages, ['/start guest_abc']);
});

test('GUEST-1: a message handler that throws does not stop the share cards', async () => {
  const bot = fakeBot();
  let polls = 0;
  let handle = null;
  bot.getUpdates = async () => {
    polls++;
    if (polls <= 2) return [{ update_id: polls, message: { text: '/start boom', chat: { id: 5 } } }];
    handle?.stop();
    return [];
  };

  handle = startInlinePolling({
    bot, token: 'test-token',
    onMessage: () => { throw new Error('handler exploded'); },
  });
  await new Promise((r) => setTimeout(r, 30));

  // It kept polling. A handler that can take this loop down is a handler that
  // can take inline sharing down with it, for somebody who never tapped a link.
  assert.ok(polls >= 3, `only polled ${polls} times`);
});
