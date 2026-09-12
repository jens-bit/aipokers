import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { AgentProfileScreen } from './screens/AgentProfileScreen.jsx';
import { VisitorToast } from './components/home/VisitorToast.jsx';
import { shareVisitLink, requestVisit } from './lib/visit.js';
import { parseStartParam, resolveDeepLink } from './lib/deeplink.js';
import { startGuest } from './lib/guest.js';
import { fetchMock, socketMock, telegram } from './test/harness.js';

const token = 'vi_0123456789abcdefghij';
const agent = { id: 'friend1', name: 'Away Day', status: 'idle', location: { where: 'home' }, chatHistory: [] };
const invite = { agentId: agent.id, agentName: agent.name, invitationToken: token, expiresAt: Date.now() + 3600000, maxStake: 0, startParam: `visit_${token}` };
const url = `https://t.me/RailbirdTest?start=visit_${token}`;
function routes() {
  fetchMock.route('/api/auth/config', { botUsername: 'RailbirdTest' });
  fetchMock.route('/api/agents/friend1/visit-invite', invite, { method: 'POST' });
  fetchMock.route(`/api/visit-invites/${token}`, { agentId: agent.id, agentName: agent.name, expiresAt: invite.expiresAt, maxStake: 0 });
}
beforeEach(() => { telegram.signIn(); routes(); });

it('BUG-160: a visiting agent profile watches its actual kitchen and keeps the owner viewpoint', async () => {
  const user = userEvent.setup();
  const visitor = { ...agent, activeTableId: null, location: { where: 'visiting', tableId: 'home-9402' }, liveGame: { tableId: 'home-9402', state: 'running' } };
  fetchMock.route('/api/agents?', { agents: [visitor] });
  fetchMock.route('/memory', { memoryContext: '' });
  telegram.startWith(`agent_${visitor.id}`);
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Profile', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'Watch live game' }));
  await waitFor(() => expect(document.querySelector('.watch-screen')).toBeTruthy());
  act(() => { for (const socket of socketMock.instances) if (socket.readyState === 0) socket.open(); });
  expect(socketMock.instances.flatMap(socket => socket.sent).find(message => message.type === 'watch')).toMatchObject({ tableId: 'home-9402', agentId: visitor.id, userId: '4242' });
  expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  expect(await screen.findByPlaceholderText('Whisper to him…')).toBeInTheDocument();
});

it('BUG-160: a kitchen table link resolves the visiting agent belonging to this owner', async () => {
  fetchMock.route('/api/agents?', { agents: [{ ...agent, activeTableId: null, liveGame: { tableId: 'home-9402' } }] });
  expect(await resolveDeepLink({ kind: 'table', tableId: 'home-9402' })).toMatchObject({ kind: 'table', tableId: 'home-9402', agent: { id: agent.id } });
});
afterEach(() => { delete navigator.share; delete navigator.clipboard; localStorage.clear(); sessionStorage.clear(); });

it('BUG-150: sharing obtains owner consent and copies a readable invitation instead of a bare agent link', async () => {
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const out = await shareVisitLink(agent.id, agent.name);
  expect(fetchMock.posts.find(c => c.url.endsWith('/visit-invite'))).toEqual(expect.objectContaining({ body: { userId: '4242', stake: 0 }, headers: expect.objectContaining({ 'X-Telegram-Init-Data': expect.any(String) }) }));
  expect(out).toEqual(expect.objectContaining({ ok: true, via: 'clipboard', url }));
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Away Day wants a game.*Railbird[\s\S]*https:\/\/t.me\/RailbirdTest\?start=visit_vi_/));
});

it.each([['AbortError', 'cancelled'], ['NotAllowedError', 'shareFailed']])('BUG-150: %s from native share is not reported as a sent invitation', async (name, reason) => {
  Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('not sent', name)), configurable: true });
  const result = await shareVisitLink(agent.id, agent.name);
  expect(result).toEqual(expect.objectContaining({ ok: false, reason, url }));
});

it('BUG-150: refused invitation never reaches native share or clipboard', async () => {
  fetchMock.route('/api/agents/friend1/visit-invite', { status: 409, body: { error: 'notHome' } }, { method: 'POST' });
  const share = vi.fn();
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  expect(await shareVisitLink(agent.id, agent.name)).toEqual(expect.objectContaining({ ok: false }));
  expect(share).not.toHaveBeenCalled();
});

