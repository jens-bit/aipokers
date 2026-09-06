// client/src/hooks/useDeepLink.js — DEEPLINK-1
//
// One effect, mounted once. It answers the cold start — the app opened BY the
// link — and then keeps listening, because a second tap on a notification does
// not restart a Mini App that is already in front; Telegram just brings it
// forward and hands over a new param.
//
// The callback is held in a ref rather than in the dependency array. Routing a
// deep link touches half the shell's state, so a handler written against that
// state is a new function on every render — and a subscription that tore
// itself down on every render would drop the very event it is here to catch.

import { useEffect, useRef } from 'react';

import { parseStartParam, readStartParam, subscribeStartParam } from '../lib/deeplink.js';

export function useDeepLink(onRoute) {
  const handler = useRef(onRoute);
  handler.current = onRoute;

  useEffect(() => {
    const cold = parseStartParam(readStartParam());
    if (cold) handler.current?.(cold);
    return subscribeStartParam((raw) => {
      const route = parseStartParam(raw);
      if (route) handler.current?.(route);
    });
  }, []);
}
