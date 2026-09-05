// SHARE-1 — the export.
//
// jsdom has no 2D canvas, which is the right constraint here: it forces the
// drawing to be a function of (ctx, model) and nothing else, so a recording
// context can say exactly what the PNG will contain.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  drawShareCard, renderSharePng, svgNodeToImage, trackedWidth, wrapText,
} from './drawShareCard.js';
import { buildShareModel } from './shareModel.js';
import { badBeatHand } from '../../test/fixtures/flagged.js';

const model = buildShareModel(badBeatHand, { agentName: 'Aggressive v1.3', mood: 'tilted' });

// A context that records instead of painting. measureText is a stand-in a real
// engine would disagree with by a pixel or two — nothing here asserts on layout
// arithmetic, only on what is drawn and in what colour.
function recordingCtx() {
  const text = [];
  const images = [];
  const rects = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '',
    createRadialGradient: () => ({ stops: [], addColorStop() {} }),
    fillRect: (...a) => rects.push(a),
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arcTo() {},
    ellipse() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {}, scale() {},
    // Width scales with the font size the way a real engine's does, so the
    // result line's shrink-to-fit loop is actually exercised.
    measureText: (t) => ({ width: String(t).length * (Number(/\s(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1]) || 12) * 0.5 }),
    fillText: (t, x, y) => text.push({ text: String(t), x, y, color: ctx.fillStyle, font: ctx.font }),
    drawImage: (...a) => images.push(a),
  };
  return { ctx, text, images, rects };
}

const painted = (text) => text.map((t) => t.text).join('');

