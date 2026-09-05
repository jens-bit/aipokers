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
  primaryAction,
  signedMoney,
  stakesFor,
} from './wallet.js';
import { aggressiveAgent, balancedAgent, brokeAgent, noPocketAgent, wallet } from '../test/fixtures/wallet.js';
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
  it('normalises a pocket from the contract', () => {
    expect(pocketOf(balancedAgent)).toEqual({
      balance: 640, mode: 'auto', cap: 1000, broke: false, pnl: 340,
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
  it('draws money he has against the roll he was given', () => {
    expect(pocketFill(pocketOf(balancedAgent))).toBe(64);   // 640 of a 1000 cap
    expect(pocketFill(pocketOf(aggressiveAgent))).toBe(42); // 210 of a 500 allowance
  });

  it('is empty when he is broke', () => {
    expect(pocketFill(pocketOf(brokeAgent))).toBe(0);
  });

  it('never overflows the bar', () => {
    expect(pocketFill({ balance: 900, cap: 300, broke: false })).toBe(100);
  });
});

describe('primaryAction — one action per row, never two', () => {
  it('offers Collect while he is carrying money home', () => {
    expect(primaryAction(pocketOf(balancedAgent))).toBe('collect');
    expect(primaryAction(pocketOf(aggressiveAgent))).toBe('collect');
  });

  it('offers Fund when there is nothing to collect', () => {
    expect(primaryAction(pocketOf(brokeAgent))).toBe('fund');
  });
});

describe('stakesFor — pocket size sets his stakes', () => {
  it('reads the roll he was given, not the balance of the moment', () => {
    // The ref: a $500 allowance seats him at $10/$20 even on $210 left.
    expect(stakesFor(pocketOf(aggressiveAgent))).toBe('$10/$20');
    expect(stakesFor({ balance: 40, cap: 300, broke: false })).toBe('$5/$10');
  });

  it('falls back to the balance when there is no cap', () => {
    expect(stakesFor({ balance: 600, cap: null, broke: false })).toBe('$10/$20');
    expect(stakesFor({ balance: 100, cap: null, broke: false })).toBe('$2/$5');
  });

  it('is an em dash for a broke pocket — he is not sitting anywhere', () => {
    expect(stakesFor(pocketOf(brokeAgent))).toBe('—');
    expect(stakesFor(null)).toBe('—');
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
      balance: 2340.5, staked: 1150, session: 486, ledger: wallet.ledger,
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
