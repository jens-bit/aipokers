// client/src/components/wallet/LedgerList.test.jsx — YOU-2

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LedgerList, entryLabel } from './LedgerList.jsx';

const nameOf = (id) => ({ agent_a: 'The Grinder', agent_b: 'Loose Cannon' })[id] ?? null;

const entries = [
  { id: '1', ts: 1788690000000, type: 'collect', agentId: 'agent_b', amount: 340 },
  { id: '2', ts: 1788700000000, type: 'fund', agentId: 'agent_a', amount: -500 },
  { id: '3', ts: 1788600000000, type: 'seed', agentId: null, amount: 10000 },
];

describe('entryLabel', () => {
  it('names what happened to the owner\'s money, and who it was about', () => {
    expect(entryLabel(entries[1], nameOf)).toBe('Gave chips · The Grinder');
    expect(entryLabel(entries[0], nameOf)).toBe('Collected · Loose Cannon');
  });

  it('names the entries that are about nobody', () => {
    expect(entryLabel(entries[2], nameOf)).toBe('Opening balance');
  });

  // A retired agent keeps his entry and loses his name. The money still moved.
  it('keeps the entry when the agent is gone', () => {
    expect(entryLabel({ type: 'fund', agentId: 'agent_gone' }, nameOf)).toBe('Gave chips');
  });

  it('has a word for a type it has never seen', () => {
    expect(entryLabel({ type: 'something_new' }, nameOf)).toBe('Adjustment');
  });
});

describe('LedgerList', () => {
  it('lists what happened, newest first', () => {
    render(<LedgerList entries={entries} nameOf={nameOf} />);
    const rows = [...document.querySelectorAll('.wal-ledger__row')].map((r) => r.textContent);
    expect(rows[0]).toContain('Gave chips · The Grinder');
    expect(rows[1]).toContain('Collected · Loose Cannon');
    expect(rows[2]).toContain('Opening balance');
  });

  it('signs money out and money home differently', () => {
    render(<LedgerList entries={entries} nameOf={nameOf} />);
    expect(screen.getByText('−$500')).toBeInTheDocument();
    expect(screen.getByText('+$340')).toBeInTheDocument();
  });

  it('caps the list — a phone is not a place to scroll a hundred receipts', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: String(i), ts: i, type: 'fund', amount: -10 }));
    render(<LedgerList entries={many} nameOf={nameOf} limit={8} />);
    expect(document.querySelectorAll('.wal-ledger__row')).toHaveLength(8);
  });

  // An empty ledger is a deployment with no wallet or an owner who has not
  // moved money yet. Neither wants a heading over an empty box.
  it('draws nothing at all when there is nothing in it', () => {
    const { container } = render(<LedgerList entries={[]} nameOf={nameOf} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Ledger')).toBeNull();
  });

  it('draws nothing when there is no ledger on the wallet at all', () => {
    const { container } = render(<LedgerList entries={undefined} nameOf={nameOf} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('skips an entry with no amount rather than printing NaN', () => {
    render(<LedgerList entries={[...entries, { id: 'x', ts: 9, type: 'fund' }]} nameOf={nameOf} />);
    expect(document.querySelectorAll('.wal-ledger__row')).toHaveLength(3);
  });
});
