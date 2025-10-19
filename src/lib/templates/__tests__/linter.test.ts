// Template Linter Unit Tests

import {
  TemplateLinter,
  createTemplateLinter,
  hasRequiredPlaceholders,
  getMissingPlaceholders,
} from '../linter'
import type { TemplateConfig, FigmaNode, TemplateBindings } from '@/types/templates'

// ============================================================================
// Mock Data
// ============================================================================

const createMockConfig = (overrides?: Partial<TemplateConfig>): TemplateConfig => ({
  metadata: {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    author: 'Test Author',
    version: '1.0.0',
    previewImageUrl: 'https://example.com/preview.png',
    thumbnailUrl: 'https://example.com/thumb.png',
    figmaFileKey: 'test-file-key',
    pageFormat: 'A4',
    orientation: 'portrait',
    tags: ['test'],
    isPremium: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  bindings: {
    restaurantName: '{{restaurant.name}}',
    categoryName: '{{category.name}}',
    categoryItems: '{{category.items}}',
    itemName: '{{item.name}}',
    itemPrice: '{{item.price}}',
    itemDescription: '{{item.description}}',
    conditionalLayers: [
      {
        layerName: '{{item.price}}',
        condition: 'hasPrice',
        action: 'show',
      },
    ],
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
        top: 16,
        right: 16,
        bottom: 16,
        left: 16,
      },
    },
  },
  customization: {
    allowColorCustomization: true,
    allowFontCustomization: false,
    customizableColors: ['primary'],
    customizableFonts: [],
  },
  ...overrides,
})

const createMockStructure = (): FigmaNode => ({
  id: '1:0',
  name: 'Template',
  type: 'FRAME',
  styles: {
    fills: [],
    strokes: [],
    effects: [],
  },
  layout: {
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    itemSpacing: 0,
    counterAxisAlignItems: 'MIN',
    primaryAxisAlignItems: 'MIN',
  },
  children: [
    {
      id: '2:0',
      name: '{{restaurant.name}}',
      type: 'TEXT',
      styles: { fills: [], strokes: [], effects: [] },
      layout: {
        layoutMode: 'NONE',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 0,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      },
    },
    {
      id: '3:0',
      name: '{{category.name}}',
      type: 'TEXT',
      styles: { fills: [], strokes: [], effects: [] },
      layout: {
        layoutMode: 'NONE',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 0,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      },
    },
    {
      id: '4:0',
      name: '{{category.items}}',
      type: 'FRAME',
      styles: { fills: [], strokes: [], effects: [] },
      layout: {
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 0,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      },
      children: [
        {
          id: '5:0',
          name: '{{item.name}}',
          type: 'TEXT',
          styles: { fills: [], strokes: [], effects: [] },
          layout: {
            layoutMode: 'NONE',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            itemSpacing: 0,
            counterAxisAlignItems: 'MIN',
            primaryAxisAlignItems: 'MIN',
          },
        },
        {
          id: '6:0',
          name: '{{item.price}}',
          type: 'TEXT',
          styles: { fills: [], strokes: [], effects: [] },
          layout: {
            layoutMode: 'NONE',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            itemSpacing: 0,
            counterAxisAlignItems: 'MIN',
            primaryAxisAlignItems: 'MIN',
          },
        },
        {
          id: '7:0',
          name: '{{item.description}}',
          type: 'TEXT',
          styles: { fills: [], strokes: [], effects: [] },
          layout: {
            layoutMode: 'NONE',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            itemSpacing: 0,
            counterAxisAlignItems: 'MIN',
            primaryAxisAlignItems: 'MIN',
          },
        },
      ],
    },
  ],
})

// ============================================================================
// Test Suite
// ============================================================================

