import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { WatchAgentStats } from './WatchAgentStats.jsx';

it('BUG-143: owned table stats distinguish known zero, unknown and live stack', () => {
  render(<WatchAgentStats agent={{ attrs: { READS: 0, STAMINA: 72 } }} seat={{ stack: 1234 }}/>);
  expect(screen.getByText('$1,234')).toBeVisible();
  expect(screen.getByText('0/100')).toBeVisible();
  expect(screen.getAllByText('Unknown')).toHaveLength(4);
  expect(screen.getByText('Late-session sharpness')).toBeVisible();
});
