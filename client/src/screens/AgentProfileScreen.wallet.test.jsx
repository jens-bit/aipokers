// client/src/screens/AgentProfileScreen.wallet.test.jsx — WUI-3
// The pocket line on the player card, and the collect receipt.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { CollectCard } from '../components/wallet/PocketLine.jsx';
import {
  aggressiveAgent,
  balancedAgent,
  brokeAgent,
  legacyPocketAgent,
  noPocketAgent,
} from '../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../test/harness.js';

function renderProfile(agent, props = {}) {
  return render(
    <AgentProfileScreen
      agent={agent}
      onBack={() => {}}
      onOpenChat={() => {}}
      onWatch={() => {}}
      onFund={() => {}}
      {...props}
    />,
  );
}

const line = () => document.querySelector('.wal-line');

describe('WUI-3 — the pocket line', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('carries money and stakes, and nothing else', () => {
    renderProfile(balancedAgent);

    const row = within(line());
    expect(row.getByText('$6,400')).toBeInTheDocument();
    expect(row.getByText('AUTO')).toBeInTheDocument();
    expect(row.getByText(/plays \$25\/\$50/)).toBeInTheDocument();

    // No attribute, no band, no mood on this row: the pocket decides which
    // tables he sits at and nothing about how well he plays at them.
    expect(row.queryByText(/confident|neutral|frustrated|tilted|sulking/i)).toBeNull();
    expect(line().querySelector('svg')).toBeNull();
  });

  it('says how the money behaves, per mode', () => {
    renderProfile(balancedAgent);
    expect(within(line()).getByText(/refills to \$2,000/)).toBeInTheDocument();
  });

  it('names the allowance for an agent on one', () => {
    renderProfile(aggressiveAgent);
    expect(within(line()).getByText(/\$5,000 allowance/)).toBeInTheDocument();
  });

  it('draws the bar against the roll he was given', () => {
    renderProfile(balancedAgent);
    expect(line().querySelector('.wal-bar__fill').style.width).toBe('64%');
  });

  it('sits between the attribute cluster and the career line', () => {
    const { container } = renderProfile(balancedAgent);
    const text = container.textContent;
    expect(text.indexOf('Attributes')).toBeLessThan(text.indexOf('Pocket'));
    expect(text.indexOf('Pocket')).toBeLessThan(text.indexOf('Career'));
  });

  // WALLET-5 — the pocket line follows the pocket row: Fund is always offered
  // (it is the only way into the mode) and Collect joins it while he is
  // carrying something home. The old "one action, never two" rule is what made
  // a topped-up agent unfundable.
  it('offers Collect beside Fund while he is carrying money home', () => {
    renderProfile(balancedAgent);
    expect(within(line()).getByRole('button', { name: 'Collect' })).toBeInTheDocument();
    expect(within(line()).getByRole('button', { name: 'Fund' })).toBeInTheDocument();
  });

  it('offers Fund when he is broke, and says so without guilt', () => {
    renderProfile(brokeAgent);
    const row = within(line());
    expect(row.getByRole('button', { name: 'Fund' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Collect' })).toBeNull();
    expect(row.getByText('cut off · nothing pending')).toBeInTheDocument();
    expect(row.getByText('CUT OFF')).toBeInTheDocument();
  });

  it('raises Fund to the caller rather than funding on the spot', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn();
    renderProfile(brokeAgent, { onFund });

    await user.click(within(line()).getByRole('button', { name: 'Fund' }));
    expect(onFund).toHaveBeenCalledWith(brokeAgent);
    expect(fetchMock.posts).toHaveLength(0);
  });

  it('graceful absence: no pocket, no row', () => {
    renderProfile(noPocketAgent);
    expect(line()).toBeNull();
    // The card is otherwise exactly what it is today.
    expect(screen.getByText('Attributes')).toBeInTheDocument();
    expect(screen.getByText('Career')).toBeInTheDocument();
  });
});

describe('WUI-3 — the collect receipt', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('appears after a collect, drawn as a transfer', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', { moved: 4400, float: 2000, at: '02:14' }, { method: 'POST' });
    const { container } = renderProfile(balancedAgent);

    await user.click(within(line()).getByRole('button', { name: 'Collect' }));

    const card = await waitFor(() => {
      const el = container.querySelector('.wal-collect');
      expect(el).toBeTruthy();
      return el;
    });

    const receipt = within(card);
    expect(receipt.getByText('Brought home')).toBeInTheDocument();
    expect(receipt.getByText('His pocket')).toBeInTheDocument();
    expect(receipt.getByText('$6,400')).toBeInTheDocument();
    expect(receipt.getByText('→ $2,000')).toBeInTheDocument();
    expect(receipt.getByText('Your wallet')).toBeInTheDocument();
    expect(receipt.getByText('+$4,400')).toBeInTheDocument();
    expect(receipt.getByText('Pocket back to its $2,000 float')).toBeInTheDocument();
  });

  it('POSTs the collect for the right agent', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', { moved: 4400, float: 2000 }, { method: 'POST' });
    renderProfile(balancedAgent);

    await user.click(within(line()).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/collect');
    expect(req.method).toBe('POST');
    expect(req.url).toContain('agent_balanced');
  });

  it('shows no receipt when the collect is refused', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', () => ({ status: 500, body: {} }), { method: 'POST' });
    const { container } = renderProfile(balancedAgent);

    await user.click(within(line()).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    expect(container.querySelector('.wal-collect')).toBeNull();
    expect(within(line()).getByRole('button', { name: 'Collect' })).toBeInTheDocument();
  });
});

