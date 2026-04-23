import { generateLayoutV2 } from '../layout-engine-v2'
import type { EngineItemV2, EngineMenuV2, TileInstanceV2 } from '../engine-types-v2'

const baseIndicators = { dietary: [], allergens: [], spiceLevel: null as number | null }

function makeItem(id: string, sortOrder: number, overrides: Partial<EngineItemV2> = {}): EngineItemV2 {
  return {
    id,
    name: `Item ${id}`,
    description: `Description for ${id}`,
    price: 10 + sortOrder,
    imageUrl: `https://example.com/${id}.jpg`,
    sortOrder,
    indicators: baseIndicators,
    ...overrides,
  }
}

function overlaps(a: TileInstanceV2, b: TileInstanceV2): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

describe('Body tile mode integrations', () => {
  it('embeds the body logo only in the first non-empty section', async () => {
    const menu: EngineMenuV2 = {
      id: 'logo-first-non-empty',
      name: 'First Non-Empty Logo Menu',
      sections: [
        {
          id: 'sec-empty',
          name: 'Empty',
          sortOrder: 0,
          items: [],
        },
        {
          id: 'sec-1',
          name: 'Mains',
          sortOrder: 1,
          items: [makeItem('main-1', 0), makeItem('main-2', 1)],
        },
        {
          id: 'sec-2',
          name: 'Desserts',
          sortOrder: 2,
          items: [makeItem('dessert-1', 0)],
        },
      ],
      metadata: {
        currency: '$',
        venueName: 'Logo Venue',
        logoUrl: 'https://example.com/logo.png',
      },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        showBanner: false,
        showLogoTile: true,
        showCategoryHeaderTiles: true,
      },
    })

    const bodyLogos = document.pages.flatMap(page =>
      page.tiles.filter(tile => tile.type === 'LOGO' && tile.regionId === 'body')
    )

    expect(bodyLogos).toHaveLength(1)
    expect((bodyLogos[0].content as { sectionId?: string }).sectionId).toBe('sec-1')
  })

  it('does not render an embedded body logo when all sections are empty', async () => {
    const menu: EngineMenuV2 = {
      id: 'logo-no-sections',
      name: 'Empty Logo Menu',
      sections: [
        { id: 'sec-empty-1', name: 'Empty 1', sortOrder: 0, items: [] },
        { id: 'sec-empty-2', name: 'Empty 2', sortOrder: 1, items: [] },
      ],
      metadata: {
        currency: '$',
        venueName: 'Logo Venue',
        logoUrl: 'https://example.com/logo.png',
      },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        showBanner: false,
        showLogoTile: true,
      },
    })

    const bodyLogos = document.pages.flatMap(page =>
      page.tiles.filter(tile => tile.type === 'LOGO' && tile.regionId === 'body')
    )

    expect(bodyLogos).toHaveLength(0)
  })

  it('renders a flagship once on the section-start page and never repeats it on continuation pages', async () => {
    const menu: EngineMenuV2 = {
      id: 'flagship-multipage',
      name: 'Flagship Multipage Menu',
      sections: [
        {
          id: 'sec-1',
          name: 'Starters',
          sortOrder: 0,
          items: Array.from({ length: 16 }, (_, index) => makeItem(`starter-${index + 1}`, index)),
        },
        {
          id: 'sec-2',
          name: 'Mains',
          sortOrder: 1,
          items: [
            makeItem('flagship-main', 0, {
              name: 'Flagship Main',
              isFlagship: true,
              isFeatured: true,
            }),
            ...Array.from({ length: 17 }, (_, index) => makeItem(`main-${index + 1}`, index + 1)),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Test Venue' },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: { showFlagshipTile: true },
    })

    const sectionTwoPages = document.pages
      .map((page, pageIndex) => {
        const headerTiles = page.tiles.filter(
          tile =>
            tile.type === 'SECTION_HEADER' &&
            (tile.content as { sectionId?: string }).sectionId === 'sec-2'
        )
        const sectionTiles = page.tiles.filter(
          tile => (tile.content as { sectionId?: string }).sectionId === 'sec-2'
        )
        const flagshipTiles = page.tiles.filter(
          tile =>
            tile.type === 'FLAGSHIP_CARD' &&
            (tile.content as { itemId?: string }).itemId === 'flagship-main'
        )

        return {
          pageIndex,
          hasHeader: headerTiles.length > 0,
          hasSectionContent: sectionTiles.length > 0,
          flagshipCount: flagshipTiles.length,
        }
      })
      .filter(page => page.hasHeader || page.hasSectionContent)

    const regularFlagshipTiles = document.pages.flatMap(page =>
      page.tiles.filter(
        tile =>
          (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') &&
          (tile.content as { itemId?: string }).itemId === 'flagship-main'
      )
    )

    expect(sectionTwoPages.length).toBeGreaterThan(1)
    expect(sectionTwoPages[0].hasHeader).toBe(true)
    expect(sectionTwoPages[0].flagshipCount).toBe(1)
    expect(sectionTwoPages.slice(1).every(page => page.flagshipCount === 0)).toBe(true)
    expect(regularFlagshipTiles).toHaveLength(0)
  })

  it('shows the body-grid logo only on the first page and never duplicates the header logo', async () => {
    const menu: EngineMenuV2 = {
      id: 'logo-tile-multipage',
      name: 'Logo Tile Menu',
      sections: [
        {
          id: 'sec-1',
          name: 'All Day',
          sortOrder: 0,
          items: Array.from({ length: 24 }, (_, index) => makeItem(`logo-item-${index + 1}`, index)),
        },
      ],
      metadata: {
        currency: '$',
        venueName: 'Logo Venue',
        logoUrl: 'https://example.com/logo.png',
      },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: { showBanner: false, showLogoTile: true },
    })

    const logoTiles = document.pages.flatMap((page, pageIndex) =>
      page.tiles
        .filter(tile => tile.type === 'LOGO')
        .map(tile => ({ pageIndex, regionId: tile.regionId }))
    )

    expect(document.pages.length).toBeGreaterThan(1)
    expect(logoTiles.filter(tile => tile.regionId === 'header')).toHaveLength(0)
    expect(logoTiles.filter(tile => tile.regionId === 'body')).toEqual([
      { pageIndex: 0, regionId: 'body' },
    ])
  })

  it('repeats only the section header on continuation pages when feature tiles are enabled', async () => {
    const menu: EngineMenuV2 = {
      id: 'continuation-lead-row',
      name: 'Continuation Lead Row Menu',
      sections: [
        {
          id: 'sec-1',
          name: 'Chef Specials',
          sortOrder: 0,
          items: [
            makeItem('flagship-special', 0, {
              name: 'Flagship Special',
              isFlagship: true,
              isFeatured: true,
            }),
            ...Array.from({ length: 23 }, (_, index) => makeItem(`special-${index + 1}`, index + 1)),
          ],
        },
      ],
      metadata: {
        currency: '$',
        venueName: 'Continuation Venue',
        logoUrl: 'https://example.com/logo.png',
      },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        showBanner: false,
        showLogoTile: true,
        showCategoryHeaderTiles: true,
        showFlagshipTile: true,
      },
    })

    const pagesWithSectionContent = document.pages
      .map((page, pageIndex) => ({
        pageIndex,
        pageType: page.pageType,
        headers: page.tiles.filter(
          tile =>
            tile.type === 'SECTION_HEADER' &&
            (tile.content as { sectionId?: string }).sectionId === 'sec-1'
        ),
        logos: page.tiles.filter(tile => tile.type === 'LOGO' && tile.regionId === 'body'),
        flagships: page.tiles.filter(
          tile =>
            tile.type === 'FLAGSHIP_CARD' &&
            (tile.content as { sectionId?: string }).sectionId === 'sec-1'
        ),
        items: page.tiles.filter(
          tile =>
            (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') &&
            (tile.content as { sectionId?: string }).sectionId === 'sec-1'
        ),
      }))
      .filter(page => page.headers.length > 0 || page.items.length > 0 || page.flagships.length > 0)

    expect(pagesWithSectionContent.length).toBeGreaterThan(1)
    expect(pagesWithSectionContent[0].logos).toHaveLength(1)
    expect(pagesWithSectionContent[0].flagships).toHaveLength(1)

    pagesWithSectionContent.slice(1).forEach(page => {
      expect(page.headers.length).toBeGreaterThan(0)
      expect(page.logos).toHaveLength(0)
      expect(page.flagships).toHaveLength(0)
    })
  })

  it('uses occupancy-based filler placement around flagship tiles without overlaps', async () => {
    const menu: EngineMenuV2 = {
      id: 'flagship-fillers',
      name: 'Flagship Fillers Menu',
      sections: [
        {
          id: 'sec-1',
          name: 'Chef Specials',
          sortOrder: 0,
          items: [
            makeItem('flagship-special', 0, { name: 'Flagship Special', isFlagship: true }),
            makeItem('special-2', 1),
            makeItem('special-3', 2),
            makeItem('special-4', 3),
            makeItem('special-5', 4),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Test Venue' },
    }

    const document = await generateLayoutV2({
      menu,
      templateId: '4-column-portrait',
      selection: {
        showBanner: false,
        showLogoTile: true,
        showCategoryHeaderTiles: true,
        showFlagshipTile: true,
        fillersEnabled: true,
      },
    })

    const bodyTiles = document.pages.flatMap(page => page.tiles.filter(tile => tile.regionId === 'body'))
    const flagshipTiles = bodyTiles.filter(tile => tile.type === 'FLAGSHIP_CARD')
    const logoTiles = bodyTiles.filter(tile => tile.type === 'LOGO')
    const headerTiles = bodyTiles.filter(tile => tile.type === 'SECTION_HEADER')
    const fillers = bodyTiles.filter(tile => tile.type === 'FILLER')
    const contentTiles = bodyTiles.filter(tile => tile.type !== 'FILLER')
    const regularFlagshipTiles = bodyTiles.filter(
      tile =>
        (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') &&
        (tile.content as { itemId?: string }).itemId === 'flagship-special'
    )

    expect(flagshipTiles).toHaveLength(1)
    expect(logoTiles).toHaveLength(1)
    expect(headerTiles).toHaveLength(1)
    expect(regularFlagshipTiles).toHaveLength(0)

    // Verify that if fillers are present, they don't overlap with content tiles
    // (With logo + header + flagship in a 4-column lead row, there may be limited room for fillers)
    for (const filler of fillers) {
      for (const tile of contentTiles) {
        expect(overlaps(filler, tile)).toBe(false)
      }
    }
  })
})
