// Independent visual audit: imported reference atom versus actual client source.
// Same explicit hood/glow, no ring, native sizes and frozen animation.
// Writes six pairs under client/e2e/shots and details under artifacts; no API/DB/model calls.
// Run from the repository: node scripts/audit-design-sprites.cjs
const {
    chromium
  } = require('../node_modules/@playwright/test'),
  http = require('http'),
  fs = require('fs'),
  path = require('path'),
  esbuild = require('../client/node_modules/esbuild');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts');
fs.mkdirSync(output, {
  recursive: true
});
const groups = {
  tiers: [],
  heat: [],
  sizes: [],
  events: [],
  poses: [],
  brows: []
};
for (const mood of ['confident', 'neutral', 'frustrated', 'tilted', 'sulking']) {
  for (const heat of [16, 50, 88]) groups.tiers.push({
    mood,
    heat,
    size: 62,
    label: mood + ' ' + heat
  });
  for (const heat of [6, 20, 38, 52, 68, 82, 96]) groups.heat.push({
    mood,
    heat,
    size: 46,
    label: mood + ' ' + heat
  });
  for (const size of [46, 38, 34, 24]) groups.sizes.push({
    mood,
    heat: 72,
    size,
    label: mood + ' ' + size + 'px'
  });
}
for (const event of ['stunned', 'smug', 'locked', 'bored', 'wary', 'pleased', 'asleep']) groups.events.push({
  event,
  size: 62,
  label: event
});
for (const size of [96, 34]) for (const hands of ['rest', 'hold', 'peek', 'push', 'toss', 'drum', 'clench', 'cover', 'raise']) groups.poses.push({
  hands,
  size,
  label: hands + ' ' + size + 'px'
});
for (const size of [62, 24]) for (const brow of ['twitch', 'lift', 'knit']) groups.brows.push({
  brow,
  size,
  label: brow + ' ' + size + 'px'
});
const cases = Object.entries(groups).flatMap(([group, cs]) => cs.map(c => ({
  ...c,
  group,
  ring: false,
  hood: {
    id: 'ash',
    top: '#414A51',
    bot: '#252E34'
  },
  glow: '#00D4AA'
})));
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + u);
  if (!file.startsWith(root + path.sep) || !u.startsWith('/design-refs/') && !u.startsWith('/artifacts/') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, {
    'content-type': {
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.html': 'text/html',
      '.png': 'image/png'
    }[path.extname(file)] || 'application/octet-stream'
  });
  fs.createReadStream(file).pipe(res);
});
async function render(page, cases) {
  return page.evaluate(async cases => {
    document.body.replaceChildren();
    const style = document.createElement('style');
    style.textContent = '*{animation:none!important;transition:none!important}body{background:#101817!important;margin:0!important;color:#ccc;font:12px system-ui}';
    document.head.append(style);
    window.auditRoot = document.createElement('div');
    document.body.append(window.auditRoot);
    const React = window.auditReact || window.React,
      DOM = window.auditDOM || window.ReactDOM,
      Ghost = window.auditGhost || window.MoodGhost;
    DOM.createRoot(window.auditRoot).render(React.createElement('div', {}, cases.map((c, i) => React.createElement('div', {
      key: i,
      'data-cell': i
    }, React.createElement(Ghost, c)))));
    for (let n = 0; n < 100 && document.querySelectorAll('[data-cell] > svg').length !== cases.length; n++) await new Promise(r => setTimeout(r, 20));
    return [...document.querySelectorAll('[data-cell] > svg')].map(svg => svg.outerHTML);
  }, cases);
}
(async () => {
  await esbuild.build({
    stdin: {
      contents: "import React from 'react';import * as DOM from 'react-dom/client';import {MoodGhost} from './src/components/system/MoodGhost.jsx';window.auditReact=React;window.auditDOM=DOM;window.auditGhost=MoodGhost;",
      resolveDir: path.join(root, 'client'),
      loader: 'jsx'
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    outfile: path.join(output, 'faces34-bundle.js')
  });
  fs.writeFileSync(path.join(output, 'faces34-actual.html'), '<script src="faces34-bundle.js"></script>');
  await new Promise(r => server.listen(5201, '127.0.0.1', r));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({
      viewport: {
        width: 1500,
        height: 1000
      },
      deviceScaleFactor: 1
    });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.goto('http://127.0.0.1:5201/design-refs/' + encodeURIComponent('Agentic Poker Faces.html'));
    await p.waitForFunction(() => !!window.MoodGhost, {}, {
      timeout: 60000
    });
    const refs = await render(p, cases);
    await p.goto('http://127.0.0.1:5201/artifacts/faces34-actual.html');
    const actual = await render(p, cases);
    if (refs.length !== cases.length || actual.length !== cases.length) throw Error('Missing render: reference ' + refs.length + ' actual ' + actual.length + ' expected ' + cases.length);
    const results = await p.evaluate(async ({
      refs,
      actual,
      cases
    }) => {
      const normal = s => {
        const d = new DOMParser().parseFromString(s, 'image/svg+xml'),
          svg = d.documentElement;
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const size = Number(svg.getAttribute('width'));
        svg.setAttribute('viewBox', '-80 -80 240 240');
        svg.setAttribute('width', size * 3);
        svg.setAttribute('height', size * 3);
        return new XMLSerializer().serializeToString(svg);
      };
      const raster = async s => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(normal(s))));
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 400;
        c.getContext('2d').drawImage(img, 20, 20);
        return c.getContext('2d').getImageData(0, 0, 400, 400).data;
      };
      const rows = [];
      for (let i = 0; i < cases.length; i++) {
        const a = await raster(refs[i]),
          b = await raster(actual[i]);
        let n = 0;
        for (let j = 0; j < a.length; j += 4) if (a[j] !== b[j] || a[j + 1] !== b[j + 1] || a[j + 2] !== b[j + 2] || a[j + 3] !== b[j + 3]) n++;
        rows.push({
          label: cases[i].label,
          group: cases[i].group,
          differentPixels: n
        });
      }
      return rows;
    }, {
      refs,
      actual,
      cases
    });
    fs.writeFileSync(path.join(output, 'faces34-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.filter(r => r.differentPixels), null, 2));
    for (const group of Object.keys(groups)) {
      const ids = cases.map((c, i) => c.group === group ? i : -1).filter(i => i >= 0);
      await p.setContent('<body style="margin:0;padding:16px;background:#101817;color:#ccc;font:12px system-ui"><p>' + group + ' — reference left / actual right in each cell. Same explicit cloth/glow; native sprite sizes.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + ids.map(i => '<div style="border:1px solid #34413e;padding:12px;height:190px"><div>' + cases[i].label + ' · pixel differences ' + results[i].differentPixels + '</div><div style="display:flex;justify-content:space-around;padding-top:30px">' + refs[i] + actual[i] + '</div></div>').join('') + '</div></body>');
      await p.addStyleTag({
        content: '*{animation:none!important;transition:none!important}'
      });
      await p.screenshot({
        path: path.join(root, 'client/e2e/shots/design-batch34-' + group + '.png'),
        fullPage: true
      });
    }
    console.log('Compared ' + cases.length + ' native-size sprites; ' + results.filter(r => r.differentPixels).length + ' differences.');
    if (results.some(r => r.differentPixels)) process.exitCode = 1;
  } finally {
    await b.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
