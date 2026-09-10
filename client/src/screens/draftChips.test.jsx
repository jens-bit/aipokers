// client/src/screens/draftChips.test.jsx — BUG-198
//
// The guest draft's chips, on the screen.
//
// The server half is asserted in src/server/draftScript*.test.js. This file
// asserts the half the server cannot see: that the words it sends actually
// reach a button, at EVERY stage rather than only before the first answer, and
// that the fourth stage arrives with a name already in the field.
//
// One BirthScreen serves both shells — the phone puts it over the room, the
// desk puts the same component in the rail — so every assertion here holds in
// both. The widths are proved in client/e2e/guest-draft-chips.spec.js, which
// is the only thing that can lay them out.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const CHIPS = {
  style: ['Tight', 'Balanced', 'Loose'],
  bluffing: ['Rarely', 'Sometimes', 'Often'],
  unsure: ['Fold', 'Call it down', 'Push'],
};

const stage = (key, over = {}) => ({
  draftId: 'draft-guest',
  draftScripted: true,
  draftStep: 'briefing',
  ready: false,
  draftName: null,
  draftStage: key,
  draftChips: CHIPS[key] ?? [],
  suggestedName: 'Loose Cannon',
  chat: [{ role: 'assistant', content: 'Tell me how he should play.' }],
  ...over,
});

const naming = stage('name', {
  draftStep: 'naming',
  ready: true,
  natureHint: 'Hothead',
  draftChips: [],
  chat: [
    { role: 'assistant', content: 'Tell me how he should play.' },
    { role: 'user', content: 'Loose' },
    { role: 'assistant', content: 'Loose. Got it. And how often should he bluff?' },
  ],
});

const begin = (body) => fetchMock.route('/api/agents/draft', body, { method: 'POST' });
const chat = (body) => fetchMock.route('/api/agents/chat', body, { method: 'POST' });
const chips = () => within(screen.getByTestId('draft-chips')).getAllByRole('button').map((b) => b.textContent);

const open = async (body = stage('style')) => {
  begin(body);
  const ui = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
  await waitFor(() => expect(screen.getByTestId('draft-chips')).toBeInTheDocument());
  return ui;
};

beforeEach(() => { telegram.signIn(); sessionStorage.clear(); });
afterEach(() => sessionStorage.clear());

describe('BUG-198 — the chips the recruiter actually understands', () => {
  it('offers the style chips before anything has been said', async () => {
    await open();
    expect(chips()).toEqual(['Tight', 'Balanced', 'Loose']);
  });

  it.each([
    ['bluffing', ['Rarely', 'Sometimes', 'Often']],
    ['unsure', ['Fold', 'Call it down', 'Push']],
  ])('keeps offering chips at the %s stage, not only before the first answer', async (key, want) => {
    const user = userEvent.setup();
    await open();
    chat(stage(key));
    await user.click(screen.getByRole('button', { name: 'Loose' }));

    await waitFor(() => expect(chips()).toEqual(want));
  });

  it('sends the chip as the answer, in its own words', async () => {
    const user = userEvent.setup();
    await open();
    chat(stage('bluffing'));
    await user.click(screen.getByRole('button', { name: 'Loose' }));

    await waitFor(() => {
      const sent = fetchMock.requestsMatching('/api/agents/chat').at(-1).body;
      expect(sent.content).toBe('Loose');
    });
  });

  it('a tap advances immediately — no typing, no Send', async () => {
    const user = userEvent.setup();
    await open();
    chat(stage('bluffing'));
    await user.click(screen.getByRole('button', { name: 'Balanced' }));

    // The recruiter has moved on to the next question rather than repeating.
    await waitFor(() => expect(chips()).toEqual(['Rarely', 'Sometimes', 'Often']));
    expect(screen.queryByText(/loose or selective/i)).toBeNull();
  });
});

describe('BUG-198 — the fourth stage is a name, already filled in', () => {
  it('pre-fills the field with the coined name and offers one button', async () => {
    await open(naming);

    const row = await screen.findByTestId('draft-name-row');
    await waitFor(() => expect(within(row).getByTestId('draft-input')).toHaveValue('Loose Cannon'));
    expect(within(row).getByRole('button', { name: 'Deal him in', exact: true })).toBeEnabled();
    // The name stage trades chips for a field; offering both would be two
    // answers to one question.
    expect(screen.queryByTestId('draft-chips')).toBeNull();
  });

  it('Deal him in names him and builds him in one gesture', async () => {
    const user = userEvent.setup();
    await open(naming);
    const row = await screen.findByTestId('draft-name-row');
    await waitFor(() => expect(within(row).getByTestId('draft-input')).toHaveValue('Loose Cannon'));

    chat({ ...naming, draftStep: 'ready', draftName: 'Loose Cannon' });
    await user.click(within(row).getByRole('button', { name: 'Deal him in', exact: true }));

    await waitFor(() => {
      const sent = fetchMock.requestsMatching('/api/agents/chat').map((r) => r.body);
      // The name, then the build — two requests, one tap. Four taps total is
      // the requirement, and a second button here is what made it five.
      expect(sent.at(-2)).toMatchObject({ draftIntent: 'name', content: 'Loose Cannon' });
      expect(sent.at(-1)).toMatchObject({ draftIntent: 'create' });
    });
  });

  it('a name typed over the suggestion is the one that is sent', async () => {
    const user = userEvent.setup();
    await open(naming);
    const row = await screen.findByTestId('draft-name-row');
    const field = within(row).getByTestId('draft-input');
    await waitFor(() => expect(field).toHaveValue('Loose Cannon'));

    await user.clear(field);
    await user.type(field, 'Granite');
    chat({ ...naming, draftStep: 'ready', draftName: 'Granite' });
    await user.click(within(row).getByRole('button', { name: 'Deal him in', exact: true }));

    await waitFor(() => {
      const sent = fetchMock.requestsMatching('/api/agents/chat').map((r) => r.body);
      expect(sent.at(-2)).toMatchObject({ draftIntent: 'name', content: 'Granite' });
    });
  });
});

describe('BUG-198 — an older server changes nothing', () => {
  it('falls back to the openers this screen has always shown', async () => {
    // No draftChips on the wire at all: a rolling deploy, or the signed-in
    // draft before its first answer. The screen must not go blank.
    await open({
      draftId: 'draft-old', draftStep: 'briefing', ready: false, draftName: null,
      chat: [{ role: 'assistant', content: 'Tell me how he should play.' }],
    });
    expect(chips()).toEqual(['Tight and patient', 'Aggressive bluffer', 'Solver-strict']);
  });
});
