/**
 * Unit tests for BindingEngine
 */

import { BindingEngine } from '../binding-engine'
import type {
  BindingContext,
  UserCustomization,
  GlobalStyles,
} from '@/types/templates'
import type { MenuItemV2, CategoryV2 } from '@/lib/extraction/schema-stage2'

describe('BindingEngine', () => {
  let engine: BindingEngine

  beforeEach(() => {
    engine = new BindingEngine()
  })

  describe('formatPrice', () => {
    it('should format price with currency symbol (SGD)', () => {
      const result = engine.formatPrice(12.5, 'SGD', 'symbol')
      expect(result).toContain('12.50')
      // SGD symbol varies by locale, just check it contains a currency symbol
      expect(result).toMatch(/[$S]/)
    })

    it('should format price with currency symbol (USD)', () => {
      const result = engine.formatPrice(12.5, 'USD', 'symbol')
      expect(result).toContain('12.50')
      expect(result).toContain('$')
    })

    it('should format price with currency symbol (GBP)', () => {
      const result = engine.formatPrice(12.5, 'GBP', 'symbol')
      expect(result).toContain('12.50')
      expect(result).toContain('£')
    })

    it('should format price with currency symbol (EUR)', () => {
      const result = engine.formatPrice(12.5, 'EUR', 'symbol')
      expect(result).toContain('12.50')
      expect(result).toContain('€')
    })

    it('should format price with currency symbol (AUD)', () => {
      const result = engine.formatPrice(12.5, 'AUD', 'symbol')
      expect(result).toContain('12.50')
      // AUD symbol varies by locale, just check it contains a currency symbol
      expect(result).toMatch(/[$A]/)
    })

    it('should format price in amount-only mode (USD)', () => {
      const result = engine.formatPrice(12.5, 'USD', 'amount-only')
      expect(result).toBe('12.50')
      expect(result).not.toContain('$')
    })

    it('should format price in amount-only mode (SGD)', () => {
      const result = engine.formatPrice(12.5, 'SGD', 'amount-only')
      expect(result).toBe('12.50')
      expect(result).not.toContain('S$')
    })

    it('should handle zero price', () => {
      const result = engine.formatPrice(0, 'USD', 'symbol')
      expect(result).toContain('0.00')
    })

    it('should handle large prices', () => {
      const result = engine.formatPrice(1234.56, 'USD', 'symbol')
      expect(result).toContain('1,234.56')
    })

    it('should fallback to USD for unsupported currency', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const result = engine.formatPrice(12.5, 'JPY', 'symbol')
      expect(result).toContain('12.50')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Currency JPY not supported')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('resolveConditionals', () => {
    it('should detect item with price', () => {
      const item: MenuItemV2 = {
        name: 'Test Item',
        price: 10.0,
        confidence: 0.95,
      }
      const result = engine.resolveConditionals(item)
      expect(result.hasPrice).toBe(true)
      expect(result.hasDescription).toBe(false)
      expect(result.hasIcon).toBe(false)
    })

    it('should detect item with description', () => {
      const item: MenuItemV2 = {
        name: 'Test Item',
        price: 10.0,
        description: 'A delicious test item',
        confidence: 0.95,
      }
      const result = engine.resolveConditionals(item)
      expect(result.hasDescription).toBe(true)
    })

    it('should not detect empty description', () => {
      const item: MenuItemV2 = {
        name: 'Test Item',
        price: 10.0,
        description: '   ',
        confidence: 0.95,
      }
      const result = engine.resolveConditionals(item)
      expect(result.hasDescription).toBe(false)
    })

    it('should detect item with variants', () => {
      const item: MenuItemV2 = {
        name: 'Test Item',
        confidence: 0.95,
        variants: [
          { size: 'Small', price: 8.0 },
          { size: 'Large', price: 12.0 },
        ],
      }
      const result = engine.resolveConditionals(item)
      expect(result.hasPrice).toBe(true) // Has variants means has price
      expect(result.hasVariants).toBe(true)
    })

    it('should handle item without price but with variants', () => {
      const item: MenuItemV2 = {
        name: 'Test Item',
        confidence: 0.95,
        variants: [{ size: 'Regular', price: 10.0 }],
      }
      const result = engine.resolveConditionals(item)
      expect(result.hasPrice).toBe(true)
      expect(result.hasVariants).toBe(true)
    })
  })

  describe('bind', () => {
    it('should bind simple menu with one category and one item', () => {
      const context: BindingContext = {
        menu: {
          restaurantName: 'Test Restaurant',
          categories: [
            {
              name: 'Appetizers',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 8.99,
                  description: 'Crispy vegetable spring rolls',
                  confidence: 0.95,
                },
              ],
              confidence: 0.98,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
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
        },
      }

      const result = engine.bind(context)

      expect(result.restaurantName).toBe('Test Restaurant')
      expect(result.categoryBindings).toHaveLength(1)
      expect(result.categoryBindings[0].categoryName).toBe('Appetizers')
      expect(result.categoryBindings[0].items).toHaveLength(1)
      expect(result.categoryBindings[0].items[0].name).toBe('Spring Rolls')
      expect(result.categoryBindings[0].items[0].description).toBe(
        'Crispy vegetable spring rolls'
      )
      expect(result.categoryBindings[0].items[0].showPrice).toBe(true)
      expect(result.categoryBindings[0].items[0].showDescription).toBe(true)
    })

    it('should bind menu with multiple categories', () => {
      const context: BindingContext = {
        menu: {
          categories: [
            {
              name: 'Appetizers',
              items: [
                { name: 'Spring Rolls', price: 8.99, confidence: 0.95 },
              ],
              confidence: 0.98,
            },
            {
              name: 'Main Courses',
              items: [
                { name: 'Pad Thai', price: 14.99, confidence: 0.96 },
              ],
              confidence: 0.97,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
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
        },
      }

      const result = engine.bind(context)

      expect(result.categoryBindings).toHaveLength(2)
      expect(result.categoryBindings[0].categoryName).toBe('Appetizers')
      expect(result.categoryBindings[1].categoryName).toBe('Main Courses')
    })

    it('should bind menu with subcategories', () => {
      const context: BindingContext = {
        menu: {
          categories: [
            {
              name: 'Beverages',
              items: [],
              subcategories: [
                {
                  name: 'Hot Drinks',
                  items: [
                    { name: 'Coffee', price: 3.5, confidence: 0.95 },
                  ],
                  confidence: 0.96,
                },
                {
                  name: 'Cold Drinks',
                  items: [
                    { name: 'Iced Tea', price: 2.5, confidence: 0.94 },
                  ],
                  confidence: 0.95,
                },
              ],
              confidence: 0.97,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
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
        },
      }

      const result = engine.bind(context)

      expect(result.categoryBindings).toHaveLength(1)
      expect(result.categoryBindings[0].subcategories).toHaveLength(2)
      expect(result.categoryBindings[0].subcategories![0].categoryName).toBe(
        'Hot Drinks'
      )
      expect(result.categoryBindings[0].subcategories![1].categoryName).toBe(
        'Cold Drinks'
      )
    })

    it('should bind items with variants', () => {
      const context: BindingContext = {
        menu: {
          categories: [
            {
              name: 'Beverages',
              items: [
                {
                  name: 'Coffee',
                  confidence: 0.95,
                  variants: [
                    { size: 'Small', price: 3.0 },
                    { size: 'Medium', price: 4.0 },
                    { size: 'Large', price: 5.0 },
                  ],
                },
              ],
              confidence: 0.96,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
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
        },
      }

      const result = engine.bind(context)

      const item = result.categoryBindings[0].items[0]
      expect(item.variants).toHaveLength(3)
      expect(item.variants![0].label).toBe('Small')
      expect(item.variants![0].price).toContain('3.00')
      expect(item.variants![1].label).toBe('Medium')
      expect(item.variants![2].label).toBe('Large')
      expect(item.showVariants).toBe(true)
    })

    it('should apply customization to global styles', () => {
      const customization: UserCustomization = {
        colors: {
          primary: '#FF0000',
          secondary: '#00FF00',
        },
        fonts: {
          heading: 'Arial',
          body: 'Helvetica',
        },
        priceDisplayMode: 'amount-only',
      }

      const context: BindingContext = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10, confidence: 0.95 }],
              confidence: 0.95,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
          styling: {
            fonts: [
              { role: 'heading', family: 'Default', size: '24px', weight: 'bold' },
            ],
            colors: [
              { role: 'primary', value: '#000000' },
            ],
            spacing: {
              itemSpacing: 16,
              categorySpacing: 32,
              padding: { top: 24, right: 24, bottom: 24, left: 24 },
            },
          },
          customization: {
            allowColorCustomization: true,
            allowFontCustomization: true,
            customizableColors: ['primary', 'secondary'],
            customizableFonts: ['heading', 'body'],
          },
        },
        customization,
      }

      const result = engine.bind(context)

      expect(result.globalStyles.colors.primary).toBe('#FF0000')
      expect(result.globalStyles.colors.secondary).toBe('#00FF00')
      expect(result.globalStyles.fonts.heading).toBe('Arial')
      expect(result.globalStyles.fonts.body).toBe('Helvetica')
    })

    it('should use amount-only price display mode when specified', () => {
      const customization: UserCustomization = {
        priceDisplayMode: 'amount-only',
      }

      const context: BindingContext = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 12.5, confidence: 0.95 }],
              confidence: 0.95,
            },
          ],
        },
        template: {
          metadata: {} as any,
          bindings: {} as any,
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
        },
        customization,
      }

      const result = engine.bind(context)

      const item = result.categoryBindings[0].items[0]
      expect(item.price).toBe('12.50')
      expect(item.price).not.toContain('$')
    })
  })

  describe('applyCustomization', () => {
    it('should apply color customization', () => {
      const baseStyles: GlobalStyles = {
        colors: {
          primary: '#000000',
          secondary: '#FFFFFF',
        },
        fonts: {},
        spacing: {
          itemSpacing: 16,
          categorySpacing: 32,
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
      }

      const customization: UserCustomization = {
        colors: {
          primary: '#FF0000',
        },
      }

      const result = engine.applyCustomization(baseStyles, customization)

      expect(result.colors.primary).toBe('#FF0000')
      expect(result.colors.secondary).toBe('#FFFFFF') // Unchanged
    })

    it('should apply font customization', () => {
      const baseStyles: GlobalStyles = {
        colors: {},
        fonts: {
          heading: 'Default',
          body: 'Default',
        },
        spacing: {
          itemSpacing: 16,
          categorySpacing: 32,
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
      }

      const customization: UserCustomization = {
        fonts: {
          heading: 'Arial',
        },
      }

      const result = engine.applyCustomization(baseStyles, customization)

      expect(result.fonts.heading).toBe('Arial')
      expect(result.fonts.body).toBe('Default') // Unchanged
    })

    it('should return base styles when no customization provided', () => {
      const baseStyles: GlobalStyles = {
        colors: { primary: '#000000' },
        fonts: { heading: 'Default' },
        spacing: {
          itemSpacing: 16,
          categorySpacing: 32,
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
      }

      const result = engine.applyCustomization(baseStyles, undefined)

      expect(result).toEqual(baseStyles)
    })
  })
})
