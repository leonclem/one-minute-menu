/**
 * Unit Tests for validateTransform (image-transform API route)
 *
 * Verifies that the validation function correctly accepts valid transforms
 * and rejects values that are out of bounds, missing, or of the wrong type.
 *
 * Bounds enforced by the route:
 *   offsetX / offsetY: [-100, 100]
 *   scale:             [1.0, 2.5]  (cutout mode: [0.4, 2.5])
 *   mode:              one of stretch | cutout | compact-rect | compact-circle | background
 */

import { validateTransform } from '@/lib/image-transform-validator'
import { normalizeImageTransformRecord } from '@/types'

describe('validateTransform', () => {
  // ---------------------------------------------------------------------------
  // Valid inputs
  // ---------------------------------------------------------------------------

  describe('valid transforms', () => {
    it('accepts a zero-offset, unit-scale stretch transform', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.mode).toBe('stretch')
        expect(result.transform).toEqual({ offsetX: 0, offsetY: 0, scale: 1.0 })
      }
    })

    it('accepts non-zero offsets within bounds', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 30, offsetY: -45, scale: 1.5 })
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.transform.offsetX).toBe(30)
        expect(result.transform.offsetY).toBe(-45)
        expect(result.transform.scale).toBe(1.5)
      }
    })

    it('accepts boundary minimum values', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: -100, offsetY: -100, scale: 1.0 })
      expect('error' in result).toBe(false)
    })

    it('accepts boundary maximum values', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 100, offsetY: 100, scale: 2.5 })
      expect('error' in result).toBe(false)
    })

    it('accepts maximum scale of 2.5', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 2.5 })
      expect('error' in result).toBe(false)
    })

    it('accepts all valid modes', () => {
      for (const mode of ['stretch', 'cutout', 'compact-rect', 'compact-circle', 'background']) {
        const result = validateTransform({ mode, offsetX: 0, offsetY: 0, scale: 1.0 })
        expect('error' in result).toBe(false)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Mode validation
  // ---------------------------------------------------------------------------

  describe('mode validation', () => {
    it('rejects missing mode', () => {
      const result = validateTransform({ offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/mode/i)
    })

    it('rejects invalid mode string', () => {
      const result = validateTransform({ mode: 'invalid', offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/mode/i)
    })

    it('rejects numeric mode', () => {
      const result = validateTransform({ mode: 42, offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
    })

    it('rejects "none" as mode', () => {
      const result = validateTransform({ mode: 'none', offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Body structure errors
  // ---------------------------------------------------------------------------

  describe('body structure validation', () => {
    it('rejects null body', () => {
      const result = validateTransform(null)
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/object/i)
    })

    it('rejects non-object body (string)', () => {
      const result = validateTransform('bad-input')
      expect('error' in result).toBe(true)
    })

    it('rejects array body', () => {
      const result = validateTransform([0, 0, 1])
      expect('error' in result).toBe(true)
    })

    it('rejects body with missing offsetX', () => {
      const result = validateTransform({ mode: 'stretch', offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetX/i)
    })

    it('rejects body with missing offsetY', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetY/i)
    })

    it('rejects body with missing scale', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/scale/i)
    })

    it('rejects string offsetX', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: '10', offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
    })

    it('rejects null scale', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: null })
      expect('error' in result).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Non-finite values
  // ---------------------------------------------------------------------------

  describe('non-finite value rejection', () => {
    it('rejects Infinity for offsetX', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: Infinity, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/finite/i)
    })

    it('rejects -Infinity for offsetY', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: -Infinity, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/finite/i)
    })

    it('rejects NaN for scale', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: NaN })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/finite/i)
    })
  })

  // ---------------------------------------------------------------------------
  // Bounds clamping: offsetX
  // ---------------------------------------------------------------------------

  describe('offsetX bounds [-100, 100]', () => {
    it('rejects offsetX below -100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: -101, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetX/i)
    })

    it('rejects offsetX above 100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 101, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetX/i)
    })

    it('accepts offsetX at exactly -100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: -100, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(false)
    })

    it('accepts offsetX at exactly 100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 100, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Bounds clamping: offsetY
  // ---------------------------------------------------------------------------

  describe('offsetY bounds [-100, 100]', () => {
    it('rejects offsetY below -100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: -101, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetY/i)
    })

    it('rejects offsetY above 100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 101, scale: 1.0 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/offsetY/i)
    })

    it('accepts offsetY at exactly -100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: -100, scale: 1.0 })
      expect('error' in result).toBe(false)
    })

    it('accepts offsetY at exactly 100', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 100, scale: 1.0 })
      expect('error' in result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Bounds clamping: scale (per-mode)
  // ---------------------------------------------------------------------------

  describe('scale bounds — non-cutout modes [1.0, 2.5]', () => {
    it('rejects scale below 1.0 for stretch', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 0.9 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/scale/i)
    })

    it('rejects scale of 0 for compact-rect', () => {
      const result = validateTransform({ mode: 'compact-rect', offsetX: 0, offsetY: 0, scale: 0 })
      expect('error' in result).toBe(true)
    })

    it('rejects negative scale for background', () => {
      const result = validateTransform({ mode: 'background', offsetX: 0, offsetY: 0, scale: -1.0 })
      expect('error' in result).toBe(true)
    })

    it('rejects scale above 2.5', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 2.51 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/scale/i)
    })

    it('accepts scale at exactly 1.0', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 1.0 })
      expect('error' in result).toBe(false)
    })

    it('accepts scale at exactly 2.5', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 2.5 })
      expect('error' in result).toBe(false)
    })

    it('accepts intermediate scale values', () => {
      const result = validateTransform({ mode: 'stretch', offsetX: 0, offsetY: 0, scale: 1.75 })
      expect('error' in result).toBe(false)
    })
  })

  describe('scale bounds — cutout mode [0.4, 2.5]', () => {
    it('accepts scale at 0.4 for cutout', () => {
      const result = validateTransform({ mode: 'cutout', offsetX: 0, offsetY: 0, scale: 0.4 })
      expect('error' in result).toBe(false)
    })

    it('accepts scale at 0.7 for cutout', () => {
      const result = validateTransform({ mode: 'cutout', offsetX: 0, offsetY: 0, scale: 0.7 })
      expect('error' in result).toBe(false)
    })

    it('rejects scale below 0.4 for cutout', () => {
      const result = validateTransform({ mode: 'cutout', offsetX: 0, offsetY: 0, scale: 0.3 })
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toMatch(/scale/i)
    })

    it('rejects scale above 2.5 for cutout', () => {
      const result = validateTransform({ mode: 'cutout', offsetX: 0, offsetY: 0, scale: 2.6 })
      expect('error' in result).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// normalizeImageTransformRecord backward compatibility
// ---------------------------------------------------------------------------

describe('normalizeImageTransformRecord', () => {
  it('returns undefined for null/undefined', () => {
    expect(normalizeImageTransformRecord(null)).toBeUndefined()
    expect(normalizeImageTransformRecord(undefined)).toBeUndefined()
  })

  it('returns undefined for non-object (string)', () => {
    expect(normalizeImageTransformRecord('bad')).toBeUndefined()
  })

  it('converts old flat format to stretch-keyed record', () => {
    const old = { offsetX: 10, offsetY: -5, scale: 1.5 }
    const result = normalizeImageTransformRecord(old)
    expect(result).toEqual({ stretch: { offsetX: 10, offsetY: -5, scale: 1.5 } })
  })

  it('passes through new per-mode record format unchanged', () => {
    const record = {
      stretch: { offsetX: 0, offsetY: 0, scale: 1.0 },
      cutout: { offsetX: 5, offsetY: 5, scale: 0.8 },
    }
    const result = normalizeImageTransformRecord(record)
    expect(result).toEqual(record)
  })

  it('returns undefined for number input', () => {
    expect(normalizeImageTransformRecord(42)).toBeUndefined()
  })
})
