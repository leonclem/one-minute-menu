import { MAX_SOURCE_ASPECT_ELONGATION, SOURCE_ASPECT_REJECTION, sourceAspectRejection } from '../source-image-aspect'

describe('sourceAspectRejection', () => {
  it('accepts common phone and export ratios', () => {
    expect(sourceAspectRejection(1024, 1024)).toBeNull()
    expect(sourceAspectRejection(1600, 900)).toBeNull()
    expect(sourceAspectRejection(900, 1600)).toBeNull()
    expect(sourceAspectRejection(1600, 1200)).toBeNull()
    expect(sourceAspectRejection(1200, 1600)).toBeNull()
    expect(sourceAspectRejection(1080, 1350)).toBeNull()
  })

  it(`rejects images longer than ${MAX_SOURCE_ASPECT_ELONGATION}:1`, () => {
    expect(sourceAspectRejection(3000, 900)).toBe(SOURCE_ASPECT_REJECTION)
    expect(sourceAspectRejection(400, 1600)).toBe(SOURCE_ASPECT_REJECTION)
  })

  it('rejects unreadable dimensions', () => {
    expect(sourceAspectRejection(0, 800)).toMatch(/could not read/i)
  })
})
