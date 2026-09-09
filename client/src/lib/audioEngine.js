// Original, deterministic Web Audio effects. No downloads, microphone or model calls.
// The gesture unlock creates one context; missed/hidden-page beats are discarded.
let context=null, roomBus=null, celebrationBus=null;
const buffers=new Map(), active=new Set();

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
  active.clear();
  if(context&&roomBus){try{roomBus.gain.cancelScheduledValues(context.currentTime);roomBus.gain.setValueAtTime(.32,context.currentTime);}catch{}}
}

export function resetEngine() {
  stopSounds();buffers.clear();
  if(context){try{Promise.resolve(context.close()).catch(()=>{});}catch{}}
  context=null;roomBus=null;celebrationBus=null;
}

export function playEffect(sound,{delayMs=0}={}) {
  if(!context||context.state!=='running'||globalThis.document?.visibilityState==='hidden')return false;
  try {
    let buffer=buffers.get(sound.file);
    if(!buffer){const samples=synthesizeSound(sound.file,sound.ms,context.sampleRate);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.copyToChannel(samples,0);buffers.set(sound.file,buffer);}
    if(active.size>=12){const oldest=active.values().next().value;oldest.stop();active.delete(oldest);}
    const source=context.createBufferSource();source.buffer=buffer;
    const special=['win_swell','big_win_bursts','bust_knock'].includes(sound.file);
    source.connect(special?celebrationBus:roomBus);
    const at=context.currentTime+Math.max(0,Math.min(1200,Number(delayMs)||0))/1000;
    if(sound.file==='bust_knock'){
      roomBus.gain.cancelScheduledValues(at);roomBus.gain.setValueAtTime(.08,at);
      roomBus.gain.setValueAtTime(.08,at+.59);roomBus.gain.linearRampToValueAtTime(.32,at+.6);
    }
    source.onended=()=>{active.delete(source);source.disconnect();};
    active.add(source);source.start(at);return true;
  }catch{return false;}
}
