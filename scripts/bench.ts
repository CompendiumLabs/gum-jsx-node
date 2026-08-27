#! /usr/bin/env bun

import { basename, join } from 'path'
import { readFileSync } from 'fs'
import { performance } from 'perf_hooks'

import { evaluateGum } from '@gum-jsx/core/eval'
import { docsCodeDir, dataDir } from '@gum-jsx/docs'
import { rasterizePixels, rasterizeSvg } from '../src/render'
import type { Size } from '@gum-jsx/core/lib/types'
import type { ThemeName } from '@gum-jsx/core/lib/theme'

type BenchCase = {
  name: string
  code: string
}

type BenchResult = {
  name: string
  n: number
  mean: number
  median: number
  p90: number
  min: number
  max: number
}

type BenchOptions = {
  iterations: number
  warmup: number
  theme: ThemeName
  background: string
  caseNames: string[]
  sizes: Size[]
}

// the docs examples and the data they load come from @gum-jsx/docs
function loadFile(path: string, encoding: string = 'utf8') {
  const file = join(dataDir, basename(path))
  return encoding == 'bytes'
    ? readFileSync(file)
    : readFileSync(file, encoding as BufferEncoding)
}

const cases: BenchCase[] = [
  {
    name: 'rect',
    code: '<Rect pos={[0.5, 0.5]} size={0.7} fill={blue} />',
  },
  {
    name: 'plot',
    code: `
      <Plot xlim={[0, 2*pi]} ylim={[-1.5, 1.5]} grid margin={0.2} aspect={1.6}>
        <SymLine fy={sin} stroke={blue} stroke-width={2} />
      </Plot>
    `,
  },
  {
    name: 'text',
    code: `
      <TextFrame rounded padding margin>
        <Text>Hello World! You can mix text and other elements together.</Text>
      </TextFrame>
    `,
  },
  {
    name: 'docs/Plot',
    code: readFileSync(join(docsCodeDir, 'Plot.jsx'), 'utf8'),
  },
]

const defaultSizes: Size[] = [
  [ 128, 128 ],
  [ 512, 512 ],
  [ 1024, 1024 ],
]

function usage() {
  console.log(`
Usage: bun run bench:render -- [options]

Options:
  -n, --iterations <n>       Timed iterations per benchmark (default: env N or 100)
  -w, --warmup <n>           Warmup iterations per benchmark (default: env WARMUP or 20)
  -t, --theme <name>         Gum theme (default: env THEME or dark)
  -b, --background <color>   PNG background color (default: env BACKGROUND or white)
  -s, --size <size>          Output size, repeatable. Examples: 512, 512x384
  -c, --case <name>          Benchmark case, repeatable. Available: ${cases.map(c => c.name).join(', ')}
  -h, --help                 Show this help

Examples:
  bun run bench:render -- -n 500 -w 50 -s 512 -c plot
  bun ./scripts/bench-render.ts --iterations 200 --size 128x128 --size 1024x768
`.trim())
}

function readValue(args: string[], index: number, flag: string): [ string, number ] {
  const current = args[index]
  const eq = current.indexOf('=')
  if (eq >= 0) return [ current.slice(eq + 1), index ]

  const value = args[index + 1]
  if (value == null || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`)
  }
  return [ value, index + 1 ]
}

function parseCount(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer: ${value}`)
  }
  return parsed
}

function parseSize(value: string): Size {
  const parts = value.toLowerCase().split('x')
  const width = Number(parts[0])
  const height = Number(parts[1] ?? parts[0])
  if (
    parts.length > 2 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error(`Invalid size: ${value}`)
  }
  return [ Math.round(width), Math.round(height) ]
}

