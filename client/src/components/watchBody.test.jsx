// client/src/components/watchBody.test.jsx — WATCH-8, job 2.
//
// THE BODY ON THE FELT. Two things about an agent are true all session and
// neither was on the table: how much is left in him, and how hard he is
// running. They ride the bottom edge of whatever already names him — his
// strip, and every seat's name pill — as three dots each (LIFE-1-B), so they
// cost the felt nothing.
//
//   STAMINA  green → red    · from VOLUME   (fatigue)
//   HEAT     ember → red    · from OUTCOMES (mood.heat)
//
// "A confident agent can be worn; a tilted agent can be fresh. They never share
// a channel."

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { HEAT_EMBER, HEAT_FIRE, STAMINA_FULL } from './system/FeltBodyBars.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const watch6Css = () => readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');

const base = {
  mySeat: 0,
  config: spectatorConfig,
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  chatMessages: [],
  sendChat: () => {},
  onLeave: () => {},
  onSitOut: () => {},
};

// Seat 0 is the hero. The wire shape: `mood: { state, heat }` per SEAT-1a and
// `fatigue` per WATCH-8, both optional.
const withBody = (perSeat = {}) => ({
  ...midHandGame,
  seats: midHandGame.seats.map((s, i) => ({ ...s, ...(perSeat[i] || {}) })),
});

const draw = (game = withBody(), props = {}) =>
  render(<WatchScreen game={game} {...base} {...props} />);

const barsIn = (el) => el && el.querySelector('.felt-bars');
const dotsOf = (el, which) => el.querySelectorAll(`[data-bar="${which}"] .body-dots__dot`);
const litOf = (el, which) => [...dotsOf(el, which)].filter((d) => d.dataset.lit === 'true');

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', agentsResponse);
});

describe('WATCH-8: the body, on his strip', () => {
  it('carries both readings on the hero strip', () => {
    const { container } = draw(withBody({
      0: { fatigue: 'settled', mood: { state: 'frustrated', heat: 62 } },
    }));
    const strip = container.querySelector('.watch-hero__strip');
    const bars = barsIn(strip);
    expect(bars).toBeTruthy();
    expect(dotsOf(bars, 'stamina')).toHaveLength(3);
    expect(dotsOf(bars, 'heat')).toHaveLength(3);
    // HOME-2 job 2 / LIFE-1-B: settled lights two of three dots; heat 62 is
    // 'steaming' (src/shared/levels.js's cut is 60), all three.
    expect(litOf(bars, 'stamina')).toHaveLength(2);
    expect(litOf(bars, 'heat')).toHaveLength(3);
  });

  // Volume and outcomes are different causes, so they are different colours at
  // every point on both scales — an owner must never have to work out which of
  // the two a colour is for.
  // HOME-2 job 2 · the ref's two ramps. Stamina full is green; heat empty is an
  // EMBER rather than the teal it used to be — an accumulation at zero has
  // nothing to say, and teal there said "he is fine".
  it('runs stamina green-to-red and heat ember-to-red, never the other way round', () => {
    // jsdom normalises a hex fill to rgb(), so the assertion is on the channels.
    const rgb = (el) => (/rgb\((\d+), (\d+), (\d+)\)/.exec(el.style.background) || [])
      .slice(1).map(Number);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

    const fresh = draw(withBody({ 0: { fatigue: 'fresh', mood: { state: 'neutral', heat: 0 } } }));
    const strip = fresh.container.querySelector('.watch-hero__strip');
    expect(rgb(litOf(barsIn(strip), 'stamina').at(-1))).toEqual(hex(STAMINA_FULL));
    expect(rgb(litOf(barsIn(strip), 'heat').at(0))).toEqual(hex(HEAT_EMBER));

    const boiling = draw(withBody({ 0: { fatigue: 'fresh', mood: { state: 'tilted', heat: 100 } } }));
    const hot = boiling.container.querySelector('.watch-hero__strip');
    expect(rgb(litOf(barsIn(hot), 'heat').at(-1))).toEqual(hex(HEAT_FIRE));

    // The green end is not on the heat scale at any point, and the red end is
    // not on the stamina scale at any point.
    expect(rgb(litOf(barsIn(hot), 'stamina').at(-1))).not.toEqual(hex(HEAT_FIRE));
  });

  // The felt never resizes for a fact about a seat. Both readings are
  // absolute inside the surface that already names him.
  it('sits absolutely inside the surface that names him, and costs the column no height', () => {
    const css = watch6Css();
    const rule = css.slice(css.indexOf('.felt-bars {'), css.indexOf('.felt-bars__row'));
    expect(rule).toContain('position: absolute');
  });
});

