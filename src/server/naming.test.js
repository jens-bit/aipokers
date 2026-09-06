// src/server/naming.test.js — BUGS-B/4
//
// A name can never be empty and can never be "The".

import test from 'node:test';
import assert from 'node:assert/strict';

import { coinName, ensureName, NAME_MAX, DEFAULT_NAME } from './naming.js';

test('BUGS-B/4: a name typed as a name comes back as itself', () => {
  assert.equal(coinName('Granite'), 'Granite');
  assert.equal(coinName('The Grinder'), 'The Grinder');
  assert.equal(coinName('River Rat'), 'River Rat');
});

test('BUGS-B/4: a name typed in a sentence comes back as a name', () => {
  assert.equal(coinName('call him The Sheriff'), 'The Sheriff');
  assert.equal(coinName("let's call him Bruiser"), 'Bruiser');
  assert.equal(coinName('his name is Big Slick'), 'Big Slick');
  assert.equal(coinName('name: Dead Money'), 'Dead Money');
  assert.equal(coinName('how about Broadway'), 'Broadway');
  assert.equal(coinName('I\'d call him Ace'), 'Ace');
});

test('BUGS-B/4: the owner\'s own capitals are his', () => {
  // He typed it that way on purpose.
  assert.equal(coinName('MsAllIn'), 'MsAllIn');
  assert.equal(coinName('TAGmaster'), 'TAGmaster');
  // He did not type it any way at all.
  assert.equal(coinName('granite'), 'Granite');
  assert.equal(coinName('the rock'), 'The Rock');
});

test('BUGS-B/4: it fits on a seat plate', () => {
  assert.equal(coinName('The Relentless Pressure Machine').length <= NAME_MAX, true);
  // Cut at a word boundary, not mid-word.
  assert.equal(coinName('The Relentless Pressure Machine'), 'The Relentless');
  assert.equal(coinName('Loose Cannon Deluxe'), 'Loose Cannon');
  // A single word longer than the plate is the one case that gets cut.
  assert.equal(coinName('Supercalifragilistic'), 'Supercalifragi');
  assert.equal(coinName('Supercalifragilistic').length <= NAME_MAX, true);
});

test('BUGS-B/4: never empty', () => {
  assert.equal(coinName(''), DEFAULT_NAME);
  assert.equal(coinName(null), DEFAULT_NAME);
  assert.equal(coinName(undefined), DEFAULT_NAME);
  assert.equal(coinName('   '), DEFAULT_NAME);
  assert.equal(coinName('🎰🎲'), DEFAULT_NAME, 'nothing printable is nothing');
  assert.equal(coinName('---'), DEFAULT_NAME);
});

test('BUGS-B/4: never "The", and never the words around a name', () => {
  assert.equal(coinName('The'), DEFAULT_NAME);
  assert.equal(coinName('the'), DEFAULT_NAME);
  assert.equal(coinName('a'), DEFAULT_NAME);
  assert.equal(coinName('call him'), DEFAULT_NAME);
  assert.equal(coinName('his name is'), DEFAULT_NAME);
  assert.equal(coinName('whatever'), DEFAULT_NAME);
  assert.equal(coinName('idk'), DEFAULT_NAME);
  assert.equal(coinName('the agent'), DEFAULT_NAME);
});

test('BUGS-B/4: "The" plus a real word is a real name', () => {
  assert.equal(coinName('the closer'), 'The Closer');
  assert.equal(coinName('The Nit'), 'The Nit');
});

test('BUGS-B/4: a caller with a better fallback can ask for null', () => {
  assert.equal(coinName('', { fallback: null }), null);
  assert.equal(coinName('The', { fallback: null }), null);
  assert.equal(coinName('Granite', { fallback: null }), 'Granite');
  assert.equal(coinName('', { fallback: 'Loose Cannon' }), 'Loose Cannon');
});

test('BUGS-B/4: a model that answered with a fence answered with nothing', () => {
  assert.equal(coinName('```json\n{"name":"x"}\n```'), DEFAULT_NAME);
  assert.equal(coinName('Granite\nand he plays tight'), 'Granite',
    'a name is never a paragraph — the first line is the answer');
});

test('BUGS-B/4: punctuation around a name is not part of it', () => {
  assert.equal(coinName('"Granite"'), 'Granite');
  assert.equal(coinName('“The Rock”'), 'The Rock');
  assert.equal(coinName('Granite.'), 'Granite');
  assert.equal(coinName('Granite, the tight one'), 'Granite');
  assert.equal(coinName('Chip Leader!'), 'Chip Leader');
});

test('BUGS-B/4: a separator inside a name survives; one on the edge does not', () => {
  assert.equal(coinName("O'Malley"), "O'Malley");
  assert.equal(coinName('Check-Raiser'), 'Check-Raiser');
  assert.equal(coinName('-Granite-'), 'Granite');
});

test('BUGS-B/4: ensureName repairs a record in place, once', () => {
  const broken = { name: '' };
  assert.equal(ensureName(broken), DEFAULT_NAME);
  assert.equal(broken.name, DEFAULT_NAME, 'the record is fixed, not just the answer');

  const article = { name: 'The' };
  assert.equal(ensureName(article, { fallback: 'Loose Cannon' }), 'Loose Cannon');
  assert.equal(article.name, 'Loose Cannon');

  const fine = { name: 'Granite' };
  assert.equal(ensureName(fine), 'Granite');
  assert.equal(fine.name, 'Granite', 'a good name is left exactly alone');

  const long = { name: 'The Relentless Pressure Machine' };
  assert.equal(ensureName(long).length <= NAME_MAX, true);

  assert.equal(ensureName(null), DEFAULT_NAME);
});
