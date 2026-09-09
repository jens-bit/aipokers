# Railbird brand assets — board 41

The mark is generated from client/src/components/system/RailMark.jsx. Its close, lean, hood, far, icon and optical glyph poses use mood-brand.jsx's geometry. The glyph has larger elliptical eyes, a wider face opening and no rail/fists.

## Exported files

- client/public/brand/favicon.svg, favicon-16.png and favicon-32.png: B5 optical glyph.
- client/public/brand/app-icon.svg, app-192.png and app-512.png: B5b icon on #06322B.
- client/public/brand/apple-touch-icon.png: 180px app icon.
- client/public/brand/bot-avatar.svg and bot-avatar-512.png: B8 circular Telegram artwork.
- client/public/manifest.webmanifest: app metadata and actual PNG sizes.
- client/public/railbird.svg and railbird-cream.svg: the full mark for existing page uses.

Both the app and /welcome link the favicon, manifest and touch icon. Regenerate from the same vector component with:

```powershell
Set-Location C:\Projects\ai-poker
node client/scripts/export-brand.mjs
```

The browser renders SVG directly to the PNG files; there is no image-generation or hand-redrawn raster step. Unit/browser checks validate asset paths and dimensions. Reference pairs are client/e2e/shots/design-batch20-loading-b12.png and design-batch20-brand-assets.png.

## Loading and external application

B12 is shown during the actual unauthenticated entry decision and lazy entry loading, with the chosen line “You don’t play. You raise a player.” No minimum display time is imposed. Reduced motion disables its entrance. The reference only loads Playfair weights 500/600/700; the port explicitly uses 500 so the app's additional 400 weight does not thin the line.

The bot avatar file is ready for BotFather; it has not been applied to Telegram. The reference description is “Railbird · raise a poker player.” The actual working username and public domain remain deployment configuration, not the sample handle in the archive. B13 does not replace the functional empty guest room: Jens explicitly requires the table and first-agent flow. B15's separate peek/look triggers and other remaining brand applications are still tracked in DESIGN_GAP.md.
