// client/src/components/casino/CasinoBuilding.test.jsx — CASINO-1
//
// Board 27's five laws, as assertions. Each one is a claim about what an owner
// can see and do, so each is tested through what is rendered rather than
// through the props that produced it.
//
//   1. crowd is a texture, not a count      → crowdSize, and the real number
//                                             beside it
//   2. felts are ellipses on that floor     → three of them, one hot
//   3. yours stand in the doorway           → his name, at character scale
//   4. a room he cannot afford is shut and  → the price, in words, and never a
//      says the price                         lock
//   5. HOT is the only thing that asks now  → the badge and the shimmer
//
// Plus the board by the stairs: five lines, the nemesis one gold because it is
// the only one about your agent, and a tap that goes to the felt it happened at.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CasinoDoor, CasinoBoard, DeployTray, crowdSize, noiseLevel, boardLines, tickerLabel, count,
} from './CasinoBuilding.jsx';
import { floorRoom, upstairsRoom, backRoom, casinoEvent } from '../../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../../test/fixtures/agents.js';

const withPocket = (agent, over) => ({
  ...agent,
  pocket: { balance: 2500, mode: 'allowance', cap: 5000, broke: false, pnl: 340, ...over },
});

// ── The room grid ───────────────────────────────────────────────────────────

describe('CASINO-1 the room grid', () => {
  it('law 1: the crowd is capped, never zero for a room with anybody in it', () => {
    expect(crowdSize(0)).toBe(0);
    expect(crowdSize(1)).toBe(3);        // one person still reads as a room in use
    expect(crowdSize(1180)).toBe(34);    // 1,180 is a texture, not 1,180 nodes
    expect(crowdSize(44)).toBeLessThan(crowdSize(1180));
  });

  it('law 1: and the real number is beside it for anyone who wants the truth', () => {
    render(<CasinoDoor room={floorRoom} />);
    expect(screen.getByText('17 in')).toBeInTheDocument();
  });

  // toLocaleString() follows the machine's locale, so on a Swedish box the
  // crowd read "1 604" two lines above a pot that read "$4,180".
  it('groups a count the way money() groups, on any machine', () => {
    expect(count(1604)).toBe('1,604');
    expect(count(1180)).toBe('1,180');
    expect(count(44)).toBe('44');
    expect(count(undefined)).toBe('0');
    render(<CasinoDoor room={{ ...floorRoom, seated: 1180 }} />);
    expect(screen.getByText('1,180 in')).toBeInTheDocument();
  });

  it('law 2: three felts, and only the centre one goes hot', () => {
    const { container, rerender } = render(<CasinoDoor room={floorRoom} />);
    expect(container.querySelectorAll('[data-felt]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-felt="hot"]')).toHaveLength(0);

    rerender(<CasinoDoor room={floorRoom} hot />);
    expect(container.querySelectorAll('[data-felt="hot"]')).toHaveLength(1);
  });

  it('names the room and the stakes over the door', () => {
    render(<CasinoDoor room={upstairsRoom} />);
    expect(screen.getByText('upstairs')).toBeInTheDocument();
    expect(screen.getByText('$25/$50')).toBeInTheDocument();
  });

  it('law 3: yours stands in the doorway, by name and P&L', () => {
    render(<CasinoDoor room={floorRoom} mine={[withPocket(playingAgent)]} />);
    // The chip carries his first name — finding your own is never a search.
    expect(screen.getByText('The')).toBeInTheDocument();
    expect(screen.getByText('+$340')).toBeInTheDocument();
  });

  it('law 4: a shut room says the price and shows no lock', () => {
    render(<CasinoDoor room={backRoom} shut onSelect={() => {}} />);
    const door = screen.getByRole('button');
    expect(door).toHaveAttribute('data-shut', 'true');
    expect(within(door).getByText(/his pocket needs/)).toBeInTheDocument();
    expect(within(door).getByText('$10,000')).toBeInTheDocument();
    expect(within(door).queryByText(/lock|locked|upgrade|unlock/i)).not.toBeInTheDocument();
  });

  // "his pocket" is unambiguous on an empty doorway. It is not when one of
  // your OWN agents is standing in the room the other one cannot afford —
  // which the ref never had to draw and the real floor produces constantly.
  it('law 4: and it names whose pocket, when another of yours is in the room', () => {
    render(
      <CasinoDoor
        room={upstairsRoom}
        shut
        shutFor="Value Bot"
        mine={[withPocket(playingAgent)]}
        onSelect={() => {}}
      />,
    );
    const door = screen.getByRole('button');
    expect(within(door).getByText(/Value Bot's pocket needs/)).toBeInTheDocument();
    expect(door).toHaveAccessibleName(/Value Bot's pocket needs \$5,000 to sit here/);
  });

  // The ref places the crowd against a hard-coded 358px, so on the desk the
  // whole room bunched into the left third of a 1,200px doorway.
  it('the crowd spans the doorway at any width', () => {
    const { container } = render(<CasinoDoor room={floorRoom} />);
    const ghosts = [...container.querySelectorAll('svg[viewBox="0 0 20 23"]')]
      .map((g) => g.parentElement.style.left);
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.every((l) => l.endsWith('%'))).toBe(true);
  });

  it('law 5: HOT is drawn on the door, and only when it is hot', () => {
    const { rerender } = render(<CasinoDoor room={upstairsRoom} />);
    expect(screen.queryByText('HOT')).not.toBeInTheDocument();

    rerender(<CasinoDoor room={upstairsRoom} hot />);
    expect(screen.getByText('HOT')).toBeInTheDocument();
  });

  it('a doorway with nothing to choose is scenery, not a button', () => {
    render(<CasinoDoor room={floorRoom} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a doorway you can pick answers to a tap, shut or open', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<CasinoDoor room={floorRoom} onSelect={onSelect} />);
    await user.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(floorRoom);

    // Law 4 again: the shut door is still how the owner gets to his chips.
    rerender(<CasinoDoor room={backRoom} shut onSelect={onSelect} />);
    await user.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(backRoom);
  });

  it('the volume tiers off seats filled, and an empty room is silent', () => {
    expect(noiseLevel(0)).toBe(0);
    expect(noiseLevel(4)).toBe(1);
    expect(noiseLevel(17)).toBe(2);
    expect(noiseLevel(180)).toBe(3);
  });
});

// ── The board by the stairs ─────────────────────────────────────────────────

describe('CASINO-1 the board by the stairs', () => {
  const mine = new Set(['agent_grinder']);
  const feed = [
    casinoEvent({ id: 1, type: 'bigPot', headline: 'Ozymandias cracked aces', tableId: 'tbl-a' }),
    casinoEvent({ id: 2, type: 'cooler', headline: 'quads into a straight flush', tableId: 'tbl-b' }),
    casinoEvent({ id: 3, type: 'heater', headline: 'Nightjar up $9k in 40 minutes', tableId: 'tbl-c' }),
    casinoEvent({ id: 4, type: 'bust', headline: 'Fold_Equity out', tableId: 'tbl-d' }),
    casinoEvent({ id: 5, type: 'nemesisSeated', headline: 'Granite just sat down at your table', tableId: 'tbl-e', agentIds: ['agent_grinder'] }),
    casinoEvent({ id: 6, type: 'bigPot', headline: 'older, scrolled past', tableId: 'tbl-f' }),
  ];

  it('speaks the house vocabulary, not the wire\'s', () => {
    expect(tickerLabel('bigPot')).toBe('BIGGEST POT');
    expect(tickerLabel('nemesisSeated')).toBe('NEMESIS');
    expect(tickerLabel('bust')).toBe('BUSTED');
    expect(tickerLabel('somethingNew')).toBe('FLOOR');
  });

  it('holds five lines, newest first', () => {
    const lines = boardLines(feed, mine, 5);
    expect(lines).toHaveLength(5);
    expect(lines[0].id).toBe(6);
    // The sixth has scrolled past; a board is a wall, not a feed.
    expect(lines.map((l) => l.id)).not.toContain(1);
  });

  it('marks the one line that is about your agent', () => {
    const lines = boardLines(feed, mine, 5);
    const nemesis = lines.find((l) => l.type === 'nemesisSeated');
    expect(nemesis.mine).toBe(true);
    expect(lines.filter((l) => l.mine)).toHaveLength(1);
  });

  it('renders the headlines and the census', () => {
    render(<CasinoBoard events={feed} mineIds={mine} playing={1604} full />);
    expect(screen.getByText('BY THE STAIRS')).toBeInTheDocument();
    expect(screen.getByText('1,604 playing')).toBeInTheDocument();
    expect(screen.getByText('Granite just sat down at your table')).toBeInTheDocument();
  });

  it('collapses to two lines beside the deploy tray', () => {
    render(<CasinoBoard events={feed} mineIds={mine} playing={12} />);
    expect(screen.getByText('older, scrolled past')).toBeInTheDocument();
    expect(screen.queryByText('Fold_Equity out')).not.toBeInTheDocument();
  });

  it('tapping a line goes to the felt it happened at', async () => {
    const onSpectate = vi.fn();
    const user = userEvent.setup();
    render(<CasinoBoard events={feed} mineIds={mine} playing={12} full onSpectate={onSpectate} />);

    await user.click(screen.getByRole('button', { name: /Granite just sat down/ }));
    expect(onSpectate).toHaveBeenCalledWith('tbl-e');
  });

  it('a line with no table behind it is not a destination', () => {
    const onSpectate = vi.fn();
    render(
      <CasinoBoard
        events={[casinoEvent({ id: 9, headline: 'the floor is busy', tableId: null })]}
        playing={3}
        full
        onSpectate={onSpectate}
      />,
    );
    expect(screen.getByText('the floor is busy')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('carries the stakes chip only when the wire named the room', () => {
    const stakesFor = (id) => (id === 'tbl-a' ? '$10/$20' : null);
    render(
      <CasinoBoard
        events={[
          casinoEvent({ id: 1, headline: 'named', tableId: 'tbl-a' }),
          casinoEvent({ id: 2, headline: 'unnamed', tableId: 'tbl-z' }),
        ]}
        playing={3}
        full
        stakesFor={stakesFor}
      />,
    );
    expect(screen.getAllByText('$10/$20')).toHaveLength(1);
  });

  it('a quiet floor says so rather than drawing an empty wall', () => {
    render(<CasinoBoard events={[]} playing={0} full />);
    expect(screen.getByText('The floor is quiet.')).toBeInTheDocument();
  });
});

// ── The tray ────────────────────────────────────────────────────────────────

describe('CASINO-1 the deploy tray', () => {
  it('states his pocket and the buy-in in one line, and offers the deal', () => {
    render(
      <DeployTray
        agent={withPocket(restingAgent, { balance: 2500 })}
        room={floorRoom}
        affordable
        onDeal={() => {}}
        onFund={() => {}}
      />,
    );
    expect(screen.getByText('Loose Cannon')).toBeInTheDocument();
    expect(screen.getByText('pocket $2,500 · buy-in at $10/$20 is $2,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeInTheDocument();
  });

  it('offers his chips instead when the pocket does not cover it', () => {
    render(
      <DeployTray
        agent={withPocket(restingAgent, { balance: 400 })}
        room={floorRoom}
        affordable={false}
        onDeal={() => {}}
        onFund={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'His chips' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).not.toBeInTheDocument();
  });

  it('there is no stake slider anywhere — the pocket already is the wager', () => {
    const { container } = render(
      <DeployTray agent={withPocket(restingAgent)} room={floorRoom} affordable onDeal={() => {}} />,
    );
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
  });
});
