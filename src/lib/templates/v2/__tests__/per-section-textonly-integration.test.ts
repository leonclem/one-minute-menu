/**
 * Integration test: Per-section text-only override.
 * Tests the FULL pipeline: Menu → transformMenuToV2 → generateLayoutV2
 * to ensure hasImages is correctly computed from real menu data.
 */
import { transformMenuToV2 } from '../menu-transformer-v2'
import { generateLayoutV2 } from '../layout-engine-v2'
import type { Menu, MenuItem, MenuCategory } from '@/types'

// Mock local-image-proxy to avoid @google-cloud/storage ESM import issues
jest.mock('@/lib/background-removal/local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockImplementation((url: string) =>
    Promise.resolve({ url, cleanup: jest.fn().mockResolvedValue(undefined) })
  ),
}))

function makeMenuItem(overrides: Partial<MenuItem> & { id: string; name: string }): MenuItem {
  return {
    price: 10,
    available: true,
    order: 0,
    imageSource: 'none',
    ...overrides,
  }
}

function makeMenu(categories: MenuCategory[], flatItems: MenuItem[]): Menu {
  return {
    id: 'test-menu-integration',
    userId: 'test-user',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    items: flatItems,
    categories,
    theme: {
      id: 'default',
      name: 'Default',
      colors: { primary: '#000', secondary: '#666', accent: '#0f0', background: '#fff', text: '#000', extractionConfidence: 1 },
      fonts: { primary: 'Inter', secondary: 'Inter', sizes: { heading: '1.5rem', body: '1rem', price: '1rem' } },
      layout: { currency: 'EUR' },
    },
    version: 1,
    status: 'draft',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('Per-section text-only integration (Menu → transformMenuToV2 → generateLayoutV2)', () => {
  it('computes hasImages=false for categories where no items have images', async () => {
    // Simulate real data: "Entrantes" has AI images, "Bebidas" has none
    const entrantesItems: MenuItem[] = [
      makeMenuItem({ id: 'e1', name: 'Patatas Bravas', category: 'Entrantes', imageSource: 'ai', aiImageId: 'img-1', customImageUrl: 'https://example.com/bravas.jpg', order: 0 }),
      makeMenuItem({ id: 'e2', name: 'Croquetas', category: 'Entrantes', imageSource: 'ai', aiImageId: 'img-2', customImageUrl: 'https://example.com/croquetas.jpg', order: 1 }),
      makeMenuItem({ id: 'e3', name: 'Tortilla', category: 'Entrantes', order: 2 }),
    ]
    const bebidasItems: MenuItem[] = [
      makeMenuItem({ id: 'b1', name: 'Agua', category: 'Bebidas', order: 0 }),
      makeMenuItem({ id: 'b2', name: 'Cerveza', category: 'Bebidas', order: 1 }),
      makeMenuItem({ id: 'b3', name: 'Vino Tinto', category: 'Bebidas', order: 2 }),
    ]

    const categories: MenuCategory[] = [
      { id: 'cat-entrantes', name: 'Entrantes', items: entrantesItems, order: 0 },
      { id: 'cat-bebidas', name: 'Bebidas', items: bebidasItems, order: 1 },
    ]
    const flatItems = [...entrantesItems, ...bebidasItems]

    const menu = makeMenu(categories, flatItems)

    // Step 1: Transform
    const engineMenu = transformMenuToV2(menu)

    // Verify hasImages
    const entrantes = engineMenu.sections.find(s => s.name === 'Entrantes')!
    const bebidas = engineMenu.sections.find(s => s.name === 'Bebidas')!

    expect(entrantes.hasImages).toBe(true)
    expect(bebidas.hasImages).toBe(false)

    // Step 2: Generate layout
    const layout = await generateLayoutV2({
      menu: engineMenu,
      templateId: '4-column-portrait',
      selection: {
        fillersEnabled: true,
        imageMode: 'compact-circle',
      },
    })

    const allTiles = layout.pages.flatMap(p => p.tiles)

    // Verify item tiles
    const bebidasItemTiles = allTiles.filter(
      t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
        (t.content as any).sectionId === 'cat-bebidas'
    )
    expect(bebidasItemTiles.length).toBe(3)
    expect(bebidasItemTiles.every(t => t.type === 'ITEM_TEXT_ROW')).toBe(true)
    expect(bebidasItemTiles[0].rowSpan).toBe(1)

    const entrantesItemTiles = allTiles.filter(
      t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
        (t.content as any).sectionId === 'cat-entrantes'
    )
    expect(entrantesItemTiles.length).toBe(3)
    expect(entrantesItemTiles.every(t => t.type === 'ITEM_CARD')).toBe(true)

    // Verify filler tiles
    const bebidasFillers = allTiles.filter(t => t.type === 'FILLER' && t.id.includes('cat-bebidas'))
    const entrantesFillers = allTiles.filter(t => t.type === 'FILLER' && t.id.includes('cat-entrantes'))

    console.log('Bebidas fillers:', bebidasFillers.map(f => ({ id: f.id, rowSpan: f.rowSpan, height: f.height })))
    console.log('Entrantes fillers:', entrantesFillers.map(f => ({ id: f.id, rowSpan: f.rowSpan, height: f.height })))

    if (bebidasFillers.length > 0) {
      // Fillers in Bebidas (no images) match ITEM_TEXT_ROW: 1*70 = 70pt
      expect(bebidasFillers.every(f => f.rowSpan === 1)).toBe(true)
      expect(bebidasFillers.every(f => f.height === 70)).toBe(true)
    }

    if (entrantesFillers.length > 0) {
      // Fillers in Entrantes (has images) match ITEM_CARD: 2*70+8 = 148pt
      expect(entrantesFillers.every(f => f.rowSpan === 2)).toBe(true)
      expect(entrantesFillers.every(f => f.height === 148)).toBe(true)
    }
  })

  it('handles items with imageSource undefined (legacy data)', async () => {
    // Some old items might not have imageSource set at all
    const items: MenuItem[] = [
      { id: 'l1', name: 'Legacy Item 1', price: 5, available: true, order: 0, category: 'Legacy', imageSource: undefined as any },
      { id: 'l2', name: 'Legacy Item 2', price: 7, available: true, order: 1, category: 'Legacy', imageSource: undefined as any },
    ]

    const categories: MenuCategory[] = [
      { id: 'cat-legacy', name: 'Legacy', items, order: 0 },
    ]

    const menu = makeMenu(categories, items)
    const engineMenu = transformMenuToV2(menu)

    const legacySection = engineMenu.sections.find(s => s.name === 'Legacy')!
    // Items with undefined imageSource have no images
    expect(legacySection.hasImages).toBe(false)

    const layout = await generateLayoutV2({
      menu: engineMenu,
      templateId: '4-column-portrait',
      selection: { fillersEnabled: true, imageMode: 'compact-circle' },
    })

    const allTiles = layout.pages.flatMap(p => p.tiles)
    const legacyItemTiles = allTiles.filter(
      t => (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW') &&
        (t.content as any).sectionId === 'cat-legacy'
    )
    // Should use text-only since no images
    expect(legacyItemTiles.every(t => t.type === 'ITEM_TEXT_ROW')).toBe(true)
  })
})
