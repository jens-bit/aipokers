import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DesktopHome } from './DesktopHome.jsx';
import { restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';

const oak = { ...restingAgent, id: 'oak', name: 'Professor Oak', location: { where: 'casino' }, liveGame: null,
  chatHistory: [{ role: 'user', content: 'Keep that earlier read.' }, { role: 'assistant', content: 'The earlier read is saved.' }] };
const plum = { ...oak, id: 'plum', name: 'Professor Plum', chatHistory: [] };
function mount(props = {}) {
  const watch = vi.fn();
  render(<DesktopHome onWatchAgent={watch} onDeployAgent={vi.fn()} onCreateAgent={vi.fn()} {...props}/>);
  return watch;
}
beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [oak, plum] });
  fetchMock.route('/hands', { recentHands: [] });
});

// BUG-201: these five cases used to assert that "Open him" landed straight on
// the numbers Profile, with Chat one tap deeper via "Back to chat"/"CHAT".
// Jens's playtest instruction was explicit that this was the bug: "Open him"
// now opens his agent view (the room, board 42 C1) directly, and Profile is
// the one further tap, from AgentView's own PROFILE button. Rewritten in that
// order rather than loosened — every navigation, identity and state-retention
// assertion these five made still holds, just with the two screens swapped.
it.each([false, true])('BUG-201: Open him selects his agent view by id, including an owned visitor (%s)', async visiting => {
  const selected = visiting ? { ...oak, visiting: { hostName: 'Jens' }, location: { where: 'visiting' } } : oak;
  fetchMock.route('/api/agents', { agents: [selected, plum] });
  const watch = mount();
  await userEvent.click(await screen.findByTestId('home-frame-oak'));
  const room = await screen.findByRole('region', { name: "Professor Oak's room", exact: true });
  expect(within(room).getByText('The earlier read is saved.', { exact: true, selector: '.agent-view__line .agent-view__text' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: "Professor Plum's room" })).toBeNull();
  expect(watch).not.toHaveBeenCalled();
  await userEvent.type(within(room).getByRole('textbox'), 'Keep this unsent draft');
  await userEvent.click(within(room).getByRole('button', { name: 'Profile', exact: true }));
  const profile = await screen.findByRole('region', { name: "Professor Oak's profile" });
  expect(within(profile).getByText('Professor Oak', { exact: true })).toBeInTheDocument();
  await userEvent.click(within(profile).getByRole('button', { name: 'Back to chat' }));
  expect(within(await screen.findByRole('region', { name: "Professor Oak's room" })).getByRole('textbox')).toHaveValue('Keep this unsent draft');
  await userEvent.click(screen.getByTestId('home-frame-plum'));
  expect(await screen.findByRole('region', { name: "Professor Plum's room" })).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('home-frame-oak'));
  expect(within(await screen.findByRole('region', { name: "Professor Oak's room" })).getByRole('textbox')).toHaveValue('Keep this unsent draft');
  await userEvent.keyboard('{Escape}');
  expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
});

it('BUG-201: a guest-only room projection cannot open an owned same-name private agent view', async () => {
  mount({ wsUrl: 'ws://localhost:8765' });
  await screen.findByTestId('home-frame-oak');
  const socket = socketMock.last();
  const guest = { ...oak, id: 'foreign-oak', guest: true, chatHistory: undefined };
  act(() => { socket.open(); socket.emit({ type: 'home_state', agents: [oak, plum, guest], game: null }); });
  await userEvent.click(await screen.findByTestId('home-frame-foreign-oak'));
  expect(screen.queryByRole('region', { name: "Professor Oak's room" })).toBeNull();
  expect(screen.queryByRole('region', { name: "Professor Oak's profile" })).toBeNull();
  expect(fetchMock.calls.filter(c => /\/agents\/(foreign-oak|oak)\/(hands|profile)/.test(c.url))).toHaveLength(0);
});

it('BUG-192: removing the selected owner agent returns to the room', async () => {
  mount();
  await userEvent.click(await screen.findByTestId('home-frame-oak'));
  await screen.findByRole('region', { name: "Professor Oak's room" });
  fetchMock.route('/api/agents', { agents: [plum] });
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('region', { name: "Professor Oak's room" })).toBeNull());
  expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
});

it('BUG-192: returning from Profile after funding keeps the new pocket in his agent view', async () => {
  fetchMock.route('/api/wallet', { balance: 9000 });
  fetchMock.route('/fund', { pocket: { balance: 3500, cap: 3500, mode: 'topup' } });
  mount();
  await userEvent.click(await screen.findByTestId('home-frame-oak'));
  await userEvent.click((await screen.findByRole('region', { name: "Professor Oak's room" })).querySelector('[aria-label="Profile"]'));
  const profile = await screen.findByRole('region', { name: "Professor Oak's profile" });
  await userEvent.click(within(profile).getByRole('button', { name: 'Give him chips', exact: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Fund Professor Oak' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Give him chips', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await userEvent.click(within(profile).getByRole('button', { name: 'Back to chat' }));
  const room = await screen.findByRole('region', { name: "Professor Oak's room" });
  expect(within(room).getByRole('button', { name: /DEPLOY/ })).toHaveTextContent('$3,500');
});
