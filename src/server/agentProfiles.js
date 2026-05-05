import { randomUUID } from 'node:crypto';

const profiles = new Map();

function normalizeUserId(value) {
  const id = String(value || '').trim();
  return id ? id.slice(0, 120) : 'telegram:dev-user';
}

function getProfile(userId) {
  const id = normalizeUserId(userId);
  if (!profiles.has(id)) {
    profiles.set(id, {
      userId: id,
      agents: [],
      chat: [
        {
          role: 'assistant',
          content: 'Tell me the playing style you want. I will turn it into your first agent draft.',
        },
      ],
    });
  }
  return profiles.get(id);
}

function inferAgentDraft(text) {
  const lower = text.toLowerCase();
  const aggressive = /\b(aggro|aggressive|pressure|bluff|attack)\b/.test(lower);
  const cautious = /\b(tight|safe|conservative|careful|low risk)\b/.test(lower);
  const balanced = !aggressive && !cautious;
  const name = aggressive ? 'Pressure v1' : cautious ? 'Sentinel v1' : 'Balanced v1';
  const style = aggressive ? 'Aggressive' : cautious ? 'Tight' : 'Balanced';
  const risk = aggressive ? 'High' : cautious ? 'Low' : 'Medium';
  const strategy = aggressive
    ? 'Apply pressure in position, attack capped ranges, and keep value bets large.'
    : cautious
      ? 'Play tight preflop, protect the stack, and value bet clear advantages.'
      : 'Play a solid tight-aggressive strategy with measured bluffs and clear value betting.';

  return { name, style, risk, strategy };
}

function shouldCreateAgent(text, messageCount) {
  return messageCount >= 2 || /\b(build|create|make|deploy|ready|yes|balanced|aggressive|tight|safe|bluff)\b/i.test(text);
}

function createAgentFromChat(profile, text) {
  const draft = inferAgentDraft(text);
  const agent = {
    id: `agent_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    name: draft.name,
    style: draft.style,
    risk: draft.risk,
    status: 'ready',
    bankroll: 0,
    bankrollStatus: 'unfunded',
    tablePreference: 'Heads-up NLH / $10-$20',
    deployStatus: 'needs_funding',
    hands: 0,
    winRate: null,
    strategy: draft.strategy,
    createdAt: new Date().toISOString(),
  };
  profile.agents.push(agent);
  return agent;
}

export function installAgentProfileRoutes(app) {
  app.get('/api/agent-profile', (req, res) => {
    const profile = getProfile(req.query.userId);
    res.json({
      userId: profile.userId,
      hasAgents: profile.agents.length > 0,
      agents: profile.agents,
      chat: profile.chat,
    });
  });

  app.delete('/api/agent-profile', (req, res) => {
    const userId = normalizeUserId(req.query.userId || req.body?.userId);
    profiles.delete(userId);
    const profile = getProfile(userId);
    res.json({
      userId: profile.userId,
      hasAgents: false,
      agents: profile.agents,
      chat: profile.chat,
    });
  });

  app.post('/api/agents/chat', (req, res) => {
    const profile = getProfile(req.body?.userId);
    const content = String(req.body?.content || '').trim();
    if (!content) {
      res.status(400).json({ error: 'content required' });
      return;
    }

    profile.chat.push({ role: 'user', content });

    let createdAgent = null;
    const userTurns = profile.chat.filter((m) => m.role === 'user').length;
    if (profile.agents.length === 0 && shouldCreateAgent(content, userTurns)) {
      createdAgent = createAgentFromChat(profile, content);
      profile.chat.push({
        role: 'assistant',
        content: `${createdAgent.name} is ready. I tuned it as a ${createdAgent.style.toLowerCase()} heads-up NLH agent with ${createdAgent.risk.toLowerCase()} risk.`,
      });
    } else {
      profile.chat.push({
        role: 'assistant',
        content: 'Got it. Give me the style, risk level, and what you want it to optimize for, then I can create the first version.',
      });
    }

    res.json({
      userId: profile.userId,
      hasAgents: profile.agents.length > 0,
      agents: profile.agents,
      chat: profile.chat,
      createdAgent,
    });
  });
}
