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
// The board by the stairs is no longer here: CASINO-2 job 2 split it in two and
// moved it to FloorBoard.jsx. See the note where its block used to be.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CasinoDoor, DeployTray, crowdSize, noiseLevel, count,
} from './CasinoBuilding.jsx';
import { floorRoom, upstairsRoom, backRoom } from '../../test/fixtures/rooms.js';
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
    // BUGS-A job 1: the chip carries his WHOLE name. It used to carry the
    // first word, which turned "The Clock", "The Rock" and "The Nit" into
    // three doormen all called "The" — the opposite of law 3.
    expect(screen.getByText('The Grinder')).toBeInTheDocument();
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
//
// It moved to FloorBoard.test.jsx with the component, and the rule the block
// that stood here encoded — "holds five lines, NEWEST FIRST" — is the one
// CASINO-2 job 2 deliberately reverses. Newest is not most interesting: it put
// a $0 bust from four seconds ago above a $14,200 pot from two minutes ago,
// and it could not mention the pot being built right now at all, because a
// hand that has not ended has fired no event. The replacement is two halves
// ranked by money, and every assertion that was here has a counterpart there
// (the house vocabulary, the gold line that is about your agent, the census,
// the collapse beside the tray, the tap, the quiet floor).

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
