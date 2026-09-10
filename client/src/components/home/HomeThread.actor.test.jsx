import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { HomeThread } from './HomeThread.jsx';
import { identitiesFor } from '../../lib/identity.js';
import { fetchMock } from '../../test/harness.js';

const granite = { id: 'gran', name: 'Granite', mood: { state: 'neutral', heat: 30 },
  identity: { hood: 'sand', glow: 'gold' }, opener: 'No need to rush.' };
const visitor = { id: 'guest', name: 'Professor', guest: true, mood: { state: 'sulking', heat: 61 },
  identity: { hood: 'indigo', glow: 'violet' } };
const line = (from = 'guest', over = {}) => ({ id: 1, ts: 1, kind: 'him', from, who: 'Professor',
  text: 'Let this one go.', source: 'home', ...over });
function roomProps(agents = [granite, visitor], over = {}) {
  return { roomMode: true, agent: granite, agents, identities: identitiesFor(agents), ...over };
}
function avatar() { return screen.getByTestId('home-thread-line').querySelector('.home-thread__avatar'); }
function assertActor(id, hood, glow) {
  expect(avatar()).toHaveAttribute('data-agent-id', id);
  expect(avatar().querySelector('svg')).toHaveAttribute('data-hood', hood);
  expect(avatar().querySelector('svg')).toContainHTML(`fill="${glow}"`);
}

it('BUG-184: the latest room sentence uses its exact visitor identity, six-character name and full accessible name', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [line()] });
  render(<HomeThread {...roomProps()} />);
  const band = await screen.findByRole('button', { name: 'Professor Let this one go.' });
  assertActor('guest', 'indigo', '#8B6BC4');
  expect(band.querySelector('.home-thread__who')).toHaveTextContent(/^Profes$/);
  expect(avatar().querySelector('.home-thread__mood')).toHaveTextContent('▾');
  expect(avatar().querySelector('svg')).toHaveAttribute('data-mood', 'sulking');
  expect(fetchMock.requests.map(r => r.url.split('?')[0])).toEqual(['/api/home/thread']);
});

it('BUG-184: unread recap and fallback opener carry their own actor with the selected sentence', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [line()] });
  const recap = { ...granite, unseenRecap: true, sessionRecap: { text: 'A quiet night.' } };
  const { rerender } = render(<HomeThread {...roomProps([recap, visitor], { agent: recap })} open />);
  await screen.findByText(/Let this one go\./);
  expect(screen.getByRole('button', { name: 'Granite A quiet night.' })).toBeVisible();
  expect(screen.getByTestId('home-thread-line').querySelector('.home-thread__who')).toHaveTextContent(/^Granit$/);
  assertActor('gran', 'sand', '#C9A227');
  rerender(<HomeThread {...roomProps([recap, visitor], { agent: recap, roomPushed: [line('guest', { id: 2, sessionId: 'today', ts: 2 })] })} open />);
  expect(screen.getByRole('button', { name: 'Granite A quiet night.' })).toBeVisible();
  assertActor('gran', 'sand', '#C9A227');
});

it('BUG-184: a focused served opener keeps its saved identity without a row or invented message', async () => {
  fetchMock.route('/thread', { lines: [] });
  render(<HomeThread {...roomProps()} />);
  expect(await screen.findByRole('button', { name: 'Granite No need to rush.' })).toBeVisible();
  assertActor('gran', 'sand', '#C9A227');
});

it('BUG-184: current mood changes the pip while the same speaker keeps its saved hood and eye color', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [line()] });
  const { rerender } = render(<HomeThread {...roomProps()} />);
  await screen.findByText('Let this one go.');
  for (const [state, glyph, color] of [
    ['confident', '▲', '#00D4AA'], ['neutral', '–', '#BDBDC1'],
    ['frustrated', '!', '#CDB380'], ['tilted', '⚡', '#FF4D4F'],
    ['sulking', '▾', '#9E9EA2'], ['unknown', '–', '#BDBDC1'],
  ]) {
    rerender(<HomeThread {...roomProps([granite, { ...visitor, mood: { state } }])} />);
    assertActor('guest', 'indigo', '#8B6BC4');
    expect(avatar().querySelector('.home-thread__mood')).toHaveTextContent(glyph);
    expect(avatar().querySelector('.home-thread__mood')).toHaveStyle({ color });
    expect(screen.getByTestId('home-thread-line')).toHaveAccessibleName('Professor Let this one go.');
  }
  expect(fetchMock.requests).toHaveLength(1);
});

