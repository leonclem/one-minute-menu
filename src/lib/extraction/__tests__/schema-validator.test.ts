/**
 * Tests for Schema Validator
 */

import {
  SchemaValidator,
  validateExtraction,
  validateMenuStructure,
  isValidExtractionResult
} from '../schema-validator'
import {
  EXAMPLE_SIMPLE_MENU,
  EXAMPLE_HIERARCHICAL_MENU,
  EXAMPLE_WITH_UNCERTAINTIES
} from '../example-outputs'
import type { ExtractionResult } from '../schema-stage1'

describe('SchemaValidator', () => {
  let validator: SchemaValidator

  beforeEach(() => {
    validator = new SchemaValidator()
  })

  describe('validateExtractionResult', () => {
    it('should validate a simple valid menu', () => {
      const result = validator.validateExtractionResult(EXAMPLE_SIMPLE_MENU)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data).toBeDefined()
    })

    it('should validate a hierarchical menu', () => {
      const result = validator.validateExtractionResult(EXAMPLE_HIERARCHICAL_MENU)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate menu with uncertainties', () => {
      const result = validator.validateExtractionResult(EXAMPLE_WITH_UNCERTAINTIES)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      // Note: warnings are only generated for confidence < 0.6, EXAMPLE_WITH_UNCERTAINTIES has 0.75-0.9
    })

    it('should reject invalid data with missing required fields', () => {
      const invalidData = {
        menu: {
          categories: []
        }
        // Missing currency, uncertainItems, superfluousText
      }
      
      const result = validator.validateExtractionResult(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject menu with empty categories array', () => {
      const invalidData = {
        menu: {
          categories: []
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('at least one category'))).toBe(true)
    })

    it('should reject items with negative prices', () => {
      const invalidData = {
        menu: {
          categories: [
            {
              name: 'Test Category',
              items: [
                {
                  name: 'Test Item',
                  price: -10,
                  confidence: 1.0
                }
              ],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('negative'))).toBe(true)
    })

    it('should reject items with invalid confidence scores', () => {
      const invalidData = {
        menu: {
          categories: [
            {
              name: 'Test Category',
              items: [
                {
                  name: 'Test Item',
                  price: 10,
                  confidence: 1.5 // Invalid: > 1.0
                }
              ],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(invalidData)
      
      expect(result.valid).toBe(false)
    })
  })

  describe('validateMenu', () => {
    it('should validate just the menu structure', () => {
      const result = validator.validateMenu(EXAMPLE_SIMPLE_MENU.menu)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateCategory', () => {
    it('should validate a single category', () => {
      const category = EXAMPLE_SIMPLE_MENU.menu.categories[0]
      const result = validator.validateCategory(category)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject category with empty name', () => {
      const invalidCategory = {
        name: '',
        items: [],
        confidence: 1.0
      }
      
      const result = validator.validateCategory(invalidCategory)
      
      expect(result.valid).toBe(false)
    })
  })

  describe('validateMenuItem', () => {
    it('should validate a single menu item', () => {
      const item = EXAMPLE_SIMPLE_MENU.menu.categories[0].items[0]
      const result = validator.validateMenuItem(item)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject item with missing name', () => {
      const invalidItem = {
        price: 10,
        confidence: 1.0
      }
      
      const result = validator.validateMenuItem(invalidItem)
      
      expect(result.valid).toBe(false)
    })
  })

  describe('salvagePartialData', () => {
    it('should salvage valid items from partially invalid data', () => {
      const partiallyInvalidData = {
        menu: {
          categories: [
            {
              name: 'Valid Category',
              items: [
                {
                  name: 'Valid Item',
                  price: 10,
                  confidence: 1.0
                },
                {
                  name: 'Invalid Item',
                  price: -5, // Invalid price
                  confidence: 1.0
                }
              ],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const { salvaged, itemsRecovered, categoriesRecovered } = validator.salvagePartialData(partiallyInvalidData)
      
      expect(itemsRecovered).toBe(1) // Only the valid item
      expect(categoriesRecovered).toBe(1)
      expect(salvaged.menu?.categories[0].items).toHaveLength(1)
    })

    it('should use default currency if invalid', () => {
      const dataWithInvalidCurrency = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10, confidence: 1.0 }],
              confidence: 1.0
            }
          ]
        },
        currency: '', // Invalid
        uncertainItems: [],
        superfluousText: []
      }
      
      const { salvaged } = validator.salvagePartialData(dataWithInvalidCurrency)
      
      expect(salvaged.currency).toBe('SGD') // Default fallback
    })
  })

  describe('warnings generation', () => {
    it('should generate warnings for low confidence items', () => {
      const dataWithLowConfidence: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test Category',
              items: [
                {
                  name: 'Low Confidence Item',
                  price: 10,
                  confidence: 0.5 // Below 0.6 threshold
                }
              ],
              confidence: 0.55 // Below 0.6 threshold
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(dataWithLowConfidence)
      
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.message.includes('low confidence'))).toBe(true)
    })

    it('should warn about empty categories', () => {
      const dataWithEmptyCategory: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Empty Category',
              items: [],
              confidence: 1.0
            },
            {
              name: 'Valid Category',
              items: [{ name: 'Item', price: 10, confidence: 1.0 }],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(dataWithEmptyCategory)
      
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.message.includes('no items'))).toBe(true)
    })

    it('should warn about suspicious prices', () => {
      const dataWithHighPrice: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                {
                  name: 'Expensive Item',
                  price: 99999,
                  confidence: 1.0
                }
              ],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }
      
      const result = validator.validateExtractionResult(dataWithHighPrice)
      
      expect(result.warnings.some(w => w.message.includes('unusually high price'))).toBe(true)
    })
  })

  describe('convenience functions', () => {
    it('validateExtraction should work', () => {
      const result = validateExtraction(EXAMPLE_SIMPLE_MENU)
      expect(result.valid).toBe(true)
    })

    it('validateMenuStructure should work', () => {
      const result = validateMenuStructure(EXAMPLE_SIMPLE_MENU.menu)
      expect(result.valid).toBe(true)
    })

    it('isValidExtractionResult should work as type guard', () => {
      expect(isValidExtractionResult(EXAMPLE_SIMPLE_MENU)).toBe(true)
      expect(isValidExtractionResult({ invalid: 'data' })).toBe(false)
    })
  })

  describe('getSchemaInfo', () => {
    it('should return schema version information', () => {
      const info = validator.getSchemaInfo()
      
      expect(info.version).toBe('stage1')
      expect(info.versionNumber).toBeDefined()
      expect(info.description).toBeDefined()
    })
  })
})
