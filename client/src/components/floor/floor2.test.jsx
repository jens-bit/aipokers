// client/src/components/floor/floor2.test.jsx — FLOOR-2
//
// Wave 34's four rules, on top of the fish-tank law:
//   1 · one ghost per agent, always
//   2 · names are earned, not worn
//   3 · a live felt is the loudest object
//   4 · a resting room still breathes
//
// The BUG-16 / BUG-17 regressions live in CasinoFloor.test.jsx and stay there.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The dim/scrim rules are stylesheet rules, so the stylesheet has to be
// loaded for getComputedStyle to see them (vite.config.js has css: true).
import '../../styles/floor.css';

import { CasinoFloor } from './CasinoFloor.jsx';
import { grewCount, isBroke, narrowedCount, newsPipFor, presenceOf, splitFloor } from './agentView.js';
import {
  NOW, brokeAgent, grewAgent, liveRoom, playingAgent, quietAgent,
  restingRoom, wornAgent,
} from '../../test/fixtures/floor2.js';
import { fetchMock, telegram } from '../../test/harness.js';

function renderFloor(props = {}) {
  return render(
    <CasinoFloor
      onCreateAgent={() => {}}
      onChat={() => {}}
      onWatch={() => {}}
      onProfile={() => {}}
      onDeploy={() => {}}
      {...props}
    />,
  );
}

const ghost = (name) => screen.getByRole('button', { name: new RegExp(`^${name} — `) });
const ghosts = () => screen.getAllByRole('button', { name: /^.+ — (confident|neutral|frustrated|tilted|sulking)$/ });
const pips = (scope = document) => [...scope.querySelectorAll('.floor-pip')];

// ── the field readers ───────────────────────────────────────────────────────

describe('FL-1 — the fields the floor reads', () => {
  it('presenceOf knows the fourth presence WALLET-1 added', () => {
    expect(presenceOf(brokeAgent)).toBe('broke');
    expect(presenceOf(playingAgent)).toBe('playing');
    expect(presenceOf(quietAgent)).toBe('resting');
  });

  it('isBroke reads the presence, and falls back to pocket.broke', () => {
    expect(isBroke(brokeAgent)).toBe(true);
    expect(isBroke(quietAgent)).toBe(false);
    // A projection that predates the presence value still answers.
    expect(isBroke({ presence: 'resting', pocket: { broke: true } })).toBe(true);
  });

  it('grewCount counts the upward ticks of the newest run, not the whole log', () => {
    // Two of his three ticks share the newest ts; the third is 40h old.
    expect(grewCount(grewAgent, NOW)).toBe(2);
  });

  it('grewCount ignores a run that has gone stale', () => {
    expect(grewCount(grewAgent, NOW + 48 * 60 * 60 * 1000)).toBe(0);
  });

  it('grewCount ignores a narrowing, which moves nothing', () => {
    // from === to on purpose, so a sparkline never renders a phantom step.
    expect(grewCount(wornAgent, NOW)).toBe(0);
    expect(narrowedCount(wornAgent)).toBe(2);
  });

  it('an agent with no log and no bands has nothing to report', () => {
    expect(grewCount(quietAgent, NOW)).toBe(0);
    expect(narrowedCount(quietAgent)).toBe(0);
    expect(newsPipFor(quietAgent, NOW)).toBeNull();
  });

  it('the pip order is the order of consequence', () => {
    expect(newsPipFor(brokeAgent, NOW)).toBe('broke');
    expect(newsPipFor(grewAgent, NOW)).toBe('grew');
    expect(newsPipFor(wornAgent, NOW)).toBe('worn');
    // Money he does not have beats an attribute that moved.
    expect(newsPipFor({ ...grewAgent, presence: 'broke' }, NOW)).toBe('broke');
  });

  it('the one who cannot play sits apart from the bar', () => {
    const { playing, resting, lounge } = splitFloor(restingRoom.agents);
    expect(playing).toEqual([]);
    expect(lounge.map((a) => a.id)).toContain('a_broke');
    expect(resting.map((a) => a.id)).not.toContain('a_broke');
  });
});

