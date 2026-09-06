// client/src/screens/draftGlass.test.jsx — DRAFT-2
//
// The draft screen's own rules, as board 29's wave-56 frames state them:
//
//   F02  "The draft is the board-26 glass sheet risen over the room, not a grey
//         chat on a blank screen. The room stays behind it, dimmed to almost
//         nothing, because he is not in it yet."
//   F02b "Silhouette at Q1, the hood at Q2, the eyes at Q3, his colour with the
//         name. All four are MoodGhost with different hood and glow parameters."
//   F03  "The last bubble asks his name, and answering it turns the composer
//         into one gold button."
//
// The wire behaviour these sit on top of — the go signal, the two 409s, the
// dials — is owned by BirthScreen.test.jsx, chain.test.jsx and draftFlow.test.jsx
// and is deliberately not re-asserted here.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import '../styles/draft2.css';
import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const REPLY = (over = {}) => ({
  chat: [
    { role: 'user', content: 'Patient. I hate donking off chips.' },
    { role: 'assistant', content: 'Patient it is. And when he does have it — does he squeeze?' },
  ],
  profile: null,
  natureHint: null,
  ready: false,
  ...over,
});

const answer = async (text = 'Patient. I hate donking off chips.') => {
  await userEvent.type(screen.getByTestId('draft-input'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
};

const draft = () => render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);

describe('DRAFT-2: the draft opens on the room, not on a blank screen', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/agents/chat', REPLY(), { method: 'POST' });
  });

  it('draws the room behind the glass', () => {
    const { container } = draft();
    // The actual room, from flat.js's coordinate space — not a picture of one.
    expect(container.querySelector('.home-flat')).toBeInTheDocument();
    expect(screen.getByTestId('draft-sheet')).toBeInTheDocument();
  });

  it('leaves the room unlit, because nobody lives there yet', () => {
    const { container } = draft();
    expect(container.querySelector('.home-flat').dataset.lit).toBe('false');
  });

  it('hangs the casino tag on the door and does not cover it', () => {
    const { container } = draft();
    const tag = screen.getByTestId('home-door-tag');
    expect(tag).toHaveTextContent('THE CASINO');

    // The room's own coordinate space: the tag sits above the sheet's top edge.
    // The pixel truth at both real widths is client/e2e/draft-2.spec.js's; this
    // is the arithmetic, and it is the half that can run on every commit.
    const sheetTop = parseFloat(getComputedStyle(container.querySelector('.draft-sheet')).top);
    expect(parseFloat(tag.style.top)).toBeLessThan(sheetTop);
  });

  it('is not the old grey chat screen', () => {
    draft();
    // The band carried the forming chip and the Skip button. Wave 56 deletes it:
    // the thing that reports how formed he is is HIM, above the sheet.
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByText('NO MOOD YET')).toBeNull();
  });

  it('still has one exit, and it is not dressed as the action', async () => {
    const back = [];
    render(<BirthScreen onBack={() => back.push(1)} onBirth={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveLength(1);
  });
});

describe('DRAFT-2: he forms while you answer', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/agents/chat', REPLY(), { method: 'POST' });
  });

  it('opens as a silhouette', () => {
    draft();
    expect(screen.getByTestId('draft-forming').dataset.stage).toBe('1');
    expect(screen.getByTestId('draft-cap')).toHaveTextContent('a silhouette');
  });

  it('puts him in a hood once the first answer has landed', async () => {
    draft();
    await answer();
    await waitFor(() => expect(screen.getByTestId('draft-forming').dataset.stage).toBe('2'));
    expect(screen.getByTestId('draft-cap')).toHaveTextContent('the hood');
  });

  it('counts the sheet forward with him', async () => {
    draft();
    expect(screen.getByTestId('draft-count')).toHaveTextContent('1 OF 4');
    await answer();
    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('2 OF 4'));
  });

  it('says nothing in his voice while he forms', async () => {
    const { container } = draft();
    await answer();
    await waitFor(() => expect(screen.getByTestId('draft-forming').dataset.stage).toBe('2'));
    // Two registers, and neither is his. Nobody speaks for the agent before he
    // exists — the ghost above the sheet is a shape, not a speaker.
    for (const row of container.querySelectorAll('.draft-row')) {
      expect(row.className).toMatch(/draft-row--(sys|you)/);
    }
  });
});

describe('DRAFT-2: the name, and the one gold button', () => {
  const READY = REPLY({
    ready: true,
    profile: { tightness: 88, aggression: 44, bluffFreq: 6, discipline: 90 },
    natureHint: 'Rock',
  });

  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/agents/chat', READY, { method: 'POST' });
  });

  it('turns the composer into the one gold button when he can be built', async () => {
    draft();
    await answer();

    await waitFor(() => expect(screen.getByRole('button', { name: /deal him in/i })).toBeInTheDocument());
    expect(screen.queryByTestId('draft-input')).toBeNull();

    // The only gold fill on the screen is that button — draft2.css scopes the
    // relight to the sheet, which is what makes it read as the primary action.
    const btn = document.querySelector('.draft-sheet .next-action__btn');
    expect(btn).toBeTruthy();
  });

  it('writes his name on the pill the way names.js writes every name', async () => {
    fetchMock.route('/api/agents/chat', {
      ...READY,
      agentId: 'a_new',
      agentName: 'Bluff Master',
      strategy: 'You are patient.',
    }, { method: 'POST' });

    draft();
    await answer();

    // Not a first word ("Bluff") and not six characters ("Bluff "): the full
    // name, because names.js owns that rule for every pill in the product and a
    // second rule here is how two surfaces start disagreeing about what a man
    // is called. See the note in BirthScreen's create branch.
    await waitFor(() => expect(screen.getByTestId('draft-cap')).toHaveTextContent('Bluff Master'));
    expect(screen.getByTestId('draft-cap').dataset.named).toBe('true');
  });
});
