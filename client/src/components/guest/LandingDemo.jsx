import { useEffect, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { PlayingCard, CardBack } from '../system/PlayingCard.jsx';
import { ChipStack, BetSpot } from '../system/Chips.jsx';
import { HOODS } from '../../lib/identity.js';
import '../../styles/landing-demo.css';

// A poster that plays two authored hands. This is deliberately local fiction:
// no connection, account, game engine, model, or live table subscription.
const NAMES = ['Big Slick', 'Granite'];
const HANDS = [
  { holes: [['As', 'Ah'], ['Ks', 'Kd']], board: ['Ac', '7d', '2s', 'Kh', '9c'], winner: 0, result: 'Three aces', stacks: [2000, 2000] },
  { holes: [['6s', '6h'], ['Qs', 'Qh']], board: ['Qd', '6c', '2h', 'Qc', 'Jc'], winner: 1, result: 'Four queens', stacks: [2600, 1400] },
];
const BEATS = [
  { street: 'flop', board: 3, paid: [60, 60], line: 'Three cards. Two very different plans.' },
  { street: 'flop', board: 3, paid: [140, 60], actor: 0, amount: 80, line: 'Big Slick bets $80.', bubble: 'Let’s find out.' },
  { street: 'flop', board: 3, paid: [140, 140], actor: 1, amount: 80, line: 'Granite calls $80.' },
  { street: 'turn', board: 4, paid: [140, 140], line: 'The turn. Nobody is going anywhere.' },
  { street: 'turn', board: 4, paid: [140, 300], actor: 1, amount: 160, line: 'Granite bets $160.', bubble: 'Your move.' },
  { street: 'turn', board: 4, paid: [300, 300], actor: 0, amount: 160, line: 'Big Slick calls $160.' },
  { street: 'river', board: 5, paid: [300, 300], line: 'One last card. One last bet.' },
  { street: 'river', board: 5, paid: [600, 300], actor: 0, amount: 300, line: 'Big Slick bets $300.', bubble: 'Still here.' },
  { street: 'river', board: 5, paid: [600, 600], actor: 1, amount: 300, line: 'Granite calls. Show them.' },
  { street: 'showdown', board: 5, paid: [600, 600] },
  { street: 'complete', board: 5, paid: [600, 600] },
  { street: 'preflop', board: 0, paid: [10, 20], next: true, line: 'Next hand. The blinds are in.' },
  { street: 'preflop', board: 0, paid: [60, 20], next: true, actor: 0, amount: 50, line: 'Big Slick raises to $60.' },
  { street: 'preflop', board: 0, paid: [60, 60], next: true, actor: 1, amount: 40, line: 'Granite calls. Here comes the flop.' },
];
const dollars = n => `$${n.toLocaleString('en-US')}`;

export function LandingDemo() {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setTick(n => n + 1);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [paused]);
  const beat = BEATS[tick % BEATS.length];
  const deal = Math.floor(tick / BEATS.length) + (beat.next ? 1 : 0);
  const hand = HANDS[deal % HANDS.length];
  const shown = beat.street === 'showdown' || beat.street === 'complete';
  const paid = beat.street === 'complete';
  const pot = beat.paid[0] + beat.paid[1];
  const line = shown ? `${NAMES[hand.winner]} wins ${dollars(pot)}. ${hand.result}.` : beat.line;

  return <section className="landing-demo" role="region" aria-label="Demonstration poker table" data-street={beat.street}>
    <div className="landing-demo__caption"><span>DEMO · HEADS-UP</span>
      <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play demo' : 'Pause demo'}>{paused ? 'PLAY' : 'PAUSE'}</button>
    </div>
    <div className="landing-demo__felt" aria-hidden="true" />
    {[0, 1].map(seat => <div key={seat} className={`landing-demo__seat landing-demo__seat--${seat}`} data-seat={seat}>
      <span className="landing-demo__name">{NAMES[seat]}</span>
      <MoodGhost size={seat ? 68 : 90} mood={shown && hand.winner === seat ? 'confident' : 'neutral'} hood={HOODS[seat ? 2 : 0]} glow={seat ? '#8DA99D' : '#CDB380'} ring={false} hands={paid && hand.winner === seat ? 'raise' : 'hold'} />
      <div className="landing-demo__holes" key={deal}>
        {hand.holes[seat].map((card, i) => <span key={`${deal}-${i}-${seat === 1 && shown}`} className="landing-demo__card" data-opponent-card={seat === 1 ? (shown ? 'face' : 'back') : undefined} style={{ '--fan': `${i ? 9 : -9}deg` }}>
          {seat === 0 || shown ? <PlayingCard rank={card[0]} suit={card[1]} w={seat ? 23 : 31} h={seat ? 33 : 43} /> : <CardBack branded w={23} h={33} />}
        </span>)}
      </div>
      <ChipStack band="mid" w={17} cap={3} amt={dollars(hand.stacks[seat] - beat.paid[seat] + (paid && hand.winner === seat ? pot : 0))} className="landing-demo__stack" />
      {(beat.bubble && beat.actor === seat) || (paid && hand.winner === seat) ? <span key={tick} className="landing-demo__bubble">{paid ? (seat ? 'Patience pays.' : 'That’s the one.') : beat.bubble}</span> : null}
    </div>)}
    <div className="landing-demo__board">
      {Array.from({ length: 5 }, (_, i) => <span className="landing-demo__board-slot" key={`${deal}-${i}`}>
        {i < beat.board ? <span className="landing-demo__reveal" data-board-card={hand.board[i]}><PlayingCard rank={hand.board[i][0]} suit={hand.board[i][1]} w={27} h={38} /></span> : <span className="landing-demo__deck"><CardBack branded w={27} h={38} /></span>}
      </span>)}
      <span key={paid ? `won-${deal}` : 'pot'} className={`landing-demo__pot${paid ? ' landing-demo__pot--won' : ''}`}>{paid ? `${NAMES[hand.winner]} takes ` : 'POT '}{dollars(pot)}</span>
    </div>
    {beat.amount && <span key={tick} className={`landing-demo__chips landing-demo__chips--from-${beat.actor}`} aria-hidden="true"><BetSpot band={beat.amount >= 160 ? 'big' : 'mid'} w={18} /></span>}
    {paid && <span key={`payout-${deal}`} className={`landing-demo__chips landing-demo__chips--winner-${hand.winner}`} aria-hidden="true"><ChipStack band="big" w={20} cap={4} /></span>}
    <p className="landing-demo__line">{line}</p>
  </section>;
}
