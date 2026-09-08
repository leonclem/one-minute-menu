/**
 * @jest-environment node
 *
 * Isolated Reframe / expand-scene spike.
 *
 * Dry run (default): writes a padded canvas, debug overlay, and HTML report
 * with the exact prompt. Does not call Gemini.
 *
 * Live: set REFRAME_SPIKE_LIVE=1 and REFRAME_SPIKE_IMAGE to a food photo.
 */

import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

import { isExpandLayout, type ExpandLayout } from './canvas'
import { runReframeSpike } from './run'

const LIVE_FLAG = process.env.REFRAME_SPIKE_LIVE
const isLive = LIVE_FLAG === '1' || LIVE_FLAG === 'true'

function parseLayouts(raw: string | undefined, fallback: ExpandLayout[]): ExpandLayout[] {
  if (!raw || raw.trim() === '') return fallback
  const layouts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (layouts.length === 0) return fallback
  for (const layout of layouts) {
    if (!isExpandLayout(layout)) {
      throw new Error(`Unknown layout "${layout}". Use all, right, left, top, or bottom.`)
    }
  }
  return layouts as ExpandLayout[]
}

function parsePositiveNumber(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`)
  }
  return value
}

async function syntheticDish(): Promise<Buffer> {
  const table = await sharp({
    create: { width: 480, height: 360, channels: 3, background: { r: 166, g: 124, b: 82 } },
  })
    .png()
    .toBuffer()

  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">` +
      `<circle cx="240" cy="180" r="110" fill="#f4f1ea" stroke="#d4cfc4" stroke-width="10"/>` +
      `<circle cx="240" cy="180" r="70" fill="#b45309"/>` +
      `</svg>`,
  )

  return sharp(table).composite([{ input: plate, top: 0, left: 0 }]).png().toBuffer()
}

describe('reframe spike runner', () => {
  it('writes a dry-run HTML report with padded images and prompts', async () => {
    const imagePath = process.env.REFRAME_SPIKE_IMAGE
    if (isLive) return

    const sourceBuffer = imagePath ? await readFile(imagePath) : await syntheticDish()
    const sourceLabel = imagePath ?? 'synthetic-dish.png'
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outDir = imagePath
      ? join(process.cwd(), 'scripts', 'studio-reframe-spike', 'artifacts', `dry-${stamp}`)
      : await mkdtemp(join(tmpdir(), 'reframe-spike-'))
    const layouts = parseLayouts(process.env.REFRAME_SPIKE_LAYOUTS, ['all', 'right'])

    const result = await runReframeSpike({
      sourceBuffer,
      sourceLabel,
      outDir,
      live: false,
      layouts,
      padRatio: parsePositiveNumber(process.env.REFRAME_SPIKE_PAD, 0.2, 'REFRAME_SPIKE_PAD'),
      featherPx: parsePositiveNumber(process.env.REFRAME_SPIKE_FEATHER, 8, 'REFRAME_SPIKE_FEATHER'),
      insetRatio: parsePositiveNumber(process.env.REFRAME_SPIKE_INSET, 0.08, 'REFRAME_SPIKE_INSET'),
    })

    const html = await readFile(result.reportPath, 'utf8')
    expect(html).toContain('reducing zoom on a camera phone')
    expect(html).toContain('Keep this image\'s aspect ratio')
    expect(html).toContain('Edit the provided source image while preserving its visual identity')
    expect(html).toContain('Layout: all')
    expect(html).toContain('Requested Gemini aspect')
    // eslint-disable-next-line no-console
    console.log(`\nReframe spike dry-run report:\n${result.reportPath}\n`)
  }, 60_000)

  const liveIt = isLive ? it : it.skip

  liveIt('calls Gemini and writes comparison images', async () => {
    const imagePath = process.env.REFRAME_SPIKE_IMAGE
    if (!imagePath) {
      throw new Error('Set REFRAME_SPIKE_IMAGE to a food photograph before a live run.')
    }
    if (!process.env.NANO_BANANA_API_KEY) {
      throw new Error('NANO_BANANA_API_KEY is missing. Check .env.local.')
    }

    const sourceBuffer = await readFile(imagePath)
    const outDir = join(
      process.cwd(),
      'scripts',
      'studio-reframe-spike',
      'artifacts',
      new Date().toISOString().replace(/[:.]/g, '-'),
    )
    const layouts = parseLayouts(process.env.REFRAME_SPIKE_LAYOUTS, ['all'])

    const result = await runReframeSpike({
      sourceBuffer,
      sourceLabel: imagePath,
      outDir,
      live: true,
      layouts,
      padRatio: parsePositiveNumber(process.env.REFRAME_SPIKE_PAD, 0.2, 'REFRAME_SPIKE_PAD'),
      featherPx: parsePositiveNumber(process.env.REFRAME_SPIKE_FEATHER, 8, 'REFRAME_SPIKE_FEATHER'),
      insetRatio: parsePositiveNumber(process.env.REFRAME_SPIKE_INSET, 0.08, 'REFRAME_SPIKE_INSET'),
    })

    const html = await readFile(result.reportPath, 'utf8')
    expect(html).toContain('Gemini output')
    expect(html).toContain('restored-inner.png')
    // eslint-disable-next-line no-console
    console.log(`\nReframe spike live report:\n${result.reportPath}\n`)
  }, 360_000)
})
