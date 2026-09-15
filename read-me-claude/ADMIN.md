# ADMIN.md — the owner's dashboard (ADMIN-1)

One page Jens opens on his phone or his desktop to know how the game is doing,
without an SSH session. Read-only. It is not part of the product: no player can
reach it, nothing on it can change a chip, an agent or a hand, and nothing on it
costs a model call.

---

## How to open it

1. `ADMIN_KEY` must be set on the deployment. It lives in `.bashrc` on the VPS
   beside the other secrets. **With it unset the dashboard does not exist** —
   `/admin` and all three JSON routes answer 404, not 403. A deployment that
   never configured a dashboard does not advertise that it has one.
2. Go to `https://agenticpoker.app/admin`.
3. Paste the key into the form and press **Open**.

The key is kept in `sessionStorage`, so it lives as long as that browser tab and
no longer — close the tab and the next visit asks again. **Forget key** clears it
now. It travels in the `x-admin-key` header on every request and is never put in
a URL: a URL lands in every access log, proxy log and browser history there is.

The page refreshes itself every 60 seconds. It is never cached
(`Cache-Control: no-store`) — a cached admin page shows last hour's floor to
somebody deciding what to do about this one.

### Reading it from a terminal

```
curl -s -H "x-admin-key: $ADMIN_KEY" https://agenticpoker.app/api/admin/stats | jq
curl -s -H "x-admin-key: $ADMIN_KEY" 'https://agenticpoker.app/api/admin/owners?sort=usd7d&limit=20' | jq
curl -s -H "x-admin-key: $ADMIN_KEY" https://agenticpoker.app/api/admin/agents/recent | jq
```

Six requests a minute per key, **per endpoint**. That is ten times what the page
needs and a hard ceiling on how fast a wrong key can be guessed. A seventh in the
same minute answers 429. Each endpoint has its own window, so one page load
spends one request from each of three budgets rather than three from one.

---

## What "active" means

**The single most important definition on the page, because it is the one that
can be quietly misread.**

An owner is *active* in a window if the server saw an **authenticated request**
from him inside it. That is recorded by the presence middleware (`presence.js`):
at most **one write a minute per owner**, into `owner_activity`, one row per
(owner, UTC day) carrying `first_seen`, `last_seen` and `opens`.

What follows from that:

- It means *he opened the app*, not *his agent played*. An owner whose agent
  grinds all night while he sleeps is **not** active. That is deliberate — the
  question is whether people are coming back, and an autonomous agent answering
  that question for them would flatter the number permanently.
- It is throttled, so `opens` is "minutes in which he did something", not
  requests. A number like 14 means he came back through the day, not that he
  clicked 14 times.
- **The table starts at the deploy that added it.** Every window that reads
  `owner_activity` — active 24h/7d/30d, and both retention columns — reads zero
  for anything before that deploy, however real those owners were. Give it 30
  days before treating `active30d` as a real figure, and 14 before trusting a
  full cohort table.
- A **guest** is recorded under his own `g_` owner id like anybody else, but the
  owner counts **exclude unclaimed guests** and the guest tiles count them
  separately (by `guests.last_seen_at`, their own clock, touched by the cookie).
  A guest who *claims* becomes an owner and is counted as one from then on — his
  `guests` row is kept forever as the only record that the two ids were the same
  person, which is why "guest" on the page means *unclaimed*.

---

## What each number means

Every number on the page carries its own definition — **hover any tile** and the
title is the actual SQL or the actual source that produced it. That is enforced
by a test that walks the payload and fails on any bare number or any definition
too short to say something. So this section is the map, not the dictionary: the
dictionary is on the page.

### Where the numbers come from

| Source | What it answers |
|---|---|
| `owner_activity` | presence — who opened the app, and when (ADMIN-1) |
| `event_ticks` | the hourly tally — hands, knocks, chips won, refused pings, model calls and model errors (ADMIN-1) |
| `model_calls`, `decision_routes`, `watch_hands`, `watch_calls` | the meter (METER-1, COST-1, COST-2), read through `meter.js`'s own `adminMeter()` and never re-queried |
| `agents`, `wallets`, `guests`, `notifications` | the product's own tables |
| `tableRegistry` | the live floor, which exists in memory and nowhere else |

### The three windows, exactly

The tick meter is bucketed by **UTC hour**, and the labels mean precisely this:

