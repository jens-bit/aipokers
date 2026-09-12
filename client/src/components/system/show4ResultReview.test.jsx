import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WatchFelt } from '../WatchScreen.jsx';
import { midHandGame } from '../../test/fixtures/game.js';
import * as audio from '../../lib/audio.js';
import { FakeAudioContext } from '../../test/fakeAudio.js';

const live = { ...midHandGame, street:'river', community:['Ks','7d','7s','3h','9c'],
  seats:midHandGame.seats.slice(0,2).map((s,i)=>({...s,isAI:true,displayName:i?'Granite':'Big Slick',
    holeCards:i?[]:['Kh','Kd'],contribTotal:1500,stack:1500})),bigBlind:20 };
const done = (winner=0,amount=3000,bust=false) => ({...live,street:'complete',pace:'showdown',pot:0,
  seats:live.seats.map((s,i)=>({...s,stack:i===winner?4500:bust?0:1500})),
  result:{type:'showdown',pot:amount,winners:[{seat:winner,amount,hand:'a full house'}],
    showdown:[{seat:0,holeCards:['Kh','Kd']},{seat:1,holeCards:['9s','9h']}]}});
afterEach(()=>{audio.resetAudio();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

it('SHOW-4: an ordinary opponent win has the authored card with his name and exact award',()=>{
  const {container}=render(<WatchFelt game={done(1,100)} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__won')).toHaveClass('is-ordinary-win');
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent('Granite WON');
  expect(container.querySelector('.watch-felt__won-amt')).toHaveTextContent('$100');
  expect(container.querySelector('.watch-hero .ghost-hands [data-pose]')).toHaveAttribute('data-pose','rest');
});

it('SHOW-4: a paid major pot retains its real amount and chip band after engine pot resets',()=>{
  const {container}=render(<WatchFelt game={done()} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__pot-amt')).toHaveTextContent('$3,000');
  expect(container.querySelector('.pot-chip')).toHaveAttribute('data-band','big');
});

it.each([false,true])('SHOW-4: an opponent major win sounds its bursts and a hero bust=%s sounds the falling name',bust=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0}/>);
  const terminal=done(1,3000,bust);
  rerender(<WatchFelt game={{...terminal,pace:'allin'}} mySeat={0} flipped={3}/>);
  expect(play).not.toHaveBeenCalled();
  expect(container.querySelector('.hand-busted-name')).toBeNull();
  rerender(<WatchFelt game={terminal} mySeat={0} flipped={5}/>);
  expect(play.mock.calls).toEqual([['lostPot'],['bigWinBursts'],...(bust?[['bustKnock',{delayMs:900}]]:[])]);
  expect(container.querySelector('.hand-fireworks')).not.toBeNull();
  if(bust) expect(container.querySelector('.watch-hero .hand-busted-name')).toHaveTextContent('Big Slick');
});

it.each([1,2])('SHOW-4: an opponent win names the winner before its %s busted seats',count=>{
  const game=done(1,3000,true);
  if(count===2) game.seats.push({...live.seats[0],playerId:'third',displayName:'Doyle',stack:0});
  const {container}=render(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent(
    count===1 ? 'Granite WON · Big Slick IS OUT' : 'Granite WON · 2 OPPONENTS OUT');
});

it('SHOW-4: split pots visibly identify sharing while retaining the camera award and all recipients',()=>{
  const game=done();
  game.result.winners=[{seat:1,amount:2000},{seat:0,amount:600},{seat:0,amount:400}];
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0}/>);
  rerender(<WatchFelt game={game} mySeat={0}/>);
  expect(screen.getByText('SHARED POT')).toBeVisible();
  expect(container.querySelector('.watch-felt__won-amt')).toHaveTextContent('$1,000');
  expect(container.querySelectorAll('[data-pot-award]')).toHaveLength(2);
  expect(container.querySelector('[data-pot-award="0"]')).toHaveAttribute('data-award-amount','1000');
  expect(container.querySelector('[data-pot-award="1"]')).toHaveAttribute('data-award-amount','2000');
});

it('SHOW-4: cold completed entry shows its static result and poses without replaying transients',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {container}=render(<WatchFelt game={done(0,3000,true)} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent('Granite IS OUT');
  expect(container.querySelector('.watch-hero .ghost-hands [data-pose]')).toHaveAttribute('data-pose','raise');
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  expect(container.querySelector('.watch-hero__says')).toBeNull();
  expect(container.querySelector('.hand-fireworks')).toBeNull();
  expect(container.querySelector('.hand-busted-scrim')).not.toBeNull();
  expect(container.querySelector('.hand-busted-name')).toBeNull();
  expect(container.querySelector('.watch-felt')).not.toHaveClass('is-result-moment');
  expect(play).not.toHaveBeenCalled();
});

