import { getThemePresetByPaletteId, isThemePresetAvailable } from '../theme-presets-v2'

describe('V2 theme presets', () => {
  it('should expose the galactic preset during the promo window', () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    expect(isThemePresetAvailable('galactic-menu', now)).toBe(true)
    const preset = getThemePresetByPaletteId('galactic-menu', now)
    expect(preset).toBeTruthy()
    expect(preset?.paletteId).toBe('galactic-menu')
    expect(preset?.tagline).toBe('A menu from another galaxy')
    expect(preset?.lockedSelection.showBanner).toBe(true)
    expect(preset?.lockedSelection.bannerTitle).toBe('Galactic Menu')
  })

  it('should hide the galactic preset after enabledUntil', () => {
    const after = new Date('2026-05-06T00:00:00.000Z')
    expect(isThemePresetAvailable('galactic-menu', after)).toBe(false)
    expect(getThemePresetByPaletteId('galactic-menu', after)).toBeNull()
  })
})

