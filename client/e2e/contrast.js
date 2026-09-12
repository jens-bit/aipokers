// Read the rendered colors, not token names. Canvas resolves rgb(), color(srgb)
// and color-mix's computed output consistently. For text over the felt, use the
// least favorable contrast across its real gradient, after compositing every
// translucent pill/ancestor above it. This is a conservative bound rather than
// an assumed white background or a comparison between two CSS variables.
export async function contrastOf(locator) {
  return locator.evaluate(element => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = css => {
      if (!CSS.supports('color', css)) throw new Error(`Unsupported computed color: ${css}`);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((value, i) => i === 3 ? value / 255 : value);
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [0, 1, 2].map(i => alpha ? (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0).concat(alpha);
    };
    const luminance = color => color.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const layers = [];
    let bases = null;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) !== 1) throw new Error(`Contrast requires settled, opaque text ancestors: ${node.className}`);
      const background = rgba(style.backgroundColor);
      if (style.backgroundImage !== 'none') {
        // Current WATCH uses one opaque radial felt, not photographs or layered
        // imagery. Fail explicitly if that contract changes; do not skip it.
        if (!node.matches('.watch-felt') || !style.backgroundImage.startsWith('radial-gradient(')) {
          throw new Error(`Unmeasured background image on ${node.className}: ${style.backgroundImage}`);
        }
        const stops = style.backgroundImage.match(/(?:rgba?|color)\([^)]*\)/g)?.map(rgba) ?? [];
        if (stops.length < 2 || stops.some(color => color[3] !== 1)) throw new Error('Expected opaque computed felt gradient stops.');
        bases = stops.flatMap((start, i) => {
          const end = stops[i + 1] ?? start;
          return Array.from({ length: 33 }, (_, step) => start.map((value, channel) => value + (end[channel] - value) * step / 32));
        });
        break;
      }
      layers.push(background);
      if (background[3] === 1) { bases = [[0, 0, 0, 1]]; break; }
    }
    if (!bases) throw new Error('No measured opaque background behind label.');
    const foreground = rgba(getComputedStyle(element).color);
    const samples = bases.map(base => {
      const background = layers.reduceRight((back, front) => over(front, back), base);
      const ink = over(foreground, background);
      const light = luminance(ink), dark = luminance(background);
      return { contrast: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05), background };
    });
    const worst = samples.reduce((a, b) => a.contrast < b.contrast ? a : b);
    return { text: element.textContent.trim(), foreground, ...worst, backgroundSamples: samples.length };
  });
}
