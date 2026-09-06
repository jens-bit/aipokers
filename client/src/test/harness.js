// client/src/test/harness.js — TEST-1
//
// The three things the app talks to that jsdom does not provide: Telegram's
// WebApp SDK, fetch, and WebSocket. Each is a small controllable stub rather
// than a mocking library, so a test says what the server returns and then
// asserts on what the user sees.
//
// setup.js installs these globally and resets them between tests.

// ── Telegram WebApp ─────────────────────────────────────────────────────────
// Mirrors the surface client/src/lib/telegram.js actually uses: initData,
// initDataUnsafe.user, viewportHeight + the viewportChanged event,
// ready/expand/disableVerticalSwipes.

function createTelegram() {
  const listeners = new Map(); // event -> Set<fn>

  const webApp = {
    initData: '',
    initDataUnsafe: {},
    viewportHeight: 720,
    ready: () => { webApp.readyCalls += 1; },
    expand: () => { webApp.expandCalls += 1; },
    disableVerticalSwipes: () => { webApp.disableVerticalSwipesCalls += 1; },
    onEvent: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    offEvent: (name, fn) => { listeners.get(name)?.delete(fn); },
    readyCalls: 0,
    expandCalls: 0,
    disableVerticalSwipesCalls: 0,
  };

  return {
    webApp,

    // Install (or re-install) window.Telegram.
    install() {
      window.Telegram = { WebApp: webApp };
      return webApp;
    },

    // Simulate opening the app outside Telegram — no SDK at all. This is the
    // state the LAND-2 guard reads.
    uninstall() {
      delete window.Telegram;
    },

    // A realistic initData string plus the parsed user the SDK exposes.
    signIn({ id = 4242, first_name = 'Jens', username = 'jens' } = {}) {
      webApp.initData = `user=%7B%22id%22%3A${id}%7D&auth_date=1756900000&hash=deadbeef`;
      webApp.initDataUnsafe = { user: { id, first_name, username } };
      return webApp;
    },

    signOut() {
      webApp.initData = '';
      webApp.initDataUnsafe = {};
    },

    // Telegram shrinks the viewport when the iOS keyboard opens and fires
    // viewportChanged. KEY-1 tracks this into the --tg-h custom property.
    setViewportHeight(px) {
      webApp.viewportHeight = px;
      for (const fn of listeners.get('viewportChanged') ?? []) fn({ isStateStable: true });
    },

    listenerCount(name) {
      return listeners.get(name)?.size ?? 0;
    },

    // DEEPLINK-1 — the start param a launch carries. Telegram exposes it on
    // initDataUnsafe, so that is where it goes.
    startWith(param) {
      webApp.initDataUnsafe = { ...webApp.initDataUnsafe, start_param: param };
      return webApp;
    },

    // Any SDK event, for the ones with no dedicated control above. `activated`
    // is what fires when a deep link is tapped with the app already open.
    emit(name, payload = {}) {
      for (const fn of listeners.get(name) ?? []) fn(payload);
    },

    reset() {
      listeners.clear();
      webApp.initData = '';
      webApp.initDataUnsafe = {};
      webApp.viewportHeight = 720;
      webApp.readyCalls = 0;
      webApp.expandCalls = 0;
      webApp.disableVerticalSwipesCalls = 0;
    },
  };
}

// ── fetch ───────────────────────────────────────────────────────────────────
// Routes are matched newest-first so a test can override a default. A route is
// (string | RegExp | predicate) plus a responder; the responder gets
// { url, method, body } and returns either a JSON body or { status, body }.

function createFetch() {
  let routes = [];
  const calls = [];

  function matches(matcher, url, method) {
    if (typeof matcher === 'function') return matcher({ url, method });
    if (matcher instanceof RegExp) return matcher.test(url);
    return url.startsWith(matcher) || url.includes(matcher);
  }

  const impl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    const method = (init.method ?? 'GET').toUpperCase();
    let body = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* leave raw */ } }
    const call = { url, method, body, headers: init.headers ?? {} };
    calls.push(call);

    const route = [...routes].reverse().find((r) => matches(r.matcher, url, method) && (!r.method || r.method === method));
    const raw = route ? await route.respond(call) : { status: 404, body: {} };
    const { status = 200, body: payload = raw } = (raw && typeof raw === 'object' && 'status' in raw) ? raw : {};

    // GUEST-1: `clone()` is part of the real Response and the guest claim
    // catcher uses it — it reads a refusal's body without consuming the one
    // the caller asked for. A stub without it would make that path untestable
    // and would throw inside the wrapper the moment a test returned a 403.
    const response = {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (route ? payload : {}),
      text: async () => JSON.stringify(route ? payload : {}),
    };
    response.clone = () => ({ ...response, clone: response.clone });
    return response;
  };

  return {
    impl,
    calls,

    // route('/api/agents', () => ({ agents: [] }))
    // route(/\/queue$/, () => ({ tableId: 't1' }), { method: 'POST' })
    route(matcher, respond, { method = null } = {}) {
      routes.push({ matcher, respond: typeof respond === 'function' ? respond : () => respond, method });
      return this;
    },

    // Every request this test made, in order.
    get requests() { return calls; },
    requestsMatching(matcher) {
      return calls.filter((c) => matches(matcher, c.url, c.method));
    },
    get posts() { return calls.filter((c) => c.method === 'POST'); },

    reset() {
      routes = [];
      calls.length = 0;
    },
  };
}

// ── WebSocket ───────────────────────────────────────────────────────────────
// useTable opens exactly one socket per join/watch. The stub records what the
// client sent and lets a test push server frames back.

function createSocket() {
  const instances = [];

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.CONNECTING;
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      // CLEAN-1: the real WebSocket answers to both halves of the API, and so
      // does this one — useTable listens with addEventListener while older
      // callers assign onmessage. A stub that offered only the handlers made
      // every socket-opening path throw the moment it was reached.
      this.listeners = { open: [], message: [], close: [], error: [] };
      instances.push(this);
    }

    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    }

    removeEventListener(type, fn) {
      const at = this.listeners[type]?.indexOf(fn) ?? -1;
      if (at >= 0) this.listeners[type].splice(at, 1);
    }

    dispatch(type, event) {
      this[`on${type}`]?.(event);
      for (const fn of [...(this.listeners[type] ?? [])]) fn(event);
    }

    send(data) {
      try { this.sent.push(JSON.parse(data)); }
      catch { this.sent.push(data); }
    }

    close(code = 1000, reason = '') {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatch('close', { code, reason });
    }

    // ── test controls ──
    open() {
      this.readyState = MockWebSocket.OPEN;
      this.dispatch('open', {});
    }

    emit(msg) {
      this.dispatch('message', { data: JSON.stringify(msg) });
    }
  }

  // Instance methods used above are also read as constants off the instance.
  MockWebSocket.prototype.OPEN = MockWebSocket.OPEN;
  MockWebSocket.prototype.CONNECTING = MockWebSocket.CONNECTING;
  MockWebSocket.prototype.CLOSED = MockWebSocket.CLOSED;

  return {
    MockWebSocket,
    get instances() { return instances; },
    last() { return instances[instances.length - 1] ?? null; },
    reset() { instances.length = 0; },
  };
}

export const telegram = createTelegram();
export const fetchMock = createFetch();
export const socketMock = createSocket();
