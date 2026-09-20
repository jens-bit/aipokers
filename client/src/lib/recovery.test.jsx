import { expect, it } from 'vitest';
import { recoveryHint } from './recovery.js';
it('BUG-279: only the known server needs refusal offers Home recovery', () => {
  for (const refusal of [null, {}, { error: 'forbidden', kind: 'food' }, 'agentSpent']) expect(recoveryHint(refusal)).toBeNull();
  expect(recoveryHint({ error: 'agentSpent', kind: 'food', needs: 'stock' })).toMatch(/^Buy snacks/);
  expect(recoveryHint({ error: 'agentSpent', kind: 'food' })).toMatch(/stocked snacks/);
  expect(recoveryHint({ error: 'agentSpent', kind: 'rest' })).toMatch(/let him rest/);
});
