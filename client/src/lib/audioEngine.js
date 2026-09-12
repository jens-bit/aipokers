// Original, deterministic Web Audio effects. No downloads, microphone or model calls.
// The gesture unlock creates one context; missed/hidden-page beats are discarded.
let context=null, roomBus=null, celebrationBus=null;
const buffers=new Map(), active=new Set();
// A knock's room hush outlives its 100ms source. Keep ownership until the
// 600ms duck ends so a departing result can remove only its own automation.
const ducks=new Map();

export function synthesizeSound(file, ms, sampleRate=44100) {
  const out=new Float32Array(Math.max(1,Math.round(ms*sampleRate/1000)));
  let seed=2166136261, noise=0;
  for(const c of file) seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const taps=[];
  const tap=(at,duration,freq,level,grain=0,fall=0)=>taps.push({at,duration,freq,level,grain,fall});
  switch(file) {
    case 'deal-tick': tap(0,.012,1250,.25,.55);break;
    case 'deal-tick-up': tap(0,.012,1700,.22,.45);break;
    case 'chip-set-down': tap(0,.14,720,.24,.35,-1400);break;
    case 'chip-ching': tap(0,.22,1250,.18,.1);tap(.012,.18,1900,.08);break;
    case 'low-swell': tap(0,.4,88,.22,.08,50);break;
    case 'heavy-hit': tap(0,.7,78,.32,.25,-65);break;
    case 'low-womp': tap(0,.3,150,.18,.06,-230);break;
    case 'soft-note': tap(0,.3,440,.16);break;
    case 'win_swell': tap(0,.4,92,.24,.05,40);tap(0,.4,138,.10);break;
    case 'big_win_bursts': for(const at of [0,.26,.52])tap(at,.3,92,.28,.65,-100);break;
    case 'bust_knock': tap(0,.1,210,.32,.65,-900);break;
    default:return out;
  }
  for(let i=0;i<out.length;i++) {
    const t=i/sampleRate;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    noise=.65*noise+.35*(seed/2147483648-1);
    let value=0;
    for(const p of taps) {
      const u=t-p.at;if(u<0||u>=p.duration)continue;
      const swell=file==='win_swell'||file==='low-swell';
      const envelope=swell?Math.sin(Math.PI*u/p.duration)**2:Math.min(1,u/.003)*Math.exp(-7*u/p.duration)*(1-u/p.duration);
      const tone=Math.sin(2*Math.PI*(p.freq*u+.5*p.fall*u*u));
      value+=p.level*envelope*((1-p.grain)*tone+p.grain*noise);
    }
    out[i]=Math.max(-.8,Math.min(.8,value));
  }
  return out;
}

export function unlockEngine() {
  try {
    if(!context) {
      const AudioCtor=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AudioCtor)return false;
      context=new AudioCtor();roomBus=context.createGain();celebrationBus=context.createGain();
      roomBus.gain.value=.32;celebrationBus.gain.value=.32;
      roomBus.connect(context.destination);celebrationBus.connect(context.destination);
    }
    if(context.state==='suspended')Promise.resolve(context.resume()).catch(()=>{});
    return context.state==='running';
  } catch { resetEngine(); return false; }
}

export function stopSounds() {
  for(const source of active){try{source.stop();source.disconnect();}catch{}}
  active.clear();ducks.clear();
  if(context&&roomBus){try{roomBus.gain.cancelScheduledValues(context.currentTime);roomBus.gain.setValueAtTime(.32,context.currentTime);}catch{}}
}

function updateRoomDuck() {
  if(!context||!roomBus)return;
  const now=context.currentTime, windows=[];
  for(const [source,window] of ducks)if(window.end<=now)ducks.delete(source);
  for(const window of [...ducks.values()].sort((a,b)=>a.at-b.at)) {
    const previous=windows.at(-1);
    if(previous&&window.at<=previous.end)previous.end=Math.max(previous.end,window.end);
    else windows.push({...window});
  }
  const current=windows.find(window=>window.at<=now&&now<window.end);
  const level=current ? .08+.24*Math.max(0,(now-(current.end-.01))/.01) : .32;
  try {
    const gain=roomBus.gain;
    gain.cancelScheduledValues(now);gain.setValueAtTime(level,now);
    for(const window of windows) {
      if(window.at>now)gain.setValueAtTime(.08,window.at);
      if(window.end-.01>now)gain.setValueAtTime(.08,window.end-.01);
      gain.linearRampToValueAtTime(.32,window.end);
    }
  }catch{}
}

function stopGroup(sources) {
  let changedDuck=false;
  for(const source of sources) {
    if(active.delete(source)){try{source.stop();source.disconnect();}catch{}}
    changedDuck=ducks.delete(source)||changedDuck;
  }
  if(changedDuck)updateRoomDuck();
}

// Capture the sources started by one synchronous beat. The returned cancel
// function is independent of other views, later sounds, and snapshot objects.
export function withSoundGroup(playSounds) {
  const before=new Set(active);
  playSounds();
  const sources=[...active].filter(source=>!before.has(source));
  return ()=>stopGroup(sources);
}

export function resetEngine() {
  stopSounds();buffers.clear();
  if(context){try{Promise.resolve(context.close()).catch(()=>{});}catch{}}
  context=null;roomBus=null;celebrationBus=null;
}

export function playEffect(sound,{delayMs=0}={}) {
  if(!context||context.state!=='running'||globalThis.document?.visibilityState==='hidden')return false;
  let source=null;
  try {
    let buffer=buffers.get(sound.file);
    if(!buffer){const samples=synthesizeSound(sound.file,sound.ms,context.sampleRate);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.copyToChannel(samples,0);buffers.set(sound.file,buffer);}
    if(active.size>=12)stopGroup([active.values().next().value]);
    source=context.createBufferSource();source.buffer=buffer;
    const special=['win_swell','big_win_bursts','bust_knock'].includes(sound.file);
    source.connect(special?celebrationBus:roomBus);
    const at=context.currentTime+Math.max(0,Math.min(1200,Number(delayMs)||0))/1000;
    if(sound.file==='bust_knock'){
      ducks.set(source,{at,end:at+.6});updateRoomDuck();
    }
    source.onended=()=>{active.delete(source);source.disconnect();};
    active.add(source);source.start(at);return true;
  }catch{if(source)stopGroup([source]);return false;}
}
