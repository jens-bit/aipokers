import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idFor, identitiesFor, HOODS, GLOWS } from './identity.js';

test('the shared reference roll stays within six hoods and six glows', () => {
  for (let n = 0; n < 100; n++) {
    const id = idFor(`agent-${n}`);
    assert.ok(HOODS.includes(id.hood));
    assert.ok(GLOWS.includes(id.glow));
  }
});
test('an explicit identity is honoured before household collision avoidance', () => {
  const roster = identitiesFor([{ id: 'bal' }, { id: 'fixed', identity: { hood: 'sand', glow: 'gold' } }]);
  assert.equal(roster.get('fixed').hood.id, 'sand');
  assert.equal(roster.get('fixed').glow.id, 'gold');
  assert.notEqual(roster.get('bal').hood.id, 'sand');
});
