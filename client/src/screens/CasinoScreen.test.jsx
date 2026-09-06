// client/src/screens/CasinoScreen.test.jsx — CASINO-1
//
// The casino is the only place a deploy happens, so the gate on it is the
// thing worth proving. Board 27's law 4: a room he cannot afford is shut and
// says the price — a fact about his pocket, never a paywall — and the only
// thing that opens it is his chips.
//
// Also asserted here: the building joins three live sources without any of
// them being able to take it down, your own agents appear in the doorway of
// the room they are sitting in, and the ticker's tap reaches a felt.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasinoScreen, canAfford, defaultRoom, isRoomHot, hotFocus } from './CasinoScreen.jsx';
import {
  rooms, hotRooms, roomsResponse, floorRoom, upstairsRoom, backRoom, casinoEvent, felt, myFelt,
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
  // CASINO-2: the felts inside those rooms. Registered after /api/rooms because
  // routes match newest-first and this URL starts with that one. With no socket
  // in these tests this REST path is the whole of ROOM_TABLES, which is exactly
  // the fallback the hook is meant to have.
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

const door = (name) => screen.getByRole('button', { name: new RegExp(`^${name},`) });

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
    // No ticker yet: the server said so recently, so the door glows.
    expect(isRoomHot(room, new Set())).toBe(true);
    expect(isRoomHot({ hot: [] }, new Set(['tbl-hot']))).toBe(false);
  });

  it('names the pot and whose it is', () => {
    const focus = hotFocus(hotRooms, new Set(['tbl-hot']), [
      { ...playingAgent, activeTableId: 'tbl-hot' },
    ]);
    expect(focus.tableId).toBe('tbl-hot');
    expect(focus.pot).toBe(4_180);
    expect(focus.agent.name).toBe('The Grinder');
  });

  it('and is null on a quiet floor', () => {
    expect(hotFocus(rooms, new Set(), [])).toBeNull();
  });
});

// ── The screen ──────────────────────────────────────────────────────────────

