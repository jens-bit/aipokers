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

export const RailMark = ({ size = 20, color = '#00D4AA' }) => {
  const uid = useId().replace(/:/g, '');
  const fist = x => (
    <g key={x} transform={`translate(${x} 37.4)`}>
      <rect x="-6.1" y="-4.85" width="12.2" height="9.7" rx="4.7" fill="#000"/>
      <rect x="-4.95" y="-3.7" width="9.9" height="7.4" rx="3.6" fill="#fff"/>
      <rect x="-2.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
      <rect x="1.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0 }} role="img" aria-label="Railbird">
      <defs>
        <mask id={'rbm' + uid} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect x="0" y="0" width="64" height="64" fill="#000"/>
          <path d={RB_MARK.hood} fill="#fff"/>
          <path d={RB_MARK.face} fill="#000"/>
          <path d={RB_MARK.browL} fill="#fff"/>
          <path d={RB_MARK.browR} fill="#fff"/>
          <path d={RB_MARK.eyeL} fill="#fff"/>
          <path d={RB_MARK.eyeR} fill="#fff"/>
          <path d={RB_MARK.pad} fill="#fff"/>
          <path d={RB_MARK.seam} fill="#000"/>
          <path d={RB_MARK.line} fill="#fff"/>
          {[14.7, 49.3].map(fist)}
        </mask>
      </defs>
      <rect x="0" y="0" width="64" height="64" fill={color} mask={`url(#rbm${uid})`}/>
    </svg>
  );
};
