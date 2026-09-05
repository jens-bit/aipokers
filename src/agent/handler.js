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
import { complete, isConfigured, providerIdFor } from './providers/index.js';
import { costOf, formatUsd } from './providers/pricing.js';
import { formatOpponentRead } from './reads.js';
import { perceiveEquity } from './attributes.js';
import { voiceLine, VOICE_MAX_WORDS } from './voice.js';
import { moodBriefingHint } from './mood.js';

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

The "reasoning" field is what you SAY, out loud, at the table — it is printed
under your face while your owner watches you play, and it is the only thing he
hears from you during a hand.

Say it the way a player at the table would, in your own character:
  "Ace-ten. Fine. Let's see who's home."
  "He's missed this flop twice already."
  "Nothing here. Away it goes."

NEVER write poker theory. No bet sizes in blinds, no percentages, no "range",
no "equity", no "pot odds", no "GTO", no "+EV", no "c-bet", no "standard", no
"line", no "villain", no "hero". A sentence like "tight aggressive line—open
3bb standard" is exactly wrong: that is a solver talking, and nobody wants to
watch a solver. Talk about the hand, the opponent, or the moment.

Maximum ${VOICE_MAX_WORDS} words. One sentence or two short ones.`;
}

// What he THINKS the maths are, as opposed to what they are.
//
// Exported because two callers need the identical number: this module, which
// writes it into the briefing, and table.js, which records it on the decision
// so the hand review can say afterwards that he misjudged the spot and by how
// much. Recomputing it in two places with two seeds would let the review
// disagree with the hand it is reviewing.
//
// The seed is the hand, the seat and the cards — never a clock and never a
// counter — so the arena's mirrored deck draws the same misjudgment on both
// halves, and a replayed hand misjudges it the same way twice.
export function perceivedMath(gs) {
  const seed = `${gs?.handNumber ?? 0}:${gs?.seat ?? 0}:${gs?.street}:${(gs?.holeCards ?? []).join('')}:${(gs?.community ?? []).join('')}`;
  const focus = gs?.attrs?.FOCUS ?? null;
  return {
    seed,
    equity:  perceiveEquity(gs?.equity,  focus, `${seed}:eq`),
    potOdds: perceiveEquity(gs?.potOdds, focus, `${seed}:po`),
  };
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
  const { equity: seenEquity, potOdds: seenPotOdds } = perceivedMath(gs);

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
    // MOOD-2d: the briefing reads heat, not just the band. A 62 and a 94 are
    // both "tilted" and should not be told the same thing.
    const hint = moodBriefingHint(gs.mood);
    const heat = Number.isFinite(gs.mood.heat) ? ` (heat ${gs.mood.heat})` : '';
    moodLine = `\nSTATE: ${gs.mood.state}${heat}${cause}.${hint}`;
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
    const rawReasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
    const action = validateAction(actionType, amount, gs);

    // PACE-1c: the prompt asks for his voice; this guarantees it. A line that
    // reads as solver output is replaced with a template one in his register
    // rather than shown, and everything is capped at twelve words. The
    // structured fields (equity, potOdds) are untouched — this is only the
    // sentence a person reads.
    const spoken = voiceLine(rawReasoning, { holeCards: gs.holeCards, action });
    if (spoken.reason === 'solver speak') {
      console.log(`[agent] solver speak rejected: "${rawReasoning.slice(0, 60)}"`);
    }

    return { action, reasoning: spoken.line };
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
export async function getAgentAction(gameState, strategy, memoryContext = '', opts = {}) {
  // MODEL-1: the model and provider are per call now, defaulting to the env
  // exactly as before. table.js passes neither and behaves identically; the
  // arena passes a model per seat so a mirror can pit two of them.
  const model = opts.model || MODEL;
  const provider = opts.provider || null;

  if (!isConfigured(model, provider)) {
    console.error(`[agent] ${providerIdFor(model, provider)} not configured for ${model} — using safe fallback`);
    return {
      action: gameState.canCheck ? { type: 'check' } : { type: 'fold' },
      reasoning: 'no API key configured — defaulting to a safe action',
    };
  }

  const system = buildSystem(strategy, memoryContext);
  const userPrompt = buildUserPrompt(gameState);

  console.log(`[agent] ${gameState.street} — pot ${gameState.pot}, calling ${model}...`);
  console.log(`[agent] system prompt (first 200): ${system.slice(0, 200).replace(/\s+/g, ' ')}`);
  try {
    const res = await complete({
      model,
      provider,
      system,
      // Reasoning string takes some tokens; keep it tight but not starved.
      maxTokens: 200,
      messages: [{ role: 'user', content: userPrompt }],
      timeoutMs: 9000,
      transport: opts.transport ?? null,
    });

    const { action, reasoning } = parseDecision(res.text, gameState);
    // MODEL-1b: every decision carries its cost. The usage is returned as well
    // as logged so the arena can total it without scraping stdout.
    const { inputTokens: inp, outputTokens: out, cachedInputTokens: cached } = res.usage;
    const usd = costOf(res.usage, model, res.provider);
    console.log(
      `[agent] → ${JSON.stringify(action)}  ` +
      `(${res.provider}/${model} in:${inp} out:${out} cached:${cached} ${formatUsd(usd, 6)})`,
    );
    return { action, reasoning, usage: res.usage, model, provider: res.provider, costUsd: usd };
  } catch (err) {
    console.error('[agent] API error:', err.message);
    return {
      action: gameState.canCheck ? { type: 'check' } : { type: 'fold' },
      reasoning: `api error fallback (${err.message.slice(0, 60)})`,
    };
  }
}
