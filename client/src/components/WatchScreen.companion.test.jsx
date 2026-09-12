import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import { WatchScreen } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { playingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [{ ...playingAgent, chatHistory: [{ role: 'user', content: 'Remember the river?' }, { role: 'assistant', content: 'I remember the river.' }] }] });
  fetchMock.route('/thread', { lines: [{ kind: 'opponent', text: 'Opponent table talk' }] });
});
const props = { game: midHandGame, mySeat: 0, config: spectatorConfig, privateChatInPlace: true };

it('BUG-143: private history, draft and replies survive closing the in-game panel', async () => {
  const user = userEvent.setup(), leave = vi.fn();
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I will be patient.' }] });
  const { container } = render(<WatchScreen {...props} onLeave={leave}/>);
  const table = container.querySelector('.watch-felt');
  const composer = await screen.findByPlaceholderText('Whisper to him…');
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  const sheet = await screen.findByRole('dialog', { name: 'The Grinder at the table' });
  expect(await within(sheet).findByText('I remember the river.')).toBeVisible();
  expect(within(sheet).queryByText('Opponent table talk')).toBeNull();
  await user.type(composer, 'Be patient');
  await user.click(screen.getByRole('button', { name: 'Back to table' }));
  expect(composer).toHaveValue('Be patient');
  await user.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  expect(await screen.findByText('I will be patient.')).toBeVisible();
  expect(screen.getAllByText('I remember the river.')).toHaveLength(1);
  expect(container.querySelector('.watch-felt')).toBe(table);
  expect(leave).not.toHaveBeenCalled();
});

it('BUG-143: a public watcher receives no private agent panel or writable whisper', async () => {
  const user = userEvent.setup();
  render(<WatchScreen {...props} config={{ ...spectatorConfig, agentId: null }} onLeave={() => {}}/>);
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  expect(screen.queryByRole('dialog', { name: /at the table$/ })).toBeNull();
  expect(screen.getByPlaceholderText('Whisper to him…')).toBeDisabled();
});
