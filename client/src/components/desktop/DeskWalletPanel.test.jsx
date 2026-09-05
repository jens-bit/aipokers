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
  it('carries the ref line once: the pocket is the bet', () => {
    expect(renderPanel().container.querySelectorAll('.wal-pockets')).toHaveLength(1);
    expect(screen.getAllByText(/pocket size sets his stakes/)).toHaveLength(1);
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

  it('says so plainly when this deployment has no wallet', () => {
    const { container } = renderPanel({ wallet: null });
    expect(screen.getByText(/no wallet yet/i)).toBeInTheDocument();
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelector('.wal-row')).toBeNull();
  });
});

describe('DP-2 — funding from the rail', () => {
  beforeEach(() => { telegram.signIn(); });

  it('the sheet takes the panel, and the list is not behind it', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Fund' }));

    expect(await screen.findByRole('dialog', { name: 'Fund Value Bot' })).toBeInTheDocument();
    expect(screen.queryByText('Balanced v2.1')).not.toBeInTheDocument();
  });

  it('offers the same four choices the phone does, cut-off included', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Fund' }));

    const body = within(document.querySelector('.wal-sheet__body'));
    for (const title of ['One-time top-up', 'Allowance', 'Auto-refill', 'Cut him off']) {
      expect(body.getByRole('button', { name: new RegExp(title, 'i') })).toBeInTheDocument();
    }
  });

  it('hands the decision up in the contract shape, then leaves the sheet', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onFund });

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Fund' }));
    await screen.findByRole('dialog');
    // WALLET-5: he was cut off, so the sheet opens on the cut. Putting him back
    // on an allowance is a choice the owner makes here, and the size he is put
    // on rides along so the sheet can reopen on it.
    await user.click(within(document.querySelector('.wal-sheet__body')).getByRole('button', { name: /Allowance/i }));
    await user.click(screen.getByRole('button', { name: /Set allowance/i }));

    await waitFor(() => expect(onFund).toHaveBeenCalled());
    expect(onFund.mock.calls[0][0].id).toBe('agent_value');
    expect(onFund.mock.calls[0][1]).toMatchObject({ mode: 'allowance', cap: 5000 });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Balanced v2.1')).toBeInTheDocument();
  });

  it('cancelling funds nothing and puts the list back', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn();
    renderPanel({ onFund });

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Fund' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onFund).not.toHaveBeenCalled();
    expect(screen.getByText('Balanced v2.1')).toBeInTheDocument();
  });

  it('collecting raises the agent, and the panel does not guess at the money', async () => {
    const user = userEvent.setup();
    const onCollect = vi.fn();
    renderPanel({ onCollect });

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' }));
    expect(onCollect).toHaveBeenCalledWith(balancedAgent);
    // The figure on screen is still the one the server last gave us.
    expect(screen.getByText('$2,340.50')).toBeInTheDocument();
  });
});
