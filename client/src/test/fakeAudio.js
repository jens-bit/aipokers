import { vi } from 'vitest';
export class FakeAudioContext {
  static instances=[];
  constructor(){this.state='running';this.sampleRate=44100;this.currentTime=10;this.destination={};this.sources=[];this.gains=[];this.constructor.instances.push(this);}
  createGain(){const node={gain:{value:1,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()},connect:vi.fn()};this.gains.push(node);return node;}
  createBuffer(channels,length,sampleRate){return {channels,length,sampleRate,copyToChannel:vi.fn()};}
  createBufferSource(){const node={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};this.sources.push(node);return node;}
  resume(){this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
}
