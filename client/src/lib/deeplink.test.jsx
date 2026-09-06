// client/src/lib/deeplink.test.jsx — DEEPLINK-1
//
// The parser is the part that has to be right without a network, because the
// one thing that can silently break it is an id shape: an agent id is itself
// `agent_<base36>`, so `hand_agent_m3x9q1_37` is the ORDINARY case and a split
// on '_' is the bug this file exists to prevent.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseStartParam, readStartParam, resolveDeepLink, subscribeStartParam } from './deeplink.js';
import { agentsResponse, playingAgent, restingAgent } from '../test/fixtures/agents.js';
import { badBeatHand, flaggedResponse } from '../test/fixtures/flagged.js';
import { fetchMock, telegram } from '../test/harness.js';

describe('parseStartParam', () => {
  it('reads an agent link whose id has an underscore of its own', () => {
    expect(parseStartParam('agent_agent_m3x9q1')).toEqual({ kind: 'agent', agentId: 'agent_m3x9q1' });
  });

  it('takes the hand id off the END, so the agent id keeps its underscore', () => {
    expect(parseStartParam('hand_agent_m3x9q1_37')).toEqual({
      kind: 'hand', agentId: 'agent_m3x9q1', handId: '37',
    });
  });

  it('reads a table link', () => {
    expect(parseStartParam('table_table-9f2c1a44')).toEqual({ kind: 'table', tableId: 'table-9f2c1a44' });
  });

  it('is null for nothing, for junk, and for a param from a bot we do not know', () => {
    expect(parseStartParam('')).toBeNull();
    expect(parseStartParam(null)).toBeNull();
    expect(parseStartParam('promo_summer')).toBeNull();
    expect(parseStartParam('agent_')).toBeNull();
    expect(parseStartParam('hand_37')).toBeNull();      // no agent half
    expect(parseStartParam('table_')).toBeNull();
  });
});

describe('readStartParam', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('prefers what the SDK was launched with', () => {
    telegram.signIn();
    telegram.startWith('agent_agent_grinder');
    expect(readStartParam()).toBe('agent_agent_grinder');
  });

  it('falls back to the launch hash Telegram rewrites', () => {
    window.location.hash = '#tgWebAppData=x&tgWebAppStartParam=hand_agent_grinder_37';
    expect(readStartParam()).toBe('hand_agent_grinder_37');
  });

  it('is empty when the app was opened with no link at all', () => {
    expect(readStartParam()).toBe('');
  });
});

describe('subscribeStartParam', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('does not replay the param the app was launched with', () => {
    telegram.startWith('agent_agent_grinder');
    const seen = vi.fn();
    const stop = subscribeStartParam(seen);
    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('fires when Telegram hands over a new param with the app already open', () => {
    telegram.startWith('agent_agent_grinder');
    const seen = vi.fn();
    const stop = subscribeStartParam(seen);

    telegram.startWith('hand_agent_grinder_37');
    telegram.emit('activated');

    expect(seen).toHaveBeenCalledWith('hand_agent_grinder_37');
    stop();
  });

  it('fires once for one change, however many events announce it', () => {
    const seen = vi.fn();
    const stop = subscribeStartParam(seen);

    telegram.startWith('table_tbl-fixture');
    telegram.emit('activated');
    window.dispatchEvent(new Event('hashchange'));

    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops listening when it is torn down', () => {
    const seen = vi.fn();
    subscribeStartParam(seen)();

    telegram.startWith('agent_agent_grinder');
    telegram.emit('activated');

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('resolveDeepLink', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents?', agentsResponse);
    fetchMock.route('/flagged', flaggedResponse);
  });

  it('resolves an agent link to the agent record', async () => {
    const opened = await resolveDeepLink({ kind: 'agent', agentId: restingAgent.id });
    expect(opened).toEqual({ kind: 'agent', agent: restingAgent });
  });

  it('resolves a hand link to the flagged entry, named after him', async () => {
    const opened = await resolveDeepLink({ kind: 'hand', agentId: playingAgent.id, handId: '37' });
    expect(opened.kind).toBe('hand');
    expect(opened.hand.handNumber).toBe(badBeatHand.handNumber);
    expect(opened.hand.agentName).toBe(playingAgent.name);
  });

  it('falls back to his thread when the hand has aged out of the flagged list', async () => {
    fetchMock.route('/flagged', { flaggedHands: [] });
    const opened = await resolveDeepLink({ kind: 'hand', agentId: playingAgent.id, handId: '37' });
    expect(opened).toEqual({ kind: 'agent', agent: playingAgent });
  });

  it('resolves a table link, and names the agent of ours who is sitting at it', async () => {
    const opened = await resolveDeepLink({ kind: 'table', tableId: playingAgent.activeTableId });
    expect(opened).toEqual({ kind: 'table', tableId: playingAgent.activeTableId, agent: playingAgent });
  });

  it('still resolves a table nobody of ours is at — it is watchable either way', async () => {
    const opened = await resolveDeepLink({ kind: 'table', tableId: 'tbl-stranger' });
    expect(opened).toEqual({ kind: 'table', tableId: 'tbl-stranger', agent: null });
  });

  it('is null for an agent this owner does not have', async () => {
    expect(await resolveDeepLink({ kind: 'agent', agentId: 'agent_someone_else' })).toBeNull();
  });

  it('is null when the roster cannot be read at all', async () => {
    fetchMock.route('/api/agents?', () => ({ status: 500, body: {} }));
    expect(await resolveDeepLink({ kind: 'agent', agentId: playingAgent.id })).toBeNull();
  });
});
