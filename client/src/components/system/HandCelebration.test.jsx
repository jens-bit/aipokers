import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BIG_WIN_BB, BustedName, FIREWORK_MS, HandFireworks, handCelebration, resultCelebration } from './HandCelebration.jsx';
import { potAwards } from './PotAward.jsx';

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
it('BUG-249: the headline, celebration threshold and chips use the paid award after rake', () => {
  const game = { ...settled, result: { pot: 2000, winners: [{ seat: 0, amount: 2000 }],
    rake: { total: 20, bySeat: { 0: 20 } } } };
  expect(handCelebration(game)).toMatchObject({ won: true, amount: 1980, bb: 99, big: false });
  expect(resultCelebration(game)).toMatchObject({ amount: 1980, awards: [{ seat: 0, amount: 1980 }] });
  expect(potAwards(game)).toEqual([{ seat: 0, amount: 1980 }]);
});
it('BUG-249: side-pot awards deduct each seat cut once and focus the largest actual recipient', () => {
  const game = { ...settled, seats: [...settled.seats, { playerId: 'camera', stack: 100 }],
    result: { pot: 2020, winners: [{ seat: 0, amount: 600 }, { seat: 0, amount: 420 }, { seat: 1, amount: 1000 }],
      rake: { total: 40, bySeat: { 0: 35, 1: 5 } } } };
  expect(potAwards(game)).toEqual([{ seat: 0, amount: 985 }, { seat: 1, amount: 995 }]);
  expect(resultCelebration(game, 2)).toMatchObject({ seat: 1, amount: 995, shared: true });
});
it('BUG-249: total-only legacy split rake cannot invent individual payouts or animate gross chips', () => {
  const game = { ...settled, result: { pot: 3000,
    winners: [{ seat: 0, amount: 1000 }, { seat: 1, amount: 2000 }], rake: { total: 30 } } };
  expect(handCelebration(game)).toMatchObject({ won: true, amount: null, bb: null, big: false });
  expect(resultCelebration(game)).toMatchObject({ amount: null, bb: null, awards: [] });
  expect(potAwards(game)).toEqual([]);
});
it('C8 takes the fallen name from the actual seat',()=>{
  render(<BustedName name="Granite"/>);
  expect(document.querySelector('.hand-busted-name')).toHaveTextContent('Granite');
});
