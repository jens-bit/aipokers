import { Dealer } from './deck.js';
import { pickWinners } from './hand.js';

export const Streets = Object.freeze({
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  COMPLETE: 'complete',
  WAITING: 'waiting',
});

export const Actions = Object.freeze({
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
});

// Heads-up NLHE game. Two seats indexed 0 and 1. The seat that holds the
// button is the small blind and acts first preflop, last on every other street.
export class Game {
  constructor({
    tableId,
    seats,            // [{ playerId, stack }, { playerId, stack }]
    smallBlind,
    bigBlind,
    dealerSeat = 0,
  }) {
    if (!Array.isArray(seats) || seats.length !== 2) {
      throw new Error('heads-up requires exactly 2 seats');
    }
    if (!Number.isInteger(smallBlind) || smallBlind <= 0) throw new Error('smallBlind must be a positive integer');
    if (!Number.isInteger(bigBlind) || bigBlind <= smallBlind) throw new Error('bigBlind must be > smallBlind');

    this.tableId = tableId;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.dealerSeat = dealerSeat;
    this.handNumber = 0;
    this.street = Streets.WAITING;
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseSize = bigBlind;
    this.toAct = null;
    this.result = null;
    this.dealer = null;

    this.seats = seats.map(({ playerId, stack }) => ({
      playerId,
      stack,
      holeCards: [],
      contribTotal: 0,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
    }));
  }

  // ---- public API ----

  startHand() {
    if (this.street !== Streets.WAITING && this.street !== Streets.COMPLETE) {
      throw new Error(`cannot start hand from street=${this.street}`);
    }
    if (this.seats.some((s) => s.stack <= 0)) {
      throw new Error('both players need chips to start a hand');
    }

    this.handNumber += 1;
    this.dealer = new Dealer();
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;
    this.result = null;

    for (const s of this.seats) {
      s.holeCards = [];
      s.contribTotal = 0;
      s.contribThisStreet = 0;
      s.folded = false;
      s.allIn = false;
      s.actedThisStreet = false;
    }

    const sbSeat = this.dealerSeat;
    const bbSeat = 1 - this.dealerSeat;
    this._postBlind(sbSeat, this.smallBlind);
    this._postBlind(bbSeat, this.bigBlind);
    this.currentBet = Math.max(this.seats[sbSeat].contribThisStreet, this.seats[bbSeat].contribThisStreet);

    // Deal hole cards two at a time, starting from non-button (BB), as in real life.
    this.seats[bbSeat].holeCards.push(this.dealer.deal(1)[0]);
    this.seats[sbSeat].holeCards.push(this.dealer.deal(1)[0]);
    this.seats[bbSeat].holeCards.push(this.dealer.deal(1)[0]);
    this.seats[sbSeat].holeCards.push(this.dealer.deal(1)[0]);

    this.street = Streets.PREFLOP;
    this.toAct = this._firstToAct(Streets.PREFLOP);

    // Edge case: a player went all-in just from posting blinds. Skip directly
    // to runout if that exhausts further action.
    if (this._streetComplete()) this._closeStreet();
  }

  // action = { type, amount? }. amount on bet/raise is the TOTAL chips the player
  // wants to have committed on this street (matches typical poker UX).
  act(seat, action) {
    if (this.street === Streets.WAITING) throw new Error('hand has not started');
    if (this.street === Streets.COMPLETE || this.street === Streets.SHOWDOWN) {
      throw new Error('hand is over');
    }
    if (seat !== this.toAct) throw new Error('not your turn');
    const player = this.seats[seat];
    if (player.folded) throw new Error('player has folded');
    if (player.allIn) throw new Error('player is all-in');

    switch (action.type) {
      case Actions.FOLD: this._fold(seat); break;
      case Actions.CHECK: this._check(seat); break;
      case Actions.CALL: this._call(seat); break;
      case Actions.BET: this._bet(seat, action.amount); break;
      case Actions.RAISE: this._raise(seat, action.amount); break;
      default: throw new Error(`unknown action: ${action.type}`);
    }

    this._advance();
  }

