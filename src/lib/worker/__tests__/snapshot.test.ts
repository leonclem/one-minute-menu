/**
 * Unit tests for render snapshot creation
 */

import { createRenderSnapshot, getRenderSnapshot, SnapshotCreationError } from '../snapshot'
import type { RenderSnapshot } from '@/types'

// Mock Supabase client
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('../../supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: mockFrom
  }))
}))

describe('createRenderSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variable for URL validation
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create a complete snapshot with all required fields', async () => {
    // Mock menu data
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Menu',
      user_id: 'user-123',
      logo_url: 'https://test.supabase.co/storage/v1/object/public/logos/logo.png',
      menu_data: {
        description: 'A test menu',
        establishment_name: 'Test Restaurant',
        establishment_address: '123 Test St',
        establishment_phone: '+65 1234 5678',
        currency: 'SGD',
        items: [
          {
            id: 'item-1',
            name: 'Test Item',
            description: 'A test item',
            price: 10.50,
            category: 'Appetizers',
            order: 0,
            customImageUrl: 'https://test.supabase.co/storage/v1/object/public/images/item1.png'
          }
        ],
        categories: [
          {
            name: 'Appetizers',
            order: 0
          }
        ]
      }
    }

    // Mock Supabase response
    mockSingle.mockResolvedValue({
      data: mockMenu,
      error: null
    })

    const snapshot = await createRenderSnapshot(
      'menu-123',
      'elegant-dark',
      {
        template_id: 'elegant-dark',
        format: 'A4',
        orientation: 'portrait',
        include_images: true,
        include_prices: true
      }
    )

    // Verify snapshot structure
    expect(snapshot).toBeDefined()
    expect(snapshot.template_id).toBe('elegant-dark')
    expect(snapshot.template_version).toBe('1.0')
    expect(snapshot.template_name).toBe('Elegant Dark')
    
    expect(snapshot.menu_data.id).toBe('menu-123')
    expect(snapshot.menu_data.name).toBe('Test Menu')
    expect(snapshot.menu_data.establishment_name).toBe('Test Restaurant')
    expect(snapshot.menu_data.items).toHaveLength(1)
    expect(snapshot.menu_data.items[0].name).toBe('Test Item')
    expect(snapshot.menu_data.items[0].price).toBe(10.50)
    
    expect(snapshot.export_options.format).toBe('A4')
    expect(snapshot.export_options.orientation).toBe('portrait')
    
    expect(snapshot.snapshot_version).toBe('2.0')
    expect(snapshot.snapshot_created_at).toBeDefined()
  })

  it('should handle menus with modifiers and variants', async () => {
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Menu',
      user_id: 'user-123',
      menu_data: {
        items: [
          {
            id: 'item-1',
            name: 'Pizza',
            price: 15.00,
            modifierGroups: [
              {
                id: 'mod-1',
                name: 'Size',
                options: [
                  { name: 'Small', priceDelta: -2 },
                  { name: 'Large', priceDelta: 3 }
                ]
              }
            ],
            variants: [
              {
                id: 'var-1',
                size: 'Medium',
                price: 15.00
              },
              {
                id: 'var-2',
                size: 'Large',
                price: 18.00
              }
            ]
          }
        ]
      }
    }

    mockSingle.mockResolvedValue({
      data: mockMenu,
      error: null
    })

    const snapshot = await createRenderSnapshot(
      'menu-123',
      'elegant-dark',
      {
        template_id: 'elegant-dark'
      }
    )

    const item = snapshot.menu_data.items[0]
    expect(item.modifiers).toHaveLength(1)
    expect(item.modifiers![0].name).toBe('Size')
    expect(item.modifiers![0].options).toHaveLength(2)
    expect(item.modifiers![0].options[0].price_adjustment).toBe(-2)
    
    expect(item.variants).toHaveLength(2)
    expect(item.variants![0].name).toBe('Medium')
    expect(item.variants![1].price).toBe(18.00)
  })

  it('should throw error for non-existent menu', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: null
    })

    await expect(
      createRenderSnapshot('invalid-menu', 'elegant-dark', { template_id: 'elegant-dark' })
    ).rejects.toThrow(SnapshotCreationError)
    
    await expect(
      createRenderSnapshot('invalid-menu', 'elegant-dark', { template_id: 'elegant-dark' })
    ).rejects.toThrow('Menu not found')
  })

  it('should throw error for invalid template', async () => {
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Menu',
      menu_data: { items: [] }
    }

    mockSingle.mockResolvedValue({
      data: mockMenu,
      error: null
    })

    await expect(
      createRenderSnapshot('menu-123', 'invalid-template', { template_id: 'invalid-template' })
    ).rejects.toThrow(SnapshotCreationError)
    
    await expect(
      createRenderSnapshot('menu-123', 'invalid-template', { template_id: 'invalid-template' })
    ).rejects.toThrow('Template not found')
  })

  it('should throw error for untrusted image URLs', async () => {
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Menu',
      logo_url: 'https://evil.com/malicious.png',
      menu_data: {
        items: []
      }
    }

    mockSingle.mockResolvedValue({
      data: mockMenu,
      error: null
    })

    await expect(
      createRenderSnapshot('menu-123', 'elegant-dark', { template_id: 'elegant-dark' })
    ).rejects.toThrow(SnapshotCreationError)
    
    await expect(
      createRenderSnapshot('menu-123', 'elegant-dark', { template_id: 'elegant-dark' })
    ).rejects.toThrow('Untrusted image URL')
  })

  it('should use default export options when not provided', async () => {
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Menu',
      menu_data: { items: [] }
    }

    mockSingle.mockResolvedValue({
      data: mockMenu,
      error: null
    })

    const snapshot = await createRenderSnapshot(
      'menu-123',
      'elegant-dark',
      { template_id: 'elegant-dark' }
    )

    expect(snapshot.export_options.format).toBe('A4')
    expect(snapshot.export_options.orientation).toBe('portrait')
    expect(snapshot.export_options.include_images).toBe(true)
    expect(snapshot.export_options.include_prices).toBe(true)
  })
})

