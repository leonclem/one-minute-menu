import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { PageRenderer } from '../renderer-web-v2'
import type { PageLayoutV2, PageSpecV2, TileInstanceV2, FlagshipCardContentV2 } from '../engine-types-v2'
import type { RenderOptionsV2 } from '../renderer-v2'

function makeFlagshipTile(name: string): TileInstanceV2 {
  return {
    id: `flagship-${name}`,
    type: 'FLAGSHIP_CARD',
    regionId: 'body',
    x: 0,
    y: 0,
    width: 360,
    height: 148,
    colSpan: 2,
    rowSpan: 2,
    gridRow: 0,
    gridCol: 0,
    layer: 'content',
    contentBudget: {
      nameLines: 2,
      descLines: 4,
      indicatorAreaHeight: 16,
      imageBoxHeight: 84,
      paddingTop: 8,
      paddingBottom: 8,
      totalHeight: 148,
    },
    content: {
      type: 'FLAGSHIP_CARD',
      itemId: `item-${name}`,
      sectionId: 'section-1',
      name,
      description: `${name} description`,
      price: 26,
      imageUrl: `https://example.com/${name}.jpg`,
      showImage: true,
      currency: 'USD',
      indicators: { dietary: ['vegetarian'], spiceLevel: 1, allergens: [] },
    } as FlagshipCardContentV2,
  }
}

const pageSpec: PageSpecV2 = {
  id: 'A4_PORTRAIT',
  width: 595.28,
  height: 841.89,
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
}

const basePage: PageLayoutV2 = {
  pageIndex: 0,
  pageType: 'SINGLE',
  regions: [
    {
      id: 'body',
      x: 0,
      y: 0,
      width: 515.28,
      height: 700,
    },
  ],
  tiles: [],
}

const baseOptions: RenderOptionsV2 = {
  scale: 1,
  showGridOverlay: false,
  showRegionBounds: false,
  showTileIds: false,
}

describe('renderer-web-v2 flagship rendering', () => {
  it('renders flagship cards with semantic article markup and text-first DOM order', () => {
    const tile = makeFlagshipTile('Grilled Salmon')

    render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{ ...baseOptions, imageMode: 'stretch' }}
      />
    )

    const article = screen.getByLabelText('Flagship item: Grilled Salmon')
    const heading = screen.getByRole('heading', { name: 'Grilled Salmon' })
    const image = screen.getByAltText('Photo of Grilled Salmon')

    expect(article.tagName).toBe('ARTICLE')
    expect(screen.getByText('House Special')).toBeInTheDocument()
    expect(article).toContainElement(heading)
    expect(article).toContainElement(image)
    expect(heading.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['stretch', true],
    ['compact-rect', true],
    ['compact-circle', true],
    ['cutout', true],
    ['background', false],
    ['none', false],
  ] as const)('renders flagship content correctly in %s mode', (imageMode, expectsInlineImage) => {
    const tile = makeFlagshipTile(`Mode ${imageMode}`)

    render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{ ...baseOptions, imageMode }}
      />
    )

    expect(screen.getByLabelText(`Flagship item: Mode ${imageMode}`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: `Mode ${imageMode}` })).toBeInTheDocument()
    expect(screen.getByText(/26/)).toBeInTheDocument()
    expect(screen.getByText(`Mode ${imageMode} description`)).toBeInTheDocument()

    if (expectsInlineImage) {
      expect(screen.getByAltText(`Photo of Mode ${imageMode}`)).toBeInTheDocument()
    } else {
      expect(screen.queryByAltText(`Photo of Mode ${imageMode}`)).not.toBeInTheDocument()
    }
  })

  it('renders compact-circle flagship images inside a circular frame in the web preview', () => {
    const tile = makeFlagshipTile('Circular Flagship')

    render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{ ...baseOptions, imageMode: 'compact-circle' }}
      />
    )

    const image = screen.getByAltText('Photo of Circular Flagship')
    const frame = image.parentElement as HTMLElement | null

    expect(frame).not.toBeNull()

    const frameWidth = parseFloat(frame!.style.width)
    const frameHeight = parseFloat(frame!.style.height)
    const frameRadius = parseFloat(frame!.style.borderRadius)
    const imageRadius = parseFloat((image as HTMLImageElement).style.borderRadius)

    expect(frameWidth).toBeCloseTo(frameHeight, 5)
    expect(frameRadius).toBeCloseTo(frameWidth / 2, 5)
    expect(imageRadius).toBeCloseTo(frameWidth / 2, 5)
  })

  it('keeps background-mode flagship images decorative while preserving readable text', () => {
    const tile = makeFlagshipTile('Flagship Stew')
    const { container } = render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{ ...baseOptions, imageMode: 'background' }}
      />
    )

    const article = screen.getByLabelText('Flagship item: Flagship Stew')
    const decorativeImage = container.querySelector('img[aria-hidden="true"]')
    const imageFrame = decorativeImage?.parentElement as HTMLElement | null

    expect(screen.getByLabelText('Flagship item: Flagship Stew')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flagship Stew' })).toBeInTheDocument()
    expect(screen.queryByAltText('Photo of Flagship Stew')).not.toBeInTheDocument()
    expect(imageFrame).not.toBeNull()
    expect(imageFrame).toHaveStyle('overflow: hidden')
    expect(article).toHaveStyle('border: 7px solid #7f5f14')
    expect(article).toContainElement(decorativeImage!)
  })

  it('clips stretch-mode flagship images to the media frame', () => {
    const tile = makeFlagshipTile('Clipped Stretch')

    render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{ ...baseOptions, imageMode: 'stretch' }}
      />
    )

    const image = screen.getByAltText('Photo of Clipped Stretch')
    expect(image.parentElement).toHaveStyle({ overflow: 'hidden' })
  })

  it('uses custom flagship badge label from tile style in the web preview', () => {
    const tile = {
      ...makeFlagshipTile('Custom Badge'),
      style: {
        badge: {
          label: 'Editor Choice',
          position: 'right',
          borderRadius: 10,
        },
      },
    } as TileInstanceV2

    render(
      <PageRenderer
        page={{ ...basePage, tiles: [tile] }}
        pageSpec={pageSpec}
        options={{
          ...baseOptions,
          imageMode: 'stretch',
          palette: {
            id: 'custom',
            name: 'Custom',
            colors: {
              background: '#FFFFFF',
              surface: '#F7F4EC',
              menuTitle: '#111111',
              sectionHeader: '#111111',
              itemTitle: '#111111',
              itemPrice: '#5C3D00',
              itemDescription: '#555555',
              itemIndicators: { background: '#FFFFFF' },
              border: { light: '#E5E7EB', medium: '#D1D5DB' },
              textMuted: '#888888',
              bannerSurface: '#F7F4EC',
              bannerText: '#111111',
              footerBorder: '#E5E7EB',
              footerText: '#111111',
              promoted: {
                featured: { background: '#F7F1D9', border: '#8C6A11', badgeFill: '#234F1E', badgeText: '#FFFDEA' },
                flagship: { background: '#EEF5E8', border: '#2F5E2A', badgeFill: '#1F4D2E', badgeText: '#FFFBEA', price: '#315B2C' },
              },
            },
          },
        }}
      />
    )

    expect(screen.getByText('Editor Choice')).toBeInTheDocument()
    expect(screen.queryByText('House Special')).not.toBeInTheDocument()
  })
})
