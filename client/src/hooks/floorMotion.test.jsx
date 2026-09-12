import { describe, expect, it } from 'vitest';
import { normalizeFelts } from './useCasinoRooms.js';

const action = { seq: 4, handNumber: 2, seat: 1, street: 'flop', type: 'raise', amount: 160, chips: 120, allIn: false, pot: 320 };
const chat = { seq: 2, seat: 1, displayName: 'Granite', text: 'Your move.', isAI: true, timestamp: 1000, expiresAt: 5000 };

describe('SHOW-2 floor motion wire', () => {
  it('keeps only public action and speech fields while preserving separate chip and raise amounts', () => {
    const [felt] = normalizeFelts([{
      tableId: 'floor-1', handNumber: 2,
      lastAction: { ...action, reasoning: 'never copy this', holeCards: ['As', 'Ah'] },
      recentChat: { ...chat, ownerId: 'never copy this' },
    }]);
    expect(felt.lastAction).toEqual(action);
    expect(felt.recentChat).toEqual(chat);
  });

  it('never invents movement or speech on old, malformed, or other-hand snapshots', () => {
    const [old, wrongHand, broken] = normalizeFelts([
      { tableId: 'old' },
      { tableId: 'other', handNumber: 3, lastAction: action },
      { tableId: 'bad', handNumber: 2, lastAction: { ...action, seat: -1 }, recentChat: { ...chat, text: null } },
    ]);
    expect(old.lastAction).toBeNull();
    expect(old.recentChat).toBeNull();
    expect(wrongHand.lastAction).toBeNull();
    expect(broken.lastAction).toBeNull();
    expect(broken.recentChat).toBeNull();
  });
});
