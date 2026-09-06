// client/src/components/wallet/SafeSheet.test.jsx — SAFE-2
//
// The safe, tested as a component. What YOU's own suite proves is that the
// money can be REACHED from there; what this file proves is that the sheet
// stands on its own — which is the whole reason it is a component, because the
// room's safe and the desk's rail open this same one and neither can bring a
// screen with it.
//
// THIS FILE REPLACES MoneySheet.test.jsx. Four of its assertions are carried
// over word for word (no fetch of its own, Back closes it, a landed verb tells
// the host, a refused one does not) because those are rules about the surface
// and the surface still has them. The two that went are the two board 29 F12
// deliberately killed: "carries the wallet block" and "one row per pocket, with
// no screen around it". A grid of four pockets with the balance somewhere among
// them is exactly what the safe replaced, so a test demanding one would be
// demanding the old design back.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SafeSheet } from './SafeSheet.jsx';
import { balancedAgent, brokeAgent, wallet, walletAgentsResponse } from '../../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../../test/harness.js';

const agents = walletAgentsResponse.agents;
const noop = () => {};

// The fixture's own ledger stamps, read as an evening rather than as whenever
// the suite happens to run.
const NOW = 1788702000000;

function renderSafe(props = {}) {
  return render(
    <SafeSheet wallet={wallet} agents={agents} now={NOW} onRefresh={noop} onClose={noop} {...props} />,
  );
}

const openVerb = async (user, name) => user.click(screen.getByRole('button', { name: new RegExp(name, 'i') }));

describe('SAFE-2 — one number, three verbs', () => {
  beforeEach(() => { telegram.signIn(); });

  it('leads with what is in the safe, and nothing else claims to be a balance', () => {
    const { container } = renderSafe();
    expect(container.querySelector('.safe__amount').textContent).toBe('$2,340.50');
    // The one number law: no second money figure beside it on the front page.
    expect(container.querySelectorAll('.safe__amount')).toHaveLength(1);
    expect(container.querySelector('.wal-block')).toBeNull();
    expect(container.querySelectorAll('.wal-row')).toHaveLength(0);
  });

  it('offers the three things you can do about it, and no fourth', () => {
    const { container } = renderSafe();
    const verbs = [...container.querySelectorAll('.safe__verb')];
    expect(verbs.map((v) => v.dataset.verb)).toEqual(['give', 'take', 'rules']);
    expect(verbs.map((v) => v.querySelector('.safe__verb-note').textContent))
      .toEqual(['to a pocket', 'winnings out', 'per agent']);
  });

  it('needs nothing but a wallet and a roster — the host owns the data', () => {
    renderSafe();
    // Not one request of its own: a sheet that re-fetched would disagree with
    // the screen that opened it for as long as the request took.
    expect(fetchMock.requests).toHaveLength(0);
  });

  it('closes back to whatever opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSafe({ onClose });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says it has no safe rather than drawing three buttons onto a 404', () => {
    const { container } = render(
      <SafeSheet wallet={null} agents={[]} onRefresh={noop} onClose={noop} />,
    );
    expect(container.querySelector('.safe__amount').textContent).toBe('—');
    expect(container.querySelectorAll('.safe__verb')).toHaveLength(0);
    expect(container.querySelector('.wal-row')).toBeNull();
  });
});

describe('SAFE-2 — tonight, in three lines', () => {
  beforeEach(() => { telegram.signIn(); });

  it('draws three lines and gives every figure the sentence that caused it', () => {
    const { container } = renderSafe();
    const lines = [...container.querySelectorAll('.safe__line')];
    expect(lines).toHaveLength(3);

    expect(lines.map((l) => l.querySelector('.safe__line-label').textContent))
      .toEqual(['Brought home', 'Spent at the fridge', 'Given out']);
    // No figure floats: each one has its cause under it.
    for (const line of lines) {
      expect(line.querySelector('.safe__line-note').textContent.length).toBeGreaterThan(0);
    }
    expect(within(lines[0]).getByText('+$340')).toBeInTheDocument();
    expect(lines[0].querySelector('.safe__line-note').textContent).toBe('Balanced v2.1');
    expect(within(lines[2]).getByText('−$500')).toBeInTheDocument();
  });
});