  legalActions(seat) {
    if (seat !== this.toAct) return [];
    const player = this.seats[seat];
    const owed = this.currentBet - player.contribThisStreet;
    const out = [{ type: Actions.FOLD }];
    if (owed === 0) {
      // Player has matched (or there's nothing to match). They may always
      // CHECK. Whether they can BET vs RAISE depends on whether anything
      // has been put in on this street: BET opens action when currentBet
      // is zero; RAISE bumps an existing bet (e.g. BB option preflop —
      // currentBet === BB amount, owed === 0, but a BET would be illegal).
      out.push({ type: Actions.CHECK });
      if (this.currentBet === 0 && player.stack > 0) {
        const min = Math.min(this.bigBlind, player.stack);
        out.push({ type: Actions.BET, min, max: player.stack });
      } else if (this.currentBet > 0 && player.stack > 0) {
        const minRaiseTotal = this.currentBet + Math.max(this.lastRaiseSize, this.bigBlind);
        const maxRaiseTotal = player.contribThisStreet + player.stack;
        out.push({
          type: Actions.RAISE,
          min: Math.min(minRaiseTotal, maxRaiseTotal),
          max: maxRaiseTotal,
        });
      }
    } else {
      out.push({ type: Actions.CALL, amount: Math.min(owed, player.stack) });
      if (player.stack > owed) {
        const minRaiseTotal = this.currentBet + Math.max(this.lastRaiseSize, this.bigBlind);
        const maxRaiseTotal = player.contribThisStreet + player.stack;
        out.push({
          type: Actions.RAISE,
          min: Math.min(minRaiseTotal, maxRaiseTotal),
          max: maxRaiseTotal,
        });
      }
    }
    return out;
  }

  // Full server-side state. Use getPublicState(seat) for client-facing data.
  getState() {
    return {
      tableId: this.tableId,
      handNumber: this.handNumber,
      street: this.street,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      dealerSeat: this.dealerSeat,
      pot: this.pot,
      community: [...this.community],
      currentBet: this.currentBet,
      lastRaiseSize: this.lastRaiseSize,
      toAct: this.toAct,
      seats: this.seats.map((s) => ({ ...s, holeCards: [...s.holeCards] })),
      result: this.result,
    };
  }

  // Hides the opponent's hole cards unless the hand is at showdown.
  getPublicState(forSeat) {
    const state = this.getState();
    state.seats = state.seats.map((s, i) => {
      if (i === forSeat) return s;
      const reveal = this.street === Streets.SHOWDOWN || this.street === Streets.COMPLETE;
      const showAtShowdown = reveal && this.result?.showdown?.some((sd) => sd.seat === i);
      return { ...s, holeCards: showAtShowdown ? s.holeCards : [] };
    });
    return state;
  }

  // ---- internal: actions ----

  _postBlind(seat, amount) {
    const player = this.seats[seat];
    const amt = Math.min(amount, player.stack);
    player.stack -= amt;
    player.contribThisStreet = amt;
    player.contribTotal = amt;
    this.pot += amt;
    if (player.stack === 0) player.allIn = true;
  }

  _fold(seat) {
    const player = this.seats[seat];
    player.folded = true;
    player.actedThisStreet = true;
  }

  _check(seat) {
    const player = this.seats[seat];
    if (player.contribThisStreet !== this.currentBet) {
      throw new Error('cannot check — there is a bet to call');
    }
    player.actedThisStreet = true;
  }

  _call(seat) {
    const player = this.seats[seat];
    const owed = this.currentBet - player.contribThisStreet;
    if (owed <= 0) throw new Error('nothing to call — check instead');
    const amt = Math.min(owed, player.stack);
    player.stack -= amt;
    player.contribThisStreet += amt;
    player.contribTotal += amt;
    this.pot += amt;
    if (player.stack === 0) player.allIn = true;
    player.actedThisStreet = true;
  }

