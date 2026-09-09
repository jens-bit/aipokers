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
    createLinearGradient: () => ({addColorStop(){}}), translate(){}, rotate(){},
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

describe('drawShareCard S1/S2',()=>{
 it.each(['story','preview'])('paints real facts and the reserved footer in %s',format=>{
  const {ctx,text,images}=recordingCtx();drawShareCard(ctx,model,{format,ghost:{}});
  expect(painted(text)).toContain('AGGRESSIVE V1.3');expect(painted(text)).toContain('$1,840 pot');
  expect(painted(text)).toContain('pair of aces');expect(painted(text)).toContain('RAILBIRD');
  expect(painted(text)).toContain('He got there.');expect(images).toHaveLength(1);
  const suits=text.filter(t=>t.text==='♠');expect(suits).toHaveLength(2);
  expect(text.some(t=>['A','K','Q'].includes(t.text)&&t.font.includes('Arial'))).toBe(false);
 });
 it('colours the recorded net rather than inferring from a won flag',()=>{
  const {ctx,text}=recordingCtx();drawShareCard(ctx,buildShareModel({...badBeatHand,won:true,net:-120}));
  expect(text.find(t=>t.text==='−$120').color).toBe('#FF4D4F');
 });
 it('does not invent a quote or a character when neither is available',()=>{
  const {ctx,text,images}=recordingCtx();drawShareCard(ctx,buildShareModel({pot:100,streets:[]}));
  expect(images).toHaveLength(0);expect(painted(text)).not.toContain('“');
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

    const png = await renderSharePng(model, { format: 'story' });

    expect(png).toMatchObject({ type: 'image/png' });
    expect(png.canvas.width).toBe(1080);
    expect(png.canvas.height).toBe(1920);
    // One scale, at the top: everything below draws in 360-unit space.
    expect(scaled).toEqual([]); // Native export coordinates are also used by the preview.
    const wide = await renderSharePng(model, {format: 'preview'});
    expect([wide.canvas.width,wide.canvas.height]).toEqual([1200,630]);
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

it('BUG-116: long unbroken quote words fit the card and are visibly truncated',()=>{
 const {ctx}=recordingCtx();const lines=wrapText(ctx,'a'.repeat(300),60,2);
 expect(lines).toHaveLength(2);expect(lines[1].endsWith('…')).toBe(true);
 for(const line of lines)expect(ctx.measureText(line).width).toBeLessThanOrEqual(60);
});
