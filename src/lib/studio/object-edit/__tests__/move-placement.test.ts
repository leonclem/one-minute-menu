import {
  deriveMovePlacementGeometry,
  isTranslatedRegionOutOfBounds,
  placementForDestination,
} from '../move-placement'
import { selectionFromStrokes } from '../selection'

const selection = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }], {
  width: 1000,
  height: 1000,
})

describe('object-edit Move placement geometry', () => {
  it('accepts inclusive edge destinations and derives the source from the selection region center', () => {
    const placement = placementForDestination(selection, { x: 1, y: 0 })

    expect(placement?.source).toEqual({ x: 0.5, y: 0.5 })
    expect(placement?.destination).toEqual({ x: 1, y: 0 })
  })

  it('translates the raw annotation and reports likely out-of-bounds without blocking placement', () => {
    const placement = placementForDestination(selection, { x: 1, y: 0 })
    const geometry = deriveMovePlacementGeometry(selection, placement)

    expect(geometry?.translatedStrokes[0].points).toEqual([{ x: 1, y: 0 }])
    expect(geometry?.likelyOutOfBounds).toBe(true)
  })

  it('uses strict edge crossing for the non-blocking out-of-bounds predicate', () => {
    expect(isTranslatedRegionOutOfBounds({ left: 0, top: 0, right: 1, bottom: 1 })).toBe(false)
    expect(isTranslatedRegionOutOfBounds({ left: -0.001, top: 0, right: 1, bottom: 1 })).toBe(true)
  })
})
