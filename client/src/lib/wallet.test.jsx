// client/src/lib/wallet.test.jsx — WUI-1
// The contract and the money formatting. Every surface reads these, so a
// mistake here is a mistake on four screens at once.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  MODES,
  collectFrom,
  fetchWallet,
  fundAgent,
  hasPocket,
  modeMeta,
  money,
  pnlTone,
  pocketFill,
  pocketOf,
  rowActions,
  collectLeavesFloat,
  signedMoney,
  stakesFor,
} from './wallet.js';
import {
  aggressiveAgent, balancedAgent, brokeAgent, cutPlayingAgent, legacyPocketAgent,
  noPocketAgent, shortAgent, toppedUpAgent, wallet,
} from '../test/fixtures/wallet.js';
import { fetchMock, telegram } from '../test/harness.js';

describe('money', () => {
  // Deliberately locale-independent: toLocaleString would print "2 340,50" on
  // a Swedish machine and "2,340.50" on CI, and the design says one of those.
  it('groups thousands with a comma and shows cents only when there are cents', () => {
    expect(money(2340.5)).toBe('$2,340.50');
    expect(money(1150)).toBe('$1,150');
    expect(money(640)).toBe('$640');
    expect(money(0)).toBe('$0');
    expect(money(1234567)).toBe('$1,234,567');
  });

  it('uses a real minus sign, not a hyphen, so figures stay aligned', () => {
    expect(money(-90)).toBe('−$90');
    expect(money(-90).startsWith('-')).toBe(false);
  });

  it('adds a plus only when asked', () => {
    expect(money(486)).toBe('$486');
    expect(money(486, { sign: true })).toBe('+$486');
  });

  it('is an em dash for anything that is not a number', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money('lots')).toBe('—');
  });
});

describe('signedMoney', () => {
  it('always carries the sign for a P&L figure', () => {
    expect(signedMoney(340)).toBe('+$340');
    expect(signedMoney(-90)).toBe('−$90');
  });

  it('shows a flat zero rather than a signed one', () => {
    expect(signedMoney(0)).toBe('$0');
  });

  it('shows an em dash when there is no number, never a misleading $0', () => {
    expect(signedMoney(null)).toBe('—');
  });
});

describe('pnlTone', () => {
  it('reads up, down and flat', () => {
    expect(pnlTone(340)).toBe('up');
    expect(pnlTone(-90)).toBe('down');
    expect(pnlTone(0)).toBe('flat');
    expect(pnlTone(null)).toBe('flat');
  });
});

describe('pocketOf', () => {
  it('normalises the shipped pocketProjection', () => {
    expect(pocketOf(balancedAgent)).toEqual({
      balance: 6400,
      mode: 'auto',
      cap: 10000,
      // Not sent directly: derived as balance - collectable, which is what
      // collect leaves behind and what auto refills back up to.
      float: 2000,
      broke: false,
      stakesLabel: '$25/$50',
      collectable: 4400,
      have: 6400,
      capBar: 10000,
      pnl: 340,
    });
  });

  it('reads a float sent directly, when one ever is', () => {
    expect(pocketOf({ pocket: { balance: 6400, mode: 'auto', float: 2500 } }).float).toBe(2500);
  });

  it('degrades an older projection with no stakes, float or pnl', () => {
    expect(pocketOf(legacyPocketAgent)).toMatchObject({
      balance: 3000, mode: 'topup', cap: 3000,
      float: null, stakesLabel: null, collectable: null, pnl: null,
    });
  });

  it('is null when the agent has no pocket, so absence is answerable', () => {
    expect(pocketOf(noPocketAgent)).toBeNull();
    expect(pocketOf({})).toBeNull();
    expect(pocketOf(null)).toBeNull();
    expect(hasPocket(noPocketAgent)).toBe(false);
    expect(hasPocket(balancedAgent)).toBe(true);
  });

  it('treats a zero balance as broke whatever the flag says', () => {
    expect(pocketOf({ pocket: { balance: 0, mode: 'topup', broke: false } }).broke).toBe(true);
  });

  it('falls back to a known mode rather than rendering an unknown tag', () => {
    expect(pocketOf({ pocket: { balance: 10, mode: 'wat' } }).mode).toBe('topup');
  });

  it('leaves pnl null when the contract did not carry one', () => {
    expect(pocketOf({ pocket: { balance: 10, mode: 'topup' } }).pnl).toBeNull();
  });
});

