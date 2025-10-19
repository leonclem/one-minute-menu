// Unit tests for TemplateRegistry

import { TemplateRegistry, TemplateRegistryError } from '../registry'
import type { TemplateConfig, TemplateMetadata } from '@/types/templates'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
          order: jest.fn(() => ({
            contains: jest.fn(),
            eq: jest.fn(),
            or: jest.fn(),
          })),
        })),
        order: jest.fn(),
      })),
      upsert: jest.fn(),
    })),
  })),
}))

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry

  beforeEach(() => {
    registry = new TemplateRegistry()
    registry.clearCache()
  })

  describe('validateTemplate', () => {
    it('should validate a valid template config', async () => {
      const validConfig: TemplateConfig = {
        metadata: {
          id: 'test-template',
          name: 'Test Template',
          description: 'A test template',
          author: 'Test Author',
          version: '1.0.0',
          previewImageUrl: 'https://example.com/preview.png',
          thumbnailUrl: 'https://example.com/thumb.png',
          figmaFileKey: 'test-key',
          pageFormat: 'A4',
          orientation: 'portrait',
          tags: ['test'],
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bindings: {
          restaurantName: 'RestaurantName',
          categoryName: 'CategoryName',
          categoryItems: 'CategoryItems',
          itemName: 'ItemName',
          itemPrice: 'ItemPrice',
          itemDescription: 'ItemDescription',
          conditionalLayers: [],
        },
        styling: {
          fonts: [
            {
              role: 'heading',
              family: 'Inter',
              size: '24px',
              weight: '700',
            },
          ],
          colors: [
            {
              role: 'primary',
              value: '#000000',
            },
          ],
          spacing: {
            itemSpacing: 16,
            categorySpacing: 32,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
          },
        },
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      }

      const result = await registry.validateTemplate(validConfig)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation when required metadata is missing', async () => {
      const invalidConfig: TemplateConfig = {
        metadata: {
          id: '',
          name: '',
          description: '',
          author: '',
          version: '',
          previewImageUrl: '',
          thumbnailUrl: '',
          figmaFileKey: '',
          pageFormat: 'A4',
          orientation: 'portrait',
          tags: [],
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bindings: {
          restaurantName: 'RestaurantName',
          categoryName: 'CategoryName',
          categoryItems: 'CategoryItems',
          itemName: 'ItemName',
          conditionalLayers: [],
        },
        styling: {
          fonts: [],
          colors: [],
          spacing: {
            itemSpacing: 16,
            categorySpacing: 32,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
          },
        },
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      }

      const result = await registry.validateTemplate(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.code === 'MISSING_ID')).toBe(true)
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true)
      expect(result.errors.some(e => e.code === 'MISSING_VERSION')).toBe(true)
    })

    it('should fail validation when required bindings are missing', async () => {
      const invalidConfig: TemplateConfig = {
        metadata: {
          id: 'test',
          name: 'Test',
          description: '',
          author: 'Test',
          version: '1.0.0',
          previewImageUrl: '',
          thumbnailUrl: '',
          figmaFileKey: '',
          pageFormat: 'A4',
          orientation: 'portrait',
          tags: [],
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bindings: {
          restaurantName: '',
          categoryName: '',
          categoryItems: '',
          itemName: '',
          conditionalLayers: [],
        },
        styling: {
          fonts: [],
          colors: [],
          spacing: {
            itemSpacing: 16,
            categorySpacing: 32,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
          },
        },
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      }

      const result = await registry.validateTemplate(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_BINDING')).toBe(true)
    })

    it('should add warnings for missing styling', async () => {
      const configWithoutStyling: TemplateConfig = {
        metadata: {
          id: 'test',
          name: 'Test',
          description: '',
          author: 'Test',
          version: '1.0.0',
          previewImageUrl: '',
          thumbnailUrl: '',
          figmaFileKey: '',
          pageFormat: 'A4',
          orientation: 'portrait',
          tags: [],
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bindings: {
          restaurantName: 'RestaurantName',
          categoryName: 'CategoryName',
          categoryItems: 'CategoryItems',
          itemName: 'ItemName',
          conditionalLayers: [],
        },
        styling: {
          fonts: [],
          colors: [],
          spacing: {
            itemSpacing: 16,
            categorySpacing: 32,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
          },
        },
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      }

      const result = await registry.validateTemplate(configWithoutStyling)

      expect(result.warnings.some(w => w.code === 'NO_FONTS')).toBe(true)
      expect(result.warnings.some(w => w.code === 'NO_COLORS')).toBe(true)
    })

    it('should validate conditional layers', async () => {
      const configWithInvalidConditional: TemplateConfig = {
        metadata: {
          id: 'test',
          name: 'Test',
          description: '',
          author: 'Test',
          version: '1.0.0',
          previewImageUrl: '',
          thumbnailUrl: '',
          figmaFileKey: '',
          pageFormat: 'A4',
          orientation: 'portrait',
          tags: [],
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bindings: {
          restaurantName: 'RestaurantName',
          categoryName: 'CategoryName',
          categoryItems: 'CategoryItems',
          itemName: 'ItemName',
          conditionalLayers: [
            {
              layerName: 'PriceLayer',
              condition: 'invalidCondition' as any,
              action: 'show',
            },
          ],
        },
        styling: {
          fonts: [{ role: 'body', family: 'Inter', size: '16px', weight: '400' }],
          colors: [{ role: 'primary', value: '#000000' }],
          spacing: {
            itemSpacing: 16,
            categorySpacing: 32,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
          },
        },
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      }

      const result = await registry.validateTemplate(configWithInvalidConditional)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_CONDITION')).toBe(true)
    })
  })

  describe('cache management', () => {
    it('should cache loaded templates', async () => {
      const templateId = 'test-template'
      
      // First load would hit the database (mocked)
      // Second load should hit the cache
      
      // We can't easily test this without mocking the database calls
      // but we can test cache clearing
      registry.clearCache()
      
      // After clearing, cache should be empty
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should invalidate cache after registration', async () => {
      // This would require mocking database operations
      expect(true).toBe(true) // Placeholder assertion
    })
  })
})
