// BodyBars — WATCH-8 job 2, the body on the felt.
//
// "Fatigue is not mood. Mood comes from OUTCOMES and shows in the eyes and the
// aura; fatigue comes from VOLUME and shows in posture and the meter. A
// confident agent can be worn; a tilted agent can be fresh. They never share a
// channel." Two bars, two causes, two colour ranges that cannot be confused.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BodyBars, Bottle, HEAT_EMBER, HEAT_FIRE, HEAT_HOT, HEAT_WARM,
  STAMINA_AMBER, STAMINA_FULL, STAMINA_LOW, STAMINA_SPENT,
  heatColor, isDrinking, staminaColor, staminaOf, staminaPct,
} from './FeltBodyBars.jsx';

const bars = (props) => render(<BodyBars {...props} />).container;
const track = (c, which) => c.querySelector(`[data-bar="${which}"]`);
const fill = (c, which) => track(c, which)?.querySelector('.felt-bars__fill');

describe('the two bars', () => {
  it('are two, and each is two pixels', () => {
    const c = bars({ fatigue: 'settled', heat: 40 });
    expect(c.querySelectorAll('.felt-bars__track')).toHaveLength(2);
    // jsdom computes no stylesheet height here, so the rule is the assertion —
    // asserted where the rule lives, in watchBody.test.jsx.
    expect(track(c, 'stamina')).toBeTruthy();
    expect(track(c, 'heat')).toBeTruthy();
  });

  // HOME-2 job 2 · THREE STAGES, THREE PICTURES.
  //
  // The thirds this replaces (1 / 2/3 / 1/3) were arithmetic rather than a
  // reading, and against the ref's step ramp they broke: fresh at 100 and
  // settled at 67 are BOTH above the green threshold, so two of the three
  // stages drew the same bar in the same colour. Each stage lands in a band of
  // its own now — the whole bar in green, half of it in amber, and the short
  // red stub the ref describes.
  it('reads stamina off fatigue, one band per stage', () => {
    expect(staminaOf('fresh')).toBe(1);
    expect(staminaOf('settled')).toBeCloseTo(0.52);
    expect(staminaOf('worn')).toBeCloseTo(0.16);
    expect(staminaOf(undefined)).toBeNull();
    expect(staminaOf('nonsense')).toBeNull();

    expect(fill(bars({ fatigue: 'fresh' }), 'stamina').style.width).toBe('100%');
    expect(fill(bars({ fatigue: 'settled' }), 'stamina').style.width).toBe('52%');
    expect(fill(bars({ fatigue: 'worn' }), 'stamina').style.width).toBe('16%');
  });

  it('and the three stages are three different colours', () => {
    const seen = ['fresh', 'settled', 'worn'].map((f) => staminaColor(staminaOf(f)).toUpperCase());
    expect(seen).toEqual([STAMINA_FULL, STAMINA_AMBER, STAMINA_SPENT]);
    expect(new Set(seen).size).toBe(3);
  });

  it('fills heat from 0 to 100', () => {
    expect(fill(bars({ heat: 0 }), 'heat').style.width).toBe('0%');
    expect(fill(bars({ heat: 62 }), 'heat').style.width).toBe('62%');
    expect(fill(bars({ heat: 100 }), 'heat').style.width).toBe('100%');
    // Nothing off the wire can push it past either end.
    expect(fill(bars({ heat: 480 }), 'heat').style.width).toBe('100%');
    expect(fill(bars({ heat: -20 }), 'heat').style.width).toBe('0%');
  });

  // HOME-2 job 2 · the ref's two step functions, verbatim. Stamina runs green
  // → amber → red as it SHORTENS; heat runs ember → red as it GROWS. Both are
  // taken from design-refs/mood-home.jsx and this is the assertion that they
  // were taken rather than approximated.
  it('is the ref own ramp, step for step', () => {
    expect([100, 61, 60, 36, 35, 19, 18, 0].map((v) => staminaPct(v).toUpperCase()))
      .toEqual([
        STAMINA_FULL, STAMINA_FULL, STAMINA_AMBER, STAMINA_AMBER,
        STAMINA_LOW, STAMINA_LOW, STAMINA_SPENT, STAMINA_SPENT,
      ]);
    expect([0, 29, 30, 54, 55, 79, 80, 100].map((h) => heatColor(h).toUpperCase()))
      .toEqual([
        HEAT_EMBER, HEAT_EMBER, HEAT_WARM, HEAT_WARM,
        HEAT_HOT, HEAT_HOT, HEAT_FIRE, HEAT_FIRE,
      ]);
  });

  // BUGS-A job 10's separation, kept through the replacement. Two causes must
  // never share a colour: both ramps end in red and the two reds are different
  // ones — the dull blood red of an empty man, the fiery one of a furious one.
  it('the two ramps end in two different reds, and never meet anywhere', () => {
    expect(STAMINA_SPENT).not.toBe(HEAT_FIRE);
    const stam = [0, 20, 40, 60, 80, 100].map((v) => staminaPct(v).toUpperCase());
    const hot = [0, 20, 40, 60, 80, 100].map((h) => heatColor(h).toUpperCase());
    for (const s of stam) expect(hot).not.toContain(s);
  });

  // Heat's empty end is NOTHING, not a good reading. Teal there said "he is
  // fine"; an ember says "there is barely anything to read", which is what an
  // accumulation at zero actually is.
  it('never touches green — an unbothered agent is an ember, not a teal', () => {
    for (const h of [0, 10, 29, 50, 100]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(heatColor(h).slice(i, i + 2), 16));
      expect(r, `heat ${h} is warmer than it is green`).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
    // The ref's four stops are not a monotonic climb in any one channel — they
    // are four chosen colours — so what is asserted is the two ENDS and the
    // family, not an ordering the ref never claimed.
    expect(heatColor(0).toUpperCase()).toBe(HEAT_EMBER);
    expect(heatColor(100).toUpperCase()).toBe(HEAT_FIRE);
  });

  // A House regular has no agent behind him: no fatigue, no heat. Drawing a
  // full green line for him would be the felt making something up.
  it('draws only the bar it has data for, and nothing at all with neither', () => {
    expect(track(bars({ heat: 40 }), 'stamina')).toBeNull();
    expect(track(bars({ heat: 40 }), 'heat')).toBeTruthy();
    expect(track(bars({ fatigue: 'worn' }), 'heat')).toBeNull();
    expect(bars({}).querySelector('.felt-bars')).toBeNull();
    expect(bars({ fatigue: null, heat: null }).querySelector('.felt-bars')).toBeNull();
  });

  it('has a seat scale that is the same two bars', () => {
    const c = bars({ fatigue: 'fresh', heat: 40, compact: true });
    expect(c.querySelector('.felt-bars').className).toContain('felt-bars--seat');
    expect(c.querySelectorAll('.felt-bars__track')).toHaveLength(2);
  });

  // BUGS-A job 10. Two unlabelled two-pixel lines under a name are a puzzle;
  // the first thing anybody asked of them was which was which.
  it('says what each line is, on first render and with no tap', () => {
    const c = bars({ fatigue: 'settled', heat: 40 });
    expect(track(c, 'stamina').querySelector('.felt-bars__label').textContent).toBe('STAMINA');
    expect(track(c, 'heat').querySelector('.felt-bars__label').textContent).toBe('HEAT');
    // The label is UNDER its own rule, which is what ties one to the other.
    const row = track(c, 'stamina');
    const bar = row.querySelector('.felt-bars__track');
    const label = row.querySelector('.felt-bars__label');
    expect(bar.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the seat pill carries none — 18px has no room for a word', () => {
    const c = bars({ fatigue: 'fresh', heat: 40, compact: true });
    expect(c.querySelectorAll('.felt-bars__label')).toHaveLength(0);
    expect(c.querySelector('.felt-bars').className).not.toContain('felt-bars--labelled');
  });

  it('a bar that is drawn alone still says which one it is', () => {
    expect(bars({ heat: 40 }).querySelector('.felt-bars__label').textContent).toBe('HEAT');
    expect(bars({ fatigue: 'worn' }).querySelector('.felt-bars__label').textContent).toBe('STAMINA');
  });
});

// FRIDGE-1 may land later. Until it does the field is simply absent, and the
// felt has to render exactly what it renders today.
describe('the bottle', () => {
  it('is drawn only on a seat that says, in so many words, that it is drinking', () => {
    expect(isDrinking({ drinking: true })).toBe(true);
    expect(isDrinking({ drinking: false })).toBe(false);
    expect(isDrinking({})).toBe(false);
    expect(isDrinking(null)).toBe(false);
    expect(isDrinking(undefined)).toBe(false);
    // Not a truthy value — the field, exactly.
    expect(isDrinking({ drinking: 1 })).toBe(false);
    expect(isDrinking({ drinking: 'yes' })).toBe(false);
  });

  it('is a silhouette, not a label', () => {
    const { container } = render(<Bottle size={11} />);
    const svg = container.querySelector('svg.bottle');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('text')).toBeNull();
    expect(Number(svg.getAttribute('height'))).toBe(11);
  });
});
