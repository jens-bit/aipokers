// client/src/lib/wallet.test.jsx — WUI-1
// The contract and the money formatting. Every surface reads these, so a
// mistake here is a mistake on four screens at once.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  MODES,
  callInAgent,
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
  collectsEverything,
  signedMoney,
  stakesFor,
} from './wallet.js';
import {
  aggressiveAgent, balancedAgent, brokeAgent, cutPlayingAgent, legacyPocketAgent,
  noPocketAgent, shortAgent, toppedUpAgent, upAndSeatedAgent, wallet,
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
      // WALLET-7: the float is sent, not derived. It used to be computed as
      // balance - collectable, which only held while collect stopped at the
      // float; collectable is now the winnings, and that subtraction would
      // give the principal instead.
      float: 10000,
      broke: false,
      stakesLabel: '$25/$50',
      collectable: 340,
      have: 6400,
      capBar: 10000,
      pnl: 340,
    });
  });

  it('reads the float the projection sends', () => {
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

// WALLET-7 — the row's three actions. "Give him chips" is unconditional,
// Collect is the winnings and only when there are any, and "Call him in" is the
// way the roll itself comes home — offered while he is at a table.
describe('rowActions — give him chips always, the other two when they are honest', () => {
  it('always offers to give him chips — it is the only way to the toggle', () => {
    for (const a of [balancedAgent, aggressiveAgent, brokeAgent, shortAgent, toppedUpAgent, cutPlayingAgent]) {
      expect(rowActions(pocketOf(a)).fund, a.name).toBe(true);
    }
    expect(rowActions(null).fund).toBe(true);
  });

  it('offers Collect beside it when he is up at the tables', () => {
    expect(rowActions(pocketOf(balancedAgent))).toMatchObject({ fund: true, collect: true });
  });

  it('does not call a top-up winnings — the reported bug', () => {
    // 4,000 in the pocket against a 2,000 seeded cap. Under the old rule 2,000
    // of it was "above the float" and Collect offered to take the owner's own
    // top-up back out.
    expect(rowActions(pocketOf(toppedUpAgent))).toEqual({ fund: true, collect: false, callIn: false });
  });

  it('offers no Collect while he is down, however much he still holds', () => {
    expect(rowActions(pocketOf(aggressiveAgent)).collect).toBe(false);
    expect(rowActions(pocketOf(shortAgent)).collect).toBe(false);
  });

  it('offers Call him in while he is seated, and only then', () => {
    expect(rowActions(pocketOf(aggressiveAgent), { seated: true }).callIn).toBe(true);
    expect(rowActions(pocketOf(aggressiveAgent), { seated: false }).callIn).toBe(false);
    // All three at once is a legitimate row: staked, up, and still playing.
    expect(rowActions(pocketOf(upAndSeatedAgent), { seated: true }))
      .toEqual({ fund: true, collect: true, callIn: true });
  });

  it('does not offer to call in an agent who has already been called in', () => {
    // He is on his way to the bar; asking again would be a second answer to a
    // question the owner has answered. Collect is how the rest of it comes home.
    expect(rowActions(pocketOf(cutPlayingAgent), { seated: true }))
      .toEqual({ fund: true, collect: true, callIn: false });
    // Called in and empty: nothing to bring home, and chips are still offered.
    expect(rowActions(pocketOf(brokeAgent))).toEqual({ fund: true, collect: false, callIn: false });
  });
});

describe('collectsEverything — a called-in pocket hands back all of it', () => {
  it('takes the winnings only from every pocket that is still playing', () => {
    expect(collectsEverything(pocketOf(balancedAgent))).toBe(false);
    expect(collectsEverything(pocketOf(aggressiveAgent))).toBe(false);
  });

  it('takes the principal too once he has been called in', () => {
    expect(collectsEverything(pocketOf(cutPlayingAgent))).toBe(true);
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

// WALLET-7 — the store still holds four modes and the row still has to draw a
// tag for each, but the owner-facing vocabulary is the two verbs plus the one
// toggle. 'topup' and 'allowance' were the same thing under two names and now
// read as one: STAKED.
describe('modes', () => {
  it('still reads the four the store holds, because nothing was migrated', () => {
    expect(Object.keys(MODES)).toEqual(['topup', 'allowance', 'auto', 'cut']);
  });

  it('draws the two staked modes as one thing, because they were one thing', () => {
    expect(MODES.topup.label).toBe('STAKED');
    expect(MODES.allowance.label).toBe('STAKED');
    expect(MODES.auto.label).toBe('REFILLS');
  });

  it('labels being called in without a shred of guilt in the copy', () => {
    expect(MODES.cut.label).toBe('CALLED IN');
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

  it('POSTs the verb, the amount and the toggle', async () => {
    fetchMock.route('/fund', { ok: true }, { method: 'POST' });
    await fundAgent('agent_aggressive', { verb: 'give', amount: 500, cap: 500, refill: true });

    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.method).toBe('POST');
    expect(req.url).toContain('agent_aggressive');
    expect(req.body).toMatchObject({ verb: 'give', amount: 500, cap: 500, refill: true });
    expect(req.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });

  // The route maps the verbs onto the modes the store holds, so calling him in
  // is the same endpoint as giving him chips: one decision about how he is
  // backed, and it happens to move the money the other way.
  it('POSTs the call-in as the second verb on the same route', async () => {
    fetchMock.route('/fund', { collected: 4000 }, { method: 'POST' });
    await callInAgent('agent_cannon');

    const [req] = fetchMock.requestsMatching('/fund');
    expect(req.url).toContain('agent_cannon');
    expect(req.body).toMatchObject({ verb: 'callin', amount: null, cap: null });
  });

  it('POSTs a collect, which takes the winnings unless it is told otherwise', async () => {
    fetchMock.route('/collect', { collected: 340 }, { method: 'POST' });
    expect(await collectFrom('agent_balanced')).toEqual({ collected: 340 });
    const [req] = fetchMock.requestsMatching('/collect');
    expect(req.method).toBe('POST');
    expect(req.body).toMatchObject({ all: false });

    await collectFrom('agent_cannon', { all: true });
    expect(fetchMock.requestsMatching('/collect')[1].body).toMatchObject({ all: true });
  });

  it('throws on a refusal so the caller can leave the row as it was', async () => {
    fetchMock.route('/fund', () => ({ status: 402, body: {} }), { method: 'POST' });
    await expect(fundAgent('a', { verb: 'give', amount: 10 })).rejects.toThrow(/402/);
  });
});
