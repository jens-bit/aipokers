import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WatchScreen } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { playingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const props = { game: midHandGame, mySeat: 0, config: spectatorConfig, privateChatInPlace: true };
const finish = `/api/agents/${playingAgent.id}/finish`;
const roster = agent => fetchMock.route('/api/agents?', { agents: agent ? [agent] : [] });
beforeEach(() => { telegram.signIn(); roster(playingAgent); fetchMock.route('/thread', { lines: [] }); });
async function panel() {
  await userEvent.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  return screen.findByRole('dialog', { name: 'The Grinder at the table' });
}

it('BUG-259: Stop watching only leaves the view; an owned casino agent has a separate return action', async () => {
  const onLeave = vi.fn(), onSitOut = vi.fn();
  render(<WatchScreen {...props} onLeave={onLeave} onSitOut={onSitOut}/>);
  const sheet = await panel();
  expect(await within(sheet).findByRole('button', { name: 'Bring home' })).toBeEnabled();
  expect(within(sheet).getByText('Finishes this hand, then returns home.')).toBeVisible();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Back to table' }));
  await userEvent.click(screen.getByRole('button', { name: 'Stop watching', exact: true }));
  expect(onLeave).toHaveBeenCalledOnce();
  expect(onSitOut).not.toHaveBeenCalled();
  expect(fetchMock.posts).toHaveLength(0);
});

it('BUG-259: return waits for settlement, submits once, and never sends immediate sit-out or leaves Watch', async () => {
  let resolve;
  fetchMock.route(finish, () => new Promise(done => { resolve = done; }), { method: 'POST' });
  const onLeave = vi.fn(), onSitOut = vi.fn();
  const { rerender } = render(<WatchScreen {...props} onLeave={onLeave} onSitOut={onSitOut}/>);
  const sheet = await panel();
  const button = await within(sheet).findByRole('button', { name: 'Bring home' });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetchMock.requestsMatching(finish)).toHaveLength(1);
  expect(fetchMock.posts[0].headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  expect(fetchMock.posts[0].body).toEqual({ userId: '4242', expectedTableId: midHandGame.tableId });
  expect(within(sheet).getByRole('button', { name: 'Requesting…' })).toBeDisabled();
  await act(async () => resolve({ status: 200, body: { ...playingAgent, returnPending: true } }));
  expect(within(sheet).getByRole('button', { name: 'Returning…' })).toBeDisabled();
  expect(within(sheet).getByText('Finishing this hand. Chips settle when it ends.')).toBeVisible();
  expect(onLeave).not.toHaveBeenCalled(); expect(onSitOut).not.toHaveBeenCalled();
  rerender(<WatchScreen {...props} onLeave={onLeave} onSitOut={onSitOut}
    sessionEnd={{ reason: 'calledIn', hands: 1, finalStack: 980 }}/>);
  expect(screen.getByRole('button', { name: 'Back home', exact: true })).toBeVisible();
  expect(fetchMock.requestsMatching(finish)).toHaveLength(1);
});

it('BUG-259: reopening Watch reads pending return from the owner projection instead of offering a duplicate', async () => {
  roster({ ...playingAgent, returnPending: true });
  render(<WatchScreen {...props}/>);
  const sheet = await panel();
  expect(await within(sheet).findByRole('button', { name: 'Returning…' })).toBeDisabled();
  expect(fetchMock.posts).toHaveLength(0);
});

it('BUG-259: a refused return shows the server explanation and permits retry', async () => {
  fetchMock.route(finish, { status: 409, body: { error: 'He is part of a visit. Try again when it finishes.' } }, { method: 'POST' });
  render(<WatchScreen {...props}/>);
  const sheet = await panel();
  await userEvent.click(await within(sheet).findByRole('button', { name: 'Bring home' }));
  expect(await within(sheet).findByRole('alert')).toHaveTextContent('He is part of a visit.');
  expect(within(sheet).getByRole('button', { name: 'Bring home' })).toBeEnabled();
});

it.each([
  ['unknown owner', null, props],
  ['another table', { ...playingAgent, activeTableId: 'elsewhere' }, props],
  ['kitchen agent', { ...playingAgent, activeTableId: null, liveGame: { ...playingAgent.liveGame, home: true } }, props],
  ['human player', playingAgent, { ...props, seated: true }],
])('BUG-259: %s cannot get the casino-agent return action', async (_, agent, viewProps) => {
  roster(agent); render(<WatchScreen {...viewProps}/>);
  await panel();
  expect(screen.queryByRole('button', { name: 'Bring home' })).toBeNull();
  expect(fetchMock.posts).toHaveLength(0);
});