describe('WATCH-8: the body, on every name pill', () => {
  it('carries the same two readings at seat scale', () => {
    const { container } = draw(withBody({
      1: { fatigue: 'worn', mood: { state: 'tilted', heat: 88 } },
    }));
    const seat = container.querySelectorAll('.watch-felt__seat')[0];
    const bars = seat.querySelector('.seat-ghost__chip .felt-bars');
    expect(bars).toBeTruthy();
    expect(bars.className).toContain('felt-bars--seat');
    // HOME-2 job 2 / LIFE-1-B: worn lights the one dot the ref's short red
    // stub described; heat 88 is steaming, all three.
    expect(litOf(bars, 'stamina')).toHaveLength(1);
    expect(litOf(bars, 'heat')).toHaveLength(3);
  });

  // A House regular has no agent behind him. Mood is always on the wire (a
  // resting neutral); fatigue is not, and lighting a full green dot row for
  // him would be the felt making something up.
  it('draws no stamina reading for a seat with no agent behind it', () => {
    const { container } = draw(withBody({ 1: { fatigue: null } }));
    const seat = container.querySelectorAll('.watch-felt__seat')[0];
    const bars = seat.querySelector('.felt-bars');
    expect(bars.querySelector('[data-bar="stamina"]')).toBeNull();
    expect(bars.querySelector('[data-bar="heat"]')).toBeTruthy();
  });

  // A server that has never heard of WATCH-8 renders exactly what it rendered
  // before it existed.
  it('survives a snapshot with no fatigue field at all', () => {
    const { container } = draw(midHandGame);
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    for (const seat of container.querySelectorAll('.watch-felt__seat')) {
      expect(seat.querySelector('[data-bar="stamina"]')).toBeNull();
      expect(seat.querySelector('[data-bar="heat"]')).toBeTruthy();
    }
  });
});

// FRIDGE-1 may land later. Until it does the field is simply absent.
describe('WATCH-8: the bottle', () => {
  it('stands beside what it cost him when the seat says he is drinking', () => {
    const { container } = draw(withBody({ 0: { drinking: true }, 1: { drinking: true } }));
    expect(container.querySelector('.watch-felt__hero-stack .bottle')).toBeTruthy();
    const seat = container.querySelectorAll('.watch-felt__seat')[0];
    const pill = seat.querySelector('.seat-ghost__chip');
    expect(pill.querySelector('.bottle')).toBeTruthy();
    // "Beside his stack, because that is what it cost." WATCH-10 job 1 moved an
    // opponent's stack out of the pill and onto his chips, so on the felt the
    // last thing in the pill is his NAME and the bottle stands after it. The
    // rule — the bottle is the pill's tail, never floating over the body — is
    // what is actually asserted, and it is unchanged.
    const name = pill.querySelector('.seat-ghost__name');
    expect(name.compareDocumentPosition(pill.querySelector('.bottle'))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent when the field is absent, false, or anything but true', () => {
    for (const drinking of [undefined, false, null, 1, 'yes']) {
      const { container, unmount } = draw(withBody({ 0: { drinking }, 1: { drinking } }));
      expect(container.querySelector('.bottle')).toBeNull();
      unmount();
    }
  });
});
