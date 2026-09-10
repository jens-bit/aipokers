import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeMoodAvatar } from './HomeMoodAvatar.jsx';
import { identitiesFor } from '../../lib/identity.js';
import { fetchMock } from '../../test/harness.js';

const agent = { id: 'saved', name: 'Professor', identity: { hood: 'indigo', glow: 'violet' }, mood: { state: 'neutral' } };
const identity = identitiesFor([agent]).get(agent.id);

it('BUG-189: the extracted home avatar preserves identity and geometry while current mood changes', () => {
  const { container, rerender } = render(<HomeMoodAvatar agent={agent} identity={identity} />);
  for (const [state, glyph, color] of [
    ['neutral', '–', '#BDBDC1'], ['confident', '▲', '#00D4AA'], ['frustrated', '!', '#CDB380'],
    ['tilted', '⚡', '#FF4D4F'], ['sulking', '▾', '#9E9EA2'], ['unknown', '–', '#BDBDC1'],
  ]) {
    rerender(<HomeMoodAvatar agent={{ ...agent, mood: { state } }} identity={identity} />);
    const avatar = container.querySelector('.home-mood-avatar');
    expect(avatar).toHaveAttribute('data-agent-id', 'saved');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(avatar.querySelector('svg')).toHaveAttribute('data-hood', 'indigo');
    expect(avatar.querySelector('svg')).toHaveAttribute('width', '18.8');
    expect(avatar.querySelector('svg')).toContainHTML('fill="#8B6BC4"');
    expect(avatar.querySelector('.home-mood-avatar__pip')).toHaveTextContent(glyph);
    expect(avatar.querySelector('.home-mood-avatar__pip')).toHaveStyle({ color });
  }
  expect(fetchMock.requests).toHaveLength(0);
});

it.each([null, {}, { hood: identity.hood }, { glow: identity.glow }])('BUG-189: missing supplied identity renders no fabricated home avatar (%j)', missing => {
  const { container } = render(<HomeMoodAvatar agent={agent} identity={missing} />);
  expect(container).toBeEmptyDOMElement();
  expect(fetchMock.requests).toHaveLength(0);
});

it('BUG-189: extraction preserves the existing footer selectors without giving them identity logic', () => {
  const { container } = render(<HomeMoodAvatar agent={agent} identity={identity} className="home-thread__avatar" />);
  expect(container.querySelector('.home-thread__avatar')).toHaveClass('home-mood-avatar');
  expect(container.querySelector('.home-thread__mood')).toHaveTextContent('–');
  expect(container.querySelector('.home-thread__avatar-tile svg')).toHaveAttribute('data-hood', 'indigo');
});