it('SHOW-4: muted completion keeps its visual beat without replaying it or sound after unmute',()=>{
  vi.useFakeTimers();
  audio.resetAudio();window.localStorage.clear();FakeAudioContext.instances=[];
  vi.stubGlobal('AudioContext',FakeAudioContext);
  expect(audio.unlockAudio()).toBe(true);
  const ctx=FakeAudioContext.instances[0];
  audio.setMuted(true);
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0}/>);
  const game=done();
  rerender(<WatchFelt game={game} mySeat={0}/>);
  const chips=container.querySelector('[data-pot-award]');
  const bursts=container.querySelector('.hand-fireworks');
  expect(chips).not.toBeNull();expect(bursts).not.toBeNull();
  expect(ctx.sources).toHaveLength(0);
  audio.setMuted(false);
  rerender(<WatchFelt game={{...game}} mySeat={0}/>);
  expect(container.querySelector('[data-pot-award]')).toBe(chips);
  expect(container.querySelector('.hand-fireworks')).toBe(bursts);
  expect(ctx.sources).toHaveLength(0);
  act(()=>vi.advanceTimersByTime(2500));
  expect(container.querySelector('.hand-fireworks')).toBeNull();
  rerender(<WatchFelt game={{...game}} mySeat={0}/>);
  expect(container.querySelector('.hand-fireworks')).toBeNull();
  expect(ctx.sources).toHaveLength(0);
});

it('SHOW-4: repeats retain one animation and camera changes/re-entry cannot resurrect it',()=>{
  vi.useFakeTimers();
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {container,rerender,unmount}=render(<WatchFelt game={live} mySeat={0}/>);
  const game=done();
  rerender(<WatchFelt game={game} mySeat={0}/>);
  const chips=container.querySelector('[data-pot-award="0"]');
  expect(chips).not.toBeNull();
  rerender(<WatchFelt game={{...game}} mySeat={0}/>);
  expect(container.querySelector('[data-pot-award="0"]')).toBe(chips);
  act(()=>vi.advanceTimersByTime(2500));
  expect(container.querySelector('.watch-hero__says')).toBeNull();
  rerender(<WatchFelt game={game} mySeat={1}/>);
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  expect(container.querySelector('.watch-felt__bubble')).toBeNull();
  rerender(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  expect(play.mock.calls).toEqual([['winSwell'],['bigWinBursts']]);
  unmount();
  const reopened=render(<WatchFelt game={game} mySeat={0}/>);
  expect(reopened.container.querySelector('[data-pot-award]')).toBeNull();
  expect(reopened.container.querySelector('.watch-hero__says')).toBeNull();
});

it('SHOW-4: a late reveal packet cannot restart a completion that was already shown',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0}/>);
  const game=done();
  rerender(<WatchFelt game={game} mySeat={0} flipped={5}/>);
  expect(container.querySelector('[data-pot-award]')).not.toBeNull();
  rerender(<WatchFelt game={game} mySeat={0} flipped={4}/>);
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  rerender(<WatchFelt game={game} mySeat={0} flipped={5}/>);
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  expect(container.querySelector('.hand-fireworks')).toBeNull();
  expect(container.querySelector('.watch-hero__says')).toBeNull();
  expect(container.querySelector('.watch-felt__won-amt')).toHaveTextContent('$3,000');
  expect(play.mock.calls).toEqual([['winSwell'],['bigWinBursts']]);
});

it('SHOW-4: public awards cannot introduce unrevealed private cards or premature result text',()=>{
  const publicLive={...live,seats:live.seats.map(s=>({...s,holeCards:[]}))};
  const publicDone={...done(1),seats:publicLive.seats,result:{...done(1).result,showdown:[]}};
  const {container,rerender}=render(<WatchFelt game={publicLive} mySeat={0}/>);
  rerender(<WatchFelt game={{...publicDone,pace:'allin'}} mySeat={0} flipped={3}/>);
  expect(container.querySelector('.watch-felt__won')).toBeNull();
  expect(container.querySelector('[data-pot-award]')).toBeNull();
  rerender(<WatchFelt game={publicDone} mySeat={0} flipped={5}/>);
  expect(container.querySelector('.watch-felt__won-to')).toHaveTextContent('Granite WON 150 BB');
  expect(container.querySelector('.watch-hero__cards')).toHaveTextContent('');
  expect(container.querySelector('.seat-ghost__body')).not.toHaveTextContent('9');
});
