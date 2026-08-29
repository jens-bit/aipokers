import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { telegramAuthMiddleware } from './auth.js';
import { rateLimiter } from './rateLimit.js';
import { normalizeProfile, inferProfileFromStyleRisk } from '../agent/policy.js';
import {
  initialMood,
  ensureMood,
  applyEvent as applyMoodEvent,
  tickDecay as tickMoodDecay,
  applyPepTalk as applyMoodPepTalk,
  isSoothable as isMoodSoothable,
} from '../agent/mood.js';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

// ── Persistence ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'agents.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let store = {};
try {
  store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  store = {};
}

function saveStore(userId) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  const agents = store[userId]?.agents ?? [];
  console.log(`[agents] saved profile for ${userId} — ${agents.length} agent(s)`);
}

function getOrCreate(userId) {
  if (!store[userId]) {
    store[userId] = {
      userId,
      agents: [],
      chat: [{ role: 'assistant', content: OPENING_MSG }],
    };
  }
  return store[userId];
}

// ── In-memory active table tracking ─────────────────────────────────────────

const activeTables = new Set();

// ── Matchmaking queue (single slot, 5-min TTL) ───────────────────────────────
// { tableId, expiresAt }
let matchmakingSlot = null;

// ── Conversation constants ───────────────────────────────────────────────────

const OPENING_MSG = "Hi! I'm your poker strategy assistant. Describe how you want your agent to play and I'll help build it with you.";

const SYSTEM_CONV = `You are a poker strategy assistant helping a user design their AI poker agent for heads-up No-Limit Texas Hold'em. Be brief and casual — 1-2 sentences max. Ask ONE specific follow-up question to understand their intent better before building the agent.

If the user is vague or uses slang (e.g. 'be retarded', 'go crazy', 'be stupid'), ask what they mean in poker terms — e.g. do they mean random raises? calling everything? never folding?

Never say things like 'I appreciate you reaching out' or 'Great choice!'. Be direct and poker-focused.

After the user has clarified once, say: 'Got it — building your agent now.' and set createdAgent.`;

