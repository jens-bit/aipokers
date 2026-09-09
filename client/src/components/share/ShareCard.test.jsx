import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ShareCard } from './ShareCard.jsx';
import { buildShareModel } from './shareModel.js';
import { badBeatHand } from '../../test/fixtures/flagged.js';
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => vi.restoreAllMocks());
const model = buildShareModel({
  ...badBeatHand,
  identity: {
    hood: 'indigo',
    glow: 'lime'
  }
}, {
  agentName: 'Granite',
  mood: 'tilted'
});
describe('S1/S2 preview', () => {
  it('offers the same facts accessibly when canvas is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<ShareCard model={model} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/Granite.*\$1,840 pot.*pair of aces.*RAILBIRD/);
    await screen.findByText(/Image preview unavailable/);
  });
  it('keeps the recorded identity, mood, and a losing pose', async () => {
    const {
      container
    } = render(<ShareCard model={model} />);
    const ghost = container.querySelector('.mood-ghost');
    expect(ghost).toHaveAttribute('data-hood', 'indigo');
    expect(ghost).toHaveAttribute('data-mood', 'tilted');
    expect(ghost).toHaveAttribute('data-hands', 'rest');
    expect(ghost.innerHTML).toContain('#8FB03F');
    await screen.findByText(/Image preview unavailable/);
  });
  it('fits both aspect ratios without resurrecting the old square or card row', async () => {
    const {
      rerender
    } = render(<ShareCard model={model} size={324} />);
    expect(screen.getByTestId('share-card')).toHaveStyle({
      aspectRatio: '1080/1920'
    });
    rerender(<ShareCard model={model} format="preview" size={504} />);
    expect(screen.getByTestId('share-card')).toHaveStyle({
      aspectRatio: '1200/630'
    });
    await screen.findByText(/Image preview unavailable/);
  });
});
