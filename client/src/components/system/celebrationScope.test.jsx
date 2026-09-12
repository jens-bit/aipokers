import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCelebrationAudio } from './HandCelebration.jsx';
import { play, resetAudio, unlockAudio } from '../../lib/audio.js';
import { FakeAudioContext } from '../../test/fakeAudio.js';

const live={tableId:'scope-a',handNumber:1,street:'river',bigBlind:20,
  seats:[{playerId:'me',stack:2000},{playerId:'them',stack:1000,contribTotal:500}]};
const done={...live,street:'complete',seats:[live.seats[0],{...live.seats[1],stack:0}],
  result:{winners:[{seat:0,amount:3000}]}};
const watch=({game,seat=0,enabled=true,settled=false})=>useCelebrationAudio(game,seat,enabled,settled);
beforeEach(()=>{
  resetAudio();window.localStorage.clear();FakeAudioContext.instances=[];
  vi.stubGlobal('AudioContext',FakeAudioContext);
  expect(unlockAudio()).toBe(true);
});
afterEach(()=>{resetAudio();vi.unstubAllGlobals();});

it.each([
  ['camera',{seat:1}],
  ['hand',{game:{...done,handNumber:2}}],
  ['table',{game:{...done,tableId:'scope-b'}}],
  ['disabled replay',{enabled:false}],
  ['reveal rollback',{settled:false}],
])('SHOW-4: leaving the earned %s scope cancels its knock, remaining burst reports and duck',(_name,change)=>{
  const ctx=FakeAudioContext.instances[0];
  const {rerender}=renderHook(watch,{initialProps:{game:live}});
  rerender({game:done,settled:true});
  const earned=ctx.sources.slice();
  expect(earned).toHaveLength(3);
  expect(earned[1].buffer.length).toBe(1.2*ctx.sampleRate);
  expect(earned[2].start).toHaveBeenCalledWith(10.9);
  play('hisAction');const unrelated=ctx.sources.at(-1);
  ctx.currentTime=10.2;
  rerender({game:done,settled:true,...change});
  for(const source of earned) expect(source.stop).toHaveBeenCalledOnce();
  expect(unrelated.stop).not.toHaveBeenCalled();
  expect(ctx.gains[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(10.2);
  expect(ctx.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(.32,10.2);
});

it('SHOW-4: unmount cancels an earned celebration without stopping unrelated room audio',()=>{
  const ctx=FakeAudioContext.instances[0];
  const {rerender,unmount}=renderHook(watch,{initialProps:{game:live}});
  rerender({game:done,settled:true});
  const earned=ctx.sources.slice();
  play('hisAction');const unrelated=ctx.sources.at(-1);
  ctx.currentTime=10.2;unmount();
  for(const source of earned) expect(source.stop).toHaveBeenCalledOnce();
  expect(unrelated.stop).not.toHaveBeenCalled();
  expect(ctx.gains[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(10.2);
  expect(ctx.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(.32,10.2);
});

it('SHOW-4: harmless repeated snapshots retain the original scheduled knock and source group',()=>{
  const ctx=FakeAudioContext.instances[0];
  const {rerender}=renderHook(watch,{initialProps:{game:live}});
  rerender({game:done,settled:true});
  const earned=ctx.sources.slice();
  const gain=ctx.gains[0].gain;
  const cancellations=gain.cancelScheduledValues.mock.calls.length;
  ctx.currentTime=10.2;
  rerender({game:{...done},settled:true});
  rerender({game:{...done},settled:true});
  expect(ctx.sources).toEqual(earned);
  for(const source of earned) expect(source.stop).not.toHaveBeenCalled();
  expect(earned[2].start).toHaveBeenCalledOnce();
  expect(earned[2].start).toHaveBeenCalledWith(10.9);
  expect(gain.cancelScheduledValues).toHaveBeenCalledTimes(cancellations);
});

it('SHOW-4: cancelling one result preserves another result group and its future duck',()=>{
  const ctx=FakeAudioContext.instances[0];
  const first=renderHook(watch,{initialProps:{game:live}});
  first.rerender({game:done,settled:true});
  const older=ctx.sources.slice();
  const second=renderHook(watch,{initialProps:{game:{...live,tableId:'other'}}});
  ctx.currentTime=10.1;
  second.rerender({game:{...done,tableId:'other'},settled:true});
  const newer=ctx.sources.slice(3);
  const gain=ctx.gains[0].gain;
  gain.setValueAtTime.mockClear();gain.linearRampToValueAtTime.mockClear();
  ctx.currentTime=10.2;first.unmount();
  for(const source of older) expect(source.stop).toHaveBeenCalledOnce();
  for(const source of newer) expect(source.stop).not.toHaveBeenCalled();
  expect(gain.setValueAtTime).toHaveBeenCalledWith(.08,11);
  expect(gain.setValueAtTime).not.toHaveBeenCalledWith(.08,10.9);
  expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(.32,11.6);
});

it('SHOW-4: leaving during the duck restores the room even after the knock source ended',()=>{
  const ctx=FakeAudioContext.instances[0];
  const {rerender,unmount}=renderHook(watch,{initialProps:{game:live}});
  rerender({game:done,settled:true});
  ctx.currentTime=11.05;
  ctx.sources[2].onended();
  unmount();
  expect(ctx.gains[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(11.05);
  expect(ctx.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(.32,11.05);
});
