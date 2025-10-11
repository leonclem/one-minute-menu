/**
 * Unit tests for Fit Engine
 * 
 * Tests the pure, deterministic content fitting engine that applies
 * overflow policies to ensure menu content fits within template constraints.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FitEngine } from '../fit-engine';
import type { TemplateDescriptor, OverflowPolicy } from '../../templates/types';
import type { ContentMetrics } from '../fit-engine';

describe('FitEngine', () => {
  // Mock template descriptor for testing
  const mockTemplate: TemplateDescriptor = {
    id: 'test-template',
    name: 'Test Template',
    version: '1.0.0',
    canvas: {
      size: 'A4',
      dpi: 300,
      cols: 2,
      gutter: 20,
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    layers: {
      background: {
        type: 'solid',
        color: '#ffffff',
      },
    },
    fonts: {
      heading: { family: 'Roboto', weight: 700, min: 18, max: 24, tabular: false },
      body: { family: 'Roboto', weight: 400, min: 12, max: 16, tabular: false },
      price: { family: 'Roboto', weight: 500, min: 12, max: 16, tabular: true },
    },
    textFrames: [],
    imageDisplay: 'none',
    price: {
      currency: 'auto',
      decimals: 2,
      align: 'right',
    },
    limits: {
      nameChars: 50,
      descLinesWeb: 3,
      descLinesPrint: 2,
    },
    overflowPolicies: ['wrap', 'compact', 'reflow', 'paginate', 'shrink'],
    accessibility: {
      minBodyPx: 13,
      contrastMin: 4.5,
    },
  };

  const mockItems = [
    {
      id: '1',
      name: 'Test Item 1',
      description: 'A delicious test item',
      price: 10.99,
      category: 'Appetizers',
      available: true,
    },
    {
      id: '2',
      name: 'Test Item 2',
      description: 'Another delicious test item',
      price: 15.99,
      category: 'Appetizers',
      available: true,
    },
    {
      id: '3',
      name: 'Test Item 3',
      description: 'Yet another delicious test item',
      price: 20.99,
      category: 'Main Courses',
      available: true,
    },
  ];

  const mockCategories = ['Appetizers', 'Main Courses'];

  describe('Constructor', () => {
    it('should create a FitEngine instance with default options', () => {
      const engine = new FitEngine(mockTemplate);
      expect(engine).toBeInstanceOf(FitEngine);
    });

    it('should create a FitEngine instance with custom options', () => {
      const engine = new FitEngine(mockTemplate, {
        format: 'web',
        maxIterations: 5,
        overflowThreshold: 10,
      });
      expect(engine).toBeInstanceOf(FitEngine);
    });
  });

  describe('fitContent', () => {
    it('should return success immediately if content already fits', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 800,
        availableHeight: 1000,
        overflow: 0,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.success).toBe(true);
      expect(result.appliedPolicies).toHaveLength(0);
      expect(result.pageCount).toBe(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should apply policies in order until content fits', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.success).toBe(true);
      expect(result.appliedPolicies.length).toBeGreaterThan(0);
      expect(result.appliedPolicies[0]).toBe('wrap');
    });

    it('should return failure if all policies exhausted', async () => {
      const engine = new FitEngine(mockTemplate, { maxIterations: 1 });
      const metrics: ContentMetrics = {
        contentHeight: 2000,
        availableHeight: 1000,
        overflow: 1000,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Wrap Policy', () => {
    it('should apply wrap policy and reduce overflow', async () => {
      const engine = new FitEngine(mockTemplate, {
        format: 'print',
      });
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).toContain('wrap');
      expect(result.policyStyles.wrap).toBeDefined();
      expect(result.policyStyles.wrap?.css['hyphens']).toBe('auto');
      expect(result.policyStyles.wrap?.css['word-wrap']).toBe('break-word');
    });

    it('should include language-aware hyphenation properties', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 1050,
        availableHeight: 1000,
        overflow: 50,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.policyStyles.wrap?.css['-webkit-hyphens']).toBe('auto');
      expect(result.policyStyles.wrap?.css['-ms-hyphens']).toBe('auto');
    });
  });

  describe('Compact Policy', () => {
    it('should apply compact policy and reduce spacing', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['compact'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1150,
        availableHeight: 1000,
        overflow: 150,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).toContain('compact');
      expect(result.policyStyles.compact).toBeDefined();
      expect(result.policyStyles.compact?.css['line-height']).toBeDefined();
    });

    it('should reduce vertical padding by 20%', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['compact'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1150,
        availableHeight: 1000,
        overflow: 150,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.policyStyles.compact?.css['padding-top']).toContain('0.8');
      expect(result.policyStyles.compact?.css['padding-bottom']).toContain('0.8');
    });
  });

  describe('Reflow Policy', () => {
    it('should apply reflow policy for multi-column layouts', async () => {
      const template = {
        ...mockTemplate,
        canvas: { ...mockTemplate.canvas, cols: 2 },
        overflowPolicies: ['reflow'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).toContain('reflow');
      expect(result.policyStyles.reflow).toBeDefined();
      expect(result.policyStyles.reflow?.css['column-count']).toBe(1);
    });

    it('should not apply reflow for single-column layouts', async () => {
      const template = {
        ...mockTemplate,
        canvas: { ...mockTemplate.canvas, cols: 1 },
        overflowPolicies: ['reflow'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).not.toContain('reflow');
    });
  });

  describe('Paginate Policy', () => {
    it('should apply paginate policy and create multiple pages', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['paginate'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 2500,
        availableHeight: 1000,
        overflow: 1500,
        itemCount: 10,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).toContain('paginate');
      expect(result.pageCount).toBeGreaterThan(1);
      expect(result.paginationPoints).toBeDefined();
      expect(result.policyStyles.paginate).toBeDefined();
    });

    it('should keep section headers with first item', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['paginate'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 2000,
        availableHeight: 1000,
        overflow: 1000,
        itemCount: 6,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.policyStyles.paginate?.css['page-break-inside']).toBe('avoid');
      expect(result.policyStyles.paginate?.css['break-inside']).toBe('avoid');
    });

    it('should resolve all overflow with pagination', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['paginate'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 3000,
        availableHeight: 1000,
        overflow: 2000,
        itemCount: 10,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.success).toBe(true);
    });
  });

  describe('Shrink Policy', () => {
    it('should apply shrink policy and reduce font sizes', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies).toContain('shrink');
      expect(result.finalFontSizes.body).toBeLessThan(mockTemplate.fonts.body.max);
      expect(result.policyStyles.shrink).toBeDefined();
    });

    it('should respect accessibility floor for print', async () => {
      const template = {
        ...mockTemplate,
        fonts: {
          ...mockTemplate.fonts,
          body: { ...mockTemplate.fonts.body, min: 13 },
        },
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template, { format: 'print' });
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.finalFontSizes.body).toBeGreaterThanOrEqual(13);
    });

    it('should respect accessibility floor for web (14px minimum)', async () => {
      const template = {
        ...mockTemplate,
        fonts: {
          ...mockTemplate.fonts,
          body: { ...mockTemplate.fonts.body, min: 12 },
        },
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template, { format: 'web' });
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      // Web requires 14px minimum
      expect(result.finalFontSizes.body).toBeGreaterThanOrEqual(14);
    });

    it('should surface warnings when approaching accessibility limits', async () => {
      const template = {
        ...mockTemplate,
        fonts: {
          ...mockTemplate.fonts,
          body: { ...mockTemplate.fonts.body, min: 13, max: 14 },
        },
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template, { format: 'print' });
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('accessibility'))).toBe(true);
    });

    it('should not shrink below minimum sizes', async () => {
      const template = {
        ...mockTemplate,
        fonts: {
          ...mockTemplate.fonts,
          body: { ...mockTemplate.fonts.body, min: 16, max: 16 },
        },
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.finalFontSizes.body).toBe(16);
    });

    it('should apply body ±1.5px and heading ±2px adjustments', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      // Body should be reduced by 1.5px
      expect(result.finalFontSizes.body).toBe(mockTemplate.fonts.body.max - 1.5);
      // Heading should be reduced by 2px
      expect(result.finalFontSizes.heading).toBe(mockTemplate.fonts.heading.max - 2);
    });
  });

  describe('Policy Combinations', () => {
    it('should apply multiple policies in sequence', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 1300,
        availableHeight: 1000,
        overflow: 300,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.appliedPolicies.length).toBeGreaterThan(1);
    });

    it('should stop applying policies once content fits', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['wrap', 'compact', 'reflow', 'paginate', 'shrink'] as OverflowPolicy[],
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1050,
        availableHeight: 1000,
        overflow: 50,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result.success).toBe(true);
      // Should not apply all policies if content fits early
      expect(result.appliedPolicies.length).toBeLessThan(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 0,
        availableHeight: 1000,
        overflow: 0,
        itemCount: 0,
      };

      const result = await engine.fitContent([], [], metrics);

      expect(result.success).toBe(true);
      expect(result.appliedPolicies).toHaveLength(0);
    });

    it('should handle very long content', async () => {
      const engine = new FitEngine(mockTemplate);
      const longItems = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
        description: 'A very long description that takes up a lot of space',
        price: 10.99,
        category: 'Category',
        available: true,
      }));
      const metrics: ContentMetrics = {
        contentHeight: 10000,
        availableHeight: 1000,
        overflow: 9000,
        itemCount: 100,
      };

      const result = await engine.fitContent(longItems, ['Category'], metrics);

      // Should eventually apply paginate policy
      expect(result.appliedPolicies).toContain('paginate');
      expect(result.pageCount).toBeGreaterThan(1);
    });

    it('should handle zero available height gracefully', async () => {
      const template = {
        ...mockTemplate,
        overflowPolicies: ['wrap', 'compact', 'shrink'] as OverflowPolicy[], // Exclude paginate
      };
      const engine = new FitEngine(template);
      const metrics: ContentMetrics = {
        contentHeight: 1000,
        availableHeight: 0,
        overflow: 1000,
        itemCount: 3,
      };

      const result = await engine.fitContent(mockItems, mockCategories, metrics);

      // Without paginate, this should fail
      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Static Helper Methods', () => {
    it('should measure overflow correctly', () => {
      const overflow = FitEngine.measureOverflow(1200, 1000);
      expect(overflow).toBe(200);
    });

    it('should return zero overflow when content fits', () => {
      const overflow = FitEngine.measureOverflow(800, 1000);
      expect(overflow).toBe(0);
    });

    it('should calculate metrics from DOM-like element', () => {
      const mockElement = {
        scrollHeight: 1200,
        clientHeight: 1000,
      };

      const metrics = FitEngine.calculateMetrics(mockElement, 5);

      expect(metrics.contentHeight).toBe(1200);
      expect(metrics.availableHeight).toBe(1000);
      expect(metrics.overflow).toBe(200);
      expect(metrics.itemCount).toBe(5);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce same results for same inputs', async () => {
      const engine = new FitEngine(mockTemplate);
      const metrics: ContentMetrics = {
        contentHeight: 1100,
        availableHeight: 1000,
        overflow: 100,
        itemCount: 3,
      };

      const result1 = await engine.fitContent(mockItems, mockCategories, metrics);
      const result2 = await engine.fitContent(mockItems, mockCategories, metrics);

      expect(result1.appliedPolicies).toEqual(result2.appliedPolicies);
      expect(result1.finalFontSizes).toEqual(result2.finalFontSizes);
      expect(result1.pageCount).toEqual(result2.pageCount);
    });
  });
});
