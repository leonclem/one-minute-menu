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
})