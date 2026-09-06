// client/src/components/wallet/MoneySheet.test.jsx — YOU-2
//
// The extracted surface, tested as a component. What the YOU screen's own
// suite proves is that the money can be REACHED from there and that the verbs
// re-read the wallet; what this file proves is that the sheet stands on its
// own — which is the whole reason it was extracted, because the safe will open
// this same one and must not have to bring a screen with it.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MoneySheet } from './MoneySheet.jsx';
import { balancedAgent, brokeAgent, wallet, walletAgentsResponse } from '../../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../../test/harness.js';

const agents = walletAgentsResponse.agents;
const noop = () => {};

function renderSheet(props = {}) {
  return render(
    <MoneySheet wallet={wallet} agents={agents} onRefresh={noop} onClose={noop} {...props} />,
  );
}

describe('YOU-2 — the money sheet', () => {
  beforeEach(() => { telegram.signIn(); });

  it('carries the wallet block and one row per pocket, with no screen around it', () => {
    const { container } = renderSheet();
    expect(container.querySelector('.wal-block')).toBeTruthy();
    expect(container.querySelectorAll('.wal-row')).toHaveLength(4);
  });

  it('needs nothing but a wallet and a roster — the host owns the data', () => {
    renderSheet();
    // Not one request of its own: a sheet that re-fetched would disagree with
    // the screen that opened it for as long as the request took.
    expect(fetchMock.requests).toHaveLength(0);
  });

  it('closes back to whatever opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSheet({ onClose });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('tells the host when money has moved, so the summary behind it is not stale', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    renderSheet({ onRefresh });

    const row = screen.getByText(balancedAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('does not tell the host anything when the server refused', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    fetchMock.route('/collect', () => ({ status: 500, body: {} }), { method: 'POST' });
    renderSheet({ onRefresh });

    const row = screen.getByText(balancedAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.posts.length).toBe(1));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('opens the funding sheet inside itself, not on top of it', async () => {
    const user = userEvent.setup();
    renderSheet();
    const row = screen.getByText(brokeAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Give him chips' }));

    // The pocket list is gone, not layered over: WUI-2's law is that funding is
    // a decision, not a popover on a scrolling list.
    await waitFor(() => expect(document.querySelectorAll('.wal-row')).toHaveLength(0));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  // WUI-1's law, carried across the extraction intact.
  it('draws no pockets on a deployment that has no wallet', () => {
    const { container } = render(
      <MoneySheet wallet={null} agents={[]} onRefresh={noop} onClose={noop} />,
    );
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelectorAll('.wal-row')).toHaveLength(0);
  });
});
