import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { fetchMock, telegram } from './test/harness.js';

const guestState = vi.hoisted(() => ({ wall: null }));
vi.mock('./hooks/useIsDesktop.js', () => ({ useIsDesktop: () => true }));
vi.mock('./hooks/useGuestSession.js', () => ({ useGuestSession: () => ({
  isGuest: true, draftOnBoot: false, wall: guestState.wall,
  wallAgent: null, wallArrival: null, closeWall() {}, onClaimed() {}, noteSessionEnd() {},
}) }));
// Test the outer modal-to-shell boundary here. DesktopHome's own tests cover
// actual HOME_OBSERVE frames through DeskHome and the real room hook.
vi.mock('./components/desktop/DesktopHome.jsx', () => ({ DesktopHome: ({ observing = true }) => (
  <div data-testid="desktop-observation" data-observing={String(observing)} />
) }));
import App from './App.jsx';

it('BUG-279: the guest claim wall suspends desktop Home observation until dismissed', async () => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [] });
  fetchMock.route('/api/auth/config', { botUsername: '' });
  guestState.wall = null;
  const view = render(<App />);
  expect(await screen.findByTestId('desktop-observation')).toHaveAttribute('data-observing', 'true');
  guestState.wall = 'guestSessionCap';
  view.rerender(<App />);
  expect(screen.getByRole('dialog', { name: 'Keep him' })).toBeVisible();
  expect(screen.getByTestId('desktop-observation')).toHaveAttribute('data-observing', 'false');
  guestState.wall = null;
  view.rerender(<App />);
  expect(screen.queryByRole('dialog', { name: 'Keep him' })).not.toBeInTheDocument();
  expect(screen.getByTestId('desktop-observation')).toHaveAttribute('data-observing', 'true');
});
