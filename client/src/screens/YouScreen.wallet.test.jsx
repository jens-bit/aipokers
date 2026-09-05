// client/src/screens/YouScreen.wallet.test.jsx — WUI-1
// The wallet block and the pocket rows on the You screen.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { YouScreen } from './YouScreen.jsx';
import {
  noWalletAgentsResponse,
  wallet,
  walletAgentsResponse,
} from '../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../test/harness.js';

function withWallet() {
  fetchMock.route('/api/wallet', wallet);
  fetchMock.route('/api/agents?', walletAgentsResponse);
  fetchMock.route('/hands', { recentHands: [] });
}

function withoutWallet() {
  fetchMock.route('/api/wallet', () => ({ status: 404, body: {} }));
  fetchMock.route('/api/agents?', noWalletAgentsResponse);
  fetchMock.route('/hands', { recentHands: [] });
}

// A pocket row, found by the agent it belongs to.
function row(name) {
  return screen.getByText(name).closest('.wal-row');
}

describe('WUI-1 — the wallet block', () => {
  beforeEach(() => { telegram.signIn(); });

  it('leads with one number: the wallet balance', async () => {
    withWallet();
    const { container } = render(<YouScreen />);

    await waitFor(() => expect(container.querySelector('.wal-block')).toBeTruthy());
    expect(within(container.querySelector('.wal-block')).getByText('$2,340.50')).toBeInTheDocument();
  });

  it('says where the rest of it currently is', async () => {
    withWallet();
    const { container } = render(<YouScreen />);
    const block = await waitFor(() => {
      const el = container.querySelector('.wal-block');
      expect(el).toBeTruthy();
      return el;
    });

    expect(within(block).getByText('In pockets')).toBeInTheDocument();
    expect(within(block).getByText('$1,150')).toBeInTheDocument();
    expect(within(block).getByText('Tonight')).toBeInTheDocument();
    expect(within(block).getByText('+$486')).toBeInTheDocument();
    expect(within(block).getByText('Playing')).toBeInTheDocument();
    // Two of the four fixtures are at a table.
    expect(within(block).getByText('2 of 4')).toBeInTheDocument();
  });

  it('does not show two balances at once', async () => {
    withWallet();
    const { container } = render(<YouScreen />);
    await waitFor(() => expect(container.querySelector('.wal-block')).toBeTruthy());

    // The legacy balance card's money footer stands down when a wallet exists.
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
  });
});

describe('WUI-1 — graceful absence', () => {
  beforeEach(() => { telegram.signIn(); });

  it('shows today\'s You screen when this deployment has no wallet', async () => {
    withoutWallet();
    const { container } = render(<YouScreen />);

    await screen.findByText('Lifetime');
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelector('.wal-pockets')).toBeNull();

    // Everything the screen showed before the wallet existed is still there.
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Hands played')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('draws no pocket rows for agents that have no pocket', async () => {
    withoutWallet();
    const { container } = render(<YouScreen />);
    await screen.findByText('Lifetime');
    expect(container.querySelectorAll('.wal-row')).toHaveLength(0);
  });
});

describe('WUI-1 — pocket rows', () => {
  beforeEach(() => {
    telegram.signIn();
    withWallet();
  });

  it('draws one row per pocket, in roster order', async () => {
    const { container } = render(<YouScreen />);
    await waitFor(() => expect(container.querySelectorAll('.wal-row')).toHaveLength(4));

    const names = [...container.querySelectorAll('.wal-row__name')].map((el) => el.textContent);
    expect(names).toEqual(['Balanced v2.1', 'Aggressive v1.3', 'Bluff Master', 'Value Bot']);
  });

  it('states the pocket, the stakes it buys and the P&L', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    const balanced = row('Balanced v2.1');
    expect(within(balanced).getByText('$640')).toBeInTheDocument();
    expect(within(balanced).getByText('+$340')).toBeInTheDocument();

    // The ref's law: the roll he was given sets the stakes, not today's
    // balance. $500 allowance seats him at $10/$20 on $210 left.
    const aggressive = row('Aggressive v1.3');
    expect(within(aggressive).getByText('$210')).toBeInTheDocument();
    expect(within(aggressive).getByText('$10/$20')).toBeInTheDocument();
    expect(within(aggressive).getByText('−$90')).toBeInTheDocument();
  });

  it('tags how each one gets money', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    expect(within(row('Balanced v2.1')).getByText('AUTO')).toBeInTheDocument();
    expect(within(row('Aggressive v1.3')).getByText('ALLOWANCE')).toBeInTheDocument();
    expect(within(row('Bluff Master')).getByText('TOP-UP')).toBeInTheDocument();
    expect(within(row('Value Bot')).getByText('CUT OFF')).toBeInTheDocument();
  });

  it('draws the pocket bar against the roll he was given', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    // 640 of a 1000 cap.
    const bar = row('Balanced v2.1').querySelector('.wal-bar__fill');
    expect(bar.style.width).toBe('64%');
    expect(row('Balanced v2.1').querySelector('[role="progressbar"]'))
      .toHaveAttribute('aria-valuenow', '64');
  });

  it('offers exactly one action per row, and it is the right one', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    for (const [name, action, absent] of [
      ['Balanced v2.1', 'Collect', 'Fund'],
      ['Aggressive v1.3', 'Collect', 'Fund'],
      ['Bluff Master', 'Collect', 'Fund'],
      ['Value Bot', 'Fund', 'Collect'],
    ]) {
      const r = within(row(name));
      expect(r.getByRole('button', { name: action })).toBeInTheDocument();
      expect(r.queryByRole('button', { name: absent })).not.toBeInTheDocument();
    }
  });

  it('draws the broke row quieter, never redder — no guilt', async () => {
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    const broke = row('Value Bot');
    expect(broke).toHaveClass('wal-row--broke');
    // Empty bar, in grey.
    expect(broke.querySelector('.wal-bar__fill')).toHaveClass('wal-bar__fill--broke');
    expect(broke.querySelector('.wal-bar__fill').style.width).toBe('0%');
    // Two em dashes and no invented numbers: no stakes because he is not
    // sitting anywhere, and no P&L because there is nothing to report.
    expect(within(broke).getAllByText('—')).toHaveLength(2);
    expect(within(broke).getByText('$0')).toBeInTheDocument();
  });
});

describe('WUI-1 — the row actions', () => {
  beforeEach(() => {
    telegram.signIn();
    withWallet();
  });

  it('Collect brings it home and re-reads the money', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/collect');
    expect(req.method).toBe('POST');
    expect(req.url).toContain('agent_balanced');

    // The wallet figure is re-read rather than guessed at locally.
    await waitFor(() => expect(fetchMock.requestsMatching('/api/wallet').length).toBeGreaterThan(1));
  });

  it('a refused collect leaves the row exactly as it was', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', () => ({ status: 500, body: {} }), { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    expect(within(row('Balanced v2.1')).getByText('$640')).toBeInTheDocument();
    expect(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' })).toBeInTheDocument();
  });

  it('Fund raises the intent for the funding sheet, and POSTs nothing on its own', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Fund' }));

    // Choosing a mode is the sheet's job (WUI-2); the row only asks for it.
    expect(fetchMock.requestsMatching('/fund')).toHaveLength(0);
    expect(fetchMock.posts).toHaveLength(0);
  });
});
