// GLASS — port of design-refs/mood-watch4c.jsx (`GLASS`, `Glass`, `GLbl`),
// carried forward by design-refs/mood-watch5.jsx (`V5GLASS`, `V5Glass`, `V5Lbl`).
//
// "The area under the felt was a grey sheet butted against a dark green table:
// two different materials meeting at a hard line, which is why it looked cheap
// next to the felt." Every panel on the watch screen is now the same glass —
// translucent over the felt's own colour, a thin light border, and a display-font
// section label rather than the Oswald small-caps that reads as chrome.
//
// The numbers are v5's (a touch more opaque and a wider blur than v4c's, because
// v5 floats these over a live felt rather than over a solid lower half). They
// live here as tokens so the sheet, the strip and the composer cannot drift.

export const GLASS = {
  panel: 'rgba(13,23,21,0.72)',
  raised: 'rgba(18,30,28,0.84)',
  edge: 'rgba(255,255,255,0.11)',
  edgeUp: 'rgba(255,255,255,0.17)',
  blur: 'blur(18px) saturate(1.2)',
};

export function Glass({ up, pad, className, style, children, ...rest }) {
  return (
    <div
      className={`glass${up ? ' glass--up' : ''}${className ? ` ${className}` : ''}`}
      style={pad ? { padding: pad, ...style } : style}
      {...rest}
    >{children}</div>
  );
}

// Section labels take the DISPLAY face, not the Oswald label style — on glass a
// small-caps label reads as chrome, and this half of the screen is not chrome.
export function GlassLabel({ children, className, style }) {
  return (
    <span className={`glass-lbl${className ? ` ${className}` : ''}`} style={style}>{children}</span>
  );
}
