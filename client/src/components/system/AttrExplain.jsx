// F-3 — onboarding, the only way it is allowed to happen.
// Port of design-refs/mood-birth3.jsx AttrExplain.
//
// No tutorial screen, no text wall, no six-card carousel. An attribute explains
// itself the first time it costs him something, in the thread, in one sentence,
// on a tap. After the first time the label is just a label.
//
// The bar underneath is his real one, so the sentence is about him and not
// about the concept: the gold band says how good he might get, and the number
// beside it is where he is now.
import { ATTR_META } from '../../lib/attributes.js';
import { AttrBar } from './AttrBar.jsx';

export function AttrExplain({ attrKey, row }) {
  const meta = ATTR_META[attrKey];
  if (!meta) return null;

  return (
    <div className="attr-explain">
      <div className="attr-explain__head">
        <span className="attr-explain__key">{attrKey}</span>
        <div className="attr-explain__rule" />
        <span className="attr-explain__once">FIRST TIME ONLY</span>
      </div>

      <div className="attr-explain__mean">
        {meta.meanShort}. It grows from {meta.trainsShort}.
      </div>

      {row && (
        <>
          <div className="attr-explain__bar">
            <AttrBar name={attrKey} cur={row.cur} lo={row.lo} hi={row.hi} fatigued={row.fatigued} />
          </div>
          <div className="attr-explain__his">
            His is {row.cur}. The gold band is how good he might get.
          </div>
        </>
      )}
    </div>
  );
}
