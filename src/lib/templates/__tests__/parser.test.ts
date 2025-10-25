import { TemplateParser } from '../parser'

describe('TemplateParser', () => {
  it('maps basic Auto Layout to CSS', async () => {
    const parser = new TemplateParser({ generateCSS: true, extractAssets: false, figmaClient: {
      getFile: jest.fn(),
      getImages: jest.fn(),
      extractNodes: jest.fn().mockReturnValue([
        { id: 'root', name: 'Template Root', type: 'FRAME', children: [], styles: { fills: [], strokes: [], effects: [] }, layout: {
          layoutMode: 'VERTICAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', paddingLeft: 10, paddingRight: 20, paddingTop: 30, paddingBottom: 40, itemSpacing: 8, counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN'
        } }
      ]) as any,
    } as any })

    const result = await parser.parseFigmaFile('dummy')
    expect(result.styles.css).toContain('display: flex')
    expect(result.styles.css).toContain('flex-direction: column')
    expect(result.styles.css).toContain('gap: 8px')
    expect(result.styles.css).toContain('padding: 30px 20px 40px 10px')
    expect(result.styles.css).toContain('justify-content: space-between')
    expect(result.styles.css).toContain('align-items: center')
  })
})

// Template Parser Unit Tests

import { TemplateParser, createTemplateParser } from '../parser'
import type { FigmaNode, LayoutProperties } from '@/types/templates'
import { describe, it, beforeEach, expect } from '@jest/globals'

// ============================================================================
// Mock Figma Client
// ============================================================================

