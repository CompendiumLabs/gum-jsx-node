# `@gum-jsx/node`

The node runtime for gum.jsx: PNG rasterization via node-canvas, kitty terminal image output,
ANSI styling and stdin. A pure library depending on `@gum-jsx/core` (linked locally while
unpublished: `bun link` in `../gum.jsx`, then `"@gum-jsx/core": "link:@gum-jsx/core"` here; the
peer dependency is marked optional so `bun install` does not look on npm). The CLIs that use it
(`gum`, `gum-down`, `gum-tex`) live in core and `@gum-jsx/math` for now and will move to the
batteries-included `gum-jsx` package.

## Layout

- `src/index.ts` - Package entry, re-exports render and term
- `src/render.ts` - `rasterizeSvg` (PNG `Buffer`) and `rasterizePixels` (`ImageData`) with node-canvas. Fonts: `registerCanvasFonts` hands core's font registry (`FONT_PATHS` from `@gum-jsx/core/fonts`) to node-canvas lazily at the first draw, tracking what it has registered, so faces registered after this module is imported (the KaTeX faces from `@gum-jsx/math`, a host's own via `registerFont`) are still found. Bold and italic faces that are not their own family (`FONT_FACES`) are registered by their file's registry name; fontconfig matches them by the base family plus weight/style that `Span` emits
- `src/term.ts` - `ansi`, the kitty graphics protocol (`formatImage` for PNG, `formatPixels` for raw RGBA), `readStdin`
- `scripts/bench.ts` - Render benchmark (`bun scripts/bench.ts`): evaluate, svg, png and pixel paths at several sizes, on inline cases plus core's `docs/code/Plot.jsx` (found through core's `./docs/*` export)

## Commands

```bash
bun tsc --noEmit      # typecheck (follows the link into core's sources)
bun scripts/bench.ts  # render benchmark; --help for options
```

There is no test suite of its own: core's `scripts/test.ts` and the `gum` CLI's PNG/kitty output
exercise it (`echo '<Circle />' | bun scripts/gum.ts -o out.png` in `../gum.jsx`).
