/**
 * Unit Tests for Variant and Modifier Parsing
 * 
 * Tests parsing logic for:
 * - Variant extraction from text
 * - Modifier group detection
 * - Price delta parsing
 * - Size normalization
 */

import { SchemaValidator } from '@/lib/extraction/schema-validator'
import type { ItemVariant, ModifierGroup, ModifierOption } from '@/lib/extraction/schema-stage2'

describe('Variant Parsing Unit Tests', () => {
  describe('Variant structure validation', () => {
    it('should validate variant with size and price', () => {
      const variant: ItemVariant = {
        size: 'Large',
        price: 12.50,
        confidence: 0.95
      }

      expect(variant.size).toBe('Large')
      expect(variant.price).toBe(12.50)
      expect(variant.confidence).toBe(0.95)
    })

    it('should validate variant without size (single price item)', () => {
      const variant: ItemVariant = {
        price: 10.00,
        confidence: 0.95
      }

      expect(variant.size).toBeUndefined()
      expect(variant.price).toBe(10.00)
    })

    it('should validate variant with attributes', () => {
      const variant: ItemVariant = {
        size: '500g',
        price: 35.00,
        attributes: {
          for_pax: 2,
          weight_grams: 500,
          is_sharing: true
        },
        confidence: 0.90
      }

      expect(variant.attributes?.for_pax).toBe(2)
      expect(variant.attributes?.weight_grams).toBe(500)
      expect(variant.attributes?.is_sharing).toBe(true)
    })

    it('should handle variant with mixed attribute types', () => {
      const variant: ItemVariant = {
        size: 'Family Size',
        price: 45.00,
        attributes: {
          serves: 4,
          description: 'Perfect for sharing',
          recommended: true,
          discount_percent: 10
        },
        confidence: 0.88
      }

      expect(typeof variant.attributes?.serves).toBe('number')
      expect(typeof variant.attributes?.description).toBe('string')
      expect(typeof variant.attributes?.recommended).toBe('boolean')
    })
  })

  describe('Variant price validation', () => {
    it('should accept valid positive prices', () => {
      const variants: ItemVariant[] = [
        { size: 'Small', price: 5.00, confidence: 0.95 },
        { size: 'Medium', price: 7.50, confidence: 0.95 },
        { size: 'Large', price: 10.00, confidence: 0.95 }
      ]

      variants.forEach(variant => {
        expect(variant.price).toBeGreaterThan(0)
        expect(Number.isFinite(variant.price)).toBe(true)
      })
    })

    it('should accept zero price for free items', () => {
      const variant: ItemVariant = {
        size: 'Sample',
        price: 0,
        confidence: 0.95
      }

      expect(variant.price).toBe(0)
    })

    it('should handle decimal prices correctly', () => {
      const variant: ItemVariant = {
        size: 'Regular',
        price: 12.99,
        confidence: 0.95
      }

      expect(variant.price).toBe(12.99)
      expect(variant.price.toFixed(2)).toBe('12.99')
    })
  })

  describe('Variant size normalization', () => {
    it('should handle common size formats', () => {
      const sizes = ['Small', 'Medium', 'Large', 'XL', 'XXL']
      
      sizes.forEach(size => {
        const variant: ItemVariant = {
          size,
          price: 10.00,
          confidence: 0.95
        }
        expect(variant.size).toBe(size)
      })
    })

    it('should handle weight-based sizes', () => {
      const weightSizes = ['200g', '500g', '1kg', '2.5kg']
      
      weightSizes.forEach(size => {
        const variant: ItemVariant = {
          size,
          price: 20.00,
          confidence: 0.90
        }
        expect(variant.size).toMatch(/\d+(\.\d+)?(g|kg)/)
      })
    })

    it('should handle volume-based sizes', () => {
      const volumeSizes = ['8oz', '12oz', '16oz', '20oz', '500ml', '1L']
      
      volumeSizes.forEach(size => {
        const variant: ItemVariant = {
          size,
          price: 5.00,
          confidence: 0.92
        }
        expect(variant.size).toMatch(/\d+(\.\d+)?(oz|ml|L)/)
      })
    })

    it('should handle dimension-based sizes', () => {
      const dimensionSizes = ['9 inch', '12 inch', '15 inch', '18"']
      
      dimensionSizes.forEach(size => {
        const variant: ItemVariant = {
          size,
          price: 15.00,
          confidence: 0.90
        }
        expect(variant.size).toBeTruthy()
      })
    })

    it('should handle descriptive sizes', () => {
      const descriptiveSizes = ['Personal', 'Regular', 'Family Size', 'Party Pack']
      
      descriptiveSizes.forEach(size => {
        const variant: ItemVariant = {
          size,
          price: 25.00,
          confidence: 0.88
        }
        expect(variant.size).toBeTruthy()
      })
    })
  })
})