class MockFigmaClient {
  async getFile(fileKey: string) {
    return {
      document: {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:0',
            name: 'Template',
            type: 'FRAME',
            children: [
              {
                id: '2:0',
                name: '{{restaurant.name}}',
                type: 'TEXT',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 24,
                  fontWeight: 700,
                },
              },
              {
                id: '3:0',
                name: '{{category.name}}',
                type: 'TEXT',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: 600,
                },
              },
              {
                id: '4:0',
                name: '{{category.items}}',
                type: 'FRAME',
                layoutMode: 'VERTICAL',
                itemSpacing: 16,
                children: [
                  {
                    id: '5:0',
                    name: '{{item.name}}',
                    type: 'TEXT',
                  },
                  {
                    id: '6:0',
                    name: '{{item.price}}',
                    type: 'TEXT',
                  },
                  {
                    id: '7:0',
                    name: '{{item.description}}',
                    type: 'TEXT',
                  },
                ],
              },
            ],
          },
        ],
      },
      components: {},
      schemaVersion: 1,
      styles: {},
      name: 'Test Template',
      lastModified: '2024-01-01T00:00:00Z',
      thumbnailUrl: 'https://example.com/thumb.png',
      version: '1.0.0',
    }
  }

  extractNodes(document: any): FigmaNode[] {
    const convertNode = (node: any): FigmaNode => {
      const figmaNode: FigmaNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        styles: {
          fills: [],
          strokes: [],
          effects: [],
          typography: node.style ? {
            fontFamily: node.style.fontFamily || 'Inter',
            fontSize: node.style.fontSize || 16,
            fontWeight: node.style.fontWeight || 400,
            lineHeight: node.style.lineHeight || 20,
          } : undefined,
        },
        layout: {
          layoutMode: node.layoutMode || 'NONE',
          primaryAxisSizingMode: 'AUTO',
          counterAxisSizingMode: 'AUTO',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          itemSpacing: node.itemSpacing || 0,
          counterAxisAlignItems: 'MIN',
          primaryAxisAlignItems: 'MIN',
        },
      }

      if (node.children && node.children.length > 0) {
        figmaNode.children = node.children.map((child: any) => convertNode(child))
      }

      return figmaNode
    }

    // Convert all children of the document
    if (document.children && document.children.length > 0) {
      return document.children.map((child: any) => convertNode(child))
    }

    return []
  }

  async getImages(fileKey: string, nodeIds: string[]) {
    return { images: {} }
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TemplateParser', () => {
  let parser: TemplateParser
  let mockClient: MockFigmaClient

  beforeEach(() => {
    mockClient = new MockFigmaClient()
    parser = new TemplateParser({
      figmaClient: mockClient as any,
      extractAssets: false,
      generateCSS: true,
    })
  })

  describe('parseFigmaFile', () => {
    it('should parse a Figma file and extract template structure', async () => {
      const result = await parser.parseFigmaFile('test-file-key')

      expect(result).toBeDefined()
      expect(result.structure).toBeDefined()
      expect(result.bindings).toBeDefined()
      expect(result.styles).toBeDefined()
      expect(result.assets).toBeDefined()
    })

    it('should extract required bindings from layer names', async () => {
      const result = await parser.parseFigmaFile('test-file-key')

      expect(result.bindings.restaurantName).toBe('{{restaurant.name}}')
      expect(result.bindings.categoryName).toBe('{{category.name}}')
      expect(result.bindings.categoryItems).toBe('{{category.items}}')
      expect(result.bindings.itemName).toBe('{{item.name}}')
    })

    it('should extract optional bindings from layer names', async () => {
      const result = await parser.parseFigmaFile('test-file-key')

      expect(result.bindings.itemPrice).toBe('{{item.price}}')
      expect(result.bindings.itemDescription).toBe('{{item.description}}')
    })

    it('should create conditional layers for optional fields', async () => {
      const result = await parser.parseFigmaFile('test-file-key')

      expect(result.bindings.conditionalLayers).toBeDefined()
      expect(result.bindings.conditionalLayers.length).toBeGreaterThan(0)

      const priceLayer = result.bindings.conditionalLayers.find(
        l => l.condition === 'hasPrice'
      )
      expect(priceLayer).toBeDefined()
      expect(priceLayer?.layerName).toBe('{{item.price}}')
      expect(priceLayer?.action).toBe('show')
    })

    it('should throw error if required bindings are missing', async () => {
      mockClient.getFile = async () => ({
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          children: [
            {
              id: '1:0',
              name: 'Template',
              type: 'FRAME',
              children: [],
            },
          ],
        },
        components: {},
        schemaVersion: 1,
        styles: {},
        name: 'Invalid Template',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0.0',
      })

      await expect(parser.parseFigmaFile('invalid-file-key')).rejects.toThrow()
    })
  })

  describe('convertToCSS', () => {
    it('should convert horizontal layout to flexbox CSS', () => {
      const layout: LayoutProperties = {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        itemSpacing: 12,
        counterAxisAlignItems: 'CENTER',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
      }

      const css = parser.convertToCSS(layout)

      expect(css).toContain('display: flex')
      expect(css).toContain('flex-direction: row')
      expect(css).toContain('gap: 12px')
      expect(css).toContain('padding: 8px 16px 8px 16px')
      expect(css).toContain('justify-content: space-between')
      expect(css).toContain('align-items: center')
    })

    it('should convert vertical layout to flexbox CSS', () => {
      const layout: LayoutProperties = {
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 8,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      }

      const css = parser.convertToCSS(layout)

      expect(css).toContain('display: flex')
      expect(css).toContain('flex-direction: column')
      expect(css).toContain('gap: 8px')
      expect(css).toContain('flex-shrink: 0')
    })

    it('should handle layout with no spacing', () => {
      const layout: LayoutProperties = {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 0,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      }

      const css = parser.convertToCSS(layout)

      expect(css).toContain('display: flex')
      expect(css).not.toContain('gap:')
      expect(css).not.toContain('padding:')
    })
  })

  describe('extractTypography', () => {
    it('should extract typography from a text node', () => {
      const node: FigmaNode = {
        id: '1:0',
        name: 'Heading',
        type: 'TEXT',
        styles: {
          fills: [],
          strokes: [],
          effects: [],
          typography: {
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 32,
          },
        },
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
      }

      const typography = parser.extractTypography(node)

      expect(typography).toBeDefined()
      expect(typography?.family).toBe('Inter')
      expect(typography?.size).toBe('24px')
      expect(typography?.weight).toBe('700')
      expect(typography?.lineHeight).toBe('32px')
    })

    it('should return null for non-text nodes', () => {
      const node: FigmaNode = {
        id: '1:0',
        name: 'Frame',
        type: 'FRAME',
        styles: {
          fills: [],
          strokes: [],
          effects: [],
        },
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
      }

      const typography = parser.extractTypography(node)

      expect(typography).toBeNull()
    })
  })

  describe('detectCustomizationVariables', () => {
    it('should detect color variables in layer names', () => {
      const nodes: FigmaNode[] = [
        {
          id: '1:0',
          name: '{{primary_color}}',
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
        },
        {
          id: '2:0',
          name: '{{secondary_color}}',
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
        },
      ]

      const variables = parser.detectCustomizationVariables(nodes)

      expect(variables.colors).toContain('primary')
      expect(variables.colors).toContain('secondary')
    })

    it('should detect font variables in layer names', () => {
      const nodes: FigmaNode[] = [
        {
          id: '1:0',
          name: '{{heading_font}}',
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
      ]

      const variables = parser.detectCustomizationVariables(nodes)

      expect(variables.fonts).toContain('heading')
    })

    it('should return empty arrays when no variables are found', () => {
      const nodes: FigmaNode[] = [
        {
          id: '1:0',
          name: 'Regular Layer',
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
        },
      ]

      const variables = parser.detectCustomizationVariables(nodes)

      expect(variables.colors).toEqual([])
      expect(variables.fonts).toEqual([])
    })
  })

  describe('createTemplateParser', () => {
    it('should create a parser instance', () => {
      const parser = createTemplateParser({
        figmaClient: mockClient as any,
      })
      expect(parser).toBeInstanceOf(TemplateParser)
    })

    it('should accept custom configuration', () => {
      const parser = createTemplateParser({
        figmaClient: mockClient as any,
        extractAssets: false,
        generateCSS: false,
      })
      expect(parser).toBeInstanceOf(TemplateParser)
    })
  })
})
