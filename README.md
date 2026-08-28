# @gum-jsx/node

The node runtime for [gum.jsx](https://github.com/CompendiumLabs/gum-jsx): rasterizes the SVG that `@gum-jsx/core` produces to PNG with [node-canvas](https://github.com/Automattic/node-canvas), formats images for kitty-protocol terminals, and reads stdin. Browser hosts do not need this package — they inline the SVG directly.

## Installation

```bash
npm install @gum-jsx/core @gum-jsx/node
```

## Usage

```javascript
import { evaluateGum } from '@gum-jsx/core/eval'
import { rasterizeSvg, rasterizePixels, formatImage } from '@gum-jsx/node'

const svg = evaluateGum('<Circle fill={blue} />', { size: 500 }).svg()
const png = rasterizeSvg(svg, { size: [ 500, 500 ], background: 'white' })   // Buffer
const pixels = rasterizePixels(svg)                                          // ImageData
process.stdout.write(formatImage(png))                                       // show in kitty/ghostty
```

`rasterizeSvg(svg, { size?, background? })` fits the SVG's own size into `size` (a number or `[width, height]`) and returns a PNG `Buffer`; `rasterizePixels` returns the raw `ImageData` instead. `formatImage(png, args)` and `formatPixels(pixels, [w, h], args)` produce kitty graphics protocol escape sequences (`imageId`, `placementId`, `columns`, `rows`, `cursorMovement`, `chunkSize`). `ansi(text, { fg, bg, bold, italic })` styles terminal text and `readStdin()` reads all of stdin.

The fonts registered with core (IBM Plex and whatever add-ons such as `@gum-jsx/math` register) are handed to node-canvas at the first rasterization, so `<text>` in the SVG resolves to the same faces that were measured. Emoji are not bundled: they are measured with a fixed advance and drawn with the system's emoji face (e.g. Noto Color Emoji) via fontconfig fallback.
