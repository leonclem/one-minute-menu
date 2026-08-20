import {
  DEFAULT_STUDIO_BACKDROP_KEY,
  fohBackdropLabel,
  normalizeBackdropKey,
} from '../backdrop-keys'

describe('backdrop-keys', () => {
  it('maps legacy v1 backdrop keys to v2 replacements', () => {
    expect(normalizeBackdropKey('studio-grey-white')).toBe('soft-neutral')
    expect(normalizeBackdropKey('studio-yellow')).toBe('warm-sand')
    expect(normalizeBackdropKey('studio-red')).toBe('terracotta')
    expect(normalizeBackdropKey('studio-nightsky')).toBe('deep-navy')
  })

  it('keeps empty values empty and passes through custom keys', () => {
    expect(normalizeBackdropKey('')).toBe('')
    expect(normalizeBackdropKey('custom-admin-backdrop')).toBe('custom-admin-backdrop')
  })

  it('exports the expected default key', () => {
    expect(DEFAULT_STUDIO_BACKDROP_KEY).toBe('soft-neutral')
  })

  it('returns FOH labels for current and legacy keys', () => {
    expect(fohBackdropLabel('charcoal')).toBe('Charcoal')
    expect(fohBackdropLabel('studio-red')).toBe('Terracotta')
  })
})
