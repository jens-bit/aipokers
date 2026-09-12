import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WatchFelt } from '../WatchScreen.jsx';
import { midHandGame } from '../../test/fixtures/game.js';
import * as audio from '../../lib/audio.js';

const board=['Ks','7d','7s','3h','9c'];
const live={...midHandGame,street:'river',community:board,seats:midHandGame.seats.slice(0,2).map((s,i)=>({...s,displayName:i?'Granite':'Big Slick',isAI:true,holeCards:i?[]:['Kh','Kd'],contribTotal:1500,stack:1500})),bigBlind:20};
const done=(winner=0,bust=false)=>({...live,street:'complete',pace:'showdown',seats:live.seats.map((s,i)=>({...s,stack:i===winner?4500:bust?0:1500})),result:{type:'showdown',pot:3000,winners:[{seat:winner,amount:3000,hand:'a full house'}],showdown:[{seat:0,holeCards:['Kh','Kd']},{seat:1,holeCards:['9s','9h']}]}});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});

it('SHOW-4 chips follow the actual opponent winner, with winner hands raised and loser hands down',()=>{
  const {container,rerender}=render(<WatchFelt game={done(1)} mySeat={0} lastDecision={{seat:0,action:{type:'raise',amount:1500}}}/>);
  expect(container.querySelector('[data-pot-award="1"]')).not.toBeNull();
  expect(container.querySelector('[data-pot-award="0"]')).toBeNull();
  expect(container.querySelector('.watch-felt__seat .seat-ghost__hands [data-pose]')).toHaveAttribute('data-pose','raise');
  expect(container.querySelector('.watch-hero .ghost-hands [data-pose]')).toHaveAttribute('data-pose','rest');
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent('Granite WON 150 BB');
  const chips=container.querySelector('[data-pot-award="1"]');
  rerender(<WatchFelt game={{...done(1)}} mySeat={0}/>);
  expect(container.querySelector('[data-pot-award="1"]')).toBe(chips);
  rerender(<WatchFelt game={{...live,handNumber:2}} mySeat={0}/>);
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  expect(container.querySelector('.watch-felt__seat .seat-ghost__hands [data-pose]')).toHaveAttribute('data-pose','hold');
});

it('SHOW-4 aggregates side-pot awards per winner and never pays a seat with a zero award',()=>{
  const game=done();game.result.winners=[{seat:0,amount:1000},{seat:1,amount:1000},{seat:0,amount:1000},{seat:7,amount:0}];
  const {container}=render(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelectorAll('[data-pot-award]')).toHaveLength(2);
  expect(container.querySelector('[data-pot-award="0"]')).toHaveAttribute('data-award-amount','2000');
  expect(container.querySelectorAll('.hand-busted-name')).toHaveLength(0);
});

it('SHOW-4 bust darkens the actual lost seat and shows brief winner speech once',()=>{
  vi.useFakeTimers();
  const game=done(0,true);
  const {container,rerender}=render(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__seat.is-busted .hand-busted-scrim')).not.toBeNull();
  expect(container.querySelector('.hand-busted-name')).toHaveTextContent('Granite');
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent('Granite IS OUT');
  expect(container.querySelector('.watch-hero__says')).not.toBeNull();
  act(()=>vi.advanceTimersByTime(2500));
  expect(container.querySelector('.watch-hero__says')).toBeNull();
  rerender(<WatchFelt game={{...game}} mySeat={0}/>);
  expect(container.querySelector('.watch-hero__says')).toBeNull();
});

it('SHOW-4 uses the existing winner bubble instead of placing two on his seat',()=>{
  const {container}=render(<WatchFelt game={done()} mySeat={0} bubbles={[{id:'real',seat:0,mine:true,text:'I told you I had it.'}]}/>);
  expect(container.querySelectorAll('.watch-hero__says')).toHaveLength(1);
  expect(screen.getByText('I told you I had it.')).toBeInTheDocument();
});

it('SHOW-4 audio and result effects wait together until the last visible all-in card',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0}/>);
  const terminal=done(0,true);
  rerender(<WatchFelt game={{...terminal,pace:'allin'}} mySeat={0} flipped={3}/>);
  expect(play).not.toHaveBeenCalled();
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  rerender(<WatchFelt game={terminal} mySeat={0} flipped={4}/>);
  expect(play).not.toHaveBeenCalled();
  rerender(<WatchFelt game={terminal} mySeat={0} flipped={5}/>);
  expect(container.querySelector('[data-pot-award="0"]')).not.toBeNull();
  expect(play.mock.calls).toEqual([['winSwell'],['bigWinBursts'],['bustKnock',{delayMs:900}]]);
});
