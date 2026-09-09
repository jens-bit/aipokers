import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeOne, NamePill } from './atoms.jsx';
import { identityOf } from '../../lib/identity.js';
import '../../styles/home1.css';

it.each(['#3FB6A8','#C9A227','#D2632F','#8B6BC4','#7FA8C9','#8FB03F'])('BUG-166: the Home name stays authored neutral text with %s identity glow', accent => {
  const {container}=render(<NamePill name="Professor" nickname="Prof" accent={accent} fatigue="fresh" heat={58}/>);
  const name=container.querySelector('.home-pill__name');
  expect(getComputedStyle(name).color).toBe('rgb(237, 237, 237)');
  expect(name).toHaveTextContent('Prof');
  expect(container.querySelector('[data-bar="stamina"] i').style.width).toBe('100%');
  expect(container.querySelector('[data-bar="heat"] i').style.width).toBe('58%');
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
  expect(getComputedStyle(container.querySelector('.home-pill__bar')).width).toBe('44px');
});
