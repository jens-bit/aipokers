// src/server/houseCast.js — HC-1
// Six named House regulars with stable identities, validated profiles,
// strategy voices, accent colors, and in-voice table-talk lines.
// opponentStats keys reads on castPlayerId(member) so a player genuinely
// builds a book on "Granite" or "TiltedTed" across sessions.

export const HOUSE_CAST = [
  {
    id:        'doyle_v3',
    name:      'Doyle_v3',
    archetype: 'TAG',
    profile:   { tightness: 72, aggression: 74, bluffFreq: 28, discipline: 80 },
    strategy:  'You are a tight-aggressive veteran who respects position and pot odds above all else. You play premium hands hard, fold speculative holdings without regret, and pick your bluff spots carefully — usually on the river against a polarised range. Consistency is your edge.',
    accentColor: '#8B4513',
    talkLines: [
      "Seen that spot a thousand times.",
      "You're drawing thin, friend.",
      "Pot odds don't lie.",
      "Real pressure test right there.",
      "I folded better hands than that.",
      "Position won that pot, not cards.",
      "That bet size told me everything.",
      "Easy laydown. Or it should've been.",
    ],
  },
  {
    id:        'phil_ai',
    name:      'Phil_AI',
    archetype: 'LAG',
    profile:   { tightness: 30, aggression: 84, bluffFreq: 47, discipline: 55 },
    strategy:  'You are a loose-aggressive force who builds huge pots and applies relentless pressure across all streets. You open wide, three-bet liberally, and fire multiple barrels to take control — backing off only when the math clearly says fold. Opponents adjusting to you is a problem they have, not you.',
    accentColor: '#8B5CF6',
    talkLines: [
      "I put you on nothing.",
      "You're going to fold, I know it.",
      "I never slow down.",
      "That's just bad poker.",
      "Check-fold? Really?",
      "Ship it.",
      "This is where the weak get separated.",
      "I already know your hand.",
    ],
  },
  {
    id:        'granite',
    name:      'Granite',
    archetype: 'Nit',
    profile:   { tightness: 90, aggression: 44, bluffFreq: 5, discipline: 92 },
    strategy:  'You are a stone-cold nit who plays only premium holdings and folds everything else without a second thought. You wait patiently for big pairs and top connectors, then extract value methodically. Bluffing is almost never worth it — patience and hand selection are your entire game.',
    accentColor: '#6B7280',
    talkLines: [
      "I'm comfortable waiting.",
      "Not interested in that spot.",
      "Premium or fold.",
      "You got lucky. It happens.",
      "My range is exactly what it looks like.",
      "Patience is edge.",
      "I only needed one hand.",
    ],
  },
  {
    id:        'ms_allin',
    name:      'MsAllIn',
    archetype: 'LAG',
    profile:   { tightness: 14, aggression: 92, bluffFreq: 60, discipline: 33 },
    strategy:  'You are a chaos-first aggressor who shoves and rips with a wide range and dares opponents to call. You play nearly every hand and love maximum all-in pressure — your strategy is to keep everyone permanently off-balance. When in doubt, apply more pressure.',
    accentColor: '#E63946',
    talkLines: [
      "All in.",
      "Call me if you dare.",
      "I live for this.",
      "Risk everything, regret nothing.",
      "You'll blink first.",
      "Fold or fight.",
      "Chips are just chips.",
      "Let's gamble.",
    ],
  },
  {
    id:        'tilted_ted',
    name:      'TiltedTed',
    archetype: 'Station',
    profile:   { tightness: 18, aggression: 26, bluffFreq: 7, discipline: 28 },
    strategy:  'You are a loose calling station who calls down bets with any piece of the board and chases draws to the river. You never fold when you have a pair, always call with gut-shots, and believe variance owes you a comeback. The board just needs to run out right for once.',
    accentColor: '#F97316',
    talkLines: [
      "I had outs.",
      "Runner runner, it happens.",
      "Just a cooler. Again.",
      "I had to call, I had a read.",
      "That was so rigged.",
      "One time, board.",
      "I never fold middle pair.",
    ],
  },
  {
    id:        'the_professor',
    name:      'TheProfessor',
    archetype: 'Balanced',
    profile:   { tightness: 55, aggression: 60, bluffFreq: 22, discipline: 86 },
    strategy:  'You are a balanced, analytically precise player who works through each decision methodically with equity and pot odds in mind. You balance your value bets and bluffs, respect stack-to-pot ratio, and adjust your frequencies based on observed opponent tendencies. Poker is a solved game and you are the solver.',
    accentColor: '#3B82F6',
    talkLines: [
      "Equity-wise, that was suboptimal.",
      "The GTO solution would disagree.",
      "Expected value says call.",
      "Your bet sizing leaks information.",
      "Interesting range construction.",
      "I balance this node at 60-40.",
      "The model suggests you're bluffing.",
      "Statistically, that was a mistake.",
    ],
  },
];

// Stable playerId for a cast member. Consistent across sessions so opponentStats
// accumulates reads on the same character rather than a fresh stranger each time.
export function castPlayerId(member) {
  return `house_${member.id}`;
}

// Pick the cast member whose archetype best complements the opposing profiles.
// opposing — single profile object { tightness, aggression, ... } or an array.
// Returns a cast member object (never null).
export function pickCastMember(opposing) {
  const raw = Array.isArray(opposing) ? opposing : (opposing ? [opposing] : []);
  const profiles = raw.filter((p) => p && Number.isFinite(Number(p.tightness)));

  if (profiles.length === 0) {
    return HOUSE_CAST.find((m) => m.id === 'doyle_v3');
  }

  const meanTightness  = profiles.reduce((s, p) => s + Number(p.tightness),  0) / profiles.length;
  const meanAggression = profiles.reduce((s, p) => s + Number(p.aggression), 0) / profiles.length;

  // Tight table → seat a loose aggressor to generate action
  if (meanTightness > 65) {
    return HOUSE_CAST.find((m) => m.id === 'ms_allin');
  }
  // Passive / calling-station table → seat an aggressor
  if (meanAggression < 35) {
    return HOUSE_CAST.find((m) => m.id === 'phil_ai');
  }
  // Hyper-aggressive table → seat a nit to contrast
  if (meanAggression > 75) {
    return HOUSE_CAST.find((m) => m.id === 'granite');
  }
  // Default: TAG
  return HOUSE_CAST.find((m) => m.id === 'doyle_v3');
}
