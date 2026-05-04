// src/agent/handler.js
// Anthropic-powered poker agent. Called by Table when it's an AI seat's turn.
//
// Game-engine contract (from game.js):
//   act(seat, { type, amount? })
//   type: 'fold' | 'check' | 'call' | 'bet' | 'raise'
//   amount (bet/raise): TOTAL chips committed this street (not additional).
//
// legalActions contract:
//   FOLD  → { type: 'fold' }
//   CHECK → { type: 'check' }
//   CALL  → { type: 'call', amount: <additional chips> }
//   BET   → { type: 'bet',  min: <total>, max: <total> }
//   RAISE → { type: 'raise', min: <total>, max: <total> }

import Anthropic from '@anthropic-ai/sdk';

// claude-haiku-4-5 for low-latency game decisions; override via AI_MODEL env var.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';

const DEFAULT_STRATEGY =
  'You are a solid, balanced poker player. Play tight-aggressive: ' +
  'fold weak hands preflop, value-bet strong hands, protect big pots, ' +
  'and bluff occasionally in position on dry boards.';

// Build the system prompt (strategy + output contract). Stays stable per strategy
// so it benefits from prompt caching across multiple hands.
function buildSystem(strategy) {
  return `${strategy || DEFAULT_STRATEGY}

You are playing heads-up No-Limit Texas Hold'em poker.
Respond with ONLY a single-line JSON object — no explanation, no markdown, no newlines.

Valid responses:
  {"action":"fold"}
  {"action":"check"}
  {"action":"call"}
  {"action":"bet","amount":<integer>}
  {"action":"raise","amount":<integer>}

For bet/raise, "amount" is the TOTAL chips you want committed this street
(your existing contribution plus any additional you're putting in now).`;
}

// Build the per-turn user message describing the current game state.
function buildUserPrompt(gs) {
  const board = gs.community.length > 0 ? gs.community.join(' ') : 'none (preflop)';
  const actions = [];
  if (gs.canCheck) {
    actions.push('check');
    if (gs.canBet)   actions.push(`bet (amount ${gs.minBet}–${gs.maxBet} total this street)`);
    if (gs.canRaise) actions.push(`raise (amount ${gs.minRaise}–${gs.maxRaise} total this street)`);
  } else {
    actions.push(`call (costs ${gs.toCall} chips)`);
    if (gs.canRaise) actions.push(`raise (amount ${gs.minRaise}–${gs.maxRaise} total this street)`);
  }
  actions.unshift('fold');

  return `STREET: ${gs.street.toUpperCase()}
HOLE CARDS: ${gs.holeCards.join(' ')}
BOARD: ${board}
POT: ${gs.pot}  MY STACK: ${gs.myStack}  OPP STACK: ${gs.oppStack}
MY CONTRIB THIS STREET: ${gs.myContrib}
POSITION: ${gs.position}  BLINDS: ${gs.sb}/${gs.bb}
LEGAL ACTIONS: ${actions.join(' | ')}

Reminder: for bet/raise the "amount" field is total chips committed this street.
Decision:`;
}

// Parse the model's text output into a validated game action.
function parseAction(text, gs) {
  const safe = gs.canCheck ? { type: 'check' } : { type: 'call' };
  try {
    const json = text.replace(/```json\n?|```\n?/g, '').trim();
    const { action, amount } = JSON.parse(json);

    switch (action) {
      case 'fold':
        return { type: 'fold' };

      case 'check':
        if (!gs.canCheck) {
          console.warn('[agent] illegal check (there is a bet) → call');
          return { type: 'call' };
        }
        return { type: 'check' };

      case 'call':
        if (gs.canCheck) {
          console.warn('[agent] unnecessary call (nothing to call) → check');
          return { type: 'check' };
        }
        return { type: 'call' };

      case 'bet':
        if (gs.canBet && Number.isFinite(amount)) {
          return { type: 'bet', amount: Math.max(gs.minBet, Math.min(gs.maxBet, Math.round(amount))) };
        }
        console.warn('[agent] illegal bet → safe');
        return safe;

      case 'raise':
        if (gs.canRaise && Number.isFinite(amount)) {
          return { type: 'raise', amount: Math.max(gs.minRaise, Math.min(gs.maxRaise, Math.round(amount))) };
        }
        console.warn('[agent] illegal raise → safe');
        return safe;

      default:
        console.warn(`[agent] unknown action "${action}" → safe`);
        return safe;
    }
  } catch (err) {
    console.warn('[agent] parse failed:', err.message, '| raw:', text.slice(0, 80));
    return safe;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
// gameState is built by Table._buildAiGameState(seat) and already validated.
export async function getAgentAction(gameState, strategy) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[agent] ANTHROPIC_API_KEY not set — using safe fallback');
    return gameState.canCheck ? { type: 'check' } : { type: 'fold' };
  }

  const client = new Anthropic({ timeout: 9000 });
  const system = buildSystem(strategy);
  const userPrompt = buildUserPrompt(gameState);

  console.log(`[agent] ${gameState.street} — pot ${gameState.pot}, calling ${MODEL}...`);
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 60,
      // Cache the system prompt (strategy + format contract) across hands.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content[0]?.text ?? '';
    const action = parseAction(text, gameState);
    const { input_tokens: inp, output_tokens: out, cache_read_input_tokens: cached = 0 } = msg.usage;
    console.log(`[agent] → ${JSON.stringify(action)}  (in:${inp} out:${out} cached:${cached})`);
    return action;
  } catch (err) {
    console.error('[agent] API error:', err.message);
    return gameState.canCheck ? { type: 'check' } : { type: 'fold' };
  }
}
