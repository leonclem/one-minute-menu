import { computeDemoPdfCachePath } from '@/lib/templates/export/demo-pdf-cache'

describe('demo PDF cache key', () => {
  it('is stable across session-variant fields (ids/timestamps/job ids)', async () => {
    const base = {
      name: 'Demo Menu',
      description: 'Some description',
      theme: { name: 'Modern', colors: { background: '#fff' } },
      logoUrl: null,
      imageUrl: '/test.jpg',
      items: [
        { id: 'i1', name: 'Pasta', description: 'Yum', price: 12, category: 'Mains', display_order: 2 },
        { id: 'i2', name: 'Salad', description: null, price: 8, category: 'Starters', display_order: 1 },
      ],
      extractionMetadata: {
        extractedAt: new Date().toISOString(),
        jobId: `demo-job-${Date.now()}`,
      },
      id: `demo-${Date.now()}`,
      slug: `demo-${Math.random()}`,
    }

    const variant = {
      ...base,
      id: `demo-${Date.now() + 999}`,
      slug: `demo-${Math.random()}`,
      extractionMetadata: {
        extractedAt: new Date(Date.now() + 1000).toISOString(),
        jobId: `demo-job-${Date.now() + 1000}`,
      },
      items: [
        // different IDs, same display_order/content
        { id: 'x1', name: 'Pasta', description: 'Yum', price: 12, category: 'Mains', display_order: 2 },
        { id: 'x2', name: 'Salad', description: null, price: 8, category: 'Starters', display_order: 1 },
      ],
    }

    const a = await computeDemoPdfCachePath({
      menu: base,
      templateId: 'classic-cards-v2',
      configuration: { texturesEnabled: true, colourPaletteId: 'midnight-gold' },
      options: { includePageNumbers: true, title: 'Demo Menu' },
    })

    const b = await computeDemoPdfCachePath({
      menu: variant,
      templateId: 'classic-cards-v2',
      configuration: { texturesEnabled: true, colourPaletteId: 'midnight-gold' },
      options: { includePageNumbers: true, title: 'Demo Menu' },
    })

    expect(a.cachePath).toBe(b.cachePath)
  })

  it('changes when render-relevant content changes', async () => {
    const menu1 = {
      name: 'Demo Menu',
      items: [{ name: 'Pasta', price: 12, category: 'Mains', display_order: 1 }],
    }
    const menu2 = {
      name: 'Demo Menu',
      items: [{ name: 'Pasta', price: 13, category: 'Mains', display_order: 1 }],
    }

    const a = await computeDemoPdfCachePath({
      menu: menu1,
      templateId: 'classic-cards-v2',
      configuration: { texturesEnabled: true, colourPaletteId: 'midnight-gold' },
      options: { includePageNumbers: true, title: 'Demo Menu' },
    })

    const b = await computeDemoPdfCachePath({
      menu: menu2,
      templateId: 'classic-cards-v2',
      configuration: { texturesEnabled: true, colourPaletteId: 'midnight-gold' },
      options: { includePageNumbers: true, title: 'Demo Menu' },
    })

    expect(a.cachePath).not.toBe(b.cachePath)
  })
})

