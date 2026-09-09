import { useEffect, useRef, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { paintShareCanvas, shareDimensions } from './drawShareCard.js';
// The preview uses the export painter, plus a text alternative when canvas is unavailable.
export function ShareCard({
  model,
  format = 'story',
  size = 296,
  ghostRef = null
}) {
  const canvas = useRef(null),
    ownGhost = useRef(null),
    ref = ghostRef || ownGhost;
  const [status, setStatus] = useState('loading');
  const {
      width,
      height
    } = shareDimensions(format),
    u = Math.min(width, height);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    const pending = document.createElement('canvas');
    paintShareCanvas(pending, model, {
      format,
      ghostNode: ref.current?.querySelector('svg')
    }).then(ok => {
      if (active) {
        if (ok) {
          canvas.current.width = pending.width;
          canvas.current.height = pending.height;
          canvas.current.getContext('2d')?.drawImage(pending, 0, 0);
        }
        setStatus(ok ? 'ready' : 'unavailable');
      }
    }).catch(() => {
      if (active) setStatus('unavailable');
    });
    return () => {
      active = false;
    };
  }, [model, format, ref]);
  return <div className="share-card" data-testid="share-card" data-format={format} data-status={status} style={{
    position: 'relative',
    width: size,
    maxWidth: '100%',
    aspectRatio: width + '/' + height,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 6,
    background: '#0A0F0E'
  }}>
  <canvas ref={canvas} role="img" aria-label={model.name + ' · ' + model.result + (model.talk ? ' · “' + model.talk + '”' : '') + ' · ' + model.mark} style={{
      display: 'block',
      width: '100%',
      height: '100%'
    }} />
  <div aria-hidden="true" ref={ref} style={{
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none'
    }}><MoodGhost mood={model.mood} heat={model.heat} accent={model.moodColor} hood={model.identity?.hood} glow={model.identity?.glow?.c} size={u * (width > height ? .19 : .34)} ring={false} hands={model.won ? 'raise' : 'rest'} /></div>
  {status === 'unavailable' && <div style={{
      position: 'absolute',
      inset: 12,
      color: '#EDEDED',
      fontSize: 13
    }}>{model.name}<br />{model.result}<br />{model.talk}<br />{model.mark}<p>Image preview unavailable. You can still share the caption.</p></div>}
 </div>;
}
