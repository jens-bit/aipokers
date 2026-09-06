// client/src/screens/birthFace.test.jsx — BIRTH-4
//
// Two bugs, both about the same ghost.
//
// 1. THE CROP. The birth card's well was pulled 34px above the sheet's own top
//    edge (`margin-top: -34px`), which is what the ref draws — but the ported
//    sheet also declares `max-height: 88%; overflow-y: auto`, and an overflow
//    box clips its own painted overflow. So the sheet cut a straight line
//    through the top of his head, on the one screen whose entire job is to
//    introduce him. He gets a full slot inside the sheet now.
//
// 2. THE FACE. The card drew a hardcoded `mood="neutral"` with no heat, so it
//    was the only ghost in the app that could not answer the served mood. The
//    face on his card is the face the server gave him.
//
// A NOTE ON MEASUREMENT. jsdom implements no layout — offsetHeight and
// getBoundingClientRect() are 0 for everything — so "is he clipped" cannot be
// measured by rendering. What can be checked, and what actually failed before
// the fix, is the declared geometry: the sheet is an overflow box, and the well
// must therefore live inside it with room for the whole ghost. That is asserted
// against the stylesheet, and the ghost's own size against the DOM.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Comments are stripped so a note sitting between two declarations cannot hide
// the one after it from these regexes.
const css = readFileSync(resolve(clientRoot, 'src/styles/chat.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-_]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};
const px = (decls, prop) => {
  const found = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(-?[\\d.]+)px`).exec(decls);
  return found ? Number(found[1]) : null;
};

// The MoodGhost viewBox is 0 0 80 80 and its glow ellipse is cx 40 cy 44,
// rx 44 ry 42 — so at render scale the glow starts 2.4/80 of the size above his
// crown and runs 4/80 past each side. The well has to hold all of that.
const GHOST = 96;
const GLOW_ABOVE = (2 / 80) * GHOST;   // top of the glow ellipse, above y=0
const GLOW_SIDE = (4 / 80) * GHOST;    // how far it runs past each side

const BORN = {
  id: 'a_new', name: 'The Solver v1.0', strategy: 'Tight, patient, unbluffable.',
  status: 'idle', presence: 'resting', activeTableId: null,
  mood: { state: 'confident', heat: 82, cause: 'born ready', updatedAt: 1 },
  firstWords: 'I fold a lot. You will get used to it.',
  nature: {
    name: 'Rock', up: 'DISCIPLINE', down: 'DECEPTION',
    line: 'He waits, and when he moves it means something.',
    builtFor: 'Not losing money. He is very hard to bluff.',
    struggle: 'Getting paid off.',
  },
  attrs: { READS: 41, FOCUS: 52, DISCIPLINE: 61, COMPOSURE: 55, DECEPTION: 22, STAMINA: 44 },
  potential: {
    READS: { lo: 54, hi: 78 }, FOCUS: { lo: 62, hi: 88 }, DISCIPLINE: { lo: 70, hi: 92 },
    COMPOSURE: { lo: 60, hi: 80 }, DECEPTION: { lo: 30, hi: 48 }, STAMINA: { lo: 60, hi: 82 },
  },
  attrLog: [],
  careerStats: { hands: 0, sessions: 0, net: null, biggestPot: 0, winRate: null },
};

const BUILT_TURN = {
  chat: [
    { role: 'user', content: 'Aggressive bluffer' },
    { role: 'assistant', content: 'Done. Here he is.' },
  ],
  ready: true,
  profile: { tightness: 71, aggression: 38, bluffFreq: 12, discipline: 74 },
  natureHint: 'Rock',
  agentId: BORN.id,
  agentName: BORN.name,
  strategy: BORN.strategy,
};

async function reachCard(record = BORN) {
  fetchMock.route('/api/agents', { agents: [record] });
  fetchMock.route('/api/agents/chat', BUILT_TURN, { method: 'POST' });

  render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));
  await waitFor(() => expect(screen.getAllByText(record.name).length).toBeGreaterThan(0));
  vi.advanceTimersByTime(2500);
  await waitFor(() => expect(screen.getByRole('button', { name: /deal him in/i })).toBeInTheDocument());
}

describe('BIRTH-4: the birth card never crops his face', () => {
  // The sheet scrolls, and a scroller is an overflow box: anything the card
  // paints above its own top edge is cut, not overhung. This is the rule the
  // -34px well broke.
  it('BIRTH-4: keeps the well inside the sheet rather than above its edge', () => {
    const sheet = rule('.birth-card3');
    expect(sheet).toMatch(/overflow-y:\s*auto/);

    const wellRow = rule('.birth-card3__well-row');
    const pulledUp = px(wellRow, 'margin-top');
    expect(pulledUp === null || pulledUp >= 0).toBe(true);
  });

  it('BIRTH-4: grows the sheet\'s top padding into a slot for him', () => {
    const sheet = rule('.birth-card3');
    const shorthand = /(?:^|;)\s*padding\s*:\s*(-?[\d.]+)px/.exec(sheet);
    const padTop = px(sheet, 'padding-top') ?? (shorthand ? Number(shorthand[1]) : 0);
    expect(padTop).toBeGreaterThan(0);
  });

  it('BIRTH-4: the well holds the whole 96px ghost, glow and all', () => {
    const well = rule('.birth-card3__well');
    const w = px(well, 'width');
    const h = px(well, 'height');

    // Height: his crown plus the glow above it must clear the well's top edge.
    expect(h).toBeGreaterThanOrEqual(GHOST + GLOW_ABOVE);
    // Width: the glow runs past both sides of the box he is drawn in.
    expect(w).toBeGreaterThanOrEqual(GHOST + GLOW_SIDE * 2);
  });
});

describe('BIRTH-4: the birth card renders the served face', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    telegram.signIn();
  });

  it('BIRTH-4: gives him the full 96px slot above his name', async () => {
    await reachCard();

    const ghost = document.querySelector('.birth-card3__well .mood-ghost');
    expect(ghost).not.toBeNull();
    expect(ghost.getAttribute('width')).toBe(String(GHOST));
    expect(ghost.getAttribute('height')).toBe(String(GHOST));
  });

  it('BIRTH-4: draws his mood, not a hardcoded neutral', async () => {
    await reachCard();

    const ghost = document.querySelector('.birth-card3__well .mood-ghost');
    expect(ghost.getAttribute('data-mood')).toBe('confident');
  });

  it('BIRTH-4: draws the tier the served heat asks for', async () => {
    await reachCard();

    // heat 82 is the high tier — the face system's top band.
    const face = document.querySelector('.birth-card3__well [data-face]');
    expect(face.getAttribute('data-face')).toBe('confident');
    expect(face.getAttribute('data-tier')).toBe('high');
  });

  it('BIRTH-4: a record with no served heat still gets a face, at the canon middle', async () => {
    await reachCard({ ...BORN, mood: { state: 'confident', cause: null, updatedAt: 1 } });

    const face = document.querySelector('.birth-card3__well [data-face]');
    expect(face.getAttribute('data-tier')).toBe('mid');
  });
});