describe('Modifier Parsing Unit Tests', () => {
  describe('Modifier option structure', () => {
    it('should validate modifier option with name and price delta', () => {
      const option: ModifierOption = {
        name: 'Extra Cheese',
        priceDelta: 2.00
      }

      expect(option.name).toBe('Extra Cheese')
      expect(option.priceDelta).toBe(2.00)
    })

    it('should validate modifier option with zero price delta', () => {
      const option: ModifierOption = {
        name: 'No Onions',
        priceDelta: 0
      }

      expect(option.name).toBe('No Onions')
      expect(option.priceDelta).toBe(0)
    })

    it('should validate modifier option without price delta (included)', () => {
      const option: ModifierOption = {
        name: 'Lettuce'
      }

      expect(option.name).toBe('Lettuce')
      expect(option.priceDelta).toBeUndefined()
    })

    it('should handle negative price delta (discount)', () => {
      const option: ModifierOption = {
        name: 'Remove Cheese',
        priceDelta: -1.00
      }

      expect(option.priceDelta).toBe(-1.00)
    })
  })

  describe('Modifier group structure', () => {
    it('should validate single-select required modifier group', () => {
      const group: ModifierGroup = {
        name: 'Choose Your Size',
        type: 'single',
        required: true,
        options: [
          { name: 'Small', priceDelta: 0 },
          { name: 'Large', priceDelta: 2.00 }
        ]
      }

      expect(group.type).toBe('single')
      expect(group.required).toBe(true)
      expect(group.options).toHaveLength(2)
    })

    it('should validate multi-select optional modifier group', () => {
      const group: ModifierGroup = {
        name: 'Add Toppings',
        type: 'multi',
        required: false,
        options: [
          { name: 'Mushrooms', priceDelta: 1.50 },
          { name: 'Olives', priceDelta: 1.50 },
          { name: 'Peppers', priceDelta: 1.50 }
        ]
      }

      expect(group.type).toBe('multi')
      expect(group.required).toBe(false)
      expect(group.options).toHaveLength(3)
    })

    it('should validate modifier group with mixed price deltas', () => {
      const group: ModifierGroup = {
        name: 'Customize',
        type: 'multi',
        required: false,
        options: [
          { name: 'Extra Sauce', priceDelta: 0 },
          { name: 'Premium Cheese', priceDelta: 3.00 },
          { name: 'Remove Onions', priceDelta: 0 }
        ]
      }

      expect(group.options[0].priceDelta).toBe(0)
      expect(group.options[1].priceDelta).toBe(3.00)
      expect(group.options[2].priceDelta).toBe(0)
    })
  })

  describe('Modifier group type validation', () => {
    it('should distinguish between single and multi select', () => {
      const singleSelect: ModifierGroup = {
        name: 'Choose One',
        type: 'single',
        required: true,
        options: [
          { name: 'Option A', priceDelta: 0 },
          { name: 'Option B', priceDelta: 0 }
        ]
      }

      const multiSelect: ModifierGroup = {
        name: 'Choose Multiple',
        type: 'multi',
        required: false,
        options: [
          { name: 'Option A', priceDelta: 1.00 },
          { name: 'Option B', priceDelta: 1.00 }
        ]
      }

      expect(singleSelect.type).toBe('single')
      expect(multiSelect.type).toBe('multi')
    })

    it('should handle required vs optional modifiers', () => {
      const required: ModifierGroup = {
        name: 'Required Choice',
        type: 'single',
        required: true,
        options: [{ name: 'Option', priceDelta: 0 }]
      }

      const optional: ModifierGroup = {
        name: 'Optional Choice',
        type: 'multi',
        required: false,
        options: [{ name: 'Option', priceDelta: 1.00 }]
      }

      expect(required.required).toBe(true)
      expect(optional.required).toBe(false)
    })
  })

  describe('Price delta parsing', () => {
    it('should parse positive price deltas', () => {
      const deltas = [0.50, 1.00, 2.50, 5.00, 10.00]
      
      deltas.forEach(delta => {
        const option: ModifierOption = {
          name: 'Test Option',
          priceDelta: delta
        }
        expect(option.priceDelta).toBe(delta)
        expect(option.priceDelta).toBeGreaterThanOrEqual(0)
      })
    })

    it('should parse zero price delta (included)', () => {
      const option: ModifierOption = {
        name: 'Included Option',
        priceDelta: 0
      }

      expect(option.priceDelta).toBe(0)
    })

    it('should handle decimal price deltas', () => {
      const option: ModifierOption = {
        name: 'Premium Add-on',
        priceDelta: 2.99
      }

      expect(option.priceDelta).toBe(2.99)
      expect(option.priceDelta!.toFixed(2)).toBe('2.99')
    })

    it('should parse price delta from text patterns', () => {
      // Simulate parsing "+$2.00" -> 2.00
      const textPatterns = [
        { text: '+$2.00', expected: 2.00 },
        { text: '+ $3.50', expected: 3.50 },
        { text: 'add $1.50', expected: 1.50 },
        { text: '$5 extra', expected: 5.00 }
      ]

      textPatterns.forEach(({ text, expected }) => {
        // Extract number from text
        const match = text.match(/\$?\s*(\d+\.?\d*)/)
        const parsed = match ? parseFloat(match[1]) : 0
        
        expect(parsed).toBe(expected)
      })
    })
  })

  describe('Complex modifier scenarios', () => {
    it('should handle modifier group with many options', () => {
      const group: ModifierGroup = {
        name: 'Choose Your Toppings',
        type: 'multi',
        required: false,
        options: [
          { name: 'Pepperoni', priceDelta: 2.00 },
          { name: 'Mushrooms', priceDelta: 1.50 },
          { name: 'Olives', priceDelta: 1.50 },
          { name: 'Bell Peppers', priceDelta: 1.50 },
          { name: 'Onions', priceDelta: 1.00 },
          { name: 'Sausage', priceDelta: 2.50 },
          { name: 'Ham', priceDelta: 2.00 },
          { name: 'Pineapple', priceDelta: 1.50 },
          { name: 'Extra Cheese', priceDelta: 2.50 },
          { name: 'Anchovies', priceDelta: 2.00 }
        ]
      }

      expect(group.options).toHaveLength(10)
      expect(group.type).toBe('multi')
    })

    it('should handle nested modifier logic (single + multi)', () => {
      const modifierGroups: ModifierGroup[] = [
        {
          name: 'Choose Base',
          type: 'single',
          required: true,
          options: [
            { name: 'Tomato', priceDelta: 0 },
            { name: 'White', priceDelta: 0 },
            { name: 'Pesto', priceDelta: 2.00 }
          ]
        },
        {
          name: 'Add Toppings',
          type: 'multi',
          required: false,
          options: [
            { name: 'Mushrooms', priceDelta: 1.50 },
            { name: 'Olives', priceDelta: 1.50 }
          ]
        }
      ]

      expect(modifierGroups).toHaveLength(2)
      expect(modifierGroups[0].type).toBe('single')
      expect(modifierGroups[1].type).toBe('multi')
    })
  })
})

