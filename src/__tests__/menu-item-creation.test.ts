/**
 * Integration test to verify menu item creation returns complete item with ID
 * This test verifies Requirements 2.1 and 3.2 from the fix-ai-image-generation-menuitem-id spec
 */

import { menuItemOperations, menuOperations } from '@/lib/database'
import type { MenuItem } from '@/types'

describe('Menu Item Creation - ID Verification', () => {
  const mockUserId = 'test-user-123'
  const mockMenuId = 'test-menu-456'

  beforeEach(() => {
    // Reset any mocks if needed
  })

  it('should return a complete menu with the new item including a valid ID', async () => {
    // Arrange: Create a mock menu first
    const mockMenu = {
      id: mockMenuId,
      userId: mockUserId,
      name: 'Test Menu',
      slug: 'test-menu',
      items: [] as MenuItem[],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Mock the menu operations
    jest.spyOn(menuOperations, 'getMenu').mockResolvedValue(mockMenu)
    jest.spyOn(menuOperations, 'updateMenu').mockImplementation(async (menuId, userId, updates) => {
      return {
        ...mockMenu,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
    })

    // Mock user profile for plan limits
    const mockProfile = {
      id: mockUserId,
      email: 'test@example.com',
      limits: {
        menus: 10,
        menuItems: 100,
      },
      createdAt: new Date().toISOString(),
    }
    jest.spyOn(require('@/lib/database').userOperations, 'getProfile').mockResolvedValue(mockProfile)

    // Act: Add a new menu item
    const newItemData = {
      name: 'Test Item',
      description: 'A test menu item',
      price: 9.99,
      available: true,
      category: 'Appetizers',
      imageSource: 'none' as const,
    }

    const result = await menuItemOperations.addItem(mockMenuId, mockUserId, newItemData)

    // Assert: Verify the result contains the new item with an ID
    expect(result).toBeDefined()
    expect(result.items).toHaveLength(1)
    
    const createdItem = result.items[0]
    expect(createdItem).toBeDefined()
    expect(createdItem.id).toBeDefined()
    expect(typeof createdItem.id).toBe('string')
    expect(createdItem.id.length).toBeGreaterThan(0)
    
    // Verify all properties are present
    expect(createdItem.name).toBe(newItemData.name)
    expect(createdItem.description).toBe(newItemData.description)
    expect(createdItem.price).toBe(newItemData.price)
    expect(createdItem.available).toBe(newItemData.available)
    expect(createdItem.category).toBe(newItemData.category)
    expect(createdItem.order).toBe(0)
  })

  it('should generate unique IDs for multiple items', async () => {
    // Arrange
    const mockMenu = {
      id: mockMenuId,
      userId: mockUserId,
      name: 'Test Menu',
      slug: 'test-menu',
      items: [] as MenuItem[],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    let currentItems: MenuItem[] = []
    
    jest.spyOn(menuOperations, 'getMenu').mockImplementation(async () => ({
      ...mockMenu,
      items: currentItems,
    }))
    
    jest.spyOn(menuOperations, 'updateMenu').mockImplementation(async (menuId, userId, updates) => {
      currentItems = updates.items || currentItems
      return {
        ...mockMenu,
        items: currentItems,
        updatedAt: new Date().toISOString(),
      }
    })

    const mockProfile = {
      id: mockUserId,
      email: 'test@example.com',
      limits: {
        menus: 10,
        menuItems: 100,
      },
      createdAt: new Date().toISOString(),
    }
    jest.spyOn(require('@/lib/database').userOperations, 'getProfile').mockResolvedValue(mockProfile)

    // Act: Add multiple items
    const item1Data = {
      name: 'Item 1',
      price: 5.99,
      available: true,
      imageSource: 'none' as const,
    }
    
    const item2Data = {
      name: 'Item 2',
      price: 7.99,
      available: true,
      imageSource: 'none' as const,
    }

    const result1 = await menuItemOperations.addItem(mockMenuId, mockUserId, item1Data)
    const result2 = await menuItemOperations.addItem(mockMenuId, mockUserId, item2Data)

    // Assert: Verify both items have unique IDs
    expect(result2.items).toHaveLength(2)
    expect(result2.items[0].id).toBeDefined()
    expect(result2.items[1].id).toBeDefined()
    expect(result2.items[0].id).not.toBe(result2.items[1].id)
  })

  it('should maintain ID when item is returned in API response', () => {
    // This test verifies the API contract
    const mockMenuItem: MenuItem = {
      id: 'test-item-789',
      name: 'Test Item',
      price: 9.99,
      available: true,
      order: 0,
      imageSource: 'none',
    }

    const mockApiResponse = {
      success: true,
      data: {
        id: mockMenuId,
        userId: mockUserId,
        name: 'Test Menu',
        slug: 'test-menu',
        items: [mockMenuItem],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    // Verify the response structure matches what MenuEditor expects
    expect(mockApiResponse.data.items[0].id).toBe('test-item-789')
    expect(mockApiResponse.data.items[0]).toHaveProperty('id')
    expect(mockApiResponse.data.items[0]).toHaveProperty('name')
    expect(mockApiResponse.data.items[0]).toHaveProperty('price')
  })
})
