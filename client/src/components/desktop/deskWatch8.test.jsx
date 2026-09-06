// client/src/components/desktop/deskWatch8.test.jsx — WATCH-8, job 3.
//
// THE DESKTOP WATCH gets the same three things the phone got, from the same
// modules — because two surfaces showing one table must not be able to disagree
// about what was said at it or about what shape the agent is in.
//
//   1. The thread survives: the rail merges this stay's STORED lines with what
//      is being said now, by id, keeping the server's timestamps.
//   2. The body: two 2px bars on his strip and on every seat chip.
//   3. The bottle, beside his stack.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeskTableStage } from './DeskTableStage.jsx';
import { WatchRail } from './WatchRail.jsx';
import { rowFromLine } from '../../lib/thread.js';
import { HEAT_FIRE } from '../system/FeltBodyBars.jsx';

// A fixed moment safely in the past, so "the server's clock" is 18:31 whatever
// time of day the suite runs and a live line is always the newer of the two.
const T = new Date(2026, 7, 1, 18, 31, 0).getTime();

const seat = (over = {}) => ({
  displayName: 'Someone', stack: 1000, holeCards: [], committed: 0, folded: false,
  mood: { state: 'neutral', heat: 30 }, ...over,
});

const game = (over = {}) => ({
  street: 'turn', pot: 480, currentBet: 240, toAct: 1, handNumber: 12,
  sessionId: 'sess-7',
  community: ['5c', '4h', '8c', 'Kd'],
  seats: [
    seat({ displayName: 'Balanced v2.1', stack: 1847, holeCards: ['As', 'Kh'],
      mood: { state: 'confident', heat: 54 }, fatigue: 'settled' }),
    seat({ displayName: 'Granite', stack: 2104, mood: { state: 'tilted', heat: 100 }, fatigue: 'worn' }),
  ],
  ...over,
});

const stage = (over = {}) => render(
  <DeskTableStage game={game(over)} agentName="Balanced v2.1" lastDecision={null}
    onBack={() => {}} onSitOut={() => {}} />,
).container;

const fillOf = (root, which) => root
  .querySelector(`[data-bar="${which}"] .felt-bars__fill`);

describe('WATCH-8 job 3: the desk carries the body too', () => {
  it('puts both bars on his strip', () => {
    const c = stage();
    const strip = c.querySelector('.dtb__strip');
    expect(strip.querySelectorAll('.felt-bars__track')).toHaveLength(2);
    // HOME-2 job 2: settled is 52% of the line, in amber. The old thirds put
    // it at 67% and in the same green as fresh.
    expect(fillOf(strip, 'stamina').style.width).toBe('52%');
    expect(fillOf(strip, 'heat').style.width).toBe('54%');
  });

  it('puts the same two on every seat chip', () => {
    const c = stage();
    const chip = c.querySelector('.dtb__seat .seat-chip');
    expect(chip.querySelectorAll('.felt-bars__track')).toHaveLength(2);
    // HOME-2 job 2: worn is the short red stub, 16% of the line.
    expect(fillOf(chip, 'stamina').style.width).toBe('16%');
    expect(fillOf(chip, 'heat').style.width).toBe('100%');
    const rgb = /rgb\((\d+), (\d+), (\d+)\)/.exec(fillOf(chip, 'heat').style.background);
    expect(rgb.slice(1).map(Number))
      .toEqual([1, 3, 5].map((i) => parseInt(HEAT_FIRE.slice(i, i + 2), 16)));
  });

  // A seat with no agent behind it has no fatigue, and a server that has never
  // heard of WATCH-8 sends none at all.
  it('draws no stamina line where there is no fatigue to draw', () => {
    const c = stage({ seats: [seat({ displayName: 'Balanced v2.1' }), seat()] });
    expect(c.querySelector('.dtb__strip [data-bar="stamina"]')).toBeNull();
    expect(c.querySelector('.dtb__strip [data-bar="heat"]')).toBeTruthy();
    expect(c.querySelector('.seat-chip [data-bar="stamina"]')).toBeNull();
  });

  // The dealer pip hangs off the chip's top corner; an overflow clip to keep
  // the bars inside the radius would cut it in half, so they are inset instead.
  it('does not clip the chip to fit the bars in', () => {
    const chip = stage().querySelector('.seat-chip');
    expect(chip.style.overflow).toBe('');
  });
});

describe('WATCH-8 job 3: the bottle, on the desk', () => {
  it('stands beside his stack and beside a seat\'s', () => {
    const c = stage({
      seats: [
        seat({ displayName: 'Balanced v2.1', drinking: true, fatigue: 'fresh' }),
        seat({ displayName: 'Granite', drinking: true }),
      ],
    });
    expect(c.querySelector('.dtb__hero-stack .bottle')).toBeTruthy();
    expect(c.querySelector('.seat-chip .bottle')).toBeTruthy();
  });

  it('is absent until FRIDGE-1 says otherwise', () => {
    const c = stage();
    expect(c.querySelector('.bottle')).toBeNull();
  });
});

describe('WATCH-8 job 3: the rail keeps the record', () => {
  const stored = [
    rowFromLine({ id: 1, ts: T, kind: 'table', who: 'TABLE', text: 'Granite raised to 240' }),
    rowFromLine({ id: 2, ts: T + 1000, kind: 'opponent', who: 'Granite', text: 'Again?' }),
  ];

  const rail = (props = {}) => render(
    <WatchRail agent={{ id: 'a1', name: 'Balanced v2.1' }} game={game()} heroSeat={0}
      lastDecision={null} hands={[]} thread={[]} draft="" onDraftChange={() => {}}
      onSend={() => {}} onClose={() => {}} {...props} />,
  ).container;

  it('prints this stay\'s stored lines, with the server\'s clock', () => {
    const c = rail({ stored });
    const rows = [...c.querySelectorAll('.thread-row')];
    expect(rows.map((r) => r.querySelector('.thread-row__text').textContent))
      .toEqual(['Granite raised to 240', '“Again?”']);
    expect(rows.map((r) => r.querySelector('.thread-row__at').textContent))
      .toEqual(['18:31', '18:31']);
  });

  // The four registers, and a seat that renames itself "TABLE" still cannot
  // borrow the room's voice — the row is drawn from the server's closed kind.
  it('keeps the four registers on the desk too', () => {
    const c = rail({
      stored: stored.concat([
        rowFromLine({ id: 3, ts: T + 2000, kind: 'opponent', who: 'TABLE', text: 'mine' }),
      ]),
      thread: [{ _id: 'm1', role: 'user', content: 'Careful with him.', t: T + 3000 }],
    });
    expect([...c.querySelectorAll('.thread-row')]
      .map((r) => r.className.replace('thread-row thread-row--', '')))
      .toEqual(['table', 'them', 'them', 'you']);
  });

  it('merges what is being said now onto the end, once', () => {
    const c = rail({
      stored,
      lastDecision: { seat: 0, reasoning: 'He checked twice.' },
    });
    const texts = [...c.querySelectorAll('.thread-row__text')].map((el) => el.textContent);
    expect(texts).toEqual(['Granite raised to 240', '“Again?”', 'He checked twice.']);
  });

  it('says so plainly when nothing has been said at all', () => {
    const c = rail();
    expect(c.querySelector('.dsk-apanel__empty').textContent)
      .toBe('Nothing said at this table yet.');
  });
});
