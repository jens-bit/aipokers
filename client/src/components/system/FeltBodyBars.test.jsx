// BodyBars — WATCH-8 job 2, the body on the felt.
//
// "Fatigue is not mood. Mood comes from OUTCOMES and shows in the eyes and the
// aura; fatigue comes from VOLUME and shows in posture and the meter. A
// confident agent can be worn; a tilted agent can be fresh. They never share a
// channel." Two readings, two causes, two colour ranges that cannot be
// confused.
//
// LIFE-1-B: both readings are three dots now, not a continuous fill — the
// three-state word (fatigue) and the three-state cut of heat
// (src/shared/levels.js) are what they always were; only the shape changed.

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BodyBars, BodyDots, Bottle, HEAT_EMBER, HEAT_FIRE, HEAT_WARM,
  STAMINA_FULL, STAMINA_SPENT,
  isDrinking,
} from './FeltBodyBars.jsx';
import { staminaLevel, heatLevel } from '../../../../src/shared/levels.js';

const bars = (props) => render(<BodyBars {...props} />).container;
const row = (c, which) => c.querySelector(`[data-bar="${which}"]`);
const dots = (c, which) => row(c, which)?.querySelectorAll('.body-dots__dot');
const litColors = (c, which) => [...dots(c, which)].filter((d) => d.dataset.lit === 'true').map((d) => d.style.background);
// jsdom normalises an inline hex background to rgb() when read back.
const rgb = (hex) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

describe('the two readings', () => {
  it('are two, each three dots', () => {
    const c = bars({ fatigue: 'settled', heat: 40 });
    expect(c.querySelectorAll('.body-dots')).toHaveLength(2);
    expect(dots(c, 'stamina')).toHaveLength(3);
    expect(dots(c, 'heat')).toHaveLength(3);
  });

  // HOME-2 job 2's three-stages-three-pictures rule, restated in dots: each
  // fatigue stage lights a different number of them, off the shared reading.
  it('lights one, two or three stamina dots, one stage at a time', () => {
    expect(staminaLevel({ stage: 'worn' }).dots).toBe(1);
    expect(staminaLevel({ stage: 'settled' }).dots).toBe(2);
    expect(staminaLevel({ stage: 'fresh' }).dots).toBe(3);

    const litCount = (fatigue) => [...dots(bars({ fatigue }), 'stamina')].filter((d) => d.dataset.lit === 'true').length;
    expect(litCount('worn')).toBe(1);
    expect(litCount('settled')).toBe(2);
    expect(litCount('fresh')).toBe(3);
  });

  it('and the three stages are three different colours', () => {
    const seen = ['fresh', 'settled', 'worn'].map((f) => litColors(bars({ fatigue: f }), 'stamina').at(-1));
    expect(new Set(seen).size).toBe(3);
  });

  it('lights heat dots off the shared three-state cut', () => {
    expect(heatLevel(10).dots).toBe(1);
    expect(heatLevel(50).dots).toBe(2);
    expect(heatLevel(90).dots).toBe(3);

    const litCount = (heat) => [...dots(bars({ heat }), 'heat')].filter((d) => d.dataset.lit === 'true').length;
    expect(litCount(10)).toBe(1);
    expect(litCount(50)).toBe(2);
    expect(litCount(90)).toBe(3);
    // Nothing off the wire can push it past either end.
    expect(litCount(480)).toBe(3);
    expect(litCount(-20)).toBe(1);
  });

  // BUGS-A job 10's separation, kept through the replacement. Two causes must
  // never share a colour: both ramps end in red and the two reds are
  // different ones — the dull blood red of an empty man, the fiery one of a
  // furious one.
  it('the two ramps end in two different reds, and never meet anywhere', () => {
    expect(STAMINA_SPENT).not.toBe(HEAT_FIRE);
    const stamReds = litColors(bars({ fatigue: 'worn' }), 'stamina');
    const heatReds = litColors(bars({ heat: 100 }), 'heat');
    for (const s of stamReds) expect(heatReds).not.toContain(s);
  });

  // A House regular has no agent behind him: no fatigue, no heat. Lighting
  // dots for him would be the felt making something up.
  it('draws only the reading it has data for, and nothing at all with neither', () => {
    expect(row(bars({ heat: 40 }), 'stamina')).toBeNull();
    expect(row(bars({ heat: 40 }), 'heat')).toBeTruthy();
    expect(row(bars({ fatigue: 'worn' }), 'heat')).toBeNull();
    expect(bars({}).querySelector('.felt-bars')).toBeNull();
    expect(bars({ fatigue: null, heat: null }).querySelector('.felt-bars')).toBeNull();
  });

  it('has a seat scale that is the same two readings, at a smaller dot', () => {
    const c = bars({ fatigue: 'fresh', heat: 40, compact: true });
    expect(c.querySelector('.felt-bars').className).toContain('felt-bars--seat');
    expect(c.querySelectorAll('.body-dots')).toHaveLength(2);
  });

  // BUGS-A job 10. Two unlabelled two-pixel lines under a name were a puzzle;
  // LIFE-1-B keeps the same law for the dots that replaced them — a reading
  // says what it is before anybody has to tap it.
  it('says what each reading is, on first render and with no tap', () => {
    const c = bars({ fatigue: 'settled', heat: 40 });
    expect(row(c, 'stamina').querySelector('.body-dots__word').textContent).toBe('STAMINA');
    expect(row(c, 'heat').querySelector('.body-dots__word').textContent).toBe('HEAT');
  });

  it('reveals the word on tap, and puts it back on a second tap', () => {
    const c = bars({ fatigue: 'worn', heat: 40 });
    const button = row(c, 'stamina').querySelector('.body-dots__tap');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.querySelector('.body-dots__word').textContent).toBe('Worn out');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(button.querySelector('.body-dots__word').textContent).toBe('STAMINA');
  });

  it('the seat pill carries no word, tapped or not — 18px has no room for one', () => {
    const c = bars({ fatigue: 'fresh', heat: 40, compact: true });
    expect(c.querySelectorAll('.body-dots__word')).toHaveLength(0);
    expect(c.querySelectorAll('.body-dots__tap')).toHaveLength(0);
    expect(c.querySelector('.felt-bars').className).not.toContain('felt-bars--labelled');
  });

  it('a reading drawn alone still says which one it is', () => {
    expect(bars({ heat: 40 }).querySelector('.body-dots__word').textContent).toBe('HEAT');
    expect(bars({ fatigue: 'worn' }).querySelector('.body-dots__word').textContent).toBe('STAMINA');
  });
});

