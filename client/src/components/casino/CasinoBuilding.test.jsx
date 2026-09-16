// client/src/components/casino/CasinoBuilding.test.jsx — CASINO-1, UI-3 job A
//
// UI-3 job A deleted the three-doorway building: CasinoDoor, RoomDoors, the
// crowd texture and the noise bars all drew "a room seen through its own
// doorway", and there is one room now. What was tested here as "the room
// grid" is tested below as "the stake picker" — the chip row that replaced
// it — against the same law 4 (his pocket, or the price, never a lock) and
// law 5 (hot is the only thing that asks now), because those laws did not
// change, only the shape that states them.
//
// The board by the stairs moved to CasinoTicker.test.jsx (CASINO-2 job 2,
// then UI-3 job A's removal of the board itself).

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  StakePicker, DeployTray, count,
} from './CasinoBuilding.jsx';
import { floorRoom, upstairsRoom, backRoom } from '../../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../../test/fixtures/agents.js';

const withPocket = (agent, over) => ({
  ...agent,
  pocket: { balance: 2500, mode: 'allowance', cap: 5000, broke: false, pnl: 340, ...over },
});

// ── The stake picker ────────────────────────────────────────────────────────

describe('UI-3 job A the stake picker', () => {
  it('names each stake and its buy-in, ranked the way the ladder runs', () => {
    render(<StakePicker stakes={[floorRoom, upstairsRoom, backRoom]} />);
    expect(screen.getByText('$10/$20')).toBeInTheDocument();
    expect(screen.getByText('$25/$50')).toBeInTheDocument();
    expect(screen.getByText('$2,000 buy-in')).toBeInTheDocument();
  });

  // toLocaleString() follows the machine's locale, so on a Swedish box the
  // room read "1 604" two lines above a pot that read "$4,180".
  it('groups a count the way money() groups, on any machine', () => {
    expect(count(1604)).toBe('1,604');
    expect(count(1180)).toBe('1,180');
    expect(count(44)).toBe('44');
    expect(count(undefined)).toBe('0');
    render(<StakePicker stakes={[{ ...floorRoom, seated: 1180 }]} />);
    expect(screen.getByText('1,180 in')).toBeInTheDocument();
  });

  it('law 4: a stake his pocket cannot cover says the price and shows no lock', () => {
    render(<StakePicker stakes={[backRoom]} pocket={{ balance: 400 }} onSelect={() => {}} />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('data-shut', 'true');
    expect(chip).toHaveAccessibleName(/needs \$10,000 to sit/);
    expect(within(chip).queryByText(/lock|locked|upgrade|unlock/i)).not.toBeInTheDocument();
  });

  it('law 5: HOT is drawn on the chip, and only when it is hot', () => {
    const { rerender } = render(<StakePicker stakes={[upstairsRoom]} />);
    expect(screen.queryByText('HOT', { exact: false })).not.toBeInTheDocument();

    rerender(<StakePicker stakes={[upstairsRoom]} hotStakes={new Set([upstairsRoom.id])} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-hot', 'true');
  });

  it('says who of yours is already at a stake', () => {
    render(
      <StakePicker
        stakes={[floorRoom]}
        mineByStake={{ [floorRoom.id]: [withPocket(playingAgent)] }}
      />,
    );
    expect(screen.getByText('· 1 yours', { exact: false })).toBeInTheDocument();
  });

  it('answers to a tap with the stake it names', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<StakePicker stakes={[floorRoom, upstairsRoom]} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /\$10\/\$20/ }));
    expect(onSelect).toHaveBeenCalledWith(floorRoom);
  });

  it('with nothing to choose, draws nothing', () => {
    const { container } = render(<StakePicker stakes={[]} />);
    expect(container).toBeEmptyDOMElement();
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
    expect(screen.getByText('pocket $2,500 · buy-in at 10/20 is $2,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeInTheDocument();
  });

  // CASINO-2 job 6 · the wave-55 restore, as three facts in one strip.
  it('is his face, his money and the deal — never a picker', () => {
    const { container } = render(
      <DeployTray
        agent={withPocket(restingAgent, { balance: 2500 })}
        room={floorRoom}
        affordable
        onDeal={() => {}}
        onFund={() => {}}
      />,
    );
    // He is already standing here, so it is HIM in the tray and not his name in
    // a list. A bare "Deploy someone" button threw that away.
    expect(container.querySelector('svg.mood-ghost')).not.toBeNull();
    // And the pocket IS the wager, so it is in the same breath as the buy-in.
    expect(screen.getByText(/^pocket .* · buy-in at .* is /)).toBeInTheDocument();
  });

  it('writes the stakes bare in that line — a dollar sign there is not money', () => {
    render(
      <DeployTray
        agent={withPocket(restingAgent, { balance: 2500 })}
        room={floorRoom}
        affordable
        onDeal={() => {}}
      />,
    );
    // "buy-in at 10/20", not "at $10/$20": the line already carries two amounts
    // that ARE money, and a third dollar sign between them stops the eye on a
    // number that is an address rather than a price. The ref writes it this way
    // in both mood-floor3 and mood-casino2.
    const line = screen.getByText(/buy-in at/);
    expect(line).toHaveTextContent('buy-in at 10/20 is $2,000');
    expect(line.textContent).not.toContain('$10/$20');
  });

  it('and says what is missing rather than guessing, before a stake is picked', () => {
    render(<DeployTray agent={withPocket(restingAgent, { balance: 2500 })} room={null} onDeal={() => {}} />);
    expect(screen.getByText('pocket $2,500 · pick a stake')).toBeInTheDocument();
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
