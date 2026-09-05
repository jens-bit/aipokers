// client/src/test/fixtures/wallet.js — WALLET-UI-1
//
// Shapes taken from the contract on feature/wallet, with the numbers from
// design-refs/mood-wallet.jsx so a test failure reads against the design:
//
//   GET /api/wallet -> { balance, staked, session, ledger[] }
//   agent.pocket    -> { balance, mode, cap, broke }

export const wallet = {
  balance: 2340.5,
  staked: 1150,
  session: 486,
  ledger: [
    { ts: 1788700000000, type: 'fund', agentId: 'agent_aggressive', amount: -500 },
    { ts: 1788690000000, type: 'collect', agentId: 'agent_balanced', amount: 340 },
  ],
};

// The ref's four pockets, one per money state, attached to agent records in
// the shape presentAgent returns.
function agent(over) {
  return {
    style: 'Balanced',
    risk: 'Medium',
    strategy: '',
    status: 'idle',
    activeTableId: null,
    stats: { handsPlayed: 120, handsWon: 60 },
    recentHands: [],
    mood: { state: 'neutral', cause: null, updatedAt: null },
    lastMoment: null,
    sessionRecap: null,
    unseenRecap: false,
    proposal: null,
    presence: 'resting',
    liveGame: null,
    flaggedCount: 0,
    sessionLog: [],
    careerStats: { hands: 120, sessions: 2, net: 340, biggestPot: 900, winRate: 50, bankroll: 0 },
    ...over,
  };
}

// Auto-refill, up 340 on his float — the Collect row.
export const balancedAgent = agent({
  id: 'agent_balanced',
  name: 'Balanced v2.1',
  mood: { state: 'confident', cause: 'stacked the loose one', updatedAt: null },
  presence: 'playing',
  activeTableId: 'tbl-1',
  pocket: { balance: 640, mode: 'auto', cap: 1000, broke: false, pnl: 340 },
});

// On an allowance and down — the Fund row while still holding money.
export const aggressiveAgent = agent({
  id: 'agent_aggressive',
  name: 'Aggressive v1.3',
  mood: { state: 'frustrated', cause: 'ran into the nuts', updatedAt: null },
  presence: 'playing',
  activeTableId: 'tbl-1',
  pocket: { balance: 210, mode: 'allowance', cap: 500, broke: false, pnl: -90 },
});

// A one-time top-up, resting with money in hand.
export const bluffAgent = agent({
  id: 'agent_bluff',
  name: 'Bluff Master',
  mood: { state: 'confident', cause: null, updatedAt: null },
  unseenRecap: true,
  pocket: { balance: 300, mode: 'topup', cap: 300, broke: false, pnl: 236 },
});

// Out of money and cut off. Drawn quieter, never redder.
export const brokeAgent = agent({
  id: 'agent_value',
  name: 'Value Bot',
  mood: { state: 'sulking', cause: 'pocket empty', updatedAt: null },
  pocket: { balance: 0, mode: 'cut', cap: null, broke: true, pnl: null },
});

export const pocketAgents = [balancedAgent, aggressiveAgent, bluffAgent, brokeAgent];

export const walletAgentsResponse = { agents: pocketAgents };

// A deployment with no wallet: agents carry no pocket at all.
export const noPocketAgent = agent({ id: 'agent_plain', name: 'Plain Agent' });
export const noWalletAgentsResponse = { agents: [noPocketAgent] };
