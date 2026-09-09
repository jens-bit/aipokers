// client/src/screens/BirthScreen.test.jsx — TEST-1
//
// BirthScreen is the creation chat: the one place an agent comes into
// existence. Three things have to hold — the form gates its own primary
// action, the server round-trip produces an agent, and every text field is at
// least 16px so iOS does not zoom the page (BUG-02).

import { act, render, screen, waitFor } from '@testing-library/react';
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

  it('BUG-159: an existing agent conversation never becomes a creation draft', async () => {
    const user = userEvent.setup();
    const onBirth = vi.fn();
    fetchMock.route('/api/agents/chat', req => {
      // Match the actual server target contract. A missing target otherwise
      // routes this message to creation, even though the screen names Granite.
      return req.body.existingAgentId === 'edit-granite'
        ? { chat: [{ role: 'assistant', content: 'I can be more patient.' }] }
        : { chat: [{ role: 'assistant', content: 'What should we call him?' }], ready: true };
    }, { method: 'POST' });
    render(<BirthScreen agent={{ id: 'edit-granite', name: 'Granite', strategy: 'Patient.' }} onBack={() => {}} onBirth={onBirth} />);
    await user.type(screen.getByPlaceholderText('Message Granite…'), 'Be more patient.');
    await user.click(send());
    expect(await screen.findByText('I can be more patient.')).toBeInTheDocument();
    expect(screen.queryByText('What should we call him?')).toBeNull();
    const [post] = fetchMock.requestsMatching('/api/agents/chat');
    expect(post.body).toMatchObject({ existingAgentId: 'edit-granite', content: 'Be more patient.' });
    expect(post.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
    expect(fetchMock.requestsMatching('/api/agents/draft')).toHaveLength(0);
    expect(onBirth).not.toHaveBeenCalled();
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

  it.each([false, true])('BUG-93: focus scrolls only when the composer is obscured (%s)', async obscured => {
    vi.useFakeTimers();
    let unmount;
    try {
      ({ unmount } = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />));
      const input = composer();
      input.getBoundingClientRect = () => ({ top: 20, bottom: obscured ? window.innerHeight + 100 : 64 });
      input.scrollIntoView = vi.fn();
      await act(async () => { input.focus(); await vi.advanceTimersByTimeAsync(200); });
      expect(input.scrollIntoView).toHaveBeenCalledTimes(obscured ? 1 : 0);
      if (obscured) expect(input.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    } finally { unmount?.(); vi.useRealTimers(); }
  });

  // AGENTS-2. Four active agents is the roster. When the draft finish is turned
  // down the owner has to be told what to DO about it — the answer is to retire
  // someone, not to delete him, and the draft is still on the server waiting.
  it('AGENTS-2: a 409 agentCap tells the owner to retire one to make room', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'agentCap', cap: 4 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    expect(await screen.findByText(/Retire one to make room/i)).toBeInTheDocument();
    expect(screen.getByText(/already have 4 agents/i)).toBeInTheDocument();
  });

  it('AGENTS-2: a capped draft creates nobody and does not hand off', async () => {
    const user = userEvent.setup();
    const onBirth = vi.fn();
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'agentCap', cap: 4 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={onBirth} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    await screen.findByText(/Retire one to make room/i);
    expect(onBirth).not.toHaveBeenCalled();
    // The screen is usable again — the refusal is a message, not a dead end.
    await user.type(composer(), 'lets go');
    expect(send()).toBeEnabled();
  });

  // BIRTH-5 / SLOTS-1. The OTHER 409, and it used to be answered with silence:
  // the body carries no `chat`, so the reply picker found none and "lets go"
  // simply did nothing, forever, with no line and no explanation.
  // BUG-147: earned seats unlock; the founder's correction supersedes the old
  // “costs ... you have ...” wording which implied a spendable wallet balance.
  it('BIRTH-5: a 409 slotLocked names the threshold and earned progress', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 4_200, unlocked: false } });
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'slotLocked', price: 10_000, earned: 4_200 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} onSeeTable={() => {}} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    expect(await screen.findByText(/2nd seat unlocks at 10,000 chips won · 4,200 earned/i)).toBeInTheDocument();
    // SLOTS-1 rule 1: it is won, never bought, and the refusal has to say so.
    expect(screen.getByText(/win the rest at the casino/i)).toBeInTheDocument();
  });

  it('BIRTH-5: the refusal keeps the draft and offers the table', async () => {
    const user = userEvent.setup();
    const onBirth = vi.fn();
    const onSeeTable = vi.fn();
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 4_200, unlocked: false } });
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'slotLocked', price: 10_000, earned: 4_200 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={onBirth} onSeeTable={onSeeTable} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    await user.click(await screen.findByTestId('birth-see-table'));
    expect(onSeeTable).toHaveBeenCalled();
    expect(onBirth).not.toHaveBeenCalled();
    // The screen is usable again — the refusal is a message, not a dead end.
    await user.type(composer(), 'lets go');
    expect(send()).toBeEnabled();
  });

  it('BIRTH-5: still says which seat it is when /api/slots cannot be read', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/slots', () => ({ status: 404, body: {} }));
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'slotLocked', price: 50_000, earned: 12_000 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} onSeeTable={() => {}} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    expect(await screen.findByText(/Next seat unlocks at 50,000 chips won · 12,000 earned/i)).toBeInTheDocument();
  });

  it('BIRTH-5: a host with nowhere to send him draws no link', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 4_200, unlocked: false } });
    fetchMock.route('/api/agents/chat', {
      status: 409,
      body: { error: 'slotLocked', price: 10_000, earned: 4_200 },
    }, { method: 'POST' });

    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await user.type(composer(), 'lets go');
    await user.click(send());

    await screen.findByText(/2nd seat unlocks at 10,000 chips won/i);
    expect(screen.queryByTestId('birth-see-table')).not.toBeInTheDocument();
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
