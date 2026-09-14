import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeOne, NamePill } from './atoms.jsx';
import { identityOf } from '../../lib/identity.js';
import '../../styles/home1.css';

const litDots = (c, which) => [...c.querySelectorAll(`[data-bar="${which}"] .body-dots__dot`)]
  .filter((d) => d.dataset.lit === 'true').length;

it.each(['#3FB6A8','#C9A227','#D2632F','#8B6BC4','#7FA8C9','#8FB03F'])('BUG-166: the Home name stays authored neutral text with %s identity glow', accent => {
  const {container}=render(<NamePill name="Professor" nickname="Prof" accent={accent} fatigue="fresh" heat={58}/>);
  const name=container.querySelector('.home-pill__name');
  // The shared palette now changes by time of day; identity glow must still
  // never replace the neutral, readable name foreground.
  expect(getComputedStyle(name).color).toBe('var(--text-primary)');
  expect(name).toHaveTextContent('Prof');
  // LIFE-1-B: three dots, not a continuous fill — fresh is all three lit,
  // heat 58 is 'simmering' (src/shared/levels.js's cut at 40/60), two lit.
  expect(litDots(container, 'stamina')).toBe(3);
  expect(litDots(container, 'heat')).toBe(2);
});

it('BUG-166: neutral text leaves the saved hood/glow and compact room body intact', () => {
  const agent={id:'pill-owner',name:'Professor',nickname:'Prof',identity:{hood:'indigo',glow:'violet'},mood:{state:'neutral',heat:58},fatigue:'fresh',routine:{key:'reads'}};
  const identity=identityOf(agent);
  const {container}=render(<HomeOne agent={agent} identity={identity} at={{x:132,y:404}} size={46}/>);
  expect(screen.getByRole('button',{name:'Professor — reading'})).toBeInTheDocument();
  expect(container.querySelector('.mood-ghost')).toHaveAttribute('data-hood','indigo');
  expect(container.querySelector('stop[stop-color="#4A2E78"]')).not.toBeNull();
  expect(container.querySelector('stop[stop-color="#8B6BC4"]')).not.toBeNull();
  expect(container.querySelector('.home-one__body').style.width).toBe('46px');
  expect(container.querySelector('.home-pill__name').textContent.length).toBeLessThanOrEqual(6);
  expect(container.querySelectorAll('[data-bar] .body-dots__dot')).toHaveLength(6);
});

// LIFE-1-B: "the word shown on tap" applies to the room pill too — it is not
// a smaller copy of the felt's seat-scale dots (which carry no word at all).
it('BUG-166: taps reveal the reading, same as the felt and the profile card', () => {
  const { container } = render(<NamePill name="Professor" fatigue="worn" heat={8} />);
  const staminaTap = container.querySelector('[data-bar="stamina"] .body-dots__tap');
  const heatTap = container.querySelector('[data-bar="heat"] .body-dots__tap');
  expect(staminaTap).toBeTruthy();
  expect(heatTap).toBeTruthy();
  fireEvent.click(staminaTap);
  expect(staminaTap).toHaveTextContent('Worn out');
  fireEvent.click(heatTap);
  expect(heatTap).toHaveTextContent('Level');
});