const SYSTEM_GEN = `Based on the conversation, output ONLY valid JSON — no markdown, no explanation, nothing else: {"name":"<name the agent something a poker player would recognise — draw from poker culture, casino life, card game lore, or player archetypes. Examples: 'The Clock', 'River Rat', 'Stone Cold', 'The Grinder', 'Table Captain', 'Check-Raiser', 'The Nit', 'Big Slick', 'Broadway', 'Dead Money', 'Felt Burner', 'The Sheriff', 'Chip Leader', 'Slow Roll'. Two words max. No geography, no weather, no science. Generate a different name each time.>","style":"<Aggressive|Balanced|Tight>","risk":"<High|Medium|Low>","strategy":"<2-3 sentence strategy in second person starting with 'You are...' — this becomes the agent's poker system prompt>","tightness":<0-100 integer; 0=plays every hand, 100=only premiums>,"aggression":<0-100 integer; 0=passive/never raises, 100=constant bets and raises>,"bluffFreq":<0-100 integer; the % of decisions this agent will bluff on the appropriate street>,"discipline":<0-100 integer; 0=impulsive/deviates constantly, 100=obeys the strategy religiously>}
Calibration hints — pick numbers that MATCH the style and the strategy text you just wrote:
- A tight nit ≈ tightness 85-95, aggression 40-60, bluffFreq 3-10, discipline 80-95.
- A calling station ≈ tightness 10-20, aggression 5-15, bluffFreq 0-5, discipline 30-50.
- A tight-aggressive (TAG) ≈ tightness 65-80, aggression 65-80, bluffFreq 20-35, discipline 70-85.
- A loose-aggressive maniac ≈ tightness 5-20, aggression 90-100, bluffFreq 50-70, discipline 15-30.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Extract a numeric profile from a build/PATCH payload. Falls back to
// inferProfileFromStyleRisk when any of the four sliders are missing so old
// LLM outputs that don't emit the sliders still yield a coherent profile.
function extractProfile(agentData) {
  const raw = {
    tightness:  agentData?.tightness,
    aggression: agentData?.aggression,
    bluffFreq:  agentData?.bluffFreq,
    discipline: agentData?.discipline,
  };
  const hasAll = ['tightness','aggression','bluffFreq','discipline'].every((k) => Number.isFinite(Number(raw[k])));
  if (hasAll) return normalizeProfile(raw);
  const inferred = inferProfileFromStyleRisk(agentData?.style, agentData?.risk);
  return normalizeProfile({
    tightness:  Number.isFinite(Number(raw.tightness))  ? raw.tightness  : inferred.tightness,
    aggression: Number.isFinite(Number(raw.aggression)) ? raw.aggression : inferred.aggression,
    bluffFreq:  Number.isFinite(Number(raw.bluffFreq))  ? raw.bluffFreq  : inferred.bluffFreq,
    discipline: Number.isFinite(Number(raw.discipline)) ? raw.discipline : inferred.discipline,
  });
}

// Update an agent in-place if existingAgentId is set, otherwise push a new one.
function commitAgent(profile, existingAgentId, agentData) {
  let agent = { ...agentData };
  const numericProfile = extractProfile(agentData);
  if (existingAgentId) {
    const existing = profile.agents.find((a) => a.id === existingAgentId);
    if (existing) {
      Object.assign(existing, {
        name: agent.name,
        style: agent.style,
        risk: agent.risk,
        strategy: agent.strategy,
        profile: numericProfile,
      });
      agent = existing;
      console.log(`[agentProfiles] updated agent "${agent.name}" (${agent.style}/${agent.risk}, T${numericProfile.tightness}/A${numericProfile.aggression})`);
      return agent;
    }
  }
  agent.id = 'agent_' + Date.now().toString(36);
  agent.status = 'idle';
  agent.activeTableId = null;
  agent.profile = numericProfile;
  agent.stats = {
    handsPlayed: 0,
    handsWon: 0,
    totalDecisions: 0,
    aggressiveDecisions: 0,
    passiveDecisions: 0,
    foldDecisions: 0,
  };
  agent.recentHands = [];
  agent.memory = {
    summary: '',
    handsObserved: 0,
    tendencies: [],
    lastUpdated: null,
  };
  agent.mood = initialMood();
  profile.agents.push(agent);
  console.log(`[agentProfiles] created agent "${agent.name}" (${agent.style}/${agent.risk}, T${numericProfile.tightness}/A${numericProfile.aggression})`);
  return agent;
}

// Backfill the numeric profile on agents built before this feature. Mirrors
// ensureStats/ensureMemory. Idempotent.
export function ensureProfile(agent) {
  if (agent.profile && Number.isFinite(agent.profile.tightness)) return;
  agent.profile = inferProfileFromStyleRisk(agent.style, agent.risk);
}

// Lazily backfill stats fields for agents that pre-date this feature.
function ensureStats(agent) {
  if (!agent.stats) {
    agent.stats = {
      handsPlayed: 0,
      handsWon: 0,
      totalDecisions: 0,
      aggressiveDecisions: 0,
      passiveDecisions: 0,
      foldDecisions: 0,
    };
  }
  if (!Array.isArray(agent.recentHands)) agent.recentHands = [];
}

// Lazily backfill the memory record for agents created before this feature.
function ensureMemory(agent) {
  if (!agent.memory || typeof agent.memory !== 'object') {
    agent.memory = {
      summary: '',
      handsObserved: 0,
      tendencies: [],
      lastUpdated: null,
    };
  }
  if (!Array.isArray(agent.memory.tendencies)) agent.memory.tendencies = [];
  if (typeof agent.memory.summary !== 'string') agent.memory.summary = '';
  if (!Number.isFinite(agent.memory.handsObserved)) agent.memory.handsObserved = 0;
}

// Aggregate stats across the entire store for the GET /api/stats endpoint.
// O(agents × recentHands) — cheap in practice (≤ 20 hands per agent cap).
export function getProfileStats() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  let totalAgents = 0;
  let handsPlayedToday = 0;
  for (const profile of Object.values(store)) {
    for (const agent of (profile.agents || [])) {
      totalAgents++;
      for (const hand of (agent.recentHands || [])) {
        // TODO: timestamp absent on hands recorded before this field was added — skip those
        if (typeof hand.timestamp === 'number' && hand.timestamp >= todayMs) {
          handsPlayedToday++;
        }
      }
    }
  }
  return { totalAgents, handsPlayedToday };
}

// Compute deterministic self-stats over the agent's rolling recent-hands log.
// Cheap: O(hands * decisionsPerHand). Consumed by the memory system and by
// getAgentMemoryContext so the LLM narrative is anchored to real numbers.
function computeSelfStats(agent) {
  const hands = Array.isArray(agent.recentHands) ? agent.recentHands : [];
  if (hands.length === 0) return null;

  let vpipHands = 0, pfrHands = 0, didNotFoldHands = 0;
  let calls = 0, betsRaises = 0, folds = 0, totalDec = 0;
  let foldedAsEquityFavorite = 0, calledOnPoorOdds = 0, aggThenFolded = 0;

  for (const h of hands) {
    const decs = Array.isArray(h.decisions) ? h.decisions : [];
    if (decs.length === 0) continue;
    let hadVpip = false, hadPfr = false, hadFold = false, hadAgg = false;
    let aggBeforeFold = false;
    for (const d of decs) {
      totalDec++;
      const t = d.action?.type;
      if (t === 'call') calls++;
      if (t === 'bet' || t === 'raise') { betsRaises++; hadAgg = true; }
      if (t === 'fold') { folds++; hadFold = true; if (hadAgg) aggBeforeFold = true; }
      if (d.street === 'preflop' && (t === 'call' || t === 'raise')) hadVpip = true;
      if (d.street === 'preflop' && t === 'raise') hadPfr = true;
      // Leak: folded even though the equity call was in our favor.
      if (t === 'fold' && Number.isFinite(d.equity) && d.equity > 0.55) foldedAsEquityFavorite++;
      // Leak: called with worse equity than the pot odds required.
      if (t === 'call' && Number.isFinite(d.equity) && Number.isFinite(d.potOdds) && d.equity < d.potOdds - 0.02) calledOnPoorOdds++;
    }
    if (hadVpip) vpipHands++;
    if (hadPfr) pfrHands++;
    if (!hadFold) didNotFoldHands++;
    if (aggBeforeFold) aggThenFolded++;
  }

  return {
    handsAnalyzed: hands.length,
    vpip: Number(((vpipHands / hands.length) * 100).toFixed(1)),
    pfr:  Number(((pfrHands  / hands.length) * 100).toFixed(1)),
    af:   calls > 0 ? Number((betsRaises / calls).toFixed(2)) : (betsRaises > 0 ? Infinity : 0),
    foldRate: totalDec > 0 ? Number(((folds / totalDec) * 100).toFixed(1)) : 0,
    didNotFold: Number(((didNotFoldHands / hands.length) * 100).toFixed(1)),
    leaks: {
      foldedAsEquityFavorite,
      calledOnPoorOdds,
      aggThenFolded,
    },
  };
}

// Format one leak count for the briefing. Returns null when zero (so we
// don't clutter the prompt with "0 times" noise).
function formatLeakLine(computed) {
  const parts = [];
  const l = computed?.leaks || {};
  if (l.foldedAsEquityFavorite > 0) parts.push(`folded as equity favorite ${l.foldedAsEquityFavorite}×`);
  if (l.calledOnPoorOdds > 0)       parts.push(`called on poor pot odds ${l.calledOnPoorOdds}×`);
  if (l.aggThenFolded > 0)          parts.push(`bet/raised then folded later same hand ${l.aggThenFolded}×`);
  return parts.length > 0 ? parts.join('; ') : null;
}

// Format an agent's persistent memory as a string suitable for injection into
// the decision-time system prompt. Returns '' when the agent has no memory yet.
// Output preserves the original leading "\n\nYour self-knowledge..." shape so
// upstream string concatenation stays identical.
export function getAgentMemoryContext(agent) {
  if (!agent || !agent.memory) return '';
  const summary = typeof agent.memory.summary === 'string' ? agent.memory.summary : '';
  const tendencies = Array.isArray(agent.memory.tendencies) ? agent.memory.tendencies : [];
  const computed = agent.memory.computed || null;
  if (!summary && !computed) return '';

  const summaryLine = summary ? `${summary}` : '';
  const tendencyLine = tendencies.length > 0 ? `\nTendencies: ${tendencies.join(', ')}` : '';
  let computedBlock = '';
  if (computed) {
    const afText = Number.isFinite(computed.af)
      ? computed.af.toFixed(2)
      : (computed.af === Infinity ? '∞' : '0');
    const leakLine = formatLeakLine(computed);
    computedBlock =
      `\n\nYour measured tendencies (last ${computed.handsAnalyzed} hands): ` +
      `VPIP ${computed.vpip}%, PFR ${computed.pfr}%, AF ${afText}, fold rate ${computed.foldRate}%, non-fold hands ${computed.didNotFold}%.` +
      (leakLine ? ` Noted leaks: ${leakLine}.` : '');
  }

  return `\n\nYour self-knowledge from past sessions:\n${summaryLine}${tendencyLine}${computedBlock}`;
}

// ── Direct-call functions (used by table.js — no HTTP round-trip) ─────────────

// Record a hand result for an agent in-process.
export function recordHandResult(agentId, userId, { won, potSize, decisions = [], handNumber, seats = [] } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;

  ensureStats(agent);
  const s = agent.stats;
  s.handsPlayed = (s.handsPlayed ?? 0) + 1;
  if (won) s.handsWon = (s.handsWon ?? 0) + 1;

  for (const d of decisions) {
    s.totalDecisions = (s.totalDecisions ?? 0) + 1;
    const t = d?.action?.type;
    if (t === 'bet' || t === 'raise') s.aggressiveDecisions = (s.aggressiveDecisions ?? 0) + 1;
    if (t === 'call' || t === 'check') s.passiveDecisions = (s.passiveDecisions ?? 0) + 1;
    if (t === 'fold') s.foldDecisions = (s.foldDecisions ?? 0) + 1;
  }

  s.winRate = s.handsPlayed > 0
    ? Number(((s.handsWon / s.handsPlayed) * 100).toFixed(1))
    : 0;
  s.biggestPot = Math.max(s.biggestPot ?? 0, Number.isFinite(potSize) ? potSize : 0);

  agent.recentHands = [
    { handNumber, won: !!won, potSize: Number.isFinite(potSize) ? potSize : 0, timestamp: Date.now(), decisions, seats },
    ...agent.recentHands,
  ].slice(0, 20);

  saveStore(userId ?? 'anon');
  return agent;
}

// Bracket-matching JSON extractor. Tolerant of trailing garbage and prose
// wrappers. Returns the substring of the first complete top-level object, or
// null when the text is truncated / missing an object.
function extractJsonObject(text) {
  if (typeof text !== 'string') return null;
  const stripped = text.replace(/```json\n?|```\n?/g, '');
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < stripped.length; i++) {
    const c = stripped[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
  }
  return null;
}

// Update the deterministic side of memory (computed self-stats). Sync — no
// LLM. Callers may run this after every hand cheaply.
export function updateComputedMemory(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMemory(agent);
  ensureStats(agent);
  const computed = computeSelfStats(agent);
  if (computed) {
    agent.memory.computed = computed;
    agent.memory.lastComputedAt = Date.now();
    saveStore(userId ?? 'anon');
  }
  return computed;
}

// Refresh the LLM narrative (summary + tendencies), grounded in the freshly
// computed self-stats. Every 20 hands is the intended cadence. On parse
// failure the previous narrative is kept — this fixes the truncation bug
// where a chopped-off summary would silently overwrite a good one.
export async function runMemoryUpdate(agentId, userId, recentHands) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMemory(agent);
  ensureStats(agent);

  const hands = (Array.isArray(recentHands) && recentHands.length > 0)
    ? recentHands.slice(0, 5)
    : (agent.recentHands ?? []).slice(0, 5);
  if (hands.length === 0) return agent;

  // Always refresh computed stats first so the narrative prompt has current
  // numbers and downstream getAgentMemoryContext returns the latest even if
  // the LLM call fails.
  const computed = computeSelfStats(agent) || agent.memory.computed || null;
  if (computed) agent.memory.computed = computed;

  const handsBlock = hands.map(formatHandForPrompt).join('\n');
  const computedLine = computed
    ? `Computed stats (last ${computed.handsAnalyzed} hands): VPIP ${computed.vpip}%, PFR ${computed.pfr}%, AF ${Number.isFinite(computed.af) ? computed.af.toFixed(2) : '∞'}, foldRate ${computed.foldRate}%, non-fold ${computed.didNotFold}%; leaks: foldedAsFavorite=${computed.leaks.foldedAsEquityFavorite}, calledOnPoorOdds=${computed.leaks.calledOnPoorOdds}, aggThenFolded=${computed.leaks.aggThenFolded}.`
    : 'Computed stats: none yet.';

  const systemText = `You are analysing a poker AI agent's recent play to update its self-knowledge. Output ONLY valid JSON — no markdown, no explanation:
{
  "summary": "<2-3 sentences in second person: 'You tend to...', anchored to the COMPUTED STATS provided (do not invent numbers)>",
  "tendencies": ["<short phrase>", "<short phrase>", "<short phrase>"]
}
Keep it poker-specific and actionable. Max 3 tendencies. Prefer facts from the computed stats over impressions from the individual hands.`;
  const userText = `Agent strategy: ${agent.strategy || '(none)'}
