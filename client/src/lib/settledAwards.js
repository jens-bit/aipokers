const chips = value => Number.isFinite(value) && value >= 0;

// The engine's awards and pot are gross. Table._takeRake deducts each seat's
// actual cut from its stack/delta, then records that cut in result.rake.bySeat.
// Display payouts are after rake; they are not profit, and never alter results.
export function settledAwards(result) {
  const gross = new Map();
  for (const winner of result?.winners ?? []) {
    if (!Number.isInteger(winner?.seat) || winner.seat < 0) continue;
    const before = gross.has(winner.seat) ? gross.get(winner.seat) : 0;
    gross.set(winner.seat, before != null && chips(winner.amount) ? before + winner.amount : null);
  }
  if (!gross.size) return { awards: [], total: null };

  const bySeat = result?.rake?.bySeat;
  const hasCuts = bySeat != null && typeof bySeat === 'object' && !Array.isArray(bySeat);
  const rake = chips(result?.rake?.total) ? result.rake.total
    : hasCuts && Object.values(bySeat).every(chips) ? Object.values(bySeat).reduce((sum, cut) => sum + cut, 0) : 0;
  const potPaid = chips(result?.pot) && result.pot >= rake ? result.pot - rake : null;
  const awards = [...gross].map(([seat, amount]) => {
    if (amount == null) return { seat, amount: null };
    if (hasCuts) {
      // Side-pot entries are aggregated before the one actual seat cut.
      const cut = Object.hasOwn(bySeat, seat) ? bySeat[seat] : 0;
      return { seat, amount: chips(cut) && amount >= cut ? amount - cut : null };
    }
    if (rake > 0) {
      // Legacy total-only rake cannot assign a split to individual seats.
      // A sole known recipient can use pot minus rake if its amount agrees
      // with either gross or paid total, without subtracting a second time.
      return { seat, amount: gross.size === 1 && potPaid != null
        && (amount === result.pot || amount === potPaid) ? potPaid : null };
    }
    return { seat, amount };
  });
  const total = awards.every(award => award.amount != null)
    ? awards.reduce((sum, award) => sum + award.amount, 0) : potPaid;
  return { awards, total };
}
