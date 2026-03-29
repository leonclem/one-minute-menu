/**
 * Image Transform Rendering Tests
 *
 * Verifies that ImageTransform values (stored as per-mode records) produce the
 * correct objectPosition, transform, and transformOrigin CSS on rendered image
 * elements.
 *
 * Tests are run through the public renderTileContent() API so the internal
 * computeImageTransformStyle() and resolveTransformForMode() helpers are
 * exercised end-to-end.
 */

import { renderTileContent, type RenderOptionsV2 } from '../renderer-v2'
import type { TileInstanceV2, ItemContentV2, FeatureCardContentV2 } from '../engine-types-v2'
import type { ImageTransform, ImageTransformRecord } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItemTile(
  imageUrl: string | undefined,
  imageTransform: ImageTransformRecord | undefined,
  imageMode: RenderOptionsV2['imageMode'] = 'stretch'
): TileInstanceV2 {
  return {
    id: 'item-test',
    type: 'ITEM_CARD',
    regionId: 'body',
    x: 0, y: 0, width: 180, height: 200,
    colSpan: 1, rowSpan: 2,
    gridRow: 0, gridCol: 0,
    layer: 'content',
    content: {
      type: 'ITEM_CARD',
      itemId: 'item-test',
      sectionId: 'section-1',
      name: 'Test Item',
      price: 10.00,
      imageUrl,
      showImage: true,
      currency: 'USD',
      indicators: { dietary: [], spiceLevel: null, allergens: [] },
      imageTransform,
    } as ItemContentV2,
  }
}

function makeFeatureTile(
  imageUrl: string | undefined,
  imageTransform: ImageTransformRecord | undefined,
  imageMode: RenderOptionsV2['imageMode'] = 'stretch'
): TileInstanceV2 {
  return {
    id: 'feature-test',
    type: 'FEATURE_CARD',
    regionId: 'body',
    x: 0, y: 0, width: 360, height: 280,
    colSpan: 2, rowSpan: 3,
    gridRow: 0, gridCol: 0,
    layer: 'content',
    content: {
      type: 'FEATURE_CARD',
      itemId: 'feature-test',
      sectionId: 'section-1',
      name: 'Feature Item',
      price: 25.00,
      imageUrl,
      showImage: true,
      currency: 'USD',
      indicators: { dietary: [], spiceLevel: null, allergens: [] },
      imageTransform,
    } as FeatureCardContentV2,
  }
}

/** Shorthand: wrap a single ImageTransform into a per-mode record */
function rec(mode: string, t: ImageTransform): ImageTransformRecord {
  return { [mode]: t }
}

function baseOptions(imageMode: RenderOptionsV2['imageMode'] = 'stretch'): RenderOptionsV2 {
  return { scale: 1.0, imageMode }
}

function getImageElement(tile: TileInstanceV2, options: RenderOptionsV2) {
  const result = renderTileContent(tile, options)
  return result.elements.find(e => e.type === 'image')
}

// ---------------------------------------------------------------------------
// ITEM_CARD – stretch mode (baseX=50, baseY=70)
// ---------------------------------------------------------------------------

