// client/src/components/desktop/DraftPanel.test.jsx — DP-4
//
// The draft panel has two states, and the difference is whether a draft is
// actually under way. D4FlowScreenM is the second one.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../styles/desktop.css';

import { DraftPanel } from './panelParts.jsx';
import { telegram } from '../../test/harness.js';

describe('DP-4 — no draft under way', () => {
  beforeEach(() => { telegram.signIn(); });

  it('is the invitation it has always been', () => {
    render(<DraftPanel first onDraft={() => {}} />);
    expect(screen.getByText('Draft your first agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft an agent' })).toBeInTheDocument();
    expect(screen.queryByText(/Taking shape/i)).toBeNull();
  });

  it('offers a second seat differently from a first', () => {
    render(<DraftPanel first={false} onDraft={() => {}} />);
    expect(screen.getByText('Draft another agent')).toBeInTheDocument();
    expect(screen.getByText(/Four seats maximum/)).toBeInTheDocument();
  });
});

describe('DP-4 — taking shape', () => {
  beforeEach(() => { telegram.signIn(); });

  const draft = (over = {}) => ({ phase: 0.86, natureHint: 'Hothead', ...over });

  it('says how defined he is', () => {
    const { container } = render(<DraftPanel draft={draft()} />);
    expect(screen.getByText('86% DEFINED')).toBeInTheDocument();
    expect(container.querySelector('.dsk-shape__fill').style.width).toBe('86%');
    expect(screen.getByRole('progressbar', { name: /how defined/i }))
      .toHaveAttribute('aria-valuenow', '86');
  });

  it('names the nature once the draft is usable', () => {
    render(<DraftPanel draft={draft()} />);
    // NatureFormed's committed state, with its zero-sum pair.
    expect(screen.getByText(/Hothead/i)).toBeInTheDocument();
  });

  it('keeps the nature a guess while the draft is not usable yet', () => {
    render(<DraftPanel draft={draft({ phase: 0.4 })} />);
    expect(screen.getByText(/forming/i)).toBeInTheDocument();
  });

  it('never invents a nature the brief did not imply', () => {
    const { container } = render(<DraftPanel draft={draft({ natureHint: null })} />);
    // The neutral forming chip, which is what this panel always drew.
    expect(container.querySelector('.dsk-shape__nature')).toBeTruthy();
    expect(screen.queryByText(/Hothead/i)).toBeNull();
  });

  it('draws the dials the brief has settled, and only those', () => {
    const { container } = render(
      <DraftPanel draft={draft({ style: 78, risk: 71 })} />,
    );
    const dials = container.querySelectorAll('.dsk-shape__dial');
    expect(dials).toHaveLength(2);
    expect(within(dials[0]).getByText('Style')).toBeInTheDocument();
    expect(within(dials[0]).getByText('78')).toBeInTheDocument();
  });

  it('draws no dial box at all when nothing is settled', () => {
    const { container } = render(<DraftPanel draft={draft()} />);
    expect(container.querySelector('.dsk-shape__dials')).toBeNull();
  });

  // The one thing the owner has to know before pressing it.
  it('says what the button does, and that it cannot be undone', () => {
    render(<DraftPanel draft={draft()} />);
    expect(screen.getByText(/What happens on the button/i)).toBeInTheDocument();
    expect(screen.getByText(/He is born, names himself/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be changed afterwards/)).toBeInTheDocument();
  });

  it('deals him in once he is usable', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    render(<DraftPanel draft={draft()} onDraft={onDraft} />);

    const btn = screen.getByRole('button', { name: 'Deal him in' });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onDraft).toHaveBeenCalled();
  });

  it('asks for more before he is usable, rather than offering a dead button', () => {
    render(<DraftPanel draft={draft({ phase: 0.4 })} onDraft={() => {}} />);
    const btn = screen.getByRole('button', { name: /Keep describing him/i });
    expect(btn).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Deal him in' })).toBeNull();
  });

  it('takes an explicit ready flag over the phase threshold', () => {
    render(<DraftPanel draft={draft({ phase: 0.4, ready: true })} onDraft={() => {}} />);
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeEnabled();
  });
});
