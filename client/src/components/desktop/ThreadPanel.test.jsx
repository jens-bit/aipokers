// client/src/components/desktop/ThreadPanel.test.jsx — ATTR-2e-4
//
// C4/C9: the compact profile names him once. Detailed attributes remain
// behind More actions → His sheet; switching back preserves the conversation.
//
// The thread panel is where the desktop keeps his voice, and where ATTR-2e-1
// put the player card. Three things worth pinning:
//   the draft is CONTROLLED from above, so switching agents cannot eat it;
//   the panel offers the player card only while a thread is open;
//   the card obeys the ceiling law — a band width, never a number on a bar.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadPanel } from './ThreadPanel.jsx';
import { playingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

// RAISE-2: the opening bubble is the agent's own line — served by the server,
// or his birth words, or this last-ditch sentence. It is only an anchor here:
// these cases are about layout and lifecycle, not about what he says.
const OPENER = /Sit down\. What do you want to know\?/;

function renderPanel(props = {}) {
  return render(
    <ThreadPanel
      agent={playingAgent}
      accentIndex={0}
      draft=""
      onDraftChange={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

describe('ThreadPanel', () => {
  it('C9 keeps the proposed changes reviewable before acceptance',async()=>{
    renderPanel({agent:{...playingAgent,profile:{aggression:60},proposal:{text:'I should press harder.',suggestedPatch:{profileDelta:{aggression:10}}}}});
    expect(await screen.findByText('Aggression: 60% → 70%')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Accept change'})).toBeInTheDocument();
  });
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('opens on the thread, with the agent named in the head', async () => {
    renderPanel();
    const titles = await screen.findAllByText(playingAgent.name);
    expect(titles.some((el) => el.classList.contains('agent-view__name'))).toBe(true);
    expect(screen.getByTestId('agent-stage')).toBeInTheDocument();
  });

  it('seeds the thread from the hands endpoint, in his voice', async () => {
    renderPanel();
    expect((await screen.findAllByText(OPENER)).length).toBeGreaterThan(0);
  });

  it('renders the composer draft it is given rather than owning it', () => {
    renderPanel({ draft: 'half a thought' });
    expect(screen.getByRole('textbox')).toHaveValue('half a thought');
  });

  it('reports every keystroke up so the draft can outlive the panel', async () => {
    const onDraftChange = vi.fn();
    renderPanel({ onDraftChange });

    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onDraftChange).toHaveBeenCalledWith('x');
  });

  it('closes on request', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ThreadPanel player card (ATTR-2e-1)', () => {
  it('CHARACTER-1: His sheet Back restores Stats while explicit Chat returns to the conversation',async()=>{
    renderPanel();
    await userEvent.click(screen.getByRole('tab',{name:'Stats'}));
    await userEvent.click(screen.getByRole('button',{name:'More actions'}));
    await userEvent.click(screen.getByRole('button',{name:'His sheet'}));
    await userEvent.click(screen.getByRole('button',{name:'Back',exact:true}));
    expect(screen.getByRole('tab',{name:'Stats'})).toHaveAttribute('aria-selected','true');
    await userEvent.click(screen.getByRole('button',{name:'More actions'}));
    await userEvent.click(screen.getByRole('button',{name:'His sheet'}));
    await userEvent.click(screen.getByRole('button',{name:'Back to chat',exact:true}));
    expect(screen.getByRole('tab',{name:'Chat'})).toHaveAttribute('aria-selected','true');
  });
  it('BUG-83 keeps his saved identity when the desktop profile opens',async()=>{
    renderPanel({agent:{...playingAgent,identity:{hood:'sand',glow:'gold'}}});
    await userEvent.click(screen.getByRole('tab',{name:'Stats',exact:true}));
    const ghost=screen.getByTestId('agent-stage').querySelector('.mood-ghost');
    expect(ghost.querySelector('stop[stop-color="#6E5836"]')).not.toBeNull();
    expect(ghost.outerHTML).toContain('#C9A227');
  });
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('offers the player card beside the thread', async () => {
    renderPanel();
    expect(await screen.findByRole('tab', { name: 'Stats', exact: true })).toBeInTheDocument();
  });

  it('CHARACTER-1: Stats retains one character header and puts the single composer in Chat', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('tab', { name: 'Stats', exact: true }));

    expect(screen.getAllByText(playingAgent.name)).toHaveLength(1);
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('RECENT')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('His sheet keeps PROFILE-2 body readings separate from the four skills', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('tab', { name: 'Stats', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'His sheet' }));

    expect([...document.querySelectorAll('.profile-skills .attr-bar__name')].map(el=>el.textContent)).toEqual(['READS','FOCUS','DISCIPLINE','DECEPTION']);
    const body = within(document.querySelector('.body-bars'));
    expect(body.getByText('STAMINA')).toBeInTheDocument();
    expect(body.getByText('HEAT')).toBeInTheDocument();
    expect(body.getByText(/^composure \d+$/)).toBeInTheDocument();
  });

  it('never prints the ceiling as a number on a bar', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('tab', { name: 'Stats', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'His sheet' }));

    // The band is a width. Its numbers only appear once a bar is tapped open.
    expect(screen.queryByText(/^\d+–\d+$/)).not.toBeInTheDocument();
  });

  it('prints the exact band only when a bar is tapped — the user asking for it', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('tab', { name: 'Stats', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'His sheet' }));
    await userEvent.click(screen.getByRole('button', { name: /^READS \d+$/ }));

    await waitFor(() => expect(screen.getByText(/^\d+–\d+$/)).toBeInTheDocument());
  });

  it('offers no way to buy or re-roll anything', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('tab', { name: 'Stats', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'His sheet' }));

    expect(screen.queryByText(/buy|upgrade|purchase|re-roll|reroll|spend/i)).not.toBeInTheDocument();
  });
});

