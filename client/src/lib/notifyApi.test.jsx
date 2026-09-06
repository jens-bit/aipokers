// client/src/lib/notifyApi.test.jsx — DEEPLINK-1

import { beforeEach, describe, expect, it } from 'vitest';

import { fetchNotifyBudget, setAgentMuted } from './notifyApi.js';
import { fetchMock, telegram } from '../test/harness.js';

describe('setAgentMuted', () => {
  beforeEach(() => telegram.signIn());

  it('POSTs the flag and answers with what the SERVER now holds', async () => {
    fetchMock.route('/notify', { agentId: 'agent_grinder', muted: true }, { method: 'POST' });

    expect(await setAgentMuted('agent_grinder', true)).toBe(true);

    const [post] = fetchMock.requestsMatching('/notify');
    expect(post.url).toContain('/api/agents/agent_grinder/notify');
    expect(post.body.muted).toBe(true);
    expect(post.headers['x-telegram-init-data']).toBeTruthy();
  });

  it('throws when the server refuses, so the caller can put the menu back', async () => {
    fetchMock.route('/notify', () => ({ status: 403, body: {} }), { method: 'POST' });
    await expect(setAgentMuted('agent_grinder', true)).rejects.toThrow();
  });
});

describe('fetchNotifyBudget', () => {
  beforeEach(() => telegram.signIn());

  it('reads today against the cap', async () => {
    fetchMock.route('/api/notifications/budget', { used: 2, max: 3, held: 1, enabled: true });
    expect(await fetchNotifyBudget()).toEqual({ used: 2, max: 3, held: 1, enabled: true });
  });

  it('is null on a deployment with no notifier, rather than a zero it made up', async () => {
    fetchMock.route('/api/notifications/budget', () => ({ status: 404, body: {} }));
    expect(await fetchNotifyBudget()).toBeNull();
  });

  it('is null when the answer is not a budget', async () => {
    fetchMock.route('/api/notifications/budget', { error: 'Not your budget' });
    expect(await fetchNotifyBudget()).toBeNull();
  });
});
