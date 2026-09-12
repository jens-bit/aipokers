import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WatchFelt } from '../WatchScreen.jsx';
import { identityOf } from '../../lib/identity.js';
import lesson from '../../lib/practiceLesson.json';
import { readPractice, savePractice } from './PracticeEntry.jsx';
import '../../styles/practice.css';

const questions = [
  { question: 'Why did you bet?', answer: 'With a strong hand, a bet can get more chips into the pot when a weaker hand calls. In this example, three kings became a full house. A different deal can end in a loss.' },
  { question: 'What is a full house?', answer: 'Three cards of one rank and two of another. Here the best five cards are three kings and two sevens. Both players can use the five shared cards.' },
  { question: 'Who plays next?', answer: 'In Watch, your agent makes the poker decisions. Choose Play yourself at a normal table when you want to make your own decisions. Practice waits for you to press Next. Casino agents can keep playing after you leave Watch; closing the view does not call them home.' },
];
const targets = {
  hero: ['.watch-hero__body', 'Your agent'],
  cards: ['.watch-felt__hero-cards', 'His two cards'],
  board: ['.watch-felt__board', 'Shared cards'],
  action: ['.watch-hero__strip', 'His action'],
  result: ['.watch-felt__won', 'Hand result'],
};

function PracticePointer({ container, target, step }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const root = container.current;
    if (!root || !targets[target]) { setBox(null); return undefined; }
    const update = () => {
      const node = root.querySelector(targets[target][0]);
      if (!node) { setBox(null); return; }
      const r = root.getBoundingClientRect(), t = node.getBoundingClientRect();
      setBox(t.width > 0 ? { left: t.left - r.left, top: t.top - r.top, width: t.width, height: t.height, sceneWidth: r.width } : null);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    const timer = setTimeout(update, 500);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [container, target, step]);
  if (!box || !targets[target]) return null;
  const { sceneWidth, ...rect } = box;
  const pointerLeft = Math.min(Math.max((box.width - 120) / 2, 8 - box.left), sceneWidth - 128 - box.left);
  return <div className="practice-highlight" style={rect} aria-hidden="true" data-testid="practice-pointer">
    <span className={`practice-pointer${box.top < 55 ? ' is-below' : ''}`} style={{ left: pointerLeft }}><span>{targets[target][1]}</span><svg width="18" height="22" viewBox="0 0 18 22"><path d="M9 1v17m-6-6 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
  </div>;
}

