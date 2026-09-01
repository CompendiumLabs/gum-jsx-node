// ansi terminal output

import { openSync, closeSync, readSync, writeSync } from 'fs'
import { execSync } from 'child_process'

type Color = keyof typeof ANSI_HI | number

interface FormatImageArgs {
  imageId?: number | null
  placementId?: number | null
  chunkSize?: number
  columns?: number
  rows?: number
  cursorMovement?: boolean
  virtual?: boolean
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
    cursorMovement = true,
    virtual = false
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
  if (virtual) head.push('U=1')

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

// unicode placeholders (kitty): a virtual placement (U=1 on the transmission) is drawn
// wherever placeholder cells appear on screen, so images survive pagers and multiplexers
// that redraw the screen. Each cell is U+10EEEE carrying the image id in its foreground
// color and its row/column in the placement grid as combining diacritics (kitty's
// rowcolumn-diacritics table, which also caps a placement at 297 rows/columns)

const PLACEHOLDER = '\u{10EEEE}'

const ROWCOL_DIACRITICS = [
  0x0305, 0x030D, 0x030E, 0x0310, 0x0312, 0x033D, 0x033E, 0x033F, 0x0346, 0x034A, 0x034B, 0x034C,
  0x0350, 0x0351, 0x0352, 0x0357, 0x035B, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F, 0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592,
  0x0593, 0x0594, 0x0595, 0x0597, 0x0598, 0x0599, 0x059C, 0x059D, 0x059E, 0x059F, 0x05A0, 0x05A1,
  0x05A8, 0x05A9, 0x05AB, 0x05AC, 0x05AF, 0x05C4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
  0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065A, 0x065B, 0x065D, 0x065E, 0x06D6, 0x06D7, 0x06D8,
  0x06D9, 0x06DA, 0x06DB, 0x06DC, 0x06DF, 0x06E0, 0x06E1, 0x06E2, 0x06E4, 0x06E7, 0x06E8, 0x06EB,
  0x06EC, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736, 0x073A, 0x073D, 0x073F, 0x0740, 0x0741, 0x0743,
  0x0745, 0x0747, 0x0749, 0x074A, 0x07EB, 0x07EC, 0x07ED, 0x07EE, 0x07EF, 0x07F0, 0x07F1, 0x07F3,
  0x0816, 0x0817, 0x0818, 0x0819, 0x081B, 0x081C, 0x081D, 0x081E, 0x081F, 0x0820, 0x0821, 0x0822,
  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082A, 0x082B, 0x082C, 0x082D, 0x0951, 0x0953, 0x0954,
  0x0F82, 0x0F83, 0x0F86, 0x0F87, 0x135D, 0x135E, 0x135F, 0x17DD, 0x193A, 0x1A17, 0x1A75, 0x1A76,
  0x1A77, 0x1A78, 0x1A79, 0x1A7A, 0x1A7B, 0x1A7C, 0x1B6B, 0x1B6D, 0x1B6E, 0x1B6F, 0x1B70, 0x1B71,
  0x1B72, 0x1B73, 0x1CD0, 0x1CD1, 0x1CD2, 0x1CDA, 0x1CDB, 0x1CE0, 0x1DC0, 0x1DC1, 0x1DC3, 0x1DC4,
  0x1DC5, 0x1DC6, 0x1DC7, 0x1DC8, 0x1DC9, 0x1DCB, 0x1DCC, 0x1DD1, 0x1DD2, 0x1DD3, 0x1DD4, 0x1DD5,
  0x1DD6, 0x1DD7, 0x1DD8, 0x1DD9, 0x1DDA, 0x1DDB, 0x1DDC, 0x1DDD, 0x1DDE, 0x1DDF, 0x1DE0, 0x1DE1,
  0x1DE2, 0x1DE3, 0x1DE4, 0x1DE5, 0x1DE6, 0x1DFE, 0x20D0, 0x20D1, 0x20D4, 0x20D5, 0x20D6, 0x20D7,
  0x20DB, 0x20DC, 0x20E1, 0x20E7, 0x20E9, 0x20F0, 0x2CEF, 0x2CF0, 0x2CF1, 0x2DE0, 0x2DE1, 0x2DE2,
  0x2DE3, 0x2DE4, 0x2DE5, 0x2DE6, 0x2DE7, 0x2DE8, 0x2DE9, 0x2DEA, 0x2DEB, 0x2DEC, 0x2DED, 0x2DEE,
  0x2DEF, 0x2DF0, 0x2DF1, 0x2DF2, 0x2DF3, 0x2DF4, 0x2DF5, 0x2DF6, 0x2DF7, 0x2DF8, 0x2DF9, 0x2DFA,
  0x2DFB, 0x2DFC, 0x2DFD, 0x2DFE, 0x2DFF, 0xA66F, 0xA67C, 0xA67D, 0xA6F0, 0xA6F1, 0xA8E0, 0xA8E1,
  0xA8E2, 0xA8E3, 0xA8E4, 0xA8E5, 0xA8E6, 0xA8E7, 0xA8E8, 0xA8E9, 0xA8EA, 0xA8EB, 0xA8EC, 0xA8ED,
  0xA8EE, 0xA8EF, 0xA8F0, 0xA8F1, 0xAAB0, 0xAAB2, 0xAAB3, 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1,
  0xFE20, 0xFE21, 0xFE22, 0xFE23, 0xFE24, 0xFE25, 0xFE26, 0x10A0F, 0x10A38, 0x1D185, 0x1D186,
  0x1D187, 0x1D188, 0x1D189, 0x1D1AA, 0x1D1AB, 0x1D1AC, 0x1D1AD, 0x1D242, 0x1D243, 0x1D244,
]

// the low 24 bits of the image id as a colon-form truecolor foreground (what kitten icat
// emits): palette-index colors are avoided since terminals may resolve them to theme rgb
// before the id lookup, and semicolon truecolor can be eaten as separate params
function placeholderColor(imageId: number): string {
  const r = (imageId >> 16) & 0xff, g = (imageId >> 8) & 0xff, b = imageId & 0xff
  return `\x1b[38:2:${r}:${g}:${b}m`
}

// the placeholder text grid for a rows × cols virtual placement, one text line per row;
// each cell carries three diacritics: its row, its column, and the image id's most
// significant byte (always written, like icat, though it is zero for ids under 2^24)
function formatPlaceholder(imageId: number, rows: number, cols: number): string {
  const color = placeholderColor(imageId)
  const idMark = String.fromCodePoint(ROWCOL_DIACRITICS[(imageId >> 24) & 0xff])
  const nrows = Math.min(rows, ROWCOL_DIACRITICS.length)
  const ncols = Math.min(cols, ROWCOL_DIACRITICS.length)
  const lines: string[] = []
  for (let r = 0; r < nrows; r++) {
    let line = color
    const rowMark = String.fromCodePoint(ROWCOL_DIACRITICS[r])
    for (let c = 0; c < ncols; c++) {
      line += PLACEHOLDER + rowMark + String.fromCodePoint(ROWCOL_DIACRITICS[c]) + idMark
    }
    lines.push(line + '\x1b[39m')
  }
  return lines.join('\n')
}

// PNG pixel dimensions from the IHDR header
function pngSize(png: Buffer): [number, number] {
  return [ png.readUInt32BE(16), png.readUInt32BE(20) ]
}

// the terminal's cell size in pixels ([width, height]), via the CSI 16 t query on the
// controlling tty — usable even when stdin/stdout are pipes; null if there is no tty or
// the terminal does not answer (raw mode is set with stty so no stream ever holds the tty)
function queryCellSize(): [number, number] | null {
  let fd: number
  try {
    fd = openSync('/dev/tty', 'r+')
  } catch {
    return null
  }
  try {
    const saved = execSync('stty -g', { stdio: [fd, 'pipe', 'ignore'] }).toString().trim()
    try {
      // min 0 time 5: reads return within half a second even if the terminal stays silent
      execSync('stty raw -echo min 0 time 5', { stdio: [fd, 'ignore', 'ignore'] })
      writeSync(fd, '\x1b[16t')
      const buf = Buffer.alloc(256)
      let resp = ''
      let match: RegExpMatchArray | null = null
      // stray pending input (a late terminal reply, typed-ahead keys) may precede the
      // answer, so read until the answer itself appears, not just any byte
      while ((match = resp.match(/\x1b\[6;(\d+);(\d+)t/)) == null) {
        const n = readSync(fd, buf, 0, buf.length, null)
        if (n === 0) break
        resp += buf.toString('utf8', 0, n)
      }
      return match ? [ Number(match[2]), Number(match[1]) ] : null
    } finally {
      execSync(`stty ${saved}`, { stdio: [fd, 'ignore', 'ignore'] })
    }
  } catch {
    return null
  } finally {
    closeSync(fd)
  }
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
export { ANSI_LO, ANSI_HI, ansi, formatImage, formatPixels, formatPlaceholder, pngSize, queryCellSize, readStdin }
