import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DesktopHome } from '../desktop/DesktopHome.jsx';
import { CasinoScreen } from '../../screens/CasinoScreen.jsx';
import { balancedAgent } from '../../test/fixtures/wallet.js';
import { backRoom } from '../../test/fixtures/rooms.js';
import { fetchMock, telegram } from '../../test/harness.js';

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', { agents: [balancedAgent] });
  fetchMock.route('/api/wallet', { balance: 20000, ledger: [] });
  fetchMock.route('/hands', { recentHands: [] });
  fetchMock.route('/thread', { lines: [], sessionId: 'home' });
  fetchMock.route('/fund', () => ({ status: 503, body: {} }), { method: 'POST' });
});

it('BUG-280: DesktopHome propagates a transfer refusal so the sheet retains its amount', async () => {
  const { container } = render(<DesktopHome onWatchAgent={vi.fn()} onDeployAgent={vi.fn()} onCreateAgent={vi.fn()} />);
  fireEvent.click(await within(container.querySelector('.dsk-top')).findByRole('button', { name: /^Wallet for / }));
  const panel = within(document.querySelector('.dsk-wallet'));
  fireEvent.click(await panel.findByRole('button', { name: 'Give him chips' }));
  const sheet = within(await panel.findByRole('dialog', { name: `Fund ${balancedAgent.name}` }));
  fireEvent.change(sheet.getByLabelText('Amount to give'), { target: { value: '137' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Give him chips' }));
  expect(await sheet.findByRole('alert')).toHaveTextContent('Could not move the chips');
  expect(sheet.getByLabelText('Amount to give')).toHaveValue(137);
  expect(fetchMock.requestsMatching('/fund')[0].body.amount).toBe(137);
});

it('BUG-280: CasinoScreen propagates a funding refusal without closing the draft', async () => {
  const agent = { ...balancedAgent, presence: 'resting', activeTableId: null, liveGame: null,
    pocket: { ...balancedAgent.pocket, balance: 12000 } };
  fetchMock.route('/api/agents?', { agents: [agent] });
  fetchMock.route('/api/rooms', { rooms: [{ ...backRoom, tables: 0, seated: 0 }] });
  fetchMock.route(/\/api\/rooms\/[^/]+\/tables$/, { room: backRoom.id, tables: [] });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/deploy', () => ({ status: 402, body: { error: 'cantAfford' } }), { method: 'POST' });
  render(<CasinoScreen onDeployed={vi.fn()} />);
  const play = within(await screen.findByTestId('casino-play'));
  fireEvent.click(await play.findByRole('button', { name: `Send ${agent.name} to play` }));
  const sheet = within(await screen.findByRole('dialog', { name: `Fund ${agent.name}` }));
  fireEvent.change(sheet.getByLabelText('Amount to give'), { target: { value: '137' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Give him chips' }));
  expect(await sheet.findByRole('alert')).toHaveTextContent('Could not move the chips');
  expect(sheet.getByLabelText('Amount to give')).toHaveValue(137);
  expect(fetchMock.requestsMatching('/fund')[0].body.amount).toBe(137);
});

it('BUG-280: DesktopHome treats a failed post-transfer balance read as a read-only retry', async () => {
  let failRead = false;
  fetchMock.route('/api/wallet', () => failRead ? { status: 503, body: {} } : { balance: 20000, ledger: [] });
  fetchMock.route('/fund', () => { failRead = true; return { moved: 137 }; }, { method: 'POST' });
  const { container } = render(<DesktopHome onWatchAgent={vi.fn()} onDeployAgent={vi.fn()} onCreateAgent={vi.fn()} />);
  fireEvent.click(await within(container.querySelector('.dsk-top')).findByRole('button', { name: /^Wallet for / }));
  const panel = within(container.querySelector('.dsk-wallet'));
  fireEvent.click(await panel.findByRole('button', { name: 'Give him chips' }));
  let sheet = within(await panel.findByRole('dialog', { name: `Fund ${balancedAgent.name}` }));
  fireEvent.change(sheet.getByLabelText('Amount to give'), { target: { value: '137' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Give him chips' }));
  await waitFor(() => expect(panel.getByRole('status')).toHaveTextContent('Chips moved'));
  expect(panel.queryByRole('dialog')).toBeNull();
  expect(panel.getByRole('button', { name: 'Give him chips' })).toBeDisabled();
  expect(panel.queryByText(/Could not move the chips/)).toBeNull();
  failRead = false;
  fireEvent.click(panel.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(panel.getByRole('button', { name: 'Give him chips' })).toBeEnabled());
  expect(fetchMock.requestsMatching('/fund')).toHaveLength(1);
});

it('BUG-280: CasinoScreen closes a confirmed transfer even if the following safe read fails', async () => {
  let failRead = false;
  const agent = { ...balancedAgent, presence: 'resting', activeTableId: null, liveGame: null,
    pocket: { ...balancedAgent.pocket, balance: 12000 } };
  fetchMock.route('/api/agents?', { agents: [agent] });
  fetchMock.route('/api/rooms', { rooms: [{ ...backRoom, tables: 0, seated: 0 }] });
  fetchMock.route(/\/api\/rooms\/[^/]+\/tables$/, { room: backRoom.id, tables: [] });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/wallet', () => failRead ? { status: 503, body: {} } : { balance: 20000, ledger: [] });
  fetchMock.route('/deploy', () => ({ status: 402, body: { error: 'cantAfford' } }), { method: 'POST' });
  fetchMock.route('/fund', () => { failRead = true; return { moved: 137 }; }, { method: 'POST' });
  render(<CasinoScreen onDeployed={vi.fn()} />);
  const play = within(await screen.findByTestId('casino-play'));
  fireEvent.click(await play.findByRole('button', { name: `Send ${agent.name} to play` }));
  const sheet = within(await screen.findByRole('dialog', { name: `Fund ${agent.name}` }));
  fireEvent.change(sheet.getByLabelText('Amount to give'), { target: { value: '137' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Give him chips' }));
  expect(await screen.findByText('Chips moved. Refresh the safe before making another transfer.')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: `Fund ${agent.name}` })).toBeNull();
  expect(screen.queryByText(/Could not move the chips/)).toBeNull();
  failRead = false;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh safe' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Refresh safe' })).toBeNull());
  expect(fetchMock.requestsMatching('/fund')).toHaveLength(1);
});
