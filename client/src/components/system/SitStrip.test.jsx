// SIT-1 — the four verbs, where the whisper row sits.
// Port of `ActionRow` / `BetPanel` in design-refs/mood-home2.jsx (52·Y1–Y4).
//
// What is asserted here is what the board actually claims, and no more:
//
//   · three of the four verbs are a tap; BET is the one that needs a number, so
//     it is the one that opens a panel
//   · the panel takes the strip's slot rather than stacking on it, because the
//     felt above must not move (52·Y4)
//   · the amounts are named in poker's words with the figure under each
//   · a verb the server has not offered is present and unpressable — never
//     absent, and never a button that produces an error
//   · it is GLASS, the same material as the sheet and the hero strip

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SitStrip, betOptions, figure } from './SitStrip.jsx';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(clientRoot, 'src/styles/sit1.css'), 'utf8');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-[\]='"]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};

// A live game with the owner in seat 1 and the action on him.
const game = (over = {}) => ({
  tableId: 'home-u1',
  handNumber: 4,
  street: 'flop',
  toAct: 1,
  pot: 480,
  currentBet: 0,
  smallBlind: 1,
  bigBlind: 2,
  seats: [
    { seat: 0, displayName: 'Balance', stack: 1200 },
    { seat: 1, displayName: 'You', stack: 1840 },
  ],
  ...over,
});

const OFFER = [
  { type: 'fold' },
  { type: 'check' },
  { type: 'bet', min: 2, max: 1840 },
];

describe('the strip', () => {
  it('draws the four verbs the board names, in the board’s order', () => {
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    const names = screen.getAllByRole('button').map((b) => b.textContent.replace(/\d[\d,]*$/, ''));
    expect(names.slice(0, 4)).toEqual(['FOLD', 'CHECK', 'CALL', 'BET']);
  });

  it('says whose turn it is without a banner, and only when it is his', () => {
    const { rerender } = render(
      <SitStrip game={game()} mySeat={1} legalActions={OFFER} secs={12} onAct={() => {}} />,
    );
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(screen.getByText(/12s · timeout checks for you/)).toBeTruthy();

    rerender(<SitStrip game={game({ toAct: 0 })} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    expect(screen.queryByText('YOUR TURN')).toBeNull();
  });

  it('keeps every verb on screen off turn, and lets none of them be pressed', () => {
    const onAct = vi.fn();
    render(<SitStrip game={game({ toAct: 0 })} mySeat={1} legalActions={OFFER} onAct={onAct} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    buttons.forEach((b) => expect(b.disabled).toBe(true));
    fireEvent.click(buttons[0]);
    expect(onAct).not.toHaveBeenCalled();
  });

  it('disables a verb the server has not offered, rather than hiding it', () => {
    render(
      <SitStrip game={game({ currentBet: 80 })} mySeat={1}
        legalActions={[{ type: 'fold' }, { type: 'call', amount: 80 }]} onAct={() => {}} />,
    );
    expect(screen.getByText('CHECK').closest('button').disabled).toBe(true);
    expect(screen.getByText('CALL').closest('button').disabled).toBe(false);
    // The call price is on the button, because a call is a number too.
    expect(screen.getByText('80')).toBeTruthy();
  });

  it('sends the three tap verbs straight through', () => {
    const onAct = vi.fn();
    render(
      <SitStrip game={game({ currentBet: 80 })} mySeat={1}
        legalActions={[{ type: 'fold' }, { type: 'call', amount: 80 }]} onAct={onAct} />,
    );
    fireEvent.click(screen.getByText('FOLD'));
    expect(onAct).toHaveBeenCalledWith({ type: 'fold' });
    fireEvent.click(screen.getByText('CALL'));
    expect(onAct).toHaveBeenCalledWith({ type: 'call', amount: 80 });
  });
});

describe('BET is the one verb that needs a number', () => {
  it('opens the panel instead of sending chips', () => {
    const onAct = vi.fn();
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={onAct} />);
    fireEvent.click(screen.getByText('BET'));
    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByTestId('sit-bet-panel')).toBeTruthy();
  });

  it('takes the strip’s slot rather than stacking on it — the felt above does not move', () => {
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    fireEvent.click(screen.getByText('BET'));
    // 52·Y4: one thing in the slot at a time. Both on screen at once is exactly
    // the extra row that would push the felt up.
    expect(screen.queryByTestId('sit-strip')).toBeNull();
    expect(screen.getByTestId('sit-bet-panel')).toBeTruthy();
  });

  it('names the amounts in poker’s words with the figure under each', () => {
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    fireEvent.click(screen.getByText('BET'));
    ['A THIRD', 'HALF', 'POT', 'ALL IN'].forEach((k) => expect(screen.getByText(k)).toBeTruthy());
    expect(screen.getByText('160')).toBeTruthy();   // a third of 480
    expect(screen.getByText('240')).toBeTruthy();   // half
    expect(screen.getByText('480')).toBeTruthy();   // pot
    expect(screen.getByText('1,840')).toBeTruthy(); // the jam
  });

  it('states the pot and his stack, and offers CANCEL as a word', () => {
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    fireEvent.click(screen.getByText('BET'));
    expect(screen.getByText('pot is 480 · you have 1,840')).toBeTruthy();
    expect(screen.getByText('CANCEL')).toBeTruthy();
  });

  it('sends the size that was tapped, and closes', () => {
    const onAct = vi.fn();
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={onAct} />);
    fireEvent.click(screen.getByText('BET'));
    fireEvent.click(screen.getByText('HALF'));
    expect(onAct).toHaveBeenCalledWith({ type: 'bet', amount: 240 });
    expect(screen.getByTestId('sit-strip')).toBeTruthy();
  });

  it('takes a free amount, and refuses one the table would', () => {
    const onAct = vi.fn();
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={onAct} />);
    fireEvent.click(screen.getByText('BET'));
    const field = screen.getByLabelText(/any amount/);
    fireEvent.change(field, { target: { value: '137' } });
    fireEvent.click(screen.getAllByText('BET').pop());
    expect(onAct).toHaveBeenCalledWith({ type: 'bet', amount: 137 });

    // And over the jam it will not go.
    fireEvent.click(screen.getByText('BET'));
    fireEvent.change(screen.getByLabelText(/any amount/), { target: { value: '99999' } });
    expect(screen.getAllByText('BET').pop().closest('button').disabled).toBe(true);
  });

  it('CANCEL puts the verbs back and sends nothing', () => {
    const onAct = vi.fn();
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={onAct} />);
    fireEvent.click(screen.getByText('BET'));
    fireEvent.click(screen.getByText('CANCEL'));
    expect(screen.getByTestId('sit-strip')).toBeTruthy();
    expect(onAct).not.toHaveBeenCalled();
  });

  it('closes itself on a new street, so the flop’s sizes never greet the turn', () => {
    const { rerender } = render(
      <SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />,
    );
    fireEvent.click(screen.getByText('BET'));
    expect(screen.getByTestId('sit-bet-panel')).toBeTruthy();
    rerender(<SitStrip game={game({ street: 'turn' })} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    expect(screen.queryByTestId('sit-bet-panel')).toBeNull();
  });

  it('says RAISE when the spot is a raise, because that is what it is', () => {
    render(
      <SitStrip game={game({ currentBet: 80 })} mySeat={1}
        legalActions={[{ type: 'call', amount: 80 }, { type: 'raise', min: 160, max: 1840 }]}
        onAct={() => {}} />,
    );
    fireEvent.click(screen.getByText('BET'));
    // The panel's label AND the button that sends it: the spot is a raise from
    // end to end, so neither half of the panel is allowed to call it a bet.
    expect(document.querySelector('.sit-bet__label').textContent).toBe('RAISE');
    expect(document.querySelector('.sit-bet__go').textContent).toBe('RAISE');
  });
});

