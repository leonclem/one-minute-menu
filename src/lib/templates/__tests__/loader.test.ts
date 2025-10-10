/**
 * Template Loader Unit Tests
 * 
 * Tests for the TemplateLoader class functionality including:
 * - Valid descriptor loading
 * - Invalid descriptor rejection
 * - Missing template handling
 * - Caching behavior
 * 
 * Note: These tests use the actual template files in public/templates/
 * rather than mocking the file system, as Jest's module mocking has
 * limitations with ES modules and dynamic imports.
 */

import { TemplateLoader } from '../loader';
import type { TemplateDescriptor } from '../types';

describe('TemplateLoader', () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    loader = new TemplateLoader('/templates');
  });

  afterEach(() => {
    loader.clearCache();
  });

  describe('loadTemplate', () => {
    it('should load and validate a valid template descriptor (kraft-sports)', async () => {
      const result = await loader.loadTemplate('kraft-sports');

      expect(result).toBeDefined();
      expect(result.id).toBe('kraft-sports');
      expect(result.name).toBe('Kraft Sports');
      expect(result.version).toBe('1.0.0');
      expect(result.canvas.size).toBe('A4');
      expect(result.imageDisplay).toBe('icon');
    });

    it('should load and validate a valid template descriptor (minimal-bistro)', async () => {
      const result = await loader.loadTemplate('minimal-bistro');

      expect(result).toBeDefined();
      expect(result.id).toBe('minimal-bistro');
      expect(result.name).toBe('Minimal Bistro');
      expect(result.version).toBe('1.0.0');
      expect(result.canvas.size).toBe('A4');
      expect(result.imageDisplay).toBe('thumbnail');
    });

    it('should handle missing template files', async () => {
      await expect(loader.loadTemplate('non-existent-template')).rejects.toThrow(
        /Failed to load template 'non-existent-template'/
      );
    });

    it('should cache loaded templates', async () => {
      // First load
      const first = await loader.loadTemplate('kraft-sports');
      expect(loader.isCached('kraft-sports')).toBe(true);

      // Second load should return same instance from cache
      const second = await loader.loadTemplate('kraft-sports');
      expect(second).toBe(first); // Same object reference

      // Verify cache hit
      expect(loader.isCached('kraft-sports')).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should return cached template without loading', async () => {
      // Load template first
      await loader.loadTemplate('kraft-sports');

      // Get from cache
      const cached = loader.getTemplate('kraft-sports');
      expect(cached).toBeDefined();
      expect(cached?.id).toBe('kraft-sports');
    });

    it('should return null for non-cached templates', () => {
      const result = loader.getTemplate('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached templates', async () => {
      // Load and cache
      await loader.loadTemplate('kraft-sports');
      expect(loader.isCached('kraft-sports')).toBe(true);

      // Clear cache
      loader.clearCache();
      expect(loader.isCached('kraft-sports')).toBe(false);
      expect(loader.getTemplate('kraft-sports')).toBeNull();
    });
  });

  describe('isCached', () => {
    it('should return true for cached templates', async () => {
      expect(loader.isCached('kraft-sports')).toBe(false);
      await loader.loadTemplate('kraft-sports');
      expect(loader.isCached('kraft-sports')).toBe(true);
    });

    it('should return false for non-cached templates', () => {
      expect(loader.isCached('non-existent')).toBe(false);
    });
  });

  describe('loadAllTemplates', () => {
    it('should load all available templates', async () => {
      const templates = await loader.loadAllTemplates();
      
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(2); // At least kraft-sports and minimal-bistro
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('kraft-sports');
      expect(templateIds).toContain('minimal-bistro');
    });
  });

  describe('validateDescriptor', () => {
    it('should validate a correct descriptor', () => {
      const validDescriptor = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        canvas: {
          size: 'A4',
          dpi: 300,
          cols: 1,
          gutter: 0,
          margins: { top: 60, right: 50, bottom: 60, left: 50 }
        },
        layers: {
          background: {
            type: 'solid',
            color: '#FFFFFF'
          }
        },
        fonts: {
          heading: { family: 'Arial', min: 24, max: 32 },
          body: { family: 'Arial', min: 14, max: 16 },
          price: { family: 'Arial', min: 14, max: 16, tabular: true }
        },
        textFrames: [
          { key: 'main', col: 1, overflow: ['wrap'] }
        ],
        imageDisplay: 'none',
        price: { currency: 'auto', decimals: 2, align: 'right' },
        limits: { nameChars: 50, descLinesWeb: 3, descLinesPrint: 2 },
        overflowPolicies: ['wrap'],
        accessibility: { minBodyPx: 13, contrastMin: 4.5 }
      };

      expect(() => loader.validateDescriptor(validDescriptor)).not.toThrow();
    });

    it('should reject invalid descriptors', () => {
      const invalidDescriptor = {
        id: 'test',
        name: 'Test',
        version: 'invalid-version', // Invalid semver
      };

      expect(() => loader.validateDescriptor(invalidDescriptor)).toThrow();
    });
  });
});

