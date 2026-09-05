// client/src/components/wallet/FundSheet.test.jsx — WUI-2
// Three modes plus the cut-off, the cap field, and the copy law: cutting him
// off is a legitimate answer drawn without a shred of guilt.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The cap field's size is a stylesheet rule, so the stylesheet has to be here
// for getComputedStyle to see it (vite.config.js has css: true).
import '../../styles/wallet.css';

import { FundSheet } from './FundSheet.jsx';
import { aggressiveAgent, brokeAgent, wallet } from '../../test/fixtures/wallet.js';
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
// Scoping keeps "Allowance" the choice apart from "Set allowance" the action.
const options = () => within(document.querySelector('.wal-sheet__body'));
const option = (title) => options().getByRole('button', { name: new RegExp(title, 'i') });

describe('WUI-2 — where he stands', () => {
  beforeEach(() => { telegram.signIn(); });

  it('names the agent being funded', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Fund Aggressive v1.3' })).toBeInTheDocument();
  });

  it('shows his pocket now, the stakes it buys, and what you have to give', () => {
    renderSheet();
    expect(screen.getByText('Pocket now')).toBeInTheDocument();
    expect(screen.getByText('$210')).toBeInTheDocument();
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

describe('WUI-2 — the four ways he gets money', () => {
  beforeEach(() => { telegram.signIn(); });

  it('offers all four, cut-off included, as choices of equal weight', () => {
    renderSheet();
    expect(option('One-time top-up')).toBeInTheDocument();
    expect(option('Allowance')).toBeInTheDocument();
    expect(option('Auto-refill')).toBeInTheDocument();
    expect(option('Cut him off')).toBeInTheDocument();
  });

  it('explains each one in a line', () => {
    renderSheet();
    expect(screen.getByText(/one-time\. When it is gone, he stops\./)).toBeInTheDocument();
    expect(screen.getByText(/a fixed budget\. He plays until it runs out\./)).toBeInTheDocument();
    expect(screen.getByText(/he collects from the wallet when broke, up to a cap\./)).toBeInTheDocument();
  });

  it('opens on the mode he is already on', () => {
    renderSheet();
    expect(option('Allowance')).toHaveAttribute('aria-pressed', 'true');
    expect(option('One-time top-up')).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects exactly one mode at a time', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(option('Auto-refill'));
    expect(option('Auto-refill')).toHaveAttribute('aria-pressed', 'true');
    expect(option('Allowance')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('opens on allowance for an agent who was cut off, rather than re-proposing the cut', () => {
    renderSheet({ agent: brokeAgent });
    expect(option('Allowance')).toHaveAttribute('aria-pressed', 'true');
    expect(option('Cut him off')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('WUI-2 — the cap', () => {
  beforeEach(() => { telegram.signIn(); });

  it('offers an amount field with the mode\'s own default', () => {
    renderSheet();
    expect(screen.getByLabelText(/Amount/i)).toHaveValue(500);
  });

  it('calls it a cap for auto-refill, because that is what it is', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(option('Auto-refill'));
    expect(screen.getByLabelText(/Cap/i)).toHaveValue(1000);
  });

  it('states what the choice buys — bigger pocket, bigger stakes', async () => {
    const user = userEvent.setup();
    renderSheet();
    expect(screen.getByText(/seats him at/)).toHaveTextContent('$10/$20');

    await user.click(option('One-time top-up'));
    expect(screen.getByText(/seats him at/)).toHaveTextContent('$5/$10');
  });

  it('will not confirm an empty or zero amount', async () => {
    const user = userEvent.setup();
    renderSheet();
    const field = screen.getByLabelText(/Amount/i);

    await user.clear(field);
    expect(screen.getByRole('button', { name: /Set allowance/i })).toBeDisabled();

    await user.type(field, '250');
    expect(screen.getByRole('button', { name: /Set allowance/i })).toBeEnabled();
  });

  // BUG-02: anything below 16px auto-zooms iOS Safari on focus.
  it('the amount field is at least 16px', () => {
    const { container } = renderSheet();
    const field = container.querySelector('input');
    expect(parseFloat(window.getComputedStyle(field).fontSize)).toBeGreaterThanOrEqual(16);
  });
});

describe('WUI-2 — cutting him off, without guilt', () => {
  beforeEach(() => { telegram.signIn(); });

  it('says what he keeps, not what he loses', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(option('Cut him off'));

    const copy = screen.getByText(/He finishes the hand he is in/);
    expect(copy).toHaveTextContent('takes a seat at the bar');
    expect(copy).toHaveTextContent('Nothing is lost');
    expect(copy).toHaveTextContent('his attributes, his read book and his grudges all keep');
  });

  it('never scolds, pleads or warns', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    await user.click(option('Cut him off'));

    const text = container.textContent.toLowerCase();
    for (const word of ['sorry', 'warning', 'careful', 'lose', 'lost forever', 'punish', 'are you sure']) {
      expect(text, `the cut-off state must not say "${word}"`).not.toContain(word);
    }
  });

  it('asks for no amount — there is nothing to size', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    await user.click(option('Cut him off'));

    expect(container.querySelector('input')).toBeNull();
    expect(screen.queryByText(/seats him at/)).not.toBeInTheDocument();
    expect(screen.getByText(/He keeps his seat at the bar until you say otherwise/)).toBeInTheDocument();
  });

  it('confirms as a plain choice, with no confirmation gauntlet', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(option('Cut him off'));
    await user.click(screen.getByRole('button', { name: 'Cut him off', exact: true }));

    expect(onConfirm).toHaveBeenCalledWith({ mode: 'cut', amount: null, cap: null });
  });
});

describe('WUI-2 — confirming', () => {
  beforeEach(() => { telegram.signIn(); });

  it('sends the allowance in the contract shape', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(screen.getByRole('button', { name: /Set allowance/i }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'allowance', amount: 500, cap: null });
  });

  it('sends auto-refill with its cap on the cap field', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    await user.click(option('Auto-refill'));
    await user.click(screen.getByRole('button', { name: /Set auto-refill/i }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'auto', amount: 1000, cap: 1000 });
  });

  it('sends an edited amount, not the default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderSheet({ onConfirm });

    const field = screen.getByLabelText(/Amount/i);
    await user.clear(field);
    await user.type(field, '750');
    await user.click(screen.getByRole('button', { name: /Set allowance/i }));

    expect(onConfirm).toHaveBeenCalledWith({ mode: 'allowance', amount: 750, cap: null });
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
