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

import { presenceMiddleware } from './presence.js';
import { adminGuard } from './key.js';
import { adminStats } from './stats.js';

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
}
