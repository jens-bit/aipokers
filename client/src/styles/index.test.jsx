// client/src/styles/index.test.jsx — BUG-156
//
// index.css is the one file every entry pays for, and its cost is invisible:
// adding an @import here is one line, and nothing goes red when a phone starts
// downloading the desktop shell before it can paint a room. This is the thing
// that goes red.
//
// The rule it holds is the one the split established: a sheet belongs in
// index.css only if a module in the ENTRY graph names its classes. Everything
// else is imported by the module that owns it, so Vite puts it in that
// module's chunk. The budget below is the list, spelled out, so adding to it
// is a decision somebody makes rather than a line nobody notices.

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTS = ['', '.js', '.jsx', '.json'];
function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const e of EXTS) {
    const p = base + e;
    try { if (statSync(p).isFile()) return p; } catch { /* keep looking */ }
  }
  for (const e of ['index.js', 'index.jsx']) {
    const p = path.join(base, e);
    try { if (statSync(p).isFile()) return p; } catch { /* keep looking */ }
  }
  return null;
}

const STATIC = /(?:^|\n)\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Everything reachable from `entry` WITHOUT crossing an `import()`. */
function staticGraph(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(js|jsx)$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    const lazy = new Set([...src.matchAll(DYNAMIC)].map((m) => m[1]));
    for (const m of src.matchAll(STATIC)) {
      if (lazy.has(m[1])) continue;             // the same specifier, loaded lazily
      const resolved = resolveSpec(file, m[1]);
      if (resolved) stack.push(resolved);
    }
  }
  return seen;
}

const entry = staticGraph(path.join(SRC, 'main.jsx'));
const entryJs = [...entry].filter((f) => /\.jsx?$/.test(f));
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');

/** Every class name a stylesheet defines. */
const classesIn = (file) =>
  new Set([...readFileSync(file, 'utf8').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));

const indexCss = readFileSync(path.join(SRC, 'styles/index.css'), 'utf8');
const imported = [...indexCss.matchAll(/@import\s+'([^']+)'/g)].map((m) => m[1]);

// THE BUDGET. Every sheet here is downloaded and parsed before the first
// screen can paint, by every visitor, on every device. Adding a line to
// index.css is one keystroke and costs nothing visible, which is how it came
// to hold twenty-four; this list is what makes the next one a decision.
//
// To add one: prove an entry-graph module needs it at FIRST PAINT. If it
// belongs to a screen behind a tap, import it from that screen instead.
const ENTRY_BUDGET = [
  './tokens.css',
  '../components/system/system.css',
  './base.css',
  './layout.css',
  './play.css',
  './table.css',
  './cards.css',
  './action-bar.css',
  './chat.css',
  './agent-chat.css',
  './analysis.css',
  './floor.css',
  './watch.css',
  './watch6.css',
  './sit1.css',
  './replay.css',
  './ftu.css',
  './attributes.css',
  './wallet.css',
];

it('BUG-156: the entry stylesheet holds its budget and nothing else', () => {
  expect(imported).toEqual(ENTRY_BUDGET);
});

it('BUG-156: every sheet in the budget is named by a module in the entry graph', () => {
  const sources = entryJs.map((f) => readFileSync(f, 'utf8'));
  const unused = imported.filter((spec) => {
    const own = [...classesIn(path.resolve(SRC, 'styles', spec))];
    if (own.length === 0) return false;          // variables and resets only
    return !own.some((c) => {
      const re = new RegExp(`(^|[^\w-])${c}([^\w-]|$)`);
      return sources.some((src) => re.test(src));
    });
  });
  expect(unused, 'no entry module names a class in these').toEqual([]);
});

it('BUG-156: the desktop shell and the casino building are not in the phone entry', () => {
  expect(imported).not.toContain('./desktop.css');
  expect(imported).not.toContain('./casino.css');
  // …and they are still loaded by somebody, or the desk would be unstyled.
  const desktopHome = readFileSync(path.join(SRC, 'components/desktop/DesktopHome.jsx'), 'utf8');
  const casino = readFileSync(path.join(SRC, 'screens/CasinoScreen.jsx'), 'utf8');
  expect(desktopHome).toMatch(/styles\/desktop\.css/);
  expect(casino).toMatch(/styles\/casino\.css/);
  expect(casino).toMatch(/styles\/desktop\.css/);
  // Both of those screens are behind an import(), which is what makes the
  // sheets lazy rather than merely moved.
  const app = readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
  expect(app).toMatch(/import\(\s*'\.\/components\/desktop\/DesktopHome\.jsx'\s*\)/);
  expect(app).toMatch(/import\(\s*'\.\/screens\/CasinoScreen\.jsx'\s*\)/);
});

it('BUG-156: the replay theatre is not dragged into the entry by a static import', () => {
  const theatre = path.join(SRC, 'components/replay/ReplayTheatre.jsx');
  const pullers = entryJs.filter((f) => {
    const src = readFileSync(f, 'utf8');
    const lazy = new Set([...src.matchAll(DYNAMIC)].map((m) => m[1]));
    return [...src.matchAll(STATIC)].some((m) => !lazy.has(m[1]) && resolveSpec(f, m[1]) === theatre);
  });
  expect(pullers.map(rel), 'the theatre opens on a tap; it must not ship with the room').toEqual([]);
});

it('BUG-156: .no-scrollbar stays where the always-loaded components can reach it', () => {
  // Four entry components name it. It lived in home.css, which is a screen
  // sheet nothing reachable imports any more — those two lines were the whole
  // reason 20KB of it rode along in the entry.
  expect(readFileSync(path.join(SRC, 'styles/base.css'), 'utf8')).toMatch(/\.no-scrollbar\b/);
  expect(imported).toContain('./base.css');
});
