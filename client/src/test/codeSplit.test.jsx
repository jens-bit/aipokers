// client/src/test/codeSplit.test.jsx — BUGS-C job 1
//
// Phone playtest, 7 Sep: the Mini App opened slowly. `npm run build` showed
// why — one 635 KB entry chunk holding the landing page, the login widget,
// the desktop rail, the casino building, a profile overlay and hand replay,
// none of which a Telegram session needs to paint the home shell. This reads
// the source rather than the build output, so it runs at vitest speed and
// fails the moment someone turns a `lazy()` back into a static import.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(here, '..', rel), 'utf8');

describe('BUGS-C job 1: the Telegram entry loads only the home shell', () => {
  it('main.jsx never statically imports the landing or the login widget', () => {
    const src = read('main.jsx');
    expect(src).not.toMatch(/^import .*GuestLanding.*from/m);
    expect(src).not.toMatch(/^import .*LoginGate.*from/m);
    expect(src).toMatch(/lazy\(\(\) => import\(.*GuestLanding/);
    expect(src).toMatch(/lazy\(\(\) => import\(.*LoginGate/);
  });

  it('BUG-52: the landing reuses the already-loaded game without a blank Suspense gate', () => {
    const src = read('components/guest/GuestLanding.jsx');
    // main already loads App: the old lazy assertion required a redundant
    // loading state and did not actually prove a smaller production chunk.
    expect(read('main.jsx')).toMatch(/^import App from/m);
    expect(src).toMatch(/^import App from/m);
    expect(src).not.toMatch(/<Suspense/);
  });

  it('App.jsx defers the desktop rail, the casino, a profile overlay and hand replay to their own chunks', () => {
    const src = read('App.jsx');
    for (const name of ['DesktopHome', 'AgentProfileScreen', 'CasinoScreen', 'ReplayTheatre']) {
      expect(src).not.toMatch(new RegExp(`^import \\{ ${name} \\} from`, 'm'));
      expect(src).toMatch(new RegExp(`const ${name} = lazy\\(`));
    }
  });
});