// One shared composer replaces the profile's independent whisper box.
it('CHARACTER-1: Stats preserves the private thread and draft; Chat sends through the same authenticated path', async()=>{
  telegram.signIn(); fetchMock.route('/hands',{recentHands:[]}); fetchMock.route('/flagged',{flaggedHands:[]});
  const onDraftChange=vi.fn();
  const history=[{role:'user',content:'Why did you call?'},{role:'assistant',content:'It was the sizing.'}];
  fetchMock.route('/api/agents/chat',{chat:[{role:'assistant',content:'I will wait for the button.'}]});
  renderPanel({agent:{...playingAgent,chatHistory:history},draft:'An unfinished thought',onDraftChange});
  await screen.findByText('Why did you call?');
  const composer=screen.getByRole('textbox');
  await userEvent.click(screen.getByRole('tab',{name:'Stats',exact:true}));
  expect(composer).not.toBeVisible();
  expect(screen.queryByRole('textbox')).toBeNull();
  await userEvent.click(screen.getByRole('tab',{name:'Chat',exact:true}));
  expect(screen.getByRole('textbox')).toBe(composer);
  expect(composer).toHaveValue('An unfinished thought');
  expect(onDraftChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
  await screen.findAllByText('I will wait for the button.');
  const feed=within(document.querySelector('.agent-view__thread'));
  for(const content of ['Why did you call?','It was the sizing.','An unfinished thought','I will wait for the button.']) expect(feed.getAllByText(content)).toHaveLength(1);
  expect(onDraftChange).toHaveBeenCalledWith('');
  const requests=fetchMock.posts.filter(c=>c.url==='/api/agents/chat');
  expect(requests).toHaveLength(1);
  expect(requests[0].body).toMatchObject({userId:'4242',existingAgentId:playingAgent.id,content:'An unfinished thought'});
  expect(requests[0].headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
});
it('BUG-280 / C4/C9 keeps one refused funding message visible and retries the authenticated transfer',async()=>{
  telegram.signIn(); fetchMock.route('/hands',{recentHands:[]}); fetchMock.route('/flagged',{flaggedHands:[]});
  fetchMock.route('/api/wallet',{balance:9000});
  let attempts=0;
  fetchMock.route('/fund',()=>++attempts===1?{status:503,body:{}}:{pocket:{balance:2000,cap:2000,mode:'topup'}});
  renderPanel();
  await userEvent.click(screen.getByRole('tab',{name:'Stats',exact:true}));
  await userEvent.click(screen.getByRole('button',{name:'Give chips',exact:true}));
  const dialog=await screen.findByRole('dialog',{name:'Fund The Grinder'});
  await userEvent.click(within(dialog).getByRole('button',{name:'Give him chips',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not move the chips');
  expect(dialog).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button',{name:'Give him chips',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  const posts=fetchMock.posts.filter(c=>c.url.endsWith('/fund'));
  expect(posts).toHaveLength(2);
  expect(posts[1].body).toMatchObject({verb:'give',amount:2000,refill:false,userId:'4242'});
  expect(posts[1].headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
});
it('C4/C9 calls a live agent in through the existing wallet verb',async()=>{
  telegram.signIn(); fetchMock.route('/hands',{recentHands:[]}); fetchMock.route('/flagged',{flaggedHands:[]});fetchMock.route('/fund',{ok:true});
  const onClose=vi.fn();renderPanel({onClose});
  await userEvent.click(screen.getByRole('tab',{name:'Stats',exact:true}));
  await userEvent.click(screen.getByRole('button',{name:'More actions'}));
  await userEvent.click(screen.getByRole('button',{name:'His sheet'}));
  await userEvent.click(screen.getByRole('button',{name:'Call him in',exact:true}));
  await waitFor(()=>expect(onClose).toHaveBeenCalledOnce());
  expect(fetchMock.posts.find(c=>c.url.endsWith('/fund')).body).toMatchObject({verb:'callin',userId:'4242'});
});


it('BUG-127: a completed quiet shift explains the missing replay in the desktop companion',async()=>{
 telegram.signIn();fetchMock.route('/hands',{recentHands:[{handNumber:1}]});fetchMock.route('/flagged',{flaggedHands:[]});
 renderPanel();
 expect(await screen.findByText('NOTHING WORTH FLAGGING')).toBeInTheDocument();
 expect(screen.getByText('When a hand is worth watching, it arrives here as a replay you can scrub.')).toBeInTheDocument();
});
