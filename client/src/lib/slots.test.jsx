// client/src/lib/slots.test.jsx — YOU-2, extended in BIRTH-5
//
// The reader has to be the wallet's kind of reader, where absence is a
// first-class answer and the row it feeds is simply not drawn — never a "0 of
// 0 seats" invented out of a 404.
//
// The guessed shape below (`{ used, total, nextAt }`) is kept exactly as YOU-2
// wrote it. It is no longer the only shape: SLOTS-1 built the endpoint as
// `{ used, cap, next: {...} }` and this reader did not recognise it, so it
// answered null against every live server and the seat row it feeds has never
// been drawn. Both are asserted here now.

import { beforeEach, describe, expect, it } from 'vitest';

import { fetchSlots, lockedSeatLine, readSlots, slotsLine } from './slots.js';
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

// ── BIRTH-5 · the shape the server actually sends ───────────────────────────

describe('readSlots — SLOTS-1\'s projection', () => {
  const SERVER = { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 4_200, unlocked: false } };

  it('reads `cap` as the ceiling and `next.price` as the threshold', () => {
    const slots = readSlots(SERVER);
    expect(slots.used).toBe(1);
    expect(slots.total).toBe(4);
    expect(slots.nextAt).toBe(10_000);
  });

  it('keeps the whole next-seat record, because EARNED is the half the row cannot say', () => {
    expect(readSlots(SERVER).next).toEqual({ index: 2, price: 10_000, earned: 4_200, unlocked: false });
  });

  it('still speaks YOU-2\'s guessed shape, and adds nothing to it', () => {
    expect(readSlots({ used: 2, total: 4, nextAt: 10_000 }))
      .toEqual({ used: 2, total: 4, nextAt: 10_000 });
  });

  it('is a full row at the cap, where there is no next seat to price', () => {
    expect(readSlots({ used: 4, cap: 4, next: null }))
      .toEqual({ used: 4, total: 4, nextAt: null });
  });

  it('feeds the line YOU-2 already writes', () => {
    expect(slotsLine(readSlots(SERVER))).toBe('1 of 4 seats · next 10,000 won');
  });

  it('is what fetchSlots answers with', async () => {
    telegram.signIn();
    fetchMock.route('/api/slots', SERVER);
    expect((await fetchSlots()).next.earned).toBe(4_200);
  });
});

describe('lockedSeatLine — the 409 in words', () => {
  it('says the price and what he has, from the refusal body verbatim', () => {
    expect(lockedSeatLine({ price: 10_000, earned: 4_200, index: 2 }))
      .toBe('2nd seat costs 10,000 won · you have 4,200');
  });

  it('says "next" when nothing told it which seat this is', () => {
    expect(lockedSeatLine({ price: 50_000, earned: 12_000 }))
      .toBe('next seat costs 50,000 won · you have 12,000');
  });

  it('reads a missing earned as nothing earned, never as "you have undefined"', () => {
    expect(lockedSeatLine({ price: 10_000, index: 2 }))
      .toBe('2nd seat costs 10,000 won · you have 0');
  });

  it('has nothing to say about a body that is not a priced refusal', () => {
    expect(lockedSeatLine({ error: 'agentCap', cap: 4 })).toBeNull();
    expect(lockedSeatLine()).toBeNull();
  });
});
