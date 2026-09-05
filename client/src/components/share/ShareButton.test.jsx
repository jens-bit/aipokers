// SHARE-1 — the button, the sheet, and the two places they appear.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareButton } from './ShareButton.jsx';
import { ReplayTheatre } from '../replay/ReplayTheatre.jsx';
import { FlaggedHandsSheet } from '../floor/FlaggedHandsSheet.jsx';
import { badBeatHand, flaggedResponse } from '../../test/fixtures/flagged.js';
import { playingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

const renderButton = (props = {}) => render(
  <ShareButton hand={badBeatHand} agentName="Aggressive v1.3" mood="tilted" {...props} />,
);

// The browser bits the export leans on, none of which jsdom implements.
function installCanvas() {
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (key === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (key in target) return target[key];
      return () => {};
    },
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
  // The ghost is loaded as an <img>; jsdom fetches nothing, so say it arrived.
  vi.stubGlobal('Image', class { set src(_v) { queueMicrotask(() => this.onload?.()); } });
}

let clicked;

beforeEach(() => {
  telegram.signIn();
  installCanvas();
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push(this.download);
  });
  URL.createObjectURL = vi.fn(() => 'blob:card');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

describe('ShareButton', () => {
  it('is a ghost button, and nothing opens until it is pressed', () => {
    renderButton();
    const button = screen.getByRole('button', { name: 'Share this hand' });
    expect(button).toHaveTextContent('Share');
    expect(button).toHaveStyle({ background: 'transparent' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the card before anything is sent', async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Share this hand' }));

    const sheet = screen.getByRole('dialog', { name: 'Share this hand' });
    expect(within(sheet).getByText('Aggressive v1.3')).toBeInTheDocument();
    expect(within(sheet).getByText('−$1,840')).toBeInTheDocument();
    expect(within(sheet).getByText('agenticpoker.app')).toBeInTheDocument();
    expect(within(sheet).getByText('Exports at 1080×1080.')).toBeInTheDocument();
  });

  it('renders nothing at all without a hand to share', () => {
    render(<ShareButton hand={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('closes again', async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Share this hand' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends the PNG through the OS share sheet and says so', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true, clipboard: { writeText: vi.fn() } });

    const user = userEvent.setup({ document });
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Share this hand' }));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    const [{ files }] = share.mock.calls[0];
    expect(files[0].name).toBe('agenticpoker-aggressive-v1-3-37.png');
    expect(await screen.findByText('Shared.')).toBeInTheDocument();
  });

  it('Save image saves the file and never opens a chat picker', async () => {
    const switchInlineQuery = vi.fn();
    telegram.webApp.switchInlineQuery = switchInlineQuery;
    const share = vi.fn();
    vi.stubGlobal('navigator', { share, canShare: () => true, clipboard: { writeText: vi.fn() } });

    const user = userEvent.setup({ document });
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Share this hand' }));
    await user.click(screen.getByRole('button', { name: 'Save image' }));

    expect(await screen.findByText(/Saved to your downloads/)).toBeInTheDocument();
    expect(clicked).toEqual(['agenticpoker-aggressive-v1-3-37.png']);
    expect(switchInlineQuery).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    delete telegram.webApp.switchInlineQuery;
  });

  it('reports plainly when the browser would not save the image', async () => {
    // No share sheet, no object URLs — a locked-down webview. The words still
    // reach the clipboard, and the sheet says exactly that rather than
    // pretending something was shared.
    vi.stubGlobal('navigator', {});
    URL.createObjectURL = undefined;

    const user = userEvent.setup({ document });
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Share this hand' }));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(await screen.findByText(/Caption copied\. This browser would not save the image\./))
      .toBeInTheDocument();
  });
});

describe('where the Share appears', () => {
  it('sits in the replay theatre header', () => {
    render(<ReplayTheatre hand={{ ...badBeatHand, agentName: 'Aggressive v1.3' }} onBack={() => {}} autoPlay={false} />);
    const header = document.querySelector('.replay-theatre__header');
    expect(within(header).getByRole('button', { name: 'Share this hand' })).toBeInTheDocument();
  });

  it('sits on every flagged-hands row, without opening the review', async () => {
    fetchMock.route('/flagged', flaggedResponse);
    const user = userEvent.setup();
    render(<FlaggedHandsSheet agent={playingAgent} onBack={() => {}} />);
    await screen.findByText('88% equity favorite, still lost');

    const shares = screen.getAllByRole('button', { name: 'Share this hand' });
    expect(shares).toHaveLength(flaggedResponse.flaggedHands.length);

    // The row is still the tap target for the review; the Share is not.
    await user.click(shares[0]);
    expect(screen.getByRole('dialog', { name: 'Share this hand' })).toBeInTheDocument();
    expect(screen.queryByText('Hole cards')).not.toBeInTheDocument();
  });
});
