// client/src/lib/slots.test.jsx — YOU-2
//
// /api/slots does not exist on any deployment yet. That is the point of this
// file: the reader has to be the wallet's kind of reader, where absence is a
// first-class answer and the row it feeds is simply not drawn — never a "0 of
// 0 seats" invented out of a 404.

import { beforeEach, describe, expect, it } from 'vitest';

import { fetchSlots, slotsLine } from './slots.js';
import { fetchMock, telegram } from '../test/harness.js';

describe('fetchSlots', () => {
  beforeEach(() => telegram.signIn());

  it('reads the seats and the next threshold', async () => {
    fetchMock.route('/api/slots', { used: 2, total: 4, nextAt: 10000 });
    expect(await fetchSlots()).toEqual({ used: 2, total: 4, nextAt: 10000 });
  });

  it('asks as this owner', async () => {
    fetchMock.route('/api/slots', { used: 2, total: 4 });
    await fetchSlots();
    const [ask] = fetchMock.requestsMatching('/api/slots');
    expect(ask.url).toContain('userId=4242');
    expect(ask.headers['x-telegram-init-data']).toBeTruthy();
  });

  // The whole reason the row can ship before the server does.
  it('is null on a deployment whose server has no such route', async () => {
    fetchMock.route('/api/slots', () => ({ status: 404, body: {} }));
    expect(await fetchSlots()).toBeNull();
  });

  it('is null when the answer is not a seat count', async () => {
    fetchMock.route('/api/slots', { error: 'nope' });
    expect(await fetchSlots()).toBeNull();
  });

  it('is null rather than half a row when only one number came back', async () => {
    fetchMock.route('/api/slots', { used: 2 });
    expect(await fetchSlots()).toBeNull();
  });

  it('treats a missing or useless threshold as no threshold', async () => {
    fetchMock.route('/api/slots', { used: 4, total: 4, nextAt: 0 });
    expect((await fetchSlots()).nextAt).toBeNull();
  });
});

describe('slotsLine', () => {
  it('is the row\'s own words', () => {
    expect(slotsLine({ used: 2, total: 4, nextAt: 10000 })).toBe('2 of 4 seats · next 10,000 won');
  });

  it('drops the tail once every seat is taken — there is nothing left to earn', () => {
    expect(slotsLine({ used: 4, total: 4, nextAt: 10000 })).toBe('4 of 4 seats');
  });

  it('drops the tail when the server named no threshold', () => {
    expect(slotsLine({ used: 1, total: 4, nextAt: null })).toBe('1 of 4 seats');
  });

  it('has nothing to say about a deployment with no seats', () => {
    expect(slotsLine(null)).toBeNull();
  });
});