it('BUG-150: More stays open while preparing, prevents repeat creation, and offers copying after cancellation', async () => {
  const user = userEvent.setup();
  let finish;
  fetchMock.route('/api/agents/friend1/visit-invite', () => new Promise(resolve => { finish = () => resolve(invite); }), { method: 'POST' });
  Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')), configurable: true });
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<AgentProfileScreen companion agent={agent} />);
  await user.click(screen.getByRole('button', { name: 'More actions' }));
  await user.click(screen.getByRole('button', { name: 'Send to a friend' }));
  expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'true');
  expect(await screen.findByRole('status')).toHaveTextContent('Preparing invitation');
  expect(screen.getByRole('button', { name: 'Send to a friend' })).toBeDisabled();
  await act(async () => finish());
  expect(await screen.findByRole('status')).toHaveTextContent('Sharing cancelled');
  await user.click(screen.getByRole('button', { name: 'Copy invitation' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Invitation copied');
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Away Day'));
  expect(fetchMock.posts.filter(c => c.url.endsWith('/visit-invite'))).toHaveLength(1);
});

it('BUG-150: visit launch resolves the invitation before the recipient knocks, carrying the token and zero stake', async () => {
  const route = parseStartParam(`visit_${token}`);
  expect(route).toEqual({ kind: 'visit', invitationToken: token });
  fetchMock.route('/api/agents/friend1/visit', { visitId: 'v1' }, { method: 'POST' });
  const result = await resolveDeepLink(route);
  expect(result).toEqual(expect.objectContaining({ kind: 'visit', ok: true, agentName: 'Away Day' }));
  expect(fetchMock.posts.at(-1).body).toEqual({ hostUserId: '4242', stake: 0, invitationToken: token });
});

it('BUG-150: invalid legacy public-id invitation does not POST a visit', async () => {
  const result = await requestVisit('agent_public_id');
  expect(result.ok).toBe(false);
  expect(fetchMock.posts).toHaveLength(0);
});

it('BUG-150: guest creation carries the invitation, never an unconsented public agent id', async () => {
  fetchMock.route('/api/guest', { ownerId: 'g_invited' }, { method: 'POST' });
  await startGuest(token);
  expect(fetchMock.posts.at(-1).body).toEqual({ visitInvitationToken: token });
});

it('BUG-150: a refused answer stays at the door with a retryable error', async () => {
  const answered = vi.fn();
  fetchMock.route('/api/home/visitors/v1/answer', { status: 409, body: { error: 'notHome' } }, { method: 'POST' });
  render(<VisitorToast visitor={{ id: 'v1', agentName: 'Away Day' }} onAnswered={answered} />);
  await userEvent.click(screen.getByRole('button', { name: 'Let him in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/home|try again/i);
  expect(answered).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Let him in' })).toBeEnabled();
});

it('BUG-150: an expired launch is explained in the room and StrictMode does not send two knocks', async () => {
  telegram.startWith(`visit_${token}`);
  fetchMock.route(`/api/visit-invites/${token}`, { status: 410, body: { error: 'invitationExpired' } });
  fetchMock.route('/api/agents?', { agents: [agent] });
  render(<StrictMode><App /></StrictMode>);
  expect(await screen.findByRole('alert')).toHaveTextContent(/expired.*new invitation/i);
  expect(fetchMock.posts.filter(c => c.url.endsWith('/visit'))).toHaveLength(0);
  expect(fetchMock.requestsMatching(`/api/visit-invites/${token}`)).toHaveLength(1);
});

it('BUG-150: a new invitation while reading a profile opens the Home door instead of leaving the profile over it', async () => {
  const user=userEvent.setup();
  fetchMock.route('/api/agents?', { agents:[agent] });
  fetchMock.route('/api/agents/friend1/visit', { status:200,body:{visitId:'v1',status:'knocking'} }, { method:'POST' });
  render(<App />);
  await user.click(await screen.findByRole('button',{name:/^Away Day —/}));
  await user.click(screen.getByRole('button',{name:'Profile',exact:true}));
  expect(await screen.findByRole('button',{name:'More actions'})).toBeInTheDocument();
  await act(async()=>{telegram.startWith(`visit_${token}`);telegram.emit('activated');});
  expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'More actions'})).toBeNull();
});

it('BUG-150: birth keeps the new agent and retries a staged in-hand visitor only when asked',async()=>{
  const user=userEvent.setup();
  telegram.startWith(`visit_${token}`);
  let made=false;
  const newborn={id:'newborn',name:'Moss',strategy:'Patient.',identity:{hood:'moss',glow:'ice'},nature:{name:'Rock'},firstWords:'My spot.',mood:{state:'neutral',heat:5}};
  const ready={draftId:'draft-invite',draftStep:'ready',draftName:'Moss',ready:true,chat:[]};
  fetchMock.route('/api/agents?',()=>({agents:made?[newborn]:[]}));
  fetchMock.route('/api/agents/draft',ready,{method:'POST'});
  fetchMock.route('/api/agents/chat',()=>{made=true;return {...ready,draftStep:'created',agentId:newborn.id,createdAgent:newborn,firstAgent:true,visitOutcome:{ok:false,status:409,reason:'inHand',retryable:true,agentName:'Away Day'}};},{method:'POST'});
  fetchMock.route('/api/agents/friend1/visit',{status:200,body:{visitId:'v1',status:'pending'}},{method:'POST'});
  render(<App initialVisitHandled />);
  await user.click(await screen.findByRole('button',{name:/DRAFT YOUR FIRST AGENT/i}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Deal him in',exact:true})).toBeEnabled(),{timeout:2500});
  await user.click(screen.getByRole('button',{name:'Deal him in',exact:true}));
  await waitFor(()=>expect(document.querySelector('.birth-card3')).toBeTruthy(),{timeout:3500});
  expect(document.querySelector('.birth-card3 .mood-ghost')).toHaveAttribute('data-hood','moss');
  await user.click(screen.getByRole('button',{name:'Go home',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your agent is home. He is in a hand. Try again when it finishes.');
  expect(fetchMock.posts.filter(c=>c.url.endsWith('/visit'))).toHaveLength(0);
  await user.click(screen.getByRole('button',{name:'Try again',exact:true}));
  await waitFor(()=>expect(fetchMock.posts.filter(c=>c.url.endsWith('/visit'))).toHaveLength(1));
  expect(fetchMock.posts.filter(c=>c.url.endsWith('/visit'))[0].body).toEqual({hostUserId:'4242',stake:0,invitationToken:token});
  expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('Away Day is at your door.');
},10000);
