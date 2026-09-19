import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App.jsx';
import * as tableHook from './hooks/useTable.js';
import * as pacedHook from './hooks/usePacedTable.js';
import { fetchMock, telegram } from './test/harness.js';
import { midHandGame } from './test/fixtures/game.js';

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [] });
  fetchMock.route('/api/home', { chat: [] });
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => { vi.useRealTimers(); });

async function seatedApp(legalActions) {
  const sendAction = vi.fn();
  let game = { ...midHandGame, toAct: 0,
    actionTimer: { seat: 0, deadlineTs: Date.now() + 15_000, totalMs: 15_000 } };
  const state = { game, mySeat: 0, legalActions, history: [], status: 'connected', error: null,
    config: { tableId: 'home-4242', sitting: true, buyIn: 200 },
    chatMessages: [], threadLines: [], reads: [], paceFrame: null, lastDecision: null,
    act: sendAction, connect: vi.fn(), watch: vi.fn(), disconnect: vi.fn(), dismissError: vi.fn(),
    sitOut: vi.fn(), deal: vi.fn(), rename: vi.fn(), sendChat: vi.fn() };
  vi.spyOn(tableHook, 'useTable').mockImplementation(() => ({ ...state, game }));
  vi.spyOn(pacedHook, 'usePacedTable').mockImplementation(() => ({ ...state, game }));
  let view;
  await act(async () => { view = render(<App />); });
  return { sendAction, update(next) { game = { ...game, ...next }; view.rerender(<App />); } };
}

it.each([
  ['check', [{ type: 'check' }, { type: 'fold' }]],
  ['fold', [{ type: 'call', amount: 40 }, { type: 'fold' }]],
])('BUG-268: an elapsed server deadline never makes App send its own %s', async (verb, legal) => {
  const { sendAction } = await seatedApp(legal);
  expect(within(screen.getByTestId('sit-strip')).getByText(`15s · timeout ${verb}s for you`)).toBeVisible();
  await act(async () => { vi.advanceTimersByTime(15_000); });
  expect(sendAction).not.toHaveBeenCalled();
  // The server may be delayed; another local tick must not become authority.
  await act(async () => { vi.advanceTimersByTime(15_000); });
  expect(sendAction).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByTestId('sit-strip')).getByRole('button', { name: verb.toUpperCase() }));
  expect(sendAction).toHaveBeenCalledOnce();
  expect(sendAction).toHaveBeenCalledWith({ type: verb });
});

it('BUG-268: the same seat on the next street displays its new served deadline without restarting a local clock', async () => {
  const { sendAction, update } = await seatedApp([{ type: 'check' }, { type: 'fold' }]);
  await act(async () => { vi.advanceTimersByTime(2_000); });
  expect(screen.getByText('13s · timeout checks for you')).toBeVisible();
  act(() => update({ street: 'turn', community: [...midHandGame.community, '2d'],
    actionTimer: { seat: 0, deadlineTs: Date.now() + 9_000, totalMs: 15_000 } }));
  expect(screen.getByText('9s · timeout checks for you')).toBeVisible();
  await act(async () => { vi.advanceTimersByTime(1_000); });
  expect(screen.getByText('8s · timeout checks for you')).toBeVisible();
  act(() => update({ actionTimer: null }));
  expect(screen.queryByText(/timeout checks for you/)).not.toBeInTheDocument();
  expect(sendAction).not.toHaveBeenCalled();
});
