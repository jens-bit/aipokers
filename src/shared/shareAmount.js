// Only a recorded net stack change may be shown as personal winnings/losses.
export function shareAmount(hand) {
  const net = hand?.net;
  if (Number.isFinite(net)) return (net > 0 ? '+' : net < 0 ? '−' : '') + '$' + Math.abs(net).toLocaleString('en-US');
  const pot = hand?.pot;
  return Number.isFinite(pot) && pot >= 0 ? '$' + pot.toLocaleString('en-US') + ' pot' : 'Result unavailable';
}
