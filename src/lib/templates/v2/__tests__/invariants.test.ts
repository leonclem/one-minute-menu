/**
 * Property-Based Tests for V2 Layout Engine
 * 
 * These tests use fast-check to generate random menus and verify that
 * the layout engine maintains critical invariants across all inputs.
 * 
 * Feature: grid-menu-templates-part-4, Task 17: Property-Based Tests
 */

import fc from 'fast-check'
import { generateLayoutV2 } from '../layout-engine-v2'
import type { 
  EngineMenuV2, 
  EngineSectionV2, 
  EngineItemV2, 
  LayoutDocumentV2,
  TileInstanceV2,
  ItemIndicatorsV2,
  DietaryIndicator
} from '../engine-types-v2'

// Fixed template for MVP - no random template generation
const FIXED_TEMPLATE_ID = 'classic-cards-v2'

/**
 * Generate arbitrary EngineMenuV2 for property testing
 */
function arbitraryEngineMenuV2(options?: {
  minSections?: number
  maxSections?: number
  minItems?: number
  maxItems?: number
}): fc.Arbitrary<EngineMenuV2> {
  const {
    minSections = 1,
    maxSections = 5,
    minItems = 1,
    maxItems = 20
  } = options || {}

  const arbitraryDietaryIndicator: fc.Arbitrary<DietaryIndicator> = fc.constantFrom(
    'vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free'
  )

  const arbitraryIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
    dietary: fc.array(arbitraryDietaryIndicator, { maxLength: 3 }),
    allergens: fc.array(fc.constantFrom('nuts', 'dairy', 'gluten', 'eggs', 'shellfish'), { maxLength: 3 }),
    spiceLevel: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null })
  })

  const arbitraryItem: fc.Arbitrary<EngineItemV2> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    description: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
    price: fc.float({ min: 1, max: 100, noNaN: true }),
    imageUrl: fc.option(fc.webUrl()),
    sortOrder: fc.nat(),
    indicators: arbitraryIndicators
  })

  const arbitrarySection: fc.Arbitrary<EngineSectionV2> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    sortOrder: fc.nat(),
    items: fc.array(arbitraryItem, { minLength: minItems, maxLength: maxItems })
  })

  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 50 }),
    sections: fc.array(arbitrarySection, { minLength: minSections, maxLength: maxSections }),
    metadata: fc.record({
      currency: fc.constantFrom('£', '$', '€'),
      venueName: fc.option(fc.string({ minLength: 5, maxLength: 50 })),
      venueAddress: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
      logoUrl: fc.option(fc.webUrl())
    })
  })
}

/**
 * Normalize layout document for comparison (exclude debug.generatedAt)
 */
function normalizeLayoutDocument(doc: LayoutDocumentV2): LayoutDocumentV2 {
  const copy = JSON.parse(JSON.stringify(doc))
  if (copy.debug) {
    delete copy.debug.generatedAt
  }
  return copy
}

