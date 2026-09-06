// src/agent/handler.js
// The poker agent's decision call. Called by Table when it's an AI seat's turn.
//
// MODEL-1: decisions are no longer hard-wired to Anthropic. They go through
// src/agent/providers, which picks a provider from the model id, so a table can
// be run against any configured model and the arena can put two of them against
// each other. AI_MODEL still names the default; `opts.model` overrides it per
// call. COST-1 removed the one thing in here that still called Anthropic
// directly — see the note where the trash-talk path used to be — so this file
// now has exactly one way of reaching a model, which is the way MODEL-1 built.
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
// Public return shape:
//   { action, reasoning, say, usage, model, provider, costUsd }
// `reasoning` is what he THINKS — one line in his own voice, capped and
// solver-proofed by src/agent/voice.js (PACE-1c), not an explanation of his
// process. MODEL-1b added the last four: every decision carries what it cost,
// returned as well as logged so the arena can total a run without scraping
// stdout. The fallback paths (no key, parse failure, API error) return only
// { action, reasoning } — there was no call, so there is no usage to report.
//
// COST-1 added `say`, and it is optional in both directions: the model may
// omit it, and it is usually null. It is the line he says OUT LOUD, at the
// table, to the other players — as opposed to `reasoning`, which is his read
// and is his owner's alone (AGE-33). It rides this call rather than getting
// one of its own because the model is already holding the whole spot: a
// second request to say something about a hand it has just been shown costs a
// full prompt to learn what it already knew. Trash talk used to be exactly
// that second call (generateAiChatLine, below) and this is what replaces it in
// the moment; handTalk.js writes the rest of it once per hand.

import { complete, isConfigured, providerIdFor } from './providers/index.js';
import { costOf, formatUsd } from './providers/pricing.js';
import { formatOpponentRead } from './reads.js';
import { perceiveEquity } from './attributes.js';
import { voiceLine, capWords, isSolverSpeak, VOICE_MAX_WORDS } from './voice.js';
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

JSON format (the "amount" key is required for bet/raise, omit otherwise;
"say" is optional and usually absent):
{"action":{"type":"<fold|check|call|bet|raise>","amount":<integer>},"reasoning":"<one short sentence>","say":"<optional line spoken aloud>"}

For bet/raise, "amount" is the TOTAL chips you want committed this street
(your existing contribution plus any additional you're putting in now).

The "reasoning" field is what you THINK — it is printed under your face while
your owner watches you play, and only he sees it.

Say it the way a player at the table would, in your own character:
  "Ace-ten. Fine. Let's see who's home."
  "He's missed this flop twice already."
  "Nothing here. Away it goes."

The "say" field is different: it is what you say OUT LOUD, to the other
players, and everybody at the table hears it. LEAVE IT OUT unless this
particular moment actually calls for saying something — a big move, a pot you
have just taken, somebody who has been needling you. A player who comments on
every hand is not a character, he is a chat log. Most of the time you say
nothing, and that is correct.

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
    // RAISE-1: past the cap this is no longer advice. The table has collapsed
    // the offer to call / fold / all-in, so say that plainly rather than
    // leaving the model to notice the raise range has become one number.
    const anti = gs.raiseCapped
      ? ` — THE STREET IS CAPPED at ${gs.raiseCap ?? gs.raisesThisStreet}. Call, fold, or go all-in. There is no smaller raise.`
      : gs.raisesThisStreet >= 2
        ? ' — no more small reraises this street; call, fold, or jam'
        : '';
    policyLines.push(`RAISES THIS STREET: ${gs.raisesThisStreet}${anti}`);
  }
  // RAISE-1: the minimum is the table's, not the engine's — a raise has to move
  // the pot or it is a delay. Stated so the model knows the small size it might
  // have reached for is not on the menu.
  if (!gs.raiseCapped && (gs.canBet || gs.canRaise)) {
    const floor = gs.canBet ? gs.minBet : gs.minRaise;
    if (Number.isFinite(floor) && floor > 0) {
      policyLines.push(`MIN RAISE: ${floor} total this street — the table does not accept smaller.`);
    }
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
Respond with the JSON object including both "action" and "reasoning", and
"say" only if this moment is actually worth speaking into.
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

// COST-1: the optional spoken line. Same two guarantees the reasoning gets —
// no solver talking, capped at twelve words — because it is read by the same
// people in the same place. A line that fails either is DROPPED rather than
// replaced with a template: silence is always a correct thing for a poker
// player to do, and a canned line in the mouth of a model that had something
// specific to say is worse than nothing.
function parseSay(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (isSolverSpeak(cleaned)) {
    console.log(`[agent] solver speak rejected in say: "${cleaned.slice(0, 60)}"`);
    return null;
  }
  const line = capWords(cleaned);
  return line || null;
}

// Parse the model's text output into { action, reasoning, say }.
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

    return { action, reasoning: spoken.line, say: parseSay(parsed.say) };
  } catch (err) {
    console.warn('[agent] parse failed:', err.message, '| raw:', text.slice(0, 80));
    return { action: safeAction, reasoning: 'parse failure — defaulting to a safe action', say: null };
  }
}

// ── Chat trash-talk ──────────────────────────────────────────────────────────
//
// COST-1 removed it. This was the per-remark model call: every trigger — a big
// bet, a pot taken, somebody typing at the table — fired its own Anthropic
// call, with its own full prompt, to produce one sentence about a hand it had
// to be told about from scratch. A lively three-handed table could spend more
// on SAYING things about a hand than on PLAYING it.
//
// The three ways a line gets said now are all somewhere else:
//
//   the `say` field on the decision call above  — free; the model is already
//                                                 holding the whole spot
//   src/agent/policyPlay.js instantLine         — free; a template, for the
//                                                 fold and check that cannot
//                                                 wait
//   src/server/handTalk.js                      — one call per HAND, watched
//                                                 tables only, writing a line
//                                                 for every seat that spoke
//
// The deleted function is not worth keeping behind a flag: everything it did
// is done better and cheaper by those three, and a dead export is a thing
// somebody wires back up in six months without reading this paragraph.


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

    const { action, reasoning, say } = parseDecision(res.text, gameState);
    // MODEL-1b: every decision carries its cost. The usage is returned as well
    // as logged so the arena can total it without scraping stdout.
    const { inputTokens: inp, outputTokens: out, cachedInputTokens: cached } = res.usage;
    const usd = costOf(res.usage, model, res.provider);
    console.log(
      `[agent] → ${JSON.stringify(action)}  ` +
      `(${res.provider}/${model} in:${inp} out:${out} cached:${cached} ${formatUsd(usd, 6)})`,
    );
    return { action, reasoning, say, usage: res.usage, model, provider: res.provider, costUsd: usd };
  } catch (err) {
    console.error('[agent] API error:', err.message);
    return {
      action: gameState.canCheck ? { type: 'check' } : { type: 'fold' },
      reasoning: `api error fallback (${err.message.slice(0, 60)})`,
    };
  }
}
