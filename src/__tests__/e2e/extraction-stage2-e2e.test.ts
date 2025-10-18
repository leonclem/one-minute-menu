/**
 * End-to-End Tests for Stage 2 Extraction Flow
 * 
 * Tests the complete user journey for Stage 2 extraction:
 * 1. Upload menu image
 * 2. Extract with Stage 2 schema
 * 3. Review variants and modifiers
 * 4. Make corrections
 * 5. Save menu
 */

import { SchemaValidator } from '@/lib/extraction/schema-validator'
import type { ExtractionResultV2, MenuItemV2 } from '@/lib/extraction/schema-stage2'

describe('Stage 2 Extraction E2E Flow', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator('stage2')
  })

  describe('Complete extraction flow with variants', () => {
    it('should complete full flow: extract -> validate -> correct -> save', () => {
      // Step 1: Simulate extraction result from vision LLM
      const extractionResult: ExtractionResultV2 = {
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

      // Step 2: Validate extraction
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)

      // Step 3: User reviews and makes correction (e.g., fixes price)
      const correctedItem: MenuItemV2 = {
        ...extractionResult.menu.categories[0].items[0],
        variants: [
          { size: 'Small', price: 3.00, confidence: 0.95 }, // Corrected from 3.50
          { size: 'Medium', price: 4.50, confidence: 0.95 },
          { size: 'Large', price: 5.50, confidence: 0.95 }
        ]
      }

      extractionResult.menu.categories[0].items[0] = correctedItem

      // Step 4: Validate corrected data
      const finalValidation = validator.validateExtractionResult(extractionResult)
      expect(finalValidation.valid).toBe(true)

      // Step 5: Verify final state
      expect(extractionResult.menu.categories[0].items[0].variants![0].price).toBe(3.00)
    })
  })

  describe('Complete extraction flow with modifiers', () => {
    it('should complete full flow with modifier group corrections', () => {
      // Step 1: Initial extraction
      const extractionResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'BURGERS',
              items: [
                {
                  name: 'Classic Burger',
                  price: 12.00,
                  confidence: 0.90,
                  modifierGroups: [
                    {
                      name: 'Choose Your Sauce',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'BBQ Sauce', priceDelta: 0 },
                        { name: 'Garlic Mayo', priceDelta: 0 }
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

      // Step 2: Validate
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)

      // Step 3: User adds missing modifier option
      extractionResult.menu.categories[0].items[0].modifierGroups![0].options.push({
        name: 'Truffle Aioli',
        priceDelta: 2.00
      })

      // Step 4: Validate after correction
      const finalValidation = validator.validateExtractionResult(extractionResult)
      expect(finalValidation.valid).toBe(true)
      expect(extractionResult.menu.categories[0].items[0].modifierGroups![0].options).toHaveLength(3)
    })
  })

  describe('Complete extraction flow with set menu', () => {
    it('should complete full flow with set menu adjustments', () => {
      // Step 1: Initial extraction
      const extractionResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SET MENUS',
              items: [
                {
                  name: '3-Course Dinner',
                  price: 45.00,
                  confidence: 0.85,
                  type: 'set_menu',
                  setMenu: {
                    courses: [
                      {
                        name: 'Appetizer',
                        options: [
                          { name: 'Soup', priceDelta: 0 },
                          { name: 'Salad', priceDelta: 0 }
                        ]
                      },
                      {
                        name: 'Main',
                        options: [
                          { name: 'Chicken', priceDelta: 0 },
                          { name: 'Fish', priceDelta: 5.00 }
                        ]
                      }
                    ]
                  }
                }
              ],
              confidence: 0.85
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      // Step 2: Validate
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)

      // Step 3: User adds missing dessert course
      extractionResult.menu.categories[0].items[0].setMenu!.courses.push({
        name: 'Dessert',
        options: [
          { name: 'Ice Cream', priceDelta: 0 },
          { name: 'Cake', priceDelta: 0 }
        ]
      })

      // Step 4: Validate after correction
      const finalValidation = validator.validateExtractionResult(extractionResult)
      expect(finalValidation.valid).toBe(true)
      expect(extractionResult.menu.categories[0].items[0].setMenu!.courses).toHaveLength(3)
    })
  })

  describe('Handling uncertain items in Stage 2 context', () => {
    it('should resolve uncertain items as variants', () => {
      // Step 1: Extraction with uncertain item
      const extractionResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'PIZZAS',
              items: [
                {
                  name: 'Margherita Pizza',
                  price: 12.00,
                  confidence: 0.90
                }
              ],
              confidence: 0.90
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [
          {
            text: 'Large $18',
            reason: 'Possible variant but unclear association',
            confidence: 0.65,
            suggestedPrice: 18.00
          }
        ],
        superfluousText: []
      }

      // Step 2: Validate initial state
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)
      expect(extractionResult.uncertainItems).toHaveLength(1)

      // Step 3: User resolves uncertain item as variant
      extractionResult.menu.categories[0].items[0].variants = [
        { size: 'Regular', price: 12.00, confidence: 0.90 },
        { size: 'Large', price: 18.00, confidence: 0.65 }
      ]
      delete extractionResult.menu.categories[0].items[0].price
      extractionResult.uncertainItems = []

      // Step 4: Validate resolved state
      const finalValidation = validator.validateExtractionResult(extractionResult)
      expect(finalValidation.valid).toBe(true)
      expect(extractionResult.menu.categories[0].items[0].variants).toHaveLength(2)
      expect(extractionResult.uncertainItems).toHaveLength(0)
    })

    it('should resolve uncertain items as modifiers', () => {
      // Step 1: Extraction with uncertain modifier
      const extractionResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'SALADS',
              items: [
                {
                  name: 'Caesar Salad',
                  price: 10.00,
                  confidence: 0.92
                }
              ],
              confidence: 0.92
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [
          {
            text: 'Add Chicken +$4',
            reason: 'Possible modifier but unclear if it applies to all salads',
            confidence: 0.70,
            suggestedPrice: 4.00
          }
        ],
        superfluousText: []
      }

      // Step 2: User resolves as modifier
      extractionResult.menu.categories[0].items[0].modifierGroups = [
        {
          name: 'Add Protein',
          type: 'multi',
          required: false,
          options: [
            { name: 'Grilled Chicken', priceDelta: 4.00 }
          ]
        }
      ]
      extractionResult.uncertainItems = []

      // Step 3: Validate resolved state
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)
      expect(extractionResult.menu.categories[0].items[0].modifierGroups).toHaveLength(1)
    })
  })

  describe('Mixed Stage 1 and Stage 2 items workflow', () => {
    it('should handle menu with both simple and complex items', () => {
      const mixedMenu: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'MENU',
              items: [
                // Stage 1 style item
                {
                  name: 'Garlic Bread',
                  price: 5.00,
                  description: 'Toasted with butter',
                  confidence: 0.95
                },
                // Stage 2 item with variants
                {
                  name: 'Pasta',
                  confidence: 0.90,
                  variants: [
                    { size: 'Regular', price: 14.00, confidence: 0.90 },
                    { size: 'Large', price: 18.00, confidence: 0.90 }
                  ]
                },
                // Stage 2 item with modifiers
                {
                  name: 'Steak',
                  price: 28.00,
                  confidence: 0.92,
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
                    }
                  ]
                }
              ],
              confidence: 0.92
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(mixedMenu)
      expect(validation.valid).toBe(true)
      expect(mixedMenu.menu.categories[0].items).toHaveLength(3)
      
      // Verify Stage 1 item
      expect(mixedMenu.menu.categories[0].items[0].price).toBe(5.00)
      expect(mixedMenu.menu.categories[0].items[0].variants).toBeUndefined()
      
      // Verify Stage 2 items
      expect(mixedMenu.menu.categories[0].items[1].variants).toHaveLength(2)
      expect(mixedMenu.menu.categories[0].items[2].modifierGroups).toHaveLength(1)
    })
  })

  describe('Error recovery in Stage 2 flow', () => {
    it('should handle validation errors and allow corrections', () => {
      // Step 1: Invalid extraction (missing required field)
      const invalidResult = {
        menu: {
          categories: [
            {
              name: 'ITEMS',
              items: [
                {
                  name: 'Invalid Item',
                  confidence: 0.90,
                  modifierGroups: [
                    {
                      name: 'Choose Option',
                      type: 'invalid_type', // Invalid type
                      required: true,
                      options: []
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

      // Step 2: Validation should fail
      const validation = validator.validateExtractionResult(invalidResult)
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)

      // Step 3: Fix the error
      const fixedResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'ITEMS',
              items: [
                {
                  name: 'Fixed Item',
                  price: 10.00,
                  confidence: 0.90,
                  modifierGroups: [
                    {
                      name: 'Choose Option',
                      type: 'single', // Fixed type
                      required: true,
                      options: [
                        { name: 'Option A', priceDelta: 0 }
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

      // Step 4: Validation should pass
      const finalValidation = validator.validateExtractionResult(fixedResult)
      expect(finalValidation.valid).toBe(true)
    })
  })

  describe('Complete restaurant setup flow', () => {
    it('should simulate complete restaurant menu setup with Stage 2 features', () => {
      // Simulate a restaurant owner uploading their menu and going through the full flow
      
      // Step 1: Initial extraction
      const extractionResult: ExtractionResultV2 = {
        menu: {
          categories: [
            {
              name: 'APPETIZERS',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 6.00,
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            },
            {
              name: 'MAINS',
              items: [
                {
                  name: 'Pad Thai',
                  confidence: 0.90,
                  variants: [
                    { size: 'Regular', price: 12.00, confidence: 0.90 },
                    { size: 'Large', price: 16.00, confidence: 0.90 }
                  ],
                  modifierGroups: [
                    {
                      name: 'Spice Level',
                      type: 'single',
                      required: true,
                      options: [
                        { name: 'Mild', priceDelta: 0 },
                        { name: 'Medium', priceDelta: 0 },
                        { name: 'Spicy', priceDelta: 0 }
                      ]
                    },
                    {
                      name: 'Add Protein',
                      type: 'single',
                      required: false,
                      options: [
                        { name: 'Chicken', priceDelta: 3.00 },
                        { name: 'Shrimp', priceDelta: 5.00 }
                      ]
                    }
                  ]
                }
              ],
              confidence: 0.90
            },
            {
              name: 'SET MEALS',
              items: [
                {
                  name: 'Lunch Special',
                  price: 15.00,
                  confidence: 0.85,
                  type: 'set_menu',
                  setMenu: {
                    courses: [
                      {
                        name: 'Main',
                        options: [
                          { name: 'Pad Thai', priceDelta: 0 },
                          { name: 'Green Curry', priceDelta: 0 }
                        ]
                      },
                      {
                        name: 'Side',
                        options: [
                          { name: 'Spring Roll', priceDelta: 0 },
                          { name: 'Soup', priceDelta: 0 }
                        ]
                      }
                    ],
                    notes: 'Includes drink'
                  }
                }
              ],
              confidence: 0.85
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: [
          {
            text: 'Follow us on Instagram @restaurant',
            context: 'Footer',
            confidence: 0.95
          }
        ]
      }

      // Step 2: Validate extraction
      const validation = validator.validateExtractionResult(extractionResult)
      expect(validation.valid).toBe(true)

      // Step 3: Verify all Stage 2 features are present
      expect(extractionResult.menu.categories).toHaveLength(3)
      
      // Check variants
      const padThai = extractionResult.menu.categories[1].items[0]
      expect(padThai.variants).toHaveLength(2)
      
      // Check modifiers
      expect(padThai.modifierGroups).toHaveLength(2)
      
      // Check set menu
      const lunchSpecial = extractionResult.menu.categories[2].items[0]
      expect(lunchSpecial.type).toBe('set_menu')
      expect(lunchSpecial.setMenu?.courses).toHaveLength(2)
      
      // Check superfluous text was captured
      expect(extractionResult.superfluousText).toHaveLength(1)

      // Step 4: Simulate saving to database (validation passes)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })
})
