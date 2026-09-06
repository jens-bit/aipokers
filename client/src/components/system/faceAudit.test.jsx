// client/src/components/system/faceAudit.test.jsx — BIRTH-4
//
// The face system (five states x three heat tiers) shipped in WATCH-6, but only
// the watch screen ever reached it. Everywhere else kept drawing the pre-tier
// eyes, because there were three copies of the face in the tree:
//
//   · GhostFace.ghostFace  — the real one, tiered, reached by MoodGhost
//   · FloorGhost           — its own inline eyes(), so the whole floor, the
//                            watch felt's seats and the floor zoom were flat
//   · Ghost.jsx            — a third copy nothing imported any more
//
// Two of those are gone. This file is the audit that keeps them gone: one face
// function, reached by every vehicle, and the tier comes from the served mood
// rather than from whatever each call site felt like passing.
//
// GhostFace.test.jsx owns the faces themselves — what each tier looks like and
// how detail falls away with size. This owns who is allowed to draw one.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// The floor's dim/scrim rules are stylesheet rules, and CasinoFloor is mounted
// here for real — the same import floor2.test.jsx makes.
import '../../styles/floor.css';

import { MoodGhost } from './MoodGhost.jsx';
import { SeatGhost } from './SeatGhost.jsx';
import { MoodBand } from './MoodBand.jsx';
import { FloorGhost } from '../floor/atoms.jsx';
import { heatOf, moodOf } from '../floor/agentView.js';
import { PocketRow } from '../wallet/PocketRow.jsx';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const MOODS = ['confident', 'neutral', 'frustrated', 'tilted', 'sulking'];
const TIERS = [[8, 'low'], [45, 'mid'], [91, 'high']];

// A face is on screen when the shared function drew it: it is the only thing
// in the tree that stamps data-face/data-tier.
const faces = (container) => [...container.querySelectorAll('[data-face]')];

describe('BIRTH-4: one face function, and only one', () => {
  it('BIRTH-4: no component draws its own eyes any more', () => {
    // The old copies were recognisable by the eye centres they hardcoded —
    // 33.5 and 46.5 — sitting in a component that is not GhostFace.jsx.
    const offenders = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) continue;
        if (entry === 'GhostFace.jsx') continue;   // the one that is allowed to
        const text = readFileSync(full, 'utf8');
        if (/cx="33\.5"[\s\S]{0,400}cx="46\.5"/.test(text)) offenders.push(full);
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  // The two vehicles left. Same face function, so the same heat has to produce
  // the same tier in both — a floor ghost and a chat ghost of the same agent
  // are the same character.
  it('BIRTH-4: both vehicles reach the tiered face', () => {
    for (const mood of MOODS) {
      for (const [heat, tier] of TIERS) {
        for (const Vehicle of [MoodGhost, FloorGhost]) {
          const { container, unmount } = render(<Vehicle mood={mood} heat={heat} size={56} />);
          const face = container.querySelector('[data-face]');
          expect(face, `${Vehicle.name} @ ${mood}/${heat}`).not.toBeNull();
          expect(face.getAttribute('data-face')).toBe(mood);
          expect(face.getAttribute('data-tier')).toBe(tier);
          unmount();
        }
      }
    }
  });
});

describe('BIRTH-4: heat comes from the served mood', () => {
  const served = (state, heat) => ({
    id: 'a1', name: 'The Solver', mood: { state, heat, cause: null, updatedAt: 1 },
  });

  it('BIRTH-4: one reader knows the shape, and its fallback is the canon middle', () => {
    expect(heatOf(served('tilted', 88))).toBe(88);
    expect(moodOf(served('tilted', 88))).toBe('tilted');
    // An older projection with a bare state and no heat still gets a face.
    expect(heatOf({ mood: { state: 'tilted' } })).toBe(45);
    expect(heatOf(null)).toBe(45);
    // Nothing outside 0-100 reaches the tier function.
    expect(heatOf(served('tilted', 400))).toBe(100);
    expect(heatOf(served('tilted', -20))).toBe(0);
  });

  // The CHATS thread header. It carried the mood's colour but drew the flat
  // face under it, so a boiling agent and a barely-warm one looked identical.
  it('BIRTH-4: the CHATS header draws the tier it is given', () => {
    const { container } = render(
      <MoodBand mood="tilted" heat={92} cause="ran into it again" state="live" />,
    );
    const face = container.querySelector('[data-face]');
    expect(face.getAttribute('data-face')).toBe('tilted');
    expect(face.getAttribute('data-tier')).toBe('high');
  });

  // The YOU screen's wallet rows — his face beside his pocket.
  it('BIRTH-4: the YOU rows draw the tier it is given', () => {
    const agent = {
      ...served('frustrated', 12),
      pocket: { balance: 400, staked: 0, pnl: -60, broke: false, mode: 'free' },
    };
    const { container } = render(<PocketRow agent={agent} />);
    const face = container.querySelector('[data-face]');
    expect(face.getAttribute('data-face')).toBe('frustrated');
    expect(face.getAttribute('data-tier')).toBe('low');
  });

  // The watch felt's opponents. The seat has carried `heat` off the wire since
  // SEAT-1a; it just never reached the face.
  it('BIRTH-4: a felt seat draws the tier the wire sent', () => {
    const { container } = render(
      <SeatGhost name="Doyle_v3" stack="980" mood="sulking" heat={90} size={34} />,
    );
    const face = container.querySelector('[data-face]');
    expect(face.getAttribute('data-face')).toBe('sulking');
    expect(face.getAttribute('data-tier')).toBe('high');
  });

  // The floor itself, end to end: a served record in, the right tier drawn on
  // the body standing in the room. This is the surface the bug was reported on.
  it('BIRTH-4: the floor draws the tier the roster served', async () => {
    telegram.signIn();
    fetchMock.route('/api/agents', {
      agents: [{
        id: 'a_hot', name: 'Hothead', style: 'Loose', risk: 'High',
        status: 'idle', presence: 'resting', activeTableId: null,
        mood: { state: 'tilted', heat: 94, cause: 'ran into it again', updatedAt: 1 },
        stats: { handsPlayed: 200, handsWon: 90 }, recentHands: [],
        attrLog: [], sessionLog: [], careerStats: { hands: 200, sessions: 3 },
      }],
    });

    const { container } = render(
      <CasinoFloor
        onCreateAgent={() => {}} onChat={() => {}} onWatch={() => {}}
        onProfile={() => {}} onDeploy={() => {}}
      />,
    );
    // A tilted agent goes to the lounge, and a lounge body wears no name chip
    // until it is selected — his aria-label is where his name is.
    await screen.findByRole('button', { name: /^Hothead — tilted$/ });

    const drawn = faces(container);
    expect(drawn.length).toBeGreaterThan(0);
    const his = drawn.find((f) => f.getAttribute('data-face') === 'tilted');
    expect(his, 'no tilted face on the floor').toBeTruthy();
    expect(his.getAttribute('data-tier')).toBe('high');
  });

  // Two agents in the same mood at different temperatures must not be the same
  // drawing — that is the whole reason heat exists.
  it('BIRTH-4: the same mood at two temperatures is two faces', () => {
    const cold = render(<FloorGhost mood="tilted" heat={5} size={56} />);
    const hot = render(<FloorGhost mood="tilted" heat={95} size={56} />);

    expect(faces(cold.container)[0].innerHTML)
      .not.toBe(faces(hot.container)[0].innerHTML);
  });
});
