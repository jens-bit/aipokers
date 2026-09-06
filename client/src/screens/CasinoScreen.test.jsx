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
import { rooms, hotRooms, roomsResponse, floorRoom, upstairsRoom, backRoom, casinoEvent } from '../test/fixtures/rooms.js';
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

function routeFloor({ agents = [], rooms: floor = rooms, events = [] } = {}) {
  fetchMock.route('/api/rooms', { rooms: floor, hotWindowMs: 20_000 });
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

  it('draws one doorway per room, in ladder order', async () => {
    routeFloor();
    const { container } = renderCasino();

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
    routeFloor({ agents: [withPocket(playingAgent, 3_000, { pnl: 1_240 })] });
    const { container } = renderCasino();

    await waitFor(() => {
      const floor = container.querySelector('.csn-door[data-room="floor"]');
      expect(within(floor).getByText('The')).toBeInTheDocument();
    });
    // He plays at 10/20, so upstairs has nobody of yours in it.
    const upstairs = container.querySelector('.csn-door[data-room="upstairs"]');
    expect(within(upstairs).queryByText('The')).not.toBeInTheDocument();
  });

  it('a floor that never answers says so instead of drawing an empty room', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/rooms', { status: 500, body: {} });
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    renderCasino();

    expect(await screen.findByText('The floor has not opened yet.')).toBeInTheDocument();
  });

  it('tapping a ticker line spectates that table', async () => {
    const onSpectate = vi.fn();
    routeFloor({ events: [casinoEvent({ id: 7, headline: 'Ozymandias cracked aces', tableId: 'tbl-a' })] });
    const user = userEvent.setup();
    renderCasino({ onSpectate });

    const line = await screen.findByRole('button', { name: /Ozymandias cracked aces/ });
    await user.click(line);
    expect(onSpectate).toHaveBeenCalledWith('tbl-a');
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

  it('with nobody to place, no doorway is a decision and there is no tray', async () => {
    routeFloor();
    const { container } = renderCasino();

    await waitFor(() => expect(container.querySelectorAll('.csn-door')).toHaveLength(3));
    expect(container.querySelector('.csn-tray')).toBeNull();
    expect(container.querySelector('.csn-door[data-shut]')).toBeNull();
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

  it('picking an open room re-states the decision in the tray', async () => {
    routeFloor({ agents: [richCannon] });
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon });

    await screen.findByText('pocket $6,000 · buy-in at $25/$50 is $5,000');
    await user.click(door('the floor'));
    expect(await screen.findByText('pocket $6,000 · buy-in at $10/$20 is $2,000'))
      .toBeInTheDocument();
  });

  it('tapping a shut room opens his chips — the only thing that opens it', async () => {
    routeFloor({ agents: [fundedCannon] });
    const user = userEvent.setup();
    renderCasino({ deployAgent: fundedCannon });

    await screen.findByText('placing Loose Cannon');
    await user.click(door('the back room'));

    expect(await screen.findByRole('dialog', { name: 'Fund Loose Cannon' })).toBeInTheDocument();
  });

  it('a pocket that covers nothing offers his chips instead of the deal', async () => {
    routeFloor({ agents: [brokeCannon] });
    renderCasino({ deployAgent: brokeCannon });

    expect(await screen.findByRole('button', { name: 'His chips' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
  });

  it('Deal him in POSTs the deploy with the room he picked, and hands back the table', async () => {
    routeFloor({ agents: [richCannon] });
    fetchMock.route('/queue', {
      tableId: 'tbl-new', agentId: 'agent_cannon', agentName: 'Loose Cannon',
      strategy: 'Bets big, bluffs often.', memoryContext: '',
    }, { method: 'POST' });
    const onDeployed = vi.fn();
    const user = userEvent.setup();
    renderCasino({ deployAgent: richCannon, onDeployed });

    await screen.findByText('placing Loose Cannon');
    await user.click(door('the floor'));
    await screen.findByText('pocket $6,000 · buy-in at $10/$20 is $2,000');
    await user.click(screen.getByRole('button', { name: 'Deal him in' }));

    await waitFor(() => expect(onDeployed).toHaveBeenCalled());
    const post = fetchMock.posts.find((c) => c.url.includes('/queue'));
    expect(post.body).toMatchObject({ rung: 0, stakes: { bigBlind: 20, buyIn: 2_000 } });
    expect(onDeployed.mock.calls[0][0]).toMatchObject({ tableId: 'tbl-new' });
    expect(onDeployed.mock.calls[0][2].id).toBe('floor');
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