describe('BodyDots on its own', () => {
  it('renders nothing without a reading', () => {
    const { container } = render(<BodyDots kind="stamina" reading={null} />);
    expect(container.querySelector('.body-dots')).toBeNull();
  });

  it('colours a fresh stamina dot green and a worn one red', () => {
    const { container: fresh } = render(<BodyDots kind="stamina" reading={staminaLevel({ stage: 'fresh' })} />);
    const { container: worn } = render(<BodyDots kind="stamina" reading={staminaLevel({ stage: 'worn' })} />);
    expect([...fresh.querySelectorAll('.body-dots__dot')].at(-1).style.background).toBe(rgb(STAMINA_FULL));
    expect([...worn.querySelectorAll('.body-dots__dot')].at(0).style.background).toBe(rgb(STAMINA_SPENT));
  });

  // ── AGENT-5 job I ────────────────────────────────────────────────────────
  //
  // THE DOT AN OWNER LOOKS AT AFTER FEEDING HIM TWICE.
  //
  // Two snacks from empty is reserve 50, which is over WORN_AT (34) and short
  // of SETTLED_AT (67). The bare thresholds call that "settled in"; the rule
  // the server plays by calls it worn, because staminaStage keeps a worn man
  // worn until he is back to rested. A dot that says SETTLED IN while the
  // deploy door is still shut is the product contradicting itself in the one
  // moment an owner is checking whether the thing he bought worked.
  it('draws a worn dot for a man two snacks into an empty reserve', () => {
    const { container } = render(
      <BodyDots kind="stamina" reading={staminaLevel({ value: 50, was: 'worn' })} />,
    );
    const lit = [...container.querySelectorAll('.body-dots__dot')]
      .filter((d) => d.style.background && d.style.background !== 'transparent');
    expect(lit.length).toBe(1);
    expect(lit[0].style.background).toBe(rgb(STAMINA_SPENT));
    expect(staminaLevel({ value: 50, was: 'worn' }).label).toBe('Worn out');
  });

  it('and the stage still wins when the projection carries one', () => {
    // Which it always does — presentAgent sends `stage` alongside the number.
    // This is the belt to that brace: a value-only caller now gets the same
    // answer the server would have given.
    const byWord = staminaLevel({ stage: 'worn', value: 50 });
    const byNumber = staminaLevel({ value: 50, was: 'worn' });
    expect(byNumber.level).toBe(byWord.level);
    expect(byNumber.dots).toBe(byWord.dots);
  });

  it('colours a level heat dot as an ember and a steaming one fire', () => {
    const { container: cool } = render(<BodyDots kind="heat" reading={heatLevel(10)} />);
    const { container: hot } = render(<BodyDots kind="heat" reading={heatLevel(90)} />);
    expect([...cool.querySelectorAll('.body-dots__dot')].at(0).style.background).toBe(rgb(HEAT_EMBER));
    expect([...hot.querySelectorAll('.body-dots__dot')].at(-1).style.background).toBe(rgb(HEAT_FIRE));
    const { container: mid } = render(<BodyDots kind="heat" reading={heatLevel(50)} />);
    expect([...mid.querySelectorAll('.body-dots__dot')].at(1).style.background).toBe(rgb(HEAT_WARM));
  });

  it('says which reading it is in its accessible name', () => {
    const { getByRole } = render(<BodyDots kind="heat" reading={heatLevel(50)} />);
    expect(getByRole('button').getAttribute('aria-label')).toBe('Heat: Simmering');
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
