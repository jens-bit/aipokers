import test from 'node:test';
import assert from 'node:assert/strict';
import {miniAppUrl} from './miniAppUrl.js';
test('BUG-130: explicit app destination preserves query and replaces start parameter',()=>{assert.equal(miniAppUrl('agent_a/b',{MINI_APP_URL:'https://t.me/railbird_test/play?theme=dark&startapp=old#view',TELEGRAM_BOT_USERNAME:'ignored'}),'https://t.me/railbird_test/play?theme=dark&startapp=agent_a%2Fb#view');});
test('BUG-130: configured bot launches the main app without inventing a short name',()=>{assert.equal(miniAppUrl(undefined,{TELEGRAM_BOT_USERNAME:'@configured_bot'}),'https://t.me/configured_bot?startapp=');assert.equal(miniAppUrl('agent_a1',{TELEGRAM_BOT_USERNAME:'configured_bot'}),'https://t.me/configured_bot?startapp=agent_a1');});
test('BUG-130: public app is a fallback and missing/invalid configuration has no false button',()=>{assert.equal(miniAppUrl(undefined,{PUBLIC_BASE_URL:'https://example.test/app'}),'https://example.test/app');assert.equal(miniAppUrl(undefined,{}),null);assert.equal(miniAppUrl('agent_a',{MINI_APP_URL:'broken'}),null);assert.equal(miniAppUrl(undefined,{MINI_APP_URL:'javascript:alert(1)'}),null);});
