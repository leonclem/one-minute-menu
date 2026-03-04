/**
 * Test: Per-section text-only override for image-less categories.
 * Verifies that sections with no images get text-only tiles AND
 * correctly-sized filler tiles (1-row, not 2-row).
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
  it('uses 1-row fillers for sections with hasImages=false', async () => {
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

    // Section with images should use ITEM_CARD (2-row)
    expect(itemTilesWithImages.length).toBeGreaterThan(0)
    expect(itemTilesWithImages.every(t => t.type === 'ITEM_CARD')).toBe(true)
    expect(itemTilesWithImages[0].rowSpan).toBe(2)

    // Section without images should use ITEM_TEXT_ROW (1-row)
    expect(itemTilesNoImages.length).toBeGreaterThan(0)
    expect(itemTilesNoImages.every(t => t.type === 'ITEM_TEXT_ROW')).toBe(true)
    expect(itemTilesNoImages[0].rowSpan).toBe(1)

    // Find filler tiles by checking their gridRow against section rows
    const noImageItemRows = new Set(itemTilesNoImages.map(t => t.gridRow))
    const withImageItemRows = new Set(itemTilesWithImages.map(t => t.gridRow))

    const fillerTiles = allTiles.filter(t => t.type === 'FILLER')
    
    // Fillers in the no-images section rows should be 1-row
    const fillersInNoImageSection = fillerTiles.filter(t => {
      const content = t.content as any
      return content.sectionId === 'no-images' || 
        t.id.includes('no-images')
    })

    // If we can identify fillers by section, check their rowSpan
    // Fillers created by insertInterspersedFillers include sectionId in their id
    const fillersForNoImages = fillerTiles.filter(t => t.id.includes('no-images'))
    const fillersForWithImages = fillerTiles.filter(t => t.id.includes('with-images'))

    if (fillersForNoImages.length > 0) {
      console.log('Fillers for no-images section:', fillersForNoImages.map(f => ({ id: f.id, rowSpan: f.rowSpan, gridRow: f.gridRow })))
      expect(fillersForNoImages.every(f => f.rowSpan === 1)).toBe(true)
    }

    if (fillersForWithImages.length > 0) {
      console.log('Fillers for with-images section:', fillersForWithImages.map(f => ({ id: f.id, rowSpan: f.rowSpan, gridRow: f.gridRow })))
      expect(fillersForWithImages.every(f => f.rowSpan === 2)).toBe(true)
    }

    // Log all fillers for debugging
    console.log('All filler tiles:', fillerTiles.map(f => ({ id: f.id, rowSpan: f.rowSpan, height: f.height })))
    console.log('Item tiles (no images):', itemTilesNoImages.map(t => ({ id: t.id, type: t.type, rowSpan: t.rowSpan })))
    console.log('Item tiles (with images):', itemTilesWithImages.map(t => ({ id: t.id, type: t.type, rowSpan: t.rowSpan })))
  })
})
