/**
 * Menu Transformer V2 Tests
 */

import { transformMenuToV2, isEngineMenuV2 } from '../menu-transformer-v2'
import type { Menu, MenuItem } from '@/types'

describe('Menu Transformer V2', () => {
  const mockMenuItem: MenuItem = {
    id: 'item-1',
    name: 'Test Item',
    description: 'A test item',
    price: 12.99,
    available: true,
    order: 0,
    imageSource: 'none',
  }

  const mockMenu: Menu = {
    id: 'menu-1',
    userId: 'user-1',
    name: 'Test Menu',
    slug: 'test-menu',
    items: [mockMenuItem],
    theme: {
      id: 'theme-1',
      name: 'Test Theme',
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
        accent: '#ff0000',
        background: '#ffffff',
        text: '#000000',
        extractionConfidence: 1.0,
      },
      fonts: {
        primary: 'Inter',
        secondary: 'Inter',
        sizes: {
          heading: '24px',
          body: '16px',
          price: '18px',
        },
      },
      layout: {
        style: 'modern',
        spacing: 'comfortable',
        itemLayout: 'list',
        currency: '£',
      },
      wcagCompliant: true,
      mobileOptimized: true,
    },
    version: 1,
    status: 'published',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('transformMenuToV2', () => {
    it('should transform a basic menu correctly', () => {
      const result = transformMenuToV2(mockMenu)

      expect(result.id).toBe('menu-1')
      expect(result.name).toBe('Test Menu')
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].name).toBe('Menu')
      expect(result.sections[0].items).toHaveLength(1)
      expect(result.metadata.currency).toBe('£')
      expect(result.metadata.venueName).toBe('Test Menu')
    })

    it('should handle items with categories', () => {
      const menuWithCategories: Menu = {
        ...mockMenu,
        items: [
          { ...mockMenuItem, id: 'item-1', category: 'Starters', order: 0 },
          { ...mockMenuItem, id: 'item-2', category: 'Mains', order: 1 },
          { ...mockMenuItem, id: 'item-3', category: 'Starters', order: 2 },
        ],
      }

      const result = transformMenuToV2(menuWithCategories)

      expect(result.sections).toHaveLength(2)
      expect(result.sections.find(s => s.name === 'Starters')?.items).toHaveLength(2)
      expect(result.sections.find(s => s.name === 'Mains')?.items).toHaveLength(1)
    })

    it('should set default indicator values', () => {
      const result = transformMenuToV2(mockMenu)

      const item = result.sections[0].items[0]
      expect(item.indicators.dietary).toEqual([])
      expect(item.indicators.allergens).toEqual([])
      expect(item.indicators.spiceLevel).toBeNull()
    })

    it('should handle AI-generated images', () => {
      const menuWithAIImage: Menu = {
        ...mockMenu,
        items: [
          {
            ...mockMenuItem,
            imageSource: 'ai',
            aiImageId: 'ai-123',
            customImageUrl: 'https://example.com/ai-image.jpg',
          },
        ],
      }

      const result = transformMenuToV2(menuWithAIImage)

      expect(result.sections[0].items[0].imageUrl).toBe('https://example.com/ai-image.jpg')
    })

    it('should handle custom images', () => {
      const menuWithCustomImage: Menu = {
        ...mockMenu,
        items: [
          {
            ...mockMenuItem,
            imageSource: 'custom',
            customImageUrl: 'https://example.com/custom-image.jpg',
          },
        ],
      }

      const result = transformMenuToV2(menuWithCustomImage)

      expect(result.sections[0].items[0].imageUrl).toBe('https://example.com/custom-image.jpg')
    })

    it('should handle empty menus gracefully', () => {
      const emptyMenu: Menu = {
        ...mockMenu,
        items: [],
      }

      const result = transformMenuToV2(emptyMenu)

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].name).toBe('Menu')
      expect(result.sections[0].items).toHaveLength(0)
    })

    it('should respect transform options', () => {
      const options = {
        currency: '$',
        venueName: 'Custom Venue',
        venueAddress: '123 Main St',
        logoUrl: 'https://example.com/logo.png',
      }

      const result = transformMenuToV2(mockMenu, options)

      expect(result.metadata.currency).toBe('$')
      expect(result.metadata.venueName).toBe('Custom Venue')
      expect(result.metadata.venueAddress).toBe('123 Main St')
      expect(result.metadata.logoUrl).toBe('https://example.com/logo.png')
    })

    it('should produce deterministic output', () => {
      const result1 = transformMenuToV2(mockMenu)
      const result2 = transformMenuToV2(mockMenu)

      expect(result1).toEqual(result2)
    })
  })

  describe('isEngineMenuV2', () => {
    it('should validate correct EngineMenuV2 objects', () => {
      const result = transformMenuToV2(mockMenu)
      expect(isEngineMenuV2(result)).toBe(true)
    })

    it('should reject invalid objects', () => {
      expect(isEngineMenuV2(null)).toBe(false)
      expect(isEngineMenuV2({})).toBe(false)
      expect(isEngineMenuV2({ id: 'test' })).toBe(false)
    })
  })
})