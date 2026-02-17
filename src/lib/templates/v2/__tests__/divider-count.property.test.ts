/**
 * Property-Based Tests for Divider Count
 * Feature: gridmenu-v2-layout-enhancements, Property 6: Divider Count Equals Sections Minus One
 *
 * For any menu with N sections (N≥2) and template with dividers enabled,
 * layout contains exactly N-1 DECORATIVE_DIVIDER tiles across all pages.
 *
 * **Validates: Requirements 10.4**
 */

import fc from 'fast-check'
import { generateLayoutV2 } from '../layout-engine-v2'
import { clearTemplateCache } from '../template-loader-v2'
import type { EngineMenuV2, EngineItemV2, EngineSectionV2, ItemIndicatorsV2 } from '../engine-types-v2'

// =============================================================================
// Generators
// =============================================================================

const arbIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
  dietary: fc.constant([]) as fc.Arbitrary<ItemIndicatorsV2['dietary']>,
  spiceLevel: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 3 })),
  allergens: fc.constant([] as string[]),
})

/** Generate a valid EngineItemV2 */
function arbItem(sectionIndex: number, itemIndex: number): fc.Arbitrary<EngineItemV2> {
  return fc.record({
    id: fc.constant(`item-${sectionIndex}-${itemIndex}`),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 60 }), { nil: undefined }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
    imageUrl: fc.option(fc.constant('https://placehold.co/400x300'), { nil: undefined }),
    sortOrder: fc.constant(itemIndex),
    indicators: arbIndicators,
  })
}

/** Generate a valid EngineSectionV2 with 1-6 items */
function arbSection(sectionIndex: number): fc.Arbitrary<EngineSectionV2> {
  return fc.integer({ min: 1, max: 6 }).chain(itemCount => {
    const items = Array.from({ length: itemCount }, (_, i) =>
      arbItem(sectionIndex, i)
    )
    return fc.tuple(...(items as [fc.Arbitrary<EngineItemV2>, ...fc.Arbitrary<EngineItemV2>[]])).map(itemArr => ({
      id: `sec-${sectionIndex}`,
      name: `Section ${sectionIndex}`,
      sortOrder: sectionIndex,
      items: itemArr,
    }))
  })
}

/** Generate a valid EngineMenuV2 with 2-10 non-empty sections */
const arbMenuWithMultipleSections: fc.Arbitrary<EngineMenuV2> = fc
  .integer({ min: 2, max: 10 })
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

describe('Feature: gridmenu-v2-layout-enhancements, Property 6: Divider Count Equals Sections Minus One', () => {
  beforeEach(() => {
    clearTemplateCache()
  })

  /**
   * Property 6: Divider Count Equals Sections Minus One
   *
   * For any menu with N sections (N≥2) and template with dividers.enabled === true,
   * the layout produced by generateLayoutV2 SHALL contain exactly N-1
   * DECORATIVE_DIVIDER tiles across all pages.
   *
   * Uses valentines-v2 which has dividers.enabled: true.
   * (classic-cards-v2 now has dividers disabled)
   *
   * **Validates: Requirements 10.4**
   */
  it('should produce exactly N-1 dividers for a menu with N non-empty sections', async () => {
    await fc.assert(
      fc.asyncProperty(arbMenuWithMultipleSections, async (menu) => {
        const doc = await generateLayoutV2({
          menu,
          templateId: 'valentines-v2',
          debug: true,
        })

        const nonEmptySections = menu.sections.filter(s => s.items && s.items.length > 0)
        const expectedDividers = nonEmptySections.length - 1

        const totalDividers = doc.pages.reduce(
          (sum, page) =>
            sum + page.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER').length,
          0
        )

        expect(totalDividers).toBe(expectedDividers)
      }),
      { numRuns: 100 }
    )
  }, 60000)
})
