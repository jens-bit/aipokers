// client/src/components/home/CasinoOnTv.test.jsx — HOME-2 job 4
//
// What is on the television at the bottom of the room. Two states, and the
// whole rule is that neither of them invents anything: a felt is drawn only for
// a hand that is actually being played, and the board is drawn only from what
// /api/rooms answered.

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { CasinoOnTv, TapeOnTv, onScreen, shortStakes, tvProgramme } from './CasinoOnTv.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { floorRoom, upstairsRoom, backRoom } from '../../test/fixtures/rooms.js';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';
import { HOODS, GLOWS } from '../../lib/identity.js';

const away = (id, over = {}) => ({
  id,
  name: id,
  mood: { state: 'neutral', heat: 40 },
  location: { where: 'table', room: 'floor', tableId: 't1' },
  ...over,
});

const inHand = (id, pot, over = {}) => away(id, {
  liveGame: { tableId: `t-${id}`, pot, board: ['Ah', 'Kd', '2c'], heroSeat: 0, street: 'flop' },
  ...over,
});

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

it('C7 selects a studied hand before another saved hand and live play before either',()=>{
  const learner={id:'a1',name:'Bal',study:{handNumber:badBeatHand.handNumber},sessionFlagged:[bigBluffHand,badBeatHand]};
  expect(tvProgramme([learner],[])).toMatchObject({kind:'tape',hand:badBeatHand});
  expect(tvProgramme([learner],[inHand('a2',300)])).toMatchObject({kind:'live',agent:{id:'a2'}});
  expect(tvProgramme([{id:'home'}],[])).toMatchObject({kind:'tape',hand:null});
  expect(tvProgramme([],[])).toEqual({kind:'casino'});
});
it('C7 draws the saved board and flag without inventing a replay clock',()=>{
  render(<TapeOnTv agent={{name:'Bal'}} hand={badBeatHand}/>);
  expect(screen.getByText('BAD BEAT')).toBeInTheDocument();
  expect(screen.getByText('Bal · #37')).toBeInTheDocument();
  expect(document.querySelectorAll('.home-tv__recording-cards > *')).toHaveLength(5);
  expect(document.querySelector('.home-tv__recording-progress')).toBeNull();
});

describe('BUG-169: the authored live television', () => {
  const live = (over = {}) => inHand('bal', 640, {
    name: 'Balanced', nickname: 'Bal', identity: { hood: 'sand', glow: 'gold' },
    liveGame: { tableId: 'real-table', street: 'flop', heroSeat: 1, blinds: '25/50', pot: 640,
      board: ['Ah', 'Kd', '2c'], heroHole: ['As', 'Ad'],
      seats: [
        { displayName: 'Granite', identity: { hood: 'moss', glow: 'ice' } },
        { displayName: 'Balanced', identity: { hood: 'sand', glow: 'gold' } },
      ], ...over },
  });

  it('BUG-169: draws each real seat in its saved hood and eyes with his seat at the top', () => {
    const { container, rerender } = render(<CasinoOnTv away={[live()]} />);
    const own = container.querySelector('.home-tv__ghost.is-own');
    expect(container.querySelectorAll('.home-tv__ghost')).toHaveLength(2);
    expect(own).toHaveAttribute('data-seat', '1');
    expect(own).toHaveStyle({ left: '50%', top: '16%' });
    expect(own.querySelector('path')).toHaveAttribute('fill', HOODS.find(h => h.id === 'sand').top);
    expect(own.querySelector('ellipse')).toHaveAttribute('fill', GLOWS.find(g => g.id === 'gold').c);
    expect(container.querySelector('[data-seat="0"] path')).toHaveAttribute('fill', HOODS.find(h => h.id === 'moss').top);
    const changedMood = live(); changedMood.mood = { state: 'tilted', heat: 99 };
    rerender(<CasinoOnTv away={[changedMood]} />);
    expect(container.querySelector('.home-tv__ghost.is-own path')).toHaveAttribute('fill', '#6E5836');
  });

  it('BUG-169: shows the selected short name, actual blinds and live signal without displaying private cards', () => {
    const { container } = render(<CasinoOnTv away={[live()]} />);
    expect(screen.getByText('Bal · 25/50')).toBeInTheDocument();
    expect(container.querySelector('.home-tv__live-signal')).toBeInTheDocument();
    expect(container.querySelector('.home-tv__pot-dot')).toBeInTheDocument();
    expect(container.querySelectorAll('.home-frame__card, .playing-card')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/As|Ad|640/);
  });

  it('BUG-169: unknown or empty seat lists never create demo occupants or an invented hero', () => {
    const { container, rerender } = render(<CasinoOnTv away={[live({ seats: undefined })]} />);
    expect(container.querySelectorAll('.home-tv__ghost, .home-frame__body, .home-frame__seat')).toHaveLength(0);
    rerender(<CasinoOnTv away={[live({ seats: [] })]} />);
    expect(container.querySelectorAll('.home-tv__ghost, .home-frame__body, .home-frame__seat')).toHaveLength(0);
  });

  it('BUG-169: a queued hero outside the actual seats stays absent, including sparse explicit seat indices', () => {
    const listed = [{ seat: 4, displayName: 'Granite', identity: { hood: 'moss', glow: 'ice' } }];
    const { container, rerender } = render(<CasinoOnTv away={[live({ heroSeat: 5, seats: listed })]} />);
    expect(container.querySelectorAll('.home-tv__ghost')).toHaveLength(1);
    expect(container.querySelectorAll('.home-tv__ghost.is-own')).toHaveLength(0);
    expect(container.querySelector('.home-tv__ghost')).toHaveAttribute('data-seat', '4');
    rerender(<CasinoOnTv away={[live({ heroSeat: 4, seats: listed })]} />);
    expect(container.querySelector('.home-tv__ghost.is-own')).toHaveAttribute('data-seat', '4');
  });

  it('BUG-169: an older seat projection still uses his saved identity instead of re-rolling it from the name', () => {
    const { container } = render(<CasinoOnTv away={[live({ heroSeat: 0, seats: [{ displayName: 'Balanced' }] })]} />);
    expect(container.querySelector('.home-tv__ghost.is-own path')).toHaveAttribute('fill', '#6E5836');
    expect(container.querySelector('.home-tv__ghost.is-own ellipse')).toHaveAttribute('fill', '#C9A227');
  });

  it('BUG-169: a changed selected table replaces caption and identities together and omits unknown stakes', () => {
    const first = live();
    const second = { ...live({ tableId: 'other', pot: 800, blinds: '50/100', heroSeat: 0,
      seats: [{ displayName: 'River Rat', identity: { hood: 'slate', glow: 'ember' } }] }),
      id: 'river', name: 'River Rat', nickname: 'River' };
    const { container, rerender } = render(<CasinoOnTv away={[first]} />);
    rerender(<CasinoOnTv away={[first, second]} />);
    expect(screen.getByText('River · 50/100')).toBeInTheDocument();
    expect(screen.queryByText('Bal · 25/50')).toBeNull();
    expect(container.querySelectorAll('.home-tv__ghost')).toHaveLength(1);
    expect(container.querySelector('.home-tv__ghost path')).toHaveAttribute('fill', '#33526B');
    rerender(<CasinoOnTv away={[{ ...second, liveGame: { ...second.liveGame, blinds: null, pot: 0 } }]} />);
    expect(container.querySelector('.home-tv__caption')).toHaveTextContent(/^River$/);
    expect(container.querySelector('.home-tv__pot-dot')).toBeNull();
  });
});

