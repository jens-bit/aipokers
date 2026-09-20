import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_CARE_INTERVAL_MS, HOME_ITEM_TRIP_MS, HOME_OBSERVE_HEARTBEAT_MS, HOME_OBSERVE_LEASE_MS } from './homeCare.js';
test('BUG-279: one complete visible fridge trip fits before another meal, and foreground leases expire promptly', () => {
  assert.equal(HOME_ITEM_TRIP_MS, 4800, 'retain the authored three 1600ms phases');
  assert.ok(HOME_CARE_INTERVAL_MS > HOME_ITEM_TRIP_MS);
  assert.ok(HOME_OBSERVE_HEARTBEAT_MS < HOME_OBSERVE_LEASE_MS);
  assert.ok(HOME_OBSERVE_LEASE_MS <= 15000);
});
