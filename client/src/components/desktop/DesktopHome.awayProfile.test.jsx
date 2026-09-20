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

// CHARACTER-1 preserves BUG-207's ID selection and private conversation.
// Stats now switches the lower pane of the same character; one shared Chat
// composer owns the draft instead of a second Profile composer.
it.each([false, true])('BUG-207: Open him selects his agent view by id, including an owned visitor (%s)', async visiting => {
  const selected = visiting ? { ...oak, visiting: { hostName: 'Jens' }, location: { where: 'visiting' } } : oak;
  fetchMock.route('/api/agents', { agents: [selected, plum] });
  const watch = mount();
  await userEvent.click(await screen.findByTestId('home-frame-oak'));
  const room = await screen.findByRole('region', { name: "Professor Oak's room", exact: true });
  expect(within(room).getByText('The earlier read is saved.', { exact: true, selector: '.agent-view__line .agent-view__text' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: "Professor Plum's room" })).toBeNull();
  expect(watch).not.toHaveBeenCalled();
  await userEvent.type(within(room).getByRole('textbox'), 'Keep this unsent draft');
  await userEvent.click(within(room).getByRole('tab', { name: 'Stats', exact: true }));
  const profile = await screen.findByRole('region', { name: "Professor Oak's stats" });
  expect(within(room).getByText('Professor Oak', { exact: true })).toBeInTheDocument();
  expect(within(profile).getByText('Condition')).toBeVisible();
  await userEvent.click(screen.getByRole('tab', { name: 'Chat', exact: true }));
  expect(within(await screen.findByRole('region', { name: "Professor Oak's room" })).getByRole('textbox')).toHaveValue('Keep this unsent draft');
  await userEvent.click(screen.getByTestId('home-frame-plum'));
  expect(await screen.findByRole('region', { name: "Professor Plum's room" })).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('home-frame-oak'));
  expect(within(await screen.findByRole('region', { name: "Professor Oak's room" })).getByRole('textbox')).toHaveValue('Keep this unsent draft');
  await userEvent.keyboard('{Escape}');
  expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
});

it('BUG-207: a guest-only room projection cannot open an owned same-name private agent view', async () => {
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

it('CHARACTER-1: Escape closes More before the character panel and restores its trigger focus', async () => {
  mount();
  await userEvent.click(await screen.findByTestId('home-frame-oak'));
  const room = await screen.findByRole('region', { name: "Professor Oak's room" });
  const more = within(room).getByRole('button', { name: 'More actions' });
  await userEvent.click(more);
  expect(within(room).getByRole('button', { name: 'His sheet' })).toBeVisible();
  await userEvent.keyboard('{Escape}');
  expect(room).toBeVisible();
  expect(within(room).queryByRole('button', { name: 'His sheet' })).toBeNull();
  expect(more).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('region', { name: "Professor Oak's room" })).toBeNull();
  expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
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

it('BUG-192: switching back from Stats after funding keeps the new pocket in his agent view', async () => {
  const user = userEvent.setup();
  fetchMock.route('/api/wallet', { balance: 9000 });
  fetchMock.route('/fund', { pocket: { balance: 3500, cap: 3500, mode: 'topup' } });
  mount();
  await user.click(await screen.findByTestId('home-frame-oak'));
  const character = await screen.findByRole('region', { name: "Professor Oak's room" });
  // All three character panes stay mounted. Query each control's own small
  // region so hidden Stats/Wardrobe controls and the Home stage don't make
  // this interaction CPU-bound under the parallel client/browser gates.
  const tabs = within(character.querySelector('.agent-view__tabs'));
  const actions = within(character.querySelector('.agent-view__actions'));
  await user.click(tabs.getByRole('tab', { name: 'Stats', exact: true }));
  expect(within(character.querySelector('.agent-view__pane--stats'))
    .getByRole('region', { name: "Professor Oak's stats" })).toBeVisible();
  await user.click(actions.getByRole('button', { name: 'Give chips', exact: true }));
  const dialog = within(character.querySelector('.agent-view__fund'))
    .getByRole('dialog', { name: 'Fund Professor Oak' });
  await user.click(within(dialog.querySelector('.wal-sheet__foot'))
    .getByRole('button', { name: 'Give him chips', exact: true }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  await user.click(tabs.getByRole('tab', { name: 'Chat', exact: true }));
  expect(tabs.getByRole('tab', { name: 'Chat', exact: true })).toHaveAttribute('aria-selected', 'true');
  const room = await screen.findByRole('region', { name: "Professor Oak's room" });
  expect(within(room.querySelector('.agent-view__actions')).getByRole('button', { name: /DEPLOY/ })).toHaveTextContent('$3,500');
});
