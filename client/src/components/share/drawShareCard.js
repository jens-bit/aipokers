// SHARE-1 — the card as pixels.
//
// The same composition as ShareCard.jsx, painted onto a canvas so it can leave
// the app as a file. Canvas rather than html-to-image because that would be a
// new dependency for something the platform already does, and because the
// export is the artifact people judge: 1080×1080 drawn at 3× beats a DOM
// screenshot that has to guess at fonts and shadows.
//
// Everything is laid out in BASE units and scaled once at the top, so the same
// code draws the 360px preview and the 1080px export.
//
// The one thing canvas cannot paint from scratch is his face — MoodGhost is an
// SVG component. Rather than redraw the ghost here (two copies of a face that
// would drift apart), the export serializes the ghost node the preview already
// rendered and draws that image in. No node, no face: the card still exports,
// which is the right failure for a share button.

import { MARK } from './shareModel.js';

export const BASE = 360;
const PAD = 26;

const TEXT = '#EDEDED';
const DIM = '#A1A1A1';
const MUTED = '#6B6B6B';
const HAIRLINE = 'rgba(255,255,255,0.14)';

const INTER = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const OSWALD = "'Oswald', 'Inter', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const CARD_FONT = 'Arial, Helvetica, sans-serif';

const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR = { s: '#111111', c: '#111111', h: '#E04F5F', d: '#E04F5F' };

// ── small canvas helpers ────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Letter-spaced text, drawn a character at a time. ctx.letterSpacing exists in
// Chrome but not everywhere the mini app runs, and the Oswald labels are the
// half of this card that reads as branding — they cannot be tracking-less on
// half the devices.
export function trackedWidth(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}

export function fillTracked(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return cursor;
}

/** Break `text` to at most `maxLines` lines of `maxWidth`, last one ellipsised. */
export function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function playingCard(ctx, card, x, y, w, h) {
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  const color = SUIT_COLOR[suit] ?? '#111111';

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, w, h, Math.round(w * 0.1));
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${Math.round(w * 0.42)}px ${CARD_FONT}`;
  ctx.fillText(rank === 'T' ? '10' : rank, x + w * 0.09, y + w * 0.07);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.round(w * 0.46)}px ${CARD_FONT}`;
  ctx.fillText(SUIT_GLYPH[suit] ?? '', x + w - w * 0.08, y + h - w * 0.04);
}

// ── the composition ─────────────────────────────────────────────────────────

/**
 * Draw the card in BASE units. The caller owns the scale.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} model from buildShareModel
 * @param {{ ghost?: CanvasImageSource|null }} opts
 */
