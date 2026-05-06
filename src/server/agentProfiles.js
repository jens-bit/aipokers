import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

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

const SYSTEM_GEN = `Based on the conversation, output ONLY valid JSON — no markdown, no explanation, nothing else: {"name":"<name the agent something a poker player would recognise — draw from poker culture, casino life, card game lore, or player archetypes. Examples: 'The Clock', 'River Rat', 'Stone Cold', 'The Grinder', 'Table Captain', 'Check-Raiser', 'The Nit', 'Big Slick', 'Broadway', 'Dead Money', 'Felt Burner', 'The Sheriff', 'Chip Leader', 'Slow Roll'. Two words max. No geography, no weather, no science. Generate a different name each time.>","style":"<Aggressive|Balanced|Tight>","risk":"<High|Medium|Low>","strategy":"<2-3 sentence strategy in second person starting with 'You are...' — this becomes the agent's poker system prompt>"}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Update an agent in-place if existingAgentId is set, otherwise push a new one.
function commitAgent(profile, existingAgentId, agentData) {
  let agent = { ...agentData };
  if (existingAgentId) {
    const existing = profile.agents.find((a) => a.id === existingAgentId);
    if (existing) {
      Object.assign(existing, { name: agent.name, style: agent.style, risk: agent.risk, strategy: agent.strategy });
      agent = existing;
      console.log(`[agentProfiles] updated agent "${agent.name}" (${agent.style}/${agent.risk})`);
      return agent;
    }
  }
  agent.id = 'agent_' + Date.now().toString(36);
  agent.status = 'idle';
  agent.activeTableId = null;
  agent.stats = {
    handsPlayed: 0,
    handsWon: 0,
    totalDecisions: 0,
    aggressiveDecisions: 0,
    passiveDecisions: 0,
    foldDecisions: 0,
  };
  agent.recentHands = [];
  profile.agents.push(agent);
  console.log(`[agentProfiles] created agent "${agent.name}" (${agent.style}/${agent.risk})`);
  return agent;
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
  app.delete('/api/agents/:agentId', (req, res) => {
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
  app.patch('/api/agents/:agentId', (req, res) => {
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
    saveStore(userId);
    console.log(`[agents] deployed ${agent.name} to table ${tableId}`);

    res.json({
      tableId,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      displayName: 'Agent',
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
    saveStore(userId);

    res.json({
      tableId,
      matched,
      opponentName,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
    });
  });

  // POST /api/agents/:agentId/result
  // Called by the table after every hand completes. Updates aggregate stats
  // and prepends a hand summary (with decisions + reasoning) to recentHands.
  app.post('/api/agents/:agentId/result', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const { won, potSize, decisions = [], handNumber, seats = [] } = req.body || {};

    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

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

    const handSummary = {
      handNumber,
      won: !!won,
      potSize: Number.isFinite(potSize) ? potSize : 0,
      timestamp: Date.now(),
      decisions,
      seats,
    };
    agent.recentHands = [handSummary, ...agent.recentHands].slice(0, 20);

    saveStore(userId);
    res.json(agent);
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
  app.post('/api/agents/chat', async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const content = String(req.body?.content || '').trim();
    const existingAgentId = req.body?.existingAgentId ?? null;
    if (!content) return res.status(400).json({ error: 'content required' });

    const profile = getOrCreate(userId);
    profile.chat.push({ role: 'user', content });

    // Include existing agent context so the AI knows what's being changed.
    const existingAgentForCtx = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;
    const existingCtx = existingAgentForCtx
      ? `\n\nThe user is editing an existing agent: "${existingAgentForCtx.name}" — ${existingAgentForCtx.style} style, ${existingAgentForCtx.risk} risk. Current strategy: "${existingAgentForCtx.strategy}". When they suggest changes, acknowledge what's shifting and why it matters tactically.`
      : '';
    const systemText = SYSTEM_CONV + existingCtx;

    try {
      const reply = await callClaude(profile.chat, systemText, 150);
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
  app.post('/api/agents/build', async (req, res) => {
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
