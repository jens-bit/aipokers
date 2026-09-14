// src/server/seating.test.js — MONEY-1 job 5
//
// The leaf that answers "where is he sitting". Driven with object literals,
// the way the module is written to be: it knows nothing about Table, the
// registry or the database, and that is what lets every door share one rule.

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  setSeatLookup, hasSeatLookup, seatOf, seatedElsewhere, seatedElsewhereMessage,
} from './seating.js';

afterEach(() => setSeatLookup(null));

const table = (tableId, extra = {}) => ({ tableId, closed: false, ...extra });

test('with nothing wired up, nobody is anywhere', () => {
  assert.equal(hasSeatLookup(), false);
  assert.equal(seatOf('a1'), null);
  assert.equal(seatedElsewhere(table('t-1'), 'a1'), null,
    'which is what lets a bare Table fixture seat whoever it likes');
});

test('the lookup is the authority', () => {
  const felt = table('t-1');
  setSeatLookup((id) => (id === 'a1' ? felt : null));
  assert.equal(hasSeatLookup(), true);
  assert.equal(seatOf('a1'), felt);
  assert.equal(seatOf('a2'), null);
  assert.equal(seatOf(null), null, 'no id, no answer');
});

test('a closed table is not a seat', () => {
  setSeatLookup(() => table('t-1', { closed: true }));
  assert.equal(seatOf('a1'), null);
});

test('seatedElsewhere is about SOMEWHERE ELSE', () => {
  const felt = table('t-1');
  setSeatLookup(() => felt);
  assert.equal(seatedElsewhere(felt, 'a1'), null, 'the table he is at is not elsewhere');
  assert.equal(seatedElsewhere('t-1', 'a1'), null, 'by id as well as by object');
  assert.equal(seatedElsewhere(table('t-2'), 'a1'), felt);
  assert.equal(seatedElsewhere('t-2', 'a1'), felt);
});

test('a lookup that throws cannot be the thing that refuses him', () => {
  setSeatLookup(() => { throw new Error('registry is on fire'); });
  assert.equal(seatOf('a1'), null);
  assert.equal(seatedElsewhere(table('t-2'), 'a1'), null);
});

test('the refusal names the felt, because "no" does not', () => {
  const line = seatedElsewhereMessage('GRANITE', table('table-9f3a'));
  assert.match(line, /GRANITE/);
  assert.match(line, /table-9f3a/);
  assert.match(line, /one table at a time/);
  // Never MATCH-1's sentence, which is about a stablemate and is a different
  // rule — telling an owner that about the man himself is telling him something
  // untrue.
  assert.doesNotMatch(line, /another of your agents/);
});

test('the kitchen table is named as a place, not as an id', () => {
  const line = seatedElsewhereMessage('BALANCE', table('home-u1', { home: true }));
  assert.match(line, /kitchen table at home/);
  assert.doesNotMatch(line, /home-u1/, 'an owner has no use for the id of his own living room');
});

test('a nameless agent still gets a sentence', () => {
  assert.match(seatedElsewhereMessage(null, table('t-1')), /^He is already sitting at table t-1\./);
});
