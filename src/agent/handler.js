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
//
// Public return shape: { action, reasoning } where `reasoning` is a
// one-sentence explanation produced by the model alongside the decision.

import Anthropic from '@anthropic-ai/sdk';
import { formatOpponentRead } from './reads.js';
import { perceiveEquity } from './attributes.js';

// claude-haiku-4-5 for low-latency game decisions; override via AI_MODEL env var.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';

const DEFAULT_STRATEGY =
  'You are a solid, balanced poker player. Play tight-aggressive: ' +
  'fold weak hands preflop, value-bet strong hands, protect big pots, ' +
  'and bluff occasionally in position on dry boards.';

// Build the system prompt (strategy + memory + output contract). Stays stable
// per (strategy, memoryContext) so it benefits from prompt caching across
// multiple hands until the memory next refreshes.
function buildSystem(strategy, memoryContext = '') {
  return `${strategy || DEFAULT_STRATEGY}${memoryContext || ''}

You are playing No-Limit Texas Hold'em poker.
Respond with ONLY a single-line JSON object — no prose outside the JSON, no markdown.

JSON format (the "amount" key is required for bet/raise, omit otherwise):
{"action":{"type":"<fold|check|call|bet|raise>","amount":<integer>},"reasoning":"<one short sentence>"}

For bet/raise, "amount" is the TOTAL chips you want committed this street
(your existing contribution plus any additional you're putting in now).

The "reasoning" field is required for every decision: one punchy sentence,
max 12 words, why you made this specific decision right now.`;
}

// Short in-prompt hint tied to a mood state. Kept bounded per Mood Design
// Law — flavor/voice cue for the model, not a rule change.
function moodPromptHint(state) {
  switch (state) {
    case 'confident':  return ' You are running well — stay assertive.';
    case 'frustrated': return ' You may play a touch looser and defend more aggressively — do NOT abandon your range.';
    case 'tilted':     return ' You are steaming — size a hair larger and be quicker to deviate, but keep your range intact.';
    case 'sulking':    return ' You have shut down a little — tighten sizings and stick close to the script.';
    default:           return '';
  }
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

  // ATTR-1 hook — FOCUS is math precision. What goes in the briefing is his
  // PERCEPTION of the equity, not the equity: σ = 0.08 at FOCUS 0, 0 at 100,
  // and below FOCUS 35 the number is rounded to the nearest 5% as well. The
  // noise is deterministic in a seed built from the hand, the seat and the
  // cards, so the arena's mirrored deck draws the same misjudgment on both
  // halves and the A/B stays clean. Inert without gs.attrs or at IMPACT 0.
  const seed = `${gs.handNumber ?? 0}:${gs.seat ?? 0}:${gs.street}:${(gs.holeCards ?? []).join('')}:${(gs.community ?? []).join('')}`;
  const focus = gs.attrs?.FOCUS ?? null;
  const seenEquity  = perceiveEquity(gs.equity,  focus, `${seed}:eq`);
  const seenPotOdds = perceiveEquity(gs.potOdds, focus, `${seed}:po`);

  const mathLines = [];
  if (Number.isFinite(seenEquity)) {
    mathLines.push(`EQUITY: ~${(seenEquity * 100).toFixed(1)}% vs random hand`);
  }
  if (Number.isFinite(seenPotOdds)) {
    mathLines.push(`POT ODDS: need ${(seenPotOdds * 100).toFixed(1)}% to call`);
  }
  if (Number.isFinite(gs.spr)) {
    mathLines.push(`SPR: ${gs.spr.toFixed(1)}`);
  }
  const mathBlock = mathLines.length > 0 ? `\n${mathLines.join('\n')}` : '';

  // Policy briefing block — advisory scaffolding produced by the server.
  // Preflop range verdict, server-rolled bluff die, sizing hints, and a
  // running raise counter so the LLM doesn't stack min-raises into eternity.
  const policyLines = [];
  if (gs.policy?.range && gs.street === 'preflop') {
    const r = gs.policy.range;
    policyLines.push(
      `RANGE: this hand is ${r.inRange ? 'INSIDE' : 'OUTSIDE'} your preflop range` +
      ` (top ~${r.targetVpip}%; hand percentile ${r.percentile})`,
    );
  }
  if (gs.policy?.dice) {
    policyLines.push(
      `BLUFF DIE: ${gs.policy.dice.bluffDie ? 'YES — if a credible bluff line exists, take it' : 'NO — do not bluff this decision'}`,
    );
  }
  if (gs.policy?.sizing?.text) {
    policyLines.push(`SIZING: ${gs.policy.sizing.text}`);
  }
  if (Number.isInteger(gs.raisesThisStreet)) {
    const anti = gs.raisesThisStreet >= 2
      ? ' — no more small reraises this street; call, fold, or jam'
      : '';
    policyLines.push(`RAISES THIS STREET: ${gs.raisesThisStreet}${anti}`);
  }
  const policyBlock = policyLines.length > 0 ? `\n${policyLines.join('\n')}` : '';

  // Mood state — only shown when non-neutral. Bounded: cannot change the
  // range verdict; may shift the deviation die + a small sizing hint.
  let moodLine = '';
  if (gs.mood && gs.mood.state && gs.mood.state !== 'neutral') {
    const cause = gs.mood.cause ? ` — ${gs.mood.cause}` : '';
    const hint = moodPromptHint(gs.mood.state);
    moodLine = `\nSTATE: ${gs.mood.state}${cause}.${hint}`;
  }

  // TLK-1: table talk needle — queued by _maybeSendAgentTalk when an opponent's
  // line lands on a susceptible agent. Cleared after each decision.
  const tableTalkLine = gs.tableTalk
    ? `\nTABLE TALK: "${gs.tableTalk}" — an opponent just said this at the table.`
    : '';

  // Opponent reads (deterministic, from the last-N-hands ring in
  // opponentStats), rendered by src/agent/reads.js. Each read yields the stat
  // line plus an explicit EXPLOIT directive for the shape it describes.
  //
  // The directive is the point. Handing the model raw percentages and hoping
  // it derives the counter-strategy produced the opposite of one: reads-on
  // TAG folded 57% against a Calling Station versus 31% with reads off, and
  // gave up two thirds of its edge. See reads.js for the full autopsy.
  //
  // ATTR-1 hook — READS decides how thin a sample he will act on and whether
  // he gets the EXPLOIT directive at all; the subject's own DECEPTION (carried
  // on the read as subjectDeception) pushes that sample back up.
  const readLines = [];
  if (Array.isArray(gs.opponentReads)) {
    for (const r of gs.opponentReads) {
      readLines.push(...formatOpponentRead(r, { reads: gs.attrs?.READS ?? null, deception: r.subjectDeception ?? null }));
    }
  }
  const readsBlock = readLines.length > 0 ? `\n${readLines.join('\n')}` : '';

  return `STREET: ${gs.street.toUpperCase()}
HOLE CARDS: ${gs.holeCards.join(' ')}
BOARD: ${board}
POT: ${gs.pot}  MY STACK: ${gs.myStack}  OPP STACK: ${gs.oppStack}
MY CONTRIB THIS STREET: ${gs.myContrib}
POSITION: ${gs.position}  BLINDS: ${gs.sb}/${gs.bb}${mathBlock}${policyBlock}${moodLine}${tableTalkLine}${readsBlock}
LEGAL ACTIONS: ${actions.join(' | ')}

The math and policy lines above are ADVISORY server hints, not commands.
Weigh them; deviate when your strategy calls for it, and say why briefly.

An EXPLOIT line is different: it is the counter-strategy for how this specific
opponent has actually been playing, measured over real hands. Follow it. In
particular, a high showdown percentage means he PAYS OFF your value bets — it
is never a reason to fold more.

Reminder: for bet/raise the "amount" field is total chips committed this street.
Respond with the JSON object including both "action" and "reasoning".
Decision:`;
}

