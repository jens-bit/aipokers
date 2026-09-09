import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LandingDetails } from './LandingDetails.jsx';

describe('L2 explanatory sections after the actual room', () => {
  it('preserves the eight subjects, closing action and honest example labels', () => {
    const { container } = render(<LandingDetails />);
    expect(container.querySelectorAll('.landing-section')).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Take a chair at your own kitchen table.' })).toBeInTheDocument();
    expect(screen.getByText(/Chips hold no cash value/)).toBeInTheDocument();
    expect(screen.getByText('Illustrative agent dialogue.')).toBeInTheDocument();
    expect(screen.getByText(/an illustrative agent, not a customer/)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByText('250,000')).toBeInTheDocument();
  });
  it('the last action returns to the same room', async () => {
    const onDraft = vi.fn();
    render(<LandingDetails onDraft={onDraft}/>);
    await userEvent.click(screen.getByRole('button', { name: 'DRAFT HIM' }));
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('does not promise an account-free draft when that door is disabled', () => {
    render(<LandingDetails guestAvailable={false} ctaLabel="MEET HIM" ctaNote="Free · sign in with Telegram"/>);
    expect(screen.queryByText(/no account/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'MEET HIM' })).toBeInTheDocument();
    expect(screen.getByText('Free · sign in with Telegram')).toBeInTheDocument();
  });
});