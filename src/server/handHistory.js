// SQLITE-1: hands live in the `hands` table instead of data/hands-<userId>.json.
// Both signatures and both return shapes are unchanged — newest-first, capped
// at MAX_HANDS per owner. The append is now one transaction instead of a
// read-modify-write of the whole file.

import { appendHandRow, readHandRows } from './store.js';

const MAX_HANDS = 50;

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
