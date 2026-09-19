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

it('BUG-251: command receipt refreshes the actual seat and clears the fulfilled idle want', async () => {
  const seated = { ...agent, activeTableId: 'live', location: { where: 'table', tableId: 'live' }, want: null,
    liveGame: { tableId: 'live', smallBlind: 25, bigBlind: 50 }, pocket: { balance: 0 } };
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I am seated at $25/$50.' }], command: { status: 'done' }, agent: seated });
  show({ agent: { ...agent, want: { kind: 'deploy', text: 'Put me in now.' } }, onWatch: vi.fn() });
  await userEvent.type(screen.getByPlaceholderText('Whisper to him…'), 'play 25/50');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('button', { name: 'Watch live game' })).toBeInTheDocument();
  expect(screen.queryByText('Put me in now.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /deploy/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /watch.*25\/50/i })).toBeInTheDocument();
});

it('BUG-258: the live action row reports session net, not the outstanding buy-in as a loss', async () => {
  const seated = { ...agent, activeTableId: 'live', location: { where: 'table' },
    liveGame: { tableId: 'live', blinds: '25/50', net: 0, heroStack: 5000 },
    pocket: { balance: 300, pnl: -5000 } };
  const view = show({ agent: seated, onWatch: vi.fn() });
  const row = await screen.findByRole('button', { name: /watch.*25\/50/i });
  expect(row.querySelector('.agent-view__net')).toHaveTextContent('$0');
  expect(row).not.toHaveTextContent('$5,000');
  expect(row).not.toHaveTextContent('$300');
  view.rerender(<AgentThread agent={{ ...seated, liveGame: { ...seated.liveGame, net: 340 } }} companion onWatch={() => {}} />);
  expect(row.querySelector('.agent-view__net')).toHaveTextContent('+$340');
  expect(row.querySelector('.agent-view__net--up')).toBeTruthy();
});

it('BUG-258: a missing live net stays unknown rather than falling back to pocket cashflow', async () => {
  show({ agent: { ...agent, activeTableId: 'live', liveGame: { tableId: 'live', blinds: '25/50' },
    pocket: { balance: 0, pnl: -5000 } }, onWatch: vi.fn() });
  const row = await screen.findByRole('button', { name: /watch.*25\/50/i });
  expect(row.querySelector('.agent-view__net')).toBeNull();
  expect(row).not.toHaveTextContent('$5,000');
});

it('FIRST-CHAT-1: mobile restores a refused draft and shows an application error, then retries once', async () => {
  fetchMock.route('/api/agents/chat', { status: 503, body: {} });
  show();
  const input = screen.getByPlaceholderText('Whisper to him…');
  await userEvent.type(input, 'Are you there?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
  expect(input).toHaveValue('Are you there?');
  expect(screen.queryByText('Are you there?')).not.toBeInTheDocument();
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I heard you.' }], replyUnavailable: true });
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByText('Are you there?')).toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(input).toHaveValue('');
});

it('FIRST-CHAT-1: mobile treats empty success as retryable and ignores a reply after changing agent', async () => {
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: '  ' }] });
  const view = show();
  await userEvent.type(screen.getByPlaceholderText('Whisper to him…'), 'Hello');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
  let release;
  fetchMock.route('/api/agents/chat', () => new Promise(resolve => { release = resolve; }));
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  view.rerender(<AgentThread agent={{ ...agent, id: 'a2', name: 'Other', opener: 'New conversation.', chatHistory: [] }} companion />);
  await waitFor(() => expect(screen.getByPlaceholderText('Whisper to him…')).toBeEnabled());
  await act(async () => release({ chat: [{ role: 'assistant', content: 'Old response.' }] }));
  expect(screen.queryByText('Old response.')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('Whisper to him…')).toHaveValue('');
});

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

it('BUG-230: DEPLOY states his net alongside his pocket, not just his stack', async () => {
  const up = { ...agent, pocket: { balance: 2000, pnl: 340 } };
  const { rerender } = show({ agent: up });
  const deploy = await screen.findByRole('button', { name: /deploy/i });
  expect(deploy).toHaveTextContent('+$340');
  expect(deploy.querySelector('.agent-view__net--up')).toBeTruthy();
  // The word itself, not only a hover title — a title is invisible on a
  // phone, which is where this button actually lives.
  expect(deploy.querySelector('.agent-view__net-label')).toHaveTextContent('net');

  rerender(<AgentThread agent={{ ...agent, pocket: { balance: 900, pnl: -1200 } }} companion onDeploy={() => {}} onCarry={() => {}} onOpenProfile={() => {}} onBack={() => {}} />);
  const redeploy = screen.getByRole('button', { name: /deploy/i });
  expect(redeploy).toHaveTextContent('−$1,200');
  expect(redeploy.querySelector('.agent-view__net--down')).toBeTruthy();
});

it('AGENT-1: an away agent can be watched but cannot be carried from the casino', async () => {
  const away = { ...agent, activeTableId: 't1', status: 'playing', location: { where: 'table', tableId: 't1' } };
  const onWatch = vi.fn();
  show({ agent: away, onWatch });
  await userEvent.click(screen.getByRole('button', { name: 'Watch live game' }));
  expect(onWatch).toHaveBeenCalledWith(away);
  expect(screen.getByRole('button', { name: 'Carry' })).toBeDisabled();
});

