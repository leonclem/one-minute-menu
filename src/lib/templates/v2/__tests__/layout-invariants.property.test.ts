/**
 * Property-Based Tests for Layout Invariants
 * Feature: gridmenu-v2-layout-enhancements, Property 4: Layout Invariants Hold for All Templates and Menus
 *
 * For any valid template and any generated menu, generateLayoutV2 produces
 * layouts passing all invariants (INV-1 through INV-4):
 *   INV-1: No tile outside region bounds
 *   INV-2: No overlapping content-layer tiles
 *   INV-3: No widowed section headers
 *   INV-4: All item tiles (ITEM_CARD, ITEM_TEXT_ROW) in body region
 *
 * **Validates: Requirements 3.3, 4.4, 5.5, 6.3, 7.3**
 */

import fc from 'fast-check'
import { generateLayoutV2 } from '../layout-engine-v2'
import { listAvailableTemplates } from '../template-loader-v2'
import { clearTemplateCache } from '../template-loader-v2'
import type { EngineMenuV2, EngineItemV2, EngineSectionV2, ItemIndicatorsV2 } from '../engine-types-v2'

// =============================================================================
// Generators
// =============================================================================

/** Generate a valid ItemIndicatorsV2 */
const arbIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
  dietary: fc.constant([]) as fc.Arbitrary<ItemIndicatorsV2['dietary']>,
  spiceLevel: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 3 })),
  allergens: fc.constant([] as string[]),
})

/** Generate a valid EngineItemV2 */
function arbItem(index: number): fc.Arbitrary<EngineItemV2> {
  return fc.record({
    id: fc.constant(`item-${index}`),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 80 }), { nil: undefined }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
    imageUrl: fc.option(fc.constant('https://placehold.co/400x300'), { nil: undefined }),
    sortOrder: fc.constant(index),
    indicators: arbIndicators,
  })
}

/** Generate a valid EngineSectionV2 with 1-8 items */
function arbSection(sectionIndex: number): fc.Arbitrary<EngineSectionV2> {
  return fc.integer({ min: 1, max: 8 }).chain(itemCount => {
    const items = Array.from({ length: itemCount }, (_, i) =>
      arbItem(sectionIndex * 100 + i)
    )
    return fc.tuple(...(items as [fc.Arbitrary<EngineItemV2>, ...fc.Arbitrary<EngineItemV2>[]])).map(itemArr => ({
      id: `sec-${sectionIndex}`,
      name: `Section ${sectionIndex}`,
      sortOrder: sectionIndex,
      items: itemArr,
    }))
  })
}

/** Generate a valid EngineMenuV2 with 1-5 sections */
const arbMenu: fc.Arbitrary<EngineMenuV2> = fc
  .integer({ min: 1, max: 5 })
  .chain(sectionCount => {
    const sections = Array.from({ length: sectionCount }, (_, i) => arbSection(i))
    return fc.tuple(...(sections as [fc.Arbitrary<EngineSectionV2>, ...fc.Arbitrary<EngineSectionV2>[]])).map(secs => ({
      id: 'prop-test-menu',
      name: 'Property Test Menu',
      sections: secs,
      metadata: {
        currency: '$',
        venueName: 'Test Venue',
      },
    }))
  })

// =============================================================================
// Property Test
// =============================================================================

describe('Feature: gridmenu-v2-layout-enhancements, Property 4: Layout Invariants Hold for All Templates and Menus', () => {
  let templateIds: string[] = []

  beforeAll(async () => {
    clearTemplateCache()
    const all = await listAvailableTemplates()
    // Exclude the test-template fixture and elegant-serif-example (may have non-standard config)
    templateIds = all.filter(
      id => id !== 'test-template' && id !== 'elegant-serif-example'
    )
    expect(templateIds.length).toBeGreaterThanOrEqual(5)
  })

  beforeEach(() => {
    clearTemplateCache()
  })

  it.each([
    'classic-cards-v2',
    'classic-cards-v2-landscape',
    'two-column-classic-v2',
    'three-column-modern-v2',
    'half-a4-tall-v2',
    'italian-v2',
  ])(
    'template "%s" should produce valid layouts for any random menu',
    async (templateId) => {
      await fc.assert(
        fc.asyncProperty(arbMenu, async (menu) => {
          // generateLayoutV2 with debug=true runs validateInvariants internally
          // and throws InvariantViolationError on any violation
          const doc = await generateLayoutV2({
            menu,
            templateId,
            debug: true,
          })

          // Basic structural checks
          expect(doc.pages.length).toBeGreaterThan(0)
          expect(doc.templateId).toBe(templateId)

          // Every page should have 4 regions
          for (const page of doc.pages) {
            expect(page.regions).toHaveLength(4)
          }

          // Total item tiles should equal total items in menu
          const totalMenuItems = menu.sections.reduce(
            (sum, sec) => sum + sec.items.length,
            0
          )
          const totalItemTiles = doc.pages.reduce(
            (sum, page) =>
              sum +
              page.tiles.filter(
                t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
              ).length,
            0
          )
          expect(totalItemTiles).toBe(totalMenuItems)
        }),
        { numRuns: 20 }
      )
    },
    30000 // 30s timeout per template
  )
})
