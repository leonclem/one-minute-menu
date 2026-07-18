/**
 * @jest-environment node
 */

import { parseAndValidateImageDataUrl } from '../request-validation'

describe('parseAndValidateImageDataUrl', () => {
  it('accepts a valid png data URL', () => {
    const base64 = Buffer.from('fake-png').toString('base64')
    const result = parseAndValidateImageDataUrl(`data:image/png;base64,${base64}`)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mimeType).toBe('image/png')
      expect(result.base64).toBe(base64)
      expect(result.byteLength).toBeGreaterThan(0)
    }
  })

  it('rejects non-data URLs', () => {
    const result = parseAndValidateImageDataUrl('https://example.com/a.png')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid imageDataUrl/)
    }
  })

  it('rejects oversized images', () => {
    const huge = Buffer.alloc(8 * 1024 * 1024, 1).toString('base64')
    const result = parseAndValidateImageDataUrl(`data:image/jpeg;base64,${huge}`, {
      fieldLabel: 'sourceImageDataUrl',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/7 MB/)
    }
  })

  it('rejects empty payload', () => {
    const result = parseAndValidateImageDataUrl('data:image/webp;base64,')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/contains no data/)
    }
  })
})
