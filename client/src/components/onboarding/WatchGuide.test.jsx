import { useEffect, useRef } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FirstRunGuideProvider, useFirstRunGuide } from './FirstRunGuide.jsx';
import { WatchGuide } from './WatchGuide.jsx';
import { clearGuest, isGuest, onClaimWall } from '../../lib/guest.js';

const agent = { id: 'pebble', name: 'Pebble' };
const game = { tableId: 'table-one', seats: [
  { playerId: 'agent_pebble', displayName: 'Pebble' },
  { playerId: 'house_granite', displayName: 'Granite' },
] };
let guide;
beforeEach(() => {
  clearGuest();
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const left = this.dataset.target === 'chat' ? 410 : 100;
    const top = this.dataset.target === 'status' ? 40 : 250;
    const width = this.dataset.testid === 'context-hint' ? 240 : this.dataset.target ? 100 : 1024;
    const height = this.dataset.testid === 'context-hint' ? 112 : this.dataset.target ? 44 : 768;
    return { left, top, width, height, right: left + width, bottom: top + height };
  });
});
afterEach(() => { clearGuest(); vi.restoreAllMocks(); });

function Scene({ table = game, ownedAgent = agent, privateChat = true, blocked = false,
  showChat = true, showOwn = true, showOpponent = true, externalChat = false, onInteract = vi.fn() }) {
  const rootRef = useRef(null), chatRef = useRef(null);
  guide = useFirstRunGuide();
  useEffect(() => { guide.begin(agent); guide.advance('live'); }, []);
  const chat = showChat && <div><input data-target="chat" className="watch-composer__input" ref={chatRef} aria-label="Whisper" onChange={onInteract}/></div>;
  return <>
    <main ref={rootRef}>
      <span data-watch-status data-target="status">Watching</span>
      {!externalChat && chat}
      <div className="watch-felt" data-watch-hero-seat="0">
        {showOwn && <button className="watch-hero__body" onClick={onInteract}><span className="mood-ghost" data-target="own">Pebble</span></button>}
        {showOpponent && <div className="watch-felt__seat" data-watch-seat="1"><button className="seat-ghost" data-target="opponent" onClick={onInteract}>Granite</button></div>}
      </div>
      <WatchGuide rootRef={rootRef} game={table} heroSeat={0} ownedAgent={ownedAgent} privateChat={privateChat}
        chatRef={externalChat ? chatRef : null} blocked={blocked}/>
    </main>
    {externalChat && chat}
  </>;
}
const show = props => render(<FirstRunGuideProvider ownerId="guide-owner"><Scene {...props}/></FirstRunGuideProvider>);
const hint = () => screen.getByRole('note', { name: 'Getting started' });
const ok = () => fireEvent.click(within(hint()).getByRole('button', { name: 'OK', exact: true }));

it('LIVE-GUIDE: OK explains watching, whisper, own agent and opponent without activating controls', async () => {
  const onInteract = vi.fn(); show({ onInteract });
  expect(await screen.findByTestId('context-hint')).toHaveTextContent('You are watching. Your AI agent is playing.');
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ top: '40px', height: '44px' });
  ok(); expect(hint()).toHaveTextContent('Talk to your agent here.');
  expect(guide.stage).toBe('live-chat');
  ok(); expect(hint()).toHaveTextContent('This is Pebble. Tap to talk.');
  expect(guide.stage).toBe('live-agent');
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ width: '100px', height: '44px' });
  ok(); expect(hint()).toHaveTextContent('An opponent. Tap to see what is known about them.');
  expect(guide.stage).toBe('live-opponent');
  ok(); expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(onInteract).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(document.body);
  expect(JSON.parse(localStorage.getItem('railbird.guide.v1:guide-owner'))).toEqual({ version: 1, seen: true });
});

it.each([
  ['public table', { ownedAgent: null, privateChat: false }],
  ['kitchen table', { privateChat: false }],
  ['same-name stranger', { table: { ...game, seats: [{ playerId: 'agent_someone-else', displayName: 'Pebble' }, game.seats[1]] } }],
  ['guest projection', { ownedAgent: { ...agent, guest: true } }],
])('LIVE-GUIDE: %s skips unavailable private conversation and ownership claims', async (_, props) => {
  show(props); await screen.findByTestId('context-hint');
  expect(hint()).toHaveTextContent('You are watching. The AI players make their own decisions.');
  ok(); expect(hint()).toHaveTextContent('An opponent. Tap to see what is known about them.');
  expect(guide.stage).toBe('live-opponent');
  ok(); expect(screen.queryByTestId('context-hint')).toBeNull();
});

it('LIVE-GUIDE: human or unknown public players are not called AI', async () => {
  show({ ownedAgent: null, privateChat: false, table: { ...game, seats: [{ playerId: 'person-one' }, { playerId: 'person-two' }] } });
  expect(await screen.findByTestId('context-hint')).toHaveTextContent('You are watching. The players make their own decisions.');
});

it('LIVE-GUIDE: an external desktop composer is the actual target, without focusing it', async () => {
  show({ externalChat: true }); await screen.findByTestId('context-hint'); ok();
  expect(hint()).toHaveTextContent('Talk to your agent here.');
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '410px' });
  expect(screen.getByRole('textbox', { name: 'Whisper' })).not.toHaveFocus();
});

it('LIVE-GUIDE: a guest owner keeps the real chat pointer with an honest sign-in requirement', async () => {
  localStorage.setItem('agentic_guest_owner', 'guide-owner');
  expect(isGuest()).toBe(true);
  const onInteract = vi.fn(), claim = vi.fn(), unsubscribe = onClaimWall(claim);
  const network = vi.spyOn(globalThis, 'fetch');
  try {
    show({ externalChat: true, onInteract });
    expect(await screen.findByTestId('context-hint')).toHaveTextContent('You are watching. Your AI agent is playing.');
    ok();
    expect(hint()).toHaveTextContent('Sign in to talk to your agent here.');
    expect(guide.stage).toBe('live-chat');
    expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '410px' });
    expect(screen.getByRole('textbox', { name: 'Whisper' })).not.toHaveFocus();
    ok();
    expect(hint()).toHaveTextContent('This is Pebble. Tap to talk.');
    expect(onInteract).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});

it('LIVE-GUIDE: missing real chat, own body and opponent targets do not stall the next click', async () => {
  show({ showChat: false, showOwn: false, showOpponent: false });
  await screen.findByTestId('context-hint'); ok();
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(guide.stage).toBeNull();
});

it('LIVE-GUIDE: blocking overlays pause the exact step and ownership loss cannot retain a private hint', async () => {
  const view = show(); await screen.findByTestId('context-hint'); ok();
  view.rerender(<FirstRunGuideProvider ownerId="guide-owner"><Scene blocked/></FirstRunGuideProvider>);
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(guide.stage).toBe('live-chat');
  view.rerender(<FirstRunGuideProvider ownerId="guide-owner"><Scene/></FirstRunGuideProvider>);
  expect(await screen.findByTestId('context-hint')).toHaveTextContent('Talk to your agent here.');
  view.rerender(<FirstRunGuideProvider ownerId="guide-owner"><Scene ownedAgent={null}/></FirstRunGuideProvider>);
  expect(await screen.findByTestId('context-hint')).toHaveTextContent('An opponent. Tap to see what is known about them.');
});

it('LIVE-GUIDE: skipping a live step remains seen after a reload', async () => {
  const first = show(); await screen.findByTestId('context-hint'); ok();
  fireEvent.click(within(hint()).getByRole('button', { name: 'Skip' }));
  first.unmount(); show();
  await act(async () => {});
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(guide.stage).toBeNull();
});
