// client/src/screens/YouScreen.notify.test.jsx — DEEPLINK-1
//
// "The cap is part of the design, not a setting" (src/server/notify.js). So
// the Notifications row reports the budget rather than offering a dial: how
// many of today's three the bot has already spent. The per-agent mute is not
// here — it is on his profile, with the rest of what an owner does TO an agent.

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { YouScreen } from './YouScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const budgetRow = () => screen.getByText('Notifications').closest('div');

describe('DEEPLINK-1 the Notifications row on YOU', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/wallet', () => ({ status: 404, body: {} }));
  });

  it('shows what the bot has spent of today\'s budget', async () => {
    fetchMock.route('/api/notifications/budget', { used: 2, max: 3, held: 0, enabled: true });
    render(<YouScreen onOpenProfile={() => {}} />);

    expect(await screen.findByText('2/3 today')).toBeInTheDocument();
  });

  it('reads 0/3 on a quiet day rather than going blank', async () => {
    fetchMock.route('/api/notifications/budget', { used: 0, max: 3, held: 0, enabled: true });
    render(<YouScreen onOpenProfile={() => {}} />);

    expect(await screen.findByText('0/3 today')).toBeInTheDocument();
  });

  it('quotes the cap the server holds, not a 3 of its own', async () => {
    fetchMock.route('/api/notifications/budget', { used: 1, max: 5, held: 0, enabled: true });
    render(<YouScreen onOpenProfile={() => {}} />);

    expect(await screen.findByText('1/5 today')).toBeInTheDocument();
  });

  it('asks for it as this owner', async () => {
    fetchMock.route('/api/notifications/budget', { used: 1, max: 3, held: 0, enabled: true });
    render(<YouScreen onOpenProfile={() => {}} />);
    await screen.findByText('1/3 today');

    const [ask] = fetchMock.requestsMatching('/api/notifications/budget');
    expect(ask.url).toContain('userId=4242');
    expect(ask.headers['x-telegram-init-data']).toBeTruthy();
  });

  // A deployment with no notifier has no budget to report, and a row that
  // said "0/3 today" there would be quoting a cap nobody is enforcing.
  it('says nothing about a budget on a deployment that has no notifier', async () => {
    fetchMock.route('/api/notifications/budget', () => ({ status: 404, body: {} }));
    render(<YouScreen onOpenProfile={() => {}} />);

    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.requestsMatching('/api/notifications/budget').length).toBe(1));
    expect(screen.queryByText(/\d+\/\d+ today/)).not.toBeInTheDocument();
    expect(budgetRow()).toHaveTextContent('All agents');
  });
});
