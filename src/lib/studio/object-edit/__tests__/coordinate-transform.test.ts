import {
  deriveAnnotationBoundingRegion,
  deriveAnnotationRadius,
  normalizedToViewport,
  viewportToNormalized,
} from '../coordinate-transform'

const bounds = { left: 100, top: 50, width: 400, height: 200 }

describe('object-edit coordinate transforms', () => {
  it('round-trips image-relative boundary coordinates from displayed image bounds', () => {
    expect(viewportToNormalized({ x: 100, y: 50 }, bounds)).toEqual({ x: 0, y: 0 })
    expect(viewportToNormalized({ x: 500, y: 250 }, bounds)).toEqual({ x: 1, y: 1 })
    expect(normalizedToViewport({ x: 0.25, y: 0.75 }, bounds)).toEqual({ x: 200, y: 200 })
  })

  it('independently clamps coordinates outside a letterboxed displayed image', () => {
    expect(viewportToNormalized({ x: 40, y: 150 }, bounds)).toEqual({ x: 0, y: 0.5 })
    expect(viewportToNormalized({ x: 320, y: 400 }, bounds)).toEqual({ x: 0.55, y: 1 })
  })

  it('uses image-aware radius axes that remain independent of viewport shape', () => {
    expect(deriveAnnotationRadius({ width: 4000, height: 400 })).toEqual({ x: 0.001, y: 0.01 })
    const region = deriveAnnotationBoundingRegion(
      [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }],
      { width: 4000, height: 400 },
    )
    expect(region).toEqual({ left: 0.499, top: 0.49, right: 0.501, bottom: 0.51 })
  })

  it('rejects invalid displayed bounds rather than producing invalid normalized coordinates', () => {
    expect(() => viewportToNormalized({ x: 1, y: 1 }, { ...bounds, width: 0 })).toThrow(RangeError)
    expect(() => normalizedToViewport({ x: 0.5, y: 0.5 }, { ...bounds, height: -1 })).toThrow(
      RangeError,
    )
  })
})
