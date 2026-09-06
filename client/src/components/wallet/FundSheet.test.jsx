// client/src/components/wallet/FundSheet.test.jsx — WUI-2, WALLET-7
//
// WALLET-7 rewrote this file's subject. It used to assert four modes drawn as
// four choices of equal weight — a one-time top-up, an allowance, auto-refill
// and cutting him off — with a cap field that changed its name per mode. Two of
// those four were the same thing under different names, and a sheet that asks
// the owner to classify his own generosity is a sheet that asks the wrong
// question. What is asserted now is the two verbs:
//
//   GIVE HIM CHIPS   an amount, and one toggle for whether it refills
//   CALL HIM IN      he finishes the hand and comes home with the money
//
// The copy law is unchanged and still asserted here: calling him in is a
// legitimate answer, drawn without a shred of guilt, saying what he keeps.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The amount field's size is a stylesheet rule, so the stylesheet has to be here
// for getComputedStyle to see it (vite.config.js has css: true).
import '../../styles/wallet.css';

import { FundSheet } from './FundSheet.jsx';
import { aggressiveAgent, brokeAgent, cutPlayingAgent, wallet } from '../../test/fixtures/wallet.js';
import { telegram } from '../../test/harness.js';

function renderSheet(props = {}) {
  return render(
    <FundSheet
      agent={aggressiveAgent}
      wallet={wallet}
      onCancel={() => {}}
      onConfirm={() => {}}
      {...props}
    />,
  );
}

// The choices live in the sheet body; the confirm button lives in the footer.
const body = () => within(document.querySelector('.wal-sheet__body'));
const amountField = () => screen.getByLabelText(/Amount/i);
const giveButton = () => within(document.querySelector('.wal-sheet__foot'))
  .getByRole('button', { name: 'Give him chips' });

describe('WUI-2 — where he stands', () => {
  beforeEach(() => { telegram.signIn(); });

  it('names the agent being funded', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Fund Aggressive v1.3' })).toBeInTheDocument();
  });

  it('shows his pocket now, the stakes it buys, and what you have to give', () => {
    renderSheet();
    expect(screen.getByText('Pocket now')).toBeInTheDocument();
    expect(screen.getByText('$2,100')).toBeInTheDocument();
    expect(screen.getByText('PLAYS $10/$20')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('$2,340.50')).toBeInTheDocument();
  });

  it('omits the wallet figure when this deployment has none', () => {
    renderSheet({ wallet: null });
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
    expect(screen.getByText('Pocket now')).toBeInTheDocument();
  });
});

describe('WALLET-5 — his face opens his profile', () => {
  beforeEach(() => { telegram.signIn(); });

  it('taps through to the profile, the same navigation the floor uses', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    renderSheet({ onOpenProfile });

    await user.click(screen.getByRole('button', { name: "Open Aggressive v1.3's profile" }));
    expect(onOpenProfile).toHaveBeenCalledWith(aggressiveAgent);
  });

  it('is inert when no host owns that navigation', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: /profile/i })).toBeNull();
  });
});

describe('WALLET-7 — two verbs, not four modes', () => {
  beforeEach(() => { telegram.signIn(); });

  it('offers exactly two: give him chips, or call him in', () => {
    renderSheet();
    expect(giveButton()).toBeInTheDocument();
    expect(body().getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
  });

  it('has no mode to classify — the four names are gone from the sheet', () => {
    const { container } = renderSheet();
    const text = container.textContent;
    for (const gone of ['One-time top-up', 'Allowance', 'Auto-refill', 'Cut him off']) {
      expect(text, `the sheet must not ask about "${gone}"`).not.toContain(gone);
    }
    // And nothing to pick between: no radio list, no pressed-one-of-four.
    expect(container.querySelectorAll('.wal-option')).toHaveLength(0);
  });

  it('offers the ladder as sizes of roll, not a keypad', () => {
    renderSheet();
    for (const preset of ['$2,000', '$5,000', '$10,000']) {
      expect(body().getByRole('button', { name: preset })).toBeInTheDocument();
    }
  });

  it('a preset fills the amount, and the amount is still free text', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(body().getByRole('button', { name: '$10,000' }));
    expect(amountField()).toHaveValue(10000);

    await user.clear(amountField());
    await user.type(amountField(), '3500');
    expect(amountField()).toHaveValue(3500);
  });

  it('states what the amount buys — bigger pocket, bigger stakes', async () => {
    const user = userEvent.setup();
    renderSheet();
    // He is on a 5,000 roll, which is the $25/$50 rung.
    expect(screen.getByText(/seats him at/)).toHaveTextContent('$25/$50');

    await user.click(body().getByRole('button', { name: '$2,000' }));
    expect(screen.getByText(/seats him at/)).toHaveTextContent('$10/$20');
  });

  it('will not give him an empty or zero amount', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.clear(amountField());
    expect(giveButton()).toBeDisabled();

    await user.type(amountField(), '2500');
    expect(giveButton()).toBeEnabled();
  });

  // BUG-02: anything below 16px auto-zooms iOS Safari on focus.
  it('the amount field is at least 16px', () => {
    const { container } = renderSheet();
    const field = container.querySelector('.wal-cap');
    expect(parseFloat(window.getComputedStyle(field).fontSize)).toBeGreaterThanOrEqual(16);
  });
});