describe('pocketFill', () => {
  it('draws have against capBar, the two fields the projection sends for it', () => {
    expect(pocketFill(pocketOf(balancedAgent))).toBe(64);   // 6400 of a 10000 cap
    expect(pocketFill(pocketOf(aggressiveAgent))).toBe(42); // 2100 of a 5000 allowance
  });

  it('still fills for a pocket the server calls broke, so short reads as short', () => {
    expect(pocketFill(pocketOf(brokeAgent))).toBe(0);
    expect(pocketFill(pocketOf(shortAgent))).toBe(18); // 900 of 5000
  });

  it('is empty when he is broke', () => {
    expect(pocketFill(pocketOf(brokeAgent))).toBe(0);
  });

  it('never overflows the bar', () => {
    expect(pocketFill({ have: 900, capBar: 300, broke: false })).toBe(100);
  });
});

// WALLET-5 replaces the old "one primary action per row, never two" rule. That
// rule is what the playtest reported: funding an agent past his float removed
// the Fund button, leaving no way to change his mode or add more. Fund is now
// unconditional and Collect is the second, optional action.
describe('rowActions — Fund is always offered, Collect only when it is honest', () => {
  it('always offers Fund — it is the only way into the mode', () => {
    for (const a of [balancedAgent, aggressiveAgent, brokeAgent, shortAgent, toppedUpAgent, cutPlayingAgent]) {
      expect(rowActions(pocketOf(a)).fund, a.name).toBe(true);
    }
    expect(rowActions(null).fund).toBe(true);
  });

  it('offers Collect beside it when he is up at the tables', () => {
    expect(rowActions(pocketOf(balancedAgent))).toEqual({ fund: true, collect: true });
  });

  it('does not call a top-up winnings — the reported bug', () => {
    // 4,000 in the pocket against a 2,000 seeded cap: 2,000 of it is "above
    // the float" without his having won a chip.
    expect(rowActions(pocketOf(toppedUpAgent))).toEqual({ fund: true, collect: false });
  });

  it('offers no Collect while he is down, however much he still holds', () => {
    expect(rowActions(pocketOf(aggressiveAgent))).toEqual({ fund: true, collect: false });
    expect(rowActions(pocketOf(shortAgent))).toEqual({ fund: true, collect: false });
  });

  it('offers Collect on a cut-off pocket that still holds a roll', () => {
    // He is not going to play it, so all of it is the owner's to take back.
    expect(rowActions(pocketOf(cutPlayingAgent))).toEqual({ fund: true, collect: true });
    // Cut off and empty is Fund alone: there is nothing to bring home.
    expect(rowActions(pocketOf(brokeAgent))).toEqual({ fund: true, collect: false });
  });
});

describe('collectLeavesFloat — cutting him off hands back all of it', () => {
  it('leaves the float behind for every mode that still plays', () => {
    expect(collectLeavesFloat(pocketOf(balancedAgent))).toBe(true);
    expect(collectLeavesFloat(pocketOf(aggressiveAgent))).toBe(true);
  });

  it('leaves nothing behind when he is cut off — the float buys him no seat', () => {
    expect(collectLeavesFloat(pocketOf(cutPlayingAgent))).toBe(false);
  });
});

