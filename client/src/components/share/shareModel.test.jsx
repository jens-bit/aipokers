// SHARE-1 — the card's data mapping.
//
// Everything the card can say is decided in buildShareModel, so this is where
// the card is actually specified: which board, which two cards, what the result
// line reads, whose line is quoted, and what is deliberately absent.

import { describe, expect, it } from 'vitest';

import {
  buildShareModel, formatAmount, shareCaption, shareFilename, talkLine, MARK,
} from './shareModel.js';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';

const model = (hand, who = { agentName: 'Aggressive v1.3', mood: 'tilted' }) =>
  buildShareModel(hand, who);

describe('formatAmount', () => {
  it('signs the pot and groups the thousands', () => {
    expect(formatAmount(3694, true)).toBe('+$3,694');
    expect(formatAmount(1840, false)).toBe('−$1,840');
    expect(formatAmount(0, true)).toBe('+$0');
    expect(formatAmount(undefined, false)).toBe('−$0');
  });
});

describe('talkLine', () => {
  it('takes the last thing he said in the hand', () => {
    expect(talkLine(badBeatHand)).toBe('He got there. I called anyway and I should not have.');
  });

  it('never composes one — silence stays silent', () => {
    expect(talkLine({ streets: [{ reasoning: '   ' }, { reasoning: null }] })).toBeNull();
    expect(talkLine({})).toBeNull();
    expect(talkLine(null)).toBeNull();
  });
});

describe('buildShareModel', () => {
  it('names him, and falls back rather than inventing', () => {
    expect(model(badBeatHand).name).toBe('Aggressive v1.3');
    expect(buildShareModel(badBeatHand, {}).name).toBe('Your agent');
    // The theatre spreads the name onto the hand; the card reads it there too.
    expect(buildShareModel({ ...badBeatHand, agentName: 'Granite' }, {}).name).toBe('Granite');
  });

  it('takes his mood for the face and the light behind it', () => {
    expect(model(badBeatHand).mood).toBe('tilted');
    expect(model(badBeatHand).moodColor).toBe('#FF4D4F');
    // An unknown mood is not a colour — it is neutral.
    expect(model(badBeatHand, { mood: 'exuberant' }).mood).toBe('neutral');
    expect(buildShareModel(badBeatHand, {}).mood).toBe('neutral');
  });

  it('carries the flag that says why this hand was worth keeping', () => {
    expect(model(badBeatHand).flag).toMatchObject({ label: 'BAD BEAT', tone: 'red', color: '#FF4D4F' });
    expect(model(bigBluffHand).flag).toMatchObject({ label: 'BIG BLUFF', tone: 'gold' });
  });

  it('shows his two cards and the board as it finished', () => {
    const m = model(badBeatHand);
    expect(m.holeCards).toEqual(['Ah', 'Ad']);
    expect(m.board).toEqual(['2s', '7h', 'Kd', '4c', '9s']);
  });

  it('reads the result line the way the ref writes it', () => {
    // −$1,840 with aces on a nine-high river: a pair, and it lost.
    expect(model(badBeatHand).result).toBe('−$1,840 · pair of aces');
    expect(model(badBeatHand).amount).toBe('−$1,840');
    expect(model(badBeatHand).hand).toBe('pair of aces');
    expect(model(badBeatHand).resultColor).toBe('#FF4D4F');

    const won = model(bigBluffHand);
    expect(won.result).toBe('+$620 · ace-high');
    expect(won.resultColor).toBe('#00D4AA');
    expect(won.won).toBe(true);
  });

  it('says only the amount when the hand cannot be named', () => {
    // No hole cards — the API withholds them from anyone but the owner.
    const hidden = model({ ...badBeatHand, holeCards: [] });
    expect(hidden.holeCards).toEqual([]);
    expect(hidden.hand).toBeNull();
    expect(hidden.result).toBe('−$1,840');

    // Folded preflop: two cards, no board.
    const preflop = model({
      ...badBeatHand,
      streets: [{ street: 'preflop', board: [], action: 'fold', reasoning: 'No.' }],
    });
    expect(preflop.board).toEqual([]);
    expect(preflop.hand).toBeNull();
  });

  it('drops cards it cannot read rather than drawing a back', () => {
    const m = model({ ...badBeatHand, holeCards: ['Ah', null] });
    expect(m.holeCards).toEqual(['Ah']);
    expect(m.hand).toBeNull();
  });

  it('quotes his last line and stamps the hand', () => {
    expect(model(badBeatHand).talk).toBe('He got there. I called anyway and I should not have.');
    expect(model(badBeatHand).stamp).toBe('HAND #37');
    expect(model({ ...badBeatHand, handNumber: null }).stamp).toBeNull();
  });

  it('carries the mark and nothing that asks for a signup', () => {
    const m = model(badBeatHand);
    expect(m.mark).toBe('agenticpoker.app');
    const flat = JSON.stringify(m).toLowerCase();
    for (const ad of ['invite', 'referral', 'sign up', 'signup', 'download', 'join']) {
      expect(flat).not.toContain(ad);
    }
  });
});

describe('the words that travel with it', () => {
  it('captions with his line, then who and what it cost, then the mark', () => {
    expect(shareCaption(model(badBeatHand))).toBe(
      '“He got there. I called anyway and I should not have.”\n'
      + 'Aggressive v1.3 · −$1,840 · pair of aces\n'
      + MARK,
    );
  });

  it('leaves the quote out when he said nothing', () => {
    const quiet = model({ ...badBeatHand, streets: [{ street: 'flop', board: ['2s', '7h', 'Kd'], action: 'bet 10' }] });
    expect(shareCaption(quiet)).not.toContain('“');
  });

  it('names the file so it is recognisable in a downloads folder', () => {
    expect(shareFilename(model(badBeatHand))).toBe('agenticpoker-aggressive-v1-3-37.png');
    expect(shareFilename(model({ ...badBeatHand, handNumber: null }))).toBe('agenticpoker-aggressive-v1-3.png');
  });
});
