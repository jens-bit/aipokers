// client/src/components/desktop/DeskWalletPanel.test.jsx — DP-2
//
// The wallet as a rail panel. What is worth pinning is that it is the mobile
// wallet — the same block, the same rows, the same sheet — reached from the
// desk, and that it keeps the laws those components already carry.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../styles/desktop.css';

import { DeskWalletPanel } from './DeskWalletPanel.jsx';
import {
  balancedAgent, brokeAgent, noPocketAgent, pocketAgents, wallet,
} from '../../test/fixtures/wallet.js';
import { telegram } from '../../test/harness.js';

function renderPanel(props = {}) {
  return render(
    <DeskWalletPanel
      wallet={wallet}
      agents={pocketAgents}
      onFund={() => {}}
      onCollect={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

const row = (name) => screen.getByText(name).closest('.wal-row');

describe('BUG-280 — desktop pocket transfers', () => {
  beforeEach(() => { telegram.signIn(); });
  it('takes all uncommitted principal without calling the agent in', async () => {
    const onFund = vi.fn(), onCallIn = vi.fn();
    const principal = { ...balancedAgent, pocket: { ...balancedAgent.pocket, collectable: 0, pnl: 0 } };
    renderPanel({ agents: [principal], onFund, onCallIn });
    await userEvent.click(screen.getByRole('button', { name: 'Take all — $6,400' }));
    expect(onFund).toHaveBeenCalledWith(principal, { verb: 'take', amount: null });
    expect(onCallIn).not.toHaveBeenCalled();
  });

  it('exposes a free take amount and preserves the draft when the host rejects it', async () => {
    const onFund = vi.fn().mockRejectedValue(new Error('offline'));
    renderPanel({ agents: [balancedAgent], onFund });
    await userEvent.click(screen.getByRole('button', { name: 'Choose amount' }));
    await userEvent.clear(screen.getByLabelText('Amount to take'));
    await userEvent.type(screen.getByLabelText('Amount to take'), '137');
    await userEvent.click(screen.getByRole('button', { name: 'Take $137' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not move the chips');
    expect(screen.getByLabelText('Amount to take')).toHaveValue(137);
    expect(onFund).toHaveBeenCalledWith(balancedAgent, { verb: 'take', amount: 137 });
  });

  it('shows an empty seated pocket without exposing its table stack as transferable', () => {
    renderPanel({ agents: [{ ...balancedAgent, liveGame: { heroStack: 19326 }, pocket: { ...balancedAgent.pocket, balance: 0 } }] });
    expect(screen.getByText(/At table:.*19,326/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take all — $0' })).toBeDisabled();
  });

  it('closes a confirmed transfer and blocks stale money controls until a failed refresh is retried', async () => {
    const onFund = vi.fn().mockResolvedValue({ moved: 137, refreshFailed: true });
    const onRetry = vi.fn().mockResolvedValue({ balance: 137 });
    renderPanel({ agents: [balancedAgent], onFund, onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Choose amount' }));
    await userEvent.clear(screen.getByLabelText('Amount to take'));
    await userEvent.type(screen.getByLabelText('Amount to take'), '137');
    await userEvent.click(screen.getByRole('button', { name: 'Take $137' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Chips moved');
    expect(screen.getByRole('button', { name: /Take all/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: /Take all/ })).toBeEnabled();
    expect(onFund).toHaveBeenCalledOnce();
  });
});

describe('DP-2 — the wallet in the rail', () => {
  beforeEach(() => { telegram.signIn(); });

  it('leads with the wallet figure', () => {
    const { container } = renderPanel();
    expect(container.querySelector('.wal-block')).toBeTruthy();
    expect(within(container.querySelector('.wal-block')).getByText('$2,340.50')).toBeInTheDocument();
  });

  // The line comes from PocketList, once. The desktop ref writes it four words
  // longer; a second copy on the panel to gain them would be a duplicate of
  // the sentence, which is the thing this port exists to avoid.
  it('labels the transferable pocket separately from a committed buy-in', () => {
    expect(renderPanel().container.querySelectorAll('.wal-pockets')).toHaveLength(1);
    expect(screen.getAllByText(/uncommitted chips only/)).toHaveLength(1);
  });

  it('draws one pocket row per agent that has one', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.wal-row')).toHaveLength(4);
  });

  it('skips agents with no pocket rather than inventing one', () => {
    const { container } = renderPanel({ agents: [balancedAgent, noPocketAgent] });
    expect(container.querySelectorAll('.wal-row')).toHaveLength(1);
  });

  // The desk contributes a panel and some widths. If it ever contributed a
  // second wallet, this is the test that would notice.
  it('is the mobile wallet, not a desktop copy of it', () => {
    const { container } = renderPanel();
    // wal-* is the mobile stylesheet's namespace; dsk-* is the desk's chrome.
    expect(container.querySelector('.wal-block')).toBeTruthy();
    expect(container.querySelector('.wal-pockets')).toBeTruthy();
    expect(container.querySelector('.dsk-panel')).toBeTruthy();
  });

  it('closes back to whatever the rail was showing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel({ onClose });
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DP-2 — graceful absence', () => {
  beforeEach(() => { telegram.signIn(); });

  // BUG-146: Jens rejected the old claim that a failed read proves no wallet
  // exists. Keep the absence of money/verbs, but report the actual read failure.
  it('reports an unconfirmed wallet instead of claiming the deployment has none', () => {
    const { container } = renderPanel({ wallet: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read your safe');
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelector('.wal-row')).toBeNull();
  });
});

describe('DP-2 — funding from the rail', () => {
  beforeEach(() => { telegram.signIn(); });

  it.each(['loading', 'error'])('BUG-146: an open funding sheet respects a %s wallet read and keeps its choices and navigation', async (walletStatus) => {
    const user = userEvent.setup();
    const onFund = vi.fn(), onRetry = vi.fn();
    // A flush safe: this test is about the mid-flow read, not GIVE's own cap.
    const props = { wallet: { ...wallet, balance: 50_000 }, agents: [balancedAgent], onFund, onRetry };
    const { rerender } = render(<DeskWalletPanel {...props} walletStatus="ready" />);
    await user.click(screen.getByRole('button', { name: 'Give him chips' }));
    await user.click(screen.getByRole('button', { name: '$5,000' }));
    rerender(<DeskWalletPanel {...props} walletStatus={walletStatus} />);
    expect(screen.getByRole(walletStatus === 'error' ? 'alert' : 'status')).toHaveTextContent(/safe/i);
    expect(screen.getByRole('button', { name: 'Give him chips' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call him in' })).toBeDisabled();
    // The desktop stylesheet hides FundSheet's duplicate head; the rail's
    // Close and the sheet's Cancel are its two existing ways back.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeEnabled();
    if (walletStatus === 'error') {
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetry).toHaveBeenCalledOnce();
    }
    expect(onFund).not.toHaveBeenCalled();
    rerender(<DeskWalletPanel {...props} walletStatus="ready" />);
    expect(screen.getByLabelText('Amount to give')).toHaveValue(5000);
    expect(screen.getByRole('button', { name: 'Give him chips' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the sheet takes the panel, and the list is not behind it', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));

    expect(await screen.findByRole('dialog', { name: 'Fund Value Bot' })).toBeInTheDocument();
    expect(screen.queryByText('Balanced v2.1')).not.toBeInTheDocument();
  });

  // WALLET-7: the phone offers two verbs and one toggle, so the rail does too.
  it('offers the same two verbs the phone does', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));

    const sheet = within(document.querySelector('.wal-sheet'));
    expect(sheet.getAllByRole('button', { name: 'Give him chips' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // Value Bot has been called in already and holds nothing, so there is
    // nothing to call in — the second verb is not drawn for him.
    expect(sheet.queryByRole('button', { name: 'Call him in' })).toBeNull();
  });

  it('hands the decision up in the contract shape, then leaves the sheet', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn().mockResolvedValue(undefined);
    // A flush safe: this test is about the handoff shape, not GIVE's own cap.
    renderPanel({ onFund, wallet: { ...wallet, balance: 50_000 } });

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(within(document.querySelector('.wal-sheet__body')).getByRole('button', { name: '$5,000' }));
    await user.click(within(document.querySelector('.wal-sheet__foot')).getByRole('button', { name: 'Give him chips' }));

    await waitFor(() => expect(onFund).toHaveBeenCalled());
    expect(onFund.mock.calls[0][0].id).toBe('agent_value');
    expect(onFund.mock.calls[0][1]).toMatchObject({ verb: 'give', amount: 5000, cap: 5000, refill: false });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Balanced v2.1')).toBeInTheDocument();
  });

  it('cancelling funds nothing and puts the list back', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn();
    renderPanel({ onFund });

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onFund).not.toHaveBeenCalled();
    expect(screen.getByText('Balanced v2.1')).toBeInTheDocument();
  });

  it('taking raises the agent and whole-pocket decision, and the panel does not guess at the money', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn();
    renderPanel({ onFund });

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Take all — $6,400' }));
    expect(onFund).toHaveBeenCalledWith(balancedAgent, { verb: 'take', amount: null });
    // The figure on screen is still the one the server last gave us.
    expect(screen.getByText('$2,340.50')).toBeInTheDocument();
  });
});
