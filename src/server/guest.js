// src/server/guest.js — GUEST-1
//
// Play without an account.
//
// There were two ways to be somebody here and both of them were Telegram: the
// Mini App's initData and the desktop Login Widget. A stranger who followed a
// link had a landing page to read and a login to get past before he had seen
// anything the page was describing. Wave 61's rule is that the landing IS the
// game, and a landing that is the game cannot open with a login.
//
// So there is a third kind of owner. A guest is an owner in every way that
// matters — the same `ownerId` runs through profiles, agents, wallets, threads
// and the meter, and every route that reads an owner reads his — and he is
// told apart by ONE thing: the credential he holds is an httpOnly cookie this
// server minted, not a signature Telegram made.
//
// ── THE FOUR LIMITS, AND WHY THEY ARE HERE ──────────────────────────────────
//
// A guest costs money and holds a seat, and neither is free, so he is bounded:
//
//   ONE AGENT          the roster is one, not the earned ladder's four.
//   ONE SESSION A DAY  one stay at a casino table per day. The kitchen table,
//                      the couch, the fridge and the TV are unbounded, because
//                      none of them spends anything.
//   HE CANNOT TALK     POST /api/home/say and the whisper are 403 claimToTalk.
//                      Talking is the thing the product is FOR, which is what
//                      makes it the right thing to ask an account for.
//   HE PLAYS ON POLICY the decision router sends every one of his decisions to
//                      the compiled policy, and his table talk comes from the
//                      templates. A guest owner never reaches a model except
//                      for the draft itself.
//
// EVERY ONE OF THEM IS DECIDED IN THIS FILE. The enforcement necessarily lives
// where the action is — deployAgent knows what a session is, router.js knows
// what a decision is — but not one of those places gets to decide what the
// limit IS. That is the difference between a rule and four opinions: a limit
// spelled out at its call site is a limit that will be relaxed at one of them
// and nowhere else, six weeks from now, by somebody fixing something adjacent.
//
// ── THE DRAFT IS THE EXCEPTION, ON PURPOSE ──────────────────────────────────
//
// Drafting him is the only thing a guest may spend a model call on. It is also
// the only thing that has to be good: the draft is the product's whole first
// impression and a templated recruiter is a worse advertisement than no
// recruiter at all. Everything after it — his play, his lines, his memory, the
// nightly write-up — is free until somebody claims him.
//
// ── OFF BY DEFAULT ──────────────────────────────────────────────────────────
//
// GUEST_ENABLED must be set to 1 for any of this to exist. Unset, POST
// /api/guest 404s, no cookie is ever read, `isGuestOwner` is false for
// everybody, and the server behaves exactly as it did before this file.

import crypto from 'node:crypto';
import { setGuestResolver } from './auth.js';
import { rateLimiter } from './rateLimit.js';
import {
  insertGuest,
  loadGuestByToken,
  loadGuestByOwner,
  countGuestsFromIp,
  touchGuest,
  noteGuestSession,
  markGuestClaimed,
  listStaleGuests,
  moveOwner,
} from './store.js';

// ── The dials ───────────────────────────────────────────────────────────────

/** The switch. Off until Jens flips it on the VPS. */
export function guestsEnabled() {
  return String(process.env.GUEST_ENABLED ?? '0') === '1';
}

/** How long the cookie lives, and how long an untouched guest survives. */
export const GUEST_COOKIE_DAYS = 30;
export const GUEST_STALE_DAYS = 30;

/** One agent. Not the earned ladder — a flat one, whatever he has won. */
export const GUEST_AGENT_CAP = 1;

/** One stay at a casino table per day. */
export const GUEST_SESSIONS_PER_DAY = 1;

/** Guest creations allowed from one address per day. */
export const GUEST_PER_IP_PER_DAY = 5;

export const GUEST_COOKIE = 'ap_guest';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day a timestamp belongs to, UTC — the same key rustNight and homeNight use. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

// ── Identity ────────────────────────────────────────────────────────────────
//
// The token is 32 bytes of randomness and it is the whole credential, so it is
// generated the way a session key is and never derived from anything. The
// owner id is a SEPARATE random string rather than a function of the token:
// the owner id appears in query strings, in logs and on the wire, and an id
// that a token can be recovered from is a credential that leaks through every
// one of them.

const newToken = () => crypto.randomBytes(32).toString('base64url');
const newOwnerId = () => `g_${crypto.randomBytes(9).toString('base64url')}`;

/** Is this owner id a guest? False for everybody when the door is shut. */
export function isGuestOwner(ownerId) {
  if (!ownerId || !guestsEnabled()) return false;
  if (!String(ownerId).startsWith('g_')) return false;   // cheap reject, no query
  try {
    return loadGuestByOwner(ownerId) != null;
  } catch (err) {
    console.error('[guest] lookup failed:', err.message);
    return false;
  }
}

/**
 * The guest record behind an owner id, or null. Exported for the routes and
 * for the claim; nothing outside this file should need it.
 */