// Coerce a parsed action+amount into a validated game action, with safe fallbacks.
function validateAction(actionType, amount, gs) {
  const safe = gs.canCheck ? { type: 'check' } : { type: 'call' };
  switch (actionType) {
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
      console.warn(`[agent] unknown action "${actionType}" → safe`);
      return safe;
  }
}

// Parse the model's text output into { action, reasoning }.
function parseDecision(text, gs) {
  const safeAction = gs.canCheck ? { type: 'check' } : { type: 'call' };
  try {
    const json = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(json);

    // Accept the new format { action: { type, amount }, reasoning } as well as
    // the legacy flat form { action: "type", amount, reasoning }.
    let actionType;
    let amount;
    if (parsed.action && typeof parsed.action === 'object') {
      actionType = parsed.action.type;
      amount = parsed.action.amount;
    } else {
      actionType = parsed.action;
      amount = parsed.amount;
    }
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    return { action: validateAction(actionType, amount, gs), reasoning };
  } catch (err) {
    console.warn('[agent] parse failed:', err.message, '| raw:', text.slice(0, 80));
    return { action: safeAction, reasoning: 'parse failure — defaulting to a safe action' };
  }
}

// ── Chat trash-talk ──────────────────────────────────────────────────────────

// Strip surrounding double or single quotes (the model often wraps the line).
function stripWrappingQuotes(s) {
  if (!s) return s;
  const trimmed = s.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function buildSituationLine(trigger, pot, streetLabel, opponentName) {
  switch (trigger) {
    case 'aggressive_action':
      return `You just fired a big bet/raise into a ${pot}-chip pot on the ${streetLabel}. ` +
             `Reference the size of the move and apply pressure to ${opponentName}.`;
    case 'won_hand':
      return `You just dragged a ${pot}-chip pot away from ${opponentName}. Reference winning — twist the knife.`;
    case 'big_pot':
      return `The pot has ballooned to ${pot} chips on the ${streetLabel} between you and ${opponentName}. ` +
             `Reference the stakes and crank up the pressure.`;
    case 'human_chat':
      return `${opponentName} just spoke at you. Respond to what they actually said.`;
    default:
      return `Something noteworthy happened on the ${streetLabel} (pot ${pot}) between you and ${opponentName}.`;
  }
}

// Generate a short, contextual trash-talk / psychological line.
// Returns null on missing API key or any error — caller must handle null.
//
// Options:
//   trigger          — 'big_pot' | 'aggressive_action' | 'won_hand' | 'human_chat'
//   agentName        — the AI's display name at the table
//   opponentName     — the most relevant opponent's display name
//   agentStyle       — the agent's full personality / strategy string
//   potSize          — current pot in chips
//   street           — current street string ('preflop' | 'flop' | 'turn' | 'river' | 'showdown')
//   lastOpponentChat — optional last message from another seat; if present, the
//                      agent should respond to it directly so AI vs AI tables
//                      have actual back-and-forth.
export async function generateAiChatLine({
  trigger,
  agentName,
  opponentName,
  agentStyle,
  potSize,
  street,
  lastOpponentChat = null,
} = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const personality = (agentStyle && String(agentStyle).trim()) || DEFAULT_STRATEGY;
  const myName = (agentName && String(agentName).trim()) || 'you';
  const oppName = (opponentName && String(opponentName).trim()) || 'your opponent';
  const pot = Number.isFinite(potSize) ? potSize : 0;
  const streetLabel = (street ?? 'preflop').toString().toUpperCase();
  const situation = buildSituationLine(trigger, pot, streetLabel, oppName);

  const systemText =
    `You are ${myName}, a poker player at a live table playing against ${oppName}. ` +
    `Write ONE short, in-character line of trash-talk or psychological pressure (1 sentence, max 120 chars).\n\n` +
    `Your personality / strategy:\n${personality}\n\n` +
    `Tone rules — match your personality to one of these registers:\n` +
    `- AGGRESSIVE personalities: taunt openly. Be cocky, mocking, in-your-face.\n` +
    `- TIGHT / DISCIPLINED personalities: cold, clipped, dismissive — fewer words, no exclamation.\n` +
    `- BALANCED / CALCULATED personalities: confident, surgical, knowing — the kind of line that gets in someone's head.\n\n` +
    `Hard rules:\n` +
    `- Reference the actual game event in the situation: the bet, the pot, or winning the hand.\n` +
    `- Use ${oppName}'s name at least sometimes (not every line — varies).\n` +
    `- ONE sentence MAX. No hashtags. No emojis unless they fit the personality.\n` +
    `- BANNED generic phrases: "nice hand", "good game", "well played", "you got lucky", "gg", "wp". ` +
    `If you catch yourself writing one, rewrite the line.\n` +
    `- Output the line directly — no quotes, no preamble, no "Here's my line:".`;

  let userText =
    `SITUATION: ${situation}\n` +
    `STREET: ${streetLabel}\n` +
    `POT: ${pot}\n` +
    `OPPONENT: ${oppName}\n` +
    `YOU: ${myName}`;
  if (lastOpponentChat) {
    userText +=
      `\n\n${oppName} just said: "${String(lastOpponentChat).slice(0, 200)}"\n` +
      `Respond DIRECTLY to that message — engage with what they said, don't ignore it.`;
  }
  userText += `\n\nWrite your line:`;

  try {
    const client = new Anthropic({ timeout: 9000 });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userText }],
    });
    const raw = msg.content[0]?.text ?? '';
    const line = stripWrappingQuotes(raw).slice(0, 280);
    return line || null;
  } catch (err) {
    console.error('[agent] chat generation error:', err.message);
    return null;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
// gameState is built by Table._buildAiGameState(seat) and already validated.
// memoryContext (optional) is the agent's persistent self-knowledge, formatted
// by getAgentMemoryContext(). It is concatenated onto the strategy.
// Returns { action: { type, amount? }, reasoning: string }.
export async function getAgentAction(gameState, strategy, memoryContext = '') {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[agent] ANTHROPIC_API_KEY not set — using safe fallback');
    return {
      action: gameState.canCheck ? { type: 'check' } : { type: 'fold' },
      reasoning: 'no API key configured — defaulting to a safe action',
    };
  }

  const client = new Anthropic({ timeout: 9000 });
  const system = buildSystem(strategy, memoryContext);
  const userPrompt = buildUserPrompt(gameState);

  console.log(`[agent] ${gameState.street} — pot ${gameState.pot}, calling ${MODEL}...`);
  console.log(`[agent] system prompt (first 200): ${system.slice(0, 200).replace(/\s+/g, ' ')}`);
  try {
    const msg = await client.messages.create({
      model: MODEL,
      // Reasoning string takes some tokens; keep it tight but not starved.
      max_tokens: 200,
      // Cache the system prompt (strategy + format contract) across hands.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content[0]?.text ?? '';
    const { action, reasoning } = parseDecision(text, gameState);
    const { input_tokens: inp, output_tokens: out, cache_read_input_tokens: cached = 0 } = msg.usage;
    console.log(`[agent] → ${JSON.stringify(action)}  (in:${inp} out:${out} cached:${cached})`);
    return { action, reasoning };
  } catch (err) {
    console.error('[agent] API error:', err.message);
    return {
      action: gameState.canCheck ? { type: 'check' } : { type: 'fold' },
      reasoning: `api error fallback (${err.message.slice(0, 60)})`,
    };
  }
}