function parseArgs(args: string[]): BenchOptions {
  let iterations = parseCount(process.env.N ?? '100', 'N')
  let warmup = parseCount(process.env.WARMUP ?? '20', 'WARMUP')
  let theme = (process.env.THEME ?? 'dark') as ThemeName
  let background = process.env.BACKGROUND ?? 'white'
  const caseNames: string[] = []
  const sizes: Size[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const flag = arg.split('=')[0]

    if (arg == '-h' || arg == '--help') {
      usage()
      process.exit(0)
    } else if (flag == '-n' || flag == '--iterations') {
      const [ value, next ] = readValue(args, i, flag)
      iterations = parseCount(value, flag)
      i = next
    } else if (flag == '-w' || flag == '--warmup') {
      const [ value, next ] = readValue(args, i, flag)
      warmup = parseCount(value, flag)
      i = next
    } else if (flag == '-t' || flag == '--theme') {
      const [ value, next ] = readValue(args, i, flag)
      theme = value as ThemeName
      i = next
    } else if (flag == '-b' || flag == '--background') {
      const [ value, next ] = readValue(args, i, flag)
      background = value
      i = next
    } else if (flag == '-c' || flag == '--case') {
      const [ value, next ] = readValue(args, i, flag)
      caseNames.push(value)
      i = next
    } else if (flag == '-s' || flag == '--size') {
      const [ value, next ] = readValue(args, i, flag)
      sizes.push(parseSize(value))
      i = next
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return {
    iterations,
    warmup,
    theme,
    background,
    caseNames,
    sizes: sizes.length == 0 ? defaultSizes : sizes,
  }
}

const options = parseArgs(process.argv.slice(2))
const { iterations, warmup, theme, background, sizes } = options
const selectedCases = options.caseNames.length == 0
  ? cases
  : cases.filter(testCase => options.caseNames.includes(testCase.name))

const missingCases = options.caseNames.filter(name => !cases.some(testCase => testCase.name == name))
if (missingCases.length > 0) {
  throw new Error(`Unknown case(s): ${missingCases.join(', ')}`)
}

function time(fn: () => void): number {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function summarize(name: string, samples: number[]): BenchResult {
  const sorted = [ ...samples ].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    name,
    n: sorted.length,
    mean: sum / sorted.length,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length == 0) return NaN
  const i = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  return sorted[i]
}

function bench(name: string, fn: () => void): BenchResult {
  for (let i = 0; i < warmup; i++) fn()

  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    samples.push(time(fn))
  }

  return summarize(name, samples)
}

function printResult(result: BenchResult) {
  const { name, n, mean, median, p90, min, max } = result
  console.log([
    name.padEnd(28),
    `n=${String(n).padStart(4)}`,
    `mean=${mean.toFixed(3).padStart(8)} ms`,
    `med=${median.toFixed(3).padStart(8)} ms`,
    `p90=${p90.toFixed(3).padStart(8)} ms`,
    `min=${min.toFixed(3).padStart(8)} ms`,
    `max=${max.toFixed(3).padStart(8)} ms`,
  ].join('  '))
}

function byteSize(value: string | Buffer): number {
  return Buffer.byteLength(value)
}

console.log(`gum.jsx render benchmark`)
console.log(`iterations=${iterations} warmup=${warmup} theme=${theme} background=${background}`)
console.log(`cases=${selectedCases.map(c => c.name).join(', ')}`)
console.log(`sizes=${sizes.map(size => `${size[0]}x${size[1]}`).join(', ')}`)
console.log()

for (const testCase of selectedCases) {
  console.log(`## ${testCase.name}`)

  for (const size of sizes) {
    const sizeLabel = `${size[0]}x${size[1]}`
    const evalResult = evaluateGum(testCase.code, { size, theme, loadFile })
    const svg = evalResult.svg()
    const png = rasterizeSvg(svg, { size, background })
    const pixels = rasterizePixels(svg, { size, background })

    console.log(`size=${sizeLabel} svg=${byteSize(svg)} bytes png=${byteSize(png)} bytes pixels=${pixels.data.byteLength} bytes`)

    printResult(bench(`${sizeLabel} evaluate`, () => {
      evaluateGum(testCase.code, { size, theme, loadFile })
    }))

    printResult(bench(`${sizeLabel} svg only`, () => {
      evalResult.svg()
    }))

    printResult(bench(`${sizeLabel} jsx->svg`, () => {
      evaluateGum(testCase.code, { size, theme, loadFile }).svg()
    }))

    printResult(bench(`${sizeLabel} svg->png`, () => {
      rasterizeSvg(svg, { size, background })
    }))

    printResult(bench(`${sizeLabel} svg->pixels`, () => {
      rasterizePixels(svg, { size, background })
    }))

    printResult(bench(`${sizeLabel} jsx->png`, () => {
      const elem = evaluateGum(testCase.code, { size, theme, loadFile })
      rasterizeSvg(elem.svg(), { size, background })
    }))

    printResult(bench(`${sizeLabel} jsx->pixels`, () => {
      const elem = evaluateGum(testCase.code, { size, theme, loadFile })
      rasterizePixels(elem.svg(), { size, background })
    }))

    console.log()
  }
}