describe('WALLET-7 — the one toggle', () => {
  beforeEach(() => { telegram.signIn(); });

  it('is the whole of auto-refill: one line, and it names the cap', () => {
    renderSheet();
    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeInTheDocument();
    expect(screen.getByText('Refill from the wallet when he busts (cap $5,000)')).toBeInTheDocument();
  });

  it('follows the amount, so the cap it promises is the roll being given', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(body().getByRole('button', { name: '$10,000' }));
    expect(screen.getByText('Refill from the wallet when he busts (cap $10,000)')).toBeInTheDocument();
  });

  it('opens on where he stands: off for a staked pocket, on for a refilling one', () => {
    renderSheet();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    // The auto pocket in the fixtures is on the refill.
    const refilling = { ...aggressiveAgent, pocket: { ...aggressiveAgent.pocket, mode: 'auto' } };
    renderSheet({ agent: refilling });
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  });

  it('reopens on the amount the server holds, not on a default', () => {
    const on7500 = { ...aggressiveAgent, pocket: { ...aggressiveAgent.pocket, cap: 7500 } };
    renderSheet({ agent: on7500 });
    expect(amountField()).toHaveValue(7500);
  });
});

describe('WALLET-7 — giving him chips', () => {
  beforeEach(() => { telegram.signIn(); });

  it('sends the verb, the amount and the size he is set at', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 5000, cap: 5000, refill: false });
  });

  it('carries the refill toggle rather than a second mode', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(screen.getByRole('checkbox'));
    await user.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 5000, cap: 5000, refill: true });
  });

  it('sends an edited amount, not the default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.clear(amountField());
    await user.type(amountField(), '7500');
    await user.click(giveButton());

    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 7500, cap: 7500, refill: false });
  });

  it('cancels without funding anything', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderSheet({ onCancel, onConfirm });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('backing out is the same as cancelling', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderSheet({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('WALLET-7 — calling him in, without guilt', () => {
  beforeEach(() => { telegram.signIn(); });

  it('says what he keeps and what comes home, not what he loses', () => {
    renderSheet();
    const copy = screen.getByText(/He finishes the hand he is in/);
    expect(copy).toHaveTextContent('takes a seat at the bar');
    expect(copy).toHaveTextContent('everything in his pocket comes back to your wallet');
    expect(copy).toHaveTextContent('Nothing is lost');
    expect(copy).toHaveTextContent('his attributes, his read book and his grudges all keep');
  });

  it('never scolds, pleads or warns', () => {
    const { container } = renderSheet();
    const text = container.textContent.toLowerCase();
    for (const word of ['sorry', 'warning', 'careful', 'lose', 'lost forever', 'punish', 'are you sure']) {
      expect(text, `the sheet must not say "${word}"`).not.toContain(word);
    }
  });

  it('is one press, with no confirmation gauntlet', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(body().getByRole('button', { name: 'Call him in' }));
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'callin', amount: null, cap: null, refill: false });
  });

  it('is offered for an agent already at the bar with a roll in his pocket', () => {
    // He was called in mid-session and the chips have come back to him: calling
    // him in again is how the rest of it gets home.
    renderSheet({ agent: cutPlayingAgent });
    expect(body().getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
    expect(screen.getByText('$4,000')).toBeInTheDocument();
  });

  it('is not offered when there is nothing to call in', () => {
    // Empty pocket, not at a table. The sheet asks for chips and nothing else.
    renderSheet({ agent: brokeAgent });
    expect(body().queryByRole('button', { name: 'Call him in' })).toBeNull();
    expect(giveButton()).toBeInTheDocument();
  });
});