it.each([
  ['owner', line('owner', { kind: 'you', who: 'Professor', agentId: 'guest' }), 'YOU'],
  ['system', line('guest', { kind: 'table', who: 'TABLE' }), 'TABLE'],
  ['unknown', line('departed'), 'Professor'],
  ['legacy missing actor', line(undefined, { from: null }), 'Professor'],
  ['human named YOU', line('human-4242', { kind: 'opponent', who: 'YOU' }), 'YOU'],
])('BUG-184: %s preserves the served line without borrowing the focused or filing identity', async (_label, row, who) => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [row] });
  render(<HomeThread {...roomProps()} />);
  await screen.findByText(row.text);
  expect(avatar()).toBeNull();
  expect(screen.getByTestId('home-thread-line').querySelector('.home-thread__who')).toHaveTextContent(who);
});

it('BUG-184: a pending owner send hides the prior avatar, then failure restores the served actor and draft', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [line()] });
  let answer;
  fetchMock.route('/api/home/say', () => new Promise(resolve => { answer = resolve; }), { method: 'POST' });
  render(<HomeThread {...roomProps()} />);
  await screen.findByText('Let this one go.');
  assertActor('guest', 'indigo', '#8B6BC4');
  await userEvent.type(screen.getByTestId('home-thread-input'), 'My decision.');
  await userEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('YOU');
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('My decision.');
  expect(avatar()).toBeNull();
  await act(async () => answer({ status: 503, body: {} }));
  await waitFor(() => expect(screen.getByTestId('home-thread-input')).toHaveValue('My decision.'));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
  assertActor('guest', 'indigo', '#8B6BC4');
  expect(fetchMock.posts).toHaveLength(1);
});

it.each(['Granite', 'YOU', 'TABLE'])('BUG-184: duplicate or reserved display name %s cannot substitute another actor', async name => {
  const second = { ...visitor, name };
  fetchMock.route('/thread', { sessionId: 'today', lines: [line('guest', { who: name })] });
  render(<HomeThread {...roomProps([granite, second])} />);
  await screen.findByText('Let this one go.');
  assertActor('guest', 'indigo', '#8B6BC4');
  expect(screen.getByTestId('home-thread-line')).toHaveAccessibleName(`${name} Let this one go.`);
});

it('BUG-184: an overheard first sentence uses the first nested speaker while expanded row presentation stays unchanged', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [
    line('guest', { id: 1, text: 'Earlier words.' }),
    { id: 2, ts: 2, kind: 'overheard', who: 'Professor', text: 'The first voice.', lines: [
      { from: 'guest', who: 'Professor', text: 'The first voice.' },
      { from: 'gran', who: 'Granite', text: 'The answer.' },
    ] },
  ] });
  render(<HomeThread {...roomProps()} open />);
  await screen.findByText('“Earlier words.”');
  assertActor('guest', 'indigo', '#8B6BC4');
  expect(screen.getByRole('button', { name: 'Professor The first voice.' })).toBeVisible();
  expect(screen.getByText('“Earlier words.”').closest('.thread-row')).toHaveClass('thread-row--them');
});

it('BUG-184: pushed speaker changes use the roster map without fetching identities or relabeling served text on departure', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [line()] });
  const { rerender } = render(<HomeThread {...roomProps()} />);
  await screen.findByText('Let this one go.');
  assertActor('guest', 'indigo', '#8B6BC4');
  const pushed = [line('gran', { id: 2, ts: 2, sessionId: 'today', who: 'Granite', text: 'Now my turn.' })];
  rerender(<HomeThread {...roomProps(undefined, { roomPushed: pushed })} />);
  expect(screen.getByRole('button', { name: 'Granite Now my turn.' })).toBeVisible();
  assertActor('gran', 'sand', '#C9A227');
  rerender(<HomeThread {...roomProps([visitor], { agent: visitor, roomPushed: pushed })} />);
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Granite Now my turn.');
  expect(avatar()).toBeNull();
  expect(fetchMock.requests).toHaveLength(1);
});

it('BUG-184: private Casino keeps its current label, expanded history and avatar-free layout', async () => {
  fetchMock.route('/thread', { lines: [line()] });
  render(<HomeThread {...roomProps(undefined, { roomMode: false })} open />);
  await waitFor(() => expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Let this one go.'));
  expect(screen.getByTestId('home-thread-line').querySelector('.home-thread__who')).toHaveTextContent(/^Granite$/);
  expect(screen.getByTestId('home-thread')).not.toHaveClass('home-thread--room');
  expect(avatar()).toBeNull();
});
