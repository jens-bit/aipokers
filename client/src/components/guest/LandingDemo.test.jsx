import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingDemo } from './LandingDemo.jsx';

afterEach(() => vi.useRealTimers());
describe('SHOW-1 landing demonstration', () => {
  it('SHOW-1: opens mid-hand, moves money, reveals only at showdown and deals again without a request', () => {
    vi.useFakeTimers();
    const request = vi.spyOn(window, 'fetch');
    const { container, unmount } = render(<LandingDemo />);
    const demo = screen.getByRole('region', { name: 'Demonstration poker table' });
    expect(demo).toHaveAttribute('data-street', 'flop');
    expect(container.querySelectorAll('[data-board-card]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-opponent-card="back"]')).toHaveLength(2);
    const opening = demo.textContent;
    act(() => vi.advanceTimersByTime(1400));
    expect(demo.textContent).not.toBe(opening);
    expect(screen.getByText('Big Slick bets $80.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(8 * 1400));
    expect(demo).toHaveAttribute('data-street', 'showdown');
    expect(container.querySelectorAll('[data-opponent-card="face"]')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(2 * 1400));
    expect(demo).toHaveAttribute('data-street', 'preflop');
    expect(container.querySelectorAll('[data-opponent-card="back"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(2);
    expect(request).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SHOW-1: can pause the moving illustration without affecting the doors below it', () => {
    vi.useFakeTimers();
    render(<LandingDemo />);
    act(() => screen.getByRole('button', { name: 'Pause demo' }).click());
    const before = screen.getByRole('region').textContent;
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole('region')).toHaveTextContent(before);
    act(() => screen.getByRole('button', { name: 'Play demo' }).click());
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.getByText('Big Slick bets $80.')).toBeInTheDocument();
  });
});
