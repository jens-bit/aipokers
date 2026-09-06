// client/src/lib/identity.test.jsx — HOME-2 job 3
//
// WHO HE IS, ROLLED AT BIRTH.
//
// Two claims are under test and they are different in kind. One is arithmetic:
// the roll is stable, it spreads, and the roster claims a hood so four agents
// wear four. The other is a claim about a PICTURE — "hoods must be tellable
// apart at 40px" — and that one is measured rather than eyeballed, because the
// first set of six was chosen by eye and shipped as one grey.

import { describe, expect, it } from 'vitest';

import {
  GLOWS, HOODS, h32, idFor, identitiesFor, identityOf, storedIdentity,
} from './identity.js';

const agent = (id, over = {}) => ({ id, name: id, ...over });

// The two channels of a colour that decide whether two hoods read apart at a
// size where hue does almost nothing: how far apart they are in RGB, and how
// far apart they are in luminance.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...rgb(a).map((c, i) => c - rgb(b)[i]));
const lum = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('the sets', () => {
  it('is six hoods by six glows — thirty-six creatures', () => {
    expect(HOODS).toHaveLength(6);
    expect(GLOWS).toHaveLength(6);
    expect(new Set(HOODS.map((h) => h.id)).size).toBe(6);
    expect(new Set(GLOWS.map((g) => g.id)).size).toBe(6);
  });

  // THE CLAIM THIS EXISTS FOR. The first set was six near-blacks at L* 8–14 and
  // read as one grey: at 40px a hood is barely 900 painted pixels and hue does
  // nothing at that luminance. So the test is on luminance and on RGB distance,
  // not on "they are different strings".
  it('every pair of hoods is tellable apart at 40px', () => {
    for (let i = 0; i < HOODS.length; i += 1) {
      for (let j = i + 1; j < HOODS.length; j += 1) {
        const a = HOODS[i];
        const b = HOODS[j];
        // Board 29 measured the shipped set at a closest pair of 42 RGB units.
        expect(dist(a.top, b.top), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('and none of them is a near-black, which is what made the first set one grey', () => {
    for (const hood of HOODS) {
      expect(lum(hood.top), hood.id).toBeGreaterThan(45);
      // Still cloth in a dim room, though: a hood is not a highlight.
      expect(lum(hood.top), hood.id).toBeLessThan(120);
      // The gradient runs down into shadow, never up into light.
      expect(lum(hood.bot), hood.id).toBeLessThan(lum(hood.top));
    }
  });

  it('the glows are six colours, and every one of them lights an eye', () => {
    for (let i = 0; i < GLOWS.length; i += 1) {
      for (let j = i + 1; j < GLOWS.length; j += 1) {
        expect(dist(GLOWS[i].c, GLOWS[j].c), `${GLOWS[i].id} vs ${GLOWS[j].id}`)
          .toBeGreaterThan(40);
      }
      // Bright enough to read as a light source against the hood it sits in.
      expect(lum(GLOWS[i].c), GLOWS[i].id).toBeGreaterThan(lum(HOODS[i].top));
    }
  });
});

describe('the roll', () => {
  it('is stable — the same man rolls the same creature forever', () => {
    const first = idFor('agent_m3x9q1');
    for (let i = 0; i < 20; i += 1) {
      expect(idFor('agent_m3x9q1')).toEqual(first);
    }
  });

  it('never rolls something that is not in the sets', () => {
    for (const seed of ['a', 'bal', 'agent_zz', '', '12345678901234567890']) {
      const rolled = idFor(seed);
      expect(HOODS).toContain(rolled.hood);
      expect(GLOWS).toContain(rolled.glow);
    }
  });

  // THE BUG THE HASH WAS CHANGED FOR. A *31 sum folded through mod 9973 and
  // then mod 6 put three of these four on the same hood, because three-letter
  // ids differ only in their low bits and every fold kept them there.
  it('spreads the four house seeds rather than folding them together', () => {
    const hoods = ['bal', 'agg', 'val', 'blf'].map((s) => idFor(s).hood.id);
    expect(new Set(hoods).size).toBeGreaterThanOrEqual(3);
  });

  // Hood and glow are hashed under different seeds, so the two are independent
  // rather than both derived from the same end of one number.
  it('rolls hood and glow independently', () => {
    const seeds = Array.from({ length: 120 }, (_, i) => `agent_${i.toString(36)}`);
    const pairs = new Set(seeds.map((s) => {
      const r = idFor(s);
      return `${r.hood.id}/${r.glow.id}`;
    }));
    // A hood that decided its own glow would give six pairs, not thirty-six.
    expect(pairs.size).toBeGreaterThan(20);
  });

  it('h32 is FNV-1a with an avalanche, and mixes the low bits', () => {
    expect(h32('a', 2166136261)).not.toBe(h32('b', 2166136261));
    // One seed apart in the input must not be one apart in the output.
    expect(Math.abs(h32('a', 2166136261) - h32('b', 2166136261))).toBeGreaterThan(1000);
  });
});

describe('the roster claims the hood', () => {
  // A uniform hash still collides: four drawn from six land on the same one
  // about half the time. "Tellable apart at 40px" is a claim about the OWNER'S
  // ROOM, not about the hash.
  it('four agents always wear four hoods, whatever they rolled', () => {
    const four = ['bal', 'agg', 'val', 'blf'].map((id) => agent(id));
    const ids = identitiesFor(four);
    const hoods = [...ids.values()].map((i) => i.hood.id);
    expect(hoods).toHaveLength(4);
    expect(new Set(hoods).size).toBe(4);
    const glows = [...ids.values()].map((i) => i.glow.id);
    expect(new Set(glows).size).toBe(4);
  });

  // ...and it holds for every roster of four this product can have, not just
  // the one that happened to be handy.
  it('holds for a hundred different households', () => {
    for (let n = 0; n < 100; n += 1) {
      const four = [0, 1, 2, 3].map((k) => agent(`agent_${(n * 4 + k).toString(36)}`));
      const hoods = [...identitiesFor(four).values()].map((i) => i.hood.id);
      expect(new Set(hoods).size, `household ${n}`).toBe(4);
    }
  });

  it('is deterministic in birth order — a hood is claimed once and never moves', () => {
    const four = ['bal', 'agg', 'val', 'blf'].map((id) => agent(id));
    const first = identitiesFor(four);
    const again = identitiesFor(four);
    for (const [id, ident] of first) expect(again.get(id)).toEqual(ident);

    // The man who was there first keeps what he had when somebody moves in.
    const three = identitiesFor(four.slice(0, 3));
    for (const [id, ident] of three) {
      expect(first.get(id).hood.id, `${id} kept his hood`).toBe(ident.hood.id);
    }
  });

  it('gives a man with no id nothing rather than somebody else identity', () => {
    const ids = identitiesFor([{ name: 'nameless' }, agent('a1')]);
    expect(ids.size).toBe(1);
    expect(ids.has('a1')).toBe(true);
  });
});

describe('what the server says', () => {
  // SERVER-5 may store the roll. Until it does, this is null and the roll
  // stands in — and nothing else in the client changes on the day it lands.
  it('reads an identity off the record when there is one', () => {
    const said = identityOf(agent('a1', { identity: { hood: 'moss', glow: 'ice' } }));
    expect(said.hood.id).toBe('moss');
    expect(said.glow.id).toBe('ice');
    expect(said.stored).toBe(true);
  });

  it('takes an object as readily as an id, because a wire format is not settled', () => {
    const said = identityOf(agent('a1', { identity: { hood: { id: 'sand' }, glow: { id: 'lime' } } }));
    expect(said.hood.id).toBe('sand');
    expect(said.glow.id).toBe('lime');
  });

  it('rolls when the server says nothing', () => {
    expect(storedIdentity(agent('a1'))).toBeNull();
    expect(identityOf(agent('a1')).stored).toBe(false);
    expect(identityOf(agent('a1'))).toMatchObject(idFor('a1'));
  });

  // A future server naming a hood this client has never heard of must not draw
  // a body with no hood at all.
  it('falls back to the roll for a half-understood identity', () => {
    const said = identityOf(agent('a1', { identity: { hood: 'burlap', glow: 'ice' } }));
    expect(said.glow.id).toBe('ice');
    expect(said.hood).toEqual(idFor('a1').hood);
    expect(identityOf(agent('a1', { identity: { hood: 'burlap' } }))).toEqual(
      { ...idFor('a1'), stored: false },
    );
  });

  // The server's word is final: a neighbour cannot take a hood the server has
  // given somebody, whatever his own birth order.
  it('the roster honours a stored identity before it claims anything', () => {
    const roster = [agent('a1'), agent('a2', { identity: { hood: 'moss', glow: 'ice' } })];
    const ids = identitiesFor(roster);
    expect(ids.get('a2').hood.id).toBe('moss');
    expect(ids.get('a1').hood.id).not.toBe('moss');
    expect(ids.get('a1').glow.id).not.toBe('ice');
  });
});
