// client/src/components/wallet/LedgerList.test.jsx — YOU-2, SAFE-2
//
// SAFE-2 changed what a line SAYS and nothing about what the list does. Three
// assertions below moved with it: "Gave chips · The Grinder" was a function
// name and an argument, and board 29 F12b's law is that a figure never appears
// without the thing that caused it — "Topped up The Grinder's pocket". The
// vocabulary itself is proved in lib/safeLines.test.jsx; what is proved here is
// that this list speaks it.

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
    expect(entryLabel(entries[1], nameOf)).toBe("Topped up The Grinder's pocket");
    expect(entryLabel(entries[0], nameOf)).toBe('Loose Cannon came home');
  });

  it('names the entries that are about nobody', () => {
    expect(entryLabel(entries[2], nameOf)).toBe('Opening balance');
  });

  // A retired agent keeps his entry and loses his name. The money still moved.
  it('keeps the entry when the agent is gone', () => {
    expect(entryLabel({ type: 'fund', agentId: 'agent_gone' }, nameOf)).toBe('Topped up a pocket');
  });

  it('has a word for a type it has never seen', () => {
    expect(entryLabel({ type: 'something_new' }, nameOf)).toBe('Adjustment');
  });
});

describe('LedgerList', () => {
  it('lists what happened, newest first', () => {
    render(<LedgerList entries={entries} nameOf={nameOf} />);
    const rows = [...document.querySelectorAll('.wal-ledger__row')].map((r) => r.textContent);
    expect(rows[0]).toContain("Topped up The Grinder's pocket");
    expect(rows[1]).toContain('Loose Cannon came home');
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