describe('the sizing', () => {
  it('prices a bet off the pot', () => {
    const options = betOptions({ pot: 480, min: 2, max: 1840 });
    expect(options.map((o) => o.amount)).toEqual([160, 240, 480, 1840]);
  });

  it('prices a raise off the pot the call has made, as a TOTAL', () => {
    // 80 to call into a 400 pot: half is 80 + (400+80)/2 = 320 all-in-total.
    const options = betOptions({
      pot: 400, currentBet: 80, callAmount: 80, min: 160, max: 1840, isRaise: true,
    });
    expect(options[1].amount).toBe(320);
  });

  it('collapses onto the jam for a stack that cannot reach a size', () => {
    const options = betOptions({ pot: 480, min: 90, max: 90 });
    expect(options.every((o) => o.amount === 90)).toBe(true);
  });

  it('groups by hand rather than by locale', () => {
    // toLocaleString returns a narrow no-break space under several ordinary
    // locales, and this screen already carries the money next to it.
    expect(figure(1840)).toBe('1,840');
    expect(figure(0)).toBe('0');
  });
});

describe('the material', () => {
  it('is the felt’s glass, not the legacy bar’s flat grey', () => {
    render(<SitStrip game={game()} mySeat={1} legalActions={OFFER} onAct={() => {}} />);
    expect(document.querySelector('.sit-strip .glass')).toBeTruthy();
    fireEvent.click(screen.getByText('BET'));
    expect(document.querySelector('.sit-bet .glass--up')).toBeTruthy();
  });

  it('rises from the bottom edge', () => {
    // `rule` takes the first block a selector opens, and .sit-bet opens two —
    // the shared chrome it wears with the strip, then its own entrance.
    expect(css).toMatch(/\.sit-bet\s*\{[^}]*animation:\s*sit-rise/);
    expect(css).toMatch(/@keyframes sit-rise/);
  });

  it('keeps the free field at 16px, because BUG-02 is a hard floor', () => {
    expect(rule('.sit-bet__input')).toMatch(/font-size:\s*16px/);
  });
});
