// client/src/components/floor/agentView.test.jsx — TEST-1
//
// The pure helpers the floor draws itself from. presenceOf and stateOf are the
// BUG-16 surface: they decide whether an agent reads as live, so they must
// follow what the API says and never invent it.

import { describe, expect, it } from 'vitest';

import {
  causeOf,
  hasUnseenRecap,
  lastMomentOf,
  moodOf,
  potOf,
  presenceOf,
  splitFloor,
  standupLine,
  stateOf,
} from './agentView.js';
import { playingAgent, restingAgent } from '../../test/fixtures/agents.js';

describe('presenceOf', () => {
  it('takes the API answer when there is one', () => {
    expect(presenceOf(playingAgent)).toBe('playing');
    expect(presenceOf(restingAgent)).toBe('resting');
  });

  it('falls back to the stored flags only when presence is absent', () => {
    expect(presenceOf({ activeTableId: 'tbl-1' })).toBe('playing');
    expect(presenceOf({ status: 'playing' })).toBe('playing');
    expect(presenceOf({})).toBe('resting');
  });

  it('ignores a presence value it does not recognise', () => {
    expect(presenceOf({ presence: 'dancing' })).toBe('resting');
  });

  it('is resting for a missing agent rather than throwing', () => {
    expect(presenceOf(null)).toBe('resting');
    expect(presenceOf(undefined)).toBe('resting');
  });
});

describe('moodOf', () => {
  it('reads the mood state', () => {
    expect(moodOf(playingAgent)).toBe('confident');
    expect(moodOf(restingAgent)).toBe('frustrated');
  });

  it('degrades any unknown or missing mood to neutral', () => {
    expect(moodOf({ mood: { state: 'euphoric' } })).toBe('neutral');
    expect(moodOf({})).toBe('neutral');
    expect(moodOf(null)).toBe('neutral');
  });
});

describe('causeOf', () => {
  it('returns the cause the API supplied', () => {
    expect(causeOf(playingAgent)).toBe('stacked the loose one');
  });

  it('never invents one', () => {
    expect(causeOf({ mood: { state: 'tilted' } })).toBeNull();
    expect(causeOf({ mood: { state: 'tilted', cause: '   ' } })).toBeNull();
    expect(causeOf(null)).toBeNull();
  });
});

describe('stateOf', () => {
  it('is live while playing, whatever else is true', () => {
    expect(stateOf(playingAgent)).toBe('live');
    expect(stateOf({ ...playingAgent, unseenRecap: true })).toBe('live');
  });

  it('is recap for a resting agent with an unread session', () => {
    expect(stateOf(restingAgent)).toBe('recap');
    expect(hasUnseenRecap(restingAgent)).toBe(true);
  });

  it('is resting otherwise', () => {
    expect(stateOf({ presence: 'resting', unseenRecap: false })).toBe('resting');
  });
});

describe('lastMomentOf', () => {
  it('quotes the agent when the API gave it a line', () => {
    expect(lastMomentOf(playingAgent)).toBe('Flopped a set and got paid.');
  });

  it('says it is at the table when playing with no line', () => {
    expect(lastMomentOf({ presence: 'playing' })).toBe('At the table.');
  });

  it('derives a line from recent hands when resting', () => {
    expect(lastMomentOf({ recentHands: [{ won: true }, { won: true }] }))
      .toBe('Won every hand I finished. Good session.');
    expect(lastMomentOf({ recentHands: [{ won: false }, { won: false }] }))
      .toBe('Rough run — lost the last few.');
    expect(lastMomentOf({ recentHands: [{ won: true }, { won: false }] }))
      .toBe('Won 1 of my last 2.');
  });

  it('has something to say for an agent that has never played', () => {
    expect(lastMomentOf({})).toBe('Never played a hand yet.');
    expect(lastMomentOf({ stats: { handsPlayed: 12 } })).toBe('Resting between sessions.');
  });
});

describe('potOf', () => {
  // Grouped by the runtime's own locale — the separator is a comma on CI and a
  // narrow space on a Swedish laptop, so the expectation asks the same
  // question the code does rather than pinning one machine's answer.
  it('formats a live pot with thousands separators', () => {
    expect(potOf(playingAgent, { pot: 12500 })).toBe((12500).toLocaleString());
    expect(potOf(playingAgent, { pot: 12500 })).not.toBe('12500');
  });

  it('shows nothing when there is no live number', () => {
    expect(potOf(playingAgent, { pot: 0 })).toBeNull();
    expect(potOf(playingAgent, null)).toBeNull();
    expect(potOf(playingAgent, { pot: 'lots' })).toBeNull();
  });
});

describe('splitFloor', () => {
  it('separates the felt from the bar', () => {
    const { playing, resting, lounge } = splitFloor([playingAgent, restingAgent]);
    expect(playing.map((a) => a.id)).toEqual(['agent_grinder']);
    expect(resting.map((a) => a.id)).toEqual(['agent_cannon']);
    expect(lounge).toEqual([]);
  });

  it('sends sulking and tilted agents to the lounge corner', () => {
    const sulk = { presence: 'resting', mood: { state: 'sulking' }, id: 'a' };
    const tilt = { presence: 'resting', mood: { state: 'tilted' }, id: 'b' };
    const { resting, lounge } = splitFloor([sulk, tilt]);
    expect(lounge.map((a) => a.id)).toEqual(['a', 'b']);
    expect(resting).toEqual([]);
  });

  it('keeps a playing agent on the felt even when it is tilted', () => {
    const tilted = { presence: 'playing', mood: { state: 'tilted' }, id: 'a' };
    const { playing, lounge } = splitFloor([tilted]);
    expect(playing).toHaveLength(1);
    expect(lounge).toEqual([]);
  });
});

describe('standupLine', () => {
  const line = (playing, resting, lounge, total) =>
    standupLine({ playing: Array(playing).fill({}), resting: Array(resting).fill({}), lounge: Array(lounge).fill({}), total });

  it('opens the room when there is nobody', () => {
    expect(line(0, 0, 0, 0)).toBe('The room is open.');
  });

  // FL-2: "Everyone's resting." is retired by wave 34 — it was a dead room,
  // a sentence that told the owner nothing had happened and gave him nothing
  // to look at. A count, and then whatever actually happened.
  it('counts the room rather than passing a verdict on it', () => {
    expect(line(0, 2, 1, 3)).toBe('Three resting · the room is quiet');
    expect(line(0, 1, 0, 1)).toBe('One resting · the room is quiet');
  });

  it('names what happened when somebody has news', () => {
    expect(standupLine({
      playing: [],
      resting: [{ name: 'Bluff Master', attrLog: [{ ts: 1000, key: 'a', from: 1, to: 3 }] }],
      lounge: [],
      total: 1,
      now: 1000,
    })).toBe('One resting · Bluff Master grew tonight');
  });

  it('says the money first, because it is what the owner can act on', () => {
    expect(standupLine({
      playing: [],
      resting: [],
      lounge: [{ name: 'Value Bot', presence: 'broke' }],
      total: 1,
    })).toBe('One resting · Value Bot is out of money');
  });

  it('counts the felt and the bar together', () => {
    expect(line(1, 1, 0, 2)).toBe('1 playing · 1 resting');
    expect(line(2, 1, 1, 4)).toBe('2 playing · 2 resting');
  });

  it('drops the resting half when everyone is playing', () => {
    expect(line(3, 0, 0, 3)).toBe('3 playing');
  });
});