describe('HOME-2 job 4 · the casino, on the set', () => {
  it('shows the board when nobody of yours is in a hand', async () => {
    fetchMock.route('/api/rooms', { rooms: [floorRoom, upstairsRoom, backRoom] });
    render(<CasinoOnTv away={[]} />);

    expect(await screen.findByTestId('home-tv-board')).toBeInTheDocument();
    expect(screen.getByText('THE CASINO')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('10/20')).toBeInTheDocument());
    expect(screen.getByText('4 tables')).toBeInTheDocument();
    expect(screen.getByText('25/50')).toBeInTheDocument();
  });

  // An agent who is AT the casino but not yet in a hand is not a hand. Drawing
  // a felt he is not sitting at would be the one outright lie on the screen —
  // board 29 F07b makes the same call about YOUR TABLE.
  it('is still the board for an agent who is out but not in a hand', async () => {
    fetchMock.route('/api/rooms', { rooms: [floorRoom] });
    render(<CasinoOnTv away={[away('a1')]} />);
    expect(await screen.findByTestId('home-tv-board')).toBeInTheDocument();
    expect(screen.queryByTestId('home-tv-felt')).toBeNull();
  });

  it('shows his table in miniature the moment there is one', async () => {
    render(<CasinoOnTv away={[inHand('a1', 640)]} />);
    expect(await screen.findByTestId('home-tv-felt')).toBeInTheDocument();
    expect(screen.queryByTestId('home-tv-board')).toBeNull();
    // BUG-169 ports C7a's distinct TV picture. Away frames still use MiniFelt.
    expect(document.querySelector('.home-tv__live-backdrop')).toBeTruthy();
  });

  // A set showing the quietest table in the building is a set nobody looks at.
  it('picks the biggest pot when more than one of yours is in', () => {
    const chosen = onScreen([inHand('a1', 120), inHand('a2', 940), inHand('a3', 300)]);
    expect(chosen.id).toBe('a2');
    expect(onScreen([])).toBeNull();
    expect(onScreen([away('a1')])).toBeNull();
  });

  // A television with no signal names nothing rather than inventing rooms.
  it('says nothing about the rooms when the floor does not answer', async () => {
    fetchMock.route('/api/rooms', { status: 500, body: {} });
    render(<CasinoOnTv away={[]} />);
    expect(await screen.findByTestId('home-tv-board')).toBeInTheDocument();
    expect(screen.getByText('THE CASINO')).toBeInTheDocument();
    expect(document.querySelectorAll('.home-tv__room')).toHaveLength(0);
  });

  it('writes the stakes the way a 100px screen has room for', () => {
    expect(shortStakes(floorRoom)).toBe('10/20');
    expect(shortStakes({ stakes: { smallBlind: 50, bigBlind: 100 } })).toBe('50/100');
    expect(shortStakes({})).toBe('');
  });
});
