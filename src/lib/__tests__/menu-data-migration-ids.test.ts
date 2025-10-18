/**
 * Tests for menu item ID migration from old format to UUIDs
 */

import { migrateItemIdsToUUIDs } from '../menu-data-migration'
import type { Menu, MenuItem } from '@/types'

describe('migrateItemIdsToUUIDs', () => {
  const createMockMenu = (items: MenuItem[]): Menu => ({
    id: 'menu-123',
    userId: 'user-123',
    name: 'Test Menu',
    slug: 'test-menu',
    items,
    theme: {
      id: 'default',
      name: 'Default',
      colors: {
        primary: '#000',
        secondary: '#fff',
        accent: '#ccc',
        background: '#fff',
        text: '#000',
        extractionConfidence: 1,
      },
      fonts: {
        primary: 'Arial',
        secondary: 'Arial',
        sizes: { heading: '24px', body: '16px', price: '18px' },
      },
      layout: {
        style: 'modern',
        spacing: 'comfortable',
        itemLayout: 'list',
      },
      wcagCompliant: true,
      mobileOptimized: true,
    },
    version: 1,
    status: 'draft',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  it('should migrate old-style item IDs to UUIDs', () => {
    const menu = createMockMenu([
      {
        id: 'item_abc123',
        name: 'Test Item 1',
        description: 'Description',
        price: 10,
        category: 'Food',
        available: true,
        order: 0,
        imageSource: 'none',
      },
      {
        id: 'item_def456',
        name: 'Test Item 2',
        description: 'Description',
        price: 15,
        category: 'Food',
        available: true,
        order: 1,
        imageSource: 'none',
      },
    ])

    const migrated = migrateItemIdsToUUIDs(menu)

    // Check that IDs were changed
    expect(migrated.items[0].id).not.toBe('item_abc123')
    expect(migrated.items[1].id).not.toBe('item_def456')

    // Check that new IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(migrated.items[0].id).toMatch(uuidRegex)
    expect(migrated.items[1].id).toMatch(uuidRegex)

    // Check that other properties are preserved
    expect(migrated.items[0].name).toBe('Test Item 1')
    expect(migrated.items[1].name).toBe('Test Item 2')
  })

  it('should not modify items that already have UUIDs', () => {
    const validUuid1 = '550e8400-e29b-41d4-a716-446655440000'
    const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

    const menu = createMockMenu([
      {
        id: validUuid1,
        name: 'Test Item 1',
        description: 'Description',
        price: 10,
        category: 'Food',
        available: true,
        order: 0,
        imageSource: 'none',
      },
      {
        id: validUuid2,
        name: 'Test Item 2',
        description: 'Description',
        price: 15,
        category: 'Food',
        available: true,
        order: 1,
        imageSource: 'none',
      },
    ])

    const migrated = migrateItemIdsToUUIDs(menu)

    // IDs should remain unchanged
    expect(migrated.items[0].id).toBe(validUuid1)
    expect(migrated.items[1].id).toBe(validUuid2)
  })

  it('should handle mixed old and new IDs', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    const menu = createMockMenu([
      {
        id: 'item_abc123',
        name: 'Old ID Item',
        description: 'Description',
        price: 10,
        category: 'Food',
        available: true,
        order: 0,
        imageSource: 'none',
      },
      {
        id: validUuid,
        name: 'UUID Item',
        description: 'Description',
        price: 15,
        category: 'Food',
        available: true,
        order: 1,
        imageSource: 'none',
      },
    ])

    const migrated = migrateItemIdsToUUIDs(menu)

    // Old ID should be migrated
    expect(migrated.items[0].id).not.toBe('item_abc123')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(migrated.items[0].id).toMatch(uuidRegex)

    // Valid UUID should remain unchanged
    expect(migrated.items[1].id).toBe(validUuid)
  })

  it('should handle empty items array', () => {
    const menu = createMockMenu([])
    const migrated = migrateItemIdsToUUIDs(menu)
    expect(migrated.items).toEqual([])
  })

  it('should migrate category IDs if present', () => {
    const menu = createMockMenu([
      {
        id: 'item_abc123',
        name: 'Test Item',
        description: 'Description',
        price: 10,
        category: 'Food',
        available: true,
        order: 0,
        imageSource: 'none',
      },
    ])

    menu.categories = [
      {
        id: 'cat_xyz789',
        name: 'Food',
        items: [menu.items[0]],
        order: 0,
        confidence: 1,
      },
    ]

    const migrated = migrateItemIdsToUUIDs(menu)

    // Category ID should be migrated
    expect(migrated.categories![0].id).not.toBe('cat_xyz789')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(migrated.categories![0].id).toMatch(uuidRegex)

    // Item ID in category should also be migrated
    expect(migrated.categories![0].items[0].id).not.toBe('item_abc123')
    expect(migrated.categories![0].items[0].id).toMatch(uuidRegex)
  })
})
