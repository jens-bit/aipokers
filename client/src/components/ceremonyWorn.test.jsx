// client/src/components/ceremonyWorn.test.jsx — AGENT-5 job H
//
// THE END SCREEN TELLS THE TRUTH.
//
// `reason` has ridden the SESSION_END record since SERVER-3 and the ceremony
// used it for exactly one thing: a word in the 9px grey line under the
// figures. So a session that ended because the man was SPENT announced itself
// as LOST, off the chip result, with WORN filed beneath it in the small print.
//
// That is what Jens saw. Every agent in the household played one hand, was
// pulled by the session stop rule, and came home with a YOU LOST screen — a
// true number telling the wrong story. He did not lose the night; he ran out.
//
// So on this one ending the head reads WORN OUT, the sentence under it is HIS,
// carrying the remedy and the number in it, and the money is demoted to a
// footnote rather than removed — what happened to his stack is still a thing
// that happened.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SessionCeremony } from './WatchScreen.jsx';

// The sentence restFloor.js builds and sessionEndRecord carries. Written out
// rather than imported, because this file is asserting that the CLIENT renders
// whatever the server sent — importing the builder would let a change to it
// pass unnoticed here.
const REMEDY = "Is there food in? I'm not fussy. Three snacks should do it.";

const ceremony = (props) => render(
  <SessionCeremony
    agentName="Granite" net={-320} stack={1680} hands={1}
    talkLabel="Talk to Granite about tonight"
    {...props}
  />,
).container.querySelector('.watch-ceremony');

describe('AGENT-5 job H — a session that ended worn', () => {
  it('says he is worn out, not that he lost', () => {
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('WORN OUT');
    expect(el.querySelector('.watch-ceremony__head')).not.toHaveTextContent('LOST');
  });

  it('names the remedy, in his own words, with the number in it', () => {
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false });
    const note = el.querySelector('.watch-ceremony__note');
    expect(note).toBeTruthy();
    expect(note).toHaveTextContent('Three snacks');
  });

  it('keeps the chip result, and makes it secondary', () => {
    // Removing it would be a second lie. It is still on the screen; what
    // changed is that nobody reads it first.
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false });
    expect(el.getAttribute('data-reason')).toBe('worn');
    expect(el.querySelector('.watch-ceremony__delta-amt')).toHaveTextContent('320');
    expect(el.querySelector('.watch-ceremony__stack')).toHaveTextContent('1,680');
    // And the big word no longer says which way the money went, so a small one
    // does.
    expect(el.querySelector('.watch-ceremony__scope')).toHaveTextContent('down');
  });

  it('a worn night he was UP still says worn out', () => {
    const el = ceremony({ reason: 'worn', note: REMEDY, won: true, net: 540 });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('WORN OUT');
    expect(el.querySelector('.watch-ceremony__scope')).toHaveTextContent('up');
  });

  it('does not put his hands over his face', () => {
    // The pose is for a beat that went against him. A man who is worn out is
    // not stunned, he is done for the night.
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false });
    expect(el.querySelector('.watch-ceremony__hands')).toBeNull();
  });
});

describe('AGENT-5 job H — and everything else is untouched', () => {
  it('a lost night is still LOST', () => {
    const el = ceremony({ reason: 'stopped', won: false });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('LOST');
    expect(el.querySelector('.watch-ceremony__note')).toBeNull();
    expect(el.getAttribute('data-reason')).toBeNull();
    expect(el.querySelector('.watch-ceremony__hands')).toBeTruthy();
  });

  it('a won night is still WON', () => {
    const el = ceremony({ reason: 'stopped', won: true, net: 900 });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('WON');
    expect(el.querySelector('.watch-ceremony__scope')).toBeNull();
  });

  it('BUSTED outranks worn — a man with no chips has a different problem', () => {
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false, busted: true, stack: 0 });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('BUSTED');
    expect(el.querySelector('.watch-ceremony__note')).toBeNull();
  });

  it('a human game never reads worn — nothing behind it has stamina', () => {
    const el = ceremony({ reason: 'worn', note: REMEDY, won: false, human: true });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('YOU LOST');
    expect(el.querySelector('.watch-ceremony__note')).toBeNull();
  });

  it('worn with no sentence behind it still says worn out', () => {
    // An older server, or a remedy that could not be phrased. The reason alone
    // still tells the truth; only the remedy is missing.
    const el = ceremony({ reason: 'worn', note: null, won: false });
    expect(el.querySelector('.watch-ceremony__head')).toHaveTextContent('WORN OUT');
    expect(el.querySelector('.watch-ceremony__note')).toBeNull();
  });
});
