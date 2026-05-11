import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const MAX_HANDS = 50;

export function appendHand(userId, hand) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `hands-${userId}.json`);
  let hands = [];
  try {
    hands = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    hands = [];
  }
  hands.unshift(hand);
  if (hands.length > MAX_HANDS) hands = hands.slice(0, MAX_HANDS);
  fs.writeFileSync(file, JSON.stringify(hands, null, 2), 'utf8');
}

export function readHands(userId, limit = 20) {
  const file = path.join(DATA_DIR, `hands-${userId}.json`);
  try {
    const hands = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(hands) ? hands.slice(0, limit) : [];
  } catch {
    return [];
  }
}