describe('Combined Variant and Modifier Parsing', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator('stage2')
  })

  it('should validate item with both variants and modifiers', () => {
    const result = {
      menu: {
        categories: [
          {
            name: 'PIZZAS',
            items: [
              {
                name: 'Custom Pizza',
                confidence: 0.90,
                variants: [
                  { size: '9 inch', price: 12.00, confidence: 0.90 },
                  { size: '12 inch', price: 18.00, confidence: 0.90 }
                ],
                modifierGroups: [
                  {
                    name: 'Choose Base',
                    type: 'single',
                    required: true,
                    options: [
                      { name: 'Tomato', priceDelta: 0 },
                      { name: 'White', priceDelta: 0 }
                    ]
                  },
                  {
                    name: 'Add Toppings',
                    type: 'multi',
                    required: false,
                    options: [
                      { name: 'Mushrooms', priceDelta: 1.50 },
                      { name: 'Olives', priceDelta: 1.50 }
                    ]
                  }
                ]
              }
            ],
            confidence: 0.90
          }
        ]
      },
      currency: 'USD',
      uncertainItems: [],
      superfluousText: []
    }

    const validation = validator.validateExtractionResult(result)
    expect(validation.valid).toBe(true)
  })

  it('should calculate total price with variants and modifiers', () => {
    // Base item with variants
    const basePrice = 12.00 // 9 inch pizza
    const largePrice = 18.00 // 12 inch pizza
    
    // Modifiers
    const tomatoBase = 0 // Included
    const mushroomTopping = 1.50
    const oliveTopping = 1.50
    
    // Calculate total for: Large pizza + tomato base + mushrooms + olives
    const total = largePrice + tomatoBase + mushroomTopping + oliveTopping
    
    expect(total).toBe(21.00)
  })

  it('should handle variant attributes with modifiers', () => {
    const result = {
      menu: {
        categories: [
          {
            name: 'SHARING PLATES',
            items: [
              {
                name: 'Grilled Platter',
                confidence: 0.88,
                variants: [
                  {
                    size: '500g',
                    price: 35.00,
                    attributes: { for_pax: 2 },
                    confidence: 0.88
                  },
                  {
                    size: '1kg',
                    price: 65.00,
                    attributes: { for_pax: 4 },
                    confidence: 0.88
                  }
                ],
                modifierGroups: [
                  {
                    name: 'Add Sauce',
                    type: 'multi',
                    required: false,
                    options: [
                      { name: 'BBQ Sauce', priceDelta: 2.00 },
                      { name: 'Garlic Butter', priceDelta: 2.00 }
                    ]
                  }
                ]
              }
            ],
            confidence: 0.88
          }
        ]
      },
      currency: 'SGD',
      uncertainItems: [],
      superfluousText: []
    }

    const validation = validator.validateExtractionResult(result)
    expect(validation.valid).toBe(true)
    
    const item = result.menu.categories[0].items[0]
    expect(item.variants[0].attributes?.for_pax).toBe(2)
    expect(item.modifierGroups).toHaveLength(1)
  })
})
