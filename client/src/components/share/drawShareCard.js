// S1/S2: one painter for the on-screen preview and downloaded image.
export const FORMATS = {
  story: {
    width: 1080,
    height: 1920,
    label: 'Story'
  },
  preview: {
    width: 1200,
    height: 630,
    label: 'Link preview'
  }
};
const INTER = "'Inter', sans-serif",
  OSWALD = "'Oswald', sans-serif",
  ROZHA = "'Rozha One', Georgia, serif";
export function shareDimensions(format = 'story') {
  return FORMATS[format] || FORMATS.story;
}
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
  let remaining = String(text).trim().replace(/\s+/g, ' ');
  const lines = [];
  while (remaining && lines.length < maxLines) {
    if (ctx.measureText(remaining).width <= maxWidth) { lines.push(remaining); break; }
    let count = 1;
    while (count < remaining.length && ctx.measureText(remaining.slice(0, count + 1)).width <= maxWidth) count++;
    if (lines.length === maxLines - 1) {
      let last = remaining.slice(0, count).trimEnd();
      while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
      lines.push(last + '…'); break;
    }
    const space = remaining.lastIndexOf(' ', count);
    const cut = space > 0 ? space : count;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return lines;
}
export function drawShareCard(ctx, model, {
  ghost = null,
  format = 'story'
} = {}) {
  const {
      width: w,
      height: h
    } = shareDimensions(format),
    u = Math.min(w, h),
    wide = w > h;
  const bg = ctx.createRadialGradient(w * .5, h * .34, 0, w * .5, h * .34, Math.max(w, h) * .72);
  bg.addColorStop(0, '#23312D');
  bg.addColorStop(.58, '#131D1B');
  bg.addColorStop(1, '#0A0F0E');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#00D4AA1F';
  ctx.lineWidth = Math.max(1, u * .003);
  ctx.beginPath();
  const eh = h * (wide ? .86 : .52);
  ctx.ellipse(w / 2, h * (wide ? .04 : .12) + eh / 2, w * .66, eh / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  const ghostSize = u * (wide ? .19 : .34),
    gap = u * (wide ? .05 : .03),
    textW = u * (wide ? .50 : .88);
  const name = [model.name, model.nature].filter(Boolean).join(' · ').toUpperCase();
  let nameSize = u * .022;
  ctx.font = '600 ' + nameSize + 'px ' + OSWALD;
  while (nameSize > u * .014 && trackedWidth(ctx, name, nameSize * .24) > textW) {
    nameSize -= .5;
    ctx.font = '600 ' + nameSize + 'px ' + OSWALD;
  }
  const nameLines = wrapText({measureText: text => ({width: trackedWidth(ctx, text, nameSize * .24)})}, name, textW, 2),
    nameH = nameLines.length * nameSize * 1.35;
  let amountSize = u * (wide ? .1 : .14);
  ctx.font = amountSize + 'px ' + ROZHA;
  while (amountSize > u * .04 && ctx.measureText(model.amount).width > textW) {
    amountSize -= 1;
    ctx.font = amountSize + 'px ' + ROZHA;
  }
  ctx.font = u * .026 + 'px ' + INTER;
  const handLabel = model.hand?.startsWith('pair of ') ? 'a ' + model.hand : model.hand;
  const detail = model.hand ? (model.won ? 'took it with ' : 'finished with ') + handLabel : model.won ? 'Won the hand' : 'Hand complete';
  const detailLines = wrapText(ctx, detail, u * (wide ? .42 : .8), 3),
    detailH = detailLines.length * u * .026 * 1.4;
  ctx.font = 'italic ' + u * .027 + 'px ' + INTER;
  const quoteLines = model.talk ? wrapText(ctx, '“' + model.talk + '”', u * (wide ? .44 : .82), wide ? 5 : 6) : [];
  const quoteW = quoteLines.length ? Math.min(u * (wide ? .50 : .88), Math.max(...quoteLines.map(t => ctx.measureText(t).width)) + u * .06) : 0;
  const quoteH = quoteLines.length ? quoteLines.length * u * .027 * 1.4 + u * .044 : 0;
  const textH = nameH + u * .018 + amountSize + u * .018 + detailH + (quoteH ? u * .038 + quoteH : 0);
  const centerY = (h - u * .155 + u * .06) / 2;
  const groupW = ghostSize + gap + textW;
  const gx = wide ? (w - groupW) / 2 : (w - ghostSize) / 2;
  const gy = wide ? centerY - ghostSize / 2 : centerY - (ghostSize + gap + textH) / 2;
  const tx = wide ? gx + ghostSize + gap : w / 2,
    ty = wide ? centerY - textH / 2 : gy + ghostSize + gap;
  const aura = ctx.createRadialGradient(gx + ghostSize / 2, gy + ghostSize * .48, 0, gx + ghostSize / 2, gy + ghostSize * .48, u * (wide ? .2 : .36));
  aura.addColorStop(0, '#CDB38026');
  aura.addColorStop(1, '#CDB38000');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);
  if (ghost) ctx.drawImage(ghost, gx - ghostSize, gy - ghostSize, ghostSize * 3, ghostSize * 3);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = '600 ' + nameSize + 'px ' + OSWALD;
  ctx.fillStyle = '#6B6B6B';
  nameLines.forEach((line, i) => fillTracked(ctx, line, wide ? tx : tx - trackedWidth(ctx, line, nameSize * .24) / 2, ty + i * nameSize * 1.35, nameSize * .24));
  let y = ty + nameH + u * .018;
  ctx.font = amountSize + 'px ' + ROZHA;
  ctx.fillStyle = model.resultColor;
  ctx.textAlign = wide ? 'left' : 'center';
  ctx.fillText(model.amount, tx, y);
  y += amountSize + u * .018;
  ctx.font = u * .026 + 'px ' + INTER;
  ctx.fillStyle = '#A1A1A1';
  detailLines.forEach((line, i) => ctx.fillText(line, tx, y + i * u * .026 * 1.4));
  y += detailH + u * .038;
  if (quoteH) {
    const qx = wide ? tx : tx - quoteW / 2;
    ctx.fillStyle = 'rgba(12,26,24,.94)';
    roundRect(ctx, qx, y, quoteW, quoteH, u * .022);
    ctx.fill();
    ctx.strokeStyle = '#00D4AA55';
    ctx.lineWidth = Math.max(1, u * .0015);
    ctx.stroke();
    ctx.fillStyle = '#EDEDED';
    ctx.font = 'italic ' + u * .027 + 'px ' + INTER;
    quoteLines.forEach((line, i) => ctx.fillText(line, wide ? tx + u * .03 : tx, y + u * .022 + i * u * .027 * 1.4));
  }
  // A separate bottom band, as in S2; long quotes cannot cover the card backs.
  ctx.font = '600 ' + u * .019 + 'px ' + OSWALD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#6B6B6B';
  const markW = trackedWidth(ctx, model.mark, u * .019 * .2),
    markX = w - u * .055 - markW,
    footY = h - u * .053;
  fillTracked(ctx, model.mark, markX, footY, u * .019 * .2);
  const bw = u * .062,
    bh = u * .087,
    bx = markX - u * .02 - bw * 1.52;
  for (let n = 0; n < 2; n++) {
    ctx.save();
    ctx.translate(bx + n * (bw - u * .03) + bw / 2, h - u * .045 - bh / 2);
    ctx.rotate((n ? 7 : -7) * Math.PI / 180);
    const gradient = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
    gradient.addColorStop(0, '#123C36');
    gradient.addColorStop(1, '#08211E');
    ctx.fillStyle = gradient;
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, u * .005);
    ctx.fill();
    ctx.strokeStyle = '#00D4AA59';
    ctx.lineWidth = Math.max(1, u * .0013);
    ctx.stroke();
    roundRect(ctx, -bw * .41, -bh * .41, bw * .82, bh * .82, 2);
    ctx.strokeStyle = '#00D4AA2E';
    ctx.stroke();
    ctx.font = u * .02 + 'px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00D4AA47';
    ctx.fillText('♠', 0, 0);
    ctx.restore();
  }
}
const GHOST_TIMEOUT_MS = 1500;
export function svgNodeToImage(node) {
  if (!node || typeof XMLSerializer === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  let markup;
  try {
    const expanded = node.cloneNode(true);
    // Raised fists extend beyond the body viewBox. Preserve them in both outputs.
    const size = Number(node.getAttribute('width')) || 80;
    expanded.setAttribute('viewBox', '-80 -80 240 240');
    expanded.setAttribute('width', size * 3);
    expanded.setAttribute('height', size * 3);
    markup = new XMLSerializer().serializeToString(expanded);
  } catch {
    return Promise.resolve(null);
  }
  if (!markup.includes('xmlns=')) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return new Promise(resolve => {
    // A face that never arrives must not hold the share button open forever:
    // an <img> that neither loads nor errors is a real state (a webview with
    // images turned off, a data URL the parser gave up on), and the card is
    // still worth sending without it.
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    };
    const timer = setTimeout(() => finish(null), GHOST_TIMEOUT_MS);
    const img = new Image();
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}
export async function paintShareCanvas(canvas, model, {
  format = 'story',
  ghostNode = null
} = {}) {
  const {
    width,
    height
  } = shareDimensions(format);
  canvas.width = width;
  canvas.height = height;
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return false;
  }
  if (!ctx) return false;
  try {
    // Canvas-only text does not initiate webfont loading like DOM text does.
    await Promise.all(["400 32px 'Rozha One'", "600 24px 'Oswald'", "400 24px 'Inter'", "italic 400 24px 'Inter'"].map(font => document.fonts?.load(font)));
    await document.fonts?.ready;
  } catch {/* use available fonts */}
  const ghost = await svgNodeToImage(ghostNode);
  drawShareCard(ctx, model, {
    format,
    ghost
  });
  return true;
}
export async function renderSharePng(model, options = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!(await paintShareCanvas(canvas, model, options))) return null;
  return new Promise(resolve => {
    try {
      if (typeof canvas.toBlob !== 'function') return resolve(null);
      canvas.toBlob(blob => resolve(blob ?? null), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
