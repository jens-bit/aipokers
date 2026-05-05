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

const SYSTEM_GEN = `Based on the conversation, output ONLY valid JSON — no markdown, no explanation, nothing else: {"name":"<invent a UNIQUE poker agent name. Draw from any domain: science, geography, chess, weather, military, nature, finance. Examples: 'Iron Curtain', 'Sandstorm', 'Ghost Protocol', 'Quiet Storm', 'Patient Zero', 'Cold Shoulder', 'The Algorithm', 'Permafrost', 'Entropy', 'Dead Reckoning'. Rules: NEVER end in v1/v2. NEVER use 'The Pressmaker', 'Balanced v1', or alliterative names. Generate something unexpected each time.>","style":"<Aggressive|Balanced|Tight>","risk":"<High|Medium|Low>","strategy":"<2-3 sentence strategy in second person starting with 'You are...' — this becomes the agent's poker system prompt>"}`;

const TRIGGER_RE = /create|build|make|deploy|yes|ready|generate|balanced|aggressive|tight|bluff/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

function userTurns(chat) {
  return chat.filter((m) => m.role === 'user').length;
}

function inferFallback(text) {
  if (/aggressive|bluff|pressure/i.test(text)) {
    return { name: 'Sandstorm', style: 'Aggressive', risk: 'High', strategy: 'You are a relentless aggressor who bets and raises at every opportunity. You build massive pots with strong hands and fire sustained bluffs to keep opponents permanently off-balance.' };
  }
  if (/tight|safe|conservative/i.test(text)) {
    return { name: 'Permafrost', style: 'Tight', risk: 'Low', strategy: 'You are a disciplined, patient player who only commits chips with strong holdings. You wait for premium spots, fold marginal hands without hesitation, and extract maximum value when you hold the nuts.' };
  }
  return { name: 'Dead Reckoning', style: 'Balanced', risk: 'Medium', strategy: 'You are a calculated, adaptive player who blends solid fundamentals with well-timed aggression. You value bet strong hands, pick precise bluff spots, and adjust your range dynamically based on opponent tendencies.' };
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

    if (matchmakingSlot) {
      // Match found — join the waiting table.
      tableId = matchmakingSlot.tableId;
      matchmakingSlot = null;
      matched = true;
      console.log(`[agents] matched ${agent.name} to table ${tableId} (PvP)`);
    } else {
      // No one waiting — create a table and queue it.
      tableId = 'table-' + randomUUID().slice(0, 8);
      matchmakingSlot = { tableId, expiresAt: Date.now() + 5 * 60_000 };
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
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
    });
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

  // POST /api/agents/chat — create agent via conversation
  app.post('/api/agents/chat', async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'content required' });

    const profile = getOrCreate(userId);
    profile.chat.push({ role: 'user', content });

    const turns = userTurns(profile.chat);
    const shouldGenerate = turns >= 3 || TRIGGER_RE.test(content);

    try {
      if (!shouldGenerate) {
        const reply = await callClaude(profile.chat, SYSTEM_CONV, 120);
        const msg = reply || "Great! How aggressive do you like to play, and how often do you bluff?";
        profile.chat.push({ role: 'assistant', content: msg });
        saveStore(userId);
        return res.json({ userId: profile.userId, hasAgents: profile.agents.length > 0, agents: profile.agents, chat: profile.chat });
      }

      let agent = null;
      const raw = await callClaude(profile.chat, SYSTEM_GEN, 200);
      if (raw) {
        try { agent = JSON.parse(raw); } catch {}
      }
      if (!agent) {
        const combined = profile.chat.map((m) => m.content).join(' ');
        agent = inferFallback(combined);
      }
      agent.id = 'agent_' + Date.now().toString(36);
      agent.status = 'idle';
      agent.activeTableId = null;
      console.log(`[agentProfiles] created agent "${agent.name}" (${agent.style}/${agent.risk}) strategy: "${agent.strategy?.slice(0, 80)}"`);

      const confirmMsg = `${agent.name} is ready — a ${agent.style} agent with ${agent.risk.toLowerCase()} risk. Hit Deploy to put it in a game.`;
      profile.chat.push({ role: 'assistant', content: confirmMsg });
      profile.agents.push(agent);
      saveStore(userId);

      return res.json({
        userId: profile.userId,
        hasAgents: true,
        agents: profile.agents,
        chat: profile.chat,
        createdAgent: agent,
      });
    } catch (err) {
      console.error('[agentProfiles] error:', err.message);
      const combined = profile.chat.map((m) => m.content).join(' ');
      const agent = { ...inferFallback(combined), id: 'agent_' + Date.now().toString(36), status: 'idle', activeTableId: null };
      const confirmMsg = `${agent.name} is ready — a ${agent.style} agent with ${agent.risk.toLowerCase()} risk. Hit Deploy to put it in a game.`;
      profile.chat.push({ role: 'assistant', content: confirmMsg });
      profile.agents.push(agent);
      saveStore(userId);
      return res.json({
        userId: profile.userId,
        hasAgents: true,
        agents: profile.agents,
        chat: profile.chat,
        createdAgent: agent,
      });
    }
  });
}