describe('stakesFor — the server owns the ladder', () => {
  // src/server/wallet.js picks the rung and sends its label. A second ladder
  // in the client would eventually disagree with the one that decides where
  // he really sits, so the label wins whenever it is there.
  it('reports the rung the server actually seated him at', () => {
    expect(stakesFor(pocketOf(balancedAgent))).toBe('$25/$50');
    expect(stakesFor(pocketOf(aggressiveAgent))).toBe('$10/$20');
  });

  it('is an em dash for a broke pocket — he is not sitting anywhere', () => {
    expect(stakesFor(pocketOf(brokeAgent))).toBe('—');
    expect(stakesFor(pocketOf(shortAgent))).toBe('—');
    expect(stakesFor(null)).toBe('—');
  });

  it('falls back to the ladder, keyed off the float, with no label', () => {
    expect(stakesFor({ float: 10000, broke: false })).toBe('$50/$100');
    expect(stakesFor({ float: 5000, broke: false })).toBe('$25/$50');
    expect(stakesFor({ float: 2000, broke: false })).toBe('$10/$20');
    // Below the entry buy-in there is no rung to sit at.
    expect(stakesFor({ float: 900, broke: false })).toBe('—');
  });

  it('falls back further to the cap, then the balance', () => {
    expect(stakesFor({ cap: 5000, broke: false })).toBe('$25/$50');
    expect(stakesFor({ balance: 2000, broke: false })).toBe('$10/$20');
  });
});

describe('modes', () => {
  it('carries the four the funding sheet offers', () => {
    expect(Object.keys(MODES)).toEqual(['topup', 'allowance', 'auto', 'cut']);
  });

  it('labels cut off without a shred of guilt in the copy', () => {
    expect(MODES.cut.label).toBe('CUT OFF');
    expect(MODES.cut.line).toContain('not a punishment');
  });

  it('degrades an unknown mode instead of throwing', () => {
    expect(modeMeta('nonsense')).toBe(MODES.topup);
  });
});

describe('fetchWallet — absence is a first-class answer', () => {
  beforeEach(() => { telegram.signIn(); });

  it('returns the wallet when there is one', async () => {
    fetchMock.route('/api/wallet', wallet);
    expect(await fetchWallet()).toEqual({
      balance: 2340.5,
      staked: 1150,
      session: 486,
      playing: { live: 2, total: 4 },
      ledger: wallet.ledger,
    });
  });

  it('sends the credential', async () => {
    fetchMock.route('/api/wallet', wallet);
    await fetchWallet();
    expect(fetchMock.requestsMatching('/api/wallet')[0].headers['x-telegram-init-data'])
      .toBe(telegram.webApp.initData);
  });

  it('is null when the endpoint does not exist yet', async () => {
    fetchMock.route('/api/wallet', () => ({ status: 404, body: {} }));
    expect(await fetchWallet()).toBeNull();
  });

  it('leaves playing null on a projection that predates the tile', async () => {
    const { playing, ...older } = wallet;
    fetchMock.route('/api/wallet', older);
    expect((await fetchWallet()).playing).toBeNull();
  });

  it('is null when the body is not a wallet', async () => {
    fetchMock.route('/api/wallet', { nonsense: true });
    expect(await fetchWallet()).toBeNull();
  });

  it('is null rather than a throw when the network fails', async () => {
    fetchMock.route('/api/wallet', () => { throw new Error('offline'); });
    expect(await fetchWallet()).toBeNull();
  });
});

describe('fund and collect', () => {
  beforeEach(() => { telegram.signIn(); });

  it('POSTs the funding decision in the contract shape', async () => {
    fetchMock.route('/fund', { ok: true }, { method: 'POST' });
    await fundAgent('agent_aggressive', { mode: 'allowance', amount: 500, cap: null });

    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.method).toBe('POST');
    expect(req.url).toContain('agent_aggressive');
    expect(req.body).toMatchObject({ mode: 'allowance', amount: 500, cap: null });
    expect(req.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });

  it('POSTs a collect', async () => {
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    expect(await collectFrom('agent_balanced')).toEqual({ collected: 340 });
    expect(fetchMock.requestsMatching('/collect')[0].method).toBe('POST');
  });

  it('throws on a refusal so the caller can leave the row as it was', async () => {
    fetchMock.route('/fund', () => ({ status: 402, body: {} }), { method: 'POST' });
    await expect(fundAgent('a', { mode: 'topup', amount: 10 })).rejects.toThrow(/402/);
  });
});
