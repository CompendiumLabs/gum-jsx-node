// ansi terminal output

type Color = keyof typeof ANSI_HI | number

interface FormatImageArgs {
  imageId?: number | null
  placementId?: number | null
  chunkSize?: number
  columns?: number
  rows?: number
  cursorMovement?: boolean
}

// ANSI color codes
const ANSI_LO: Record<string, number> = { gray: 0, red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6, white: 7 }
const ANSI_HI: Record<string, number> = { gray: 8, red: 9, green: 10, yellow: 11, blue: 12, magenta: 13, cyan: 14, white: 15 }

function color(name: Color): number {
  return typeof name === 'string' ? ANSI_HI[name] : name
}

function ansi(text: string, { fg = null, bg = null, bold = false, italic = false }: { fg?: Color | null, bg?: Color | null, bold?: boolean, italic?: boolean } = {}): string {
  const pre_fg = fg != null ? `\x1b[38;5;${color(fg)}m` : ''
  const pre_bg = bg != null ? `\x1b[48;5;${color(bg)}m` : ''
  const pre_bold = bold ? '\x1b[1m' : ''
  const pre_italic = italic ? '\x1b[3m' : ''
  const post_reset = '\x1b[0m'
  return `${pre_bold}${pre_italic}${pre_fg}${pre_bg}${text}${post_reset}`
}

// kitty image protocol
function formatData(
  data: Buffer | string,
  {
    format,
    width,
    height,
    imageId = null,
    placementId = null,
    chunkSize = 4096,
    columns,
    rows,
    cursorMovement = true
  }: FormatImageArgs & { format: number, width?: number, height?: number }
): string {
  const base64 = typeof data === 'string' ? data : data.toString('base64')
  const head = [ `f=${format}`, 'a=T', 'q=1' ]

  if (width != null) head.push(`s=${width}`)
  if (height != null) head.push(`v=${height}`)
  if (imageId != null) head.push(`i=${imageId}`)
  if (placementId != null) head.push(`p=${placementId}`)
  if (columns != null) head.push(`c=${columns}`)
  if (rows != null) head.push(`r=${rows}`)
  if (!cursorMovement) head.push('C=1')

  let result = ''
  for (let i = 0; i < base64.length; i += chunkSize) {
    const chunk = base64.slice(i, i + chunkSize)
    const isFirst = i === 0
    const isLast = i + chunkSize >= base64.length
    const control = isFirst
      ? [ ...head, `m=${isLast ? 0 : 1}` ].join(',')
      : `m=${isLast ? 0 : 1}`

    result += `\x1b_G${control};${chunk}\x1b\\`
  }

  return result
}

function formatImage(png: Buffer | string, args: FormatImageArgs = {}): string {
  return formatData(png, { ...args, format: 100 })
}

function formatPixels(
  pixels: Buffer | string,
  size: [number, number],
  args: FormatImageArgs = {}
): string {
  const [ width, height ] = size
  return formatData(pixels, { ...args, format: 32, width, height })
}

// read from stdin
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export type { Color, FormatImageArgs }
export { ANSI_LO, ANSI_HI, ansi, formatImage, formatPixels, readStdin }
