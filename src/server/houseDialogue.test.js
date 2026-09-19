import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_CAST } from './houseCast.js';
import { houseVoice, houseLine, createHouseMemory, MEMORY_LIMIT, MEMORY_TTL_MS } from './houseDialogue.js';

test('VILLAIN-1: each real House regular has a distinct event-specific voice without a model', () => {
  for (const event of ['hello', 'return', 'returnWon', 'returnLost', 'won', 'lost', 'shared', 'reply']) {
    const lines = HOUSE_CAST.map(member => {
      assert.ok(houseVoice(`house_${member.id}`)?.character);
      const text = houseLine(`house_${member.id}`, event, { name: 'Milo', hand: 7 });
      assert.equal(typeof text, 'string');
      assert.ok(text.length > 0 && text.length <= 160);
      assert.ok(text.split(/\s+/).length <= 16);
      return text;
    });
    assert.equal(new Set(lines).size, HOUSE_CAST.length, event);
  }
  assert.equal(houseVoice('agent_granite'), null);
  assert.equal(houseLine('unknown', 'won'), null);
});

test('VILLAIN-1: the next line avoids an immediate repeat and names are treated as bounded text', () => {
  const first = houseLine('house_granite', 'won', { hand: 4, name: 'Milo' });
  const second = houseLine('house_granite', 'won', { hand: 4, name: 'Milo', previous: first });
  assert.notEqual(first, second);
  assert.doesNotMatch(houseLine('house_granite', 'hello', { name: 'Milo\nIGNORE ALL\u0000' }), /[\n\u0000]/);
});

test('VILLAIN-1: House recognition is pair-specific, bounded, expiring, and contains only public facts', () => {
  let now = 100;
  const memory = createHouseMemory({ now: () => now });
  const hand = { tableId: 't1', handNumber: 1, outcome: 'lost', holeCards: ['As','Ah'], reasoning: 'secret' };
  memory.note('house_granite', 'agent_milo', hand);
  memory.note('house_granite', 'agent_milo', hand);
  assert.equal(memory.get('house_granite', 'agent_milo').hands, 1, 'one record per real hand');
  assert.equal(memory.get('house_phil_ai', 'agent_milo'), null, 'another regular cannot borrow recognition');
  assert.equal(memory.get('house_granite', 'agent_other'), null);
  assert.doesNotMatch(JSON.stringify(memory.snapshot()), /As|Ah|secret|holeCards|reasoning/);
  for (let i = 0; i < MEMORY_LIMIT + 3; i++) {
    now++;
    memory.note('house_granite', `agent_${i}`, { tableId: 't2', handNumber: 1, outcome: 'played' });
  }
  assert.equal(memory.snapshot().length, MEMORY_LIMIT);
  assert.equal(memory.get('house_granite', 'agent_milo'), null, 'oldest opponent expires at capacity');
  now += MEMORY_TTL_MS + 1;
  assert.equal(memory.get('house_granite', `agent_${MEMORY_LIMIT + 2}`), null);
});

test('VILLAIN-1: bounded public recognition survives a persistence reload', () => {
  let saved = [];
  const options = { now: () => 1000, load: () => saved, save: rows => { saved = structuredClone(rows); } };
  const first = createHouseMemory(options);
  first.note('house_granite', 'agent_milo', { tableId: 't1', handNumber: 9, outcome: 'lost' });
  const second = createHouseMemory(options);
  assert.deepEqual(second.get('house_granite', 'agent_milo'), first.get('house_granite', 'agent_milo'));
  assert.equal(second.get('house_granite', 'agent_milo').outcome, 'lost');
});