export function drawShareCard(ctx, model, { ghost = null } = {}) {
  const mid = BASE / 2;

  // The felt, as a light falling on it.
  const bg = ctx.createRadialGradient(mid, BASE * 0.4, 0, mid, BASE * 0.4, BASE * 0.78);
  bg.addColorStop(0, '#24302C');
  bg.addColorStop(0.58, '#171F1D');
  bg.addColorStop(1, '#0E1413');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BASE, BASE);

  // The felt's own arc, as the only ornament (ref: mood-share.jsx).
  ctx.strokeStyle = 'rgba(0,212,170,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(mid, 60 + BASE * 0.31, BASE * 0.68, BASE * 0.31, 0, 0, Math.PI * 2);
  ctx.stroke();

  // His mood, as the light behind him.
  const aura = ctx.createRadialGradient(mid, BASE * 0.3, 0, mid, BASE * 0.3, BASE * 0.42);
  aura.addColorStop(0, `${model.moodColor}2E`);
  aura.addColorStop(1, `${model.moodColor}00`);
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, BASE, BASE);

  // ── his face ──
  const ghostSize = 76;
  if (ghost) ctx.drawImage(ghost, mid - ghostSize / 2, 18, ghostSize, ghostSize);

  // ── his name, and the flag that says why this hand ──
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const nameY = 108;
  ctx.font = `500 13px ${INTER}`;
  const nameW = ctx.measureText(model.name).width;
  const label = model.flag.label;
  ctx.font = `600 9px ${OSWALD}`;
  const chipW = trackedWidth(ctx, label, 1.1) + 13;
  const rowW = nameW + 7 + chipW;
  let x = mid - rowW / 2;

  ctx.font = `500 13px ${INTER}`;
  ctx.fillStyle = DIM;
  ctx.fillText(model.name, x, nameY);
  x += nameW + 7;

  ctx.fillStyle = `${model.flag.color}1A`;
  roundRect(ctx, x, nameY - 9, chipW, 18, 3);
  ctx.fill();
  ctx.strokeStyle = `${model.flag.color}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = model.flag.color;
  ctx.font = `600 9px ${OSWALD}`;
  fillTracked(ctx, label, x + 6.5, nameY + 0.5, 1.1);

  // ── his two cards, then the board ──
  const holeW = 40;
  const holeH = 55;
  const boardW = 30;
  const boardH = 41;
  const cardsY = 134;
  const holeSpan = model.holeCards.length ? model.holeCards.length * holeW + (model.holeCards.length - 1) * 4 : 0;
  const boardSpan = model.board.length ? model.board.length * boardW + (model.board.length - 1) * 3 : 0;
  const gap = holeSpan && boardSpan ? 15 : 0;
  let cx = mid - (holeSpan + gap + boardSpan) / 2;

  model.holeCards.forEach((c, i) => {
    playingCard(ctx, c, cx + i * (holeW + 4), cardsY, holeW, holeH);
  });
  if (holeSpan) cx += holeSpan + gap;
  model.board.forEach((c, i) => {
    // The board sits a shade lower, so his own two read as his.
    playingCard(ctx, c, cx + i * (boardW + 3), cardsY + 8, boardW, boardH);
  });

  // ── what it came to ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const resultY = 226;
  let resultSize = 24;
  const measureResult = () => {
    ctx.font = `600 ${resultSize}px ${PLAYFAIR}`;
    return ctx.measureText(model.result).width;
  };
  while (resultSize > 14 && measureResult() > BASE - PAD * 2) resultSize -= 1;
  ctx.font = `600 ${resultSize}px ${PLAYFAIR}`;
  const amountW = ctx.measureText(model.amount).width;
  const restW = ctx.measureText(model.result).width - amountW;
  let rx = mid - (amountW + restW) / 2;
  ctx.fillStyle = model.resultColor;
  ctx.fillText(model.amount, rx, resultY);
  rx += amountW;
  ctx.fillStyle = TEXT;
  ctx.fillText(model.result.slice(model.amount.length), rx, resultY);

  // ── one line of his table talk ──
  if (model.talk) {
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mid - 20, 246);
    ctx.lineTo(mid + 20, 246);
    ctx.stroke();

    ctx.font = `italic 13px ${INTER}`;
    ctx.fillStyle = model.moodColor;
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, `“${model.talk}”`, BASE - PAD * 2, 2);
    lines.forEach((line, i) => ctx.fillText(line, mid, 268 + i * 19));
  }

  // ── the mark, and the hand it came from ──
  const footY = BASE - 24;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = `13px ${INTER}`;
  ctx.fillText('♠', PAD, footY);
  ctx.font = `600 10px ${OSWALD}`;
  fillTracked(ctx, MARK.toUpperCase(), PAD + 15, footY, 1.8);

  if (model.stamp) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 9px ${MONO}`;
    const stampW = trackedWidth(ctx, model.stamp, 0.5);
    fillTracked(ctx, model.stamp, BASE - PAD - stampW, footY, 0.5);
  }
}

// ── from a live ghost node to something drawImage accepts ───────────────────

/**
 * Serialize an SVG element and load it as an image. Data URL, not a blob URL:
 * an SVG with no external references does not taint the canvas, so the result
 * can still be read back out as a PNG.
 */
const GHOST_TIMEOUT_MS = 1500;

export function svgNodeToImage(node) {
  if (!node || typeof XMLSerializer === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  let markup;
  try {
    markup = new XMLSerializer().serializeToString(node);
  } catch {
    return Promise.resolve(null);
  }
  if (!markup.includes('xmlns=')) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

  return new Promise((resolve) => {
    // A face that never arrives must not hold the share button open forever:
    // an <img> that neither loads nor errors is a real state (a webview with
    // images turned off, a data URL the parser gave up on), and the card is
    // still worth sending without it.
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish(null), GHOST_TIMEOUT_MS);

    const img = new Image();
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

/**
 * The card as a PNG. Null when this browser has no 2D canvas at all — the
 * caller falls back to sharing the words.
 *
 * @returns {Promise<Blob|null>}
 */
export async function renderSharePng(model, { size = 1080, ghostNode = null } = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  let ctx = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  // Playfair and Oswald arrive from Google Fonts; drawing before they land
  // silently falls back to Georgia and the export stops looking like the app.
  try { await document.fonts?.ready; } catch { /* no font manager — draw anyway */ }

  const ghost = await svgNodeToImage(ghostNode);

  ctx.scale(size / BASE, size / BASE);
  drawShareCard(ctx, model, { ghost });

  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return; }
    canvas.toBlob((blob) => resolve(blob ?? null), 'image/png');
  });
}
