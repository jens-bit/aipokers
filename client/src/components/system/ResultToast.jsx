// WATCH-7 — the hand end, as a receipt.
//
// WATCH-6 ended every hand with the WON/LOST block: his name, a serif WON, the
// delta, his face, and two buttons over the whole felt. The playtest verdict was
// that it is a SESSION moment being fired forty times a session — the first one
// lands, the fifth is furniture, and by the tenth the owner is waiting for the
// felt to come back.
//
// So a hand end is quiet now. The pot slides to the winner, his stack ticks to
// its new number, and this — one line over his strip, teal or red, gone in a
// second and a half. It never takes a tap, never covers the board, and never
// stops the next deal: `pointer-events: none`, and the felt keeps playing
// underneath it.
//
// The ceremony still exists. It belongs to SESSION_END (see SessionCeremony),
// where a WON/LOST that big is telling the truth about the size of the moment.

export function ResultToast({ delta, won }) {
  if (!delta) return null;
  return (
    <div className={'watch-result-toast' + (won ? ' is-won' : ' is-lost')}
      role="status" aria-live="polite">
      <span className="watch-result-toast__amt">{delta}</span>
    </div>
  );
}
