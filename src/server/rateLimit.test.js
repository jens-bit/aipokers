// src/server/rateLimit.test.js — MONEY-1 job 4
//
// The limiter never had a test of its own, which is how it spent months
// counting the wrong thing. `trust proxy` is deliberately not set on this app
// (see guest.js), so `req.ip` behind nginx is the PROXY's address for every
// user — and a per-IP limiter keyed on that is a per-SITE limiter wearing a
// per-IP name. src/index.js's 60-a-minute `/api` cap was therefore 60 a minute
// for everybody at once, which is the measured cause of "Could not read your
// safe" (probe: 26 of 90 wallet reads came back 429, the route never threw).

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { rateLimiter, clientIp, createClientIp } from './rateLimit.js';

const req = (forwarded, socketIp = '127.0.0.1') => ({
  headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
  socket: { remoteAddress: socketIp },
  ip: socketIp,
});

function res() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

/** Run one request through the middleware. Returns true when it passed. */
function hit(limiter, request) {
  const r = res();
  let passed = false;
  limiter(request, r, () => { passed = true; });
  return { passed, status: r.statusCode, body: r.body };
}

test('clientIp accepts forwarding from the local reverse proxy', () => {
  assert.equal(clientIp(req('203.0.113.7')), '203.0.113.7');
  assert.equal(clientIp(req('203.0.113.7', '::ffff:127.0.0.1')), '203.0.113.7');
  assert.equal(clientIp(req(null, '198.51.100.4')), '198.51.100.4', 'and falls back to the socket');
  assert.equal(clientIp({}), null, 'with nothing to go on, nothing');
});

test('BUG-250: an untrusted socket cannot rotate its budget with a forged forwarded header', () => {
  const limiter = rateLimiter({ max: 1 });
  assert.equal(clientIp(req('203.0.113.7', '198.51.100.4')), '198.51.100.4');
  assert.equal(hit(limiter, req('203.0.113.7', '198.51.100.4')).passed, true);
  assert.equal(hit(limiter, req('203.0.113.8', '198.51.100.4')).status, 429);
});

test('BUG-250: forwarding stops at the nearest untrusted hop, not a supplied leftmost identity', () => {
  assert.equal(clientIp(req('203.0.113.7, 198.51.100.4')), '198.51.100.4');
  assert.equal(clientIp(req('203.0.113.7, 10.0.0.2')), '10.0.0.2');
  assert.equal(clientIp(req('203.0.113.7, invalid')), '127.0.0.1');
  assert.equal(clientIp(req('unknown')), '127.0.0.1');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.7' } }), null);
});

test('BUG-250: equivalent IPv6 spellings share a budget', () => {
  const limiter = rateLimiter({ max: 1 });
  assert.equal(hit(limiter, req('2001:db8::1')).passed, true);
  assert.equal(hit(limiter, req('2001:0db8:0:0:0:0:0:1')).status, 429);
});

test('BUG-250: remote proxy trust is explicit and can be disabled', () => {
  const remote = createClientIp({ trustedProxies: '127.0.0.0/8,10.2.3.0/24,2001:db8:1::/64' });
  assert.equal(remote(req('203.0.113.7, 10.2.3.4')), '203.0.113.7');
  assert.equal(remote(req('203.0.113.7', '2001:db8:1::5')), '203.0.113.7');
  assert.equal(remote(req('203.0.113.7', '10.2.4.4')), '10.2.4.4');
  assert.equal(createClientIp({ trustedProxies: '' })(req('203.0.113.7')), '127.0.0.1');
  for (const bad of ['true', '*', '10.0.0.1/no', '10.0.0.1/99', '10.0.0.1/8/1']) {
    assert.throws(() => createClientIp({ trustedProxies: bad }));
  }
});

test('BUG-250: the HTTP limiter separates real proxy clients but ignores a forged prefix', async () => {
  const app = express();
  app.use(rateLimiter({ max: 2 }));
  app.get('/', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const request = async forwarded => {
    const response = await fetch(url, { headers: { 'x-forwarded-for': forwarded } });
    await response.text();
    return response.status;
  };
  try {
    assert.equal(await request('203.0.113.1, 198.51.100.4'), 200);
    assert.equal(await request('203.0.113.2, 198.51.100.4'), 200);
    assert.equal(await request('203.0.113.3, 198.51.100.4'), 429);
    assert.equal(await request('198.51.100.5'), 200);
    assert.equal(await request('fe80::1%zone'), 200, 'invalid forwarding falls back without throwing');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('MONEY-1: two people behind one proxy do not share a budget', () => {
  // Every request arrives on the same socket, as it does behind a TLS
  // terminator. Only the forwarded header tells them apart.
  const limiter = rateLimiter({ windowMs: 60_000, max: 3 });
  const alice = req('203.0.113.7');
  const bob = req('203.0.113.8');

  for (let i = 0; i < 3; i++) assert.equal(hit(limiter, alice).passed, true, `alice's request ${i + 1}`);
  const alice4 = hit(limiter, alice);
  assert.equal(alice4.passed, false, 'alice is over her own limit');
  assert.equal(alice4.status, 429);
  assert.deepEqual(alice4.body, { error: 'Too many requests' });

  // Before MONEY-1 this was a 429 too, and the safe told Bob it could not be
  // read because somebody else had been using the app.
  assert.equal(hit(limiter, bob).passed, true, "bob's budget is his own");
});

test('MONEY-1: the window slides, so a quiet minute restores the budget', () => {
  const limiter = rateLimiter({ windowMs: 50, max: 2 });
  const who = req('203.0.113.9');
  assert.equal(hit(limiter, who).passed, true);
  assert.equal(hit(limiter, who).passed, true);
  assert.equal(hit(limiter, who).passed, false);
  const until = Date.now() + 80;
  while (Date.now() < until) { /* the window is 50ms; spin rather than await */ }
  assert.equal(hit(limiter, who).passed, true, 'the old hits fell out of the window');
});

test('an explicit key still wins — the guest routes pass their own', () => {
  const limiter = rateLimiter({ windowMs: 60_000, max: 1, key: () => 'everybody' });
  assert.equal(hit(limiter, req('203.0.113.7')).passed, true);
  assert.equal(hit(limiter, req('203.0.113.8')).passed, false, 'one budget, on purpose');
});

test('a custom message is what the caller gets back', () => {
  const limiter = rateLimiter({ windowMs: 60_000, max: 0, message: 'Too many admin requests' });
  assert.deepEqual(hit(limiter, req('203.0.113.7')).body, { error: 'Too many admin requests' });
});
