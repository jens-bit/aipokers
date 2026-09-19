// client/src/screens/CasinoScreen.test.jsx — CASINO-1, UI-3 job A
//
// The casino is the only place a deploy happens, so the gate on it is the
// thing worth proving. Board 27's law 4 survives UI-3 job A unchanged: a
// stake he cannot afford is shut and says the price — a fact about his
// pocket, never a paywall — and the only thing that opens it is his chips.
//
// UI-3 job A deleted the building (three doorways, a Floor|Board toggle, a
// swipe between rooms) and replaced it with a single floor showing every
// live table at once, each carrying its own stakes. What used to be
// "CASINO-1 the building" below is now about that one floor; the doorway,
// toggle and swipe describe blocks are gone with the thing they tested.

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CasinoScreen, canAfford, defaultRoom, isRoomHot } from './CasinoScreen.jsx';
import {
  rooms, hotRooms, floorRoom, upstairsRoom, backRoom, casinoEvent, felt, myFelt,
} from '../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const POCKET = { mode: 'allowance', cap: 5000, broke: false, collectable: 0, pnl: 0 };
const withPocket = (agent, balance, over = {}) => ({
  ...agent,
  pocket: { ...POCKET, balance, ...over },
});

// Broke: cannot cover the $2,000 entry buy-in, which is a bigger number than
// zero — the same law src/server/wallet.js applies.
const brokeCannon = withPocket(restingAgent, 400, { broke: true });
const fundedCannon = withPocket(restingAgent, 2_500);
const richCannon = withPocket(restingAgent, 6_000);

function routeFloor({ agents = [], rooms: floor = rooms, events = [], felts = [] } = {}) {
  fetchMock.route('/api/rooms', { rooms: floor, hotWindowMs: 20_000 });
  fetchMock.route(
    /\/api\/rooms\/([^/]+)\/tables$/,
    ({ url }) => {
      const room = url.match(/\/api\/rooms\/([^/]+)\/tables$/)?.[1];
      return { room, tables: felts.filter((f) => f.room === room), hotWindowMs: 20_000 };
    },
  );
  fetchMock.route('/api/events', { events, lastId: events.length });
  fetchMock.route('/api/agents', { agents });
  fetchMock.route('/api/wallet', { balance: 9_000, staked: 0, session: 0, ledger: [] });
}

function renderCasino(props = {}) {
  return render(<CasinoScreen {...props} />);
}

