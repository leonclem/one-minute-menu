/**
 * Test: Per-section text-only override for image-less categories.
 * Verifies that sections with no images get text-only tiles AND
 * correctly-sized filler tiles (match ITEM_TEXT_ROW rowSpan, not ITEM_CARD).
 */
import { generateLayoutV2 } from '../layout-engine-v2'
import type { EngineMenuV2, EngineSectionV2, EngineItemV2, ItemIndicatorsV2 } from '../engine-types-v2'

const indicators: ItemIndicatorsV2 = { dietary: [], allergens: [], spiceLevel: null }

function makeItem(id: string, imageUrl?: string): EngineItemV2 {
  return { id, name: `Item ${id}`, price: 10, sortOrder: 0, indicators, isFeatured: false, imageUrl }
}

function makeSection(id: string, items: EngineItemV2[], hasImages: boolean): EngineSectionV2 {
  return { id, name: `Section ${id}`, sortOrder: 0, items, hasImages }
}

describe('Per-section text-only filler sizing', () => {
  it('uses text-row-sized fillers for sections with hasImages=false', async () => {
    const sectionWithImages = makeSection('with-images', [
      makeItem('a1', 'https://example.com/img.jpg'),
      makeItem('a2', 'https://example.com/img2.jpg'),
      makeItem('a3'),
    ], true)

    const sectionNoImages = makeSection('no-images', [
      makeItem('b1'),
      makeItem('b2'),
      makeItem('b3'),
    ], false)

    const menu: EngineMenuV2 = {
      id: 'test-menu',
      name: 'Test Menu',
      sections: [
        { ...sectionWithImages, sortOrder: 0 },
        { ...sectionNoImages, sortOrder: 1 },
      ],
      metadata: { currency: '$', venueName: 'Test' },
    }

    const layout = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        fillersEnabled: true,
        imageMode: 'compact-circle',
      },
    })

    // Find filler tiles for each section
    const allTiles = layout.pages.flatMap(p => p.tiles)
    
    // Find item tiles to verify section tile types
    const itemTilesWithImages = allTiles.filter(
      t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
        (t.content as any).sectionId === 'with-images'
    )
    const itemTilesNoImages = allTiles.filter(
      t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
        (t.content as any).sectionId === 'no-images'
    )

    // Section with images should use ITEM_CARD
    expect(itemTilesWithImages.length).toBeGreaterThan(0)
    expect(itemTilesWithImages.every(t => t.type === 'ITEM_CARD')).toBe(true)
    expect(itemTilesWithImages[0].rowSpan).toBe(2)

    // Section without images should use ITEM_TEXT_ROW
    expect(itemTilesNoImages.length).toBeGreaterThan(0)
    expect(itemTilesNoImages.every(t => t.type === 'ITEM_TEXT_ROW')).toBe(true)
    expect(itemTilesNoImages[0].rowSpan).toBe(1)

    const fillerTiles = allTiles.filter(t => t.type === 'FILLER')

    // If we can identify fillers by section, check their rowSpan
    // Fillers created by insertInterspersedFillers include sectionId in their id
    const fillersForNoImages = fillerTiles.filter(t => t.id.includes('no-images'))
    const fillersForWithImages = fillerTiles.filter(t => t.id.includes('with-images'))

    if (fillersForNoImages.length > 0) {
      expect(fillersForNoImages.every(f => f.rowSpan === 1)).toBe(true)
    }

    if (fillersForWithImages.length > 0) {
      expect(fillersForWithImages.every(f => f.rowSpan === 2)).toBe(true)
    }
  })

  it('matches body-logo and compact header height to the effective item mode of each section', async () => {
    const sectionWithImages = makeSection('with-images', [
      makeItem('a1', 'https://example.com/img.jpg'),
      makeItem('a2', 'https://example.com/img2.jpg'),
      makeItem('a3'),
    ], true)

    const sectionNoImages = makeSection('no-images', [
      makeItem('b1'),
      makeItem('b2'),
      makeItem('b3'),
    ], false)

    const menu: EngineMenuV2 = {
      id: 'test-menu-body-tiles',
      name: 'Test Menu',
      sections: [
        { ...sectionWithImages, sortOrder: 0 },
        { ...sectionNoImages, sortOrder: 1 },
      ],
      metadata: {
        currency: '$',
        venueName: 'Test',
        logoUrl: 'https://example.com/logo.png',
      },
    }

    const layout = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        showBanner: false,
        showLogoTile: true,
        showCategoryHeaderTiles: true,
      },
    })

    const allTiles = layout.pages.flatMap(page => page.tiles)
    const bodyLogo = allTiles.find(tile => tile.type === 'LOGO' && tile.regionId === 'body')
    const withImagesHeader = allTiles.find(
      tile => tile.type === 'SECTION_HEADER' && (tile.content as any).sectionId === 'with-images'
    )
    const noImagesHeader = allTiles.find(
      tile => tile.type === 'SECTION_HEADER' && (tile.content as any).sectionId === 'no-images'
    )
    const withImageItems = allTiles.filter(
      tile => (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') &&
        (tile.content as any).sectionId === 'with-images'
    )
    const noImageItems = allTiles.filter(
      tile => (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') &&
        (tile.content as any).sectionId === 'no-images'
    )

    expect(bodyLogo).toBeDefined()
    expect(withImagesHeader).toBeDefined()
    expect(noImagesHeader).toBeDefined()
    expect(withImageItems[0]).toBeDefined()
    expect(noImageItems[0]).toBeDefined()

    expect(withImageItems.every(tile => tile.rowSpan === 2)).toBe(true)
    expect(noImageItems.every(tile => tile.rowSpan === 1)).toBe(true)

    expect(bodyLogo!.rowSpan).toBe(withImageItems[0].rowSpan)
    expect(bodyLogo!.height).toBe(withImageItems[0].height)
    expect(withImagesHeader!.rowSpan).toBe(withImageItems[0].rowSpan)
    expect(withImagesHeader!.height).toBe(withImageItems[0].height)
    expect(noImagesHeader!.rowSpan).toBe(noImageItems[0].rowSpan)
    expect(noImagesHeader!.height).toBe(noImageItems[0].height)
  })
})
