import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_APPEARANCE_KEY, HomeAppearanceControl, HomeAppearanceProvider, homePeriod, useHomeAppearance } from './HomeAppearance.jsx';

function Room() {
  const { theme } = useHomeAppearance();
  return <div data-testid="room" data-theme={theme}><HomeAppearanceControl /><input aria-label="Unsent message" /></div>;
}
function show() { return render(<HomeAppearanceProvider><Room /></HomeAppearanceProvider>); }
const at = (hour, minute = 0) => new Date(2026, 8, 12, hour, minute);

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(at(12)); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Home appearance', () => {
  it.each([[5, 59, 'night'], [6, 0, 'day'], [16, 59, 'day'], [17, 0, 'dusk'], [19, 59, 'dusk'], [20, 0, 'night']])(
    'uses local clock at %i:%i', (hour, minute, expected) => expect(homePeriod(at(hour, minute))).toBe(expected),
  );
  it('follows a boundary while open without replacing the room or its unsent words', () => {
    vi.setSystemTime(at(16, 59));
    show();
    const room = screen.getByTestId('room');
    fireEvent.change(screen.getByLabelText('Unsent message'), { target: { value: 'How are you?' } });
    act(() => vi.advanceTimersByTime(60_000));
    expect(room).toHaveAttribute('data-theme', 'dusk');
    expect(screen.getByTestId('room')).toBe(room);
    expect(screen.getByLabelText('Unsent message')).toHaveValue('How are you?');
  });
  it('persists a manual choice and holds it through clock boundaries', () => {
    vi.setSystemTime(at(16, 59));
    const view = show();
    fireEvent.change(screen.getByLabelText('Home appearance'), { target: { value: 'night' } });
    expect(localStorage.getItem(HOME_APPEARANCE_KEY)).toBe('night');
    expect(screen.getByRole('option', { name: 'Auto · Day' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('option', { name: 'Auto · Dusk' })).toBeInTheDocument();
    expect(screen.getByTestId('room')).toHaveAttribute('data-theme', 'night');
    view.unmount(); show();
    expect(screen.getByLabelText('Home appearance')).toHaveValue('night');
  });
  it('refreshes after device sleep and immediately when returning to Auto', () => {
    show();
    vi.setSystemTime(at(21));
    fireEvent(window, new Event('focus'));
    expect(screen.getByTestId('room')).toHaveAttribute('data-theme', 'night');
    fireEvent.change(screen.getByLabelText('Home appearance'), { target: { value: 'day' } });
    vi.setSystemTime(at(18));
    fireEvent.change(screen.getByLabelText('Home appearance'), { target: { value: 'auto' } });
    expect(screen.getByTestId('room')).toHaveAttribute('data-theme', 'dusk');
  });
  it('syncs choices and cleared storage from another tab', () => {
    show();
    localStorage.setItem(HOME_APPEARANCE_KEY, 'dusk');
    fireEvent(window, new StorageEvent('storage', { key: HOME_APPEARANCE_KEY }));
    expect(screen.getByTestId('room')).toHaveAttribute('data-theme', 'dusk');
    localStorage.clear();
    fireEvent(window, new StorageEvent('storage', { key: null }));
    expect(screen.getByLabelText('Home appearance')).toHaveValue('auto');
  });
  it('ignores unknown saved modes and still allows a choice with storage blocked', () => {
    localStorage.setItem(HOME_APPEARANCE_KEY, 'old-theme');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    show();
    expect(screen.getByLabelText('Home appearance')).toHaveValue('auto');
    fireEvent.change(screen.getByLabelText('Home appearance'), { target: { value: 'dusk' } });
    expect(screen.getByTestId('room')).toHaveAttribute('data-theme', 'dusk');
  });
  it('cleans up its clock when the app closes', () => {
    const view = show();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
