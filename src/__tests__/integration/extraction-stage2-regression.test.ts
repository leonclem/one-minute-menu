/**
 * Regression Tests for Stage 2 Extraction
 * 
 * Tests complex real-world menu scenarios to ensure:
 * - Variants are correctly extracted
 * - Modifiers are properly structured
 * - Set menus maintain integrity
 * - Edge cases are handled gracefully
 */

import { SchemaValidator } from '@/lib/extraction/schema-validator'
import type { ExtractionResultV2 } from '@/lib/extraction/schema-stage2'

describe('Stage 2 Regression Tests - Complex Menus', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator('stage2')
  })

  describe('Complex restaurant menu with all Stage 2 features', () => {
    it('should validate complete restaurant menu with variants, modifiers, and set menus', () => {
      const complexMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'BEVERAGES',
              items: [
                {
                  name: 'Iced Coffee',
                  confidence: 0.95,
                  variants: [
                    { size: 'Small', price: 3.50, confidence: 0.95 },
                    { size: 'Medium', price: 4.50, confidence: 0.95 },
                    { size: 'Large', price: 5.50, confidence: 0.95 }
                  ],
                  modifierGroups: [
                    {
                      name: 'Add Extras',
                      type: 'multi',
                      required: false,
                      options: [
                        { name: 'Extra Shot', priceDelta: 1.00 },
                        { name: 'Oat Milk', priceDelta: 0.50 }
                      ]
                    }
                  ]
                }
              ],
              confidence: 0.95
            },
            {
              name: 'MAINS',
              items: [
                {
                  name: 'Wagyu Steak',
                  confidence: 0.92,
                  variants: [
                    { size: '200g', price: 45.00, confidence: 0.92 },
                    { size: '300g', price: 65.00, confidence: 0.92 }
                  ],
                  modifierGroups: [
                    {
                      name: 'Choose Doneness',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Rare', priceDelta: 0 },
                        { name: 'Medium', priceDelta: 0 },
                        { name: 'Well Done', priceDelta: 0 }
                      ]
                    },
                    {
                      name: 'Add Sauce',
                      type: 'multi',
                      required: false,
                      options: [
                        { name: 'Mushroom Sauce', priceDelta: 3.00 },
                        { name: 'Pepper Sauce', priceDelta: 3.00 }
                      ]
                    }
                  ],
                  additional: {
                    servedWith: ['Mashed potatoes', 'Seasonal vegetables'],
                    prepTimeMin: 20,
                    notes: 'Premium Australian Wagyu'
                  }
                }
              ],
              confidence: 0.92
            },
            {
              name: 'SET MENUS',
              items: [
                {
                  name: '3-Course Dinner',
                  price: 55.00,
                  confidence: 0.88,
                  type: 'set_menu',
                  setMenu: {
                    courses: [
                      {
                        name: 'Appetizer',
                        options: [
                          { name: 'Soup of the Day', priceDelta: 0 },
                          { name: 'Caesar Salad', priceDelta: 0 }
                        ]
                      },
                      {
                        name: 'Main Course',
                        options: [
                          { name: 'Grilled Chicken', priceDelta: 0 },
                          { name: 'Pan-Seared Salmon', priceDelta: 5.00 },
                          { name: 'Wagyu Steak', priceDelta: 15.00 }
                        ]
                      },
                      {
                        name: 'Dessert',
                        options: [
                          { name: 'Ice Cream', priceDelta: 0 },
                          { name: 'Chocolate Cake', priceDelta: 0 }
                        ]
                      }
                    ],
                    notes: 'Includes complimentary bread and coffee'
                  }
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

      const validation = validator.validateExtractionResult(complexMenu)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('Edge case: Items with many variants', () => {
    it('should handle items with 5+ variants', () => {
      const manyVariants: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'BUBBLE TEA',
              items: [
                {
                  name: 'Classic Milk Tea',
                  confidence: 0.90,
                  variants: [
                    { size: 'XS (8oz)', price: 3.00, confidence: 0.90 },
                    { size: 'S (12oz)', price: 4.00, confidence: 0.90 },
                    { size: 'M (16oz)', price: 5.00, confidence: 0.90 },
                    { size: 'L (20oz)', price: 6.00, confidence: 0.90 },
                    { size: 'XL (24oz)', price: 7.00, confidence: 0.90 }
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

      const validation = validator.validateExtractionResult(manyVariants)
      expect(validation.valid).toBe(true)
      expect(manyVariants.menu.categories[0].items[0].variants).toHaveLength(5)
    })
  })

  describe('Edge case: Nested categories with Stage 2 items', () => {
    it('should handle subcategories with variants and modifiers', () => {
      const nestedMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'PREMIUM STEAKS',
              items: [],
              confidence: 0.95,
              subcategories: [
                {
                  name: 'WAGYU',
                  items: [
                    {
                      name: 'Wagyu Ribeye',
                      confidence: 0.92,
                      variants: [
                        { size: '200g', price: 50.00, confidence: 0.92 },
                        { size: '300g', price: 75.00, confidence: 0.92 }
                      ],
                      modifierGroups: [
                        {
                          name: 'Choose Doneness',
                          type: 'single',
                          required: true,
                          options: [
                            { name: 'Rare', priceDelta: 0 },
                            { name: 'Medium', priceDelta: 0 }
                          ]
                        }
                      ]
                    }
                  ],
                  confidence: 0.92
                },
                {
                  name: 'ANGUS',
                  items: [
                    {
                      name: 'Angus Sirloin',
                      confidence: 0.93,
                      variants: [
                        { size: '250g', price: 35.00, confidence: 0.93 },
                        { size: '350g', price: 48.00, confidence: 0.93 }
                      ]
                    }
                  ],
                  confidence: 0.93
                }
              ]
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(nestedMenu)
      expect(validation.valid).toBe(true)
      expect(nestedMenu.menu.categories[0].subcategories).toHaveLength(2)
    })
  })

  describe('Edge case: Combo items with modifiers', () => {
    it('should handle combo type items with modifier groups', () => {
      const comboMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'COMBO MEALS',
              items: [
                {
                  name: 'Burger Combo',
                  price: 15.00,
                  confidence: 0.90,
                  type: 'combo',
                  modifierGroups: [
                    {
                      name: 'Choose Your Burger',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Classic Burger', priceDelta: 0 },
                        { name: 'Cheese Burger', priceDelta: 1.00 },
                        { name: 'Bacon Burger', priceDelta: 2.00 }
                      ]
                    },
                    {
                      name: 'Choose Your Side',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Fries', priceDelta: 0 },
                        { name: 'Onion Rings', priceDelta: 1.50 }
                      ]
                    },
                    {
                      name: 'Choose Your Drink',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Coke', priceDelta: 0 },
                        { name: 'Sprite', priceDelta: 0 },
                        { name: 'Iced Tea', priceDelta: 0.50 }
                      ]
                    }
                  ],
                  additional: {
                    notes: 'Includes burger, side, and drink'
                  }
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

      const validation = validator.validateExtractionResult(comboMenu)
      expect(validation.valid).toBe(true)
      expect(comboMenu.menu.categories[0].items[0].modifierGroups).toHaveLength(3)
    })
  })

  describe('Edge case: Items with zero price deltas', () => {
    it('should handle modifiers with all zero price deltas', () => {
      const zeroDeltaMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SANDWICHES',
              items: [
                {
                  name: 'Club Sandwich',
                  price: 12.00,
                  confidence: 0.95,
                  modifierGroups: [
                    {
                      name: 'Choose Your Bread',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'White', priceDelta: 0 },
                        { name: 'Wheat', priceDelta: 0 },
                        { name: 'Sourdough', priceDelta: 0 }
                      ]
                    }
                  ]
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(zeroDeltaMenu)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Edge case: Uncertain items with Stage 2 context', () => {
    it('should handle uncertain items that might be variants or modifiers', () => {
      const uncertainMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SPECIALS',
              items: [
                {
                  name: 'Daily Special',
                  price: 18.00,
                  confidence: 0.70
                }
              ],
              confidence: 0.75
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [
          {
            text: 'Add cheese +$2',
            reason: 'Unclear if this is a modifier or separate item',
            confidence: 0.60,
            suggestedPrice: 2.00
          },
          {
            text: 'Large portion available',
            reason: 'Possible variant but no price listed',
            confidence: 0.55
          }
        ],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(uncertainMenu)
      expect(validation.valid).toBe(true)
      expect(uncertainMenu.uncertainItems).toHaveLength(2)
    })
  })

  describe('Real-world scenario: Asian restaurant menu', () => {
    it('should handle typical Asian restaurant menu with sharing portions', () => {
      const asianMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'DIM SUM',
              items: [
                {
                  name: 'Har Gow (Shrimp Dumplings)',
                  confidence: 0.92,
                  variants: [
                    { size: '3 pieces', price: 5.80, confidence: 0.92 },
                    { size: '6 pieces', price: 10.80, confidence: 0.92 }
                  ]
                },
                {
                  name: 'Siew Mai (Pork Dumplings)',
                  confidence: 0.93,
                  variants: [
                    { size: '3 pieces', price: 5.50, confidence: 0.93 },
                    { size: '6 pieces', price: 10.00, confidence: 0.93 }
                  ]
                }
              ],
              confidence: 0.92
            },
            {
              name: 'SHARING PLATES',
              items: [
                {
                  name: 'Peking Duck',
                  confidence: 0.88,
                  variants: [
                    {
                      size: 'Half Duck',
                      price: 38.00,
                      attributes: { for_pax: 2 },
                      confidence: 0.88
                    },
                    {
                      size: 'Whole Duck',
                      price: 68.00,
                      attributes: { for_pax: 4 },
                      confidence: 0.88
                    }
                  ],
                  additional: {
                    servedWith: ['Pancakes', 'Hoisin sauce', 'Cucumber', 'Spring onions'],
                    forPax: 2,
                    prepTimeMin: 30,
                    notes: 'Please order 30 minutes in advance'
                  }
                }
              ],
              confidence: 0.88
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: [
          {
            text: 'All prices subject to 10% service charge and 8% GST',
            context: 'Footer',
            confidence: 0.95
          }
        ]
      }

      const validation = validator.validateExtractionResult(asianMenu)
      expect(validation.valid).toBe(true)
      
      // Verify sharing plate attributes
      const pekingDuck = asianMenu.menu.categories[1].items[0]
      expect(pekingDuck.variants![0].attributes?.for_pax).toBe(2)
      expect(pekingDuck.additional?.prepTimeMin).toBe(30)
    })
  })

  describe('Real-world scenario: Pizza restaurant with complex modifiers', () => {
    it('should handle pizza menu with size variants and topping modifiers', () => {
      const pizzaMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'PIZZAS',
              items: [
                {
                  name: 'Build Your Own Pizza',
                  confidence: 0.90,
                  variants: [
                    { size: '9 inch', price: 12.00, confidence: 0.90 },
                    { size: '12 inch', price: 18.00, confidence: 0.90 },
                    { size: '15 inch', price: 24.00, confidence: 0.90 }
                  ],
                  modifierGroups: [
                    {
                      name: 'Choose Your Base',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Tomato Sauce', priceDelta: 0 },
                        { name: 'White Sauce', priceDelta: 0 },
                        { name: 'Pesto', priceDelta: 2.00 }
                      ]
                    },
                    {
                      name: 'Choose Your Cheese',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Mozzarella', priceDelta: 0 },
                        { name: 'Mixed Cheese', priceDelta: 1.50 }
                      ]
                    },
                    {
                      name: 'Add Toppings',
                      type: 'multi',
                      required: false,
                      options: [
                        { name: 'Pepperoni', priceDelta: 2.00 },
                        { name: 'Mushrooms', priceDelta: 1.50 },
                        { name: 'Olives', priceDelta: 1.50 },
                        { name: 'Bell Peppers', priceDelta: 1.50 },
                        { name: 'Onions', priceDelta: 1.00 },
                        { name: 'Extra Cheese', priceDelta: 2.50 }
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

      const validation = validator.validateExtractionResult(pizzaMenu)
      expect(validation.valid).toBe(true)
      
      const pizza = pizzaMenu.menu.categories[0].items[0]
      expect(pizza.variants).toHaveLength(3)
      expect(pizza.modifierGroups).toHaveLength(3)
      expect(pizza.modifierGroups![2].options).toHaveLength(6)
    })
  })
})
