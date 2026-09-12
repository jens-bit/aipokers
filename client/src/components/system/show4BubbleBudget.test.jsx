import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { WatchFelt } from '../WatchScreen.jsx';
import { midHandGame } from '../../test/fixtures/game.js';

const live={...midHandGame,street:'river',community:['Ks','7d','7s','3h','9c'],bigBlind:20,
  seats:['Big Slick','Granite','Doyle','Nightjar','River Rat','Balance'].map((displayName,i)=>({
    ...midHandGame.seats[0],playerId:`speaker-${i}`,displayName,isAI:true,stack:1500,
    holeCards:[],contribTotal:500,folded:false,
  }))};
const done=winner=>({...live,street:'complete',pace:'showdown',result:{type:'showdown',pot:3000,
  winners:[{seat:winner,amount:3000,hand:'three of a kind'}]}});
const bubble=(seat,text)=>({id:`real-${seat}`,seat,mine:seat===0,text});

it('SHOW-4 keeps two live speakers when another opponent wins',()=>{
  const bubbles=[bubble(0,'My real words.'),bubble(1,'Still here.')];
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0} bubbles={bubbles}/>);
  rerender(<WatchFelt game={done(5)} mySeat={0} bubbles={bubbles}/>);
  expect(screen.getByText('My real words.')).toBeInTheDocument();
  expect(screen.getByText(/Still here\./)).toBeInTheDocument();
  expect(container.querySelectorAll('.watch-hero__says,.watch-felt__bubble')).toHaveLength(2);
  expect(screen.queryByText(/I’ll take it\./)).not.toBeInTheDocument();
});

it('SHOW-4 gives existing opponent speech placement priority over the optional winner line',()=>{
  const bubbles=[bubble(1,'That was quite a hand.')];
  const {rerender}=render(<WatchFelt game={live} mySeat={0} bubbles={bubbles}/>);
  expect(screen.getByText(/That was quite a hand\./)).toBeInTheDocument();
  rerender(<WatchFelt game={done(2)} mySeat={0} bubbles={bubbles}/>);
  expect(screen.getByText(/That was quite a hand\./)).toBeInTheDocument();
});

it('SHOW-4 uses a free slot for the winner and never replaces his real words',()=>{
  const bubbles=[bubble(1,'Still here.')];
  const {container,rerender}=render(<WatchFelt game={live} mySeat={0} bubbles={bubbles}/>);
  rerender(<WatchFelt game={done(0)} mySeat={0} bubbles={bubbles}/>);
  expect(container.querySelectorAll('.watch-hero__says,.watch-felt__bubble')).toHaveLength(2);
  const real=[bubble(0,'My real win.')];
  rerender(<WatchFelt game={done(0)} mySeat={0} bubbles={real}/>);
  expect(container.querySelector('.watch-hero__says')).toHaveTextContent('My real win.');
});