// ── rule 1 ──────────────────────────────────────────────────────────────────

describe('FL-1 — one ghost per agent, always', () => {
  beforeEach(() => { telegram.signIn(); });

  it('draws exactly one body per agent in the roster', async () => {
    fetchMock.route('/api/agents', restingRoom);
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    const names = ghosts().map((el) => el.getAttribute('aria-label').split(' — ')[0]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws one body even when the same agent arrives twice in a payload', async () => {
    fetchMock.route('/api/agents', { agents: [grewAgent, grewAgent, quietAgent] });
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: /^Bluff Master — / })).toHaveLength(1);
  });

  it('never draws a seated agent at the bar as well', async () => {
    fetchMock.route('/api/agents', liveRoom);
    const { container } = renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    const seated = ghost('Balanced v2.1');
    expect(seated).not.toHaveClass('floor-bar-ghost');
    expect(container.querySelectorAll('.floor-bar-ghost')).toHaveLength(3);
  });
});

// ── rule 2 ──────────────────────────────────────────────────────────────────

describe('FL-1 — names are earned, not worn', () => {
  beforeEach(() => { telegram.signIn(); });

  it('a body at the bar wears no name chip', async () => {
    fetchMock.route('/api/agents', restingRoom);
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    for (const name of ['Bluff Master', 'Aggressive v1.3', 'Steady Eddie', 'Value Bot']) {
      expect(within(ghost(name)).queryByText(name)).toBeNull();
    }
  });

  it('a seated body does wear one — the felt is what earns it', async () => {
    fetchMock.route('/api/agents', liveRoom);
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(within(ghost('Balanced v2.1')).getByText('Balanced v2.1')).toBeInTheDocument();
  });

  // Posture is the identity for the eye. A screen reader still needs to know
  // whose body it is about to tap, so the accessible name never goes away.
  it('keeps an accessible name on every body, chip or no chip', async () => {
    fetchMock.route('/api/agents', restingRoom);
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    for (const el of ghosts()) {
      expect(el.getAttribute('aria-label')).toMatch(/^.+ — (confident|neutral|frustrated|tilted|sulking)$/);
    }
  });

  it('the selected body earns its chip back', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents', restingRoom);
    renderFloor({ desktopMode: true, selectedAgentId: undefined });

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    await user.click(ghost('Steady Eddie'));

    expect(within(ghost('Steady Eddie')).getByText('Steady Eddie')).toBeInTheDocument();
    // And nobody else's.
    expect(within(ghost('Bluff Master')).queryByText('Bluff Master')).toBeNull();
  });
});

// ── the pips ────────────────────────────────────────────────────────────────

describe('FL-1 — one pip, and only when he has news', () => {
  beforeEach(() => {
    telegram.signIn();
    vi.setSystemTime(NOW);
    fetchMock.route('/api/agents', restingRoom);
  });

  it('counts the attributes that moved', async () => {
    renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(within(ghost('Bluff Master')).getByText('+2 GREW')).toBeInTheDocument();
  });

  it('marks the one whose bands settled', async () => {
    renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(within(ghost('Aggressive v1.3')).getByText('WORN')).toBeInTheDocument();
  });

  it('states the empty pocket as a fact, without accusing anyone', async () => {
    renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));

    const pip = within(ghost('Value Bot')).getByText('POCKET $0');
    expect(pip).toBeInTheDocument();
    // Muted, never red: there is no guilt in this design. (#6B6B6B, and the
    // alarm red #FF4D4F is rgb(255, 77, 79).)
    const { color } = window.getComputedStyle(pip);
    expect(color).toBe('rgb(107, 107, 107)');
    expect(color).not.toBe('rgb(255, 77, 79)');
  });

  it('gives the agent with nothing to report no pip at all', async () => {
    renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(pips(ghost('Steady Eddie'))).toHaveLength(0);
  });

  it('never gives one body two pips', async () => {
    renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    for (const el of ghosts()) expect(pips(el).length).toBeLessThanOrEqual(1);
  });
});