- **1h** — the *current UTC hour bucket, so far*. Not a rolling sixty minutes.
  Just after the hour turns it is a small number because the hour is young.
- **24h** — the current bucket and the 23 before it.
- **7d** — the current bucket and the 167 before it.

The **24h / 7d toggle** in the header switches every tile that has both.

### Things worth knowing before you quote a number

- **owners.new24h / new7d** counts owners whose **first agent was drafted** in
  the window. Nothing in the database records a signup, so an owner who opened
  the app and drafted nobody is not a new owner here.
- **agents.fallbackBirths** is an alarm, not a statistic. It counts agents whose
  strategy is *exactly* one of `inferFallback()`'s three canned strings —
  BUG-46. Since that repair it can only happen on a keyless box, so on prod
  **anything above zero is a fault**.
- **play.hands*** is one tick per finished **hand** across the whole building,
  home games included — not per seat. The meter's `watch_hands` is per
  seat-owner and answers a different question; the owners table's `hands 7d`
  column uses that one, so the two will not add up and are not meant to.
- **money.chipsWon24h** is the sum of **positive** session nets as they were
  credited. A losing session is not a debit here — it is simply not a credit,
  the same rule `wallets.earned` and SLOTS-1 already follow.
- **model.usdPer100Hands watched vs unwatched** is the COST-2 dial earning its
  keep. The unwatched line should be the *cheap* one; if it is not, the gate is
  not firing. `null` rather than `0` when no hand of that kind has been
  recorded — a rate with no hands behind it is not a rate.
- **model.cachedTokens** is expected to be **zero**. CACHE-1 and COST-2-4 both
  measured prompt caching as inert on Haiku 4.5 (4,096-token minimum cacheable
  prefix; ours is 291). A number here means something changed.
- **model.lastCallAt** is the key-health reading. A floor that is playing while
  this stops moving means calls are *failing*, not that nobody is here.
- **The env switches are booleans and only booleans.** Three of the four carry a
  secret; the value never leaves the process.
- **`GUEST_PER_IP_PER_DAY`** (GUEST-3) — how many guests one address may mint in
  a day. **Default 20**, unset on the VPS unless somebody wants a different
  number; read at call time, so moving it in `.bashrc` and restarting with
  `--update-env` is the whole change, with no deploy. It is not a boolean and it
  is not a secret, which is why it is written here rather than counted among the
  four above.

  It exists because an address is not a person: a flat, an office, a school and
  a conference each share one. The old five was calibrated for a crawler and
  caught the third friend in the same room. Raise it if a real group hits it;
  lower it if a crawler does. Over the cap the mint answers `429
  {error:"guestCap", perDay}` and the client shows that message under a closed
  seat ring rather than a silent Telegram wall.
- **owners table `first agent`** is the name of his *oldest agent*, not his own.
  The database holds no human name for an owner anywhere — Telegram's is
  verified and thrown away, a guest never had one.
- **owners table ids are masked** to the last four characters, in the query
  result rather than in the page, so no version of the response carries a whole
  one. Four is enough to tell two rows apart and to match a row against a
  support message; it is not enough to open a chat with somebody.
- **recent births `where`** is asked of the **live registry**, not of the stored
  status. BUG-16's law holds here too — the table is the witness — and a record
  that still says "playing" after a restart is exactly the thing you opened the
  dashboard to find.

### Retention

Cohorts by the UTC day an owner drafted his **first** agent, for the last 14
days. `day 2` is how many of that cohort were seen again on the following day;
`day 7`, six days after. "Seen" is a presence row, so read the warning about the
table's start date above before drawing a curve through it.

---

## The problems strip

The red strip at the top is computed **on the server**, so "is anything wrong"
has one definition whether you read the JSON or look at the page. It lists:

| Red | What it means |
|---|---|
| Key unhealthy — provider 401/403 in 24h | A revoked, wrong or missing `ANTHROPIC_API_KEY`. Every agent is falling back to the compiled policy. |
| Key unhealthy — hands but no successful call in 6h | The same news arriving the other way round: the floor is playing and nothing is reaching the model. |
| Provider 5xx in 24h | The model provider was down or degraded. |
| Fallback births | BUG-46. On a deployment with a key this must be zero. |
| Database over 500 MB | Nothing prunes hands or threads beyond their per-owner caps. |
| `GUEST_ENABLED` is off | The no-account door is shut — nobody can play without a Telegram account. |
| `NOTIFY_ENABLED` is off | The bot sends nothing. Owners are not being told their agent busted or finished a session. |

