// AUTH-1: the two signature schemes behind the single x-telegram-init-data
// credential. No network, no API credits — every fixture is signed locally
// with a throwaway bot token.
//
// Run: node --test src/server/auth.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  verifyTelegramInitData,
  verifyTelegramLoginPayload,
  verifyTelegramCredential,
  telegramUserIdFrom,
} from './auth.js';

const TOKEN = '123456:test-bot-token-not-a-real-secret';
const OTHER_TOKEN = '999999:some-other-bot-token';

const nowS = () => Math.floor(Date.now() / 1000);

// ── fixture builders ─────────────────────────────────────────────────────

function dataCheckString(fields) {
  return Object.entries(fields)
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function serialise(fields) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) p.append(k, String(v));
  return p.toString();
}

// Mini App initData: key = HMAC_SHA256("WebAppData", botToken)
function signInitData(fields, token = TOKEN) {
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex');
  return serialise({ ...fields, hash });
}

// Login Widget: key = SHA256(botToken)
function signLoginPayload(fields, token = TOKEN) {
  const secret = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex');
  return serialise({ ...fields, hash });
}

const initDataFields = (over = {}) => ({
  auth_date: String(nowS()),
  query_id: 'AAF_test_query',
  user: JSON.stringify({ id: 4242, first_name: 'Jens', username: 'jens' }),
  ...over,
});

const widgetFields = (over = {}) => ({
  id: '4242',
  first_name: 'Jens',
  last_name: 'S',
  username: 'jens',
  photo_url: 'https://t.me/i/userpic/320/jens.jpg',
  auth_date: String(nowS()),
  ...over,
});

// ── Login Widget scheme ──────────────────────────────────────────────────

test('widget payload signed with the bot token verifies', () => {
  assert.equal(verifyTelegramLoginPayload(signLoginPayload(widgetFields()), TOKEN), true);
});

test('widget payload verifies without the optional fields', () => {
  const minimal = { id: '77', first_name: 'A', auth_date: String(nowS()) };
  assert.equal(verifyTelegramLoginPayload(signLoginPayload(minimal), TOKEN), true);
});

test('widget payload with a tampered field fails', () => {
  const signed = signLoginPayload(widgetFields());
  const p = new URLSearchParams(signed);
  p.set('id', '9999');                       // hijack another user's identity
  assert.equal(verifyTelegramLoginPayload(p.toString(), TOKEN), false);
});

test('widget payload with a tampered hash fails', () => {
  const p = new URLSearchParams(signLoginPayload(widgetFields()));
  p.set('hash', 'f'.repeat(64));
  assert.equal(verifyTelegramLoginPayload(p.toString(), TOKEN), false);
});

test('widget payload signed with a different bot token fails', () => {
  const signed = signLoginPayload(widgetFields(), OTHER_TOKEN);
  assert.equal(verifyTelegramLoginPayload(signed, TOKEN), false);
});

test('widget payload with a stale auth_date fails', () => {
  // Default LOGIN_MAX_AGE_S is 30 days; 31 days old must be rejected.
  const stale = widgetFields({ auth_date: String(nowS() - 31 * 24 * 60 * 60) });
  assert.equal(verifyTelegramLoginPayload(signLoginPayload(stale), TOKEN), false);
});

test('widget payload just inside the age window still verifies', () => {
  const fresh = widgetFields({ auth_date: String(nowS() - 29 * 24 * 60 * 60) });
  assert.equal(verifyTelegramLoginPayload(signLoginPayload(fresh), TOKEN), true);
});

test('widget payload with no hash or no auth_date fails', () => {
  assert.equal(verifyTelegramLoginPayload(serialise(widgetFields()), TOKEN), false);
  const noDate = { id: '1', first_name: 'A' };
  assert.equal(verifyTelegramLoginPayload(signLoginPayload(noDate), TOKEN), false);
  assert.equal(verifyTelegramLoginPayload('', TOKEN), false);
});

// ── initData scheme is unchanged ─────────────────────────────────────────

test('initData signed with the bot token still verifies', () => {
  assert.equal(verifyTelegramInitData(signInitData(initDataFields()), TOKEN), true);
});

test('initData with a tampered user field fails', () => {
  const p = new URLSearchParams(signInitData(initDataFields()));
  p.set('user', JSON.stringify({ id: 1, first_name: 'Mallory' }));
  assert.equal(verifyTelegramInitData(p.toString(), TOKEN), false);
});

test('initData scheme rejects a widget-signed payload', () => {
  // The two schemes derive different keys from the same token — neither
  // signature can satisfy the other's check.
  assert.equal(verifyTelegramInitData(signLoginPayload(widgetFields()), TOKEN), false);
});

test('widget scheme rejects an initData-signed payload', () => {
  assert.equal(verifyTelegramLoginPayload(signInitData(initDataFields()), TOKEN), false);
});

// ── telegramUserIdFrom on both shapes ────────────────────────────────────

test('telegramUserIdFrom reads user.id out of initData', () => {
  assert.equal(telegramUserIdFrom(signInitData(initDataFields())), '4242');
});

test('telegramUserIdFrom reads the top-level id out of a widget payload', () => {
  assert.equal(telegramUserIdFrom(signLoginPayload(widgetFields())), '4242');
});

test('telegramUserIdFrom returns null when there is no identity', () => {
  assert.equal(telegramUserIdFrom('auth_date=1&hash=ab'), null);
  assert.equal(telegramUserIdFrom(''), null);
  assert.equal(telegramUserIdFrom('user=not-json'), null);
});

// ── verifyTelegramCredential picks the right scheme ──────────────────────

test('verifyTelegramCredential accepts initData', () => {
  assert.equal(verifyTelegramCredential(signInitData(initDataFields()), TOKEN), true);
});

test('verifyTelegramCredential accepts a widget payload', () => {
  assert.equal(verifyTelegramCredential(signLoginPayload(widgetFields()), TOKEN), true);
});

test('verifyTelegramCredential rejects an unsigned or foreign-signed string', () => {
  assert.equal(verifyTelegramCredential(serialise(widgetFields()), TOKEN), false);
  assert.equal(verifyTelegramCredential(signLoginPayload(widgetFields(), OTHER_TOKEN), TOKEN), false);
  assert.equal(verifyTelegramCredential(signInitData(initDataFields(), OTHER_TOKEN), TOKEN), false);
  assert.equal(verifyTelegramCredential('garbage', TOKEN), false);
  assert.equal(verifyTelegramCredential('', TOKEN), false);
  assert.equal(verifyTelegramCredential(signLoginPayload(widgetFields()), ''), false);
});

test('verifyTelegramCredential rejects a stale widget payload', () => {
  const stale = widgetFields({ auth_date: String(nowS() - 31 * 24 * 60 * 60) });
  assert.equal(verifyTelegramCredential(signLoginPayload(stale), TOKEN), false);
});

test('a widget-shaped payload carrying a user field is not tried as a widget', () => {
  // looksLikeLoginPayload requires top-level id AND no user: a string that
  // claims both is initData-shaped and only the initData HMAC can pass it.
  const hybrid = { ...widgetFields(), user: JSON.stringify({ id: 1 }) };
  assert.equal(verifyTelegramCredential(signLoginPayload(hybrid), TOKEN), false);
});
