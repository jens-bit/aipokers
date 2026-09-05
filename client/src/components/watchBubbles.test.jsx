// client/src/components/watchBubbles.test.jsx — W4-3
//
// "v4 put his voice in a panel under the felt. Right instinct, wrong place: a
// feed is a log you read, and what an owner wants is to watch someone talk."
//
// THE BUBBLE LAW (design-refs/mood-watch4.jsx header):
//   · one bubble per seat at a time, and at most TWO on the felt at once
//   · 3–4 seconds, then gone. Never a queue, never a stack, never a scrollback
//   · his sits above HIM (v6: the top of the hero column, over his head);
//     an opponent's sits above their own ghost
//   · a bubble that would be cut off is not shown — the record has it either way

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { onFelt, record, fits, BUBBLE_MS, MAX_ON_FELT, OPP_MAX_CHARS } from '../lib/bubbles.js';
import { midHandGame } from '../test/fixtures/game.js';
import { telegram } from '../test/harness.js';

const at = (n) => ({ at: n });
const u = (id, seat, text, mine, when) => ({ id, seat, text, mine, at: when });

describe('W4-3: the bubble law, as arithmetic', () => {
  const now = 10_000;

  it('one bubble per seat — a seat that speaks twice replaces itself', () => {
    const out = onFelt([
      u('a', 1, 'Again?', false, now - 100),
      u('b', 1, 'Call.', false, now - 50),
    ], now);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Call.');
  });

  it('at most two on the felt, and the newest win', () => {
    const out = onFelt([
      u('a', 1, 'One.', false, now - 300),
      u('b', 2, 'Two.', false, now - 200),
      u('c', 3, 'Three.', false, now - 100),
    ], now);
    expect(out).toHaveLength(MAX_ON_FELT);
    expect(out.map((b) => b.text)).toEqual(['Two.', 'Three.']);
  });

  it('3–4 seconds, then gone — never a scrollback', () => {
    const said = [u('a', 1, 'Again?', false, now - BUBBLE_MS + 10)];
    expect(onFelt(said, now)).toHaveLength(1);
    expect(onFelt(said, now + 20)).toHaveLength(0);
  });

  it('a bubble that would be cut off is not shown', () => {
    const tooLong = 'x'.repeat(OPP_MAX_CHARS + 1);
    expect(fits(tooLong, false)).toBe(false);
    expect(onFelt([u('a', 1, tooLong, false, now)], now)).toHaveLength(0);
  });

  it('his band is two lines, so his fits where theirs would not', () => {
    const long = 'He checked the turn, so he is capped, and I am betting 240 for value here.';
    expect(fits(long, false)).toBe(false);
    expect(fits(long, true)).toBe(true);
  });

  it('the record has it either way — that is the point of the last clause', () => {
    const tooLong = 'x'.repeat(OPP_MAX_CHARS + 1);
    const said = [
      u('a', 1, tooLong, false, now),
      u('b', 2, 'Old news.', false, now - BUBBLE_MS * 4),
    ];
    expect(onFelt(said, now)).toHaveLength(0);
    // Nothing said is lost: the felt is the performance, the thread is the record.
    expect(record(said)).toHaveLength(2);
  });

  it('an empty stream is an empty felt, not a crash', () => {
    expect(onFelt(null, now)).toEqual([]);
    expect(record(undefined)).toEqual([]);
  });

  it('drops an utterance with nothing in it', () => {
    expect(record([u('a', 1, '   ', false, now)])).toHaveLength(0);
    expect(fits('', false)).toBe(false);
  });
});

const props = {
  game: midHandGame,
  mySeat: 0,
  chatMessages: [],
  sendChat: () => {},
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  onLeave: () => {},
  config: { isSpectator: true, agentId: 'a1', tableId: 't1' },
};

describe('W4-3: speech on the felt', () => {
  beforeEach(() => { vi.useFakeTimers(); telegram.signIn(); });
  afterEach(() => { vi.useRealTimers(); });

  const bubbles = () => document.querySelectorAll('.bubble');

  it('there is no line under the board any more', () => {
    act(() => {
      render(<WatchScreen {...props} lastDecision={{ seat: 0, reasoning: 'He is capped.' }} />);
    });
    expect(document.querySelector('.watch-felt__line')).toBeNull();
  });

  it('his decision becomes a bubble in his own band', () => {
    act(() => {
      render(<WatchScreen {...props} lastDecision={{ seat: 0, reasoning: 'He is capped.' }} />);
    });
    const mine = document.querySelector('.bubble--mine');
    expect(mine).toBeTruthy();
    expect(mine.textContent).toContain('He is capped.');
    // WATCH-6 re-expressed: the reserved band under the seat ring is gone. His
    // bubble is now the first thing in the HERO COLUMN — above his head, part
    // of the same flow, so a two-line bubble moves him rather than landing on
    // him. That the band belongs to him is the rule; where it hangs is not.
    const band = document.querySelector('.watch-hero__says');
    expect(band).toBeTruthy();
    expect(band.contains(mine)).toBe(true);
  });

  it('table talk becomes a bubble over the seat that said it', () => {
    act(() => {
      render(<WatchScreen {...props} chatMessages={[{ isAI: true, seat: 1, text: 'Again?', t: Date.now() }]} />);
    });
    const theirs = document.querySelector('.bubble:not(.bubble--mine)');
    expect(theirs).toBeTruthy();
    expect(theirs.textContent).toContain('Again?');
  });

  it('a bubble goes after its few seconds rather than staying', () => {
    act(() => {
      render(<WatchScreen {...props} chatMessages={[{ isAI: true, seat: 1, text: 'Again?', t: Date.now() }]} />);
    });
    expect(bubbles().length).toBe(1);

    act(() => { vi.advanceTimersByTime(BUBBLE_MS + 600); });
    expect(bubbles().length).toBe(0);
  });

  it('never more than two on the felt at once', () => {
    const now = Date.now();
    act(() => {
      render(
        <WatchScreen
          {...props}
          lastDecision={{ seat: 0, reasoning: 'He is capped.' }}
          chatMessages={[
            { isAI: true, seat: 1, text: 'Again?', t: now },
            { isAI: true, seat: 2, text: 'Call.', t: now },
          ]}
        />,
      );
    });
    expect(bubbles().length).toBeLessThanOrEqual(MAX_ON_FELT);
  });
});
