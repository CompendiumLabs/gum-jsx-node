// Rasterize SVG to PNG via node-canvas

import { createCanvas, registerFont, Image, type ImageData as CanvasImageData, type Canvas as CanvasType, type CanvasRenderingContext2D as CanvasRenderingContext2DType } from 'canvas'

import type { Size } from '@gum-jsx/core/lib/types'
import { FONT_PATHS } from '@gum-jsx/core/fonts'
import { light, regular, bold } from '@gum-jsx/core/lib/const'
import { fitSize } from '@gum-jsx/core/eval'

// register the gum font registry with node-canvas so SVG <text> resolves
// consistently; done lazily at first draw so fonts registered after this
// module is imported (the math faces, or a host's own) are picked up too
const CANVAS_FONTS: Set<string> = new Set()

function registerCanvasFonts(): void {
  for (const [ family, path ] of Object.entries(FONT_PATHS)) {
    if (CANVAS_FONTS.has(family)) continue
    CANVAS_FONTS.add(family)
    if (typeof path == 'string') {
      registerFont(path, { family })
    } else {
      registerFont(path.light, { family, weight: String(light) })
      registerFont(path.regular, { family, weight: String(regular) })
      registerFont(path.bold, { family, weight: String(bold) })
    }
  }
}

interface RasterizeArgs {
  size?: Size
  background?: string
}

interface RasterizeResult {
  canvas: CanvasType
  ctx: CanvasRenderingContext2DType
}

function drawSvgCanvas(svg: string | Buffer, { size, background }: RasterizeArgs = {}): RasterizeResult {
  registerCanvasFonts()

  // create image object
  const buf = Buffer.isBuffer(svg) ? svg : Buffer.from(svg)
  const img = new Image()
  img.src = buf

  // get image size
  const imgSize: Size = [ img.width, img.height ]
  const [ outW, outH ] = fitSize(imgSize, size)

  // create canvas
  const canvas = createCanvas(outW, outH)
  const ctx = canvas.getContext('2d')

  // fill background
  if (background != null) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, outW, outH)
  }

  // draw image to canvas and return the requested raster representation
  ctx.drawImage(img, 0, 0, outW, outH)

  // return the canvas and context
  return { canvas, ctx }
}

function rasterizeSvg(svg: string | Buffer, { size, background }: RasterizeArgs = {}): Buffer {
  const { canvas } = drawSvgCanvas(svg, { size, background })
  return canvas.toBuffer('image/png')
}

function rasterizePixels(svg: string | Buffer, { size, background }: RasterizeArgs = {}): CanvasImageData {
  const { canvas, ctx } = drawSvgCanvas(svg, { size, background })
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

//
// exports
//

export { rasterizeSvg, rasterizePixels }
export type { RasterizeArgs }
