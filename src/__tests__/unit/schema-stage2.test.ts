/**
 * Unit Tests for Stage 2 Schema Validation
 * 
 * Tests Stage 2 schema validation including:
 * - Variants (sizes, prices, attributes)
 * - Modifier groups (single/multi select, required/optional)
 * - Set menus with courses
 * - Additional item info
 * - Backward compatibility with Stage 1 data
 */

import { SchemaValidator } from '@/lib/extraction/schema-validator'
import type { ExtractionResultV2 } from '@/lib/extraction/schema-stage2'

describe('Stage 2 Schema Validation', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator('stage2')
  })

  describe('Variant extraction validation', () => {
    it('should validate menu item with multiple variants', () => {
      const result: ExtractionResultV2 = {
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should validate variant with attributes', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SHARING PLATES',
              items: [
                {
                  name: 'Grilled Platter',
                  confidence: 0.90,
                  variants: [
                    {
                      size: '500g',
                      price: 35.00,
                      attributes: { for_pax: 2 },
                      confidence: 0.90
                    },
                    {
                      size: '1kg',
                      price: 65.00,
                      attributes: { for_pax: 4 },
                      confidence: 0.90
                    }
                  ]
                }
              ],
              confidence: 0.90
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should validate item with single variant (no size)', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'APPETIZERS',
              items: [
                {
                  name: 'Spring Rolls',
                  confidence: 0.95,
                  variants: [
                    { price: 6.50, confidence: 0.95 }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should reject variant with missing price', () => {
      const result = {
        menu: {
          categories: [
            {
              name: 'BEVERAGES',
              items: [
                {
                  name: 'Coffee',
                  confidence: 0.95,
                  variants: [
                    { size: 'Small' } // Missing price
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Modifier group validation', () => {
    it('should validate single-select required modifier group', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'BURGERS',
              items: [
                {
                  name: 'Classic Burger',
                  price: 12.00,
                  confidence: 0.95,
                  modifierGroups: [
                    {
                      name: 'Choose Your Sauce',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'BBQ Sauce', priceDelta: 0 },
                        { name: 'Garlic Mayo', priceDelta: 0 },
                        { name: 'Truffle Aioli', priceDelta: 2.00 }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should validate multi-select optional modifier group', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SALADS',
              items: [
                {
                  name: 'Caesar Salad',
                  price: 10.00,
                  confidence: 0.95,
                  modifierGroups: [
                    {
                      name: 'Add Extras',
                      type: 'multi',
                      required: false,
                      options: [
                        { name: 'Grilled Chicken', priceDelta: 4.00 },
                        { name: 'Avocado', priceDelta: 3.00 },
                        { name: 'Extra Parmesan', priceDelta: 1.50 }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should validate item with multiple modifier groups', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'PASTA',
              items: [
                {
                  name: 'Custom Pasta',
                  price: 14.00,
                  confidence: 0.95,
                  modifierGroups: [
                    {
                      name: 'Choose Your Pasta',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Spaghetti', priceDelta: 0 },
                        { name: 'Penne', priceDelta: 0 },
                        { name: 'Fettuccine', priceDelta: 1.00 }
                      ]
                    },
                    {
                      name: 'Choose Your Sauce',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Marinara', priceDelta: 0 },
                        { name: 'Alfredo', priceDelta: 2.00 },
                        { name: 'Pesto', priceDelta: 2.50 }
                      ]
                    },
                    {
                      name: 'Add Toppings',
                      type: 'multi',
                      required: false,
                      options: [
                        { name: 'Mushrooms', priceDelta: 2.00 },
                        { name: 'Olives', priceDelta: 1.50 }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should reject modifier group with invalid type', () => {
      const result = {
        menu: {
          categories: [
            {
              name: 'BURGERS',
              items: [
                {
                  name: 'Burger',
                  price: 12.00,
                  confidence: 0.95,
                  modifierGroups: [
                    {
                      name: 'Choose Sauce',
                      type: 'invalid', // Invalid type
                      required: true,
                      options: [{ name: 'BBQ', priceDelta: 0 }]
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(false)
    })
  })

  describe('Set menu validation', () => {
    it('should validate set menu with courses', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SET MENUS',
              items: [
                {
                  name: '3-Course Dinner',
                  price: 45.00,
                  confidence: 0.90,
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

    it('should validate set menu with price variations', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'LUNCH SETS',
              items: [
                {
                  name: 'Business Lunch',
                  price: 25.00,
                  confidence: 0.90,
                  type: 'set_menu',
                  setMenu: {
                    courses: [
                      {
                        name: 'Main',
                        options: [
                          { name: 'Chicken Rice', priceDelta: 0 },
                          { name: 'Beef Noodles', priceDelta: 3.00 },
                          { name: 'Premium Seafood', priceDelta: 8.00 }
                        ]
                      }
                    ]
                  }
                }
              ],
              confidence: 0.90
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Additional info validation', () => {
    it('should validate item with serving information', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SHARING PLATES',
              items: [
                {
                  name: 'Seafood Platter',
                  price: 68.00,
                  confidence: 0.90,
                  additional: {
                    servedWith: ['Lemon wedges', 'Garlic butter', 'Fries'],
                    forPax: 3,
                    prepTimeMin: 25,
                    notes: 'Contains shellfish'
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should validate item with partial additional info', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'MAINS',
              items: [
                {
                  name: 'Grilled Fish',
                  price: 22.00,
                  confidence: 0.95,
                  additional: {
                    servedWith: ['Seasonal vegetables']
                  }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Backward compatibility with Stage 1', () => {
    it('should accept Stage 1 format items (no variants/modifiers)', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'APPETIZERS',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 6.50,
                  description: 'Crispy vegetable rolls',
                  confidence: 0.95
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })

    it('should accept mixed Stage 1 and Stage 2 items', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'MENU',
              items: [
                {
                  name: 'Simple Item',
                  price: 10.00,
                  confidence: 0.95
                },
                {
                  name: 'Item with Variants',
                  confidence: 0.95,
                  variants: [
                    { size: 'Small', price: 8.00, confidence: 0.95 },
                    { size: 'Large', price: 12.00, confidence: 0.95 }
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

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Complex nested structures', () => {
    it('should validate item with variants, modifiers, and additional info', () => {
      const result: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'PREMIUM STEAKS',
              items: [
                {
                  name: 'Wagyu Ribeye',
                  confidence: 0.90,
                  variants: [
                    { size: '200g', price: 45.00, confidence: 0.90 },
                    { size: '300g', price: 65.00, confidence: 0.90 }
                  ],
                  modifierGroups: [
                    {
                      name: 'Choose Your Doneness',
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
                    servedWith: ['Mashed potatoes', 'Grilled vegetables'],
                    prepTimeMin: 20,
                    notes: 'Premium Australian Wagyu'
                  }
                }
              ],
              confidence: 0.90
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(result)
      expect(validation.valid).toBe(true)
    })
  })
})
