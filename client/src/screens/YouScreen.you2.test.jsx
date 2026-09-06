// client/src/screens/YouScreen.you2.test.jsx — YOU-2, SAFE-2
//
// What YOU is after the money moved out of it: a summary that opens the sheet,
// the ledger, the notifications row, and — when the server has seats — the
// slots row. The pockets are asserted in YouScreen.wallet.test.jsx, through the
// tap, and in SafeSheet.test.jsx.
//
// SAFE-2 changed what opens. It is the SAFE — one number and three verbs — so
// the two assertions that looked for `.wal-block` look for that number instead;
// the block itself is board 29 F12's own casualty. And the sheet is a LAYER
// over this screen rather than a replacement for it, because what it draws is
// no longer a scrolling grid that needs the whole phone.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { YouScreen } from './YouScreen.jsx';
import { wallet, walletAgentsResponse } from '../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../test/harness.js';

function withMoney() {
  fetchMock.route('/api/wallet', wallet);
  fetchMock.route('/api/agents?', walletAgentsResponse);
  fetchMock.route('/hands', { recentHands: [] });
}

const summary = () => screen.getByRole('button', { name: 'Money' });
const settingValue = (label) => screen.getByText(label).closest('div');

describe('YOU-2 — the summary', () => {
  beforeEach(() => { telegram.signIn(); withMoney(); });

  it('leads with the balance, and is the one way to the money', async () => {
    render(<YouScreen />);
    await waitFor(() => expect(within(summary()).getByText('$2,340.50')).toBeInTheDocument());
  });

  it('says how much of it is out with the agents', async () => {
    render(<YouScreen />);
    await waitFor(() => expect(within(summary()).getByText('$1,150 out')).toBeInTheDocument());
  });

  it('opens the money sheet — the same one any other surface opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<YouScreen />);
    await user.click(await screen.findByRole('button', { name: 'Money' }));

    await waitFor(() => expect(container.querySelector('.money-sheet')).toBeTruthy());
    expect(container.querySelector('.safe__amount').textContent).toBe('$2,340.50');
  });

  it('comes back to the screen it left', async () => {
    const user = userEvent.setup();
    const { container } = render(<YouScreen />);
    await user.click(await screen.findByRole('button', { name: 'Money' }));
    await waitFor(() => expect(container.querySelector('.money-sheet')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Lifetime')).toBeInTheDocument();
    expect(container.querySelector('.money-sheet')).toBeNull();
  });

  // No second money UI: the number and the pockets exist in exactly one place.
  it('carries no wallet block and no pocket rows of its own', async () => {
    const { container } = render(<YouScreen />);
    await screen.findByText('Lifetime');
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelectorAll('.wal-row')).toHaveLength(0);
  });
});

describe('YOU-2 — the ledger', () => {
  beforeEach(() => { telegram.signIn(); withMoney(); });

  it('draws what the wallet has been recording all along', async () => {
    render(<YouScreen />);
    expect(await screen.findByText('Ledger')).toBeInTheDocument();
    expect(screen.getByText(/^Topped up/)).toBeInTheDocument();
    expect(screen.getByText('−$500')).toBeInTheDocument();
  });

  it('names the agent an entry was about', async () => {
    render(<YouScreen />);
    await screen.findByText('Ledger');
    expect(screen.getByText("Topped up Aggressive v1.3's pocket")).toBeInTheDocument();
    expect(screen.getByText('Balanced v2.1 came home')).toBeInTheDocument();
  });

  // YOU-2 proved the record did not MOVE into the sheet by watching it
  // disappear when the sheet took the screen. SAFE-2 gave the safe a record of
  // its own — F12b's pull-up — and made the sheet a layer, so the disappearing
  // act is gone and the rule it stood for is the one still worth holding: this
  // screen's ledger is this screen's, and the safe's waits to be pulled up.
  it('stays on the screen the sheet is drawn over', async () => {
    const user = userEvent.setup();
    render(<YouScreen />);
    await screen.findByText('Ledger');

    await user.click(summary());
    await screen.findByText('In the safe');
    expect(screen.getByText('Ledger')).toBeInTheDocument();
    expect(screen.queryByTestId('safe-ledger')).toBeNull();
  });

  it('is absent on a deployment with no wallet to record anything', async () => {
    fetchMock.route('/api/wallet', () => ({ status: 404, body: {} }));
    render(<YouScreen />);
    await screen.findByText('Lifetime');
    expect(screen.queryByText('Ledger')).toBeNull();
  });
});

describe('YOU-2 — the slots row', () => {
  beforeEach(() => { telegram.signIn(); withMoney(); });

  it('says how many seats are taken and what opens the next one', async () => {
    fetchMock.route('/api/slots', { used: 2, total: 4, nextAt: 10000 });
    render(<YouScreen />);
    expect(await screen.findByText('2 of 4 seats · next 10,000 won')).toBeInTheDocument();
    expect(screen.getByText('Slots')).toBeInTheDocument();
  });

  // The row ships before the server does, so its absence has to be silent.
  it('is not there at all when the server has no seats', async () => {
    fetchMock.route('/api/slots', () => ({ status: 404, body: {} }));
    render(<YouScreen />);
    await screen.findByText('Settings');
    expect(screen.queryByText('Slots')).toBeNull();
    expect(screen.queryByText(/seats/)).toBeNull();
  });

  it('sits with the other settings rows, which are untouched', async () => {
    fetchMock.route('/api/slots', { used: 2, total: 4, nextAt: 10000 });
    fetchMock.route('/api/notifications/budget', { used: 1, max: 3, held: 0, enabled: true });
    render(<YouScreen />);

    await screen.findByText('Slots');
    expect(within(settingValue('Notifications')).getByText('1/3 today')).toBeInTheDocument();
    expect(screen.getByText('Table limits')).toBeInTheDocument();
    expect(screen.getByText('Help & rules')).toBeInTheDocument();
  });
});

// The fund intent. YOU-2 put the money behind a tap, which is right for
// someone browsing and wrong for someone who was SENT here to deal with money
// — the profile's "Give him chips" and the watch screen's end-of-session Fund
// both mean "take me to the money", not "take me to YOU".
describe('YOU-2 — arriving with money to deal with', () => {
  beforeEach(() => { telegram.signIn(); withMoney(); });

  it('opens on the sheet when the host sent him here for it', async () => {
    const { container } = render(<YouScreen openMoney />);
    await waitFor(() => expect(container.querySelector('.money-sheet')).toBeTruthy());
    expect(container.querySelector('.safe__amount')).toBeTruthy();
  });

  it('lets him close it — the intent lands him there, it does not pin him there', async () => {
    const user = userEvent.setup();
    const { container } = render(<YouScreen openMoney />);
    await waitFor(() => expect(container.querySelector('.money-sheet')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Lifetime')).toBeInTheDocument();
  });

  it('opens on the screen for someone who just walked in', async () => {
    const { container } = render(<YouScreen />);
    await screen.findByText('Lifetime');
    expect(container.querySelector('.money-sheet')).toBeNull();
  });
});
