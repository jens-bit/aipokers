// client/src/test/setup.js — TEST-1
//
// Runs before every test file. Installs the jest-dom matchers, the Telegram /
// fetch / WebSocket stubs from harness.js, and the two browser APIs jsdom does
// not implement but the app calls at mount time (matchMedia via useIsDesktop,
// ResizeObserver via CasinoFloor).

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { fetchMock, socketMock, telegram } from './harness.js';

// ── jsdom gaps ──────────────────────────────────────────────────────────────

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, // phone-width by default; useIsDesktop asks for >= 1100px
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// ── stubs ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  telegram.reset();
  telegram.install();
  fetchMock.reset();
  socketMock.reset();
  vi.stubGlobal('fetch', vi.fn(fetchMock.impl));
  vi.stubGlobal('WebSocket', socketMock.MockWebSocket);
  document.documentElement.style.removeProperty('--tg-h');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
