/**
 * Export preset credit-decision coverage.
 *
 * These thresholds decide whether a user is charged. A change to `maxCropLoss`
 * that starts billing for a plain resize is a trust problem, not just a bug, so
 * the free/charged boundary is pinned here per format.
 */

import {
  CUTOUT_CANVAS_PADDING_RATIO,
  EXPORT_PRESETS,
  buildExportFilename,
  centreCropKeptFraction,
  formatExportCreditLabel,
  formatExportDimensions,
  getExportPreset,
  isStudioExportVariantType,
  resolveExportGenerationMethod,
  type StudioExportGenerationMethod,
  type StudioExportVariantType,
} from '@/lib/studio/export-presets'

const RESIZABLE = EXPORT_PRESETS.filter((preset) => preset.baseMethod !== 'cutout')

/** Method chosen for every format against one hero shape. */
function decide(
  width: number,
  height: number,
  aiExpandEnabled = true,
): Record<StudioExportVariantType, StudioExportGenerationMethod> {
  return Object.fromEntries(
    EXPORT_PRESETS.map((preset) => [
      preset.key,
      resolveExportGenerationMethod(preset, { width, height }, { aiExpandEnabled }),
    ]),
  ) as Record<StudioExportVariantType, StudioExportGenerationMethod>
}

