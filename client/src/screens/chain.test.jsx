// client/src/screens/chain.test.jsx — F-4
//
// The rule wave 34 adds: every screen in draft -> birth -> floor -> watch has
// exactly ONE primary action, and it names the next screen.
//
// This file owns the two links that live in BirthScreen: the draft's action,
// and the birth card's. Links three and four — the floor's "Watch him" and the
// watch screen's "Chat" — live in App.jsx and components/floor/, which are
// outside this slice's file scope.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const BORN = {
  id: 'a_new', name: 'Hothead v1.0', strategy: 'Wide opens.',
  status: 'idle', presence: 'resting', activeTableId: null,
  firstWords: 'Good. I will bluff too much and enjoy it.',
  nature: { name: 'Hothead', up: 'DECEPTION', down: 'COMPOSURE', builtFor: 'Making people fold.' },
  attrs: { READS: 33, FOCUS: 38, DISCIPLINE: 31, COMPOSURE: 24, DECEPTION: 47, STAMINA: 36 },
  attrLog: [],
  careerStats: { hands: 0, sessions: 0, net: null, biggestPot: 0, winRate: null },
};

const READY_TURN = {
  chat: [
    { role: 'user', content: 'Aggressive bluffer' },
    { role: 'assistant', content: 'Understood.' },
  ],
  ready: true,
  profile: { tightness: 34, aggression: 82, bluffFreq: 78, discipline: 41 },
  natureHint: 'Hothead',
};

const BUILT_TURN = { ...READY_TURN, agentId: BORN.id, agentName: BORN.name, strategy: BORN.strategy };

// Every control that reads as the screen's primary action.
function primaryActions() {
  return [
    ...document.querySelectorAll('.next-action__btn, .birth-card3__deal'),
  ].map((el) => el.textContent.trim());
}

describe('F-4: one primary action per screen, naming the next one', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [BORN] });
  });

  it('the draft screen offers exactly one, and it names the birth card', async () => {
    fetchMock.route('/api/agents/chat', READY_TURN, { method: 'POST' });
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

    await waitFor(() => expect(primaryActions()).toEqual(['Deal him in']));
  });

  it('never dresses the exit as the primary action', async () => {
    fetchMock.route('/api/agents/chat', READY_TURN, { method: 'POST' });
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

    // The band's control runs onBack. It said "Deal me in" while the card below
    // said "Deal him in", and the two did opposite things.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /deal me in/i })).toBeNull();
  });

  it('the exit still exits', async () => {
    const onBack = vi.fn();
    fetchMock.route('/api/agents/chat', READY_TURN, { method: 'POST' });
    render(<BirthScreen onBack={onBack} onBirth={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

    await userEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('the birth card offers exactly one, and it hands him to the floor', async () => {
    fetchMock.route('/api/agents/chat', BUILT_TURN, { method: 'POST' });
    const onBirth = vi.fn();
    render(<BirthScreen onBack={() => {}} onBirth={onBirth} />);
    await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

    await waitFor(() => expect(screen.getAllByText(BORN.name).length).toBeGreaterThan(0));
    vi.advanceTimersByTime(2500);

    await waitFor(() => expect(primaryActions()).toEqual(['Deal him in']));
    await userEvent.click(screen.getByRole('button', { name: /deal him in/i }));

    // The floor is the next screen; App routes there on this callback and shows
    // him walking in (FLOOR-2 owns the walk-in itself).
    expect(onBirth).toHaveBeenCalledTimes(1);
    expect(onBirth).toHaveBeenCalledWith(expect.objectContaining({ id: BORN.id, name: BORN.name }));
  });

  it('the same verb both times — it is the same intent, confirmed against a name', async () => {
    // Two turns, because they are two turns in life: the first ends with a
    // usable brief, the second builds him.
    fetchMock.route('/api/agents/chat', READY_TURN, { method: 'POST' });
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

    // Draft screen.
    await waitFor(() => expect(primaryActions()).toEqual(['Deal him in']));

    fetchMock.route('/api/agents/chat', BUILT_TURN, { method: 'POST' });
    await userEvent.click(screen.getByRole('button', { name: /deal him in/i }));
    await waitFor(() => expect(screen.getAllByText(BORN.name).length).toBeGreaterThan(0));
    vi.advanceTimersByTime(2500);

    // Birth card. Same verb, still exactly one.
    await waitFor(() => expect(document.querySelector('.birth-card3__deal')).not.toBeNull());
    expect(primaryActions()).toEqual(['Deal him in']);
  });
});