it('TABLE-1 job F: opening his room mid-hand shows his own two cards, not just his figure', async () => {
  const live = { ...agent, activeTableId: 't1', status: 'playing', location: { where: 'table', tableId: 't1' },
    liveGame: { tableId: 't1', street: 'flop', pot: 480, board: ['Ah', 'Kd', '2c'], heroHole: ['Jh', 'Jd'], dealtIn: true } };
  show({ agent: live });
  const hole = await screen.findByTestId('agent-view-hole');
  expect(hole.querySelectorAll('svg')).toHaveLength(2);
});

it('TABLE-1 job F: draws nothing when he is not owned, not dealt in, or not holding two cards', async () => {
  show({ agent }); // resting at home: no liveGame at all
  expect(screen.queryByTestId('agent-view-hole')).not.toBeInTheDocument();

  const noHole = { ...agent, activeTableId: 't1', status: 'playing', location: { where: 'table', tableId: 't1' },
    liveGame: { tableId: 't1', street: 'flop', pot: 480, board: ['Ah', 'Kd', '2c'], heroHole: null, dealtIn: true } };
  const { unmount } = show({ agent: noHole });
  expect(screen.queryByTestId('agent-view-hole')).not.toBeInTheDocument();
  unmount();
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
it('UI-3 job E: his line ends in his own action, not a generic Yes', async () => {
  fetchMock.route('/api/agents/a1/want', { ok: true, needs: 'deploy' });
  const onDeploy = vi.fn();
  const want = { kind: 'back_in', text: 'Let me back in.', action: 'deploy', actionLabel: 'Put him in' };
  show({ agent: { ...agent, want }, onDeploy });
  expect(await screen.findAllByText('Let me back in.')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Put him in' }));
  await waitFor(() => expect(onDeploy).toHaveBeenCalledTimes(1));
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
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send your message. Please try again.');
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

// ── BUG-197 · the action row's type and ink ─────────────────────────────────
//
// The row's geometry survived the port; its letters did not. Every number
// below is measured off the authored C1 frame at 390x844 — the crop is
// design-refs/frames/42-C1-actions.png — and the pair is
// artifacts/pairs/42-C1-actions.png. The type and geometry remain authored;
// ink follows the shared appearance rather than the retired fixed palette.
const rowStyles = () => {
  const row = document.querySelector('.agent-view__actions');
  const deploy = row.querySelector('.agent-view__deploy');
  const label = [...row.querySelectorAll('button:not(.agent-view__deploy) > span')];
  return { row, deploy, label, css: (el) => getComputedStyle(el) };
};

it('BUG-197: DEPLOY carries the authored condensed face, weight and tracking', async () => {
  show();
  await screen.findByTestId('agent-stage');
  const { deploy, css } = rowStyles();
  const word = css(deploy.querySelector('b'));
  expect(word.fontFamily).toMatch(/Oswald/);
  expect(word.fontSize).toBe('10.5px');
  expect(word.fontWeight).toBe('600');
  // .14em of 10.5px is the 1.47px the authored frame measures.
  expect(word.letterSpacing).toMatch(/em$/);
  expect(parseFloat(word.letterSpacing)).toBeCloseTo(0.14, 5);
  expect(word.color).toBe('var(--accent)');
});

it('BUG-197: the pocket line is 10px mono in the shared secondary ink', async () => {
  show();
  await screen.findByTestId('agent-stage');
  const { deploy, css } = rowStyles();
  const number = css(deploy.querySelector('span'));
  expect(number.fontFamily).toMatch(/JetBrains Mono/);
  expect(number.fontSize).toBe('10px');
  expect(number.color).toBe('var(--text-secondary)');
});

it('BUG-197: the three labels are Oswald 600 at 7.5px in muted ink, and the icons are not', async () => {
  show();
  await screen.findByTestId('agent-stage');
  const { row, label, css } = rowStyles();
  expect(label.map((s) => s.textContent)).toEqual(['GIVE CHIPS', 'CARRY', 'PROFILE']);
  for (const span of label) {
    const s = css(span);
    expect(s.fontFamily).toMatch(/Oswald/);
    expect(s.fontSize).toBe('7.5px');
    expect(s.fontWeight).toBe('600');
    expect(s.letterSpacing).toMatch(/em$/);
    expect(parseFloat(s.letterSpacing)).toBeCloseTo(0.1, 5);
    expect(s.color).toBe('var(--text-muted)');
  }
  // Two inks. The icon rides the button's own colour, which is the brighter
  // dim; the label under it is the muted one. Flattening both is the bug.
  for (const button of row.querySelectorAll('button:not(.agent-view__deploy)')) {
    expect(css(button).color).toBe('var(--text-secondary)');
  }
});

it('BUG-197: the row keeps the geometry the port already had', async () => {
  show();
  await screen.findByTestId('agent-stage');
  const { row, deploy, css } = rowStyles();
  expect(css(row).height).toBe('66px');
  expect(css(row).gap).toBe('6px');
  expect(css(row).padding).toBe('0px 12px');
  expect(css(deploy).height).toBe('46px');
  expect(css(deploy).borderRadius).toBe('10px');
  expect(css(deploy).gap).toBe('7px');
});