describe('wrapText', () => {
  const { ctx } = recordingCtx();

  it('breaks on words and keeps inside the width', () => {
    expect(wrapText(ctx, 'one two three four', 60, 2)).toEqual(['one two', 'three four']);
  });

  it('ellipsises rather than running past the last line', () => {
    const lines = wrapText(ctx, 'one two three four five six seven eight', 60, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('leaves a short line alone', () => {
    expect(wrapText(ctx, 'short', 600, 2)).toEqual(['short']);
  });
});

describe('trackedWidth', () => {
  it('counts the gaps between letters but not after the last one', () => {
    const { ctx } = recordingCtx();
    expect(trackedWidth(ctx, 'abc', 2)).toBe(3 * 6 + 2 * 2);
    expect(trackedWidth(ctx, '', 2)).toBe(0);
  });
});

describe('drawShareCard', () => {
  it('paints everything the card promises', () => {
    const { ctx, text } = recordingCtx();
    drawShareCard(ctx, model);
    const all = painted(text);

    expect(all).toContain('Aggressive v1.3');   // his name
    expect(all).toContain('BAD BEAT');          // the flag, drawn letter by letter
    expect(all).toContain('−$1,840');           // what it cost
    expect(all).toContain('· pair of aces');    // what he held
    expect(all).toContain('He got there.');     // his own line
    expect(all).toContain('AGENTICPOKER.APP');  // the mark
    expect(all).toContain('HAND #37');          // the stamp, tracked
  });

  it('paints his two cards and the board', () => {
    const { ctx, text } = recordingCtx();
    drawShareCard(ctx, model);
    // Aces, then 2s 7h Kd 4c 9s — seven cards, seven ranks and seven suits.
    // Card faces are the only thing set in Arial — the tracked labels spell out
    // single letters too, and 'A' from AGENTICPOKER is not an ace.
    const faces = text.filter((t) => t.font.includes('Arial'));
    expect(faces.filter((t) => /^(10|[2-9]|[AKQJ])$/.test(t.text)).map((t) => t.text))
      .toEqual(['A', 'A', '2', '7', 'K', '4', '9']);
    expect(faces.filter((t) => '♠♥♦♣'.includes(t.text)).map((t) => t.text))
      .toEqual(['♥', '♦', '♠', '♥', '♦', '♣', '♠']);
  });

  it('colours the amount by whether he won it', () => {
    const { ctx, text } = recordingCtx();
    drawShareCard(ctx, model);
    expect(text.find((t) => t.text === '−$1,840').color).toBe('#FF4D4F');

    const wonModel = buildShareModel({ ...badBeatHand, won: true }, { agentName: 'A' });
    const second = recordingCtx();
    drawShareCard(second.ctx, wonModel);
    expect(second.text.find((t) => t.text === '+$1,840').color).toBe('#00D4AA');
  });

  it('quotes his line in his mood, and says nothing when he said nothing', () => {
    const { ctx, text } = recordingCtx();
    drawShareCard(ctx, model);
    const quote = text.find((t) => t.text.includes('He got there'));
    expect(quote.color).toBe('#FF4D4F'); // tilted
    expect(quote.font).toContain('italic');

    const quiet = buildShareModel(
      { ...badBeatHand, streets: [{ street: 'flop', board: ['2s', '7h', 'Kd'], action: 'bet 10' }] },
      { agentName: 'A' },
    );
    const second = recordingCtx();
    drawShareCard(second.ctx, quiet);
    expect(painted(second.text)).not.toContain('He got there');
  });

  it('draws his face when there is one, and exports without it when there is not', () => {
    const withGhost = recordingCtx();
    drawShareCard(withGhost.ctx, model, { ghost: { nodeName: 'IMG' } });
    expect(withGhost.images).toHaveLength(1);
    expect(withGhost.images[0].slice(3)).toEqual([76, 76]);

    const without = recordingCtx();
    drawShareCard(without.ctx, model);
    expect(without.images).toHaveLength(0);
    expect(painted(without.text)).toContain('−$1,840');
  });

  it('fits a long result line by shrinking it, not by clipping it', () => {
    const long = { ...model, hand: 'a hand with an unreasonably long name indeed', result: `${model.amount} · a hand with an unreasonably long name indeed` };
    const { ctx, text } = recordingCtx();
    drawShareCard(ctx, long);
    const line = text.find((t) => t.text.includes('unreasonably'));
    const size = Number(/\s(\d+)px/.exec(line.font)[1]);
    expect(size).toBeLessThan(24);
    expect(size).toBeGreaterThanOrEqual(14); // never smaller than legible
    // Shrunk, never clipped: the whole line is still drawn.
    expect(painted(text)).toContain('unreasonably long name indeed');
  });
});

describe('svgNodeToImage', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('has nothing to draw without a node', async () => {
    await expect(svgNodeToImage(null)).resolves.toBeNull();
  });

  it('serializes the live ghost with an xmlns so an <img> will take it', async () => {
    const loaded = [];
    vi.stubGlobal('Image', class {
      set src(v) { loaded.push(v); queueMicrotask(() => this.onload?.()); }
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '80');

    const img = await svgNodeToImage(svg);
    expect(img).not.toBeNull();
    const src = decodeURIComponent(loaded[0]);
    expect(src.startsWith('data:image/svg+xml')).toBe(true);
    expect(src).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('gives up on a face that never arrives rather than holding the share open', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class { set src(_v) { /* never loads, never errors */ } });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const pending = svgNodeToImage(svg);
    vi.advanceTimersByTime(2000);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('resolves null rather than throwing when the image will not load', async () => {
    vi.stubGlobal('Image', class {
      set src(_v) { queueMicrotask(() => this.onerror?.()); }
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    await expect(svgNodeToImage(svg)).resolves.toBeNull();
  });
});

describe('renderSharePng', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('draws the card at the export size and hands back a PNG', async () => {
    const { ctx } = recordingCtx();
    const scaled = [];
    ctx.scale = (...a) => scaled.push(a);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function toBlob(cb) { cb({ type: 'image/png', size: 1, canvas: this }); });

    const png = await renderSharePng(model, { size: 1080 });

    expect(png).toMatchObject({ type: 'image/png' });
    expect(png.canvas.width).toBe(1080);
    expect(png.canvas.height).toBe(1080);
    // One scale, at the top: everything below draws in 360-unit space.
    expect(scaled).toEqual([[3, 3]]);
  });

  it('gives back nothing, rather than throwing, where there is no canvas', async () => {
    // jsdom implements no 2D context, and neither do some locked-down webviews.
    // A browser that cannot draw is one the sheet falls back to words on.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(renderSharePng(model)).resolves.toBeNull();
  });

  it('survives a browser whose canvas cannot be read back', async () => {
    const { ctx } = recordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null));
    await expect(renderSharePng(model)).resolves.toBeNull();
  });
});