describe('CASINO-1 the building', () => {
  beforeEach(() => { telegram.signIn(); });

  // CASINO-2 job 3 split the doorway in two. AT REST the rooms are three small
  // doors under the sign — the building's own organisation, the only navigation
  // on the screen, and 60px rather than 152 because a door you are walking
  // through is not a decision. The TALL doorway is the DEPLOY choice and is
  // asserted with somebody in the tray, below, where it now lives.
  it('draws one door per room, in ladder order, under the sign', async () => {
    routeFloor();
    const { container } = renderCasino();

    await waitFor(() => expect(container.querySelectorAll('.csn-room-door')).toHaveLength(3));
    expect([...container.querySelectorAll('.csn-room-door')].map((d) => d.dataset.room))
      .toEqual(['floor', 'upstairs', 'backroom']);
    expect(screen.getByText('THE FLOOR')).toBeInTheDocument();
    expect(screen.getByText('UPSTAIRS')).toBeInTheDocument();
    // A row of signs, not a row of sentences: the article goes when what is
    // left is still more than one word.
    expect(screen.getByText('BACK ROOM')).toBeInTheDocument();
  });

  it('each door says what it costs to sit and how many are in there', async () => {
    routeFloor();
    renderCasino();

    await screen.findByText('THE FLOOR');
    expect(screen.getByText('10/20')).toBeInTheDocument();
    expect(screen.getByText('25/50')).toBeInTheDocument();
    expect(screen.getByText('50/100')).toBeInTheDocument();
    expect(screen.getByText('17 in')).toBeInTheDocument();
    // A room always exists; the quiet back room reports zeroes.
    expect(screen.getByText('0 in')).toBeInTheDocument();
  });

  it('and marks the room one of yours is in', async () => {
    routeFloor({ agents: [withPocket(playingAgent, 3_000)] });
    const { container } = renderCasino();

    await waitFor(() => {
      const floor = container.querySelector('.csn-room-door[data-room="floor"]');
      expect(floor.dataset.mine).toBe('true');
      expect(within(floor).getByText(/1 yours/)).toBeInTheDocument();
    });
    expect(container.querySelector('.csn-room-door[data-room="upstairs"]').dataset.mine)
      .toBeUndefined();
  });

  it('the sign over the door is lit, and dark over a building with nothing in it', async () => {
    routeFloor();
    const { container } = renderCasino();
    await waitFor(() => expect(container.querySelector('.csn-marquee').dataset.lit).toBe('true'));
    expect(screen.getByText('The casino')).toBeInTheDocument();
  });

  it('the tall doorways are the deploy choice, and they arrive with the tray', async () => {
    routeFloor({ agents: [fundedCannon] });
    const { container } = renderCasino({ deployAgent: fundedCannon });

    await waitFor(() => expect(container.querySelectorAll('.csn-door')).toHaveLength(3));
    expect([...container.querySelectorAll('.csn-door')].map((d) => d.dataset.room))
      .toEqual(['floor', 'upstairs', 'backroom']);
    expect(screen.getByText('the back room')).toBeInTheDocument();
  });

  it('says how many are in the building and how many are yours', async () => {
    routeFloor({ agents: [playingAgent] });
    renderCasino();
    // 17 + 9 + 0 seats filled, one of them yours and actually in a hand.
    expect(await screen.findByText('26 playing · 1 of yours in')).toBeInTheDocument();
  });

  it('puts your agent in the doorway of the room he is sitting in', async () => {
    // With the tray, because that is where the tall doorway lives since
    // CASINO-2 job 3 — and it is the moment the fact matters most: you are
    // about to put another man somewhere, and one of yours is already there.
    routeFloor({ agents: [fundedCannon, withPocket(playingAgent, 3_000, { pnl: 1_240 })] });
    const { container } = renderCasino({ deployAgent: fundedCannon });

    await waitFor(() => {
      const floor = container.querySelector('.csn-door[data-room="floor"]');
      // BUGS-A job 1: the doorway chip carries his whole name.
      expect(within(floor).getByText('The Grinder')).toBeInTheDocument();
    });
    // He plays at 10/20, so upstairs has nobody of yours in it.
    const upstairs = container.querySelector('.csn-door[data-room="upstairs"]');
    expect(within(upstairs).queryByText('The Grinder')).not.toBeInTheDocument();
  });

  it('a floor that never answers says so instead of drawing an empty room', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/rooms', { status: 500, body: {} });
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    renderCasino();

    expect(await screen.findByText('The floor has not opened yet.')).toBeInTheDocument();
  });

  // CASINO-2 job 2 replaced "tapping a ticker line spectates that table". The
  // rule it encoded is one the split reverses on purpose: a ticker line is a
  // hand that is OVER, and sending it to a live felt was the board offering to
  // watch something that had already finished. The tap that reaches a felt is
  // LIVE NOW's, and it is a better one — it goes to the pot being built rather
  // than to whatever table a two-minute-old headline happened to name.
  it('tapping a live pot watches that felt', async () => {
    const onSpectate = vi.fn();
    routeFloor({ felts: [felt({ tableId: 'tbl-a', pot: 8_400 })] });
    const user = userEvent.setup();
    renderCasino({ onSpectate });

    const row = await screen.findByRole('button', { name: /Watch this table/ });
    await user.click(row);
    expect(onSpectate).toHaveBeenCalledWith('tbl-a');
  });

  it('and tapping one of your own finished hands replays it', async () => {
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

  it('a hot felt asks for you, and the ask is one action', async () => {
    const onSpectate = vi.fn();
    routeFloor({ rooms: hotRooms, agents: [{ ...playingAgent, activeTableId: 'tbl-hot' }] });
    const user = userEvent.setup();
    renderCasino({ onSpectate });

    expect(await screen.findByText('$4,180 in the middle, upstairs')).toBeInTheDocument();
    expect(screen.getByText('The Grinder is in the hand')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Watch him' }));
    expect(onSpectate).toHaveBeenCalledWith('tbl-hot');
  });

  it('with nobody to place there is no tray, and no room is shut', async () => {
    routeFloor();
    const { container } = renderCasino();

    await waitFor(() => expect(container.querySelectorAll('.csn-room-door')).toHaveLength(3));
    expect(container.querySelector('.csn-tray')).toBeNull();
    // Not one tall doorway either: with nothing to place there is no choice to
    // give a third of the screen to, and a room's price is a fact about a
    // pocket that is not in the room.
    expect(container.querySelectorAll('.csn-door')).toHaveLength(0);
    expect(container.querySelector('[data-shut]')).toBeNull();
  });
});

// ── CASINO-2 job 4 · your table ─────────────────────────────────────────────

describe('CASINO-2 job 4 · your table, once per man', () => {
  beforeEach(() => { telegram.signIn(); });

  const atFelt = {
    ...playingAgent,
    activeTableId: 'tbl-mine',
    liveGame: { ...playingAgent.liveGame, tableId: 'tbl-mine' },
  };

  it('draws his real game off the felts, at the foot of the screen', async () => {
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

describe('CASINO-1 deploy', () => {
  beforeEach(() => { telegram.signIn(); });

  it('you arrive with him in the tray, not in a picker', async () => {
    routeFloor({ agents: [fundedCannon] });
    renderCasino({ deployAgent: fundedCannon });

    expect(await screen.findByText('placing Loose Cannon')).toBeInTheDocument();
    expect(await screen.findByText('pocket $2,500 · buy-in at $10/$20 is $2,000'))
      .toBeInTheDocument();
    // He is stated, never chosen: no roster to pick from on this screen.
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('law 4: a room his pocket cannot cover is shut and says the price', async () => {
    routeFloor({ agents: [fundedCannon] });
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    expect(door('upstairs')).toHaveAttribute('data-shut', 'true');
    expect(door('the back room')).toHaveAttribute('data-shut', 'true');
    expect(door('the floor')).not.toHaveAttribute('data-shut');

    expect(within(door('upstairs')).getByText('$5,000')).toBeInTheDocument();
    expect(within(door('the back room')).getByText('$10,000')).toBeInTheDocument();
  });

  it('a bigger pocket opens the room above', async () => {
    routeFloor({ agents: [richCannon] });
    renderCasino({ deployAgent: richCannon });

    await screen.findByText('placing Loose Cannon');
    expect(door('upstairs')).not.toHaveAttribute('data-shut');
    // The tray opens on the rung he actually buys.
    expect(screen.getByText('pocket $6,000 · buy-in at $25/$50 is $5,000')).toBeInTheDocument();
  });

  // FIX-6 job 2 replaces the old rule here. It used to be "picking an open room
  // re-states the decision in the tray" — a doorway SELECTED and the tray
  // CONFIRMED. The want already asked the question ("put me in?") and the owner
  // already answered it, so the confirmation was asking it a second time. The
  // doorway is the deal now, and the test says so rather than being loosened.
  it('tapping an open room deals him into it — one tap, no second confirmation', async () => {
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new', agentId: 'agent_cannon' }, { method: 'POST' });
    const onDeployed = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('pocket $6,000 · buy-in at $25/$50 is $5,000');
    await user.click(door('the floor'));

    await waitFor(() => expect(onDeployed).toHaveBeenCalled());
    const post = fetchMock.posts.find((c) => c.url.includes('/queue'));
    expect(post.body).toMatchObject({ rung: 0, stakes: { bigBlind: 20, buyIn: 2_000 } });
    expect(onDeployed.mock.calls[0][2].id).toBe('floor');
  });

  it('tapping a shut room opens his chips — the only thing that opens it', async () => {
    routeFloor({ agents: [fundedCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new' }, { method: 'POST' });
    const user = userEvent.setup();
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    await user.click(door('the back room'));

    expect(await screen.findByRole('dialog', { name: 'Fund Loose Cannon' })).toBeInTheDocument();
    // FIX-6 job 2: one tap deals him in, and a shut door is the one doorway
    // that is not a deal. Law 4 survives the shortcut.
    expect(fetchMock.posts.filter((c) => c.url.includes('/queue'))).toHaveLength(0);
  });

  it('a pocket that covers nothing offers his chips instead of the deal', async () => {
    routeFloor({ agents: [brokeCannon] });
    renderCasino({ deployAgent: brokeCannon });

    expect(await screen.findByRole('button', { name: 'His chips' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
  });

  // The tray's own button is not the confirmation the doorway lost — it is the
  // same one action, for the room the tray already opened on. It stays because
  // a man arriving from a want has a rung his pocket buys and no opinion about
  // which doorway to look at.
  it('Deal him in POSTs the deploy for the room the tray opened on, and hands back the table', async () => {
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', {
      tableId: 'tbl-new', agentId: 'agent_cannon', agentName: 'Loose Cannon',
      strategy: 'Bets big, bluffs often.', memoryContext: '',
    }, { method: 'POST' });
    const onDeployed = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('pocket $6,000 · buy-in at $25/$50 is $5,000');
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


// ── BUGS-A job 7 ────────────────────────────────────────────────────────────

describe('BUGS-A job 7 · a doorway is a place you look into', () => {
  beforeEach(() => { telegram.signIn(); });

  it('tapping a room with nobody in the tray lists what is running in it', async () => {
    const user = userEvent.setup();
    routeFloor({ agents: [withPocket(playingAgent, 3_000)] });
    renderCasino();

    await user.click(await screen.findByRole('button', { name: /^the floor,/ }));

    const sheet = await screen.findByTestId('room-tables-sheet');
    // The room's biggest pot, and the table the owner's own agent is at.
    expect(within(sheet).getByText('#tbl-fixture')).toBeInTheDocument();
    expect(within(sheet).getByText(/The Grinder is in here/)).toBeInTheDocument();
  });

  it('Watch in that list spectates the felt', async () => {
    const user = userEvent.setup();
    const onSpectate = vi.fn();
    routeFloor();
    renderCasino({ onSpectate });

    await user.click(await screen.findByRole('button', { name: /^the floor,/ }));
    const sheet = await screen.findByTestId('room-tables-sheet');
    await user.click(within(sheet).getByRole('button', { name: 'Watch' }));

    expect(onSpectate).toHaveBeenCalledWith('tbl-fixture');
    // ...and the sheet gets out of the way of the felt it just sent you to.
    await waitFor(() => expect(screen.queryByTestId('room-tables-sheet')).toBeNull());
  });

  it('with an agent in the tray a doorway seats him rather than listing the room', async () => {
    const user = userEvent.setup();
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', { tableId: 'tbl-new', agentId: 'agent_cannon' }, { method: 'POST' });
    const onDeployed = vi.fn();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('placing Loose Cannon');
    await user.click(screen.getByRole('button', { name: /^the floor,/ }));

    expect(screen.queryByTestId('room-tables-sheet')).toBeNull();
    await waitFor(() => expect(onDeployed).toHaveBeenCalled());
  });
});
