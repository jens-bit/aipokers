// client/src/components/ftu/ftu.test.jsx — FTU-1
//
// THE FIRST FIVE MINUTES. The rule every case here defends: an empty state is a
// room that breathes, not a placeholder sentence. No "No agents yet", no "No
// hands to show", no illustrated void with a caption — and exactly one primary
// action per screen, naming the next thing that happens.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotYet } from './NotYet.jsx';
import { CasinoFloor } from '../floor/CasinoFloor.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

// The words the grammar forbids. A screen may say what has not happened; it may
// not say that something is missing.
export const BANNED = [
  'no agents yet', 'no hands to show', 'no hands yet', 'nothing here',
  'nothing to show', 'empty', 'coming soon', 'no data',
];

export function assertNoPlaceholders(container) {
  const text = (container.textContent ?? '').toLowerCase();
  for (const phrase of BANNED) {
    expect(text, `placeholder copy on screen: "${phrase}"`).not.toContain(phrase);
  }
}

describe('FTU-1 the NotYet grammar', () => {
  it('FTU-1: says what has not happened, who says so, and what would fill it', () => {
    const { container } = render(
      <NotYet
        fact="NO AGENTS"
        voice="Every felt in here is somebody's employee. You do not have one yet."
        fills="Hire one and he takes the stool."
      />,
    );

    expect(screen.getByText('NO AGENTS')).toBeInTheDocument();
    expect(screen.getByText(/somebody's employee/)).toBeInTheDocument();
    expect(screen.getByText(/takes the stool/)).toBeInTheDocument();
    // In that order, always.
    const parts = [...container.querySelectorAll('.not-yet__fact, .not-yet__voice, .not-yet__fills')];
    expect(parts.map((el) => el.className)).toEqual(['not-yet__fact', 'not-yet__voice', 'not-yet__fills']);
  });

  it('FTU-1: never says the word the grammar bans', () => {
    const { container } = render(<NotYet fact="NO AGENTS" voice="You do not have one yet." fills="Hire one." />);
    assertNoPlaceholders(container);
  });

  it('FTU-1: voice and fills are both optional, the fact is not', () => {
    const { container } = render(<NotYet fact="ONE SESSION OF HISTORY" />);
    expect(screen.getByText('ONE SESSION OF HISTORY')).toBeInTheDocument();
    expect(container.querySelector('.not-yet__voice')).toBeNull();
    expect(container.querySelector('.not-yet__fills')).toBeNull();
  });

  it('FTU-1: has no icon and no illustration', () => {
    const { container } = render(<NotYet fact="X" voice="y" fills="z" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('FTU-1 the empty floor', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
  });

  it('FTU-1: the room is open, and says so rather than apologising', async () => {
    const { container } = render(<CasinoFloor onCreateAgent={() => {}} />);
    expect(await screen.findByText('The room is open.')).toBeInTheDocument();
    assertNoPlaceholders(container);
  });

  it('FTU-1: what is missing is one body, and the room shows the seat', async () => {
    const { container } = render(<CasinoFloor onCreateAgent={() => {}} />);
    await screen.findByText('The room is open.');

    expect(screen.getByText('ONE OPEN SEAT')).toBeInTheDocument();
    // Dashed, which is this product's word for reserved rather than broken —
    // and the stool is decoration, not the control.
    const stool = container.querySelector('.floor-ftu');
    expect(stool.tagName).toBe('DIV');
    expect(stool.getAttribute('aria-hidden')).toBe('true');
  });

  it('FTU-1: the NotYet names the fact, the voice and the fill', async () => {
    const { container } = render(<CasinoFloor onCreateAgent={() => {}} />);
    await screen.findByText('The room is open.');

    const notYet = container.querySelector('.not-yet');
    expect(within(notYet).getByText('NO AGENTS')).toBeInTheDocument();
    expect(within(notYet).getByText(/somebody's employee/)).toBeInTheDocument();
    expect(within(notYet).getByText(/takes the stool/)).toBeInTheDocument();
  });

  it('FTU-1: exactly one primary action, and it names the next thing', async () => {
    const user = userEvent.setup();
    const onCreateAgent = vi.fn();
    const { container } = render(<CasinoFloor onCreateAgent={onCreateAgent} />);
    await screen.findByText('The room is open.');

    const primaries = container.querySelectorAll('.ftu-primary');
    expect(primaries).toHaveLength(1);
    expect(primaries[0].textContent).toBe('Draft your first agent');

    await user.click(primaries[0]);
    expect(onCreateAgent).toHaveBeenCalledTimes(1);
  });

  it('FTU-1: and none of it is there once he has an agent', async () => {
    fetchMock.reset();
    fetchMock.route('/api/agents', {
      agents: [{ id: 'a1', name: 'Rock v1.0', status: 'resting', mood: { state: 'neutral' } }],
    });
    const { container } = render(<CasinoFloor onCreateAgent={() => {}} />);
    // One resting agent: the standup counts him rather than opening the room.
    await screen.findByText(/One resting/);

    expect(container.querySelector('.floor-ftu')).toBeNull();
    expect(container.querySelector('.floor-ftu__dock')).toBeNull();
    expect(container.querySelector('.ftu-primary')).toBeNull();
  });
});
