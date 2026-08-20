import {
  DEFAULT_STUDIO_SURFACE_KEY,
  fohSurfaceLabel,
  normalizeSurfaceKey,
} from '../surface-keys'

describe('surface-keys', () => {
  it('maps legacy v1 surface keys to v2 replacements', () => {
    expect(normalizeSurfaceKey('dark-slate')).toBe('dark-stone')
    expect(normalizeSurfaceKey('rustic-wood')).toBe('natural-oak')
    expect(normalizeSurfaceKey('granite-light')).toBe('terrazzo')
    expect(normalizeSurfaceKey('marble-light')).toBe('white-marble')
    expect(normalizeSurfaceKey('white-tablecloth')).toBe('natural-linen')
  })

  it('keeps empty values empty and passes through custom keys', () => {
    expect(normalizeSurfaceKey('')).toBe('')
    expect(normalizeSurfaceKey('custom-admin-surface')).toBe('custom-admin-surface')
  })

  it('defaults unknown empty-ish values only through explicit default helper usage', () => {
    expect(DEFAULT_STUDIO_SURFACE_KEY).toBe('natural-oak')
  })

  it('returns FOH labels for current and legacy keys', () => {
    expect(fohSurfaceLabel('white-marble')).toBe('White Marble')
    expect(fohSurfaceLabel('marble-light')).toBe('White Marble')
  })
})
