// client/src/screens/AgentProfileScreen.split.test.jsx — PROFILE-2
//
// The card splits in two. What is asserted here is the split itself, and the
// invariant underneath it: the six attributes the engine tracks all still have
// a home. Four are skills, one is body, and the sixth — COMPOSURE — is the
// stat whose live reading is heat, so it rides on the heat bar.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const AGENT = {
  id: 'a1',
  name: 'Aggressive v1.3',
  status: 'idle',
  presence: 'resting',
  activeTableId: null,
  stats: { handsPlayed: 2041, netWon: 1204 },
  mood: { state: 'tilted', heat: 82, cause: 'two rivers called back' },
  sessionLog: [],
  careerStats: { hands: 2041, sessions: 12, net: 1204, biggestPot: 3460, winRate: 54.2 },
  attrs: { READS: 82, FOCUS: 62, DISCIPLINE: 69, COMPOSURE: 44, DECEPTION: 74, STAMINA: 63 },
  potential: {
    READS: { lo: 80, hi: 84 }, FOCUS: { lo: 70, hi: 75 },
    DISCIPLINE: { lo: 72, hi: 77 }, COMPOSURE: { lo: 46, hi: 52 },
    DECEPTION: { lo: 74, hi: 78 }, STAMINA: { lo: 64, hi: 70 },
  },
  nature: { name: 'Shark', up: 'READS', down: 'COMPOSURE' },
};

const noop = () => {};

function renderProfile(agent = AGENT) {
  return render(
    <AgentProfileScreen
      agent={agent}
      onBack={noop} onOpenChat={noop} onWatch={noop}
      onFund={noop} onDeploy={noop} onCallIn={noop} onRetired={noop}
    />,
  );
}

const body = () => document.querySelector('.profile-body');
const skills = () => document.querySelector('.profile-skills');

describe('PROFILE-2 — body and skills', () => {
  beforeEach(() => { telegram.signIn(); });

  it('puts the face, the name and the nature in the header', () => {
    renderProfile();
    const head = within(body());
    expect(head.getByText('Aggressive v1.3')).toBeInTheDocument();
    expect(head.getByText('Shark')).toBeInTheDocument();
  });

  it('puts the two state bars in the header, with his face', () => {
    renderProfile();
    const head = within(body());
    expect(head.getByText('STAMINA')).toBeInTheDocument();
    expect(head.getByText('HEAT')).toBeInTheDocument();
  });

  it('leaves the four he trains below, under Skills', () => {
    renderProfile();
    const list = within(skills());
    expect(list.getByText('READS')).toBeInTheDocument();
    expect(list.getByText('FOCUS')).toBeInTheDocument();
    expect(list.getByText('DISCIPLINE')).toBeInTheDocument();
    expect(list.getByText('DECEPTION')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  // The point of the split: the skills list no longer has two things in it
  // that are not skills.
  it('keeps STAMINA and HEAT out of the skills list', () => {
    renderProfile();
    const list = within(skills());
    expect(list.queryByText('STAMINA')).toBeNull();
    expect(list.queryByText('HEAT')).toBeNull();
  });

  // Nothing the engine tracks may fall off the card. COMPOSURE is tilt
  // resistance — the stat behind heat — so it is drawn on the heat bar.
  it('keeps COMPOSURE on the card, on the bar it explains', () => {
    renderProfile();
    expect(within(body()).getByText('composure 44')).toBeInTheDocument();
    expect(within(skills()).queryByText('COMPOSURE')).toBeNull();
  });

  it('reads the heat off the mood the band above it is showing', () => {
    renderProfile();
    const head = within(body());
    expect(head.getByText('82')).toBeInTheDocument();
    expect(head.getByText('boiling')).toBeInTheDocument();
  });

  it('opens a skill in place, the way it always did', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(skills()).getByRole('button', { name: 'READS 82' }));
    expect(document.querySelector('.attr-focus')).toBeTruthy();
  });

  it('opens STAMINA from the header too — it is trained, so it has a history', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(body()).getByRole('button', { name: 'STAMINA 63' }));
    expect(within(body()).getByText('90D')).toBeInTheDocument();
  });

  // CHAT-2's row is untouched by the split: it is above the scroll and it is
  // still the three things an owner does to him.
  it('keeps the CHAT-2 action row exactly as it was', async () => {
    const user = userEvent.setup();
    renderProfile();
    const row = within(document.querySelector('.profile-actions'));
    expect(row.getByRole('button', { name: 'Deploy' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();

    await user.click(row.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Retire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute notifications' })).toBeInTheDocument();
  });

  it('offers Call him in instead of Deploy while he is at a table', () => {
    renderProfile({ ...AGENT, presence: 'playing', status: 'playing', activeTableId: 'tbl-1' });
    const row = within(document.querySelector('.profile-actions'));
    expect(row.getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Deploy' })).toBeNull();
  });

  it('draws the split for an agent the engine has not scouted yet', () => {
    renderProfile({ ...AGENT, attrs: undefined, potential: undefined, mood: null });
    expect(within(body()).getByText('STAMINA')).toBeInTheDocument();
    expect(within(body()).getByText('HEAT')).toBeInTheDocument();
    expect(within(skills()).getByText('READS')).toBeInTheDocument();
  });
});