export function GuidedPractice({ agent, ownerId, isGuest = false, onExit, onChat, onCasino }) {
  const [step, setStep] = useState(() => { const saved = readPractice(ownerId, agent.id); return saved.completed ? 0 : saved.step; });
  const [answer, setAnswer] = useState(null);
  const scene = useRef(null);
  const [tableScale, setTableScale] = useState(1);
  const heading = useRef(null);
  const frame = lesson.frames[Math.min(step, lesson.frames.length - 1)];
  const conversation = step === lesson.frames.length;
  const complete = step > lesson.frames.length;
  const identity = identityOf(agent);
  useLayoutEffect(() => {
    const node = scene.current;
    if (!node) return undefined;
    const resize = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) setTableScale(Math.min(width / 390, height / 500));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const game = useMemo(() => ({
    ...frame.game,
    seats: frame.game.seats.map((seat, index) => ({ ...seat,
      displayName: index === lesson.heroSeat ? agent.name : 'Practice opponent',
      identity: index === lesson.heroSeat ? { hood: identity.hood.id, glow: identity.glow.id } : { hood: 'sand', glow: 'gold' },
    })),
  }), [frame, agent.name, identity.hood.id, identity.glow.id]);
  useEffect(() => {
    savePractice(ownerId, agent.id, { step, dismissed: true, completed: complete });
  }, [ownerId, agent.id, step, complete]);
  useEffect(() => {
    const escape = e => { if (e.key === 'Escape') onExit?.(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onExit]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  const title = complete ? 'Ready for your own story.' : conversation ? 'Ask about the hand.' : frame.title;
  const text = complete ? 'That was a guided example. Real hands can win or lose. You decide what happens next. At the casino, leaving Watch closes your view; it does not call your agent home.'
    : conversation ? `Choose a question for a guided explanation. ${isGuest ? 'Sign in after practice to send your own messages.' : 'Your regular chat is available after practice.'}` : frame.narration;
  return (
    <main className="practice" data-testid="guided-practice" data-step={complete ? 'complete' : conversation ? 'conversation' : frame.id}>
      <header className="practice-header"><div><span className="practice-eyebrow">RAILBIRD · PRACTICE</span><span>One hand, at your pace</span></div><button type="button" className="practice-quiet" onClick={onExit}>Leave practice</button></header>
      <div className="practice-layout">
        <section className="practice-table" aria-label="Practice poker table">
          <p className="practice-role" data-testid="practice-role">You are watching. <strong>{agent.name} is playing.</strong></p>
          <div className="practice-scene" ref={scene}>
            <div className="practice-felt" style={{ transform: `translate(-50%, -50%) scale(${tableScale})` }}>
            <WatchFelt game={game} mySeat={lesson.heroSeat} lastDecision={frame.lastAction}
              flipped={game.community.length} newCard={false} agentAccent={identity.glow.c}
              onTapHero={() => { heading.current?.focus(); }} heroActionLabel={`Your agent ${agent.name}`} />
            </div>
            {!conversation && !complete && <PracticePointer container={scene} target={frame.target} step={step} />}
          </div>
          <p className="practice-hand" data-testid="practice-hand"><span>{agent.name}’s hand</span><strong>{frame.madeHand?.includes('full') ? `Full house · ${frame.madeHand}` : frame.madeHand || 'Pair of kings'}</strong></p>
          <p className="practice-caption">Guided example · practice chips · balances and career stats stay unchanged</p>
        </section>
        <section className="practice-coach" aria-label="Practice guide">
          <div className="practice-progress" aria-label={`Step ${step + 1} of 10`}>{Array.from({ length: 10 }, (_, i) => <span key={i} className={i <= step ? 'is-done' : ''}/>)}</div>
          <span className="practice-eyebrow">{complete ? 'PRACTICE COMPLETE' : `STEP ${step + 1} OF 10`}</span>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          <p className="practice-explanation">{text}</p>
          {frame.id === 'showdown' && !conversation && !complete && <div className="practice-result" data-testid="practice-result">
            <strong>{agent.name} wins with {lesson.result.hand}.</strong>
            <dl><div><dt>Pot returned</dt><dd>{lesson.result.payout} chips</dd></div><div><dt>Net gain</dt><dd>+{lesson.result.net} chips</dd></div></dl>
            <p>The pot includes his own bets. His practice stack goes from 200 to 214.</p>
          </div>}
          {conversation && <div className="practice-conversation" data-testid="practice-conversation">
            <div className="practice-questions" data-testid="practice-questions">{questions.map((q, i) => <button key={q.question} type="button" aria-pressed={answer === i} onClick={() => setAnswer(i)}>{q.question}</button>)}</div>
            {answer != null && <div className="practice-answer" data-testid="practice-answer" role="status"><span className="practice-eyebrow">GUIDED EXPLANATION</span><p>{questions[answer].answer}</p></div>}
          </div>}
          {complete ? <div className="practice-choices">
            {isGuest && <p className="practice-explanation">Sign in to send your own messages. You can keep exploring as a guest.</p>}
            <button type="button" className="practice-primary" onClick={() => onChat?.(agent)}>{isGuest ? 'Sign in to chat with' : 'Chat with'} {agent.name}</button>
            <button type="button" onClick={() => onCasino?.(agent)}>Explore casino</button>
            <button type="button" onClick={onExit}>Back home</button>
            <button type="button" className="practice-quiet" onClick={() => { setAnswer(null); setStep(0); }}>Replay practice</button>
          </div> : null}
        </section>
        {!complete && <nav className="practice-nav" aria-label="Practice steps">
            <button type="button" className="practice-quiet" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Back</button>
            <button type="button" className="practice-primary" disabled={conversation && answer == null} onClick={() => setStep(s => s + 1)}>{conversation ? 'Finish practice' : 'Next'}</button>
          </nav>}
      </div>
    </main>
  );
}
