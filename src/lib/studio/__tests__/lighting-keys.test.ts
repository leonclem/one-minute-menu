import {
  DEFAULT_STUDIO_LIGHTING_KEY,
  fohLightingLabel,
  normalizeLightingKey,
} from '../lighting-keys'

describe('lighting-keys', () => {
  it('maps legacy v1 keys to v2 replacements', () => {
    expect(normalizeLightingKey('studio')).toBe('bright-clean')
    expect(normalizeLightingKey('bright-and-airy')).toBe('soft-natural')
    expect(normalizeLightingKey('low-key')).toBe('dark-moody')
    expect(normalizeLightingKey('golden-hour')).toBe('golden-hour')
  })

  it('defaults empty keys to bright-clean', () => {
    expect(normalizeLightingKey('')).toBe(DEFAULT_STUDIO_LIGHTING_KEY)
  })

  it('passes through custom admin style keys', () => {
    expect(normalizeLightingKey('soft-natural-window')).toBe('soft-natural-window')
  })

  it('returns FOH labels for current and legacy keys', () => {
    expect(fohLightingLabel('bright-clean')).toBe('Bright & Clean')
    expect(fohLightingLabel('studio')).toBe('Bright & Clean')
    expect(fohLightingLabel('low-key')).toBe('Dark & Moody')
  })

  it('passes through prototype-polluting keys as ordinary strings', () => {
    expect(normalizeLightingKey('__proto__')).toBe('__proto__')
    expect(normalizeLightingKey('constructor')).toBe('constructor')
    expect(fohLightingLabel('__proto__')).toBe('__proto__')
    expect(fohLightingLabel('constructor', 'Custom')).toBe('Custom')
  })
})
