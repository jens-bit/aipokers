// client/src/screens/YouScreen.wallet.test.jsx — WUI-1
// The wallet block and the pocket rows on the You screen.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { YouScreen } from './YouScreen.jsx';
import {
  cutPlayingAgent,
  noWalletAgentsResponse,
  toppedUpAgent,
  upAndSeatedAgent,
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
    expect(within(balanced).getByText('$6,400')).toBeInTheDocument();
    expect(within(balanced).getByText('+$340')).toBeInTheDocument();

    // The rung the server seated him at, sent as pocket.stakes.label — the
    // client never runs a second ladder of its own.
    const aggressive = row('Aggressive v1.3');
    expect(within(aggressive).getByText('$2,100')).toBeInTheDocument();
    expect(within(aggressive).getByText('$10/$20')).toBeInTheDocument();
    expect(within(aggressive).getByText('−$90')).toBeInTheDocument();
  });

  // WALLET-7: the four mode names are gone from the owner's vocabulary. What
  // is left is what the two verbs and the one toggle produce — a staked pocket,
  // a refilling one, and one that has been called in.
  it('tags how each one gets money', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    expect(within(row('Balanced v2.1')).getByText('REFILLS')).toBeInTheDocument();
    expect(within(row('Aggressive v1.3')).getByText('STAKED')).toBeInTheDocument();
    // 'topup' and 'allowance' were the same thing under two names, so the row
    // says the one thing they both are.
    expect(within(row('Bluff Master')).getByText('STAKED')).toBeInTheDocument();
    expect(within(row('Value Bot')).getByText('CALLED IN')).toBeInTheDocument();
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

  // WALLET-5/7 — this used to assert "exactly one action per row, and Collect
  // wins". The playtest showed what that costs: funding an agent past his
  // float removed Fund, so there was no way left to add more or to change how
  // he gets money. Giving him chips is unconditional now; Collect joins it when
  // he is up, and "Call him in" while he is seated.
  it('always offers to give him chips, whatever else the row offers', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    for (const name of ['Balanced v2.1', 'Aggressive v1.3', 'Bluff Master', 'Value Bot']) {
      expect(within(row(name)).getByRole('button', { name: 'Give him chips' }), name).toBeInTheDocument();
    }
  });

  it('offers Collect beside it only for the ones who are up', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    for (const [name, collect] of [
      ['Balanced v2.1', true],    // up $340
      ['Aggressive v1.3', false], // down $90, however much he still holds
      ['Bluff Master', true],     // up $236
      ['Value Bot', false],       // called in, and empty
    ]) {
      const q = within(row(name)).queryByRole('button', { name: 'Collect' });
      expect(Boolean(q), name).toBe(collect);
    }
  });

  it('offers Call him in on the rows that are at a table', async () => {
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    for (const [name, callIn] of [
      ['Balanced v2.1', true],    // playing
      ['Aggressive v1.3', true],  // playing
      ['Bluff Master', false],    // resting — nothing to call him in from
      ['Value Bot', false],       // already called in
    ]) {
      const q = within(row(name)).queryByRole('button', { name: 'Call him in' });
      expect(Boolean(q), name).toBe(callIn);
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
    // One em dash and no invented numbers: no stakes, because he is not
    // sitting anywhere. The pocket and the P&L are both a real, computed zero.
    expect(within(broke).getAllByText('—')).toHaveLength(1);
    expect(within(broke).getAllByText('$0')).toHaveLength(2);
  });
});

