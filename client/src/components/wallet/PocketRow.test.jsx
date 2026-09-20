import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PocketRow } from './PocketRow.jsx';
import { aggressiveAgent } from '../../test/fixtures/wallet.js';

describe('BUG-280 — pocket rows report actual results separately from buy-ins', () => {
  const boughtIn = { ...aggressiveAgent, pocket: { ...aggressiveAgent.pocket, pnl: -2000 } };

  it.each([[0, '$0'], [450, '+$450'], [-90, '−$90']])('shows confirmed casino net %s', (net, text) => {
    render(<PocketRow agent={{ ...boughtIn, liveGame: { tableId: 'tbl-1', net } }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('−$2,000')).not.toBeInTheDocument();
  });

  it('shows an unknown result until the casino confirms it', () => {
    render(<PocketRow agent={boughtIn} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('−$2,000')).not.toBeInTheDocument();
  });

  it('keeps settled money while Home practice is live', () => {
    render(<PocketRow agent={{ ...boughtIn, liveGame: { tableId: 'home-42', net: 9999 } }} />);
    expect(screen.getByText('−$2,000')).toBeInTheDocument();
    expect(screen.queryByText('+$9,999')).not.toBeInTheDocument();
  });
});
