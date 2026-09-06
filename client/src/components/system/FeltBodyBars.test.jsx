// BodyBars — WATCH-8 job 2, the body on the felt.
//
// "Fatigue is not mood. Mood comes from OUTCOMES and shows in the eyes and the
// aura; fatigue comes from VOLUME and shows in posture and the meter. A
// confident agent can be worn; a tilted agent can be fresh. They never share a
// channel." Two bars, two causes, two colour ranges that cannot be confused.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BodyBars, Bottle, HEAT_COLD, HEAT_HOT, HEAT_WARM, STAMINA_FULL, STAMINA_SPENT,
  heatColor, isDrinking, staminaColor, staminaOf,
} from './FeltBodyBars.jsx';

const bars = (props) => render(<BodyBars {...props} />).container;
const track = (c, which) => c.querySelector(`[data-bar="${which}"]`);
const fill = (c, which) => track(c, which)?.querySelector('.body-bars__fill');

describe('the two bars', () => {
  it('are two, and each is two pixels', () => {
    const c = bars({ fatigue: 'settled', heat: 40 });
    expect(c.querySelectorAll('.body-bars__track')).toHaveLength(2);
    // jsdom computes no stylesheet height here, so the rule is the assertion —
    // asserted where the rule lives, in watchBody.test.jsx.
    expect(track(c, 'stamina')).toBeTruthy();
    expect(track(c, 'heat')).toBeTruthy();
  });

  // The same 3 / 2 / 1 the block meter already uses, so two readings of fatigue
  // on two surfaces cannot disagree.
  it('reads stamina off fatigue, in the meter\'s own thirds', () => {
    expect(staminaOf('fresh')).toBe(1);
    expect(staminaOf('settled')).toBeCloseTo(2 / 3);
    expect(staminaOf('worn')).toBeCloseTo(1 / 3);
    expect(staminaOf(undefined)).toBeNull();
    expect(staminaOf('nonsense')).toBeNull();

    expect(fill(bars({ fatigue: 'fresh' }), 'stamina').style.width).toBe('100%');
    expect(fill(bars({ fatigue: 'worn' }), 'stamina').style.width)
      .toMatch(/^33\.33/);
  });

  it('fills heat from 0 to 100', () => {
    expect(fill(bars({ heat: 0 }), 'heat').style.width).toBe('0%');
    expect(fill(bars({ heat: 62 }), 'heat').style.width).toBe('62%');
    expect(fill(bars({ heat: 100 }), 'heat').style.width).toBe('100%');
    // Nothing off the wire can push it past either end.
    expect(fill(bars({ heat: 480 }), 'heat').style.width).toBe('100%');
    expect(fill(bars({ heat: -20 }), 'heat').style.width).toBe('0%');
  });

  // Green means tiredness and red means heat, at both ends and nowhere in
  // between: an owner must never have to work out which cause a colour is for.
  it('runs green to grey and teal to red, and the two never meet', () => {
    expect(staminaColor(1).toUpperCase()).toBe(STAMINA_FULL);
    expect(staminaColor(0).toUpperCase()).toBe(STAMINA_SPENT);
    expect(heatColor(0).toUpperCase()).toBe(HEAT_COLD);
    expect(heatColor(100).toUpperCase()).toBe(HEAT_HOT);

    const stam = [0, 0.5, 1].map((v) => staminaColor(v).toUpperCase());
    const hot = [0, 25, 50, 75, 100].map((h) => heatColor(h).toUpperCase());
    for (const s of stam) expect(hot).not.toContain(s);
  });

  // Straight across, teal and red meet at khaki — a midpoint that reads as
  // neither end and as no state the system has a name for. Gold is already the
  // warning colour on this screen and it is the heat bands' own middle.
  it('passes through gold rather than through mud', () => {
    expect(heatColor(50).toUpperCase()).toBe(HEAT_WARM);
    // Every step is more red than the one before it, and none of them is grey.
    const reds = [0, 25, 50, 75, 100].map((h) => parseInt(heatColor(h).slice(1, 3), 16));
    for (let i = 1; i < reds.length; i++) expect(reds[i]).toBeGreaterThan(reds[i - 1]);
    for (const h of [25, 50, 75]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(heatColor(h).slice(i, i + 2), 16));
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(40);
    }
  });

  // A House regular has no agent behind him: no fatigue, no heat. Drawing a
  // full green line for him would be the felt making something up.
  it('draws only the bar it has data for, and nothing at all with neither', () => {
    expect(track(bars({ heat: 40 }), 'stamina')).toBeNull();
    expect(track(bars({ heat: 40 }), 'heat')).toBeTruthy();
    expect(track(bars({ fatigue: 'worn' }), 'heat')).toBeNull();
    expect(bars({}).querySelector('.body-bars')).toBeNull();
    expect(bars({ fatigue: null, heat: null }).querySelector('.body-bars')).toBeNull();
  });

  it('has a seat scale that is the same two bars', () => {
    const c = bars({ fatigue: 'fresh', heat: 40, compact: true });
    expect(c.querySelector('.body-bars').className).toContain('body-bars--seat');
    expect(c.querySelectorAll('.body-bars__track')).toHaveLength(2);
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
