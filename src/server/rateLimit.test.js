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

import { rateLimiter, clientIp } from './rateLimit.js';

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

test('clientIp prefers the forwarded address over the socket', () => {
  assert.equal(clientIp(req('203.0.113.7')), '203.0.113.7');
  // A proxy chain: the client is the first entry, the rest are the hops.
  assert.equal(clientIp(req('203.0.113.7, 10.0.0.1, 10.0.0.2')), '203.0.113.7');
  assert.equal(clientIp(req(null, '198.51.100.4')), '198.51.100.4', 'and falls back to the socket');
  assert.equal(clientIp({}), null, 'with nothing to go on, nothing');
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