describe('WUI-3 — the receipt is a transfer, not a jackpot', () => {
  it('states both ends of the motion and the direction between them', () => {
    const { container } = render(
      <CollectCard pocketBefore={640} float={300} collected={340} at="02:14" />,
    );

    // pocket -> wallet, with an arrow and nothing celebratory.
    expect(screen.getByText('$640')).toBeInTheDocument();
    expect(screen.getByText('+$340')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    const text = container.textContent.toLowerCase();
    for (const word of ['congratulations', 'winner', 'jackpot', 'bonus', 'reward', 'nice work']) {
      expect(text, `the receipt must not say "${word}"`).not.toContain(word);
    }
  });

  it('offers to leave it in only when the caller can act on it', async () => {
    const user = userEvent.setup();
    const onLeaveIn = vi.fn();
    const { rerender } = render(<CollectCard pocketBefore={640} float={300} collected={340} />);
    expect(screen.queryByRole('button', { name: 'Leave it in' })).toBeNull();

    rerender(<CollectCard pocketBefore={640} float={300} collected={340} onLeaveIn={onLeaveIn} />);
    await user.click(screen.getByRole('button', { name: 'Leave it in' }));
    expect(onLeaveIn).toHaveBeenCalled();
  });
});

describe('WUI-3 — no dead buttons', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  // The profile card is reachable from hosts that do not own the funding
  // sheet. Until App.jsx passes onFund, the row states the fact and offers
  // nothing — better than a button that does nothing when tapped.
  it('omits Fund when the host cannot fund', () => {
    renderProfile(brokeAgent, { onFund: undefined });
    expect(within(line()).queryByRole('button', { name: 'Fund' })).toBeNull();
    // The state is still reported in full.
    expect(within(line()).getByText('CUT OFF')).toBeInTheDocument();
    expect(within(line()).getByText('cut off · nothing pending')).toBeInTheDocument();
  });
});

describe('WUI-4 — float and pnl from the contract', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('an auto pocket names the float it refills to, not its cap', () => {
    renderProfile(balancedAgent);
    // cap 10,000 is the ceiling; 2,000 is where collect leaves him and where
    // auto tops him back up to. The sentence is about the float.
    expect(within(line()).getByText(/refills to \$2,000/)).toBeInTheDocument();
    expect(within(line()).queryByText(/refills to \$10,000/)).toBeNull();
  });

  it('the receipt leaves him at his float, taking only what is above it', async () => {
    const user = userEvent.setup();
    // No float in the response: it still comes out right, from the pocket.
    fetchMock.route('/collect', {}, { method: 'POST' });
    const { container } = renderProfile(balancedAgent);

    await user.click(within(line()).getByRole('button', { name: 'Collect' }));

    const receipt = within(await waitFor(() => {
      const el = container.querySelector('.wal-collect');
      expect(el).toBeTruthy();
      return el;
    }));
    expect(receipt.getByText('→ $2,000')).toBeInTheDocument();
    expect(receipt.getByText('+$4,400')).toBeInTheDocument();
  });

  it('an older projection with no float or pnl still renders, quietly', () => {
    renderProfile(legacyPocketAgent);
    const row = within(line());
    expect(row.getByText('$3,000')).toBeInTheDocument();
    // No stakes label and no float to key the fallback ladder off — the cap
    // answers instead, and nothing is invented.
    expect(row.getByText(/plays \$10\/\$20/)).toBeInTheDocument();
    expect(row.queryByText(/refills to/)).toBeNull();
  });
});
