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
    // MiniFelt's own picture, not a second drawing of one.
    expect(document.querySelector('.home-frame__picture')).toBeTruthy();
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
