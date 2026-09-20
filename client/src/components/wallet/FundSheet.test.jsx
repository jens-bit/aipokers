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

describe('BUG-280 — funding never calls an open buy-in a loss', () => {
  const boughtIn = { ...aggressiveAgent, pocket: { ...aggressiveAgent.pocket, pnl: -2000 } };

  it.each([[0, '$0'], [450, '+$450'], [-90, '−$90']])('shows confirmed casino session net %s', (net, text) => {
    renderSheet({ agent: { ...boughtIn, liveGame: { tableId: 'tbl-1', net } } });
    expect(screen.getByText('session net').parentElement).toHaveTextContent(text);
    expect(screen.queryByText('−$2,000')).not.toBeInTheDocument();
  });

  it('omits the result while casino net is unknown', () => {
    renderSheet({ agent: boughtIn });
    expect(screen.queryByText('his net')).not.toBeInTheDocument();
    expect(screen.queryByText('session net')).not.toBeInTheDocument();
    expect(screen.queryByText('−$2,000')).not.toBeInTheDocument();
  });

  it('does not let Home practice replace settled pocket money', () => {
    renderSheet({ agent: { ...boughtIn, liveGame: { tableId: 'home-42', net: 9999 } } });
    expect(screen.getByText('his net').parentElement).toHaveTextContent('−$2,000');
    expect(screen.queryByText('+$9,999')).not.toBeInTheDocument();
  });
});

it('BUG-146: an unconfirmed wallet disables funding controls while Cancel and Back remain available', async () => {
  const onCancel = vi.fn(), onConfirm = vi.fn();
  renderSheet({ disabled: true, onCancel, onConfirm });
  expect(screen.getByRole('button', { name: 'Give him chips' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Call him in' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Take his chips|Take all of it/ })).toBeDisabled();
  // UI-3 job C: two spinbuttons now, give and take, both stand down.
  for (const field of screen.getAllByRole('spinbutton')) expect(field).toBeDisabled();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

// The choices live in the sheet body; the confirm button lives in the footer.
// UI-3 job C added a second amount field (take), so the give one needs its
// own stable name — the accessible name is "Amount to give"/"Amount to
// take" even though the visible label also states each one's ceiling.
const body = () => within(document.querySelector('.wal-sheet__body'));
const amountField = () => screen.getByLabelText('Amount to give');
const takeAmountField = () => screen.getByLabelText('Amount to take');
const giveButton = () => within(document.querySelector('.wal-sheet__foot'))
  .getByRole('button', { name: 'Give him chips' });

describe('BUG-280 — transfer uncommitted chips', () => {
  beforeEach(() => { telegram.signIn(); });

  it('accepts a single chip and makes the resulting pocket explicit', async () => {
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), '1');
    expect(amountField()).toHaveAttribute('step', '1');
    expect(screen.getByText(/Pocket after giving/)).toHaveTextContent('$2,101');
    await userEvent.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 1, cap: 1, refill: false });
  });

  it('can choose the whole safe and rejects fractional transfers instead of rounding them silently', async () => {
    renderSheet({ wallet: { ...wallet, balance: 2341 } });
    await userEvent.click(screen.getByRole('button', { name: 'All from safe' }));
    expect(amountField()).toHaveValue(2341);
    expect(giveButton()).toBeEnabled();
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), '1.5');
    expect(giveButton()).toBeDisabled();
    await userEvent.clear(takeAmountField());
    await userEvent.type(takeAmountField(), '1.5');
    expect(screen.getByRole('button', { name: 'Take $1.50' })).toBeDisabled();
  });

  it('keeps empty seated pockets visible without offering the committed stack for transfer', () => {
    renderSheet({ agent: { ...aggressiveAgent, liveGame: { heroStack: 19326 }, pocket: { ...aggressiveAgent.pocket, balance: 0 } } });
    expect(screen.getByText(/At table:.*19,326/)).toBeInTheDocument();
    expect(screen.getByText(/Chips and bets at the table stay committed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take his chips' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call him in' })).toBeEnabled();
  });

  it('reports a failed transfer and retains the edited amount for retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    renderSheet({ onConfirm });
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), '137');
    await userEvent.click(giveButton());
    expect(screen.getByRole('alert')).toHaveTextContent('Could not move the chips');
    expect(amountField()).toHaveValue(137);
    await userEvent.click(giveButton());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('takes the current whole pocket instead of sending a stale displayed ceiling', async () => {
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });
    await userEvent.click(screen.getByRole('button', { name: 'Take all of it — $2,100' }));
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'take', amount: null });
  });

  it('labels the existing refill bounds honestly for small and large arbitrary transfers', async () => {
    renderSheet({ wallet: { ...wallet, balance: 50000 } });
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), '137');
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Refill from the wallet when he busts (cap $2,000)');
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), '12345');
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Refill from the wallet when he busts (cap $10,000)');
    expect(giveButton()).toBeEnabled();
  });
});

