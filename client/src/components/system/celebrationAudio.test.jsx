import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as audio from '../../lib/audio.js';
import { FakeAudioContext } from '../../test/fakeAudio.js';
import { useCelebrationAudio } from './HandCelebration.jsx';
afterEach(()=>{audio.resetAudio();vi.restoreAllMocks();vi.unstubAllGlobals();});
const live={tableId:'a',handNumber:1,street:'river',bigBlind:20,seats:[{playerId:'me',stack:2000},{playerId:'them',stack:1000,contribTotal:500}]};
const won={...live,street:'complete',result:{winners:[{seat:0,amount:2000}]}};
it('C8 sounds once for a watched result, never for completed entry, repeats or camera changes',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(({game,seat=0})=>useCelebrationAudio(game,seat),{initialProps:{game:won}});
  expect(play).not.toHaveBeenCalled();rerender({game:live});rerender({game:won});
  expect(play.mock.calls.map(c=>c[0])).toEqual(['winSwell','bigWinBursts']);
  rerender({game:{...won}});rerender({game:won,seat:1});expect(play).toHaveBeenCalledTimes(2);
});
it('C8 knock lands at 900ms; ordinary wins and replay stay restrained',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(({game,enabled=true})=>useCelebrationAudio(game,0,enabled),{initialProps:{game:live}});
  rerender({game:{...won,result:{winners:[{seat:0,amount:100}]}}});expect(play.mock.calls).toEqual([['winSwell']]);
  play.mockClear();rerender({game:live});rerender({game:{...won,seats:[live.seats[0],{...live.seats[1],stack:0}]}});
  expect(play.mock.calls).toEqual([['winSwell'],['bigWinBursts'],['bustKnock',{delayMs:900}]]);
  play.mockClear();rerender({game:live,enabled:false});rerender({game:won,enabled:false});expect(play).not.toHaveBeenCalled();
});

const busted={...won,seats:[live.seats[0],{...live.seats[1],stack:0}]};
const watchedAudio=({game,seat=0,enabled=true,settled=false})=>
  useCelebrationAudio(game,seat,enabled,settled);

it('SHOW-4: all-in audio waits for the visible result and consumes repeated snapshots once',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(watchedAudio,{initialProps:{game:live}});
  rerender({game:busted,settled:false});
  rerender({game:{...busted},settled:false});
  expect(play).not.toHaveBeenCalled();
  rerender({game:busted,settled:true});
  expect(play.mock.calls).toEqual([['winSwell'],['bigWinBursts'],['bustKnock',{delayMs:900}]]);
  rerender({game:{...busted},settled:true});
  rerender({game:busted,settled:false});
  rerender({game:busted,settled:true});
  expect(play).toHaveBeenCalledTimes(3);
});

it('SHOW-4: joining a completed hand during its reveal does not manufacture a watched win',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(watchedAudio,{initialProps:{game:busted,settled:false}});
  rerender({game:{...busted},settled:true});
  expect(play).not.toHaveBeenCalled();
});

it.each([
  ['camera',{seat:1}],
  ['table',{game:{...busted,tableId:'other'}}],
  ['hand',{game:{...busted,handNumber:2}}],
])('SHOW-4: changing the %s discards the pending celebration',(_kind,change)=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(watchedAudio,{initialProps:{game:live}});
  rerender({game:busted,settled:false});
  rerender({game:busted,settled:false,...change});
  rerender({game:busted,settled:true,...change});
  // Returning to the original completed view must not resurrect it either.
  rerender({game:busted,settled:true});
  expect(play).not.toHaveBeenCalled();
});

it('SHOW-4: disabled replay consumes the visible result without playing it when re-enabled',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {rerender}=renderHook(watchedAudio,{initialProps:{game:live}});
  rerender({game:busted,settled:false});
  rerender({game:busted,settled:true,enabled:false});
  rerender({game:busted,settled:true,enabled:true});
  expect(play).not.toHaveBeenCalled();
});

it('SHOW-4: disabling a pending reveal discards it before playback is re-enabled',()=>{
  const play=vi.spyOn(audio,'play').mockReturnValue(null);
  const {result,rerender}=renderHook(watchedAudio,{initialProps:{game:live}});
  rerender({game:busted,settled:false});
  rerender({game:busted,settled:false,enabled:false});
  rerender({game:busted,settled:false,enabled:true});
  rerender({game:busted,settled:true});
  expect(result.current).toBeNull();
  expect(play).not.toHaveBeenCalled();
});

it('SHOW-4: muting during runout discards the result instead of playing it after unmute',()=>{
  audio.resetAudio();
  window.localStorage.clear();
  FakeAudioContext.instances=[];
  vi.stubGlobal('AudioContext',FakeAudioContext);
  expect(audio.unlockAudio()).toBe(true);
  const ctx=FakeAudioContext.instances[0];
  const {rerender}=renderHook(watchedAudio,{initialProps:{game:live}});
  rerender({game:busted,settled:false});
  audio.setMuted(true);
  rerender({game:busted,settled:true});
  audio.setMuted(false);
  rerender({game:{...busted},settled:true});
  expect(ctx.sources).toHaveLength(0);

  const nextLive={...live,handNumber:2};
  const nextWin={...won,handNumber:2,result:{winners:[{seat:0,amount:100}]}};
  rerender({game:nextLive,settled:false});
  rerender({game:nextWin,settled:true});
  expect(ctx.sources).toHaveLength(1);
  expect(ctx.sources[0].start).toHaveBeenCalledWith(10);
});