When there is nothing, the strip says **Nothing red.** — it is always there, so
its absence is never mistaken for good news.

---

## What it costs

Nothing worth measuring, and that is pinned by tests (`cost.test.js`):

- **It never calls a model.** No file under `src/server/admin/` names
  `getAgentAction`, `callClaude`, `messages.create` or `complete({`, and none of
  them imports anything out of `src/agent` at all — the model layer is reached
  only through `meter.js`, and only for prices. Loading the whole page moves
  neither the meter's totals nor the model tick.
- **It reads, and that is all.** Reading the stats writes to no table. The one
  write the whole feature adds to the product is the throttled presence row.
- **The whole payload comes back in under 200 ms** on a prod-sized database —
  asserted against a seeded 500 owners / 2,000 agents / 50,000 hands / 14 days
  of presence / a full week of ticks. It refreshes every minute, so this is a
  floor-hitch question, not a comfort one.
- **Nothing is logged.** Not the key, not a rejected key, not an owner id, not a
  request line. The test asserts the admin path writes *no log line at all*,
  because a check for one particular secret passes the day somebody logs a
  different one.

---

## The endpoints

All three are `GET`, all three take `x-admin-key`, all three are `no-store`, and
all three 404 with `ADMIN_KEY` unset.

```
GET /admin                       the page itself (no key needed — it is the login form)
GET /api/admin/stats             the whole game; every leaf { value, definition }
GET /api/admin/owners?sort=&limit=   a row per owner, sortable by any column
GET /api/admin/agents/recent     the last 50 births
```

`sort` is one of `lastSeen` (default), `agents`, `hands7d`, `usd7d`, `chips`,
`guest`, `name`, `id`. It comes from a fixed map and is never interpolated into
SQL; an unknown value falls back to `lastSeen` and the response says which sort
was actually used. `limit` defaults to 50 and is clamped to 500.

`GET /api/admin/meter?key=…` (METER-1) is **separate and unchanged** — it is the
per-owner, per-day bill, it has its own caller, and it still takes its key as a
query parameter. Nothing new was added to that pattern; the dashboard's own
routes take the header only.

---

## Where the code is

```
src/server/admin/
  index.js      installAdminRoutes — the one mount line in src/index.js
  presence.js   the one write: owner_activity, throttled to 1/min per owner
  key.js        ADMIN_KEY: header only, constant-time, 6/min per key, 404 unset
  stats.js      GET /api/admin/stats — every number and its definition
  owners.js     the two lists, with the id masked in the query result
  page.html     the whole page: inline CSS, inline JS, no build step
```

Plus six one-line best-effort `bumpTick` calls in the product — `table.js`
(one per finished hand), `visit.js` (knock, accept), `agentProfiles.js` (chips
won), `notify.js` (a ping the budget refused) and `meter.js` (a model call, and
its error sink registered on `providers/index.js`). Each is wrapped and each can
only ever cost a counter, never a hand.

The page is deliberately one static file with no build step: it has to work the
day the client build is broken, which is exactly the day somebody opens it.

---

## The write panel (ADMIN-2)

A second panel on the same page, same `x-admin-key` header, same "unset means
404" rule — but it can change a chip, an agent's name, whether he is on the
roster, and whether he is seated. **This is why the read-only key must be
rotated before the write panel is trusted with anything**: the key that has
been guarding `/api/admin/stats` has, by ADMIN-1's own design, been pasted
into chat windows and terminals as a read-only convenience. A key that has
been in a chat window is burned (see `HOW_WE_WORK.md`'s own rule for every
other secret in this project) — and a burned key sitting in front of a panel
that can now move money and hide agents is a materially bigger blast radius
than the same key sitting in front of a read-only dashboard. Generate a new
`ADMIN_KEY`, put it in `.bashrc` in place of the old one, and treat the old
value as compromised the moment this panel ships — not because anything
leaked, but because the old key's threat model (read-only convenience) is not
the one it is being asked to hold now.

Everything else about the write panel — its own tighter/separate rate limit,
its 401 on a wrong key, the audit log, the confirm requirement on destructive
actions, and the two recorded gaps (a reversible retire that never collects
money, and no direct setter for an agent's "routine") — is in
`src/server/admin/ops.js`'s own header and in `BUGS.md`'s ADMIN-2 entry.
