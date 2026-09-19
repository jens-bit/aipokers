// The Home television needs the public picture, never anyone's private cards,
// decision reasoning, strategy or opponent reads. Both wire and client merges
// use this allowlist, including nested seat appearance.
//
// UI-3 job B added `toAct` and each seat's `stack`. Neither is private — a
// stack size and whose turn it is are both things anyone standing at the
// felt can see — and the desk's other monitors (GameTile, via StandupPanel)
// need both to say whose turn it actually is and what he is playing with.
// Without them, `mergeHomeAgent`'s per-push overlay (`src/hooks/useHomeState.js`)
// replaces a fuller REST seat list with this trimmed one wholesale the moment
// any push lands, and a number this allowlist does not carry is gone for the
// rest of the session, not just delayed.
export function homeTablePreview(game) {
  if (!game || typeof game.tableId !== 'string' || !game.tableId) return null;
  const view = {tableId:game.tableId};
  for (const key of ['street','blinds']) if (typeof game[key] === 'string') view[key]=game[key];
  for (const key of ['pot','heroSeat','handNumber','seatCount','maxSeats','toAct']) if (Number.isFinite(game[key])) view[key]=game[key];
  // BUG-244: null ends a turn. Omitting it would retain the previous actor
  // when a client merges the next street or completed hand over its preview.
  if (game.toAct === null) view.toAct=null;
  for (const key of ['home','hot']) if (typeof game[key] === 'boolean') view[key]=game[key];
  if (Array.isArray(game.board)) view.board=game.board.filter(c=>typeof c==='string'&&/^[2-9TJQKA][cdhs]$/i.test(c)).slice(0,5);
  if (Array.isArray(game.seats)) view.seats=game.seats.map(seat=>{
    const visible={};
    if(Number.isInteger(seat?.seat)) visible.seat=seat.seat;
    if(typeof seat?.displayName==='string') visible.displayName=seat.displayName;
    if(Number.isFinite(seat?.stack)) visible.stack=seat.stack;
    if(seat?.identity && typeof seat.identity.hood==='string' && typeof seat.identity.glow==='string') visible.identity={hood:seat.identity.hood,glow:seat.identity.glow};
    if(seat?.mood && typeof seat.mood.state==='string') visible.mood={state:seat.mood.state,...(Number.isFinite(seat.mood.heat)?{heat:seat.mood.heat}:{})};
    return visible;
  });
  return view;
}