describe('centreCropKeptFraction', () => {
  it('keeps everything when the aspect ratios match', () => {
    expect(centreCropKeptFraction(1, 1)).toBe(1)
    expect(centreCropKeptFraction(16 / 9, 16 / 9)).toBe(1)
  })

  it('is symmetric: cropping 1:1 to 16:9 costs the same as the reverse', () => {
    expect(centreCropKeptFraction(1, 16 / 9)).toBeCloseTo(0.5625, 4)
    expect(centreCropKeptFraction(16 / 9, 1)).toBeCloseTo(0.5625, 4)
  })

  it('treats unusable dimensions as lossless rather than charging on a guess', () => {
    expect(centreCropKeptFraction(0, 1)).toBe(1)
    expect(centreCropKeptFraction(1, -1)).toBe(1)
    expect(centreCropKeptFraction(Number.NaN, 1)).toBe(1)
    expect(centreCropKeptFraction(1, Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('resolveExportGenerationMethod', () => {
  it('charges only the formats a square hero cannot satisfy by cropping', () => {
    // 2K square is the common Studio generation output.
    expect(decide(2048, 2048)).toEqual({
      delivery_square: 'crop_resize',
      pdf_menu_tile: 'crop_resize',
      instagram_feed: 'ai_expand',
      delivery_landscape: 'ai_expand',
      transparent_cutout: 'cutout',
    })
  })

  it('keeps square exports free from 4:3 and 3:4 heroes', () => {
    expect(decide(1600, 1200).delivery_square).toBe('crop_resize')
    expect(decide(1200, 1600).delivery_square).toBe('crop_resize')
  })

  it('makes the landscape export free once the hero is already landscape', () => {
    expect(decide(1920, 1080).delivery_landscape).toBe('crop_resize')
    expect(decide(3000, 2000).delivery_landscape).toBe('crop_resize')
  })

  it('makes the social export free once the hero is already portrait', () => {
    expect(decide(1080, 1350).instagram_feed).toBe('crop_resize')
    expect(decide(1200, 1600).instagram_feed).toBe('crop_resize')
  })

  it('never charges for the PDF menu tile, whatever the hero shape', () => {
    for (const [w, h] of [
      [2048, 2048],
      [1920, 1080],
      [1080, 1920],
      [4000, 1000],
    ]) {
      expect(decide(w, h).pdf_menu_tile).toBe('crop_resize')
    }
  })

  it('always routes the cut-out through the cut-out pipeline', () => {
    for (const [w, h] of [
      [2048, 2048],
      [1920, 1080],
    ]) {
      expect(decide(w, h).transparent_cutout).toBe('cutout')
      // Even with AI expansion switched off.
      expect(decide(w, h, false).transparent_cutout).toBe('cutout')
    }
  })

  it('falls back to a free resize when AI expansion is disabled', () => {
    for (const preset of RESIZABLE) {
      expect(
        resolveExportGenerationMethod(
          preset,
          { width: 2048, height: 2048 },
          { aiExpandEnabled: false },
        ),
      ).toBe('crop_resize')
    }
  })

  it('falls back to a free resize when hero dimensions are unknown', () => {
    for (const preset of RESIZABLE) {
      expect(resolveExportGenerationMethod(preset, null, { aiExpandEnabled: true })).toBe(
        'crop_resize',
      )
      expect(
        resolveExportGenerationMethod(
          preset,
          { width: 0, height: 0 },
          { aiExpandEnabled: true },
        ),
      ).toBe('crop_resize')
    }
  })

  it('escalates exactly at each preset threshold, not near it', () => {
    for (const preset of RESIZABLE.filter((p) => p.expandMethod)) {
      const target = preset.width / preset.height
      // Squeeze the hero until the kept fraction sits either side of the limit.
      const justInside = target / (1 - preset.maxCropLoss + 0.01)
      const justOutside = target / (1 - preset.maxCropLoss - 0.01)

      expect(
        resolveExportGenerationMethod(preset, { width: justInside * 1000, height: 1000 }),
      ).toBe('crop_resize')
      expect(
        resolveExportGenerationMethod(preset, { width: justOutside * 1000, height: 1000 }),
      ).toBe(preset.expandMethod)
    }
  })
})

describe('export preset configuration', () => {
  it('declares a consistent aspect ratio for every preset', () => {
    for (const preset of EXPORT_PRESETS) {
      const [w, h] = preset.aspectRatio.split(':').map(Number)
      expect(preset.width / preset.height).toBeCloseTo(w / h, 2)
    }
  })

  it('only requests aspect ratios the image model accepts', () => {
    const accepted = ['1:1', '16:9', '9:16', '4:3', '3:4']
    for (const preset of EXPORT_PRESETS) {
      if (preset.requestAspectRatio) {
        expect(accepted).toContain(preset.requestAspectRatio)
      }
    }
  })

  it('gives every AI-capable preset a requestable aspect ratio', () => {
    for (const preset of EXPORT_PRESETS.filter((p) => p.expandMethod)) {
      expect(preset.requestAspectRatio).toBeDefined()
    }
  })

  it('uses unique keys and resolves each one', () => {
    const keys = EXPORT_PRESETS.map((preset) => preset.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(getExportPreset(key)?.key).toBe(key)
      expect(isStudioExportVariantType(key)).toBe(true)
    }
  })

  it('rejects unknown variant types', () => {
    expect(isStudioExportVariantType('story_reel_cover')).toBe(false)
    expect(isStudioExportVariantType('')).toBe(false)
    expect(isStudioExportVariantType(null)).toBe(false)
    expect(getExportPreset('nope')).toBeNull()
  })

  it('leaves the cut-out room to breathe on its canvas', () => {
    expect(CUTOUT_CANVAS_PADDING_RATIO).toBeGreaterThan(0)
    expect(CUTOUT_CANVAS_PADDING_RATIO).toBeLessThan(0.25)
  })
})

describe('display helpers', () => {
  it('labels free exports as included and priced ones by credit count', () => {
    expect(formatExportCreditLabel(0)).toBe('included')
    expect(formatExportCreditLabel(-1)).toBe('included')
    expect(formatExportCreditLabel(1)).toBe('1 credit')
    expect(formatExportCreditLabel(3)).toBe('3 credits')
  })

  it('formats dimensions for the tile header', () => {
    expect(formatExportDimensions(getExportPreset('delivery_landscape')!)).toBe(
      '1600 × 900 (16:9)',
    )
  })

  it('builds a safe filename from an arbitrary dish name', () => {
    const preset = getExportPreset('delivery_square')!
    expect(buildExportFilename(preset, 'Summer Curry Feature')).toBe(
      'summer-curry-feature-delivery_square-1200x1200.jpg',
    )
    expect(buildExportFilename(preset, '  Crème Brûlée!! ')).toBe(
      'cr-me-br-l-e-delivery_square-1200x1200.jpg',
    )
    expect(buildExportFilename(preset, null)).toBe('delivery_square-1200x1200.jpg')
    expect(buildExportFilename(preset, '///')).toBe('delivery_square-1200x1200.jpg')
  })

  it('keeps filenames bounded for very long dish names', () => {
    const name = buildExportFilename(getExportPreset('pdf_menu_tile')!, 'a'.repeat(200))
    expect(name.length).toBeLessThan(80)
  })
})
