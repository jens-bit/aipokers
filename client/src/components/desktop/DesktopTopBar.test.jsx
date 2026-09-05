// client/src/components/desktop/DesktopTopBar.test.jsx — DSK2-5
//
// The desktop top bar's logout is web-only. Inside the Mini App Telegram owns
// the session and there is nothing to log out of, so the affordance must not
// appear there — showing it would offer to clear a credential the app does not
// hold, and reload into the same session.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DesktopTopBar } from './DesktopTopBar.jsx';
import { setWebLogin, clearWebLogin, getWebLogin } from '../../lib/telegram.js';
import { telegram } from '../../test/harness.js';

const WEB_USER = { id: 4242, first_name: 'Jens', username: 'jens', hash: 'deadbeef' };

describe('DesktopTopBar logout (AUTH-1)', () => {
  beforeEach(() => { clearWebLogin(); });

  it('offers Log out when the session is a stored web login', () => {
    telegram.uninstall();
    setWebLogin(WEB_USER);

    render(<DesktopTopBar liveCount={0} />);

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('never offers Log out inside the Mini App', () => {
    telegram.install();
    telegram.signIn({ id: 4242 });

    render(<DesktopTopBar liveCount={0} />);

    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('clears the stored login and reloads, the same as the mobile row', async () => {
    telegram.uninstall();
    setWebLogin(WEB_USER);
    const reload = vi.fn();
    // jsdom's location.reload is not writable; replace the whole accessor.
    const original = window.location;
    delete window.location;
    window.location = { ...original, reload };

    try {
      render(<DesktopTopBar liveCount={0} />);
      await userEvent.click(screen.getByRole('button', { name: /log out/i }));

      expect(getWebLogin()).toBeNull();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      window.location = original;
    }
  });
});