describe('WUI-2 — where he stands', () => {
  beforeEach(() => { telegram.signIn(); });

  it('names the agent being funded', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Fund Aggressive v1.3' })).toBeInTheDocument();
  });

  it('shows his pocket now, the stakes it buys, and what you have to give', () => {
    renderSheet();
    expect(screen.getByText('His pocket now')).toBeInTheDocument();
    expect(screen.getByText('$2,100')).toBeInTheDocument();
    expect(screen.getByText('PLAYS $10/$20')).toBeInTheDocument();
    // UI-3 job C: "Wallet" is "The safe" everywhere else in the product
    // (SafeSheet.jsx) — a second name for the same balance is exactly the
    // ambiguity job C exists to remove.
    expect(screen.getByText('The safe')).toBeInTheDocument();
    expect(screen.getByText('$2,340.50')).toBeInTheDocument();
  });

  it('omits the wallet figure when this deployment has none', () => {
    renderSheet({ wallet: null });
    expect(screen.queryByText('The safe')).not.toBeInTheDocument();
    expect(screen.getByText('His pocket now')).toBeInTheDocument();
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

  it('states the resulting pocket without promising an automatic change of stakes', async () => {
    const user = userEvent.setup();
    renderSheet();
    // BUG-280: this is an added transfer, not a replacement pocket or a buy-in.
    expect(screen.getByText(/Pocket after giving/)).toHaveTextContent('$7,100');

    await user.click(body().getByRole('button', { name: '$2,000' }));
    expect(screen.getByText(/Pocket after giving/)).toHaveTextContent('$4,100');
    expect(screen.getByText(/Choose stakes when sending him to play/)).toBeInTheDocument();
  });

  it('will not give him an empty or zero amount', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.clear(amountField());
    expect(giveButton()).toBeDisabled();

    // Within the default wallet fixture's $2,340.50 — this is about zero and
    // empty, not the safe's own ceiling, which has its own test above.
    await user.type(amountField(), '2000');
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

  // UI-3 job C: GIVE cannot ask for more than the safe holds, so these three
  // — about the give/refill/edit mechanics, not the cap — sit a flush safe
  // behind the sheet. The cap itself gets its own tests, below.
  const flushWallet = { ...wallet, balance: 50_000 };

  it('sends the verb, the amount and the size he is set at', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm, wallet: flushWallet });

    await user.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 5000, cap: 5000, refill: false });
  });

  it('carries the refill toggle rather than a second mode', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm, wallet: flushWallet });

    await user.click(screen.getByRole('checkbox'));
    await user.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 5000, cap: 5000, refill: true });
  });

  it('sends an edited amount, not the default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm, wallet: flushWallet });

    await user.clear(amountField());
    await user.type(amountField(), '7500');
    await user.click(giveButton());

    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 7500, cap: 7500, refill: false });
  });

  it('BUG-230: will not give more than the safe holds', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    // The default wallet fixture holds $2,340.50; his roll is set at $5,000.
    renderSheet({ onConfirm });

    expect(screen.getByText(/The safe only holds \$2,340\.50/)).toBeInTheDocument();
    expect(giveButton()).toBeDisabled();
    await user.clear(amountField());
    await user.type(amountField(), '2000');
    expect(giveButton()).toBeEnabled();
    await user.click(giveButton());
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'give', amount: 2000, cap: 2000, refill: false });
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

describe('UI-3 job C — taking his chips, a genuine third verb', () => {
  beforeEach(() => { telegram.signIn(); });

  it('BUG-230: opens on his whole pocket, principal included', () => {
    renderSheet();
    expect(takeAmountField()).toHaveValue(2100);
    expect(body().getByRole('button', { name: /Take all of it — \$2,100/ })).toBeInTheDocument();
  });

  it('takes an edited amount up to, but not past, his pocket', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.clear(takeAmountField());
    await user.type(takeAmountField(), '400');
    const take = body().getByRole('button', { name: 'Take $400' });
    await user.click(take);
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'take', amount: 400 });
  });

  it('is not offered when his pocket is empty — there is nothing to take', () => {
    renderSheet({ agent: brokeAgent });
    expect(screen.queryByLabelText('Amount to take')).toBeNull();
    expect(screen.queryByText('Or take his chips')).toBeNull();
  });

  it('never ends his session — that is what calling him in is for', () => {
    renderSheet({ agent: cutPlayingAgent });
    const copy = screen.getByText(/He keeps his seat/);
    expect(copy).toHaveTextContent('not calling him in');
  });

  it('a take is a real transfer, routed through fundAgent like give and call in', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });
    await user.click(body().getByRole('button', { name: /Take all of it/ }));
    expect(onConfirm).toHaveBeenCalledWith({ verb: 'take', amount: null });
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
