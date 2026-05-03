import { randomBytes } from 'node:crypto';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];

export function createDeck() {
  const deck = new Array(52);
  let i = 0;
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck[i++] = r + s;
    }
  }
  return deck;
}

// Cryptographic Fisher-Yates. Uses rejection sampling on 32-bit ints to avoid
// modulo bias. Per spec section 9.3, randomness must be unpredictable.
export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureIntBelow(i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

function secureIntBelow(max) {
  if (max <= 0) throw new Error('max must be > 0');
  const limit = Math.floor(0x100000000 / max) * max;
  while (true) {
    const n = randomBytes(4).readUInt32BE(0);
    if (n < limit) return n % max;
  }
}

export function freshShuffledDeck() {
  return shuffle(createDeck());
}

// Stateful dealer wrapping a shuffled deck. Burn cards are tracked but ignored
// for evaluation — they exist so logs reflect real dealing procedure.
export class Dealer {
  constructor(deck = freshShuffledDeck()) {
    this.deck = deck;
    this.cursor = 0;
    this.burned = [];
  }
  deal(n) {
    const out = this.deck.slice(this.cursor, this.cursor + n);
    if (out.length !== n) throw new Error('deck exhausted');
    this.cursor += n;
    return out;
  }
  burn() {
    this.burned.push(this.deal(1)[0]);
  }
  remaining() {
    return this.deck.length - this.cursor;
  }
}
