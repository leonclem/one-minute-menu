/**
 * Unit tests for menu-transformer.ts
 * 
 * Tests the transformation of database Menu objects to EngineMenu format.
 */

import { describe, it, expect } from '@jest/globals'
import {
  toEngineMenu,
  isEngineMenu,
  isEngineSection,
  isEngineItem,
  type EngineMenu,
  type EngineSection,
  type EngineItem
} from '../menu-transformer'
import type { Menu, MenuItem, MenuCategory, MenuTheme } from '@/types'

// Helper to create a minimal theme
function createMinimalTheme(): MenuTheme {
  return {
    id: 'test-theme',
    name: 'Test Theme',
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
      accent: '#ff0000',
      background: '#ffffff',
      text: '#000000',
      extractionConfidence: 1.0
    },
    fonts: {
      primary: 'Inter',
      secondary: 'Inter',
      sizes: {
        heading: '24px',
        body: '16px',
        price: '18px'
      }
    },
    layout: {
      style: 'modern',
      spacing: 'comfortable',
      itemLayout: 'list',
      currency: '$'
    },
    wcagCompliant: true,
    mobileOptimized: true
  }
}

// Helper to create a test menu item
function createTestItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: `item-${Math.random()}`,
    name: 'Test Item',
    description: 'Test description',
    price: 10.99,
    available: true,
    category: undefined,
    order: 0,
    imageSource: 'none',
    ...overrides
  }
}

// Helper to create a test category
function createTestCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: `cat-${Math.random()}`,
    name: 'Test Category',
    items: [],
    order: 0,
    ...overrides
  }
}

