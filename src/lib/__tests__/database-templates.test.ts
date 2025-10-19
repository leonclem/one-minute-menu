/**
 * Tests for Template Database Operations
 */

import { templateOperations, DatabaseError } from '@/lib/database'
import type {
  TemplateConfig,
  TemplateMetadata,
  TemplateRender,
  UserTemplatePreference,
  TemplateFilters,
  RenderResult,
  UserCustomization,
} from '@/types/templates'

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
}))

describe('Template Operations', () => {
  const mockTemplateConfig: TemplateConfig = {
    metadata: {
      id: 'template-1',
      name: 'The View',
      description: 'A clean, modern template',
      author: 'Test Author',
      version: '1.0.0',
      previewImageUrl: 'https://example.com/preview.png',
      thumbnailUrl: 'https://example.com/thumb.png',
      figmaFileKey: 'figma-key-123',
      pageFormat: 'A4',
      orientation: 'portrait',
      tags: ['modern', 'clean'],
      isPremium: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    bindings: {
      restaurantName: 'RestaurantName',
      categoryName: 'CategoryName',
      categoryItems: 'ItemsContainer',
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
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        },
      },
    },
    customization: {
      allowColorCustomization: true,
      allowFontCustomization: false,
      customizableColors: ['primary'],
      customizableFonts: [],
    },
  }

  const mockRenderResult: RenderResult = {
    html: '<div>Test HTML</div>',
    css: '.test { color: red; }',
    assets: [],
    metadata: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      renderedAt: new Date(),
      itemCount: 10,
      categoryCount: 3,
      estimatedPrintSize: 'A4',
    },
  }

  const mockCustomization: UserCustomization = {
    colors: {
      primary: '#FF0000',
    },
    priceDisplayMode: 'symbol',
  }

  describe('createTemplate', () => {
    it('should have createTemplate function', () => {
      expect(typeof templateOperations.createTemplate).toBe('function')
    })
  })

  describe('getTemplate', () => {
    it('should have getTemplate function', () => {
      expect(typeof templateOperations.getTemplate).toBe('function')
    })
  })

  describe('listTemplates', () => {
    it('should have listTemplates function', () => {
      expect(typeof templateOperations.listTemplates).toBe('function')
    })
  })

  describe('updateTemplate', () => {
    it('should have updateTemplate function', () => {
      expect(typeof templateOperations.updateTemplate).toBe('function')
    })
  })

  describe('deleteTemplate', () => {
    it('should have deleteTemplate function', () => {
      expect(typeof templateOperations.deleteTemplate).toBe('function')
    })
  })

  describe('createRender', () => {
    it('should have createRender function', () => {
      expect(typeof templateOperations.createRender).toBe('function')
    })
  })

  describe('getRender', () => {
    it('should have getRender function', () => {
      expect(typeof templateOperations.getRender).toBe('function')
    })
  })

  describe('listRenders', () => {
    it('should have listRenders function', () => {
      expect(typeof templateOperations.listRenders).toBe('function')
    })
  })

  describe('updateRender', () => {
    it('should have updateRender function', () => {
      expect(typeof templateOperations.updateRender).toBe('function')
    })
  })

  describe('getUserPreference', () => {
    it('should have getUserPreference function', () => {
      expect(typeof templateOperations.getUserPreference).toBe('function')
    })
  })

  describe('updateUserPreference', () => {
    it('should have updateUserPreference function', () => {
      expect(typeof templateOperations.updateUserPreference).toBe('function')
    })
  })

  describe('deleteUserPreference', () => {
    it('should have deleteUserPreference function', () => {
      expect(typeof templateOperations.deleteUserPreference).toBe('function')
    })
  })

  describe('Template Operations Integration', () => {
    it('should export all required template operations', () => {
      const requiredOperations = [
        'createTemplate',
        'getTemplate',
        'listTemplates',
        'updateTemplate',
        'deleteTemplate',
        'createRender',
        'getRender',
        'listRenders',
        'updateRender',
        'getUserPreference',
        'updateUserPreference',
        'deleteUserPreference',
      ]

      requiredOperations.forEach((operation) => {
        expect(templateOperations).toHaveProperty(operation)
        expect(typeof (templateOperations as any)[operation]).toBe('function')
      })
    })
  })

  describe('Error Handling', () => {
    it('should use DatabaseError for error handling', () => {
      expect(DatabaseError).toBeDefined()
      const error = new DatabaseError('Test error', 'TEST_CODE')
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
    })
  })
})
