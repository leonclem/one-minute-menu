/**
 * V2 Renderer Tests
 * 
 * Basic tests to verify the renderer components work correctly.
 * These tests validate the core rendering functionality without requiring
 * a full layout engine setup.
 */

import { 
  renderTileContent, 
  getDefaultScale,
  TYPOGRAPHY_TOKENS_V2,
  COLOR_TOKENS_V2,
  type RenderOptionsV2 
} from '../renderer-v2'
import type { TileInstanceV2, LogoContentV2, TitleContentV2, ItemContentV2 } from '../engine-types-v2'

describe('V2 Renderer', () => {
  const defaultOptions: RenderOptionsV2 = {
    scale: 1.0,
    showGridOverlay: false,
    showRegionBounds: false,
    showTileIds: false
  }

  describe('renderTileContent', () => {
    it('should render logo tile content', () => {
      const tile: TileInstanceV2 = {
        id: 'logo-1',
        type: 'LOGO',
        regionId: 'header',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'LOGO',
          imageUrl: 'https://example.com/logo.png',
          venueName: 'Test Restaurant'
        } as LogoContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      expect(result.elements).toHaveLength(1)
      expect(result.elements[0].type).toBe('image')
      expect(result.elements[0].content).toBe('https://example.com/logo.png')
    })

    it('should render title tile content', () => {
      const tile: TileInstanceV2 = {
        id: 'title-1',
        type: 'TITLE',
        regionId: 'title',
        x: 0,
        y: 0,
        width: 400,
        height: 40,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'TITLE',
          menuName: 'Dinner Menu'
        } as TitleContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      expect(result.elements).toHaveLength(1)
      expect(result.elements[0].type).toBe('text')
      expect(result.elements[0].content).toBe('Dinner Menu')
      expect(result.elements[0].style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize['3xl'])
    })

    it('should render item tile content with indicators', () => {
      const tile: TileInstanceV2 = {
        id: 'item-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 148,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Margherita Pizza',
          description: 'Fresh tomatoes, mozzarella, basil',
          price: 12.99,
          imageUrl: 'https://example.com/pizza.jpg',
          showImage: true,
          currency: '$',
          indicators: {
            dietary: ['vegetarian'],
            spiceLevel: null,
            allergens: ['dairy']
          }
        } as ItemContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      // Should have image, name, price, description, and indicators
      expect(result.elements.length).toBeGreaterThan(3)
      
      // Check for image element
      const imageElement = result.elements.find(e => e.type === 'image')
      expect(imageElement).toBeDefined()
      expect(imageElement?.content).toBe('https://example.com/pizza.jpg')
      
      // Check for text elements (name, price, description)
      const textElements = result.elements.filter(e => e.type === 'text')
      expect(textElements.length).toBeGreaterThanOrEqual(3)
      
      // Check for indicator elements
      const indicatorElements = result.elements.filter(e => e.type === 'indicator')
      expect(indicatorElements.length).toBeGreaterThan(0)
    })
  })

  describe('Typography and Color Tokens', () => {
    it('should have consistent typography tokens', () => {
      expect(TYPOGRAPHY_TOKENS_V2.fontSize.base).toBe(14)
      expect(TYPOGRAPHY_TOKENS_V2.fontSize['3xl']).toBe(24)
      expect(TYPOGRAPHY_TOKENS_V2.fontWeight.bold).toBe(700)
      expect(TYPOGRAPHY_TOKENS_V2.lineHeight.normal).toBe(1.4)
    })

    it('should have consistent color tokens', () => {
      expect(COLOR_TOKENS_V2.text.primary).toBe('#111827')
      expect(COLOR_TOKENS_V2.background.white).toBe('#FFFFFF')
      expect(COLOR_TOKENS_V2.indicator.vegetarian).toBe('#10B981')
    })
  })

  describe('Scale Factor', () => {
    it('should provide deterministic default scale', () => {
      const scale1 = getDefaultScale()
      const scale2 = getDefaultScale()
      
      expect(scale1).toBe(scale2)
      expect(scale1).toBe(1.0) // 1 point = 1 pixel
    })
  })

  describe('Image Modes', () => {
    const createItemTile = (imageMode?: string): TileInstanceV2 => ({
      id: 'item-1',
      type: 'ITEM_CARD',
      regionId: 'body',
      x: 0,
      y: 0,
      width: 180,
      height: 200,
      colSpan: 1,
      rowSpan: 2,
      gridRow: 0,
      gridCol: 0,
      layer: 'content',
      content: {
        type: 'ITEM_CARD',
        itemId: 'item-1',
        sectionId: 'section-1',
        name: 'Test Item',
        description: 'Test description',
        price: 10.99,
        imageUrl: 'https://example.com/image.jpg',
        showImage: true,
        currency: '$'
      } as ItemContentV2
    })

    it('should render stretch mode (default) with full-width image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'stretch'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      expect(imageElement?.width).toBeLessThanOrEqual(tile.width - 16) // Account for padding
      expect(imageElement?.style.borderRadius).toBe(4)
    })

    it('should render compact-rect mode with smaller centered image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'compact-rect'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      // Image should be smaller (60% of tile width)
      expect(imageElement?.width).toBeLessThan(tile.width * 0.7)
      // Should be centered (x position should center the image)
      const expectedX = (tile.width - (imageElement?.width || 0)) / 2
      expect(Math.abs((imageElement?.x || 0) - expectedX)).toBeLessThan(1)
      // Height should maintain 4:3 aspect
      const expectedHeight = (imageElement?.width || 0) * 0.75
      expect(Math.abs((imageElement?.height || 0) - expectedHeight)).toBeLessThan(1)
    })

    it('should render compact-circle mode with circular image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'compact-circle'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      // Should be square (width === height)
      expect(imageElement?.width).toBe(imageElement?.height)
      // BorderRadius should be 50% for circle
      const expectedRadius = (imageElement?.width || 0) / 2
      expect(imageElement?.style.borderRadius).toBe(expectedRadius)
      // Should be centered
      const expectedX = (tile.width - (imageElement?.width || 0)) / 2
      expect(Math.abs((imageElement?.x || 0) - expectedX)).toBeLessThan(1)
    })

    it('should render background mode with full-tile image and gradient overlay', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'background'
      }

      const result = renderTileContent(tile, options)
      
      // Should have background image at full tile size
      const bgImage = result.elements.find(e => e.type === 'image' && e.width === tile.width && e.height === tile.height)
      expect(bgImage).toBeDefined()
      expect(bgImage?.x).toBe(0)
      expect(bgImage?.y).toBe(0)
      
      // Should have gradient overlay
      const gradientOverlay = result.elements.find(e => 
        e.type === 'background' && 
        e.width === tile.width && 
        e.height === tile.height &&
        e.style.background?.includes('linear-gradient')
      )
      expect(gradientOverlay).toBeDefined()
      
      // Text should be white/light for readability
      const textElements = result.elements.filter(e => e.type === 'text')
      textElements.forEach(textEl => {
        const color = textEl.style.color
        expect(color).toMatch(/^#(fff|ffffff|f5f5f5|FFF|FFFFFF|F5F5F5)/i)
      })
    })

    it('should ensure no elements exceed tile bounds', () => {
      const modes: Array<'stretch' | 'compact-rect' | 'compact-circle' | 'background'> = 
        ['stretch', 'compact-rect', 'compact-circle', 'background']
      
      modes.forEach(mode => {
        const tile = createItemTile()
        const options: RenderOptionsV2 = {
          ...defaultOptions,
          imageMode: mode
        }

        const result = renderTileContent(tile, options)
        
        result.elements.forEach(element => {
          // Check that element doesn't exceed tile bounds
          expect(element.x).toBeGreaterThanOrEqual(0)
          expect(element.y).toBeGreaterThanOrEqual(0)
          expect((element.x || 0) + (element.width || 0)).toBeLessThanOrEqual(tile.width)
          expect((element.y || 0) + (element.height || 0)).toBeLessThanOrEqual(tile.height)
        })
      })
    })
  })
})