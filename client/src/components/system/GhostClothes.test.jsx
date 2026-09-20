import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MoodGhost } from './MoodGhost.jsx';
import { HOODS } from '../../lib/identity.js';
it('BUG-277: removable items overlay the same birth cloth and eye colour and can all be removed', () => {
  const hood = HOODS[2], equipment = { head: 'rail-cap', face: 'round-glasses', neck: 'knit-scarf' };
  const view = render(<MoodGhost hood={hood} glow="#DDAA22" equipment={equipment} hands="rest" />);
  expect(view.container.querySelector('.mood-ghost')).toHaveAttribute('data-hood', hood.id);
  expect([...view.container.querySelectorAll('[data-item]')].map(node => node.dataset.item)).toEqual(Object.values(equipment));
  expect(view.container.querySelector('linearGradient stop')).toHaveAttribute('stop-color', hood.top);
  const face = view.container.querySelector('ellipse[fill="#04070C"]');
  view.rerender(<MoodGhost hood={hood} glow="#DDAA22" equipment={{ head: null, face: null, neck: null }} hands="rest" />);
  expect(view.container.querySelectorAll('[data-item]')).toHaveLength(0);
  expect(view.container.querySelector('ellipse[fill="#04070C"]')).toBe(face);
  expect(view.container.querySelector('linearGradient stop')).toHaveAttribute('stop-color', hood.top);
});

it('BUG-277: a tilted clothed companion keeps his permanent eye pigment at maximum heat', () => {
  const view = render(<MoodGhost hood={HOODS[2]} glow="#C9A227" mood="tilted" heat={100}
    equipment={{ head: 'rail-cap', face: 'round-glasses', neck: null }}/>);
  const face = view.container.querySelector('[data-face="tilted"]');
  expect(face.querySelector('rect')).toHaveAttribute('fill', '#C9A227');
  expect(view.container.querySelector('linearGradient stop')).toHaveAttribute('stop-color', HOODS[2].top);
});