describe('TemplateLinter', () => {
  let linter: TemplateLinter

  beforeEach(() => {
    linter = new TemplateLinter()
  })

  describe('validate', () => {
    it('should validate a valid template configuration', () => {
      const config = createMockConfig()
      const structure = createMockStructure()

      const result = linter.validate(config, structure)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing template ID', () => {
      const config = createMockConfig({
        metadata: {
          ...createMockConfig().metadata,
          id: '',
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.id',
          code: 'MISSING_ID',
        })
      )
    })

    it('should detect missing template name', () => {
      const config = createMockConfig({
        metadata: {
          ...createMockConfig().metadata,
          name: '',
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.name',
          code: 'MISSING_NAME',
        })
      )
    })

    it('should detect invalid page format', () => {
      const config = createMockConfig({
        metadata: {
          ...createMockConfig().metadata,
          pageFormat: 'INVALID' as any,
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.pageFormat',
          code: 'INVALID_PAGE_FORMAT',
        })
      )
    })

    it('should detect invalid orientation', () => {
      const config = createMockConfig({
        metadata: {
          ...createMockConfig().metadata,
          orientation: 'diagonal' as any,
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.orientation',
          code: 'INVALID_ORIENTATION',
        })
      )
    })

    it('should warn about invalid version format', () => {
      const config = createMockConfig({
        metadata: {
          ...createMockConfig().metadata,
          version: 'v1',
        },
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'metadata.version',
          code: 'INVALID_VERSION_FORMAT',
        })
      )
    })
  })

  describe('validateBindings', () => {
    it('should detect missing required bindings', () => {
      const config = createMockConfig({
        bindings: {
          restaurantName: '',
          categoryName: '{{category.name}}',
          categoryItems: '{{category.items}}',
          itemName: '{{item.name}}',
          conditionalLayers: [],
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'bindings.restaurantName',
          code: 'MISSING_REQUIRED_BINDING',
        })
      )
    })

    it('should validate conditional layers', () => {
      const config = createMockConfig({
        bindings: {
          ...createMockConfig().bindings,
          conditionalLayers: [
            {
              layerName: '',
              condition: 'hasPrice',
              action: 'show',
            },
          ],
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'bindings.conditionalLayers[0].layerName',
          code: 'MISSING_LAYER_NAME',
        })
      )
    })

    it('should detect invalid conditional layer action', () => {
      const config = createMockConfig({
        bindings: {
          ...createMockConfig().bindings,
          conditionalLayers: [
            {
              layerName: '{{item.price}}',
              condition: 'hasPrice',
              action: 'toggle' as any,
            },
          ],
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'bindings.conditionalLayers[0].action',
          code: 'INVALID_ACTION',
        })
      )
    })
  })

  describe('validateBindingsAgainstStructure', () => {
    it('should detect missing required placeholders in structure', () => {
      const config = createMockConfig()
      const structure: FigmaNode = {
        id: '1:0',
        name: 'Template',
        type: 'FRAME',
        styles: { fills: [], strokes: [], effects: [] },
        layout: {
          layoutMode: 'NONE',
          primaryAxisSizingMode: 'AUTO',
          counterAxisSizingMode: 'AUTO',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          itemSpacing: 0,
          counterAxisAlignItems: 'MIN',
          primaryAxisAlignItems: 'MIN',
        },
        children: [],
      }

      const result = linter.validate(config, structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_PLACEHOLDER')).toBe(true)
    })

    it('should warn about bindings that reference non-existent layers', () => {
      const config = createMockConfig({
        bindings: {
          ...createMockConfig().bindings,
          itemIcon: '{{item.icon}}',
        },
      })
      const structure = createMockStructure()

      const result = linter.validate(config, structure)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'bindings.itemIcon',
          code: 'LAYER_NOT_FOUND',
        })
      )
    })
  })

  describe('validateStyling', () => {
    it('should warn about missing styling configuration', () => {
      const config = createMockConfig({
        styling: undefined as any,
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'styling',
          code: 'MISSING_STYLING',
        })
      )
    })

    it('should warn about empty fonts array', () => {
      const config = createMockConfig({
        styling: {
          ...createMockConfig().styling,
          fonts: [],
        },
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'styling.fonts',
          code: 'NO_FONTS',
        })
      )
    })

    it('should detect invalid hex color codes', () => {
      const config = createMockConfig({
        styling: {
          ...createMockConfig().styling,
          colors: [
            {
              role: 'primary',
              value: 'red',
            },
          ],
        },
      })

      const result = linter.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'styling.colors[0].value',
          code: 'INVALID_COLOR',
        })
      )
    })

    it('should accept valid hex color codes', () => {
      const config = createMockConfig({
        styling: {
          ...createMockConfig().styling,
          colors: [
            { role: 'primary', value: '#FF0000' },
            { role: 'secondary', value: '#00ff00' },
            { role: 'accent', value: '#0000FF' },
          ],
        },
      })

      const result = linter.validate(config)

      const colorErrors = result.errors.filter(e => e.code === 'INVALID_COLOR')
      expect(colorErrors).toHaveLength(0)
    })
  })

  describe('validateCustomization', () => {
    it('should warn when color customization is enabled but no colors are defined', () => {
      const config = createMockConfig({
        customization: {
          allowColorCustomization: true,
          allowFontCustomization: false,
          customizableColors: [],
          customizableFonts: [],
        },
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'customization.customizableColors',
          code: 'NO_CUSTOMIZABLE_COLORS',
        })
      )
    })

    it('should warn when customizable color role does not exist in styling', () => {
      const config = createMockConfig({
        customization: {
          allowColorCustomization: true,
          allowFontCustomization: false,
          customizableColors: ['nonexistent'],
          customizableFonts: [],
        },
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'customization.customizableColors',
          code: 'INVALID_COLOR_ROLE',
        })
      )
    })

    it('should warn when font customization is enabled but no fonts are defined', () => {
      const config = createMockConfig({
        customization: {
          allowColorCustomization: false,
          allowFontCustomization: true,
          customizableColors: [],
          customizableFonts: [],
        },
      })

      const result = linter.validate(config)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'customization.customizableFonts',
          code: 'NO_CUSTOMIZABLE_FONTS',
        })
      )
    })
  })

  describe('createTemplateLinter', () => {
    it('should create a linter instance', () => {
      const linter = createTemplateLinter()
      expect(linter).toBeInstanceOf(TemplateLinter)
    })
  })

  describe('hasRequiredPlaceholders', () => {
    it('should return true when all required placeholders are present', () => {
      const structure = createMockStructure()
      expect(hasRequiredPlaceholders(structure)).toBe(true)
    })

    it('should return false when required placeholders are missing', () => {
      const structure: FigmaNode = {
        id: '1:0',
        name: 'Template',
        type: 'FRAME',
        styles: { fills: [], strokes: [], effects: [] },
        layout: {
          layoutMode: 'NONE',
          primaryAxisSizingMode: 'AUTO',
          counterAxisSizingMode: 'AUTO',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          itemSpacing: 0,
          counterAxisAlignItems: 'MIN',
          primaryAxisAlignItems: 'MIN',
        },
        children: [],
      }

      expect(hasRequiredPlaceholders(structure)).toBe(false)
    })
  })

  describe('getMissingPlaceholders', () => {
    it('should return empty array when all placeholders are present', () => {
      const structure = createMockStructure()
      expect(getMissingPlaceholders(structure)).toEqual([])
    })

    it('should return list of missing placeholders', () => {
      const structure: FigmaNode = {
        id: '1:0',
        name: 'Template',
        type: 'FRAME',
        styles: { fills: [], strokes: [], effects: [] },
        layout: {
          layoutMode: 'NONE',
          primaryAxisSizingMode: 'AUTO',
          counterAxisSizingMode: 'AUTO',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          itemSpacing: 0,
          counterAxisAlignItems: 'MIN',
          primaryAxisAlignItems: 'MIN',
        },
        children: [
          {
            id: '2:0',
            name: '{{restaurant.name}}',
            type: 'TEXT',
            styles: { fills: [], strokes: [], effects: [] },
            layout: {
              layoutMode: 'NONE',
              primaryAxisSizingMode: 'AUTO',
              counterAxisSizingMode: 'AUTO',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
              itemSpacing: 0,
              counterAxisAlignItems: 'MIN',
              primaryAxisAlignItems: 'MIN',
            },
          },
        ],
      }

      const missing = getMissingPlaceholders(structure)
      expect(missing).toContain('{{category.name}}')
      expect(missing).toContain('{{item.name}}')
    })
  })
})