describe('getRenderSnapshot', () => {
  it('should extract snapshot from job metadata', () => {
    const mockSnapshot: RenderSnapshot = {
      template_id: 'elegant-dark',
      template_version: '1.0',
      template_name: 'Elegant Dark',
      menu_data: {
        id: 'menu-123',
        name: 'Test Menu',
        items: []
      },
      export_options: {
        format: 'A4',
        orientation: 'portrait'
      },
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '1.0'
    }

    const jobMetadata = {
      menu_name: 'Test Menu',
      render_snapshot: mockSnapshot
    }

    const snapshot = getRenderSnapshot(jobMetadata)
    expect(snapshot).toEqual(mockSnapshot)
  })

  it('should throw error when snapshot is missing', () => {
    const jobMetadata = {
      menu_name: 'Test Menu'
    }

    expect(() => getRenderSnapshot(jobMetadata)).toThrow(SnapshotCreationError)
    expect(() => getRenderSnapshot(jobMetadata)).toThrow('Render snapshot missing')
  })

  it('should throw error when snapshot is invalid', () => {
    const invalidSnapshot = {
      template_id: 'elegant-dark'
      // Missing required fields
    }

    const jobMetadata = {
      render_snapshot: invalidSnapshot
    }

    expect(() => getRenderSnapshot(jobMetadata)).toThrow(SnapshotCreationError)
    expect(() => getRenderSnapshot(jobMetadata)).toThrow('Snapshot validation failed')
  })

  it('should validate all required snapshot fields', () => {
    const incompleteSnapshot = {
      template_id: 'elegant-dark',
      template_version: '1.0',
      // Missing other required fields
    }

    const jobMetadata = {
      render_snapshot: incompleteSnapshot
    }

    expect(() => getRenderSnapshot(jobMetadata)).toThrow(SnapshotCreationError)
    
    try {
      getRenderSnapshot(jobMetadata)
    } catch (error) {
      if (error instanceof SnapshotCreationError) {
        expect(error.details?.errors).toContain('Snapshot missing template_name')
        expect(error.details?.errors).toContain('Snapshot missing menu_data')
        expect(error.details?.errors).toContain('Snapshot missing export_options')
      }
    }
  })

  it('should demonstrate snapshot immutability - snapshot is frozen at creation time', () => {
    // This test demonstrates the immutability concept:
    // Once a snapshot is created and stored in job metadata, it doesn't change
    // even if the original data source is modified.

    const originalSnapshot: RenderSnapshot = {
      template_id: 'elegant-dark',
      template_version: '1.0',
      template_name: 'Elegant Dark',
      menu_data: {
        id: 'menu-123',
        name: 'Original Menu Name',
        description: 'Original description',
        items: [
          {
            id: 'item-1',
            name: 'Original Item',
            description: 'Original item description',
            price: 10.00,
            currency: 'SGD',
            category: 'Appetizers',
            display_order: 0
          }
        ]
      },
      export_options: {
        format: 'A4',
        orientation: 'portrait'
      },
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '1.0'
    }

    // Store snapshot in job metadata (simulating job creation)
    const jobMetadata = {
      menu_name: 'Original Menu Name',
      render_snapshot: originalSnapshot
    }

    // Simulate menu being edited after job creation
    // (In reality, this would be a database update, but here we just create new data)
    const updatedMenuData = {
      id: 'menu-123',
      name: 'Updated Menu Name',
      description: 'Updated description',
      items: [
        {
          id: 'item-1',
          name: 'Updated Item',
          description: 'Updated item description',
          price: 20.00,
          currency: 'SGD',
          category: 'Main Courses',
          display_order: 0
        }
      ]
    }

    // Retrieve snapshot from job metadata (simulating worker processing)
    const retrievedSnapshot = getRenderSnapshot(jobMetadata)

    // CRITICAL ASSERTION: Retrieved snapshot should match original, not updated data
    expect(retrievedSnapshot.menu_data.name).toBe('Original Menu Name')
    expect(retrievedSnapshot.menu_data.name).not.toBe('Updated Menu Name')
    
    expect(retrievedSnapshot.menu_data.description).toBe('Original description')
    expect(retrievedSnapshot.menu_data.description).not.toBe('Updated description')
    
    expect(retrievedSnapshot.menu_data.items[0].name).toBe('Original Item')
    expect(retrievedSnapshot.menu_data.items[0].name).not.toBe('Updated Item')
    
    expect(retrievedSnapshot.menu_data.items[0].price).toBe(10.00)
    expect(retrievedSnapshot.menu_data.items[0].price).not.toBe(20.00)

    // Verify snapshot is identical to original (deep equality)
    expect(retrievedSnapshot).toEqual(originalSnapshot)

    // This demonstrates that the snapshot is immutable:
    // - It's frozen at job creation time
    // - Workers read from the snapshot, not from current menu state
    // - Menu edits don't affect in-progress exports
  })
})