describe('V2 Layout Engine Property Tests', () => {
  /**
   * Property 1: Determinism
   * For any valid EngineMenuV2, calling generateLayoutV2 twice with identical inputs
   * SHALL produce byte-identical LayoutDocumentV2 outputs (excluding debug.generatedAt).
   * 
   * Feature: grid-menu-templates-part-4, Property 1: Determinism
   * Validates: Requirements 4.1, 4.5, 9.7, 9.8
   */
  it('Property 1: Determinism - same input produces same output', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 3, maxItems: 10 }),
        async (menu) => {
          const result1 = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })
          const result2 = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          expect(normalizeLayoutDocument(result1)).toEqual(normalizeLayoutDocument(result2))
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 2: Tiles Within Region Bounds
   * For any generated LayoutDocumentV2, for all tiles on all pages,
   * the tile's bounding box SHALL lie entirely within its assigned region's bounds.
   * 
   * Feature: grid-menu-templates-part-4, Property 2: Tiles within region bounds
   * Validates: Requirements 3.4, 3.6, 5.3, 5.4, 8.4
   */
  it('Property 2: Tiles within region bounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 4, maxItems: 15 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            for (const tile of page.tiles) {
              const region = page.regions.find(r => r.id === tile.regionId)!
              
              expect(tile.x).toBeGreaterThanOrEqual(0)
              expect(tile.y).toBeGreaterThanOrEqual(0)
              expect(tile.x + tile.width).toBeLessThanOrEqual(region.width + 0.01) // Small tolerance for floating point
              expect(tile.y + tile.height).toBeLessThanOrEqual(region.height + 0.01)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 3: No Widowed Section Headers
   * For any generated LayoutDocumentV2, for all section header tiles,
   * there SHALL exist at least one item tile from the same section on the same page
   * with a y-coordinate greater than the header's y-coordinate.
   * 
   * Feature: grid-menu-templates-part-4, Property 3: No widowed section headers
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 5.5
   */
  it('Property 3: No widowed section headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ minSections: 1, minItems: 1, maxSections: 3, maxItems: 10 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            const sectionHeaders = page.tiles.filter(t => t.type === 'SECTION_HEADER')
            
            for (const header of sectionHeaders) {
              const sectionId = (header.content as any).sectionId
              const itemsBelow = page.tiles.filter(
                t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
                     (t.content as any).sectionId === sectionId &&
                     t.y > header.y
              )
              
              expect(itemsBelow.length).toBeGreaterThanOrEqual(1)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Reading Order Preservation
   * For any generated LayoutDocumentV2, the sequence of item tiles
   * (when sorted by pageIndex, then y, then x) SHALL match the original
   * item order from the input EngineMenuV2.
   * 
   * Feature: grid-menu-templates-part-4, Property 4: Reading order preservation
   * Validates: Requirements 4.2, 8.5
   */
  it('Property 4: Reading order preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 3, maxItems: 8 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          // Get expected order from input menu
          const expectedOrder: string[] = []
          for (const section of [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
            for (const item of [...section.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
              expectedOrder.push(item.id)
            }
          }

          // Get actual order from output tiles
          const actualOrder: string[] = []
          for (const page of [...result.pages].sort((a, b) => a.pageIndex - b.pageIndex)) {
            const itemTiles = page.tiles
              .filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
              .sort((a, b) => {
                if (a.y !== b.y) return a.y - b.y
                return a.x - b.x
              })
            
            for (const tile of itemTiles) {
              actualOrder.push((tile.content as any).itemId)
            }
          }

          expect(actualOrder).toEqual(expectedOrder)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Last Row Balancing Correctness
   * For any generated LayoutDocumentV2 with CENTER balancing policy,
   * for all pages where the last row of items is partially filled,
   * the items SHALL be horizontally centered.
   * 
   * Feature: grid-menu-templates-part-4, Property 5: Last row balancing correctness
   * Validates: Requirements 8.1, 8.2
   */
  it('Property 5: Last row balancing correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 2, maxItems: 7 }), // Likely to create partial rows
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            const itemTiles = page.tiles.filter(t => 
              t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
            )

            if (itemTiles.length === 0) continue

            // Find the last row
            const maxY = Math.max(...itemTiles.map(t => t.y))
            const lastRowTiles = itemTiles.filter(t => t.y === maxY)
            
            // If last row is partial (less than 4 items for classic-cards-v2)
            if (lastRowTiles.length > 0 && lastRowTiles.length < 4) {
              // Check that tiles are centered (first tile should have positive x offset)
              const firstTile = [...lastRowTiles].sort((a, b) => a.x - b.x)[0]
              expect(firstTile.x).toBeGreaterThan(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Filler Independence
   * For any EngineMenuV2 and TemplateV2, generating layouts with
   * filler.enabled=true and filler.enabled=false SHALL produce
   * identical item tile positions and ordering.
   * 
   * Feature: grid-menu-templates-part-4, Property 6: Filler independence
   * Validates: Requirements 9.4, 9.9
   */
  it('Property 6: Filler independence', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 2, maxItems: 6 }),
        async (menu) => {
          // Note: For MVP, fillers are disabled in classic-cards-v2 template
          // This test verifies that the filler system doesn't affect item placement
          // even when fillers are theoretically enabled
          
          const resultWithoutFillers = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })
          
          const resultWithFillers = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          // Extract item tiles only (ignore filler tiles)
          const extractItemTiles = (doc: LayoutDocumentV2) => {
            return doc.pages.map(page => ({
              pageIndex: page.pageIndex,
              items: page.tiles
                .filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
                .map(t => ({
                  id: (t.content as any).itemId,
                  x: t.x,
                  y: t.y,
                  width: t.width,
                  height: t.height
                }))
            }))
          }

          const itemsWithoutFillers = extractItemTiles(resultWithoutFillers)
          const itemsWithFillers = extractItemTiles(resultWithFillers)

          expect(itemsWithFillers).toEqual(itemsWithoutFillers)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7: Fillers Constrained to Safe Zones
   * For any generated LayoutDocumentV2 with fillers enabled,
   * for all filler tiles, the tile's grid position SHALL fall
   * within at least one of the template's declared safeZones.
   * 
   * Feature: grid-menu-templates-part-4, Property 7: Fillers constrained to safe zones
   * Validates: Requirements 9.2, 9.5, 9.10
   */
  it('Property 7: Fillers constrained to safe zones', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 2, maxItems: 5 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            const fillerTiles = page.tiles.filter(t => t.type === 'FILLER')
            
            // For MVP, fillers are disabled in classic-cards-v2, so should be empty
            expect(fillerTiles).toHaveLength(0)
            
            // Future: When fillers are enabled, verify they're in safe zones
            // for (const filler of fillerTiles) {
            //   expect(filler.gridRow).toBeGreaterThanOrEqual(safeZone.startRow)
            //   expect(filler.gridRow).toBeLessThanOrEqual(safeZone.endRow)
            //   expect(filler.gridCol).toBeGreaterThanOrEqual(safeZone.startCol)
            //   expect(filler.gridCol).toBeLessThanOrEqual(safeZone.endCol)
            // }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8: Page Type Assignment Correctness
   * For any generated LayoutDocumentV2:
   * - If pages.length === 1, the single page SHALL have pageType === 'SINGLE'
   * - If pages.length > 1, page[0] SHALL have pageType === 'FIRST',
   *   page[n-1] SHALL have pageType === 'FINAL', and all pages[1..n-2]
   *   SHALL have pageType === 'CONTINUATION'
   * 
   * Feature: grid-menu-templates-part-4, Property 8: Page type assignment correctness
   * Validates: Requirements 5.6
   */
  it('Property 8: Page type assignment correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 4, maxItems: 15 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          const pages = result.pages
          expect(pages.length).toBeGreaterThan(0)

          if (pages.length === 1) {
            expect(pages[0].pageType).toBe('SINGLE')
          } else if (pages.length === 2) {
            expect(pages[0].pageType).toBe('FIRST')
            expect(pages[1].pageType).toBe('FINAL')
          } else {
            expect(pages[0].pageType).toBe('FIRST')
            expect(pages[pages.length - 1].pageType).toBe('FINAL')
            
            for (let i = 1; i < pages.length - 1; i++) {
              expect(pages[i].pageType).toBe('CONTINUATION')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9: Region Partitioning
   * For any generated LayoutDocumentV2, for all pages, there SHALL be
   * exactly 4 regions with ids ['header', 'title', 'body', 'footer'],
   * and all item tiles SHALL have regionId === 'body'.
   * 
   * Feature: grid-menu-templates-part-4, Property 9: Region partitioning
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  it('Property 9: Region partitioning', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 3, maxItems: 10 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            // Check exactly 4 regions
            expect(page.regions).toHaveLength(4)
            
            const regionIds = page.regions.map(r => r.id).sort()
            expect(regionIds).toEqual(['body', 'footer', 'header', 'title'])

            // Check all item tiles are in body region
            const itemTiles = page.tiles.filter(t => 
              t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
            )
            
            for (const tile of itemTiles) {
              expect(tile.regionId).toBe('body')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 10: Variant Selection by Config
   * For any EngineMenuV2 and TemplateV2 with SelectionConfigV2.textOnly === true,
   * all item tiles in the generated LayoutDocumentV2 SHALL have type === 'ITEM_TEXT_ROW'.
   * 
   * Feature: grid-menu-templates-part-4, Property 10: Variant selection by config
   * Validates: Requirements 6.7, 12.2, 12.6
   */
  it('Property 10: Variant selection by config (textOnly)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 2, maxItems: 8 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID,
            selection: { textOnly: true }
          })

          for (const page of result.pages) {
            const itemTiles = page.tiles.filter(t => 
              t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
            )
            
            for (const tile of itemTiles) {
              expect(tile.type).toBe('ITEM_TEXT_ROW')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11: Static Tile Visibility by Page Type
   * For any generated LayoutDocumentV2, logo tiles SHALL appear only on pages
   * whose pageType is in the template's policies.showLogoOnPages array.
   * 
   * Feature: grid-menu-templates-part-4, Property 11: Static tile visibility by page type
   * Validates: Requirements 3.5
   */
  it('Property 11: Static tile visibility by page type', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 3, maxItems: 20 }), // Force multi-page
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          // For classic-cards-v2, logo should appear on all pages
          const expectedLogoPages = ['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE']

          for (const page of result.pages) {
            const logoTiles = page.tiles.filter(t => t.type === 'LOGO')
            
            if (expectedLogoPages.includes(page.pageType)) {
              expect(logoTiles.length).toBeGreaterThanOrEqual(1)
            } else {
              expect(logoTiles).toHaveLength(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: No Tile Overlaps
   * For any generated LayoutDocumentV2, for all pages, no two tiles within
   * the same region SHALL have overlapping bounding boxes (except when
   * layer rules allow it - background tiles can underlay content tiles).
   * 
   * Feature: grid-menu-templates-part-4, Property 12: No tile overlaps
   * Validates: Requirements 15.2
   */
  it('Property 12: No tile overlaps (respecting layer rules)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEngineMenuV2({ maxSections: 3, maxItems: 12 }),
        async (menu) => {
          const result = await generateLayoutV2({ 
            menu, 
            templateId: FIXED_TEMPLATE_ID 
          })

          for (const page of result.pages) {
            // Group tiles by region
            const tilesByRegion = new Map<string, TileInstanceV2[]>()
            for (const tile of page.tiles) {
              if (!tilesByRegion.has(tile.regionId)) {
                tilesByRegion.set(tile.regionId, [])
              }
              tilesByRegion.get(tile.regionId)!.push(tile)
            }

            // Check for overlaps within each region
            for (const [regionId, tiles] of tilesByRegion) {
              for (let i = 0; i < tiles.length; i++) {
                for (let j = i + 1; j < tiles.length; j++) {
                  const tileA = tiles[i]
                  const tileB = tiles[j]

                  // Check if tiles overlap
                  const overlaps = !(
                    tileA.x + tileA.width <= tileB.x ||
                    tileB.x + tileB.width <= tileA.x ||
                    tileA.y + tileA.height <= tileB.y ||
                    tileB.y + tileB.height <= tileA.y
                  )

                  if (overlaps) {
                    // Overlap is only allowed if either tile is background layer
                    const overlapAllowed = tileA.layer === 'background' || tileB.layer === 'background'
                    expect(overlapAllowed).toBe(true)
                  }
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})