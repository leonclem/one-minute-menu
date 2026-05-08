import { getThemePresetByPaletteId, isThemePresetAvailable } from '../theme-presets-v2'

describe('V2 theme presets', () => {
  it('should expose the neon-blue preset at any time (no date gate)', () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    expect(isThemePresetAvailable('galactic-menu', now)).toBe(true)
    const preset = getThemePresetByPaletteId('galactic-menu', now)
    expect(preset).toBeTruthy()
    expect(preset?.paletteId).toBe('galactic-menu')
    expect(preset?.tagline).toBe('A bold neon blue palette with dark space tones')
    expect(preset?.lockedSelection.showBanner).toBe(true)
    expect(preset?.lockedSelection.bannerTitle).toBeUndefined()
  })

  it('should still expose the neon-blue preset well into the future', () => {
    const future = new Date('2030-01-01T00:00:00.000Z')
    expect(isThemePresetAvailable('galactic-menu', future)).toBe(true)
    expect(getThemePresetByPaletteId('galactic-menu', future)).toBeTruthy()
  })

  it('should default the font style preset to future', () => {
    const preset = getThemePresetByPaletteId('galactic-menu')
    expect(preset?.lockedSelection.fontStylePreset).toBe('future')
  })

  it('should not include orbit-map in allowed spacer patterns', () => {
    const preset = getThemePresetByPaletteId('galactic-menu')
    expect(preset?.allowedSpacerTilePatternIds).not.toContain('orbit-map')
  })
})
