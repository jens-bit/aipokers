// src/server/admin/index.js — ADMIN-1
//
// The owner's dashboard: one page Jens opens on his phone to know how the game
// is doing, without an SSH session.
//
// Everything here is READ-ONLY except one thing — the presence write in
// presence.js, which exists because nothing in the product recorded that an
// owner opened it. Nothing here calls a model, and nothing here can change a
// chip, an agent or a hand.
//
// One mount line in src/index.js reaches all of it:
//   · the presence middleware, on every request that follows it;
//   · GET /api/admin/stats          — the whole floor in one JSON;
//   · GET /api/admin/owners         — a row per owner;
//   · GET /api/admin/agents/recent  — the last 50 births;
//   · GET /admin                    — the page that renders them.
//
// GET /api/admin/meter (METER-1) is NOT re-implemented here. It already
// answers what the models cost per owner per day, it already has the key
// check, and the dashboard reads its numbers through meter.js's own
// adminMeter() rather than running its own SQL over model_calls.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { presenceMiddleware } from './presence.js';
import { adminGuard, adminKey } from './key.js';
import { adminStats } from './stats.js';
import {
  ownerRows, recentBirths, OWNER_SORTS, OWNER_ROWS_DEFINITION, RECENT_BIRTHS_DEFINITION,
} from './owners.js';
import { installAdminWriteRoutes } from './opsRoutes.js';

export function installAdminRoutes(app, { now = () => Date.now() } = {}) {
  // Mounted before the routes below it, so that everything an owner's client
  // touches counts as him having been here. Registered from inside the admin
  // module rather than from src/index.js so the whole feature stays one line
  // at the call site — and so a deployment that removed that line has no
  // presence write either, which is the honest way round.
  app.use(presenceMiddleware({ now }));

  // GET /api/admin/stats — the whole game in one JSON.
  //
  // Every leaf is { value, definition }; see stats.js for what each one counts
  // and what it deliberately does not. Read-only, no model call, and its own
  // 6-a-minute window on top of the /api limiter src/index.js already applies.
  app.get('/api/admin/stats', adminGuard(), (_req, res) => {
    res.json(adminStats({ now: now() }));
  });

  // GET /api/admin/owners?sort=&limit= — a row per owner, sortable by any
  // column. The id is masked to its last four characters in the query result,
  // so no version of this response carries a whole one.
  app.get('/api/admin/owners', adminGuard(), (req, res) => {
    const sort = String(req.query.sort ?? 'lastSeen');
    res.json({
      sort: sort in OWNER_SORTS ? sort : 'lastSeen',
      sorts: Object.keys(OWNER_SORTS),
      definition: OWNER_ROWS_DEFINITION,
      rows: ownerRows({ sort, limit: req.query.limit, now: now() }),
    });
  });

  // GET /api/admin/agents/recent — the last 50 births.
  app.get('/api/admin/agents/recent', adminGuard(), (req, res) => {
    res.json({
      definition: RECENT_BIRTHS_DEFINITION,
      rows: recentBirths({ limit: req.query.limit }),
    });
  });

  // ADMIN-2: the write panel, alongside this read one. Same key, its own
  // tighter/separate rate window — see opsRoutes.js and writeGuard.js.
  installAdminWriteRoutes(app);

  // GET /admin — the page.
  //
  // NOT behind adminGuard: it is the login form, and a form that needs the key
  // to render cannot ask for it. It carries no data of its own — every number
  // on it arrives from the three endpoints above, each of which does check the
  // key. What it does follow is the same "no key configured, no dashboard"
  // rule, so a deployment without one does not serve a login box for a door
  // that is not there.
  //
  // no-store, always. A cached admin page is a page that shows last hour's
  // floor to somebody deciding what to do about this one.
  app.get('/admin', (_req, res) => {
    if (!adminKey()) return res.status(404).type('text/plain').send('Not found');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.type('html').send(pageHtml());
  });
}

// Read once and held: it is a static file that cannot change without a deploy,
// and a disk read per request on a page that refreshes itself is waste. Read
// lazily rather than at import so a process that never serves /admin never
// touches it.
let cachedPage = null;
function pageHtml() {
  if (cachedPage === null) {
    cachedPage = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'page.html'), 'utf8');
  }
  return cachedPage;
}