describe('ImageTransform – ITEM_CARD stretch mode', () => {
  const IMAGE_URL = 'https://example.com/pizza.jpg'

  it('no transform → objectPosition defaults to "center 70%"', () => {
    const tile = makeItemTile(IMAGE_URL, undefined, 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img).toBeDefined()
    expect(img!.style.objectPosition).toBe('center 70%')
    expect(img!.style.transform).toBeUndefined()
    expect(img!.style.transformOrigin).toBeUndefined()
  })

  it('zero offsets, scale 1.0 → objectPosition "center 70%", no transform', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 0, offsetY: 0, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('center 70%')
    expect(img!.style.transform).toBeUndefined()
    expect(img!.style.transformOrigin).toBeUndefined()
  })

  it('positive offsetX → objectPosition uses calc() for X', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 15, offsetY: 0, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('calc(50% + 15 * 1%) 70%')
    expect(img!.style.transform).toBeUndefined()
  })

  it('negative offsetY → objectPosition uses calc() for Y', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 0, offsetY: -20, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('center calc(70% + -20 * 1%)')
    expect(img!.style.transform).toBeUndefined()
  })

  it('both offsets non-zero → both axes use calc()', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 10, offsetY: -30, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('calc(50% + 10 * 1%) calc(70% + -30 * 1%)')
  })

  it('scale > 1.0 → transform and transformOrigin are set', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 0, offsetY: 0, scale: 1.5 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('center 70%')
    expect(img!.style.transform).toBe('scale(1.5)')
    expect(img!.style.transformOrigin).toBe('center 70%')
  })

  it('scale > 1.0 with offsets → transformOrigin matches objectPosition', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 10, offsetY: -20, scale: 2.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    const expectedPos = 'calc(50% + 10 * 1%) calc(70% + -20 * 1%)'
    expect(img!.style.objectPosition).toBe(expectedPos)
    expect(img!.style.transform).toBe('scale(2)')
    expect(img!.style.transformOrigin).toBe(expectedPos)
  })

  it('scale exactly 1.0 → no transform CSS even with offsets', () => {
    const tile = makeItemTile(IMAGE_URL, rec('stretch', { offsetX: 5, offsetY: 5, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.transform).toBeUndefined()
    expect(img!.style.transformOrigin).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ITEM_CARD – compact mode (baseX=50, baseY=50)
// ---------------------------------------------------------------------------

describe('ImageTransform – ITEM_CARD compact mode', () => {
  const IMAGE_URL = 'https://example.com/burger.jpg'

  it('no transform → objectPosition defaults to "center"', () => {
    const tile = makeItemTile(IMAGE_URL, undefined, 'compact-rect')
    const img = getImageElement(tile, baseOptions('compact-rect'))
    expect(img).toBeDefined()
    expect(img!.style.objectPosition).toBe('center')
    expect(img!.style.transform).toBeUndefined()
  })

  it('scale > 1.0 → transform and transformOrigin reference "center center"', () => {
    const tile = makeItemTile(IMAGE_URL, rec('compact-rect', { offsetX: 0, offsetY: 0, scale: 1.8 }), 'compact-rect')
    const img = getImageElement(tile, baseOptions('compact-rect'))
    expect(img!.style.objectPosition).toBe('center center')
    expect(img!.style.transform).toBe('scale(1.8)')
    expect(img!.style.transformOrigin).toBe('center center')
  })
})

// ---------------------------------------------------------------------------
// Per-mode isolation: transform for one mode doesn't leak to another
// ---------------------------------------------------------------------------

describe('ImageTransform – per-mode isolation', () => {
  const IMAGE_URL = 'https://example.com/per-mode.jpg'

  it('stretch transform does not apply when rendering in compact-rect mode', () => {
    const record: ImageTransformRecord = {
      stretch: { offsetX: 20, offsetY: -10, scale: 1.8 },
    }
    const tile = makeItemTile(IMAGE_URL, record, 'compact-rect')
    const img = getImageElement(tile, baseOptions('compact-rect'))
    expect(img!.style.objectPosition).toBe('center')
    expect(img!.style.transform).toBeUndefined()
  })

  it('cutout transform applies only when rendering in cutout mode', () => {
    const record: ImageTransformRecord = {
      cutout: { offsetX: 5, offsetY: 5, scale: 0.8 },
      stretch: { offsetX: 0, offsetY: 0, scale: 2.0 },
    }
    const tile = makeItemTile(IMAGE_URL, record, 'cutout')
    const img = getImageElement(tile, baseOptions('cutout'))
    expect(img!.style.objectPosition).toBe('center')
    expect(img!.style.transform).toBe('translate(5%, 5%) scale(0.8)')
  })

  it('multi-mode record: each mode gets its own transform', () => {
    const record: ImageTransformRecord = {
      stretch: { offsetX: 10, offsetY: 0, scale: 1.5 },
      'compact-rect': { offsetX: -5, offsetY: 0, scale: 2.0 },
    }
    const stretchTile = makeItemTile(IMAGE_URL, record, 'stretch')
    const stretchImg = getImageElement(stretchTile, baseOptions('stretch'))
    expect(stretchImg!.style.transform).toBe('scale(1.5)')

    const compactTile = makeItemTile(IMAGE_URL, record, 'compact-rect')
    const compactImg = getImageElement(compactTile, baseOptions('compact-rect'))
    expect(compactImg!.style.transform).toBe('scale(2)')
  })
})

// ---------------------------------------------------------------------------
// options.imageTransforms map overrides content.imageTransform
// ---------------------------------------------------------------------------

describe('ImageTransform – options.imageTransforms override', () => {
  const IMAGE_URL = 'https://example.com/override.jpg'

  it('imageTransforms map takes precedence over content.imageTransform', () => {
    const contentRecord: ImageTransformRecord = { stretch: { offsetX: 0, offsetY: 0, scale: 1.0 } }
    const overrideTransform: ImageTransform = { offsetX: 20, offsetY: 0, scale: 2.0 }

    const tile = makeItemTile(IMAGE_URL, contentRecord, 'stretch')
    const options: RenderOptionsV2 = {
      ...baseOptions('stretch'),
      imageTransforms: new Map([['item-test', overrideTransform]]),
    }
    const img = getImageElement(tile, options)

    expect(img!.style.objectPosition).toBe('calc(50% + 20 * 1%) 70%')
    expect(img!.style.transform).toBe('scale(2)')
  })

  it('falls back to content.imageTransform for current mode when item not in map', () => {
    const contentRecord: ImageTransformRecord = { stretch: { offsetX: 0, offsetY: 0, scale: 1.5 } }
    const tile = makeItemTile(IMAGE_URL, contentRecord, 'stretch')
    const options: RenderOptionsV2 = {
      ...baseOptions('stretch'),
      imageTransforms: new Map([['other-item', { offsetX: 99, offsetY: 99, scale: 2.5 }]]),
    }
    const img = getImageElement(tile, options)

    expect(img!.style.transform).toBe('scale(1.5)')
    expect(img!.style.objectPosition).toBe('center 70%')
  })
})

// ---------------------------------------------------------------------------
// FEATURE_CARD – stretch mode (baseX=50, baseY=75)
// ---------------------------------------------------------------------------

describe('ImageTransform – FEATURE_CARD stretch mode', () => {
  const IMAGE_URL = 'https://example.com/feature.jpg'

  it('no transform → objectPosition "center 75%"', () => {
    const tile = makeFeatureTile(IMAGE_URL, undefined, 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img).toBeDefined()
    expect(img!.style.objectPosition).toBe('center 75%')
    expect(img!.style.transform).toBeUndefined()
  })

  it('scale > 1.0 → transform and transformOrigin reference "center 75%"', () => {
    const tile = makeFeatureTile(IMAGE_URL, rec('stretch', { offsetX: 0, offsetY: 0, scale: 2.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.transform).toBe('scale(2)')
    expect(img!.style.transformOrigin).toBe('center 75%')
  })

  it('offsetY non-zero → calc on Y axis based on 75%', () => {
    const tile = makeFeatureTile(IMAGE_URL, rec('stretch', { offsetX: 0, offsetY: 10, scale: 1.0 }), 'stretch')
    const img = getImageElement(tile, baseOptions('stretch'))
    expect(img!.style.objectPosition).toBe('center calc(75% + 10 * 1%)')
  })
})

// ---------------------------------------------------------------------------
// scale < 1.0 (cutout zoom-out)
// ---------------------------------------------------------------------------

describe('ImageTransform – cutout scale < 1.0', () => {
  const IMAGE_URL = 'https://example.com/cutout.png'

  it('scale 0.7 → transform scale(0.7) is set', () => {
    const tile = makeItemTile(IMAGE_URL, rec('cutout', { offsetX: 0, offsetY: 0, scale: 0.7 }), 'cutout')
    const img = getImageElement(tile, baseOptions('cutout'))
    expect(img!.style.transform).toBe('translate(0%, 0%) scale(0.7)')
    expect(img!.style.transformOrigin).toBeDefined()
  })

  it('scale 0.5 with offsets → transform and objectPosition both set', () => {
    const tile = makeItemTile(IMAGE_URL, rec('cutout', { offsetX: 10, offsetY: -5, scale: 0.5 }), 'cutout')
    const img = getImageElement(tile, baseOptions('cutout'))
    expect(img!.style.transform).toBe('translate(10%, -5%) scale(0.5)')
    expect(img!.style.objectPosition).toBe('center')
  })
})

// ---------------------------------------------------------------------------
// No image URL → no image element rendered
// ---------------------------------------------------------------------------

describe('ImageTransform – missing imageUrl', () => {
  it('does not render an image element when imageUrl is undefined', () => {
    const tile = makeItemTile(undefined, rec('stretch', { offsetX: 10, offsetY: 10, scale: 1.5 }), 'stretch')
    const result = renderTileContent(tile, baseOptions('stretch'))
    const imageEls = result.elements.filter(e => e.type === 'image')
    expect(imageEls).toHaveLength(0)
  })
})
