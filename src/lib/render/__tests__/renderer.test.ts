/**
 * Unit tests for Menu Renderer
 * 
 * Tests the HTML/CSS renderer that generates complete menu documents
 * from template descriptors and menu data.
 */

import { describe, it, expect } from '@jest/globals';
import { MenuRenderer } from '../renderer';
import type { TemplateDescriptor } from '../../templates/types';
import type { Menu, MenuItem } from '../../../types';

describe('MenuRenderer', () => {
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

  // Mock menu data
  const mockMenu: Menu = {
    id: 'test-menu-1',
    userId: 'user-1',
    name: 'Test Restaurant Menu',
    slug: 'test-restaurant',
    items: [
      {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious beef burger with cheese',
        price: 12.50,
        available: true,
        category: 'Mains',
        order: 1,
        imageSource: 'none',
      },
      {
        id: 'item-2',
        name: 'Fries',
        description: 'Crispy golden fries',
        price: 4.00,
        available: true,
        category: 'Sides',
        order: 2,
        imageSource: 'none',
      },
      {
        id: 'item-3',
        name: 'Soda',
        price: 2.50,
        available: true,
        category: 'Drinks',
        order: 3,
        imageSource: 'none',
      },
    ],
    theme: {
      id: 'default',
      name: 'Default',
      colors: {
        primary: '#000000',
        secondary: '#666666',
        accent: '#ff0000',
        background: '#ffffff',
        text: '#000000',
        extractionConfidence: 1.0,
      },
      fonts: {
        primary: 'Inter',
        secondary: 'Inter',
        sizes: {
          heading: '24px',
          body: '16px',
          price: '16px',
        },
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
  };

  describe('renderToHTML', () => {
    it('should generate valid HTML document', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      // Check for basic HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en-GB">');
      expect(html).toContain('</html>');
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
    });

    it('should include menu title in header', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('Test Restaurant Menu');
      expect(html).toContain('class="menu-title"');
    });

    it('should render all menu items', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      // Check that all items are present
      expect(html).toContain('Burger');
      expect(html).toContain('Fries');
      expect(html).toContain('Soda');
      
      // Check descriptions
      expect(html).toContain('Delicious beef burger with cheese');
      expect(html).toContain('Crispy golden fries');
    });

    it('should group items by category', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      // Check for category sections
      expect(html).toContain('Mains');
      expect(html).toContain('Sides');
      expect(html).toContain('Drinks');
      expect(html).toContain('class="section-title"');
    });

    it('should format prices correctly', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'en-GB',
      });

      const html = await renderer.renderToHTML();

      // Check for formatted prices (GBP format)
      expect(html).toMatch(/£12\.50/);
      expect(html).toMatch(/£4\.00/);
      expect(html).toMatch(/£2\.50/);
    });

    it('should include Google Fonts links', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('fonts.googleapis.com');
      expect(html).toContain('Roboto');
      expect(html).toContain('Noto+Sans'); // Fallback font
    });

    it('should apply custom locale', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'de-DE',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('<html lang="de-DE">');
    });

    it('should include background URL when provided', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        backgroundUrl: 'https://example.com/background.jpg',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('background-image: url(\'https://example.com/background.jpg\')');
    });

    it('should use fallback background color when no URL provided', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('background-color: #ffffff');
    });

    it('should render bleed markers when enabled', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        showBleedMarkers: true,
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('class="bleed-markers"');
      expect(html).toContain('class="bleed-line');
      expect(html).toContain('class="safe-area-line');
    });

    it('should not render bleed markers by default', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).not.toContain('class="bleed-markers"');
    });

    it('should apply final font sizes from fit engine', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        applyFitEngine: false, // Disable fit engine to use provided font sizes directly
        finalFontSizes: {
          heading: 20,
          body: 14,
          price: 14,
        },
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('--heading-font-size: 20px');
      expect(html).toContain('--body-font-size: 14px');
      expect(html).toContain('--price-font-size: 14px');
    });

    it('should escape HTML special characters', async () => {
      const menuWithSpecialChars: Menu = {
        ...mockMenu,
        name: 'Test <script>alert("xss")</script> Menu',
        items: [
          {
            id: 'item-1',
            name: 'Item with & ampersand',
            description: 'Description with "quotes" and <tags>',
            price: 10.00,
            available: true,
            category: 'Test',
            order: 1,
            imageSource: 'none',
          },
        ],
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: menuWithSpecialChars,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      // Check that special characters are escaped
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('camera icon rendering', () => {
    it('should render camera icon when imageDisplay is icon and item has image', async () => {
      const templateWithIcons: TemplateDescriptor = {
        ...mockTemplate,
        imageDisplay: 'icon',
      };

      const menuWithImages: Menu = {
        ...mockMenu,
        items: [
          {
            id: 'item-1',
            name: 'Burger',
            price: 12.50,
            available: true,
            category: 'Mains',
            order: 1,
            imageSource: 'custom',
            customImageUrl: 'https://example.com/burger.jpg',
          },
        ],
      };

      const renderer = new MenuRenderer({
        template: templateWithIcons,
        menu: menuWithImages,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('📷');
      expect(html).toContain('class="camera-icon"');
      expect(html).toContain('data-image-url="https://example.com/burger.jpg"');
      expect(html).toContain('data-item-name="Burger"');
    });

    it('should not render camera icon when imageDisplay is none', async () => {
      const menuWithImages: Menu = {
        ...mockMenu,
        items: [
          {
            id: 'item-1',
            name: 'Burger',
            price: 12.50,
            available: true,
            category: 'Mains',
            order: 1,
            imageSource: 'custom',
            customImageUrl: 'https://example.com/burger.jpg',
          },
        ],
      };

      const renderer = new MenuRenderer({
        template: mockTemplate, // imageDisplay: 'none'
        menu: menuWithImages,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).not.toContain('📷');
      expect(html).not.toContain('class="camera-icon"');
    });

    it('should not render camera icon when item has no image', async () => {
      const templateWithIcons: TemplateDescriptor = {
        ...mockTemplate,
        imageDisplay: 'icon',
      };

      const renderer = new MenuRenderer({
        template: templateWithIcons,
        menu: mockMenu, // items have no images
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).not.toContain('📷');
    });
  });

  describe('price formatting', () => {
    it('should format prices with correct currency for en-GB', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'en-GB',
      });

      const html = await renderer.renderToHTML();

      expect(html).toMatch(/£\d+\.\d{2}/);
    });

    it('should format prices with correct currency for en-US', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'en-US',
      });

      const html = await renderer.renderToHTML();

      expect(html).toMatch(/\$\d+\.\d{2}/);
    });

    it('should format prices with correct currency for de-DE', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'de-DE',
      });

      const html = await renderer.renderToHTML();

      expect(html).toMatch(/\d+,\d{2}\s*€/);
    });

    it('should use tabular numerals when specified', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('font-variant-numeric: tabular-nums');
    });

    it('should normalize currency format - convert "12" to "£12.00"', async () => {
      const menuWithSimplePrice: Menu = {
        ...mockMenu,
        items: [
          {
            id: 'item-1',
            name: 'Simple Item',
            price: 12,
            available: true,
            category: 'Test',
            order: 1,
            imageSource: 'none',
          },
        ],
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: menuWithSimplePrice,
        format: 'print',
        locale: 'en-GB',
      });

      const html = await renderer.renderToHTML();

      // Should normalize to £12.00 (with 2 decimal places)
      expect(html).toContain('£12.00');
    });

    it('should respect template decimal places configuration', async () => {
      const templateWithZeroDecimals: TemplateDescriptor = {
        ...mockTemplate,
        price: {
          currency: 'auto',
          decimals: 0,
          align: 'right',
        },
      };

      const renderer = new MenuRenderer({
        template: templateWithZeroDecimals,
        menu: mockMenu,
        format: 'print',
        locale: 'en-GB',
      });

      const html = await renderer.renderToHTML();

      // Should format without decimals
      expect(html).toMatch(/£13/);
      expect(html).toMatch(/£4/);
      expect(html).toMatch(/£3/);
    });

    it('should right-align prices as specified in template', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('text-align: right');
    });

    it('should handle special characters in item names with prices', async () => {
      const menuWithSpecialChars: Menu = {
        ...mockMenu,
        items: [
          {
            id: 'item-1',
            name: 'Jalapeño Burger',
            description: 'Spicy burger with jalapeños',
            price: 15.50,
            available: true,
            category: 'Mains',
            order: 1,
            imageSource: 'none',
          },
          {
            id: 'item-2',
            name: 'Käsespätzle',
            description: 'Traditional German cheese noodles',
            price: 12.00,
            available: true,
            category: 'Mains',
            order: 2,
            imageSource: 'none',
          },
          {
            id: 'item-3',
            name: '冷麺 (Cold Noodles)',
            description: 'Refreshing Korean cold noodles',
            price: 18.00,
            available: true,
            category: 'Mains',
            order: 3,
            imageSource: 'none',
          },
        ],
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: menuWithSpecialChars,
        format: 'print',
        locale: 'en-GB',
      });

      const html = await renderer.renderToHTML();

      // Check that special characters are preserved
      expect(html).toContain('Jalapeño Burger');
      expect(html).toContain('Käsespätzle');
      expect(html).toContain('冷麺 (Cold Noodles)');
      
      // Check that prices are formatted correctly alongside special characters
      expect(html).toContain('£15.50');
      expect(html).toContain('£12.00');
      expect(html).toContain('£18.00');
      
      // Check that Noto Sans fallback is included for CJK characters
      expect(html).toContain('Noto Sans');
    });

    it('should format EUR currency correctly', async () => {
      const templateWithEUR: TemplateDescriptor = {
        ...mockTemplate,
        price: {
          currency: 'EUR',
          decimals: 2,
          align: 'right',
        },
      };

      const renderer = new MenuRenderer({
        template: templateWithEUR,
        menu: mockMenu,
        format: 'print',
        locale: 'de-DE',
      });

      const html = await renderer.renderToHTML();

      // EUR format in German locale
      expect(html).toMatch(/\d+,\d{2}\s*€/);
    });

    it('should format USD currency correctly', async () => {
      const templateWithUSD: TemplateDescriptor = {
        ...mockTemplate,
        price: {
          currency: 'USD',
          decimals: 2,
          align: 'right',
        },
      };

      const renderer = new MenuRenderer({
        template: templateWithUSD,
        menu: mockMenu,
        format: 'print',
        locale: 'en-US',
      });

      const html = await renderer.renderToHTML();

      // USD format
      expect(html).toMatch(/\$\d+\.\d{2}/);
    });

    it('should use Intl.NumberFormat for locale-aware formatting', async () => {
      // Test with French locale which uses different formatting
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        locale: 'fr-FR',
      });

      const html = await renderer.renderToHTML();

      // French locale uses comma for decimals and space for thousands
      expect(html).toMatch(/\d+,\d{2}\s*€/);
    });
  });

  describe('multi-column layout', () => {
    it('should apply column count from template', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('column-count: 2');
      expect(html).toContain('column-gap: 20px');
    });

    it('should handle single column layout', async () => {
      const singleColTemplate: TemplateDescriptor = {
        ...mockTemplate,
        canvas: {
          ...mockTemplate.canvas,
          cols: 1,
        },
      };

      const renderer = new MenuRenderer({
        template: singleColTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const html = await renderer.renderToHTML();

      expect(html).toContain('column-count: 1');
    });
  });

  describe('fit engine integration', () => {
    it('should apply fit engine by default', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('success');
      expect(result.metadata).toHaveProperty('appliedPolicies');
      expect(result.metadata).toHaveProperty('warnings');
      expect(result.metadata).toHaveProperty('pageCount');
    });

    it('should skip fit engine when applyFitEngine is false', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        applyFitEngine: false,
      });

      const result = await renderer.renderWithFitEngine();

      expect(result.success).toBe(true);
      expect(result.metadata.appliedPolicies).toEqual([]);
      expect(result.metadata.pageCount).toBe(1);
    });

    it('should use existing metadata when provided', async () => {
      const existingMetadata = {
        appliedPolicies: ['wrap', 'compact'],
        warnings: ['Test warning'],
        pageCount: 1,
        finalFontSizes: {
          heading: 20,
          body: 14,
          price: 14,
        },
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        applyFitEngine: false,
        existingMetadata,
      });

      const result = await renderer.renderWithFitEngine();

      expect(result.metadata).toEqual(existingMetadata);
      expect(result.success).toBe(true);
    });

    it('should include applied policies in metadata', async () => {
      // Create a menu with lots of content to trigger fit policies
      const largeMenu: Menu = {
        ...mockMenu,
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: 'This is a long description that will take up space and potentially cause overflow in the layout',
          price: 10.00 + i,
          available: true,
          category: `Category ${Math.floor(i / 10)}`,
          order: i,
          imageSource: 'none' as const,
        })),
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: largeMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      expect(result.metadata.appliedPolicies).toBeDefined();
      expect(Array.isArray(result.metadata.appliedPolicies)).toBe(true);
    });

    it('should include warnings when content does not fit', async () => {
      // Create a menu with excessive content
      const hugeMenu: Menu = {
        ...mockMenu,
        items: Array.from({ length: 200 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i} with a very long name that takes up a lot of space`,
          description: 'This is an extremely long description that will definitely cause overflow issues and should trigger warnings from the fit engine about content not fitting properly',
          price: 10.00 + i,
          available: true,
          category: `Category ${Math.floor(i / 20)}`,
          order: i,
          imageSource: 'none' as const,
        })),
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: hugeMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      // With 200 items, we should get some warnings or pagination
      expect(result.metadata.warnings).toBeDefined();
      expect(result.metadata.pageCount).toBeGreaterThan(1);
    });

    it('should include final font sizes in metadata', async () => {
      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      expect(result.metadata.finalFontSizes).toBeDefined();
      expect(result.metadata.finalFontSizes).toHaveProperty('heading');
      expect(result.metadata.finalFontSizes).toHaveProperty('body');
      expect(result.metadata.finalFontSizes).toHaveProperty('price');
    });

    it('should include pagination points when paginate policy is applied', async () => {
      // Create a menu with enough content to trigger pagination
      const largeMenu: Menu = {
        ...mockMenu,
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: 'Description for this item',
          price: 10.00 + i,
          available: true,
          category: `Category ${Math.floor(i / 20)}`,
          order: i,
          imageSource: 'none' as const,
        })),
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: largeMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      // Should have multiple pages
      expect(result.metadata.pageCount).toBeGreaterThan(1);
      
      // If paginate policy was applied, should have pagination points
      if (result.metadata.appliedPolicies.includes('paginate')) {
        expect(result.metadata.paginationPoints).toBeDefined();
        expect(Array.isArray(result.metadata.paginationPoints)).toBe(true);
      }
    });

    it('should apply fit policies in order from template descriptor', async () => {
      const largeMenu: Menu = {
        ...mockMenu,
        items: Array.from({ length: 30 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: 'This is a description that will take up space',
          price: 10.00 + i,
          available: true,
          category: `Category ${Math.floor(i / 10)}`,
          order: i,
          imageSource: 'none' as const,
        })),
      };

      const renderer = new MenuRenderer({
        template: mockTemplate,
        menu: largeMenu,
        format: 'print',
      });

      const result = await renderer.renderWithFitEngine();

      // Policies should be applied in order: wrap, compact, reflow, paginate, shrink
      const appliedPolicies = result.metadata.appliedPolicies;
      
      if (appliedPolicies.length > 1) {
        const policyOrder = ['wrap', 'compact', 'reflow', 'paginate', 'shrink'];
        const appliedIndices = appliedPolicies.map(p => policyOrder.indexOf(p));
        
        // Check that indices are in ascending order
        for (let i = 1; i < appliedIndices.length; i++) {
          expect(appliedIndices[i]).toBeGreaterThan(appliedIndices[i - 1]);
        }
      }
    });

    it('should respect format-specific accessibility requirements', async () => {
      const webRenderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'web',
      });

      const printRenderer = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const webResult = await webRenderer.renderWithFitEngine();
      const printResult = await printRenderer.renderWithFitEngine();

      // Web should enforce 14px minimum, print should use template minimum (13px)
      if (webResult.metadata.finalFontSizes) {
        expect(webResult.metadata.finalFontSizes.body).toBeGreaterThanOrEqual(14);
      }
      
      if (printResult.metadata.finalFontSizes) {
        expect(printResult.metadata.finalFontSizes.body).toBeGreaterThanOrEqual(13);
      }
    });

    it('should generate reproducible output with same metadata', async () => {
      const renderer1 = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
      });

      const result1 = await renderer1.renderWithFitEngine();

      // Use the metadata from first render for second render
      const renderer2 = new MenuRenderer({
        template: mockTemplate,
        menu: mockMenu,
        format: 'print',
        applyFitEngine: false,
        existingMetadata: result1.metadata,
      });

      const result2 = await renderer2.renderWithFitEngine();

      // Metadata should be identical
      expect(result2.metadata).toEqual(result1.metadata);
    });
  });
});
