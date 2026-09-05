// client/src/screens/BirthScreen.test.jsx — TEST-1
//
// BirthScreen is the creation chat: the one place an agent comes into
// existence. Three things have to hold — the form gates its own primary
// action, the server round-trip produces an agent, and every text field is at
// least 16px so iOS does not zoom the page (BUG-02).

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const send = () => screen.getByRole('button', { name: 'Send' });
const composer = () => screen.getByPlaceholderText(/Describe how it should play/i);

describe('BirthScreen', () => {
  beforeEach(() => { telegram.signIn(); });

  it('opens with an empty composer and the send button disabled', () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    expect(composer()).toHaveValue('');
    expect(send()).toBeDisabled();
  });

  it('enables send only once the form is valid, and disables it again when emptied', async () => {
    const user = userEvent.setup();
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);

    await user.type(composer(), 'Tight and patient');
    expect(send()).toBeEnabled();

    await user.clear(composer());
    expect(send()).toBeDisabled();
  });

  it('treats whitespace as empty', async () => {
    const user = userEvent.setup();
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);

    await user.type(composer(), '    ');
    expect(send()).toBeDisabled();
  });

  it('sends the description to the creation endpoint and shows the reply', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents/chat', {
      chat: [
        { role: 'user', content: 'Tight and patient' },
        { role: 'assistant', content: 'Got it. How does it handle a three-bet?' },
      ],
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await user.type(composer(), 'Tight and patient');
    await user.click(send());

    expect(await screen.findByText('Got it. How does it handle a three-bet?')).toBeInTheDocument();

    const [post] = fetchMock.requestsMatching('/api/agents/chat');
    expect(post.method).toBe('POST');
    expect(post.body).toMatchObject({ content: 'Tight and patient' });
    // LLM-spending endpoint: the Telegram initData header must ride along or
    // the server answers 401.
    expect(post.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });

  it('hands the finished agent back through onBirth when the server says it is born', async () => {
    const user = userEvent.setup();
    const onBirth = vi.fn();
    fetchMock.route('/api/agents/chat', {
      chat: [{ role: 'assistant', content: 'Meet The Grinder.' }],
      agentId: 'agent_grinder',
      agentName: 'The Grinder',
      strategy: 'Patient. Folds junk.',
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={onBirth} />);
    await user.type(composer(), 'Tight and patient');
    await user.click(send());

    expect(await screen.findByText('Meet The Grinder.')).toBeInTheDocument();

    // BirthScreen holds the "born" card on screen for 1.2s before handing off.
    await waitFor(() => expect(onBirth).toHaveBeenCalledWith({
      id: 'agent_grinder',
      name: 'The Grinder',
      strategy: 'Patient. Folds junk.',
    }), { timeout: 3000 });
  });

  it('offers suggestion chips that send without typing', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'Noted.' }] }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Tight and patient' }));

    const [post] = fetchMock.requestsMatching('/api/agents/chat');
    expect(post.body).toMatchObject({ content: 'Tight and patient' });
  });

  // FIX-1c. Mobile playtest 2026-09-05: the draft screen threw the iOS keyboard
  // up on entry, covering the opening prompt the owner is meant to answer.
  it('FIX-1c: does not take focus when the draft screen opens', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await screen.findByText(/One open seat/);

    expect(composer()).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('FIX-1c: focuses the composer when the owner taps it', async () => {
    const user = userEvent.setup();
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);

    await user.click(composer());
    expect(composer()).toHaveFocus();
  });

  // BUG-02 regression. Any text field below 16px makes iOS Safari zoom the
  // whole page on focus, which broke the layout of the creation chat.
  it('every input and textarea computes to at least 16px (BUG-02)', () => {
    const { container } = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);

    const fields = container.querySelectorAll('input, textarea');
    expect(fields.length).toBeGreaterThan(0);

    for (const field of fields) {
      const size = parseFloat(window.getComputedStyle(field).fontSize);
      expect(Number.isFinite(size)).toBe(true);
      expect(size, `${field.tagName.toLowerCase()} font-size ${size}px is below the 16px iOS zoom threshold`)
        .toBeGreaterThanOrEqual(16);
    }
  });
});
