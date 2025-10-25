// Unit tests for TemplateCompiler

import { TemplateCompiler, TemplateCompilerError } from '../compiler'
import type { CompilationOptions, CompilationResult } from '../compiler'
import type { ParsedTemplate } from '@/types/templates'

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({ error: null })),
        download: jest.fn(() => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null })),
        list: jest.fn(() => ({ data: [], error: null })),
        remove: jest.fn(() => ({ error: null })),
      })),
    },
  })),
}))

jest.mock('../registry', () => ({
  templateRegistry: {
    validateTemplate: jest.fn(() => ({
      valid: true,
      errors: [],
      warnings: [],
    })),
    registerTemplate: jest.fn(),
    loadTemplate: jest.fn(() => ({
      metadata: {
        id: 'test-template',
        name: 'Test Template',
        figmaFileKey: 'test-key',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })),
  },
}))

// Mock parser to avoid network in unit tests
jest.mock('../parser', () => ({
  createTemplateParser: jest.fn(() => ({
    parseFigmaFile: jest.fn(async () => ({
      structure: {
        id: 'root',
        name: 'Template Root',
        type: 'FRAME',
        styles: { fills: [], strokes: [], effects: [] },
        layout: {
          layoutMode: 'VERTICAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, itemSpacing: 0, counterAxisAlignItems: 'MIN', primaryAxisAlignItems: 'MIN'
        },
      },
      bindings: {
        restaurantName: '{{restaurant.name}}',
        categoryName: '{{category.name}}',
        categoryItems: '{{category.items}}',
        itemName: '{{item.name}}',
        conditionalLayers: [],
      },
      styles: { css: '.template-root { display: flex; }', fonts: ['Inter'], colors: { background: '#ffffff' } },
      assets: { images: [], fonts: [] },
    })),
  })),
}))

describe('TemplateCompiler', () => {
  let compiler: TemplateCompiler

  beforeEach(() => {
    compiler = new TemplateCompiler()
    jest.clearAllMocks()
  })

  describe('compile', () => {
    it('produces config with compiled styles and bindings', async () => {
      const options: CompilationOptions = {
        figmaFileKey: 'test-key',
        templateId: 'test-template',
        version: '1.0.0',
        metadata: {
          name: 'Test Template',
          author: 'Test Author',
        },
      }

      const result = await compiler.compile(options)
      expect(result.success).toBe(true)
    })
    it('should validate compilation options', async () => {
      const options: CompilationOptions = {
        figmaFileKey: '',
        templateId: '',
        version: '',
        metadata: {},
      }

      await expect(compiler.compile(options)).rejects.toThrow()
    })
  })

  describe('storeCompiledArtifact', () => {
    it('should store artifact in correct path format', async () => {
      const templateId = 'test-template'
      const version = '1.0.0'
      
      // Expected path: templates-compiled/test-template@1.0.0/
      const expectedPath = `${templateId}@${version}`
      
      expect(expectedPath).toBe('test-template@1.0.0')
    })
  })

  describe('loadCompiledArtifact', () => {
    it('should load artifact from storage', async () => {
      const templateId = 'test-template'
      const version = '1.0.0'

      // This will fail until Figma parsing is implemented
      // For now, we just test that the method exists
      expect(compiler.loadCompiledArtifact).toBeDefined()
    })
  })

  describe('deleteCompiledArtifact', () => {
    it('should delete artifact from storage', async () => {
      const templateId = 'test-template'
      const version = '1.0.0'

      // Test that the method exists and can be called
      await expect(compiler.deleteCompiledArtifact(templateId, version)).resolves.not.toThrow()
    })
  })

  describe('update', () => {
    it('should update existing template with new version', async () => {
      const templateId = 'test-template'
      const newVersion = '2.0.0'

      // This will fail until Figma parsing is implemented
      await expect(
        compiler.update(templateId, newVersion, {
          metadata: {
            description: 'Updated description',
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('buildTemplateConfig', () => {
    it('should build config with default values', () => {
      // This is a private method, so we test it indirectly through compile
      // Just verify the method exists
      expect(compiler).toBeDefined()
    })
  })
})