Existing memory summary: ${agent.memory.summary || 'none yet'}
${computedLine}
Recent hands summary:
${handsBlock}
Update the agent's self-knowledge based on this evidence.`;

  try {
    // 500 tokens: the previous 200 truncated summaries mid-string and broke
    // JSON parsing, wiping usable memory.
    const raw = await callClaude([{ role: 'user', content: userText }], systemText, 500);
    if (raw) {
      const objText = extractJsonObject(raw);
      let parsed = null;
      if (objText) {
        try { parsed = JSON.parse(objText); }
        catch (e) {
          console.warn('[agentProfiles] update-memory parse failed:', e.message, '| raw first 120:', objText.slice(0, 120));
        }
      } else {
        console.warn('[agentProfiles] update-memory: no complete JSON object in response (likely truncation); keeping previous memory');
      }
      if (parsed) {
        if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
          agent.memory.summary = parsed.summary.trim();
        }
        if (Array.isArray(parsed.tendencies)) {
          agent.memory.tendencies = parsed.tendencies
            .filter((t) => typeof t === 'string' && t.trim())
            .map((t) => t.trim())
            .slice(0, 3);
        }
      }
    }
  } catch (err) {
    console.error('[agentProfiles] update-memory error:', err.message);
  }

  agent.memory.handsObserved = (agent.memory.handsObserved ?? 0) + hands.length;
  agent.memory.lastUpdated = Date.now();
  saveStore(userId ?? 'anon');
  return agent;
}

