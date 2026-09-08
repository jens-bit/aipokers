// SQLITE-1: hands live in the `hands` table instead of data/hands-<userId>.json.
// Both signatures and both return shapes are unchanged — newest-first, capped
// at MAX_HANDS per owner. The append is now one transaction instead of a
// read-modify-write of the whole file.

import { appendHandRow, readHandRows } from './store.js';
import { isOwner, telegramAuthMiddleware } from './auth.js';

const MAX_HANDS = 50;

export function installHandHistoryRoutes(app) {
  app.get('/api/history/:userId', telegramAuthMiddleware, (req, res) => {
    const userId = req.params.userId;
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your history' });
    res.setHeader('Cache-Control', 'no-store');
    // BUG-49: old rows contain every seat's cards, even folded hands. Filter
    // at read time so existing stored histories are protected as well.
    res.json(readHands(userId, 20).map(hand => {
      const ownSeats = new Set((hand.players ?? []).filter(p => String(p.playerId) === userId
        || String(p.playerId).startsWith(`${userId}:`)).map(p => String(p.seat)));
      return { ...hand,
        holeCards: Object.fromEntries(Object.entries(hand.holeCards ?? {}).filter(([seat]) => ownSeats.has(seat))),
        decisions: (hand.decisions ?? []).map(({ seat, street, action }) => ({ seat, street, action })),
      };
    }));
  });
}

export function appendHand(userId, hand) {
  appendHandRow(userId, hand, MAX_HANDS);
}

export function readHands(userId, limit = 20) {
  try {
    return readHandRows(userId, limit);
  } catch {
    return [];
  }
}