  _bet(seat, totalAmount) {
    const player = this.seats[seat];
    if (this.currentBet !== 0) throw new Error('there is already a bet — raise instead');
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) throw new Error('bet amount must be a positive integer');
    if (totalAmount > player.stack) throw new Error('cannot bet more than stack');
    const allIn = totalAmount === player.stack;
    if (totalAmount < this.bigBlind && !allIn) {
      throw new Error(`min bet is ${this.bigBlind}`);
    }
    player.stack -= totalAmount;
    player.contribThisStreet += totalAmount;
    player.contribTotal += totalAmount;
    this.pot += totalAmount;
    this.currentBet = player.contribThisStreet;
    this.lastRaiseSize = totalAmount;
    if (player.stack === 0) player.allIn = true;
    this._reopenAction(seat);
    player.actedThisStreet = true;
  }

  _raise(seat, totalAmount) {
    const player = this.seats[seat];
    if (this.currentBet === 0) throw new Error('no bet to raise — bet instead');
    if (!Number.isInteger(totalAmount)) throw new Error('raise amount must be an integer');
    if (totalAmount <= this.currentBet) throw new Error('raise must exceed current bet');
    const owed = totalAmount - player.contribThisStreet;
    if (owed > player.stack) throw new Error('cannot raise more than stack');
    const raiseSize = totalAmount - this.currentBet;
    const minRaise = Math.max(this.lastRaiseSize, this.bigBlind);
    const allIn = owed === player.stack;
    if (raiseSize < minRaise && !allIn) {
      throw new Error(`min raise is to ${this.currentBet + minRaise}`);
    }
    player.stack -= owed;
    player.contribThisStreet = totalAmount;
    player.contribTotal += owed;
    this.pot += owed;
    // A short all-in (less than full min-raise) does not reopen action under
    // strict NLHE rules. For heads-up the distinction is moot since the only
    // opponent must respond regardless — but we still track lastRaiseSize
    // correctly so future multi-way support is correct.
    if (raiseSize >= minRaise) this.lastRaiseSize = raiseSize;
    this.currentBet = totalAmount;
    if (player.stack === 0) player.allIn = true;
    if (raiseSize >= minRaise) this._reopenAction(seat);
    player.actedThisStreet = true;
  }

  _reopenAction(raiserSeat) {
    for (let i = 0; i < this.seats.length; i++) {
      if (i === raiserSeat) continue;
      const s = this.seats[i];
      if (s.folded || s.allIn) continue;
      s.actedThisStreet = false;
    }
  }

  // ---- internal: progression ----

  _firstToAct(street) {
    // In heads-up, button (dealer/SB) acts first preflop and last on every
    // subsequent street.
    return street === Streets.PREFLOP ? this.dealerSeat : 1 - this.dealerSeat;
  }

  _streetComplete() {
    const active = this.seats.filter((s) => !s.folded);
    if (active.length <= 1) return true;
    for (const s of active) {
      if (s.allIn) continue;
      if (!s.actedThisStreet) return false;
      if (s.contribThisStreet !== this.currentBet) return false;
    }
    return true;
  }

  _advance() {
    const notFolded = this.seats.filter((s) => !s.folded);
    if (notFolded.length === 1) {
      this._awardUncontested(notFolded[0]);
      return;
    }
    if (this._streetComplete()) {
      this._closeStreet();
      return;
    }
    this.toAct = this._nextActor(this.toAct);
  }

  _nextActor(seat) {
    // Skip over folded / all-in players. With only 2 seats this is the other
    // seat, but written generally so adding seats later is straightforward.
    for (let i = 1; i < this.seats.length; i++) {
      const next = (seat + i) % this.seats.length;
      const s = this.seats[next];
      if (!s.folded && !s.allIn) return next;
    }
    return null;
  }

  _closeStreet() {
    this._refundUncalled();

    const active = this.seats.filter((s) => !s.folded);
    if (active.length === 1) {
      this._awardUncontested(active[0]);
      return;
    }

    // If at most one player can still act, deal remaining streets without
    // betting and go straight to showdown.
    const canAct = active.filter((s) => !s.allIn);
    if (canAct.length <= 1) {
      this._runoutToRiver();
      this._showdown();
      return;
    }

    this._nextStreet();
  }

  _nextStreet() {
    for (const s of this.seats) {
      s.contribThisStreet = 0;
      s.actedThisStreet = false;
    }
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;

    if (this.street === Streets.PREFLOP) {
      this.dealer.burn();
      this.community.push(...this.dealer.deal(3));
      this.street = Streets.FLOP;
    } else if (this.street === Streets.FLOP) {
      this.dealer.burn();
      this.community.push(this.dealer.deal(1)[0]);
      this.street = Streets.TURN;
    } else if (this.street === Streets.TURN) {
      this.dealer.burn();
      this.community.push(this.dealer.deal(1)[0]);
      this.street = Streets.RIVER;
    } else if (this.street === Streets.RIVER) {
      this._showdown();
      return;
    }

    this.toAct = this._firstToAct(this.street);

    // If both players are all-in (or only one has chips), that street's
    // betting is also instantly complete.
    if (this._streetComplete()) this._closeStreet();
  }

  _runoutToRiver() {
    while (this.community.length < 5) {
      this.dealer.burn();
      if (this.community.length === 0) {
        this.community.push(...this.dealer.deal(3));
      } else {
        this.community.push(this.dealer.deal(1)[0]);
      }
    }
  }

  _refundUncalled() {
    const active = this.seats.filter((s) => !s.folded);
    if (active.length !== 2) return;
    const [a, b] = active;
    if (a.contribThisStreet === b.contribThisStreet) return;
    const high = a.contribThisStreet > b.contribThisStreet ? a : b;
    const low = high === a ? b : a;
    const excess = high.contribThisStreet - low.contribThisStreet;
    high.stack += excess;
    high.contribThisStreet -= excess;
    high.contribTotal -= excess;
    this.pot -= excess;
  }

  _awardUncontested(winner) {
    winner.stack += this.pot;
    this.result = {
      type: 'uncontested',
      pot: this.pot,
      winners: [{ seat: this.seats.indexOf(winner), playerId: winner.playerId, amount: this.pot }],
    };
    this.pot = 0;
    this.toAct = null;
    this.street = Streets.COMPLETE;
    this._rotateButton();
  }

  _showdown() {
    this.street = Streets.SHOWDOWN;
    const contestants = this.seats
      .map((s, seat) => ({ seat, playerId: s.playerId, holeCards: s.holeCards, folded: s.folded }))
      .filter((c) => !c.folded)
      .map(({ seat, playerId, holeCards }) => ({ seat, playerId, holeCards }));

    const winners = pickWinners(contestants, this.community);
    const share = Math.floor(this.pot / winners.length);
    const remainder = this.pot - share * winners.length;

    const payouts = winners.map((w, i) => {
      const amount = share + (i === 0 ? remainder : 0);
      this.seats[w.seat].stack += amount;
      return { seat: w.seat, playerId: this.seats[w.seat].playerId, amount, descr: w.descr, name: w.name };
    });

    this.result = {
      type: 'showdown',
      pot: this.pot,
      winners: payouts,
      showdown: contestants.map((c) => ({ seat: c.seat, holeCards: c.holeCards })),
    };
    this.pot = 0;
    this.toAct = null;
    this.street = Streets.COMPLETE;
    this._rotateButton();
  }

  _rotateButton() {
    this.dealerSeat = 1 - this.dealerSeat;
  }
}
