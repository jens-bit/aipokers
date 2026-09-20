import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopHome } from './DesktopHome.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { playingAgent, agentsResponse } from '../../test/fixtures/agents.js';
import { badBeatHand } from '../../test/fixtures/flagged.js';

// Isolate the casino's row/callback contract; replay and owner lookup stay real.
vi.mock('../../screens/CasinoScreen.jsx', () => ({ CasinoScreen: ({ onReplay }) => (
  <button disabled={!onReplay} onClick={() => onReplay({ agentIds: [playingAgent.id], handNumber: 37 })}>Replay tonight's hand</button>
) }));

describe('desktop casino replay', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route(`/api/agents/${playingAgent.id}/flagged`, { flaggedHands: [badBeatHand] });
  });
  it('BUG-89: a board hand opens its owned desktop replay and returns to the casino', async () => {
    render(<DesktopHome onWatchAgent={() => {}} onCreateAgent={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'The door — the casino', exact: true }));
    const row = await screen.findByRole('button', { name: "Replay tonight's hand" });
    expect(row).toBeEnabled();
    await userEvent.click(row);
    await waitFor(() => expect(document.querySelector('.dsk-replay')).toBeInTheDocument());
    expect(document.querySelector('.dsk-replay__scrub')).toHaveTextContent('HAND #37');
    await userEvent.click(screen.getByRole('button', { name: /BACK TO THE FLOOR/i }));
    expect(screen.getByRole('button', { name: "Replay tonight's hand" })).toBeInTheDocument();
    const read = fetchMock.calls.find(c => c.url.includes(`/${playingAgent.id}/flagged`));
    expect(Object.entries(read.headers).find(([k]) => k.toLowerCase() === 'x-telegram-init-data')?.[1]).toBeTruthy();
  });
  it('BUG-89: an expired flagged hand falls back to its actual companion', async () => {
    fetchMock.route(`/api/agents/${playingAgent.id}/flagged`, { flaggedHands: [] });
    render(<DesktopHome onWatchAgent={() => {}} onCreateAgent={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'The door — the casino', exact: true }));
    const row = await screen.findByRole('button', { name: "Replay tonight's hand" });
    expect(row).toBeEnabled();
    await userEvent.click(row);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Stats', exact: true })).toBeInTheDocument());
    expect(screen.getByTestId('agent-stage')).toBeInTheDocument();
    expect(document.querySelector('.dsk-replay')).toBeNull();
  });
});
