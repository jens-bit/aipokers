// client/src/components/home/VisitorToast.test.jsx — VISIT-1
//
// Same law as WantToast: no dismiss X, and the two chips are the only way it
// goes away.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VisitorToast } from './VisitorToast.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const knock = { id: 'v1', agentId: 'friend1', agentName: 'Away Day', respondBy: Date.now() + 30 * 60_000 };

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('VisitorToast', () => {
  it('is nothing at all with no knock waiting', () => {
    const { container } = render(<VisitorToast visitor={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names who is asking, and offers exactly two answers', () => {
    render(<VisitorToast visitor={knock} />);
    const toast = screen.getByTestId('home-visitor');
    expect(toast).toHaveTextContent('Away Day');
    expect(within(toast).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /dismiss|close|✕/i })).toBeNull();
  });

  it('accepting POSTs accept:true and hands the reply back', async () => {
    let posted = null;
    const onAnswered = vi.fn();
    fetchMock.route(/\/visitors\/v1\/answer/, ({ body }) => {
      posted = body;
      return { visitId: 'v1', accepted: true, line: 'Pull up a chair.' };
    }, { method: 'POST' });

    render(<VisitorToast visitor={knock} onAnswered={onAnswered} />);
    await userEvent.click(screen.getByTestId('home-visitor-accept'));

    await waitFor(() => expect(posted).toEqual(expect.objectContaining({ accept: true })));
    expect(onAnswered).toHaveBeenCalledWith('v1', true, expect.objectContaining({ accepted: true }));
  });

  it('declining POSTs accept:false', async () => {
    let posted = null;
    fetchMock.route(/\/visitors\/v1\/answer/, ({ body }) => { posted = body; return { accepted: false, line: 'Not tonight.' }; }, { method: 'POST' });

    render(<VisitorToast visitor={knock} onAnswered={() => {}} />);
    await userEvent.click(screen.getByTestId('home-visitor-decline'));

    await waitFor(() => expect(posted).toEqual(expect.objectContaining({ accept: false })));
  });

  it('a second tap while the first is in flight does nothing extra', async () => {
    let calls = 0;
    let release;
    fetchMock.route(/\/visitors\/v1\/answer/, () => new Promise((resolve) => {
      calls += 1;
      release = () => resolve({ accepted: true });
    }), { method: 'POST' });

    render(<VisitorToast visitor={knock} onAnswered={() => {}} />);
    const accept = screen.getByTestId('home-visitor-accept');
    await userEvent.click(accept);
    await userEvent.click(accept);
    expect(calls).toBe(1);
    release();
  });
});