// Helper to create a test menu
function createTestMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    id: `menu-${Math.random()}`,
    userId: 'user-1',
    name: 'Test Menu',
    slug: 'test-menu',
    items: [],
    theme: createMinimalTheme(),
    version: 1,
    status: 'draft',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('menu-transformer', () => {
  describe('Type Guards', () => {
    it('should validate EngineItem correctly', () => {
      const validItem: EngineItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious burger',
        price: 12.99,
        imageUrl: 'https://example.com/burger.jpg',
        sortOrder: 0
      }
      
      expect(isEngineItem(validItem)).toBe(true)
      expect(isEngineItem(null)).toBe(false)
      expect(isEngineItem({})).toBe(false)
      expect(isEngineItem({ id: 'item-1' })).toBe(false)
    })
    
    it('should validate EngineSection correctly', () => {
      const validSection: EngineSection = {
        id: 'section-1',
        name: 'Appetizers',
        sortOrder: 0,
        items: []
      }
      
      expect(isEngineSection(validSection)).toBe(true)
      expect(isEngineSection(null)).toBe(false)
      expect(isEngineSection({})).toBe(false)
    })
    
    it('should validate EngineMenu correctly', () => {
      const validMenu: EngineMenu = {
        id: 'menu-1',
        name: 'Test Menu',
        sections: [],
        metadata: {
          currency: '$',
          venueName: 'Test Restaurant'
        }
      }
      
      expect(isEngineMenu(validMenu)).toBe(true)
      expect(isEngineMenu(null)).toBe(false)
      expect(isEngineMenu({})).toBe(false)
    })
  })
  
  describe('toEngineMenu', () => {
    describe('Categorized Menus', () => {
      it('should convert menu with categories to sections', () => {
        const menu = createTestMenu({
          categories: [
            createTestCategory({
              id: 'cat-1',
              name: 'Appetizers',
              order: 0,
              items: [
                createTestItem({ id: 'item-1', name: 'Spring Rolls', price: 8.99, order: 0 }),
                createTestItem({ id: 'item-2', name: 'Dumplings', price: 9.99, order: 1 })
              ]
            }),
            createTestCategory({
              id: 'cat-2',
              name: 'Main Courses',
              order: 1,
              items: [
                createTestItem({ id: 'item-3', name: 'Pad Thai', price: 14.99, order: 0 })
              ]
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(2)
        expect(engineMenu.sections[0].name).toBe('Appetizers')
        expect(engineMenu.sections[0].items).toHaveLength(2)
        expect(engineMenu.sections[1].name).toBe('Main Courses')
        expect(engineMenu.sections[1].items).toHaveLength(1)
      })
      
      it('should preserve sortOrder for sections', () => {
        const menu = createTestMenu({
          categories: [
            createTestCategory({ 
              id: 'cat-1', 
              name: 'Desserts', 
              order: 2,
              items: [createTestItem({ id: 'item-1', name: 'Ice Cream' })]
            }),
            createTestCategory({ 
              id: 'cat-2', 
              name: 'Appetizers', 
              order: 0,
              items: [createTestItem({ id: 'item-2', name: 'Soup' })]
            }),
            createTestCategory({ 
              id: 'cat-3', 
              name: 'Main Courses', 
              order: 1,
              items: [createTestItem({ id: 'item-3', name: 'Steak' })]
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].name).toBe('Appetizers')
        expect(engineMenu.sections[0].sortOrder).toBe(0)
        expect(engineMenu.sections[1].name).toBe('Main Courses')
        expect(engineMenu.sections[1].sortOrder).toBe(1)
        expect(engineMenu.sections[2].name).toBe('Desserts')
        expect(engineMenu.sections[2].sortOrder).toBe(2)
      })
      
      it('should preserve sortOrder for items within sections', () => {
        const menu = createTestMenu({
          categories: [
            createTestCategory({
              id: 'cat-1',
              name: 'Appetizers',
              items: [
                createTestItem({ id: 'item-3', name: 'Item C', order: 2 }),
                createTestItem({ id: 'item-1', name: 'Item A', order: 0 }),
                createTestItem({ id: 'item-2', name: 'Item B', order: 1 })
              ]
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].items[0].name).toBe('Item A')
        expect(engineMenu.sections[0].items[1].name).toBe('Item B')
        expect(engineMenu.sections[0].items[2].name).toBe('Item C')
      })
    })
    
    describe('Flat Menus', () => {
      it('should create implicit "Menu" section for flat menus', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({ id: 'item-1', name: 'Burger', price: 12.99, order: 0 }),
            createTestItem({ id: 'item-2', name: 'Pizza', price: 14.99, order: 1 }),
            createTestItem({ id: 'item-3', name: 'Salad', price: 9.99, order: 2 })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(1)
        expect(engineMenu.sections[0].name).toBe('Menu')
        expect(engineMenu.sections[0].id).toBe('implicit-section')
        expect(engineMenu.sections[0].items).toHaveLength(3)
      })
      
      it('should preserve sortOrder for items in flat menus', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({ id: 'item-3', name: 'Item C', order: 2 }),
            createTestItem({ id: 'item-1', name: 'Item A', order: 0 }),
            createTestItem({ id: 'item-2', name: 'Item B', order: 1 })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].items[0].name).toBe('Item A')
        expect(engineMenu.sections[0].items[1].name).toBe('Item B')
        expect(engineMenu.sections[0].items[2].name).toBe('Item C')
      })
      
      it('should handle flat menu with no categories array', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({ id: 'item-1', name: 'Test Item', price: 10.99 })
          ],
          categories: undefined
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(1)
        expect(engineMenu.sections[0].name).toBe('Menu')
      })
      
      it('should handle flat menu with empty categories array', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({ id: 'item-1', name: 'Test Item', price: 10.99 })
          ],
          categories: []
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(1)
        expect(engineMenu.sections[0].name).toBe('Menu')
      })
    })
    
    describe('Metadata Extraction', () => {
      it('should extract currency from theme', () => {
        const menu = createTestMenu({
          theme: {
            ...createMinimalTheme(),
            layout: {
              style: 'modern',
              spacing: 'comfortable',
              itemLayout: 'list',
              currency: '£'
            }
          }
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.metadata.currency).toBe('£')
      })
      
      it('should use default currency when not specified', () => {
        const menu = createTestMenu({
          theme: {
            ...createMinimalTheme(),
            layout: {
              style: 'modern',
              spacing: 'comfortable',
              itemLayout: 'list'
            }
          }
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.metadata.currency).toBe('$')
      })
      
      it('should set venueName to menu name', () => {
        const menu = createTestMenu({
          name: 'The Golden Dragon'
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.metadata.venueName).toBe('The Golden Dragon')
      })
      
      it('should set venueAddress to undefined (not yet implemented)', () => {
        const menu = createTestMenu()
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.metadata.venueAddress).toBeUndefined()
      })
    })
    
    describe('Image URL Handling', () => {
      it('should extract custom image URLs', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({
              id: 'item-1',
              name: 'Burger',
              imageSource: 'custom',
              customImageUrl: 'https://example.com/burger.jpg'
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].items[0].imageUrl).toBe('https://example.com/burger.jpg')
      })
      
      it('should return undefined for AI images (not yet implemented)', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({
              id: 'item-1',
              name: 'Burger',
              imageSource: 'ai',
              aiImageId: 'ai-image-123'
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].items[0].imageUrl).toBeUndefined()
      })
      
      it('should return undefined for items with no image', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({
              id: 'item-1',
              name: 'Burger',
              imageSource: 'none'
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections[0].items[0].imageUrl).toBeUndefined()
      })
    })
    
    describe('Edge Cases', () => {
      it('should handle menu with no items', () => {
        const menu = createTestMenu({
          items: [],
          categories: []
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(1)
        expect(engineMenu.sections[0].items).toHaveLength(0)
      })
      
      it('should handle categories with no items', () => {
        const menu = createTestMenu({
          categories: [
            createTestCategory({ id: 'cat-1', name: 'Empty Category', items: [] })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        expect(engineMenu.sections).toHaveLength(1)
        expect(engineMenu.sections[0].items).toHaveLength(0)
      })
      
      it('should handle items with missing order field', () => {
        const menu = createTestMenu({
          items: [
            createTestItem({ id: 'item-1', name: 'Item 1', order: undefined as any }),
            createTestItem({ id: 'item-2', name: 'Item 2', order: undefined as any })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        // Should use fallback order (array index)
        expect(engineMenu.sections[0].items[0].sortOrder).toBe(0)
        expect(engineMenu.sections[0].items[1].sortOrder).toBe(1)
      })
      
      it('should handle categories with missing order field', () => {
        const menu = createTestMenu({
          categories: [
            createTestCategory({ 
              id: 'cat-1', 
              name: 'Cat 1', 
              order: undefined as any,
              items: [createTestItem({ id: 'item-1', name: 'Item 1' })]
            }),
            createTestCategory({ 
              id: 'cat-2', 
              name: 'Cat 2', 
              order: undefined as any,
              items: [createTestItem({ id: 'item-2', name: 'Item 2' })]
            })
          ]
        })
        
        const engineMenu = toEngineMenu(menu)
        
        // Should use fallback order (array index)
        expect(engineMenu.sections[0].sortOrder).toBe(0)
        expect(engineMenu.sections[1].sortOrder).toBe(1)
      })
    })
  })
})