describe('floor recovery', () => {
  it.each([
    { liveGame: { tableId: 'kitchen', home: true }, homeTableId: 'kitchen' },
    { activeTableId: 'home-4242' },
    { location: { where: 'home', tableId: 'home-4242' } },
  ])('BUG-234: kitchen-table presence still lets the owner place him in the casino (%j)', async home => {
    const kitchen = { ...fundedCannon, ...home };
    routeFloor({ agents: [kitchen] });
    fetchMock.route('/queue', { tableId: 'casino-seat', agentId: kitchen.id }, { method: 'POST' });
    const deployed = vi.fn();
    renderCasino({ deployAgent: kitchen, onDeployed: deployed });
    await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
    expect(deployed).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'casino-seat' }), kitchen, expect.any(Object));
  });

  it('BUG-234: confirmation retires the temporary placement guard so a returning agent can play again', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let roster = [fundedCannon];
      routeFloor();
      fetchMock.route('/api/agents?', () => ({ agents: roster }));
      fetchMock.route('/queue', { tableId: 'casino-seat', agentId: fundedCannon.id }, { method: 'POST' });
      renderCasino({ deployAgent: fundedCannon, onDeployed: vi.fn() });
      await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
      expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
      roster = [{ ...fundedCannon, activeTableId: 'casino-seat' }];
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      roster = [fundedCannon];
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(await screen.findByRole('button', { name: 'Deal him in' })).toBeEnabled();
      await userEvent.click(screen.getByRole('button', { name: 'Deal him in' }));
      expect(fetchMock.posts.filter(request => request.url.endsWith('/queue'))).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it('BUG-227: Watch keeps the selected companion when two share the same table', async () => {
    const first = { ...fundedCannon, id: 'first', name: 'First', activeTableId: 'shared' };
    const second = { ...fundedCannon, id: 'second', name: 'Second', activeTableId: 'shared' };
    routeFloor({ agents: [first, second], felts: [felt({ tableId: 'shared' })] });
    const spectate = vi.fn();
    renderCasino({ onSpectate: spectate });
    await userEvent.click(await screen.findByRole('tab', { name: 'Second' }));
    await userEvent.click(screen.getByRole('button', { name: 'Watch Second at 10/20' }));
    expect(spectate).toHaveBeenCalledWith('shared', { agent: expect.objectContaining({ id: 'second' }) });
  });
  it('BUG-234: a confirmed placement dismisses the tray before the parent navigates', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new', agentId: fundedCannon.id }, { method: 'POST' });
    const deployed = vi.fn();
    renderCasino({ deployAgent: fundedCannon, onDeployed: deployed });
    await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
    await waitFor(() => expect(deployed).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('casino-deploy')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Loose Cannon to play' })).toBeNull();
  });

  it('BUG-234: a queue receipt naming another agent keeps this placement retryable', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new', agentId: 'different-agent' }, { method: 'POST' });
    const deployed = vi.fn();
    renderCasino({ deployAgent: fundedCannon, onDeployed: deployed });
    await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Loose Cannon’s table could not be opened. Try again.');
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeEnabled();
    expect(deployed).not.toHaveBeenCalled();
  });

  it('BUG-234: an agent already at a table cannot remain in the placement tray', async () => {
    routeFloor({ agents: [{ ...fundedCannon, activeTableId: 'tbl-seated' }] });
    renderCasino({ deployAgent: fundedCannon });
    await screen.findByTestId('your-tables');
    expect(screen.queryByTestId('casino-deploy')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
  });

  it('BUG-235: a placement refusal states the server remedy and remains retryable', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', { status: 409, body: { error: 'tooTired', message: 'Give me three snacks or a couple of hours.' } }, { method: 'POST' });
    const deployed = vi.fn();
    renderCasino({ deployAgent: fundedCannon, onDeployed: deployed });
    await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give me three snacks or a couple of hours.');
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeEnabled();
    expect(deployed).not.toHaveBeenCalled();
  });

  it('BUG-235: a dropped placement request says the table could not be opened', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', () => { throw new Error('offline'); }, { method: 'POST' });
    renderCasino({ deployAgent: fundedCannon });
    await userEvent.click(await screen.findByRole('button', { name: 'Deal him in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Loose Cannon’s table could not be opened. Try again.');
  });

  it('BUG-236: labels the public census separately from your agents and deduplicates their table', async () => {
    const a = { ...fundedCannon, activeTableId: 'shared' };
    const b = { ...fundedCannon, id: 'second', name: 'Second', activeTableId: 'shared' };
    routeFloor({ agents: [a, b], rooms: [{ ...floorRoom, seated: 4, tables: 2 }], felts: [felt({ tableId: 'shared' })] });
    renderCasino();
    expect(await screen.findByText('Your agents: 2 at 1 table')).toBeInTheDocument();
    expect(screen.getByLabelText('Everyone on the floor, including the House')).toHaveTextContent('4 in · 2 tables');
  });

  it('BUG-237: phone Home navigation precedes your table and the room', async () => {
    routeFloor({ agents: [fundedCannon] });
    renderCasino({ onBack: vi.fn() });
    const your = await screen.findByTestId('your-tables');
    const back = screen.getByRole('button', { name: 'Back home', exact: true });
    expect(back.compareDocumentPosition(your) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

const stake = (label) => screen.getByRole('button', { name: new RegExp(`^${label.replace(/[$/]/g, '\\$&')}`) });

it('N3: the casino conversation follows the carousel agent and sends to him', async () => {
  telegram.signIn();
  const bal={...fundedCannon,id:'bal',name:'Bal',unseenRecap:false}, agg={...fundedCannon,id:'agg',name:'Agg',unseenRecap:false};
  routeFloor({agents:[bal,agg]});
  fetchMock.route('/thread',({url})=>({lines:[{id:1,kind:'him',text:url.includes('/bal/')?'Watch this one.':'My turn.',ts:Date.now()}]}));
  const send=vi.fn().mockResolvedValue({ok:true});
  renderCasino({onSend:send});
  expect(await screen.findByTestId('home-thread-line')).toHaveTextContent('Bal');
  await userEvent.click(screen.getByRole('tab',{name:'Agg'}));
  await waitFor(()=>expect(screen.getByTestId('home-thread-line')).toHaveTextContent('My turn.'));
  await userEvent.type(screen.getByRole('textbox',{name:'Say something to Agg'}),'Hold your nerve');
  await userEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({id:'agg'}),'Hold your nerve');
  await userEvent.click(screen.getByTestId('home-thread-line'));
  expect(screen.getByRole('dialog',{name:"Agg's thread"})).toHaveTextContent('HIS CONVERSATION');
});

// ── The gate, as pure functions ─────────────────────────────────────────────

describe('CASINO-1 the pocket gate', () => {
  it('canAfford is the buy-in, not the blinds', () => {
    expect(canAfford({ balance: 2_000 }, floorRoom)).toBe(true);
    expect(canAfford({ balance: 1_999 }, floorRoom)).toBe(false);
    expect(canAfford({ balance: 9_999 }, backRoom)).toBe(false);
    expect(canAfford(null, floorRoom)).toBe(false);
    expect(canAfford({ balance: 99_999 }, null)).toBe(false);
  });

  it('the tray opens on the highest rung his pocket buys', () => {
    expect(defaultRoom(rooms, { balance: 2_500 })?.id).toBe('floor');
    expect(defaultRoom(rooms, { balance: 6_000 })?.id).toBe('upstairs');
    expect(defaultRoom(rooms, { balance: 40_000 })?.id).toBe('backroom');
  });

  it('and on the lowest — shut, stating the price — when he can afford none', () => {
    expect(defaultRoom(rooms, { balance: 10 })?.id).toBe('floor');
  });
});

describe('CASINO-1 what counts as hot', () => {
  it('needs the server to name a table and the client clock to still agree', () => {
    const room = { hot: ['tbl-hot'] };
    expect(isRoomHot(room, new Set(['tbl-hot']))).toBe(true);
    expect(isRoomHot(room, new Set(['tbl-other']))).toBe(false);
    // No ticker yet: the server said so recently, so the chip glows.
    expect(isRoomHot(room, new Set())).toBe(true);
    expect(isRoomHot({ hot: [] }, new Set(['tbl-hot']))).toBe(false);
  });
});

// ── The screen ──────────────────────────────────────────────────────────────

describe('UI-3 job A · one floor, at rest', () => {
  it('shows every table on one floor, with no doorway anywhere', async () => {
    routeFloor({ felts: [felt({ tableId: 't1', room: 'floor' }), felt({ tableId: 't2', room: 'upstairs' })] });
    renderCasino();

    const view = await screen.findByTestId('floor-view');
    expect(view.dataset.room).toBe('floor');
    expect(view.querySelectorAll('.csn-felt58')).toHaveLength(2);
    expect(document.querySelector('.csn-room-door')).toBeNull();
    expect(document.querySelector('.csn-door')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Board', exact: true })).toBeNull();
  });

  it('says how many are on the floor and how many are yours', async () => {
    routeFloor({ agents: [playingAgent] });
    renderCasino();
    // 17 + 9 + 0 seats filled across the whole ladder, 4 + 2 + 0 tables.
    expect(await screen.findByText('26 in · 6 tables')).toBeInTheDocument();
  });

  it('a floor that never answers says so instead of drawing an empty one', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/rooms', { status: 500, body: {} });
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    renderCasino();

    expect(await screen.findByText('Nothing is running right now.')).toBeInTheDocument();
  });

  // The bug this kills: entering used to auto-target one specific room, so a
  // table live in a different one read as "nothing running". There is no
  // room left to mis-target — the floor always shows every table there is.
  it('BUG-231: a table live anywhere on the ladder shows up, with no room to mis-target', async () => {
    routeFloor({ felts: [felt({ tableId: 'tbl-upstairs', room: 'upstairs', pot: 900 })] });
    renderCasino();

    expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
    expect(screen.getByText('$900')).toBeInTheDocument();
  });

  it('tapping a live pot watches that felt', async () => {
    const onSpectate = vi.fn();
    routeFloor({ felts: [felt({ tableId: 'tbl-a', pot: 8_400 })] });
    const user = userEvent.setup();
    renderCasino({ onSpectate });

    const row = await screen.findByRole('button', { name: /Watch this table/ });
    await user.click(row);
    expect(onSpectate).toHaveBeenCalledWith('tbl-a');
  });

  it('and tapping one of your own finished hands replays it, once nothing is live', async () => {
    const onReplay = vi.fn();
    routeFloor({
      agents: [playingAgent],
      events: [casinoEvent({
        id: 7, headline: 'Ozymandias cracked aces', tableId: 'tbl-a',
        agentIds: ['agent_grinder'], handNumber: 41,
      })],
    });
    const user = userEvent.setup();
    renderCasino({ onReplay });

    const line = await screen.findByRole('button', { name: /Replay this hand/ });
    await user.click(line);
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ id: 7, handNumber: 41 }));
  });

  it('a hot table is on the ticker at the very top of the screen', async () => {
    const onSpectate = vi.fn();
    routeFloor({ felts: [felt({ tableId: 'tbl-hot', hot: true, pot: 4_180 })] });
    const user = userEvent.setup();
    renderCasino({ onSpectate });

    expect(await screen.findByText('HOT · WATCH')).toBeInTheDocument();
    await user.click(screen.getByTestId('casino-ticker'));
    expect(onSpectate).toHaveBeenCalledWith('tbl-hot');
  });

  it('with nobody to place there is no tray, and no stake is shut', async () => {
    routeFloor();
    renderCasino();

    await screen.findByTestId('floor-view');
    expect(document.querySelector('.csn-tray')).toBeNull();
    expect(document.querySelector('.csn-stakes')).toBeNull();
    expect(document.querySelector('[data-shut]')).toBeNull();
  });

  it('the staircase inside the room goes home when tapped', async () => {
    const onBack = vi.fn();
    routeFloor({ felts: [felt()] });
    const user = userEvent.setup();
    renderCasino({ onBack });

    await screen.findByTestId('floor-view');
    await user.click(screen.getByRole('button', { name: /go home/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // UI-3 job A: an old room id (a stale deep link, or a session left over
  // from before this change) must resolve to the one floor rather than
  // erroring or targeting a room that is no longer a destination.
  it('an old room id still lands cleanly on the one floor', async () => {
    routeFloor();
    renderCasino({ initialRoomId: 'upstairs' });
    expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
  });
});

// ── CASINO-2 job 4 · your table ─────────────────────────────────────────────
// Unrelated to which room is on screen — UI-3 job A leaves this block exactly
// where CASINO-2 job 4 put it, just no longer gated behind having walked in.

describe('CASINO-2 job 4 · your table, once per man', () => {
  const atFelt = {
    ...playingAgent,
    activeTableId: 'tbl-mine',
    liveGame: { ...playingAgent.liveGame, tableId: 'tbl-mine' },
  };

  it('draws his real game off the felts', async () => {
    routeFloor({ agents: [atFelt], felts: [myFelt({ pot: 940 })] });
    renderCasino();

    const block = await screen.findByTestId('your-tables');
    expect(within(block).getByText('YOUR TABLE · 10/20')).toBeInTheDocument();
    expect(within(block).getByText('$940')).toBeInTheDocument();
  });

  it('and says where he is instead when he is at no felt — never a ghost at a table', async () => {
    routeFloor({ agents: [restingAgent], felts: [] });
    renderCasino();

    const block = await screen.findByTestId('your-tables');
    expect(within(block).getByText(/Loose Cannon is /)).toBeInTheDocument();
    expect(block.querySelector('.csn-felt')).toBeNull();
  });

  it('is not on the screen while you are placing somebody — that screen is the tray', async () => {
    routeFloor({ agents: [atFelt, fundedCannon], felts: [myFelt()] });
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    expect(screen.queryByTestId('your-tables')).toBeNull();
  });
});

// ── Deploy ──────────────────────────────────────────────────────────────────

describe('UI-3 job A deploy: choosing a stake instead of a room', () => {
  it('you arrive with him in the tray, not in a picker', async () => {
    routeFloor({ agents: [fundedCannon] });
    renderCasino({ deployAgent: fundedCannon });

    expect(await screen.findByText('placing Loose Cannon')).toBeInTheDocument();
    expect(await screen.findByText('pocket $2,500 · buy-in at 10/20 is $2,000'))
      .toBeInTheDocument();
    // He is stated, never chosen: no roster to pick from on this screen.
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('law 4: a stake his pocket cannot cover is shut and says the price', async () => {
    routeFloor({ agents: [fundedCannon] });
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    expect(stake('$25/$50')).toHaveAttribute('data-shut', 'true');
    expect(stake('$50/$100')).toHaveAttribute('data-shut', 'true');
    expect(stake('$10/$20')).not.toHaveAttribute('data-shut');

    expect(within(stake('$25/$50')).getByText('$5,000 buy-in')).toBeInTheDocument();
    expect(within(stake('$50/$100')).getByText('$10,000 buy-in')).toBeInTheDocument();
  });

  it('BUG-45: a bigger pocket opens the stake above', async () => {
    routeFloor({ agents: [richCannon] });
    renderCasino({ deployAgent: richCannon });

    await screen.findByText('placing Loose Cannon');
    expect(stake('$25/$50')).not.toHaveAttribute('data-shut');
    expect(await screen.findByText('pocket $6,000 · buy-in at 25/50 is $5,000')).toBeInTheDocument();
  });

  // FIX-6 job 2's rule survives the doorway it was written about: tapping an
  // open stake deals him into it — one tap, no second confirmation.
  it('tapping an open stake deals him into it — one tap, no second confirmation', async () => {
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new', agentId: 'agent_cannon' }, { method: 'POST' });
    const onDeployed = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('pocket $6,000 · buy-in at 25/50 is $5,000');
    await user.click(stake('$10/$20'));

    await waitFor(() => expect(onDeployed).toHaveBeenCalled());
    const post = fetchMock.posts.find((c) => c.url.includes('/queue'));
    expect(post.body).toMatchObject({ rung: 0, stakes: { bigBlind: 20, buyIn: 2_000 } });
    expect(onDeployed.mock.calls[0][2].id).toBe('floor');
  });

  it('tapping a shut stake opens his chips — the only thing that opens it', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new' }, { method: 'POST' });
    const user = userEvent.setup();
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    await user.click(stake('$50/$100'));

    expect(await screen.findByRole('dialog', { name: 'Fund Loose Cannon' })).toBeInTheDocument();
    expect(fetchMock.posts.filter((c) => c.url.includes('/queue'))).toHaveLength(0);
  });

  it('a pocket that covers nothing offers his chips instead of the deal', async () => {
    routeFloor({ agents: [brokeCannon] });
    renderCasino({ deployAgent: brokeCannon });

    expect(await screen.findByRole('button', { name: 'His chips' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
  });

  it('Deal him in POSTs the deploy for the stake the tray opened on, and hands back a room', async () => {
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', {
      tableId: 'tbl-new', agentId: 'agent_cannon', agentName: 'Loose Cannon',
      strategy: 'Bets big, bluffs often.', memoryContext: '',
    }, { method: 'POST' });
    const onDeployed = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('pocket $6,000 · buy-in at 25/50 is $5,000');
    await user.click(screen.getByRole('button', { name: 'Deal him in' }));

    await waitFor(() => expect(onDeployed).toHaveBeenCalled());
    const post = fetchMock.posts.find((c) => c.url.includes('/queue'));
    expect(post.body).toMatchObject({ rung: 1, stakes: { bigBlind: 50, buyIn: 5_000 } });
    expect(onDeployed.mock.calls[0][0]).toMatchObject({ tableId: 'tbl-new' });
    expect(onDeployed.mock.calls[0][2].id).toBe('upstairs');
  });

  it('a broke pocket never reaches the deploy route at all', async () => {
    routeFloor({ agents: [brokeCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new' }, { method: 'POST' });
    const user = userEvent.setup();
    renderCasino({ deployAgent: brokeCannon });

    await user.click(await screen.findByRole('button', { name: 'His chips' }));
    await screen.findByRole('dialog', { name: 'Fund Loose Cannon' });
    expect(fetchMock.posts.filter((c) => c.url.includes('/queue'))).toHaveLength(0);
  });

  it('"Not now" puts him back down', async () => {
    routeFloor({ agents: [fundedCannon] });
    const onCancelDeploy = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: fundedCannon, onCancelDeploy });

    await screen.findByText('placing Loose Cannon');
    await user.click(screen.getByRole('button', { name: 'Stop placing him' }));
    expect(onCancelDeploy).toHaveBeenCalled();
  });
});
