import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as audio from '../../lib/audio.js';
import { useCelebrationAudio } from './HandCelebration.jsx';
afterEach(()=>vi.restoreAllMocks());
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