describe('SAFE-2 — a verb is a page of this sheet', () => {
  beforeEach(() => { telegram.signIn(); });

  it('GIVE opens who you can give to, and back returns to the number', async () => {
    const user = userEvent.setup();
    const { container } = renderSafe();

    await openVerb(user, 'GIVE');
    expect(container.querySelectorAll('.wal-row')).toHaveLength(4);
    // The number is not layered under it — a page, not a popover.
    expect(container.querySelector('.safe__amount')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(container.querySelector('.safe__amount')).toBeTruthy();
  });

  it('GIVE offers only giving: taking is the other verb', async () => {
    const user = userEvent.setup();
    renderSafe();
    await openVerb(user, 'GIVE');

    const row = screen.getByText(balancedAgent.name).closest('.wal-row');
    expect(within(row).getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Collect' })).toBeNull();
  });

  it('GIVE opens the funding sheet in the same sheet, not on top of it', async () => {
    const user = userEvent.setup();
    renderSafe();
    await openVerb(user, 'GIVE');

    const row = screen.getByText(brokeAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Give him chips' }));

    await waitFor(() => expect(document.querySelectorAll('.wal-row')).toHaveLength(0));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('TAKE lists only who has something to bring home', async () => {
    const user = userEvent.setup();
    const { container } = renderSafe();
    await openVerb(user, 'TAKE');

    // Balanced (+340) and Bluff (+236) are up; Aggressive is down and Value Bot
    // is called in and empty.
    const names = [...container.querySelectorAll('.wal-row__name')].map((el) => el.textContent);
    expect(names).toEqual(['Balanced v2.1', 'Aggressive v1.3', 'Bluff Master']);
    expect(within(screen.getByText('Bluff Master').closest('.wal-row')).getByRole('button', { name: 'Collect' }))
      .toBeInTheDocument();
    // Aggressive is only there because he is SEATED with a roll to call in.
    const down = screen.getByText('Aggressive v1.3').closest('.wal-row');
    expect(within(down).queryByRole('button', { name: 'Collect' })).toBeNull();
    expect(within(down).getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
  });

  it('tells the host when money has moved, so what is behind it is not stale', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    renderSafe({ onRefresh });
    await openVerb(user, 'TAKE');

    const row = screen.getByText(balancedAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('does not tell the host anything when the server refused', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    fetchMock.route('/collect', () => ({ status: 500, body: {} }), { method: 'POST' });
    renderSafe({ onRefresh });
    await openVerb(user, 'TAKE');

    const row = screen.getByText(balancedAgent.name).closest('.wal-row');
    await user.click(within(row).getByRole('button', { name: 'Collect' }));

    await waitFor(() => expect(fetchMock.posts.length).toBe(1));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('RULES is one line per agent, and the toggle moves no chips', async () => {
    const user = userEvent.setup();
    fetchMock.route('/fund', { moved: 0 }, { method: 'POST' });
    const { container } = renderSafe();
    await openVerb(user, 'RULES');

    expect(container.querySelectorAll('.safe-rule')).toHaveLength(4);
    // WALLET-7's vocabulary, not the four stored modes.
    expect(screen.getAllByText('STAKED').length).toBeGreaterThan(0);
    expect(screen.getByText('CALLED IN')).toBeInTheDocument();

    const row = container.querySelector('[data-agent="agent_aggressive"]');
    await user.click(within(row).getByRole('checkbox'));

    await waitFor(() => expect(fetchMock.requestsMatching('/fund')).toHaveLength(1));
    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.url).toContain('agent_aggressive');
    expect(req.body).toMatchObject({ verb: 'give', amount: 0, refill: true });
  });
});

describe('SAFE-2 — the ledger is the sheet\'s second size', () => {
  beforeEach(() => { telegram.signIn(); });

  // Twenty entries, which is what walletProjection sends at most.
  const many = {
    ...wallet,
    ledger: Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`, ts: NOW - i * 60_000, type: i % 2 ? 'fund' : 'collect',
      agentId: 'agent_balanced', amount: i % 2 ? -100 : 100,
    })),
  };

  it('is not drawn until it is pulled up', () => {
    renderSafe();
    expect(screen.queryByTestId('safe-ledger')).toBeNull();
    expect(screen.getByRole('button', { name: /pull up for the ledger/i })).toBeInTheDocument();
  });

  it('pulls up on the same glass, newest first, one sentence per line', async () => {
    const user = userEvent.setup();
    const { container } = renderSafe();
    await user.click(screen.getByRole('button', { name: /pull up for the ledger/i }));

    const ledger = screen.getByTestId('safe-ledger');
    expect(within(ledger).getByText('newest first')).toBeInTheDocument();
    // The number did not go anywhere: this is a second size, not a screen.
    expect(container.querySelector('.safe__amount')).toBeTruthy();
    expect(container.querySelector('.safe')).toHaveClass('is-pulled');

    const rows = [...ledger.querySelectorAll('.wal-ledger__row')];
    expect(rows[0].textContent).toContain("Topped up Aggressive v1.3's pocket");
    expect(rows[1].textContent).toContain('Balanced v2.1 came home');
  });

  it('grows as it is scrolled rather than stopping at a round number', async () => {
    const user = userEvent.setup();
    const { container } = renderSafe({ wallet: many });
    await user.click(screen.getByRole('button', { name: /pull up for the ledger/i }));

    expect(container.querySelectorAll('.wal-ledger__row')).toHaveLength(12);
    fireEvent.scroll(container.querySelector('.safe__panel'));
    await waitFor(() => expect(container.querySelectorAll('.wal-ledger__row')).toHaveLength(20));

    // And it stops at what the wallet actually sent — no endless spinner.
    fireEvent.scroll(container.querySelector('.safe__panel'));
    expect(container.querySelectorAll('.wal-ledger__row')).toHaveLength(20);
  });
});

describe('SAFE-2 — in the rail', () => {
  beforeEach(() => { telegram.signIn(); });

  it('puts tonight and the ledger in one scroll, because there is a column for it', () => {
    const { container } = renderSafe({ variant: 'rail' });
    expect(screen.getByTestId('safe-ledger')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pull up for the ledger/i })).toBeNull();
    // No scrim and no grabber: nothing is covered, so there is nothing to
    // dismiss with a finger.
    expect(container.querySelector('.safe__scrim')).toBeNull();
    expect(container.querySelector('.safe__grab')).toBeNull();
  });
});
