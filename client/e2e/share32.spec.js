import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const sample = {
  handNumber: 114,
  pot: 620,
  net: 310,
  won: true,
  agentName: 'Granite',
  nature: 'A rock',
  identity: {
    hood: 'moss',
    glow: 'teal'
  },
  holeCards: ['9h', '9c'],
  opponentShowdownCards: [{
    seat: 1,
    holeCards: ['Ah', 'Kc']
  }],
  streets: [{
    street: 'river',
    board: ['2s', '7h', 'Qd', '4c', '3s'],
    reasoning: 'He never folds. So I stopped bluffing him.'
  }]
};
async function mount(page, hand = sample) {
  await page.route('**/api/**', route => route.fulfill({
    json: {
      agents: [],
      flags: {
        guest: false
      }
    }
  }));
  await page.goto('/');
  await page.evaluate(async hand => {
    const {
      default: React
    } = await import('/node_modules/.vite/deps/react.js');
    const {
      default: {
        createRoot
      }
    } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const {
      ShareSheet
    } = await import('/src/components/share/ShareButton.jsx');
    const {
      buildShareModel
    } = await import('/src/components/share/shareModel.js');
    document.body.replaceChildren();
    const el = document.createElement('div');
    document.body.append(el);
    createRoot(el).render(React.createElement(ShareSheet, {
      model: buildShareModel(hand, {
        mood: 'confident'
      }),
      onClose: () => {}
    }));
  }, hand);
  await expect(page.locator('.share-card')).toHaveAttribute('data-status', 'ready');
}
for (const height of [590, 844]) test('S1/S2 preview and PNG at 390x' + height, async ({
  page
}) => {
  await page.setViewportSize({
    width: 390,
    height
  });
  await mount(page);
  for (const [format, width, h] of [['Story', 1080, 1920], ['Link preview', 1200, 630]]) {
    await page.getByRole('button', {
      name: format,
      exact: true
    }).click();
    await expect(page.locator('.share-card')).toHaveAttribute('data-status', 'ready');
    const box = await page.getByRole('button', {
      name: 'Save image'
    }).boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    const canvas = page.locator('.share-card canvas');
    await expect(canvas).toHaveAttribute('width', String(width));
    await expect(canvas).toHaveAttribute('height', String(h));
    const download = page.waitForEvent('download');
    await page.getByRole('button', {
      name: 'Save image'
    }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('railbird-granite-114.png');
    const destination = '../artifacts/share32-' + height + '-' + width + '.png';
    await file.saveAs(destination);
    const actual = fs.readFileSync(destination);
    expect(actual.readUInt32BE(16)).toBe(width);
    expect(actual.readUInt32BE(20)).toBe(h);
    // Same pixels, not merely the same words or aspect ratio.
    const differences = await canvas.evaluate(async (c, encoded) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + encoded;
      await img.decode();
      const other = document.createElement('canvas');
      other.width = c.width;
      other.height = c.height;
      const ctx = other.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        b = ctx.getImageData(0, 0, c.width, c.height).data;
      let diff = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
      return diff;
    }, actual.toString('base64'));
    expect(differences).toBe(0);
    await page.screenshot({
      path: '../artifacts/share32-sheet-' + height + '-' + width + '.png'
    });
  }
});
test('S1/S2 failed canvas and legacy quiet hand remain honest', async ({
  page
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.setViewportSize({
    width: 390,
    height: 590
  });
  await page.route('**/api/**', route => route.fulfill({
    json: {
      agents: [],
      flags: {
        guest: false
      }
    }
  }));
  await page.goto('/');
  await page.evaluate(async () => {
    const {
      default: React
    } = await import('/node_modules/.vite/deps/react.js');
    const {
      default: {
        createRoot
      }
    } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const {
      ShareSheet
    } = await import('/src/components/share/ShareButton.jsx');
    const {
      buildShareModel
    } = await import('/src/components/share/shareModel.js');
    document.body.replaceChildren();
    const el = document.createElement('div');
    document.body.append(el);
    createRoot(el).render(React.createElement(ShareSheet, {
      model: buildShareModel({
        pot: 80,
        won: false
      }),
      onClose: () => {}
    }));
  });
  await expect(page.getByText(/Image preview unavailable/)).toBeVisible();
  await expect(page.locator('.share-card')).toContainText('$80 pot');
  await page.getByRole('button', {
    name: 'Save image'
  }).click();
  await expect(page.getByText(/Nothing shared|Caption copied/)).toBeVisible();
  await page.screenshot({
    path: '../artifacts/share32-unavailable.png'
  });
});
