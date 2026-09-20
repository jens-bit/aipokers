import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentOf, wardrobeOf, validEquipment, STARTER_ITEMS } from './wardrobe.js';
test('BUG-277: the starter rack belongs to old and new companions without changing birth identity', () => {
  const bird = { identity: { hood: 'moss', glow: 'gold' } };
  const before = structuredClone(bird);
  assert.deepEqual(wardrobeOf(bird), { owned: STARTER_ITEMS.map(item => item.id), equipped: { head: null, face: null, neck: null } });
  assert.deepEqual(bird, before);
});
test('equipment accepts only removable items in their own slots, including taking everything off', () => {
  assert.equal(validEquipment({ head: 'rail-cap', face: 'round-glasses', neck: 'knit-scarf' }), true);
  assert.equal(validEquipment({ head: null, face: null, neck: null }), true);
  for (const bad of [null, [], {}, { head: 'knit-scarf', face: null, neck: null }, { head: 'unknown', face: null, neck: null },
    { head: null, face: null, neck: null, identity: {} }]) assert.equal(validEquipment(bad), false);
  assert.deepEqual(equipmentOf({ wardrobe: { equipped: { head: 'rail-cap', face: 'private', neck: {} } } }), { head: 'rail-cap', face: null, neck: null });
});