// ── rule 4 ──────────────────────────────────────────────────────────────────

describe('FL-2 — a resting room still breathes', () => {
  beforeEach(() => {
    telegram.signIn();
    vi.setSystemTime(NOW);
  });

  it('never says "Everyone\'s resting" — the line wave 34 retired', async () => {
    fetchMock.route('/api/agents', restingRoom);
    renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(screen.queryByText(/Everyone's resting/)).toBeNull();
  });

  it('says who is at the bar and what happened to one of them', async () => {
    fetchMock.route('/api/agents', restingRoom);
    renderFloor();

    // Four resting, and the money is the thing the owner can act on.
    expect(await screen.findByText('Four resting · Value Bot is out of money')).toBeInTheDocument();
  });

  it('names growth when nobody is broke', async () => {
    fetchMock.route('/api/agents', { agents: [grewAgent, quietAgent] });
    renderFloor();
    expect(await screen.findByText('Two resting · Bluff Master grew tonight')).toBeInTheDocument();
  });

  it('is quiet, not dead, when there is genuinely no news', async () => {
    fetchMock.route('/api/agents', { agents: [quietAgent] });
    renderFloor();
    expect(await screen.findByText('One resting · the room is quiet')).toBeInTheDocument();
  });

  it('leaves the room unscrimmed and at its own brightness', async () => {
    fetchMock.route('/api/agents', restingRoom);
    const { container } = renderFloor();

    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(container.querySelector('.floor')).not.toHaveClass('is-room-live');
    expect(container.querySelector('.floor__scrim')).toBeNull();
    expect(container.querySelector('.floor-live-rim')).toBeNull();
  });
});

// ── rule 3 ──────────────────────────────────────────────────────────────────

describe('FL-2 — a live felt is the loudest object', () => {
  beforeEach(() => {
    telegram.signIn();
    vi.setSystemTime(NOW);
    fetchMock.route('/api/agents', liveRoom);
  });

  it('drops the room under a scrim and lights one felt', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));

    expect(container.querySelector('.floor')).toHaveClass('is-room-live');
    expect(container.querySelector('.floor__scrim')).toBeTruthy();
    expect(container.querySelector('.floor-live-glow')).toBeTruthy();
    expect(container.querySelector('.floor-live-rim')).toBeTruthy();
  });

  it('lights exactly one felt — one place to look', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(container.querySelectorAll('.floor-live-rim')).toHaveLength(1);
  });

  it('the scrim and the rim are decoration and never take the pointer', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));

    for (const cls of ['.floor__scrim', '.floor-live-glow', '.floor-live-rim']) {
      const el = container.querySelector(cls);
      expect(window.getComputedStyle(el).pointerEvents).toBe('none');
      expect(el).toHaveAttribute('aria-hidden');
    }
  });

  it('everything not in the hand drops to 42%, and the seated body does not', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));

    const opacityOf = (el) => window.getComputedStyle(el).opacity;
    expect(opacityOf(container.querySelector('.floor__room-wrap'))).toBe('0.42');
    for (const bar of container.querySelectorAll('.floor-bar-ghost')) {
      expect(opacityOf(bar)).toBe('0.42');
    }
    expect(opacityOf(ghost('Balanced v2.1'))).not.toBe('0.42');
  });

  it('the bar still reads: a dimmed body keeps its pip', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(ghosts()).toHaveLength(4));
    expect(within(ghost('Value Bot')).getByText('POCKET $0')).toBeInTheDocument();
    expect(container.querySelectorAll('.floor-pip').length).toBeGreaterThan(0);
  });
});
