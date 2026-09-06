// client/src/components/draft/DraftSheet.jsx — DRAFT-2
//
// THE DRAFT, AS GLASS OVER THE ROOM. Port of `DraftSheetM` / `DraftRow` from
// design-refs/mood-sit.jsx (board 29 frames F02 and F03, wave 56).
//
// THE FRAME'S OWN CAPTION, which is the whole brief: "The draft is the board-26
// glass sheet risen over the room, not a grey chat on a blank screen. The room
// stays behind it, dimmed to almost nothing, because he is not in it yet. The
// sheet covers the lower band only: the top is where he forms, and watching him
// form while you talk about him is the point."
//
// So this file is only the SHEET. The room behind it and the ghost above it are
// the caller's, because the two shells mount them differently — the phone puts
// the sheet over the whole room, the desk puts the same sheet in the rail beside
// it — and a component that owned the room could not be in both places.
//
// ONE GLASS. Wave 56's law: every panel over the felt or the room is `V5GLASS`
// from board 26's ThreadSheet, sheets take `raised`, the hairline is `edgeUp`.
// The values live in styles/draft2.css beside the rest of the glass, so this
// sheet and the whisper thread can never disagree about what glass is.
//
// THE VOICE IS THE RECRUITER'S, ALL THE WAY DOWN. The ghost has no voice until
// he is born, and giving him one early would make the draft a conversation with
// someone who does not exist yet — so a `sys` row is system furniture with no
// mood, no pip and no name, and there is no branch in this file that ever draws
// a row in HIS voice.

import { DRAFT_STAGE_COUNT } from '../system/FormingGhost.jsx';

/**
 * One line of the draft.
 *
 * Two registers only — the recruiter and you — which is why this is not
 * ThreadRow: that row has four, and its who-column exists because a thread has
 * speakers to tell apart. A draft has two sides and they are told apart by which
 * wall they sit against, exactly as the ref draws it.
 */
export function DraftRow({ row }) {
  const you = row.who === 'you';
  return (
    <div className={`draft-row draft-row--${you ? 'you' : 'sys'}`} data-testid="draft-row">
      <div className="draft-row__bubble">{row.text}</div>
    </div>
  );
}

/**
 * The sheet.
 *
 * @param rows      the conversation so far, oldest first, `{ who: 'sys'|'you', text }`
 * @param stage     which of the four he is at — drawn in the head as "n OF 4"
 * @param pending   the recruiter is thinking; a typing row rides the bottom
 * @param draft     the composer's text (controlled by the caller)
 * @param onDraft   composer changes
 * @param onSend    the composer's send
 * @param busy      a send is in flight, so neither control fires twice
 * @param above     what sits between the rows and the action. The ref draws
 *                  the rows straight onto the foot, so this is empty for all
 *                  of a draft under way; the create screen uses it once, for
 *                  the suggestion chips before the first answer has landed.
 * @param action    the primary action, once there is one. Given, it TAKES THE
 *                  COMPOSER'S PLACE, which is F-1's rule and also the ref's
 *                  ("answering it turns the composer into one gold button").
 *                  It is a slot rather than a button of this sheet's own so that
 *                  the screen keeps using `NextAction` — the component that
 *                  already carries the sub-line saying why the action is offered
 *                  and the link that demotes talking rather than removing it.
 *                  Its gold is draft2.css's, scoped to this sheet.
 * @param foot      anything under the action — BIRTH-5's price line
 * @param placeholder  the composer's prompt; the ref changes it on the last question
 */
export function DraftSheet({
  rows = [],
  stage = 1,
  pending = false,
  draft = '',
  onDraft,
  onSend,
  busy = false,
  above = null,
  action = null,
  foot = null,
  placeholder = 'answer him…',
  inputRef,
}) {
  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    onSend?.(draft.trim());
  };

  return (
    <section className="draft-sheet" data-testid="draft-sheet" aria-label="The draft">
      <div className="draft-sheet__head">
        <span className="draft-sheet__grab" aria-hidden />
        <span className="draft-sheet__spacer" />
        <span className="draft-sheet__count" data-testid="draft-count">
          THE DRAFT · {Math.min(stage, DRAFT_STAGE_COUNT)} OF {DRAFT_STAGE_COUNT}
        </span>
      </div>

      {/* The ref shows the last four rows: the sheet is a conversation you are
          having, not a transcript you are auditing, and the room above it is the
          half of the screen that matters. Scrollable all the same, because a
          long answer must never be unreachable. */}
      <div className="draft-sheet__body no-scrollbar" data-testid="draft-rows">
        {rows.map((r, i) => <DraftRow key={r.id ?? i} row={r} />)}
        {pending ? (
          <div className="draft-row draft-row--sys" data-testid="draft-pending">
            <div className="draft-row__bubble">
              <span className="dr-typing"><i /><i /><i /></span>
            </div>
          </div>
        ) : null}
      </div>

      {above ? <div className="draft-sheet__above">{above}</div> : null}

      <div className="draft-sheet__foot">
        {action ?? (
          <form className="draft-sheet__composer" onSubmit={submit}>
            <input
              ref={inputRef}
              className="draft-sheet__input"
              value={draft}
              onChange={(e) => onDraft?.(e.target.value)}
              placeholder={placeholder}
              aria-label="Answer the recruiter"
              disabled={busy}
              data-testid="draft-input"
            />
            <button
              type="submit"
              className="draft-sheet__send"
              disabled={!draft.trim() || busy}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
                <path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        )}
        {foot}
      </div>
    </section>
  );
}
