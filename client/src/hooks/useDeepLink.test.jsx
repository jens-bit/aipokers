// client/src/hooks/useDeepLink.test.jsx — DEEPLINK-1
//
// Two moments, and they are not the same one: the app opened BY the link, and
// the link tapped while the app is already in front. The second is the one
// that gets forgotten, because Telegram does not restart a Mini App that is
// already running — it brings it forward and hands over a new param.

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeepLink } from './useDeepLink.js';
import { telegram } from '../test/harness.js';

function Probe({ onRoute }) {
  useDeepLink(onRoute);
  return <div>probe</div>;
}

describe('useDeepLink', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('routes the param the app was launched with, once', () => {
    telegram.startWith('agent_agent_grinder');
    const onRoute = vi.fn();
    render(<Probe onRoute={onRoute} />);

    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(onRoute).toHaveBeenCalledWith({ kind: 'agent', agentId: 'agent_grinder' });
  });

  it('routes a param that arrives while the app is already open', () => {
    const onRoute = vi.fn();
    render(<Probe onRoute={onRoute} />);
    expect(onRoute).not.toHaveBeenCalled();

    telegram.startWith('hand_agent_grinder_37');
    telegram.emit('activated');

    expect(onRoute).toHaveBeenCalledWith({ kind: 'hand', agentId: 'agent_grinder', handId: '37' });
  });

  it('routes with the CURRENT handler, not the one it mounted with', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe onRoute={first} />);
    rerender(<Probe onRoute={second} />);

    telegram.startWith('table_tbl-fixture');
    telegram.emit('activated');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ kind: 'table', tableId: 'tbl-fixture' });
  });

  it('does not resubscribe when the handler changes — one listener, always', () => {
    const { rerender } = render(<Probe onRoute={() => {}} />);
    rerender(<Probe onRoute={() => {}} />);
    rerender(<Probe onRoute={() => {}} />);
    expect(telegram.listenerCount('activated')).toBe(1);
  });

  it('ignores a param that is not one of ours', () => {
    telegram.startWith('promo_summer');
    const onRoute = vi.fn();
    render(<Probe onRoute={onRoute} />);
    expect(onRoute).not.toHaveBeenCalled();
  });
});
