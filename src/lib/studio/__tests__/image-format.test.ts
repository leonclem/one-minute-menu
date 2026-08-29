/**
 * @jest-environment node
 */

import { detectStudioImageMimeType, resolveStudioImageMimeType } from '../image-format'

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR-and-the-rest'),
])
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF')])
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
])

describe('studio image container detection', () => {
  it('identifies each supported container from its signature', () => {
    expect(detectStudioImageMimeType(PNG_BYTES)).toBe('image/png')
    expect(detectStudioImageMimeType(JPEG_BYTES)).toBe('image/jpeg')
    expect(detectStudioImageMimeType(WEBP_BYTES)).toBe('image/webp')
  })

  it('returns null for unrecognized or truncated bytes rather than guessing', () => {
    expect(detectStudioImageMimeType(Buffer.from('not-an-image'))).toBeNull()
    expect(detectStudioImageMimeType(Buffer.alloc(0))).toBeNull()
    expect(detectStudioImageMimeType(Buffer.from([0x89, 0x50]))).toBeNull()
    // RIFF without the WEBP form marker is some other RIFF container.
    expect(
      detectStudioImageMimeType(
        Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE')]),
      ),
    ).toBeNull()
  })

  it('prefers the detected container over a mislabeled declaration', () => {
    expect(resolveStudioImageMimeType(JPEG_BYTES, 'image/png')).toEqual({
      mimeType: 'image/jpeg',
      detected: 'image/jpeg',
      mismatched: true,
    })
  })

  it('reports no mismatch when the declaration is already correct', () => {
    expect(resolveStudioImageMimeType(PNG_BYTES, 'image/png')).toEqual({
      mimeType: 'image/png',
      detected: 'image/png',
      mismatched: false,
    })
  })

  it('keeps the declared type when the container cannot be identified', () => {
    expect(resolveStudioImageMimeType(Buffer.from('opaque'), 'image/png')).toEqual({
      mimeType: 'image/png',
      detected: null,
      mismatched: false,
    })
  })
})
