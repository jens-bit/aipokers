// client/src/components/watchTable.test.jsx — W4-4
//
// "The felt is the performance and it never scrolls; this is the transcript and
// it always does." One tab, because there is only one thing under the felt now:
// everything said at this table, in order, whoever said it — his lines, the
// opponents', and yours — with the composer under it.
//
// And the showdown: their cards flip face up in seat order after the runout,
// held, then the pot slides. Backs only while the hand is live — this is the
// one row of the state matrix where the fish-tank law changes state.

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { midHandGame } from '../test/fixtures/game.js';
import { fetchMock, telegram } from '../test/harness.js';

const base = {
  mySeat: 0,
  sendChat: () => {},
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  onLeave: () => {},
  config: { isSpectator: true, agentId: 'a1', tableId: 't1' },
};

// A finished hand two seats reached, with the pot going to seat 1.
const settledGame = {
  ...midHandGame,
  street: 'complete',
  community: ['5c', '4h', '8c', 'Kd', '2s'],
  result: {
    pot: 300,
    winners: [{ seat: 1, descr: 'two pair' }],
    showdown: [
      { seat: 1, holeCards: ['Kh', '9s'] },
      { seat: 2, holeCards: ['Ac', 'Qd'] },
    ],
  },
};

const faceUpRanks = (scope) => [...scope.querySelectorAll('div')]
  .map((el) => (el.children.length === 0 ? el.textContent.trim() : ''))
  .filter((t) => /^(10|[2-9]|[AKQJ])$/.test(t));

describe('W4-4: the TABLE tab is the record', () => {
  beforeEach(() => { telegram.signIn(); fetchMock.route('/api/agents', { agents: [] }); });

  it('names itself for what it holds', () => {
    const { container } = render(<WatchScreen {...base} game={midHandGame} chatMessages={[]} />);
    expect([...container.querySelectorAll('.watch-tabs__tab')].map((el) => el.textContent))
      .toEqual(['Table']);
  });

  it('keeps his line even when the felt let it go', () => {
    // Longer than his two-line band, so the bubble law withholds it from the
    // felt — his band is generous (120 chars) precisely so this is rare.
    const long = 'He checked the turn and then checked it again, so he is capped here, '
      + 'and I am betting two hundred and forty for value against that range.';
    act(() => {
      render(<WatchScreen {...base} game={midHandGame} chatMessages={[]}
        lastDecision={{ seat: 0, reasoning: long }} />);
    });

    // Not on the felt...
    expect(document.querySelector('.bubble')).toBeNull();
    // ...but in the record, which is the last clause of the bubble law.
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it('carries what the opponents said', () => {
    act(() => {
      render(<WatchScreen {...base} game={midHandGame}
        chatMessages={[{ isAI: true, seat: 1, text: 'Again?', t: Date.now() }]} />);
    });
    expect(screen.getAllByText('Again?').length).toBeGreaterThan(0);
  });

  it('still offers the composer — the record is a way in, not just a log', () => {
    render(<WatchScreen {...base} game={midHandGame} chatMessages={[]} />);
    expect(document.querySelector('.dr-chat-tab__input, .dr-chat-tab form input, input')).toBeTruthy();
  });
});

describe('W4-4: the showdown reveal', () => {
  beforeEach(() => { telegram.signIn(); fetchMock.route('/api/agents', { agents: [] }); });

  it('keeps every opponent face down while the hand is live', () => {
    const { container } = render(<WatchScreen {...base} game={midHandGame} chatMessages={[]} />);
    for (const seat of container.querySelectorAll('.watch-felt__seat')) {
      expect(faceUpRanks(seat)).toEqual([]);
    }
  });

  it('turns the seats that reached showdown face up once the hand is over', () => {
    const { container } = render(<WatchScreen {...base} game={settledGame} chatMessages={[]} />);
    const shown = [...container.querySelectorAll('.watch-felt__seat')]
      .flatMap((seat) => faceUpRanks(seat));
    expect(shown).toContain('K');
    expect(shown).toContain('A');
  });

  it('reveals in seat order — the shelf staggers rather than flipping at once', () => {
    const { container } = render(<WatchScreen {...base} game={settledGame} chatMessages={[]} />);
    const delays = [...container.querySelectorAll('.seat-ghost__shelf')]
      .map((el) => el.style.animationDelay);
    expect(delays.length).toBe(2);
    expect(delays[0]).not.toBe(delays[1]);
  });

  it('a seat that folded and never showed keeps its secret', () => {
    const folded = {
      ...settledGame,
      seats: settledGame.seats.map((s, i) => (i === 2 ? { ...s, folded: true } : s)),
      result: { ...settledGame.result, showdown: [{ seat: 1, holeCards: ['Kh', '9s'] }] },
    };
    const { container } = render(<WatchScreen {...base} game={folded} chatMessages={[]} />);
    const shelves = container.querySelectorAll('.seat-ghost__shelf');
    expect(shelves).toHaveLength(1);
  });

  it('the pot leaves the middle once the hand has been decided', () => {
    const { container } = render(<WatchScreen {...base} game={settledGame} chatMessages={[]} />);
    // The pot pill steps aside for the winner pill below the board.
    expect(container.querySelector('.watch-felt__pot')).toBeNull();
    expect(container.querySelector('.watch-felt__won')).toBeTruthy();
  });
});
