// client/src/test/fixtures/flagged.js — TEST-1
//
// GET /api/agents/:id/flagged, whose entries come from buildFlaggedEntry in
// src/server/flaggedHands.js:
//   { flagType, handNumber, pot, holeCards, opponentShowdownCards, won,
//     streets: [{ street, board, action, equity, potOdds, reasoning }],
//     flaggedAt }
// equity and potOdds are INTEGER percents here (the classifier rounds the
// 0..1 fractions the wire carries), and opponentShowdownCards is public
// information — cards actually turned over at showdown.

export const badBeatHand = {
  flagType: 'badBeat',
  handNumber: 37,
  pot: 1840,
  holeCards: ['Ah', 'Ad'],
  opponentShowdownCards: [{ seat: 1, holeCards: ['9c', '9d'] }],
  won: false,
  streets: [
    {
      street: 'preflop',
      board: [],
      action: 'raise 120',
      equity: 81,
      potOdds: 22,
      reasoning: 'Aces. Building the pot while I am this far ahead.',
    },
    {
      street: 'flop',
      board: ['2s', '7h', 'Kd'],
      action: 'bet 260',
      equity: 88,
      potOdds: null,
      reasoning: 'Dry board, still the best hand. Charging the draws.',
    },
    {
      street: 'river',
      board: ['2s', '7h', 'Kd', '4c', '9s'],
      action: 'call 900',
      equity: 6,
      potOdds: 33,
      reasoning: 'He got there. I called anyway and I should not have.',
    },
  ],
  flaggedAt: 1788608983516,
};

export const bigBluffHand = {
  flagType: 'bigBluff',
  handNumber: 41,
  pot: 620,
  holeCards: ['7c', '2d'],
  opponentShowdownCards: [],
  won: true,
  streets: [
    {
      street: 'river',
      board: ['Ah', 'Ks', '4d', '8c', 'Qh'],
      action: 'raise 400',
      equity: 4,
      potOdds: null,
      reasoning: 'Nothing. But the board says I have it and he does not.',
    },
  ],
  flaggedAt: 1788609100000,
};

export const flaggedResponse = { flaggedHands: [badBeatHand, bigBluffHand] };
