// Board 41 / mood-atoms.jsx: the product's ghost at the rail, ported unchanged.
import { useId } from 'react';

const RB_MARK = {
  hood: 'M14.4 45V27C14.4 15.6 22.5 8.6 32.5 8.6C42.5 8.6 50.6 15.6 50.6 27V45Z',
  face: 'M20.8 45V27.5C20.8 20.2 26 15.7 32.65 15.7C39.3 15.7 44.5 20.2 44.5 27.5V45Z',
  browL: 'M23.4 24H30.1A0.7 0.7 0 0 1 30.1 25.5H23.4A0.7 0.7 0 0 1 23.4 24Z',
  browR: 'M34.9 24H41.6A0.7 0.7 0 0 1 41.6 25.5H34.9A0.7 0.7 0 0 1 34.9 24Z',
  eyeL: 'M26.6 29.8m-3 0a3 2.4 0 1 0 6 0a3 2.4 0 1 0-6 0Z',
  eyeR: 'M38.7 29.8m-3 0a3 2.4 0 1 0 6 0a3 2.4 0 1 0-6 0Z',
  pad: 'M-2 39.2H66V44.6H-2Z', seam: 'M-2 42.2H66V42.9H-2Z', line: 'M-2 45.8H66V47.4H-2Z',
};

// Optical poses from board 41. The glyph enlarges the eyes and crops to the hood.
const POSES = {
  close:{k:1,hands:14.7,cy:37.4,fist:1}, lean:{k:.86,hands:17.8,cy:38,fist:.86},
  hood:{k:1.1,hands:13.2,cy:37,fist:1.06}, far:{k:.7,hands:null},
  icon:{k:.86,hands:17.5,cy:37.6,fist:.9}, glyph:{k:1.02,hands:null,bare:true,fill:true},
};
const GLYPH = {
  face:'M19.4 45V27.2C19.4 19 25.3 14 32.5 14C39.7 14 45.6 19 45.6 27.2V45Z',
  eyeL:'M27.0 30.6m-4.2 0a4.2 3.3 0 1 0 8.4 0a4.2 3.3 0 1 0-8.4 0Z',
  eyeR:'M38.0 30.6m-4.2 0a4.2 3.3 0 1 0 8.4 0a4.2 3.3 0 1 0-8.4 0Z',
};
export const RailMark = ({ size = 20, color = '#00D4AA', pose = 'close', style }) => {
  const p = POSES[pose] ?? POSES.close;
  const uid = useId().replace(/:/g, '');
  const fist = x => (
    <g key={x} transform={`translate(${x} ${p.cy}) scale(${p.fist})`}>
      <rect x="-6.1" y="-4.85" width="12.2" height="9.7" rx="4.7" fill="#000"/>
      <rect x="-4.95" y="-3.7" width="9.9" height="7.4" rx="3.6" fill="#fff"/>
      <rect x="-2.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
      <rect x="1.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
    </g>
  );
  return (
    <svg xmlns="http://www.w3.org/2000/svg" data-pose={pose} width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0, ...style }} role="img" aria-label="Railbird">
      <defs>
        <mask id={'rbm' + uid} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect x="0" y="0" width="64" height="64" fill="#000"/>
          <g transform={p.fill ? 'translate(32 32) scale(1.59) translate(-32.5 -26.8)' : `translate(32 45) scale(${p.k}) translate(-32 -45)`}>
            <path d={RB_MARK.hood} fill="#fff"/>
            <path d={p.fill ? GLYPH.face : RB_MARK.face} fill="#000"/>
            {!p.fill && <><path d={RB_MARK.browL} fill="#fff"/><path d={RB_MARK.browR} fill="#fff"/></>}
            <path d={p.fill ? GLYPH.eyeL : RB_MARK.eyeL} fill="#fff"/>
            <path d={p.fill ? GLYPH.eyeR : RB_MARK.eyeR} fill="#fff"/>
          </g>
          {!p.bare && <><path d={RB_MARK.pad} fill="#fff"/><path d={RB_MARK.seam} fill="#000"/><path d={RB_MARK.line} fill="#fff"/></>}
          {p.hands != null && [p.hands, 64-p.hands].map(fist)}
        </mask>
      </defs>
      <rect x="0" y="0" width="64" height="64" fill={color} mask={`url(#rbm${uid})`}/>
    </svg>
  );
};
