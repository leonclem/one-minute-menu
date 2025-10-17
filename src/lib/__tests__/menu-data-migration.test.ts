/**
 * Tests for Menu Data Migration Utilities
 */

import {
  migrateStage1ToStage2,
  flattenCategoriesToItems,
  ensureBackwardCompatibility,
  validateMenuDataConsistency,
  prepareMenuForPublishing,
  getAllMenuItems,
  updateMenuItem,
} from '../menu-data-migration'
import type { Menu, MenuItem, MenuCategory } from '@/types'

describe('Menu Data Migration', () => {
  const mockTheme = {
    id: 'default',
    name: 'Default',
    colors: {
      primary: '#000',
      secondary: '#fff',
      accent: '#f00',
      background: '#fff',
      text: '#000',
      extractionConfidence: 1.0,
    },
    fonts: {
      primary: 'Inter',
      secondary: 'Inter',
      sizes: { heading: '1.5rem', body: '1rem', price: '1.125rem' },
    },
    layout: {
      style: 'modern' as const,
      spacing: 'comfortable' as const,
      itemLayout: 'list' as const,
    },
    wcagCompliant: true,
    mobileOptimized: true,
  }

  const createMockMenu = (overrides?: Partial<Menu>): Menu => ({
    id: 'menu-1',
    userId: 'user-1',
    name: 'Test Menu',
    slug: 'test-menu',
    items: [],
    theme: mockTheme,
    version: 1,
    status: 'draft',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const createMockItem = (overrides?: Partial<MenuItem>): MenuItem => ({
    id: `item-${Math.random()}`,
    name: 'Test Item',
    description: 'Test description',
    price: 10,
    available: true,
    order: 0,
    imageSource: 'none',
    ...overrides,
  })

  describe('migrateStage1ToStage2', () => {
    it('should create categories from flat items array', () => {
      const menu = createMockMenu({
        items: [
          createMockItem({ name: 'Burger', category: 'Mains', order: 0 }),
          createMockItem({ name: 'Fries', category: 'Sides', order: 1 }),
          createMockItem({ name: 'Steak', category: 'Mains', order: 2 }),
        ],
      })

      const migrated = migrateStage1ToStage2(menu)

      expect(migrated.categories).toBeDefined()
      expect(migrated.categories?.length).toBe(2)
      
      const mainsCategory = migrated.categories?.find(c => c.name === 'Mains')
      expect(mainsCategory?.items.length).toBe(2)
      
      const sidesCategory = migrated.categories?.find(c => c.name === 'Sides')
      expect(sidesCategory?.items.length).toBe(1)
    })

    it('should handle items without categories', () => {
      const menu = createMockMenu({
        items: [
          createMockItem({ name: 'Item 1' }),
          createMockItem({ name: 'Item 2' }),
        ],
      })

      const migrated = migrateStage1ToStage2(menu)

      expect(migrated.categories).toBeDefined()
      expect(migrated.categories?.length).toBe(1)
      expect(migrated.categories?.[0].name).toBe('Uncategorized')
      expect(migrated.categories?.[0].items.length).toBe(2)
    })

    it('should not migrate if categories already exist', () => {
      const existingCategories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Existing',
          items: [createMockItem()],
          order: 0,
        },
      ]

      const menu = createMockMenu({
        items: [createMockItem()],
        categories: existingCategories,
      })

      const migrated = migrateStage1ToStage2(menu)

      expect(migrated.categories).toBe(existingCategories)
    })

    it('should add extraction metadata', () => {
      const menu = createMockMenu({
        items: [createMockItem({ confidence: 0.9 })],
      })

      const migrated = migrateStage1ToStage2(menu)

      expect(migrated.extractionMetadata).toBeDefined()
      expect(migrated.extractionMetadata?.schemaVersion).toBe('stage1')
      expect(migrated.extractionMetadata?.confidence).toBe(0.9)
    })
  })

  describe('flattenCategoriesToItems', () => {
    it('should flatten categories to items array', () => {
      const categories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Mains',
          items: [
            createMockItem({ name: 'Burger' }),
            createMockItem({ name: 'Steak' }),
          ],
          order: 0,
        },
        {
          id: 'cat-2',
          name: 'Sides',
          items: [createMockItem({ name: 'Fries' })],
          order: 1,
        },
      ]

      const items = flattenCategoriesToItems(categories)

      expect(items.length).toBe(3)
      expect(items[0].name).toBe('Burger')
      expect(items[0].category).toBe('Mains')
      expect(items[2].name).toBe('Fries')
      expect(items[2].category).toBe('Sides')
    })

    it('should handle nested subcategories', () => {
      const categories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Food',
          items: [],
          order: 0,
          subcategories: [
            {
              id: 'cat-2',
              name: 'Mains',
              items: [createMockItem({ name: 'Burger' })],
              order: 0,
            },
          ],
        },
      ]

      const items = flattenCategoriesToItems(categories)

      expect(items.length).toBe(1)
      expect(items[0].category).toBe('Food > Mains')
    })

    it('should reorder items sequentially', () => {
      const categories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Cat1',
          items: [
            createMockItem({ order: 5 }),
            createMockItem({ order: 10 }),
          ],
          order: 0,
        },
      ]

      const items = flattenCategoriesToItems(categories)

      expect(items[0].order).toBe(0)
      expect(items[1].order).toBe(1)
    })
  })

  describe('ensureBackwardCompatibility', () => {
    it('should flatten categories to items if items is empty', () => {
      const categories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Mains',
          items: [createMockItem({ name: 'Burger' })],
          order: 0,
        },
      ]

      const menu = createMockMenu({
        items: [],
        categories,
      })

      const result = ensureBackwardCompatibility(menu)

      expect(result.items.length).toBe(1)
      expect(result.items[0].name).toBe('Burger')
    })

    it('should create categories from items if categories is empty', () => {
      const menu = createMockMenu({
        items: [createMockItem({ name: 'Burger', category: 'Mains' })],
        categories: undefined,
      })

      const result = ensureBackwardCompatibility(menu)

      expect(result.categories).toBeDefined()
      expect(result.categories?.length).toBeGreaterThan(0)
    })

    it('should not modify menu if both items and categories exist', () => {
      const items = [createMockItem()]
      const categories: MenuCategory[] = [
        {
          id: 'cat-1',
          name: 'Mains',
          items: [items[0]],
          order: 0,
        },
      ]

      const menu = createMockMenu({ items, categories })
      const result = ensureBackwardCompatibility(menu)

      expect(result.items).toBe(items)
      expect(result.categories).toBe(categories)
    })
  })

  describe('validateMenuDataConsistency', () => {
    it('should validate consistent menu data', () => {
      const item = createMockItem()
      const menu = createMockMenu({
        items: [item],
        categories: [
          {
            id: 'cat-1',
            name: 'Mains',
            items: [item],
            order: 0,
          },
        ],
      })

      const result = validateMenuDataConsistency(menu)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should detect item count mismatch', () => {
      const menu = createMockMenu({
        items: [createMockItem(), createMockItem()],
        categories: [
          {
            id: 'cat-1',
            name: 'Mains',
            items: [createMockItem()],
            order: 0,
          },
        ],
      })

      const result = validateMenuDataConsistency(menu)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('mismatch'))).toBe(true)
    })

    it('should detect duplicate item IDs', () => {
      const duplicateId = 'duplicate-id'
      const menu = createMockMenu({
        items: [
          createMockItem({ id: duplicateId }),
          createMockItem({ id: duplicateId }),
        ],
      })

      const result = validateMenuDataConsistency(menu)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true)
    })
  })

  describe('prepareMenuForPublishing', () => {
    it('should validate menu with valid data', () => {
      const menu = createMockMenu({
        items: [createMockItem({ name: 'Burger', price: 10 })],
      })

      const result = prepareMenuForPublishing(menu)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject menu with no items', () => {
      const menu = createMockMenu({ items: [] })

      const result = prepareMenuForPublishing(menu)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('at least one item'))).toBe(true)
    })

    it('should reject items with missing names', () => {
      const menu = createMockMenu({
        items: [createMockItem({ name: '' })],
      })

      const result = prepareMenuForPublishing(menu)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('missing a name'))).toBe(true)
    })

    it('should reject items with invalid prices', () => {
      const menu = createMockMenu({
        items: [createMockItem({ price: -5 })],
      })

      const result = prepareMenuForPublishing(menu)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('invalid price'))).toBe(true)
    })
  })

  describe('getAllMenuItems', () => {
    it('should return items from flat array when no categories', () => {
      const items = [createMockItem(), createMockItem()]
      const menu = createMockMenu({ items })

      const result = getAllMenuItems(menu)

      expect(result).toBe(items)
    })

    it('should return flattened items from categories when they exist', () => {
      const menu = createMockMenu({
        items: [],
        categories: [
          {
            id: 'cat-1',
            name: 'Mains',
            items: [createMockItem({ name: 'Burger' })],
            order: 0,
          },
        ],
      })

      const result = getAllMenuItems(menu)

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Burger')
    })
  })

  describe('updateMenuItem', () => {
    it('should update item in flat items array', () => {
      const item = createMockItem({ id: 'item-1', name: 'Old Name' })
      const menu = createMockMenu({ items: [item] })

      const result = updateMenuItem(menu, 'item-1', { name: 'New Name' })

      expect(result.items[0].name).toBe('New Name')
    })

    it('should update item in categories', () => {
      const item = createMockItem({ id: 'item-1', name: 'Old Name' })
      const menu = createMockMenu({
        items: [item],
        categories: [
          {
            id: 'cat-1',
            name: 'Mains',
            items: [item],
            order: 0,
          },
        ],
      })

      const result = updateMenuItem(menu, 'item-1', { name: 'New Name' })

      expect(result.categories?.[0].items[0].name).toBe('New Name')
    })

    it('should update item in nested subcategories', () => {
      const item = createMockItem({ id: 'item-1', name: 'Old Name' })
      const menu = createMockMenu({
        items: [item],
        categories: [
          {
            id: 'cat-1',
            name: 'Food',
            items: [],
            order: 0,
            subcategories: [
              {
                id: 'cat-2',
                name: 'Mains',
                items: [item],
                order: 0,
              },
            ],
          },
        ],
      })

      const result = updateMenuItem(menu, 'item-1', { name: 'New Name' })

      expect(result.categories?.[0].subcategories?.[0].items[0].name).toBe('New Name')
    })
  })
})