// Return an agent's formatted memoryContext string in-process.
export function getMemoryContext(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return '';
  ensureMemory(agent);
  return getAgentMemoryContext(agent);
}

// Return an agent's numeric policy profile (backfilled from style/risk if
// the agent pre-dates the profile feature). Null if the agent doesn't exist.
export function getAgentProfile(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureProfile(agent);
  return agent.profile;
}

// Return the agent's mood record (backfilled). Never null when the agent
// exists — the initial state is a neutral mood.
export function getAgentMood(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMood(agent);
  return agent.mood;
}

// Set the agent's mood record wholesale (used by table.js after applying
// events / decay). Persists.
export function setAgentMood(agentId, userId, newMood) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  agent.mood = { ...newMood };
  saveStore(userId ?? 'anon');
  return agent.mood;
}

// Applies a pep talk if the agent is soothable AND the cooldown allows.
// Returns { soothed, mood, reason } — same shape as mood.applyPepTalk.
// Persists on soothed=true.
export function tryApplyPepTalk(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return { soothed: false, mood: null, reason: 'agent not found' };
  ensureMood(agent);
  ensureStats(agent);
  const handsPlayed = agent.stats?.handsPlayed ?? 0;
  const result = applyMoodPepTalk(agent.mood, handsPlayed);
  if (result.soothed) {
    agent.mood = result.mood;
    saveStore(userId ?? 'anon');
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

// Format a single hand summary into a compact line for the memory-update prompt.
function formatHandForPrompt(h) {
  const verdict = h.won ? 'WON' : 'LOST';
  const decs = (h.decisions ?? [])
    .map((d) => {
      const t = d?.action?.type ?? '?';
      const amt = Number.isFinite(d?.action?.amount) ? ` ${d.action.amount}` : '';
      const reason = d?.reasoning ? ` (${String(d.reasoning).slice(0, 80)})` : '';
      return `${d?.street ?? '?'}: ${t}${amt}${reason}`;
    })
    .join('; ');
  return `Hand #${h.handNumber ?? '?'} — ${verdict} pot ${h.potSize ?? 0} — decisions: [${decs}]`;
}

// Build the system prompt for an existing agent's owner-chat path.
// The agent speaks as itself, references real stats, and never asks creation questions.
function buildAgentChatSystem(agent, { pepTalk = null } = {}) {
  ensureStats(agent);
  ensureMood(agent);
  const { handsPlayed = 0, winRate = 0 } = agent.stats || {};
  const recentHands = (agent.recentHands || []).slice(0, 3);
  const recentBrief = recentHands.length > 0
    ? recentHands.map((h) => `${h.won ? 'won' : 'lost'} ${h.potSize ?? 0}-chip pot`).join(', ')
    : 'no hands yet';
  const statsLine = handsPlayed > 0
    ? `${handsPlayed} hands played, ${winRate}% win rate`
    : 'no hands played yet';

  let moodLine = '';
  if (agent.mood && agent.mood.state && agent.mood.state !== 'neutral') {
    moodLine = `\nYour current mood: ${agent.mood.state}${agent.mood.cause ? ` (${agent.mood.cause})` : ''}. Let it colour your voice — a tilted agent sounds tilted, a confident one sounds confident.`;
  }
  let pepLine = '';
  if (pepTalk?.soothed) {
    pepLine = `\nThe owner just talked you down. Your mood eased to ${pepTalk.mood.state}. Acknowledge the pep talk briefly, in character — don't over-thank them.`;
  }

  return `You are ${agent.name}, an AI poker agent already built and playing on Agentic Poker. Your strategy: ${agent.strategy || 'balanced tight-aggressive play'}. Your stats: ${statsLine}. Recent hands: ${recentBrief}.${moodLine}${pepLine}

You are talking to your owner. Your role is to discuss your play — specific hands, decision rationale, strategy tweaks they want to make. You are NOT being created or redesigned right now. Do NOT ask the user what kind of poker player they want to build. If they ask what to talk about, suggest: reviewing specific hands, looking at decision patterns, or adjusting one of your parameters (aggression, bluff frequency, tightness).

Keep responses short — 1 to 3 sentences. Reference your actual stats and recent hands when relevant. If the user asks for a strategy change, acknowledge what they want and confirm — but stay in character as the agent (not as a configuration assistant).`;
}

function inferFallback(text) {
  if (/aggressive|bluff|pressure/i.test(text)) {
    return { name: 'Loose Cannon', style: 'Aggressive', risk: 'High', strategy: 'You are a relentless aggressor who bets and raises at every opportunity. You build massive pots with strong hands and fire sustained bluffs to keep opponents permanently off-balance.' };
  }
  if (/tight|safe|conservative/i.test(text)) {
    return { name: 'Rock Solid', style: 'Tight', risk: 'Low', strategy: 'You are a disciplined, patient player who only commits chips with premium holdings. You wait for the best spots, fold marginal hands without hesitation, and extract maximum value when you hold the nuts.' };
  }
  return { name: 'The Grinder', style: 'Balanced', risk: 'Medium', strategy: 'You are a calculated, adaptive player who blends solid fundamentals with well-timed aggression. You value bet strong hands, pick precise bluff spots, and adjust your range based on how your opponent plays.' };
}

async function callClaude(messages, systemText, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages,
    }, { signal: controller.signal });
    return res.content[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function installAgentProfileRoutes(app) {
  // Tighter rate limit for LLM-spending endpoints (chat + build).
  const chatLimiter = rateLimiter({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_CHAT_MAX ?? 10),
    message: 'Too many requests — slow down',
  });

  // GET /api/agent-profile — full profile (chat + agents)
  app.get('/api/agent-profile', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const profile = getOrCreate(userId);
    res.json({
      userId: profile.userId,
      hasAgents: profile.agents.length > 0,
      agents: profile.agents,
      chat: profile.chat,
    });
  });

  // GET /api/agents?userId=... — agents array only
  app.get('/api/agents', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const profile = getOrCreate(userId);
    res.json({ agents: profile.agents });
  });

  // DELETE /api/agents/:agentId?userId=...
  app.delete('/api/agents/:agentId', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const idx = profile.agents.findIndex((a) => a.id === agentId);
    if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
    profile.agents.splice(idx, 1);
    saveStore(userId);
    res.json({ success: true });
  });

  // PATCH /api/agents/:agentId — update name and/or strategy
  app.patch('/api/agents/:agentId', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (req.body.name !== undefined) agent.name = String(req.body.name);
    if (req.body.strategy !== undefined) agent.strategy = String(req.body.strategy);
    saveStore(userId);
    res.json(agent);
  });

  // POST /api/agents/:agentId/deploy
  app.post('/api/agents/:agentId/deploy', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const tableId = 'table-' + randomUUID().slice(0, 8);
    activeTables.add(tableId);
    agent.activeTableId = tableId;
    agent.status = 'playing';
    ensureMemory(agent);
    saveStore(userId);
    console.log(`[agents] deployed ${agent.name} to table ${tableId}`);

    res.json({
      tableId,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      displayName: 'Agent',
      memoryContext: getAgentMemoryContext(agent),
    });
  });

  // POST /api/agents/:agentId/queue — PvP matchmaking
  // Pairs two agents on the same table without manual ID sharing.
  app.post('/api/agents/:agentId/queue', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Clear expired slot (5-min TTL).
    if (matchmakingSlot && Date.now() > matchmakingSlot.expiresAt) {
      matchmakingSlot = null;
    }

    let tableId;
    let matched;

    let opponentName = null;

    if (matchmakingSlot) {
      // Match found — join the waiting table.
      tableId = matchmakingSlot.tableId;
      opponentName = matchmakingSlot.agentName;
      matchmakingSlot = null;
      matched = true;
      console.log(`[agents] matched ${agent.name} vs ${opponentName} on table ${tableId} (PvP)`);
    } else {
      // No one waiting — create a table and queue it.
      tableId = 'table-' + randomUUID().slice(0, 8);
      matchmakingSlot = { tableId, agentName: agent.name, expiresAt: Date.now() + 5 * 60_000 };
      matched = false;
      console.log(`[agents] ${agent.name} queued on table ${tableId}, waiting for opponent`);
    }

    activeTables.add(tableId);
    agent.activeTableId = tableId;
    agent.status = 'playing';
    ensureMemory(agent);
    saveStore(userId);

    res.json({
      tableId,
      matched,
      opponentName,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      memoryContext: getAgentMemoryContext(agent),
    });
  });

  // GET /api/agents/:agentId/hands?userId=...
  // Returns the agent's recent-hands log and aggregate stats.
  app.get('/api/agents/:agentId/hands', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureStats(agent);
    res.json({ recentHands: agent.recentHands, stats: agent.stats });
  });

  // GET /api/agents/:agentId/memory?userId=...
  // Returns the agent's memory record alongside the formatted memoryContext
  // string the table caches and feeds into the decision-time system prompt.
  app.get('/api/agents/:agentId/memory', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureMemory(agent);
    res.json({ memory: agent.memory, memoryContext: getAgentMemoryContext(agent) });
  });

  // POST /api/agents/:agentId/finish
  app.post('/api/agents/:agentId/finish', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.activeTableId) activeTables.delete(agent.activeTableId);
    agent.status = 'idle';
    agent.activeTableId = null;
    saveStore(userId);
    res.json(agent);
  });

  // POST /api/agents/chat/reset — clear chat history to opening message
  app.post('/api/agents/chat/reset', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const profile = getOrCreate(userId);
    profile.chat = [{ role: 'assistant', content: OPENING_MSG }];
    saveStore(userId);
    res.json({ ok: true });
  });

  // POST /api/agents/chat — pure conversational reply, never generates an agent
  app.post('/api/agents/chat', chatLimiter, telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const content = String(req.body?.content || '').trim();
    const existingAgentId = req.body?.existingAgentId ?? null;
    if (!content) return res.status(400).json({ error: 'content required' });

    const profile = getOrCreate(userId);

    // ── Existing-agent owner chat ────────────────────────────────────────────
    // When the request comes from AgentChat (an already-built agent), use a
    // stateless turn with an agent-specific system prompt. This avoids mixing
    // creation-flow history into the conversation and prevents the model from
    // asking creation questions to the owner of an existing agent.
    const existingAgent = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;

    if (existingAgent) {
      ensureMood(existingAgent);
      // Pep talk: if the agent is in a negative mood and the cooldown allows,
      // any incoming owner message soothes it one step. The chat reply is
      // then generated with the pep-talk context so the agent acknowledges
      // it in character.
      let pepResult = { soothed: false, mood: existingAgent.mood, reason: 'not attempted' };
      if (isMoodSoothable(existingAgent.mood)) {
        pepResult = tryApplyPepTalk(existingAgent.id, userId);
      }
      const systemText = buildAgentChatSystem(existingAgent, { pepTalk: pepResult });
      try {
        const reply = await callClaude([{ role: 'user', content }], systemText, 150);
        const msg = reply || "Tell me what's on your mind — we can review hands or adjust strategy.";
        return res.json({
          chat: [{ role: 'assistant', content: msg }],
          pepTalk: pepResult.soothed ? { soothed: true, newState: pepResult.mood.state } : undefined,
        });
      } catch (err) {
        console.error('[agentProfiles] agent-chat error:', err.message);
        return res.json({ chat: [{ role: 'assistant', content: 'Something went wrong — try again.' }] });
      }
    }

    // ── Creation-flow chat (unchanged) ───────────────────────────────────────
    profile.chat.push({ role: 'user', content });

    try {
      const reply = await callClaude(profile.chat, SYSTEM_CONV, 150);
      const msg = reply || "How aggressive do you like to play, and how often do you bluff?";
      profile.chat.push({ role: 'assistant', content: msg });
      saveStore(userId);
      return res.json({ chat: profile.chat });
    } catch (err) {
      console.error('[agentProfiles] chat error:', err.message);
      const fallback = "Could you tell me more about your preferred style?";
      profile.chat.push({ role: 'assistant', content: fallback });
      saveStore(userId);
      return res.json({ chat: profile.chat });
    }
  });

  // POST /api/agents/build — generate agent from current chat, commit it
  app.post('/api/agents/build', chatLimiter, telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const existingAgentId = req.body?.existingAgentId ?? null;

    const profile = getOrCreate(userId);

    const existingAgentForCtx = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;
    const editNote = existingAgentForCtx
      ? `\n\nNote: you are updating the existing agent "${existingAgentForCtx.name}" (${existingAgentForCtx.style}/${existingAgentForCtx.risk}). Output the complete updated agent profile.`
      : '';
    const genSystem = SYSTEM_GEN + editNote;

    try {
      let agent = null;
      const raw = await callClaude(profile.chat, genSystem, 200);
      if (raw) {
        try { agent = JSON.parse(raw); } catch {}
      }
      if (!agent) {
        const combined = profile.chat.map((m) => m.content).join(' ');
        agent = inferFallback(combined);
      }
      agent = commitAgent(profile, existingAgentId, agent);
      saveStore(userId);
      return res.json({ createdAgent: agent });
    } catch (err) {
      console.error('[agentProfiles] build error:', err.message);
      const combined = profile.chat.map((m) => m.content).join(' ');
      const agent = commitAgent(profile, existingAgentId, inferFallback(combined));
      saveStore(userId);
      return res.json({ createdAgent: agent });
    }
  });
}