export function guestFor(ownerId) {
  if (!guestsEnabled() || !ownerId) return null;
  try { return loadGuestByOwner(ownerId); } catch { return null; }
}

// ── Cookies ─────────────────────────────────────────────────────────────────
//
// Parsed by hand rather than with cookie-parser: it is eight lines, and a new
// dependency needs a reason better than eight lines (see the hard rules in
// CLAUDE.md).

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || !header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (!key || out[key] !== undefined) continue;   // first wins
    try { out[key] = decodeURIComponent(part.slice(eq + 1).trim()); }
    catch { out[key] = part.slice(eq + 1).trim(); }
  }
  return out;
}

/**
 * The Set-Cookie value for a guest token.
 *
 * httpOnly so no script on the page can read it — the token is the whole
 * identity and a token in localStorage is a token an injected script can post
 * somewhere. SameSite=Lax so it rides an ordinary navigation (the deep link
 * back from the bot) but not a cross-site POST. Secure whenever the request
 * arrived over TLS, which is every deployment and no local dev box.
 */
export function guestCookieHeader(token, { secure = true, days = GUEST_COOKIE_DAYS } = {}) {
  const bits = [
    `${GUEST_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.round(days * 24 * 60 * 60)}`,
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

/** The header that takes it away again — same attributes, no life left. */
export function clearedCookieHeader({ secure = true } = {}) {
  const bits = [`${GUEST_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

const isSecureRequest = (req) => req?.secure === true || String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

/**
 * The address the 5-a-day cap counts against.
 *
 * `req.ip` is the SOCKET's address, and the socket on this deployment belongs
 * to whatever terminates TLS in front of node — PUBLIC_BASE_URL is https and
 * the process listens on plain 8765. Counting that would make five-a-day a
 * global cap of five guests a day for the whole site, which is not the limit
 * anybody meant.
 *
 * So the forwarded chain is read first, leftmost entry, which is the client
 * the proxy saw. That header is forgeable by a client talking to node
 * DIRECTLY, and the honest reading of this cap is therefore "a speed bump
 * against a browser and a script that has not thought about it", not a
 * security control. It is guarding play money and a policy-only agent; the
 * things that actually cost — every model call past the draft — are shut off
 * for a guest whether he made one account or fifty.
 *
 * Express's own `trust proxy` would do the same job, but it would also change
 * what rateLimit.js counts for every other route in the product, and a wider
 * blast radius is not something this tree is entitled to take.
 */
export function clientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return req?.ip || req?.socket?.remoteAddress || null;
}

/** The token this request carries, or ''. */
export function tokenFrom(req) {
  return parseCookies(req?.headers?.cookie)[GUEST_COOKIE] || '';
}

// ── The resolver auth asks ──────────────────────────────────────────────────
//
// Registered at module load rather than from installGuestRoutes(), because the
// thing that must be true is "this process understands guest cookies", and
// that is true the moment anything imports this file — including a test that
// imports it to exercise one limit without standing up an Express app. See the
// note in auth.js for why the arrow points this way.
//
// `touch` is what keeps a guest alive: every resolved request restamps him, so
// the nightly retirement below sees "untouched for thirty days" and not "made
// thirty days ago".

setGuestResolver((req) => {
  if (!guestsEnabled()) return null;
  const token = tokenFrom(req);
  if (!token) return null;
  const row = loadGuestByToken(token);
  // A claimed token is spent. Its owner's life has moved to a Telegram id and
  // answering with the old one would hand back an empty flat.
  if (!row || row.claimedBy) return null;
  try { touchGuest(token); } catch { /* a missed stamp is not worth a 500 */ }
  return row.ownerId;
});

// ── The limits ──────────────────────────────────────────────────────────────

/**
 * May this owner make another agent? Returns a refusal body, or null.
 *
 * Shaped like slots.js's two refusals so the client switches on one field: a
 * guest at his cap gets `guestAgentCap`, and the reason it is not `agentCap`
 * is that the two have different answers — one is fixed by retiring somebody,
 * this one is fixed by claiming him.
 */
export function guestAgentRefusal(ownerId, activeCount) {
  if (!isGuestOwner(ownerId)) return null;
  if (activeCount < GUEST_AGENT_CAP) return null;
  return { error: 'guestAgentCap', cap: GUEST_AGENT_CAP, claim: true };
}

/**
 * May this owner start a casino session? Returns a refusal body, or null.
 *
 * Read-only: the count moves in `noteSession` below, when a seat is actually
 * taken. A gate that spent the day's session by being asked would turn a
 * refused deploy — a broke pocket, a full room — into a day gone.
 */
export function guestSessionRefusal(ownerId, { now = Date.now() } = {}) {
  if (!isGuestOwner(ownerId)) return null;
  const row = guestFor(ownerId);
  if (!row) return null;
  const today = dayKey(now);
  const used = row.sessionDay === today ? row.sessionCount : 0;
  if (used < GUEST_SESSIONS_PER_DAY) return null;
  return {
    error: 'guestSessionCap',
    message: 'He has had his night. Keep him and he plays whenever you like.',
    perDay: GUEST_SESSIONS_PER_DAY,
    used,
    claim: true,
  };
}

/** He sat down. Idempotent for a non-guest, which is every other owner. */
export function noteSession(ownerId, { now = Date.now() } = {}) {
  if (!isGuestOwner(ownerId)) return 0;
  try { return noteGuestSession(ownerId, dayKey(now), now); }
  catch (err) { console.error('[guest] session note failed:', err.message); return 0; }
}

/**
 * The refusal every talking route returns for a guest. One body, one place —
 * the client opens the SAME claim wall on it wherever it arrives, which is
 * only possible because there is one of it.
 */
export const CLAIM_TO_TALK = Object.freeze({
  error: 'claimToTalk',
  message: 'Keep him and you can talk to him.',
  claim: true,
});

/** True when this owner may not say anything to his agents. */
export function mustClaimToTalk(ownerId) {
  return isGuestOwner(ownerId);
}

/**
 * True when nothing this owner does may reach a model.
 *
 * The one exception is the draft, and it is an exception by OMISSION: the two
 * draft routes simply do not ask this question. Everything else does — the
 * decision router, the hand's talk, the memory refresh, the nightly recap and
 * the nightly exchange — so a new model call added anywhere in the product is
 * free for guests only if somebody remembers to ask, which is why the ask is
 * one function with one name and not a flag threaded through five signatures.
 */
export function modelBlocked(ownerId) {
  return isGuestOwner(ownerId);
}

// ── The route ───────────────────────────────────────────────────────────────

/**
 * POST /api/guest → a new guest owner and the cookie that is him.
 *
 * Rate limited to five a day from one address. The limiter is per-IP and
 * PERSISTED, unlike rateLimit.js's in-memory windows: a cap whose enforcement
 * a restart clears is a cap that is cleared by restarting, and this one is the
 * only thing standing between the route and an unbounded supply of owners.
 * rateLimit.js's own limiter is kept in front of it as the burst guard it is
 * good at — the day count is the ceiling, not the throttle.
 */
export function installGuestRoutes(app, { now = () => Date.now() } = {}) {
  // A per-minute burst guard, so a script cannot spend the day's five in one
  // packet and cannot hammer the route once they are spent.
  const burst = rateLimiter({
    windowMs: 60_000,
    max: Number(process.env.GUEST_RATE_MAX ?? 10),
    message: 'Too many requests — slow down',
    key: clientIp,
  });

  app.post('/api/guest', burst, (req, res) => {
    if (!guestsEnabled()) return res.status(404).json({ error: 'guestDisabled' });

    const at = now();
    const ip = clientIp(req);
    let made = 0;
    try { made = countGuestsFromIp(ip, at - DAY_MS); }
    catch (err) { console.error('[guest] ip count failed:', err.message); }
    if (made >= GUEST_PER_IP_PER_DAY) {
      return res.status(429).json({
        error: 'guestCap',
        message: 'That is enough new players from here today.',
        perDay: GUEST_PER_IP_PER_DAY,
      });
    }

    const token = newToken();
    const ownerId = newOwnerId();
    try {
      insertGuest({ token, ownerId, ip, now: at });
    } catch (err) {
      console.error('[guest] create failed:', err.message);
      return res.status(500).json({ error: 'guestCreateFailed' });
    }

    res.setHeader('Set-Cookie', guestCookieHeader(token, { secure: isSecureRequest(req) }));
    res.setHeader('Cache-Control', 'no-store');
    console.log(`[guest] new guest ${ownerId}`);
    // The token is in the BODY as well as the cookie, and only for one reason:
    // the deep link into the bot carries it as the /start parameter, and a
    // page cannot put an httpOnly cookie into a link. It is the same secret
    // either way — the cookie is where it lives, the body is where the client
    // reads it once to build one URL.
    res.json({
      ownerId,
      token,
      kind: 'guest',
      limits: {
        agents: GUEST_AGENT_CAP,
        sessionsPerDay: GUEST_SESSIONS_PER_DAY,
        talk: false,
        forgottenAfterDays: GUEST_STALE_DAYS,
      },
    });
  });

  // GET /api/guest/me — who this cookie is, if it is anybody. The client's
  // boot question; a 404 means "no guest here", not an error.
  app.get('/api/guest/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!guestsEnabled()) return res.status(404).json({ error: 'guestDisabled' });
    const row = loadGuestByToken(tokenFrom(req));
    if (!row || row.claimedBy) return res.status(404).json({ error: 'noGuest' });
    res.json({
      ownerId: row.ownerId,
      kind: 'guest',
      sessionsToday: row.sessionDay === dayKey(now()) ? row.sessionCount : 0,
      limits: {
        agents: GUEST_AGENT_CAP,
        sessionsPerDay: GUEST_SESSIONS_PER_DAY,
        talk: false,
        forgottenAfterDays: GUEST_STALE_DAYS,
      },
    });
  });

}

// ── Exported for the claim and the nightly pass ─────────────────────────────

export { markGuestClaimed, listStaleGuests, moveOwner, loadGuestByToken, DAY_MS };
