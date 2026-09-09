import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { play, resetAudio, unlockAudio, setMuted, SOUNDS } from './audio.js';
import { synthesizeSound } from './audioEngine.js';
import { FakeAudioContext } from '../test/fakeAudio.js';
beforeEach(()=>{resetAudio();window.localStorage.clear();FakeAudioContext.instances=[];vi.stubGlobal('AudioContext',FakeAudioContext);});
afterEach(()=>{resetAudio();vi.unstubAllGlobals();});
it('BUG-112: no sound is reported as heard before browser audio is unlocked',()=>{expect(play('allin')).toBeNull();expect(FakeAudioContext.instances).toHaveLength(0);});
it('BUG-112: unlocked output uses cached buffers and mute cancels even a delayed knock',()=>{
  expect(unlockAudio()).toBe(true);const ctx=FakeAudioContext.instances[0];
  expect(play('winSwell')).toBe(SOUNDS.winSwell);play('winSwell');
  expect(ctx.sources[0].buffer).toBe(ctx.sources[1].buffer);
  expect(ctx.sources[0].buffer.copyToChannel).toHaveBeenCalledOnce();
  play('bustKnock',{delayMs:900});expect(ctx.sources[2].start).toHaveBeenCalledWith(10.9);
  expect(ctx.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(.32,11.5);
  setMuted(true);for(const source of ctx.sources)expect(source.stop).toHaveBeenCalledOnce();
  expect(play('allin')).toBeNull();
});
it('BUG-112: unavailable or suspended audio stays silent without queuing old beats',()=>{
  vi.stubGlobal('AudioContext',undefined);expect(unlockAudio()).toBe(false);expect(play('allin')).toBeNull();
  vi.stubGlobal('AudioContext',FakeAudioContext);unlockAudio();const ctx=FakeAudioContext.instances[0];ctx.state='suspended';
  expect(play('winSwell')).toBeNull();expect(ctx.sources).toHaveLength(0);
});
it('C8 original effects are finite, bounded and keep the 260ms burst spacing',()=>{
  for(const sound of Object.values(SOUNDS).filter(Boolean)){
    const samples=synthesizeSound(sound.file,sound.ms,10000);expect(samples.length).toBe(sound.ms*10);
    expect(samples.every(Number.isFinite)).toBe(true);expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.8);
    expect(samples.some(v=>Math.abs(v)>.01)).toBe(true);
  }
  const samples=synthesizeSound('big_win_bursts',1200,10000);
  const energy=(a,b)=>samples.slice(a*10,b*10).reduce((sum,v)=>sum+v*v,0)/(b-a);
  for(const start of [0,260,520])expect(energy(start+10,start+60)).toBeGreaterThan(energy(start+220,start+250)*10);
  expect(energy(900,1200)).toBe(0);
});
