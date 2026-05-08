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
  agent.memory = {
    summary: '',
    handsObserved: 0,
    tendencies: [],
    lastUpdated: null,
  };
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

// Format an agent's persistent memory as a string suitable for injection into
// the decision-time system prompt. Returns '' when the agent has no memory yet.
export function getAgentMemoryContext(agent) {
  if (!agent || !agent.memory || !agent.memory.summary) return '';
  const tendencies = Array.isArray(agent.memory.tendencies) ? agent.memory.tendencies : [];
  const tendencyLine = tendencies.length > 0 ? `\nTendencies: ${tendencies.join(', ')}` : '';
  return `\n\nYour self-knowledge from past sessions:\n${agent.memory.summary}${tendencyLine}`;
}

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
function buildAgentChatSystem(agent) {
  ensureStats(agent);
  const { handsPlayed = 0, winRate = 0 } = agent.stats || {};
  const recentHands = (agent.recentHands || []).slice(0, 3);
  const recentBrief = recentHands.length > 0
    ? recentHands.map((h) => `${h.won ? 'won' : 'lost'} ${h.potSize ?? 0}-chip pot`).join(', ')
    : 'no hands yet';
  const statsLine = handsPlayed > 0
    ? `${handsPlayed} hands played, ${winRate}% win rate`
    : 'no hands played yet';

  return `You are ${agent.name}, an AI poker agent already built and playing on Agentic Poker. Your strategy: ${agent.strategy || 'balanced tight-aggressive play'}. Your stats: ${statsLine}. Recent hands: ${recentBrief}.

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

  // POST /api/agents/:agentId/update-memory
  // Called by the table every N hands to evolve the agent's self-knowledge.
  // Body: { userId, recentHands? } — when recentHands is omitted, falls back
  // to agent.recentHands.slice(0, 5).
  app.post('/api/agents/:agentId/update-memory', async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const bodyHands = Array.isArray(req.body?.recentHands) ? req.body.recentHands : null;

    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureMemory(agent);
    ensureStats(agent);

    const hands = (bodyHands && bodyHands.length > 0)
      ? bodyHands.slice(0, 5)
      : (agent.recentHands ?? []).slice(0, 5);
    if (hands.length === 0) return res.json(agent);

    const handsBlock = hands.map(formatHandForPrompt).join('\n');
    const systemText = `You are analysing a poker AI agent's recent play to update its self-knowledge. Output ONLY valid JSON — no markdown, no explanation:
{
  "summary": "<2-3 sentences in second person: 'You tend to...', describing the agent's style and any patterns observed>",
  "tendencies": ["<short phrase>", "<short phrase>", "<short phrase>"]
}
Keep it poker-specific and actionable. Max 3 tendencies.`;
    const userText = `Agent strategy: ${agent.strategy || '(none)'}
Existing memory: ${agent.memory.summary || 'none yet'}
Recent hands summary:
${handsBlock}
Update the agent's self-knowledge based on this new evidence.`;

    try {
      const raw = await callClaude([{ role: 'user', content: userText }], systemText, 200);
      if (raw) {
        const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); } catch (e) {
          console.warn('[agentProfiles] update-memory parse failed:', e.message, '| raw:', cleaned.slice(0, 120));
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
      // fall through and persist the unchanged agent so handsObserved still ticks
    }

    agent.memory.handsObserved = (agent.memory.handsObserved ?? 0) + hands.length;
    agent.memory.lastUpdated = Date.now();
    saveStore(userId);
    res.json(agent);
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

    // ── Existing-agent owner chat ────────────────────────────────────────────
    // When the request comes from AgentChat (an already-built agent), use a
    // stateless turn with an agent-specific system prompt. This avoids mixing
    // creation-flow history into the conversation and prevents the model from
    // asking creation questions to the owner of an existing agent.
    const existingAgent = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;

    if (existingAgent) {
      const systemText = buildAgentChatSystem(existingAgent);
      try {
        const reply = await callClaude([{ role: 'user', content }], systemText, 150);
        const msg = reply || "Tell me what's on your mind — we can review hands or adjust strategy.";
        return res.json({ chat: [{ role: 'assistant', content: msg }] });
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
