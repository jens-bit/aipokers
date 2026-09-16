// client/src/components/watchResult.test.jsx — BUGS-A job 12
//
// THE HAND ENDS WITH A SENTENCE.
//
// "$30 → Granite" said how much and to whom and nothing about WHY, on the one
// screen whose entire subject is watching somebody play poker. The felt already
// had the answer — a showdown reveals every contested seat — and was throwing
// it away.
//
// The arithmetic of naming a hand is lib/handResult.test.jsx; this asserts that
// the felt says it, off the same board and the same showdown it is drawing.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { WatchScreen, WatchFelt } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const base = {
  mySeat: 0,
  config: spectatorConfig,
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  chatMessages: [],
  sendChat: () => {},
  onLeave: () => {},
  onSitOut: () => {},
};

/** A settled hand: the board out, the pot awarded, the cards shown. */
const settled = (result, community = ['9s', 'Kc', '4d', '2h', '7c']) => ({
  ...midHandGame,
  street: 'complete',
  toAct: null,
  community,
  result,
});

const pill = () => document.querySelector('.watch-felt__won-pill');
const pillText = () => (pill() ? pill().textContent : null);

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', agentsResponse);
});

describe('BUGS-A job 12 · the felt names the hand', () => {
  it('BUG-173 / C8: an ordinary hero win uses the raised WON card without fireworks',()=>{
    render(<WatchScreen {...base} game={settled({type:'uncontested',pot:100,winners:[{seat:0,amount:100}]})}/>);
    expect(document.querySelector('.watch-hero__hands [data-pose="raise"]')).not.toBeNull();
    expect(screen.queryByTestId('hand-fireworks')).toBeNull();
    expect(pill().parentElement).toHaveClass('is-celebrating', 'is-ordinary-win');
    expect(pill().querySelector('.watch-felt__won-to')).toHaveTextContent(/^WON$/);
    expect(pill().querySelector('.watch-felt__won-amt')).toHaveTextContent(/^\$100$/);
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder won $100 uncontested');
    expect(screen.getByRole('group', { name: 'The Grinder won $100 uncontested' })).toBe(pill());
  });
  it('BUG-173: a split win shows the hero award once and names its owner accessibly',()=>{
    render(<WatchScreen {...base} game={settled({type:'showdown',pot:300,
      winners:[{seat:2,amount:200},{seat:0,amount:60},{seat:0,amount:40}]})}/>);
    expect(pill().querySelector('.watch-felt__won-amt')).toHaveTextContent(/^\$100$/);
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder won $100 in a shared pot');
    expect(pill().querySelector('.watch-felt__won-with')).toBeNull();
    expect(screen.getByText('shared the pot')).toBeInTheDocument();
  });
  it('BUG-173: missing award and hand description stay unknown on an ordinary win',()=>{
    render(<WatchFelt mySeat={0} game={settled({type:'showdown',pot:300,winners:[{seat:0}]}, [])}/>);
    expect(pill().querySelector('.watch-felt__won-to')).toHaveTextContent(/^WON$/);
    expect(pill().querySelector('.watch-felt__won-amt')).toBeNull();
    expect(pill().querySelector('.watch-felt__won-with')).toBeNull();
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder won');
  });
  it('BUG-173: a boxed replay keeps its compact named result',()=>{
    render(<WatchFelt mySeat={0} geom={{felt:500,pot:196,board:243,tug:290}} game={settled({
      type:'uncontested',pot:100,winners:[{seat:0,amount:100}],
    })}/>);
    expect(pill().parentElement).not.toHaveClass('is-celebrating');
    expect(pill()).toHaveTextContent('The Grinder took');
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder took $100 uncontested');
    expect(screen.queryByTestId('hand-fireworks')).toBeNull();
  });
  it('BUG-173: desktop kitchen Watch keeps the full winner name visible',()=>{
    render(<WatchFelt mySeat={0} ownerVariant="desktop" game={settled({
      type:'uncontested',pot:100,winners:[{seat:0,amount:100}],
    })}/>);
    expect(pill().querySelector('.watch-felt__won-to')).toHaveTextContent(/^The Grinder WON$/);
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder won $100 uncontested');
  });
  it('C8: a big win uses actual big blinds and a busted seat gets its own falling name',()=>{
    const game=settled({type:'showdown',pot:3000,winners:[{seat:0,amount:3000}],showdown:[{seat:0,holeCards:['Ks','Kd']}]});
    const {rerender}=render(<WatchScreen {...base} game={{...game,street:'river',result:null}}/>);
    rerender(<WatchScreen {...base} game={game}/>);
    expect(screen.getByTestId('hand-fireworks')).toBeInTheDocument();
    expect(pillText()).toContain('WON 150 BB');
    rerender(<WatchScreen {...base} game={{...game,seats:game.seats.map((s,i)=>i===2?{...s,stack:0}:s)}}/>);
    expect(pillText()).toContain('Granite IS OUT');
    expect(document.querySelector('.watch-felt__seat.is-busted .hand-busted-name')).toHaveTextContent('Granite');
  });
  it('BUG-79: the hero is a winner when he shares the pot after the first listed seat',()=>{
    render(<WatchScreen {...base} game={settled({
      type:'showdown',pot:100,winners:[{seat:2,amount:50},{seat:0,amount:50}],
      showdown:[{seat:0,holeCards:['As','Kd']},{seat:2,holeCards:['Ah','Kc']}],
    },['Qs','Jc','Td','2h','7c'])}/>);
    expect(screen.queryByText('lost at showdown')).toBeNull();
    expect(screen.getByText('shared the pot')).toBeInTheDocument();
  });
  it('says who took it, how much, and what with', () => {
    render(<WatchScreen {...base} game={settled({
      type: 'showdown',
      pot: 30,
      winners: [{ seat: 2, amount: 30 }],
      showdown: [{ seat: 2, holeCards: ['9h', 'Ad'] }],
    })} />);

    expect(pillText()).toContain('Granite WON');
    expect(pillText()).toContain('$30');
    expect(pillText()).toContain('with a pair of nines');
    // The whole sentence is on the pill for anyone who cannot see the parts.
    expect(pill().getAttribute('aria-label')).toBe('Granite won $30 with a pair of nines');
  });

  it('a pot nobody called says uncontested rather than naming a hand nobody saw', () => {
    render(<WatchScreen {...base} game={settled({
      type: 'uncontested',
      pot: 60,
      winners: [{ seat: 0, amount: 60 }],
    })} />);

    // Design 58 C8a replaces the ordinary hero's compact sentence with WON;
    // the accessible sentence still names the actual winner and amount.
    expect(pill().querySelector('.watch-felt__won-to')).toHaveTextContent(/^WON$/);
    expect(pill()).toHaveAttribute('aria-label', 'The Grinder won $60 uncontested');
    expect(pillText()).toContain('uncontested');
    expect(pillText()).not.toContain('with');
  });

  it('the amount is still the loud thing on the pill', () => {
    render(<WatchScreen {...base} game={settled({
      type: 'showdown',
      pot: 4180,
      winners: [{ seat: 2, amount: 4180 }],
      showdown: [{ seat: 2, holeCards: ['Ah', 'Kh'] }],
    }, ['Qh', 'Jh', 'Th', '2c', '7d'])} />);

    expect(document.querySelector('.watch-felt__won-amt').textContent).toBe('$4,180');
    expect(pillText()).toContain('with a royal flush');
  });

  it('draws no result pill at all while the hand is still running', () => {
    render(<WatchScreen {...base} game={midHandGame} />);
    expect(pill()).toBeNull();
  });

  it('TABLE-1 job C: a major win drops the pot pill instead of printing the same figure twice', () => {
    // The pot pill used to stay up at .25 opacity once the celebrating card
    // came up — the same amount, drawn twice, one of them ghosted behind the
    // other. The win card already says the pot; there is nothing left for
    // the standing pill to say once the hand is settled.
    const game = settled({ type: 'showdown', pot: 3000, winners: [{ seat: 0, amount: 3000 }], showdown: [{ seat: 0, holeCards: ['Ks', 'Kd'] }] });
    const { rerender } = render(<WatchScreen {...base} game={{ ...game, street: 'river', result: null }} />);
    expect(document.querySelector('.watch-felt__pot')).not.toBeNull();
    rerender(<WatchScreen {...base} game={game} />);
    expect(pillText()).toContain('WON 150 BB');
    expect(document.querySelector('.watch-felt__pot')).toBeNull();
  });
});
