// @gum-jsx/node: the node runtime for gum.jsx
//
// Rasterizes gum's SVG output to PNG with node-canvas (registering the core
// font registry with it), formats images for kitty-protocol terminals, and
// reads stdin. Browser hosts do not need any of this: they inline the SVG.

export { rasterizeSvg, rasterizePixels } from './render'
export type { RasterizeArgs } from './render'
export { ansi, formatImage, formatPixels, formatPlaceholder, pngSize, queryCellSize, readStdin, ANSI_LO, ANSI_HI } from './term'
export type { Color, FormatImageArgs } from './term'
