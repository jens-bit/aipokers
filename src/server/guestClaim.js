// src/server/guestClaim.js — GUEST-1 job 3
//
// Keeping him.
//
// A guest owner and a Telegram owner are the same KIND of thing — an id with a
// roster, a wallet and a pile of threads hanging off it — so the claim is not
// a conversion. It is a rename. Every row that says `g_7fQ…` is made to say
// `4429183` instead, in one transaction, and there is nothing left behind.
//
// It lives beside guestNight.js rather than inside guest.js for the same
// reason that file does: it reaches the roster, and guest.js is a leaf so that
// agentProfiles can import the limits without closing a ring.
//
// ── FOUR THINGS THAT ARE EASY TO GET WRONG ──────────────────────────────────
//
//   1. THE CACHES. agentProfiles keeps the profile table and the wallets in
//      memory. A claim done purely in SQL is invisible until a restart, and
//      the next save for the guest id writes the cached copy back over the
//      rows that just moved. reloadOwners() replaces BOTH cached entries with
//      what the database now says — reloaded rather than dropped, because an
//      id agentProfiles does not hold is built as an EMPTY profile, which is
//      the one screen a claim must never produce.
//
//   2. THE SEATS. A live table remembers whose each seat is. A claim that
//      arrives mid-session and does not re-point them files the rest of that
//      session under an owner who no longer exists.
//
//   3. IDEMPOTENCE. The bot's /start can be tapped twice and a browser can
//      retry a POST. A claimed token is spent — the row records who it became
//      — so a second claim answers 200 with what the first one did rather than
//      minting a fresh empty guest or moving an empty owner over a real one.
//
//   4. THE WALLET IS NOT DOUBLE-SEEDED. A brand-new Telegram owner has no
//      wallet row until something seeds him one, so he takes the guest's
//      verbatim: the money the agent won as a guest is his. An owner who
//      ALREADY has a wallet gets the guest's balance and lifetime earnings
//      added to his own. Summing in the first case would hand a first-time
//      claimer two seeds; discarding in the second would throw away an
//      evening. See store.moveOwner.
//
// GOOGLE IS NOT BUILT. The client has the button and it says "soon". Nothing
// here anticipates it beyond the shape: `via` names the credential the claim
// came in on, so a second one is a second branch here and not a second route.

import { telegramAuthMiddleware, verifyTelegramCredential, telegramUserIdFrom } from './auth.js';
import { reloadOwners, reassignSeats } from './agentProfiles.js';
import {
  guestsEnabled, tokenFrom, clearedCookieHeader,
  loadGuestByToken, markGuestClaimed, moveOwner,
} from './guest.js';

/**
 * Perform the claim. Pure of Express — the route below is a wrapper, and this
 * is what the bot's /start handler calls too (job 5), so the two doors cannot
 * drift into two different claims.
 *
 * @returns { status, body }
 */
export function claimGuest(token, telegramUserId, { via = 'telegram' } = {}) {
  if (!guestsEnabled()) return { status: 404, body: { error: 'guestDisabled' } };

  const tgId = String(telegramUserId ?? '');
  if (!tgId) return { status: 400, body: { error: 'noTelegramUser' } };

  const row = loadGuestByToken(token);
  if (!row) return { status: 404, body: { error: 'noGuest' } };

  // Rule 3. A token that has already been spent answers with what it became.
  // Two shapes of "already": the same person tapping twice (a no-op, and a
  // success), and somebody else's token being replayed (not his to claim).
  if (row.claimedBy) {
    if (String(row.claimedBy) === tgId) {
      return { status: 200, body: { claimed: true, ownerId: tgId, from: row.ownerId, agents: 0, alreadyClaimed: true, via } };
    }
    return { status: 409, body: { error: 'alreadyClaimed' } };
  }

  let moved;
  try {
    moved = moveOwner(row.ownerId, tgId);
  } catch (err) {
    console.error('[guest] claim failed:', err.message);
    return { status: 500, body: { error: 'claimFailed' } };
  }

  // Order matters. The token is spent FIRST, so a crash between here and the
  // cache drop leaves a claimed guest whose rows have moved — which the next
  // request reads correctly off a cold cache — rather than an unclaimed guest
  // whose rows are gone, which is a token that could move an empty owner over
  // the real one a second time.
  try { markGuestClaimed(row.token, tgId); }
  catch (err) { console.error('[guest] marking the token claimed failed:', err.message); }

  reloadOwners(row.ownerId, tgId);
  const seats = reassignSeats(row.ownerId, tgId);

  console.log(`[guest] claimed: ${row.ownerId} → ${tgId} (${moved.agents} agent(s), wallet ${moved.wallet}${seats ? `, ${seats} live seat(s)` : ''})`);
  return {
    status: 200,
    body: {
      claimed: true,
      ownerId: tgId,
      from: row.ownerId,
      agents: moved.agents,
      wallet: moved.wallet,
      // Never non-empty in practice — agent ids are minted from randomness —
      // but a claim that quietly left one behind would be worse than one that
      // says so.
      collided: moved.collided,
      via,
    },
  };
}

/**
 * POST /api/guest/claim
 *
 * The credential is the ordinary x-telegram-init-data header — the SAME one
 * every other route takes, verified by the same function under both schemes,
 * so the Mini App and the desktop login both reach this without a second kind
 * of proof existing. The guest token comes from the cookie, or from the body
 * for the one caller that has no cookie: the bot's deep link, where Telegram
 * hands the token back as a /start parameter (job 5).
 *
 * telegramAuthMiddleware sits in front for the deployment that HAS a bot
 * token, where it rejects a forged credential outright. It cannot be the whole
 * check: with no bot token configured it lets everything through (local dev),
 * and the id is read out of the payload below either way.
 */
export function installClaimRoute(app) {
  app.post('/api/guest/claim', telegramAuthMiddleware, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!guestsEnabled()) return res.status(404).json({ error: 'guestDisabled' });

    const credential = String(req.headers['x-telegram-init-data'] || req.body?.initData || '');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // With a bot token the credential must verify. Without one this is a dev
    // box with no signatures to check, and the id in the payload is taken at
    // face value exactly as isOwner() does.
    if (botToken && !verifyTelegramCredential(credential, botToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgId = telegramUserIdFrom(credential);
    if (!tgId) return res.status(400).json({ error: 'noTelegramUser' });

    const token = tokenFrom(req) || String(req.body?.token || '');
    if (!token) return res.status(400).json({ error: 'noGuestToken' });

    const out = claimGuest(token, tgId);
    // The cookie goes on the way out of a successful claim, including an
    // idempotent second one: whatever this browser is now, it is not that
    // guest, and a cookie left behind is a credential that outlives its owner.
    if (out.status === 200) {
      res.setHeader('Set-Cookie', clearedCookieHeader({ secure: isSecure(req) }));
    }
    res.status(out.status).json(out.body);
  });
}

const isSecure = (req) => req?.secure === true
  || String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