describe('WUI-1 — the row actions', () => {
  beforeEach(() => {
    telegram.signIn();
    withWallet();
  });

  it('Collect takes the winnings and re-reads the money', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/collect');
    expect(req.method).toBe('POST');
    expect(req.url).toContain('agent_balanced');
    // WALLET-7: the winnings, not the roll. `all` is the called-in path.
    expect(req.body).toMatchObject({ all: false });

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
    expect(within(row('Balanced v2.1')).getByText('$6,400')).toBeInTheDocument();
    expect(within(row('Balanced v2.1')).getByRole('button', { name: 'Collect' })).toBeInTheDocument();
  });

  // WALLET-7 — the second verb, from the row. One press: he finishes the hand,
  // takes a seat at the bar, and everything in the pocket comes home. It is the
  // same route as giving him chips, because it is the same decision.
  it('Call him in POSTs the verb and re-reads the money', async () => {
    const user = userEvent.setup();
    fetchMock.route('/fund', { collected: 6400 }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Call him in' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.url).toContain('agent_balanced');
    expect(req.body).toMatchObject({ verb: 'callin' });
    await waitFor(() => expect(fetchMock.requestsMatching('/api/wallet').length).toBeGreaterThan(1));
  });

  it('a refused call-in leaves the row exactly as it was', async () => {
    const user = userEvent.setup();
    fetchMock.route('/fund', () => ({ status: 500, body: {} }), { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Balanced v2.1');

    await user.click(within(row('Balanced v2.1')).getByRole('button', { name: 'Call him in' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    expect(within(row('Balanced v2.1')).getByText('$6,400')).toBeInTheDocument();
  });

  it('giving him chips raises the intent for the sheet, and POSTs nothing on its own', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));

    // Choosing a mode is the sheet's job (WUI-2); the row only asks for it.
    expect(fetchMock.requestsMatching('/fund')).toHaveLength(0);
    expect(fetchMock.posts).toHaveLength(0);
  });
});

describe('WUI-2 — the funding sheet on the You screen', () => {
  beforeEach(() => {
    telegram.signIn();
    withWallet();
  });

  it('opens the sheet for that agent', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));

    expect(await screen.findByRole('dialog', { name: 'Fund Value Bot' })).toBeInTheDocument();
    // It is a decision, not a popover: the pockets list is not behind it.
    expect(screen.queryByText('Balanced v2.1')).not.toBeInTheDocument();
  });

  it('confirming gives him the chips and re-reads the money', async () => {
    const user = userEvent.setup();
    fetchMock.route('/fund', { ok: true }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(within(document.querySelector('.wal-sheet__body')).getByRole('button', { name: '$5,000' }));
    await user.click(within(document.querySelector('.wal-sheet__foot')).getByRole('button', { name: 'Give him chips' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.url).toContain('agent_value');
    // WALLET-7: the verb, the amount, the size he is set at, and the toggle.
    expect(req.body).toMatchObject({ verb: 'give', amount: 5000, cap: 5000, refill: false });

    // Back to the list, with the wallet re-read rather than guessed at.
    await waitFor(() => expect(screen.getByText('Balanced v2.1')).toBeInTheDocument());
    expect(fetchMock.requestsMatching('/api/wallet').length).toBeGreaterThan(1);
  });

  it('cancelling funds nothing and returns to the pockets', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Balanced v2.1')).toBeInTheDocument();
    expect(fetchMock.requestsMatching('/fund')).toHaveLength(0);
  });

  it('a refused fund keeps the sheet open so the choice is not lost', async () => {
    const user = userEvent.setup();
    fetchMock.route('/fund', () => ({ status: 402, body: {} }), { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Value Bot');

    await user.click(within(row('Value Bot')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(within(document.querySelector('.wal-sheet__foot')).getByRole('button', { name: 'Give him chips' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: 'Fund Value Bot' })).toBeInTheDocument();
  });
});

// ── WALLET-5 · the four playtest bugs on this screen ────────────────────────

// A roster of our own, so the ref's four stay the ref's four.
function withAgents(list) {
  fetchMock.route('/api/wallet', wallet);
  fetchMock.route('/api/agents?', { agents: list });
  fetchMock.route('/hands', { recentHands: [] });
}

describe('WALLET-5/7 — a pocket funded once has nothing to collect', () => {
  beforeEach(() => { telegram.signIn(); });

  // WALLET-7 · the symptom this tree is named after. A one-time top-up could
  // not be collected honestly under either rule: the old one offered a Collect
  // that took the owner's own chips back out of the pocket, and there was no
  // other way to empty it. Now the row says what is true — nothing to collect —
  // and "Call him in" is the button that brings the roll home.
  it('keeps the chips button on a topped-up row, and calls none of it winnings', async () => {
    withAgents([toppedUpAgent]);
    render(<YouScreen />);
    await screen.findByText('Topped Up');

    const r = within(row('Topped Up'));
    expect(r.getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();
    expect(r.queryByRole('button', { name: 'Collect' })).not.toBeInTheDocument();
  });

  it('and calling him in is the way that pocket comes home', async () => {
    const user = userEvent.setup();
    // The same pocket, at a table: one press ends the session and empties it.
    withAgents([{ ...toppedUpAgent, presence: 'playing', activeTableId: 'tbl-1' }]);
    fetchMock.route('/fund', { collected: 4000 }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Topped Up');

    await user.click(within(row('Topped Up')).getByRole('button', { name: 'Call him in' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    expect(fetchMock.requestsMatching('/fund')[0].body).toMatchObject({ verb: 'callin' });
  });

  it('draws all three actions when he is staked, up, and still playing', async () => {
    withAgents([upAndSeatedAgent]);
    render(<YouScreen />);
    await screen.findByText('Up And Seated');

    const r = within(row('Up And Seated'));
    expect(r.getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();
    expect(r.getByRole('button', { name: 'Collect' })).toBeInTheDocument();
    expect(r.getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
  });
});

describe('WALLET-5 — being called in is visible on the row', () => {
  beforeEach(() => {
    telegram.signIn();
    withAgents([cutPlayingAgent]);
  });

  it('badges him CALLED IN and greys the stakes he is not going to play', async () => {
    const { container } = render(<YouScreen />);
    await screen.findByText('Loose Cannon');

    const r = row('Loose Cannon');
    expect(within(r).getByText('CALLED IN')).toBeInTheDocument();
    expect(r).toHaveClass('wal-row--cut');
    // The rung is still stated — he can afford it — but drawn as something he
    // is not going to sit at.
    expect(within(r).getByText('$10/$20')).toBeInTheDocument();
    expect(r.querySelector('.wal-row__stakes')).toHaveClass('is-greyed');
    // Quieter, never redder: no warning colour anywhere on the row.
    expect(r.innerHTML).not.toContain('#FF4D4F');
  });

  it("says what happens next, in the funding sheet's own words", async () => {
    render(<YouScreen />);
    await screen.findByText('Loose Cannon');
    expect(within(row('Loose Cannon')).getByText('finishes this hand then sits at the bar'))
      .toBeInTheDocument();
  });

  it('stops promising it once he is off the table', async () => {
    // The same pocket, at the bar. The promise was about the next few minutes
    // and would be a lie a day later.
    withAgents([{ ...cutPlayingAgent, presence: 'resting', activeTableId: null }]);
    render(<YouScreen />);
    await screen.findByText('Loose Cannon');

    const r = within(row('Loose Cannon'));
    expect(r.queryByText('finishes this hand then sits at the bar')).not.toBeInTheDocument();
    expect(r.getByText('at the bar · nothing pending')).toBeInTheDocument();
  });

  it('collects all of it — he is not sitting down again, so none of it is his to keep', async () => {
    const user = userEvent.setup();
    fetchMock.route('/collect', { collected: 4000 }, { method: 'POST' });
    render(<YouScreen />);
    await screen.findByText('Loose Cannon');

    await user.click(within(row('Loose Cannon')).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/collect')).toHaveLength(1));
    // WALLET-7: `all` replaced `leaveFloat: false`. Same chips, and the flag
    // now says what it does rather than what it declines to leave behind.
    expect(fetchMock.requestsMatching('/collect')[0].body).toMatchObject({ all: true });
  });
});

describe('WALLET-7 — the sheet opens on where he actually stands', () => {
  beforeEach(() => {
    telegram.signIn();
    withAgents([toppedUpAgent]);
  });

  // WALLET-5 asserted this about the mode: reopening the sheet on a cut agent
  // had to show the cut, because a decision the owner took is not a state the
  // UI gets to forget. There is no mode to reopen on any more — what the sheet
  // has to remember is the size he was set at and whether the wallet is
  // backing his next bust.
  it('reopens on the size he was set at and the state of the toggle', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Topped Up');

    await user.click(within(row('Topped Up')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');

    expect(screen.getByLabelText(/Amount/i)).toHaveValue(2000);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('WALLET-5 — his face opens his profile', () => {
  beforeEach(() => {
    telegram.signIn();
    withWallet();
  });

  it('taps through from a pocket row', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    render(<YouScreen onOpenProfile={onOpenProfile} />);
    await screen.findByText('Bluff Master');

    await user.click(within(row('Bluff Master')).getByRole('button', { name: /profile/i }));
    expect(onOpenProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agent_bluff', name: 'Bluff Master' }),
    );
  });

  it("taps through from the sheet's header row too", async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    render(<YouScreen onOpenProfile={onOpenProfile} />);
    await screen.findByText('Bluff Master');

    await user.click(within(row('Bluff Master')).getByRole('button', { name: 'Give him chips' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /profile/i }));

    expect(onOpenProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agent_bluff' }),
    );
  });

  it('leaves the face inert when no host owns that navigation', async () => {
    render(<YouScreen />);
    await screen.findByText('Bluff Master');
    expect(screen.queryByRole('button', { name: /profile/i })).toBeNull();
  });
});
