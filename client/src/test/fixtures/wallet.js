// client/src/test/fixtures/wallet.js — WALLET-UI-1
//
// Shapes taken from the shipped projections in src/server/wallet.js, so a
// change there fails a client test rather than reaching a screen:
//
//   walletProjection  -> { balance, staked, session, playing:{live,total}, ledger[] }
//   pocketProjection  -> { balance, mode, cap, float, have, capBar,
//                          stakes:{smallBlind,bigBlind,label}|null, broke,
//                          collectable, funded, collected, pnl }
//
// WALLET-7: `collectable` is what a Collect would actually take — the WINNINGS
// (pnl, while it is positive), or the whole pocket once he has been called in.
// It used to be "everything above the float", which read a top-up as winnings.
// `float` is the roll the refill toggle tops him back up to, and it is sent
// rather than derived.
//
// The ladder is real chips, not the design sheet's dollars: the entry rung is
// a 2,000 buy-in at $10/$20 (STAKES in src/server/wallet.js), and `broke`
// means "cannot cover the entry buy-in", which is a bigger number than zero.

export const wallet = {
  balance: 2340.5,
  staked: 1150,
  session: 486,
  playing: { live: 2, total: 4 },
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
  pocket: {
    balance: 6400, mode: 'auto', cap: 10000, float: 10000,
    have: 6400, capBar: 10000,
    stakes: { smallBlind: 25, bigBlind: 50, label: '$25/$50' },
    broke: false, collectable: 340, funded: 6060, collected: 0, pnl: 340,
  },
});

// On an allowance and down — the Fund row while still holding money.
export const aggressiveAgent = agent({
  id: 'agent_aggressive',
  name: 'Aggressive v1.3',
  mood: { state: 'frustrated', cause: 'ran into the nuts', updatedAt: null },
  presence: 'playing',
  activeTableId: 'tbl-1',
  pocket: {
    balance: 2100, mode: 'allowance', cap: 5000, float: 5000,
    have: 2100, capBar: 5000,
    stakes: { smallBlind: 10, bigBlind: 20, label: '$10/$20' },
    broke: false, collectable: 0, funded: 2190, collected: 0, pnl: -90,
  },
});

// A one-time top-up, resting with money in hand.
export const bluffAgent = agent({
  id: 'agent_bluff',
  name: 'Bluff Master',
  mood: { state: 'confident', cause: null, updatedAt: null },
  unseenRecap: true,
  pocket: {
    balance: 3000, mode: 'topup', cap: 3000, float: 2000,
    have: 3000, capBar: 3000,
    stakes: { smallBlind: 10, bigBlind: 20, label: '$10/$20' },
    broke: false, collectable: 236, funded: 2764, collected: 0, pnl: 236,
  },
});

// Out of money and cut off. Drawn quieter, never redder.
export const brokeAgent = agent({
  id: 'agent_value',
  name: 'Value Bot',
  mood: { state: 'sulking', cause: 'pocket empty', updatedAt: null },
  pocket: {
    balance: 0, mode: 'cut', cap: null, float: 2000,
    have: 0, capBar: 2000,
    stakes: null,
    broke: true, collectable: 0, funded: 0, collected: 0, pnl: 0,
  },
});

// WALLET-5 · called in mid-session: still at a table, still holding a roll, and
// nothing lost. Deliberately not in `pocketAgents` — the four above are the
// design ref's own cast and the row-count assertions read them.
export const cutPlayingAgent = agent({
  id: 'agent_cannon',
  name: 'Loose Cannon',
  presence: 'playing',
  activeTableId: 'tbl-1',
  mood: { state: 'confident', cause: null, updatedAt: null },
  pocket: {
    balance: 4000, mode: 'cut', cap: null, float: 2000,
    have: 4000, capBar: 5000,
    stakes: { smallBlind: 10, bigBlind: 20, label: '$10/$20' },
    // Called in: all of it is the owner's to take back, winnings or not.
    broke: false, collectable: 4000, funded: 4000, collected: 0, pnl: 0,
  },
});

// WALLET-5/7 · the reported shape: seeded on auto at a 2,000 cap, then given
// 4,000. He has won nothing, so under the old rule 2,000 of it read as "above
// the float" and the row offered to collect the owner's own top-up. The server
// now says collectable: 0, and the row offers no Collect at all.
export const toppedUpAgent = agent({
  id: 'agent_topped',
  name: 'Topped Up',
  pocket: {
    balance: 4000, mode: 'auto', cap: 2000, float: 2000,
    have: 4000, capBar: 2000,
    stakes: { smallBlind: 10, bigBlind: 20, label: '$10/$20' },
    broke: false, collectable: 0, funded: 4000, collected: 0, pnl: 0,
  },
});

export const pocketAgents = [balancedAgent, aggressiveAgent, bluffAgent, brokeAgent];

export const walletAgentsResponse = { agents: pocketAgents };

// A deployment with no wallet: agents carry no pocket at all.
export const noPocketAgent = agent({ id: 'agent_plain', name: 'Plain Agent' });
export const noWalletAgentsResponse = { agents: [noPocketAgent] };

// A pocket that still holds chips but cannot cover the entry buy-in. `broke`
// is the server's word for that, and it is a bigger number than zero.
export const shortAgent = agent({
  id: 'agent_short',
  name: 'Short Stack',
  mood: { state: 'frustrated', cause: null, updatedAt: null },
  pocket: {
    balance: 900, mode: 'allowance', cap: 5000, float: 5000,
    have: 900, capBar: 5000,
    stakes: null,
    broke: true, collectable: 0, funded: 5000, collected: 0, pnl: -4100,
  },
});

// WALLET-7 · seated and up: the row that carries all three actions at once.
export const upAndSeatedAgent = agent({
  id: 'agent_up',
  name: 'Up And Seated',
  presence: 'playing',
  activeTableId: 'tbl-1',
  pocket: {
    balance: 5400, mode: 'auto', cap: 3000, float: 3000,
    have: 5400, capBar: 3000,
    stakes: { smallBlind: 25, bigBlind: 50, label: '$25/$50' },
    broke: false, collectable: 2400, funded: 3000, collected: 0, pnl: 2400,
  },
});

// An older projection: no stakes, no float, no pnl. Everything must degrade.
export const legacyPocketAgent = agent({
  id: 'agent_legacy',
  name: 'Legacy Pocket',
  pocket: { balance: 3000, mode: 'topup', cap: 3000, broke: false },
});
