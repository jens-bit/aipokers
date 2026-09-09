import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentThread } from '../../screens/ChatsScreen.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const agent = { id: 'a1', name: 'Loose Cannon', mood: { state: 'frustrated', heat: 58 }, fatigue: 'fresh', location: { where: 'home' }, pocket: { balance: 2000 }, opener: 'Put me in.' };
beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
  fetchMock.route('/api/wallet', { balance: 12000 });
});
const show = (props = {}) => render(<AgentThread agent={agent} companion onBack={() => {}} onDeploy={() => {}} onCarry={() => {}} onOpenProfile={() => {}} {...props} />);

it('AGENT-1: opens board 42 with the large character, four real actions and a quiet composer', async () => {
  const onDeploy = vi.fn(), onCarry = vi.fn(), onOpenProfile = vi.fn();
  show({ onDeploy, onCarry, onOpenProfile });
  expect(await screen.findByTestId('agent-stage')).toBeInTheDocument();
  expect(screen.getByTestId('agent-stage').querySelector('svg[width="178"]')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Whisper to him…')).not.toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: /deploy/i }));
  expect(onDeploy).toHaveBeenCalledWith(agent);
  await userEvent.click(screen.getByRole('button', { name: 'Carry' }));
  expect(onCarry).toHaveBeenCalledWith(agent);
  await userEvent.click(screen.getByRole('button', { name: 'Profile' }));
  expect(onOpenProfile).toHaveBeenCalledWith(agent);
  await userEvent.click(screen.getByRole('button', { name: 'Give chips' }));
  expect(await screen.findByRole('dialog', { name: 'Fund Loose Cannon' })).toBeInTheDocument();
});

it('AGENT-1: an away agent can be watched but cannot be carried from the casino', async () => {
  const away = { ...agent, activeTableId: 't1', status: 'playing', location: { where: 'table', tableId: 't1' } };
  const onWatch = vi.fn();
  show({ agent: away, onWatch });
  await userEvent.click(screen.getByRole('button', { name: 'Watch live game' }));
  expect(onWatch).toHaveBeenCalledWith(away);
  expect(screen.getByRole('button', { name: 'Carry' })).toBeDisabled();
});

it('BUG-61: a refused want remains answerable and reports the failure', async () => {
  fetchMock.route('/api/agents/a1/want', { status: 503, body: { error: 'Unavailable' } });
  show({ agent: { ...agent, want: { text: 'Let me back in.' } } });
  expect(await screen.findAllByText('Let me back in.')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(screen.getByRole('button', { name: 'Later' })).toBeEnabled();
  expect(screen.getAllByText('Let me back in.')).toHaveLength(1);
});

it('AGENT-1: accepting a deploy want uses the server answer and opens the casino', async () => {
  fetchMock.route('/api/agents/a1/want', { ok: true, needs: 'deploy' });
  const onDeploy = vi.fn();
  show({ agent: { ...agent, want: { text: 'Let me back in.' } }, onDeploy });
  await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));
  await waitFor(() => expect(onDeploy).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('Let me back in.')).not.toBeInTheDocument();
});
it('BUG-61: an unfulfilled request opens the fridge and is still there when it closes', async () => {
  const want = { text: 'A beer?' };
  fetchMock.route('/api/agents/a1/want', { answered: null, needs: 'stock', want });
  show({ agent: { ...agent, want } });
  await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));
  expect(await screen.findByRole('dialog', { name: 'The fridge' })).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
  expect(screen.getByText('A beer?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Yes' })).toBeEnabled();
});

it('AGENT-1: chips move through the existing fund route and update the deploy pocket', async () => {
  fetchMock.route('/api/agents/a1/fund', { pocket: { balance: 4000, cap: 2000 } });
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Give chips' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Give him chips' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fund Loose Cannon' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /deploy/i })).toHaveTextContent('$4,000');
  expect(fetchMock.requestsMatching('/api/agents/a1/fund')[0].body).toMatchObject({ verb: 'give', amount: 2000, userId: '4242' });
});

it('BUG-62: a rejected chat request shows a retryable error rather than silently swallowing the message', async () => {
  fetchMock.route('/api/agents/chat', { status: 403, body: { error: 'Forbidden' } });
  show();
  await userEvent.type(screen.getByPlaceholderText('Whisper to him…'), 'Hello');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Whisper to him…')).toBeEnabled();
});
it('BUG-63: reopening the agent shows the conversation the server kept', async () => {
  show({ agent: { ...agent, chatHistory: [{ role: 'user', content: 'How was that hand?' }, { role: 'assistant', content: 'He folded ace high.' }] } });
  expect(await screen.findByText('How was that hand?')).toBeInTheDocument();
  expect(screen.getAllByText('He folded ace high.').length).toBeGreaterThan(0);
});
it('BUG-63: a late recap response cannot erase a newly sent message', async () => {
  let release;
  fetchMock.route('/api/agents/a1/hands', () => new Promise(resolve => { release = resolve; }));
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I heard you.' }] });
  show();
  await userEvent.type(screen.getByPlaceholderText('Whisper to him…'), 'Are you there?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getAllByText('I heard you.').length).toBeGreaterThan(0));
  await act(async () => release({ recentHands: [] }));
  expect(screen.getByText('Are you there?')).toBeInTheDocument();
  expect(screen.getAllByText('I heard you.').length).toBeGreaterThan(0);
});


it('BUG-127: a quiet shift keeps the authored explanation in the phone companion',async()=>{
 fetchMock.route('/hands',{recentHands:[{handNumber:1}]});fetchMock.route('/flagged',{flaggedHands:[]});show();
 expect(await screen.findByText('NOTHING WORTH FLAGGING')).toBeInTheDocument();
 expect(screen.getByText('When a hand is worth watching, it arrives here as a replay you can scrub.')).toBeInTheDocument();
});
