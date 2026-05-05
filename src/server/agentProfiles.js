import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

const profiles = new Map();

const OPENING_MSG = "Hi! I'm your poker strategy assistant. Describe how you want your agent to play and I'll help build it with you.";

const SYSTEM_CONV = `You are a poker strategy assistant helping a user design their AI poker agent for heads-up No-Limit Texas Hold'em. Ask one short friendly question at a time to understand their playstyle. Cover: aggression, bluff frequency, risk tolerance, preflop tightness. Keep every response under 2 sentences. After the user has answered 2 questions, tell them you have enough to build their agent and that you'll create it now.`;

const SYSTEM_GEN = `Based on the conversation, output ONLY valid JSON — no markdown, no explanation, nothing else: {"name":"<creative agent name e.g. Iron Sentinel v1>","style":"<Aggressive|Balanced|Tight>","risk":"<High|Medium|Low>","strategy":"<2-3 sentence strategy in second person starting with 'You are...' — this becomes the agent's poker system prompt>"}`;

const TRIGGER_RE = /create|build|make|deploy|yes|ready|generate|balanced|aggressive|tight|bluff/i;

function getOrCreate(userId) {
  if (!profiles.has(userId)) {
    profiles.set(userId, {
      userId,
      agents: [],
      chat: [{ role: 'assistant', content: OPENING_MSG }],
    });
  }
  return profiles.get(userId);
}

function userTurns(chat) {
  return chat.filter((m) => m.role === 'user').length;
}

function inferFallback(text) {
  if (/aggressive|bluff|pressure/i.test(text)) {
    return { name: 'Pressure v1', style: 'Aggressive', risk: 'High', strategy: 'You are an aggressive poker player who bets and raises frequently. You apply maximum pressure with strong hands and strategic bluffs to force opponents into tough decisions.' };
  }
  if (/tight|safe|conservative/i.test(text)) {
    return { name: 'Sentinel v1', style: 'Tight', risk: 'Low', strategy: 'You are a tight, disciplined poker player who only plays strong hands. You minimize risk, avoid marginal spots, and capitalize when you have a clear advantage.' };
  }
  return { name: 'Balanced v1', style: 'Balanced', risk: 'Medium', strategy: 'You are a balanced poker player who mixes aggression with solid fundamentals. You adapt to your opponent, value bet strong hands, and bluff selectively in good spots.' };
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

export function installAgentProfileRoutes(app) {
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

  app.post('/api/agents/chat', async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'content required' });

    const profile = getOrCreate(userId);
    profile.chat.push({ role: 'user', content });

    const turns = userTurns(profile.chat);
    const shouldGenerate = turns >= 2 || TRIGGER_RE.test(content);

    try {
      if (!shouldGenerate) {
        const reply = await callClaude(profile.chat, SYSTEM_CONV, 120);
        const msg = reply || "Great! How aggressive do you like to play, and how often do you bluff?";
        profile.chat.push({ role: 'assistant', content: msg });
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

      const confirmMsg = `${agent.name} is ready — a ${agent.style} agent with ${agent.risk.toLowerCase()} risk. Hit Deploy to put it in a game.`;
      profile.chat.push({ role: 'assistant', content: confirmMsg });
      profile.agents.push(agent);

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
      const agent = { ...inferFallback(combined), id: 'agent_' + Date.now().toString(36) };
      const confirmMsg = `${agent.name} is ready — a ${agent.style} agent with ${agent.risk.toLowerCase()} risk. Hit Deploy to put it in a game.`;
      profile.chat.push({ role: 'assistant', content: confirmMsg });
      profile.agents.push(agent);
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
