# `@gum-jsx/node`

The node runtime for gum.jsx: PNG rasterization via node-canvas, kitty terminal image output,
ANSI styling and stdin. A pure library with `@gum-jsx/core` as a peer dependency (`^1.7.0`,
versioned in lockstep; a peer because it hands core's font registry to node-canvas, so the host
must have exactly one core) and as a `devDependency` for typechecking; in the `gum-org` bun
workspace both resolve to `../gum-jsx-core`. The CLIs that use it (`gum`, `gum-mark`,
`gum-tex`) live in the batteries-included `gum-jsx` package (`../gum-jsx`).

## Layout

- `src/index.ts` - Package entry, re-exports render and term
- `src/render.ts` - `rasterizeSvg` (PNG `Buffer`) and `rasterizePixels` (`ImageData`) with node-canvas. Fonts: `registerCanvasFonts` hands core's font registry (`FONT_PATHS` from `@gum-jsx/core/fonts`) to node-canvas lazily at the first draw, tracking what it has registered, so faces registered after this module is imported (the KaTeX faces from `@gum-jsx/math`, a host's own via `registerFont`) are still found. Bold and italic faces that are not their own family (`FONT_FACES`) are registered by their file's registry name; fontconfig matches them by the base family plus weight/style that `Span` emits
- `src/term.ts` - `ansi`, the kitty graphics protocol (`formatImage` for PNG, `formatPixels` for raw RGBA), `readStdin`
- `scripts/bench.ts` - Render benchmark (`bun scripts/bench.ts`): evaluate, svg, png and pixel paths at several sizes, on inline cases plus `docs/code/Plot.jsx` from `@gum-jsx/docs` (a dev dependency, which locates its own examples)

## Commands

```bash
bun tsc --noEmit      # typecheck (follows the workspace symlink into core's sources)
bun scripts/bench.ts  # render benchmark; --help for options
```

There is no test suite of its own: the `gum-jsx` suite (`scripts/test.ts` in `../gum-jsx`) and the
`gum` CLI's PNG/kitty output exercise it (`echo '<Circle />' | bun scripts/gum.ts -o out.png` in
`../gum-jsx`).
