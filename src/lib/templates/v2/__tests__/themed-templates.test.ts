/**
 * Unit tests for V2 display-named templates (4-column-portrait, etc.)
 *
 * Tests:
 * - Templates load and validate against schema
 * - Palette nudging: template with different colourPaletteId
 * - Templates produce valid layouts with random menus
 *
 * _Requirements: 11.1, 11.2, 11.5, 11.6_
 */

import fc from 'fast-check'
import { loadTemplateV2, clearTemplateCache } from '../template-loader-v2'
import { generateLayoutV2 } from '../layout-engine-v2'
import { PALETTES_V2 } from '../renderer-v2'
import type {
  EngineMenuV2,
  EngineItemV2,
  EngineSectionV2,
  ItemIndicatorsV2,
} from '../engine-types-v2'

// =============================================================================
// Fixtures
// =============================================================================

const V2_TEMPLATE_IDS = ['4-column-portrait', '3-column-portrait', '2-column-portrait', '1-column-tall', '4-column-landscape'] as const

function makeSimpleMenu(sectionCount = 2, itemsPerSection = 3): EngineMenuV2 {
  const sections: EngineSectionV2[] = Array.from({ length: sectionCount }, (_, si) => ({
    id: `sec-${si}`,
    name: `Section ${si}`,
    sortOrder: si,
    items: Array.from({ length: itemsPerSection }, (_, ii) => ({
      id: `item-${si}-${ii}`,
      name: `Item ${si}-${ii}`,
      description: 'A tasty dish',
      price: 9.99 + ii,
      sortOrder: ii,
      indicators: { dietary: [], spiceLevel: null, allergens: [] },
    })),
  }))

  return {
    id: 'themed-test-menu',
    name: 'Themed Test Menu',
    sections,
    metadata: { currency: 'USD', venueName: 'Test Venue' },
  }
}

// =============================================================================
// Generators (for random menu property test)
// =============================================================================

const arbIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
  dietary: fc.constant([]) as fc.Arbitrary<ItemIndicatorsV2['dietary']>,
  spiceLevel: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 3 })),
  allergens: fc.constant([] as string[]),
})

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

function arbSection(sectionIndex: number): fc.Arbitrary<EngineSectionV2> {
  return fc.integer({ min: 1, max: 8 }).chain(itemCount => {
    const items = Array.from({ length: itemCount }, (_, i) =>
      arbItem(sectionIndex * 100 + i)
    )
    return fc
      .tuple(...(items as [fc.Arbitrary<EngineItemV2>, ...fc.Arbitrary<EngineItemV2>[]]))
      .map(itemArr => ({
        id: `sec-${sectionIndex}`,
        name: `Section ${sectionIndex}`,
        sortOrder: sectionIndex,
        items: itemArr,
      }))
  })
}

const arbMenu: fc.Arbitrary<EngineMenuV2> = fc
  .integer({ min: 1, max: 5 })
  .chain(sectionCount => {
    const sections = Array.from({ length: sectionCount }, (_, i) => arbSection(i))
    return fc
      .tuple(...(sections as [fc.Arbitrary<EngineSectionV2>, ...fc.Arbitrary<EngineSectionV2>[]]))
      .map(secs => ({
        id: 'prop-test-menu',
        name: 'Property Test Menu',
        sections: secs,
        metadata: { currency: 'USD', venueName: 'Test Venue' },
      }))
  })

// =============================================================================
// Tests
// =============================================================================

describe('V2 templates (display-named)', () => {
  beforeEach(() => {
    clearTemplateCache()
  })

  describe.each(V2_TEMPLATE_IDS)('template "%s"', (templateId) => {
    it('should load and validate against schema', async () => {
      const template = await loadTemplateV2(templateId)

      expect(template.id).toBe(templateId)
      expect(template.version).toBeDefined()
      expect(template.page.size).toBeDefined()
      expect(template.body.container.cols).toBeGreaterThan(0)
      expect(template.tiles.ITEM_CARD ?? template.tiles.ITEM_TEXT_ROW).toBeDefined()
    })

    it('should produce a valid layout with a simple menu', async () => {
      const menu = makeSimpleMenu(2, 3)
      const doc = await generateLayoutV2({ menu, templateId, debug: true })

      expect(doc.pages.length).toBeGreaterThan(0)
      expect(doc.templateId).toBe(templateId)
    })

    it('should produce valid layouts for random menus', async () => {
      await fc.assert(
        fc.asyncProperty(arbMenu, async (menu) => {
          const doc = await generateLayoutV2({ menu, templateId, debug: true })
          expect(doc.pages.length).toBeGreaterThan(0)
          expect(doc.templateId).toBe(templateId)
        }),
        { numRuns: 20 }
      )
    }, 30000)
  })

  describe('palette nudging', () => {
    it.each(V2_TEMPLATE_IDS)(
      'template "%s" should accept a different colourPaletteId without error',
      async (templateId) => {
        const menu = makeSimpleMenu(2, 3)

        // Pick a palette that is NOT the theme's default
        const nudgedPaletteId = 'ocean-breeze'
        const doc = await generateLayoutV2({
          menu,
          templateId,
          selection: { colourPaletteId: nudgedPaletteId },
          debug: true,
        })

        // Layout should still be valid — palette nudging doesn't affect structure
        expect(doc.pages.length).toBeGreaterThan(0)
        expect(doc.templateId).toBe(templateId)
      }
    )

    it('should resolve the nudged palette from PALETTES_V2', () => {
      // Verify the nudged palette exists in the registry
      const nudged = PALETTES_V2.find(p => p.id === 'ocean-breeze')
      expect(nudged).toBeDefined()
      expect(nudged!.colors.background).toBeTruthy()
    })
  })
})
