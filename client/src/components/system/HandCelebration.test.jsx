import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BIG_WIN_BB, BustedName, FIREWORK_MS, HandFireworks, handCelebration } from './HandCelebration.jsx';

afterEach(()=>vi.useRealTimers());
const settled = {street:'complete',bigBlind:20,seats:[{playerId:'me',stack:3000},{playerId:'them',displayName:'Granite',stack:0,contribTotal:1000}],result:{pot:3000,winners:[{seat:0,amount:3000}]}};
it('C8 distinguishes an ordinary win, a big payout and an actual busted opponent',()=>{
  expect(handCelebration(settled)).toMatchObject({won:true,amount:3000,bb:150,big:true,busted:[{seat:1,name:'Granite'}]});
  expect(handCelebration({...settled,result:{pot:100,winners:[{seat:0,amount:100}]}}).big).toBe(false);
  expect(handCelebration({...settled,street:'river'})).toBeNull();
  expect(handCelebration({...settled,result:null})).toBeNull();
});
it('C8 uses the hero payout in a split pot and does not call another winner busted',()=>{
  const result={pot:3000,winners:[{seat:1,amount:2000},{seat:0,amount:1000}]};
  expect(handCelebration({...settled,result})).toMatchObject({won:true,amount:1000,bb:50,big:false,busted:[]});
  expect(handCelebration({...settled,bigBlind:0}).big).toBe(false);
  expect(BIG_WIN_BB).toBe(100);
  expect(handCelebration({...settled,result:{pot:1999,winners:[{seat:0,amount:1999}]}}).big).toBe(false);
  expect(handCelebration({...settled,result:{pot:2000,winners:[{seat:0,amount:2000}]}}).big).toBe(true);
});
it('C8 fires three bursts once and removes them after 1.2 seconds',()=>{
  vi.useFakeTimers();
  const {rerender}=render(<HandFireworks/>);
  expect(document.querySelectorAll('.hand-fireworks__spark')).toHaveLength(30);
  act(()=>vi.advanceTimersByTime(FIREWORK_MS));
  expect(screen.queryByTestId('hand-fireworks')).toBeNull();
  rerender(<HandFireworks/>);
  expect(screen.queryByTestId('hand-fireworks')).toBeNull();
});
it('C8 takes the fallen name from the actual seat',()=>{
  render(<BustedName name="Granite"/>);
  expect(document.querySelector('.hand-busted-name')).toHaveTextContent('Granite');
});
